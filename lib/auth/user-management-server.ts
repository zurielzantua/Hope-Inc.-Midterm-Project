import { authorizeRequest } from '@/lib/auth/server';
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

function roleDetails(value: unknown) {
  const role = Array.isArray(value) ? value[0] : value;
  if (!role || typeof role !== 'object') return null;
  const details = role as { role_code?: unknown; role_name?: unknown; is_deleted?: unknown };
  if (typeof details.role_code !== 'string' || typeof details.role_name !== 'string' || details.is_deleted !== false) return null;
  return { roleCode: details.role_code, roleName: details.role_name };
}

function toUserRow(row: Record<string, unknown>, role: { roleCode: string; roleName: string }): UserManagementRow {
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
  };
}

export function userManagementDependencies() {
  return {
    async getActorRole() {
      const access = await authorizeRequest();
      return access.allowed ? access.role : null;
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
      return (profiles ?? []).flatMap((profile) => {
        const role = rolesById.get(String(profile.role_id));
        return role ? [toUserRow(profile, role)] : [];
      });
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
    async updateUser(actorRole: ManagerRole, userId: string, change: UserChange) {
      const admin = adminClient();
      const { data: target, error: lookupError } = await admin.from('app_user')
        .select('auth_user_id,first_name,last_name,email,role_id,account_state,is_blocked,is_deleted,role:role_id(role_code,role_name,is_deleted)')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!target) return null;
      const role = roleDetails(target.role);
      if (!role || target.is_deleted !== false || !canManageUserRole(actorRole, role.roleCode)) return null;

      if ('isBlocked' in change && target.is_blocked === change.isBlocked) return toUserRow(target, role);

      const { data, error } = await admin.from('app_user')
        .update('isBlocked' in change ? { is_blocked: change.isBlocked } : { first_name: change.firstName, last_name: change.lastName })
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
