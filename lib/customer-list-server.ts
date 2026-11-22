import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { customerSearchFilter, type CustomerListRow, type CustomerListRole, type CustomerStatusFilter } from '@/lib/customer-list';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

function nullableString(value: unknown) {
  if (value === null || typeof value === 'string') return value;
  throw new Error('Invalid customer record');
}

function mapCustomer(value: unknown, role: CustomerListRole): CustomerListRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid customer record');
  const row = value as Record<string, unknown>;
  if (typeof row.custno !== 'string') throw new Error('Invalid customer record');
  const customer: CustomerListRow = {
    customerNo: row.custno,
    name: nullableString(row.custname),
    address: nullableString(row.address),
    paymentTerms: nullableString(row.payterm),
  };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean') throw new Error('Invalid customer record');
    customer.status = row.is_deleted ? 'inactive' : 'active';
    customer.stamp = nullableString(row.stamp);
  }
  return customer;
}

export function customerListDependencies() {
  return {
    async getAccess() {
      return loadCurrentErpModules();
    },
    async listCustomers({ role, status, search }: {
      role: CustomerListRole;
      status: CustomerStatusFilter;
      search: string;
    }) {
      const { url, key } = getSupabaseConfig();
      const secret = process.env.SUPABASE_SECRET_KEY;
      if (!secret) throw new Error('Server authentication configuration missing');
      const admin = createSupabaseAdminClient(url, secret, key);
      const table = role === 'user' ? 'customer_active' : 'customer';
      const columns = role === 'user'
        ? 'custno,custname,address,payterm'
        : 'custno,custname,address,payterm,is_deleted,stamp';
      let query = admin.from(table).select(columns);

      if (role !== 'user' && status !== 'all') query = query.eq('is_deleted', status === 'inactive');
      if (search) query = query.or(customerSearchFilter(search));
      const { data, error } = await query.order('custno', { ascending: true });
      if (error || !Array.isArray(data)) throw error ?? new Error('Invalid customer query result');
      return data.map((row: unknown) => mapCustomer(row, role));
    },
  };
}
