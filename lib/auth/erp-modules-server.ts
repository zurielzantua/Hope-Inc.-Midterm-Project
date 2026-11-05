import { authorizeRequest, createSessionClient } from '@/lib/auth/server';
import { getVisibleErpModules, type ErpModule } from '@/lib/auth/erp-modules';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export type ErpModuleAccess = {
  userId: string;
  role: string;
  modules: ErpModule[];
  unavailable: boolean;
};

function unavailable(userId: string, role: string): ErpModuleAccess {
  return { userId, role, modules: [], unavailable: true };
}

export async function loadCurrentErpModules(): Promise<ErpModuleAccess | null> {
  const access = await authorizeRequest();
  if (!access.allowed) return null;

  const sessionClient = await createSessionClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return null;
  const userId = authData.user.id;
  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    const { url, key } = getSupabaseConfig();
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) return unavailable(userId, access.role);
    adminClient = createSupabaseAdminClient(url, secret, key);
  } catch {
    return unavailable(userId, access.role);
  }

  const { data: assignments, error: assignmentError } = await adminClient
    .from('user_permission')
    .select('right_id')
    .eq('auth_user_id', userId)
    .eq('is_deleted', false);
  if (assignmentError) return unavailable(userId, access.role);

  const rightIds = Array.from(new Set((assignments ?? [])
    .map((assignment) => assignment.right_id)
    .filter((rightId) => Number.isSafeInteger(rightId) && rightId > 0)));
  if (rightIds.length === 0) return { userId, role: access.role, modules: [], unavailable: false };

  const { data: rights, error: rightError } = await adminClient
    .from('right_catalog')
    .select('right_id,module_id')
    .in('right_id', rightIds)
    .eq('is_deleted', false);
  if (rightError) return unavailable(userId, access.role);

  const moduleIds = Array.from(new Set((rights ?? [])
    .map((right) => right.module_id)
    .filter((moduleId) => Number.isSafeInteger(moduleId) && moduleId > 0)));
  if (moduleIds.length === 0) return { userId, role: access.role, modules: [], unavailable: false };

  const { data: modules, error: moduleError } = await adminClient
    .from('module')
    .select('module_id,module_code')
    .in('module_id', moduleIds)
    .eq('is_deleted', false);
  if (moduleError) return unavailable(userId, access.role);

  const assignedCodes = Array.from(new Set((modules ?? [])
    .map((module) => module.module_code)
    .filter((moduleCode): moduleCode is string => typeof moduleCode === 'string')));
  return { userId, role: access.role, modules: getVisibleErpModules(assignedCodes), unavailable: false };
}
