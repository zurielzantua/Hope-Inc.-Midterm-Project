import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import type { DepartmentEditInput, DepartmentInput, DepartmentMutationActor } from '@/lib/department-mutations';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export type DepartmentFormRecord = {
  departmentCode: string;
  name: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

function mapDepartment(value: unknown, role: string): DepartmentFormRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid department record');
  const row = value as Record<string, unknown>;
  if (typeof row.deptcode !== 'string' || (row.deptname !== null && typeof row.deptname !== 'string')) {
    throw new Error('Invalid department record');
  }
  const department: DepartmentFormRecord = { departmentCode: row.deptcode, name: row.deptname };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean' || (row.stamp !== null && typeof row.stamp !== 'string')) {
      throw new Error('Invalid department record');
    }
    department.status = row.is_deleted ? 'inactive' : 'active';
    department.stamp = row.stamp;
  }
  return department;
}

export function departmentMutationDependencies() {
  return {
    appOrigin: process.env.HOPE_APP_URL || (process.env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:3000'),
    async getActor(): Promise<DepartmentMutationActor | null> {
      const access = await loadCurrentErpModules();
      if (!access) return null;
      if (access.unavailable) throw new Error('Human Resources permissions are unavailable');
      return { userId: access.userId, role: access.role, modules: access.modules, rights: access.rights };
    },
    async createDepartment(input: DepartmentInput) {
      const { error } = await adminClient().from('department').insert({
        deptcode: input.departmentCode,
        deptname: input.name,
      });
      if (error) throw error;
    },
    async updateDepartment(departmentCode: string, input: DepartmentEditInput, role: string) {
      let query = adminClient().from('department').update({ deptname: input.name }).eq('deptcode', departmentCode);
      if (role === 'user') query = query.eq('is_deleted', false);
      const { data, error } = await query.select('deptcode').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async updateDepartmentStatus(departmentCode: string, isDeleted: boolean) {
      const { data, error } = await adminClient().from('department')
        .update({ is_deleted: isDeleted })
        .eq('deptcode', departmentCode)
        .eq('is_deleted', !isDeleted)
        .select('deptcode')
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async getDepartmentForEdit(departmentCode: string, role: string) {
      const userView = role === 'user';
      const { data, error } = await adminClient().from(userView ? 'department_active' : 'department')
        .select(userView ? 'deptcode,deptname' : 'deptcode,deptname,is_deleted,stamp')
        .eq('deptcode', departmentCode)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDepartment(data, role) : null;
    },
  };
}
