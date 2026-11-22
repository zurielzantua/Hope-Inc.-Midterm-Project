import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import type { ProductEditInput, ProductInput, ProductMutationActor } from '@/lib/product-mutations';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export type ProductFormRecord = {
  productCode: string;
  description: string | null;
  unit: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

function mapProduct(value: unknown, role: string): ProductFormRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid product record');
  const row = value as Record<string, unknown>;
  if (typeof row.prodcode !== 'string' || (row.description !== null && typeof row.description !== 'string') ||
      (row.unit !== null && typeof row.unit !== 'string')) throw new Error('Invalid product record');
  const product: ProductFormRecord = { productCode: row.prodcode, description: row.description, unit: row.unit };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean' || (row.stamp !== null && typeof row.stamp !== 'string')) throw new Error('Invalid product record');
    product.status = row.is_deleted ? 'inactive' : 'active';
    product.stamp = row.stamp;
  }
  return product;
}

export function productMutationDependencies() {
  return {
    appOrigin: process.env.HOPE_APP_URL || (process.env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:3000'),
    async getActor(): Promise<ProductMutationActor | null> {
      const access = await loadCurrentErpModules();
      if (!access) return null;
      if (access.unavailable) throw new Error('Product permissions are unavailable');
      return { userId: access.userId, role: access.role, modules: access.modules, rights: access.rights };
    },
    async createProduct(input: ProductInput) {
      const { error } = await adminClient().from('product').insert({
        prodcode: input.productCode,
        description: input.description,
        unit: input.unit,
      });
      if (error) throw error;
    },
    async updateProduct(productCode: string, input: ProductEditInput, role: string) {
      let query = adminClient().from('product').update({ description: input.description, unit: input.unit }).eq('prodcode', productCode);
      if (role === 'user') query = query.eq('is_deleted', false);
      const { data, error } = await query.select('prodcode').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async getProductForEdit(productCode: string, role: string) {
      const userView = role === 'user';
      const { data, error } = await adminClient().from(userView ? 'product_active' : 'product')
        .select(userView ? 'prodcode,description,unit' : 'prodcode,description,unit,is_deleted,stamp')
        .eq('prodcode', productCode)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProduct(data, role) : null;
    },
  };
}
