import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import type { PriceHistoryActor, PriceHistoryRole, PriceHistoryRow, PriceProduct } from '@/lib/price-history';
import { normalizeUnitPrice } from '@/lib/price-history';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

function nullableString(value: unknown) {
  if (value === null || typeof value === 'string') return value;
  throw new Error('Invalid Product record');
}

function mapProduct(value: unknown, role: PriceHistoryRole): PriceProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Product record');
  const row = value as Record<string, unknown>;
  if (typeof row.prodcode !== 'string') throw new Error('Invalid Product record');
  const product: PriceProduct = {
    productCode: row.prodcode,
    description: nullableString(row.description),
    unit: nullableString(row.unit),
  };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean' || (row.stamp !== null && typeof row.stamp !== 'string')) throw new Error('Invalid Product record');
    product.status = row.is_deleted ? 'inactive' : 'active';
    product.stamp = row.stamp;
  }
  return product;
}

function mapPrice(value: unknown, role: PriceHistoryRole): PriceHistoryRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Price History record');
  const row = value as Record<string, unknown>;
  const unitPrice = normalizeUnitPrice(typeof row.unitprice === 'number' ? String(row.unitprice) : row.unitprice);
  if (typeof row.effdate !== 'string' || !unitPrice) throw new Error('Invalid Price History record');
  const price: PriceHistoryRow = { effectiveDate: row.effdate, unitPrice };
  if (role !== 'user') {
    if (typeof row.is_deleted !== 'boolean' || (row.stamp !== null && typeof row.stamp !== 'string')) throw new Error('Invalid Price History record');
    price.status = row.is_deleted ? 'inactive' : 'active';
    price.stamp = row.stamp;
  }
  return price;
}

export function priceHistoryDependencies() {
  return {
    appOrigin: process.env.HOPE_APP_URL || (process.env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:3000'),
    async getActor(): Promise<PriceHistoryActor | null> {
      return loadCurrentErpModules();
    },
    async getProduct(productCode: string, role: PriceHistoryRole) {
      const userView = role === 'user';
      const { data, error } = await adminClient().from(userView ? 'product_active' : 'product')
        .select(userView ? 'prodcode,description,unit' : 'prodcode,description,unit,is_deleted,stamp')
        .eq('prodcode', productCode)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProduct(data, role) : null;
    },
    async getPriceForEdit(productCode: string, effectiveDate: string, role: PriceHistoryRole) {
      const userView = role === 'user';
      const { data, error } = await adminClient().from(userView ? 'pricehist_active' : 'pricehist')
        .select(userView ? 'effdate,unitprice' : 'effdate,unitprice,is_deleted,stamp')
        .eq('prodcode', productCode)
        .eq('effdate', effectiveDate)
        .maybeSingle();
      if (error) throw error;
      return data ? mapPrice(data, role) : null;
    },
    async listPriceHistory(productCode: string, role: PriceHistoryRole) {
      const userView = role === 'user';
      const { data, error } = await adminClient().from(userView ? 'pricehist_active' : 'pricehist')
        .select(userView ? 'effdate,unitprice' : 'effdate,unitprice,is_deleted,stamp')
        .eq('prodcode', productCode)
        .order('effdate', { ascending: true });
      if (error || !Array.isArray(data)) throw error ?? new Error('Invalid Price History result');
      return data.map((row: unknown) => mapPrice(row, role));
    },
    async getCurrentPrice(productCode: string, asOfDate: string) {
      const { data, error } = await adminClient().rpc('product_price_as_of', {
        p_prod_code: productCode,
        p_as_of: asOfDate,
      });
      if (error) throw error;
      if (data === null) return null;
      const price = normalizeUnitPrice(typeof data === 'number' ? String(data) : data);
      if (!price) throw new Error('Invalid current price result');
      return price;
    },
    async isProductActive(productCode: string) {
      const { data, error } = await adminClient().from('product_active')
        .select('prodcode')
        .eq('prodcode', productCode)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async createPrice(productCode: string, input: { effectiveDate: string; unitPrice: string }) {
      const { error } = await adminClient().from('pricehist').insert({
        prodcode: productCode,
        effdate: input.effectiveDate,
        unitprice: input.unitPrice,
      });
      if (error) throw error;
    },
    async updatePrice(productCode: string, effectiveDate: string, unitPrice: string, role: PriceHistoryRole) {
      let query = adminClient().from('pricehist').update({ unitprice: unitPrice })
        .eq('prodcode', productCode)
        .eq('effdate', effectiveDate);
      if (role === 'user') query = query.eq('is_deleted', false);
      const { data, error } = await query.select('effdate').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async softDeletePrice(productCode: string, effectiveDate: string) {
      const query = adminClient().from('pricehist').update({ is_deleted: true })
        .eq('prodcode', productCode)
        .eq('effdate', effectiveDate)
        .eq('is_deleted', false);
      const { data, error } = await query.select('effdate').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  };
}

export function todayInManila() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}
