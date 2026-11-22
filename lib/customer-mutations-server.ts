import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import type { CustomerEditInput, CustomerInput, CustomerMutationActor } from '@/lib/customer-mutations';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export type CustomerFormRecord = {
  customerNo: string;
  name: string | null;
  address: string | null;
  paymentTerms: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

function mapCustomer(value: unknown, role: string): CustomerFormRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid customer record');
  const row = value as Record<string, unknown>;
  if (typeof row.custno !== 'string' || (row.custname !== null && typeof row.custname !== 'string') ||
      (row.address !== null && typeof row.address !== 'string') || (row.payterm !== null && typeof row.payterm !== 'string')) {
    throw new Error('Invalid customer record');
  }
  const customer: CustomerFormRecord = {
    customerNo: row.custno,
    name: row.custname,
    address: row.address,
    paymentTerms: row.payterm,
  };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean' || (row.stamp !== null && typeof row.stamp !== 'string')) throw new Error('Invalid customer record');
    customer.status = row.is_deleted ? 'inactive' : 'active';
    customer.stamp = row.stamp;
  }
  return customer;
}

export function customerMutationDependencies() {
  return {
    appOrigin: process.env.HOPE_APP_URL || (process.env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:3000'),
    async getActor(): Promise<CustomerMutationActor | null> {
      const access = await loadCurrentErpModules();
      if (!access) return null;
      if (access.unavailable) throw new Error('Customer permissions are unavailable');
      return {
        userId: access.userId,
        role: access.role,
        modules: access.modules,
        rights: access.rights,
      };
    },
    async createCustomer(input: CustomerInput) {
      const { error } = await adminClient().from('customer').insert({
        custno: input.customerNo,
        custname: input.name,
        address: input.address,
        payterm: input.paymentTerms,
      });
      if (error) throw error;
    },
    async updateCustomer(customerNo: string, input: CustomerEditInput, role: string) {
      let query = adminClient().from('customer').update({
        custname: input.name,
        address: input.address,
        payterm: input.paymentTerms,
      }).eq('custno', customerNo);
      if (role === 'user') query = query.eq('is_deleted', false);
      const { data, error } = await query.select('custno').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async getCustomerForEdit(customerNo: string, role: string) {
      const userView = role === 'user';
      const { data, error } = await adminClient().from(userView ? 'customer_active' : 'customer')
        .select(userView ? 'custno,custname,address,payterm' : 'custno,custname,address,payterm,is_deleted,stamp')
        .eq('custno', customerNo)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCustomer(data, role) : null;
    },
  };
}
