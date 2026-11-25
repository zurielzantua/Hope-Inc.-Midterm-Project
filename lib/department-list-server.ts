import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { departmentSearchFilter, type DepartmentListRow, type DepartmentRole, type DepartmentStatusFilter } from '@/lib/department-list';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

function nullableString(value: unknown) {
  if (value === null || typeof value === 'string') return value;
  throw new Error('Invalid department record');
}

function mapDepartment(value: unknown, role: DepartmentRole): DepartmentListRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid department record');
  const row = value as Record<string, unknown>;
  if (typeof row.deptcode !== 'string') throw new Error('Invalid department record');
  const department: DepartmentListRow = { departmentCode: row.deptcode, name: nullableString(row.deptname) };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean') throw new Error('Invalid department record');
    department.status = row.is_deleted ? 'inactive' : 'active';
    department.stamp = nullableString(row.stamp);
  }
  return department;
}

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

export function departmentListDependencies() {
  return {
    getAccess: loadCurrentErpModules,
    async listDepartments({ role, status, search }: {
      role: DepartmentRole;
      status: DepartmentStatusFilter;
      search: string;
    }) {
      const table = role === 'user' ? 'department_active' : 'department';
      const columns = role === 'user' ? 'deptcode,deptname' : 'deptcode,deptname,is_deleted,stamp';
      let query = adminClient().from(table).select(columns);
      if (role !== 'user' && status !== 'all') query = query.eq('is_deleted', status === 'inactive');
      if (search) query = query.or(departmentSearchFilter(search));
      const { data, error } = await query.order('deptcode', { ascending: true });
      if (error || !Array.isArray(data)) throw error ?? new Error('Invalid department query result');
      return data.map((row: unknown) => mapDepartment(row, role));
    },
  };
}
