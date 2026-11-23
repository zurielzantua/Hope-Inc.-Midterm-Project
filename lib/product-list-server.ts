import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { normalizeUnitPrice } from '@/lib/price-history';
import { todayInManila } from '@/lib/price-history-server';
import { productSearchFilter, type ProductListRow, type ProductListRole, type ProductStatusFilter } from '@/lib/product-list';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

function nullableString(value: unknown) {
  if (value === null || typeof value === 'string') return value;
  throw new Error('Invalid product record');
}

function mapProduct(value: unknown, role: ProductListRole): ProductListRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid product record');
  const row = value as Record<string, unknown>;
  if (typeof row.prodcode !== 'string') throw new Error('Invalid product record');
  const product: ProductListRow = {
    productCode: row.prodcode,
    description: nullableString(row.description),
    unit: nullableString(row.unit),
    currentPrice: null,
  };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean') throw new Error('Invalid product record');
    product.status = row.is_deleted ? 'inactive' : 'active';
    product.stamp = nullableString(row.stamp);
  }
  return product;
}

export function productListDependencies() {
  return {
    getAccess: () => loadCurrentErpModules(),
    async listProducts({ role, status, search }: {
      role: ProductListRole;
      status: ProductStatusFilter;
      search: string;
    }) {
      const { url, key } = getSupabaseConfig();
      const secret = process.env.SUPABASE_SECRET_KEY;
      if (!secret) throw new Error('Server authentication configuration missing');
      const admin = createSupabaseAdminClient(url, secret, key);
      const activeOnly = role === 'user' || status === 'active';
      const table = activeOnly ? 'product_active' : 'product';
      const columns = role === 'user' ? 'prodcode,description,unit' : 'prodcode,description,unit,is_deleted,stamp';
      let query = admin.from(table).select(columns);

      if (role !== 'user' && status === 'inactive') query = query.eq('is_deleted', true);
      if (search) query = query.or(productSearchFilter(search));
      const { data, error } = await query.order('prodcode', { ascending: true });
      if (error || !Array.isArray(data)) throw error ?? new Error('Invalid product query result');
      const products = data.map((row: unknown) => mapProduct(row, role));
      if (products.length === 0) return products;

      const { data: priceRows, error: priceError } = await admin.rpc('product_prices_as_of', {
        p_prod_codes: products.map(({ productCode }) => productCode),
        p_as_of: todayInManila(),
      });
      if (priceError) throw priceError;
      if (!Array.isArray(priceRows)) throw new Error('Invalid current price query result');

      const requestedCodes = new Set(products.map(({ productCode }) => productCode));
      const currentPrices = new Map<string, string | null>();
      for (const value of priceRows) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Invalid current price result');
        }
        const row = value as Record<string, unknown>;
        if (typeof row.prodcode !== 'string' || !requestedCodes.has(row.prodcode) || currentPrices.has(row.prodcode)) {
          throw new Error('Invalid current price result');
        }
        if (row.unitprice === null) {
          currentPrices.set(row.prodcode, null);
          continue;
        }
        const price = normalizeUnitPrice(typeof row.unitprice === 'number' ? String(row.unitprice) : row.unitprice);
        if (!price) throw new Error('Invalid current price result');
        currentPrices.set(row.prodcode, price);
      }

      return products.map((product) => ({
        ...product,
        currentPrice: currentPrices.get(product.productCode) ?? null,
      }));
    },
  };
}
