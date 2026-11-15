import { authorizeRequest, createSessionClient } from '@/lib/auth/server';
import { readSetupCompletion } from '@/lib/auth/core';
import { canManageUserRole, visibleRoleCodes, type ManagerRole, type UserChange, type UserManagementRow } from '@/lib/auth/user-management';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { handleRegistrationRequest } from '@/lib/supabase/registration';

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingRpc(error: unknown) {
  if (!isRecord(error)) return false;
  const message = typeof error.message === 'string' ? error.message : '';
  return error.code === 'PGRST202' || error.code === '42883' ||
    (error.code === '42501' && /permission denied for function/i.test(message)) ||
    (error.status === 404 && /could not find the function|does not exist/i.test(message));
}

function rethrowRpc(error: unknown): never {
  if (isMissingRpc(error)) {
    throw Object.assign(new Error('Account management RPC is unavailable'), { code: 'RPC_UNAVAILABLE' });
  }
  throw error;
}

function roleDetails(value: unknown) {
  const role = Array.isArray(value) ? value[0] : value;
  if (!role || typeof role !== 'object') return null;
  const details = role as { role_code?: unknown; role_name?: unknown; is_deleted?: unknown };
  if (typeof details.role_code !== 'string' || typeof details.role_name !== 'string' || details.is_deleted !== false) return null;
  return { roleCode: details.role_code, roleName: details.role_name };
}

function toUserRow(
  row: Record<string, unknown>,
  role: { roleCode: string; roleName: string },
  setupComplete: boolean | null = null,
  invitationPending = false,
): UserManagementRow {
  return {
    authUserId: String(row.auth_user_id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    email: String(row.email),
    roleCode: role.roleCode as UserManagementRow['roleCode'],
    roleName: role.roleName,
    accountState: row.account_state as UserManagementRow['accountState'],
    isBlocked: row.is_blocked === true,
    isDeleted: row.is_deleted === true,
    setupComplete,
    invitationPending,
  };
}

export function userManagementDependencies() {
  return {
    async getActor() {
      const access = await authorizeRequest();
      if (!access.allowed) return null;
      const client = await createSessionClient();
      const { data, error } = await client.auth.getUser();
      if (error) {
        if ([400, 401, 403].includes(error.status ?? 0)) return null;
        throw error;
      }
      if (!data.user) return null;
      return { userId: data.user.id, role: access.role };
    },
    async listUsers(actorRole: ManagerRole) {
      const admin = adminClient();
      const visibleCodes = visibleRoleCodes(actorRole);
      const { data: roles, error: roleError } = await admin.from('role')
        .select('role_id,role_code,role_name,is_deleted')
        .in('role_code', visibleCodes)
        .eq('is_deleted', false);
      if (roleError) throw roleError;
      const activeRoles = roles ?? [];
      const roleIds = activeRoles.map((role) => role.role_id);
      if (roleIds.length === 0) return [];

      const { data: profiles, error } = await admin.from('app_user')
        .select('auth_user_id,first_name,last_name,email,role_id,account_state,is_blocked,is_deleted')
        .in('role_id', roleIds)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });
      if (error) throw error;
      const rolesById = new Map(activeRoles.map((role) => [String(role.role_id), { roleCode: role.role_code, roleName: role.role_name }]));
      const rows = (profiles ?? []).flatMap((profile) => {
        const role = rolesById.get(String(profile.role_id));
        return role ? [{ profile, role }] : [];
      });
      if (actorRole !== 'superadmin') return rows.map(({ profile, role }) => toUserRow(profile, role));

      return Promise.all(rows.map(async ({ profile, role }) => {
        const { data, error } = await admin.auth.admin.getUserById(profile.auth_user_id);
        if (error || !data.user) return toUserRow(profile, role);
        const metadata = data.user?.app_metadata;
        const setupComplete = readSetupCompletion(data.user, profile.auth_user_id);
        const invitationPending = typeof metadata?.hope_first_password_invitation_id === 'string' &&
          typeof metadata.hope_first_password_invitation_expires_at === 'number' &&
          metadata.hope_first_password_invitation_expires_at > Math.floor(Date.now() / 1000);
        return toUserRow(profile, role, setupComplete, invitationPending);
      }));
    },
    async createUser(input: { firstName: string; lastName: string; email: string }) {
      const env = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      };
      const request = new Request('https://hope.internal/api/user-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleRegistrationRequest(request, env, createSupabaseAdminClient);
    },
    async updateUser(actor: { userId: string; role: ManagerRole }, userId: string, change: UserChange) {
      const admin = adminClient();
      const { data: target, error: lookupError } = await admin.from('app_user')
        .select('auth_user_id,first_name,last_name,email,role_id,account_state,is_blocked,is_deleted,role:role_id(role_code,role_name,is_deleted)')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!target) return null;
      const role = roleDetails(target.role);
      if (!role || target.is_deleted !== false || !canManageUserRole(actor.role, role.roleCode)) return null;

      if ('isBlocked' in change && change.isBlocked && actor.userId === userId && role.roleCode === 'superadmin') return null;
      if ('accountState' in change && (
        role.roleCode !== 'user' || target.account_state !== 'pending' || target.is_blocked !== false
      )) return null;
      if ('roleCode' in change && (
        role.roleCode !== 'user' || target.account_state !== 'approved' || target.is_blocked !== false
      )) return null;

      if ('isBlocked' in change && target.is_blocked === change.isBlocked) return toUserRow(target, role);

      const reload = async () => {
        const { data, error } = await admin.from('app_user')
          .select('auth_user_id,first_name,last_name,email,role_id,account_state,is_blocked,is_deleted,role:role_id(role_code,role_name,is_deleted)')
          .eq('auth_user_id', userId).eq('is_deleted', false).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const updatedRole = roleDetails(data.role);
        return updatedRole ? toUserRow(data, updatedRole) : null;
      };

      if ('isBlocked' in change && role.roleCode === 'superadmin') {
        const client = await createSessionClient();
        const { data, error } = await client.rpc('set_superadmin_blocked', {
          p_auth_user_id: userId,
          p_is_blocked: change.isBlocked,
        });
        if (error) rethrowRpc(error);
        return data === true ? reload() : null;
      }

      if ('accountState' in change) {
        const client = await createSessionClient();
        const { data, error } = await client.rpc('approve_pending_user', { p_auth_user_id: userId });
        if (error) rethrowRpc(error);
        return data === true ? reload() : null;
      }

      if ('roleCode' in change) {
        const client = await createSessionClient();
        const { data, error } = await client.rpc('promote_user_to_admin', { p_auth_user_id: userId });
        if (error) rethrowRpc(error);
        return data === true ? reload() : null;
      }

      const fields = 'isBlocked' in change
        ? { is_blocked: change.isBlocked }
        : { first_name: change.firstName, last_name: change.lastName };

      const { data, error } = await admin.from('app_user')
        .update(fields)
        .eq('auth_user_id', userId)
        .eq('role_id', target.role_id)
        .eq('is_deleted', false)
        .select('auth_user_id,first_name,last_name,email,role_id,account_state,is_blocked,is_deleted')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return toUserRow(data, role);
    },
  };
}
