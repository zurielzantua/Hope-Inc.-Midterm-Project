import type { ErpModule } from '@/lib/auth/erp-modules';

export type ProductListRole = 'user' | 'admin' | 'superadmin';
export type ProductStatusFilter = 'active' | 'inactive' | 'all';
export type ProductListFilters = { search: string; status: ProductStatusFilter };
export type ProductListAccess = { role: string; modules: ErpModule[]; rights?: string[]; unavailable: boolean };
export type ProductListRow = {
  productCode: string;
  description: string | null;
  unit: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};

type ProductListQuery = ProductListFilters & { role: ProductListRole };
type Dependencies = {
  getAccess: () => Promise<ProductListAccess | null>;
  listProducts: (query: ProductListQuery) => Promise<ProductListRow[]>;
};
type Access = { role: ProductListRole; modules: ErpModule[]; rights: string[] };
export type ProductListResult =
  | { kind: 'ok'; access: Access; filters: ProductListFilters; products: ProductListRow[] }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'invalid'; access: Access; message: string }
  | { kind: 'unavailable'; access?: Access };

const roles = new Set<ProductListRole>(['user', 'admin', 'superadmin']);
const statuses = new Set<ProductStatusFilter>(['active', 'inactive', 'all']);
const searchLimit = 100;

function isProductListRole(role: string): role is ProductListRole {
  return roles.has(role as ProductListRole);
}

export function productSearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const literal = pattern.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return ['prodcode', 'description', 'unit'].map((column) => `${column}.ilike."${literal}"`).join(',');
}

export async function loadProductList(
  params: { search?: unknown; status?: unknown },
  deps: Dependencies,
): Promise<ProductListResult> {
  let current: ProductListAccess | null;
  try { current = await deps.getAccess(); }
  catch { return { kind: 'unavailable' }; }
  if (!current) return { kind: 'unauthenticated' };
  if (!isProductListRole(current.role)) return { kind: 'forbidden' };

  const access = { role: current.role, modules: current.modules, rights: current.rights ?? [] };
  if (current.unavailable) return { kind: 'unavailable', access };
  if (!current.modules.some((module) => module.code === 'product')) return { kind: 'forbidden' };

  if (params.search !== undefined && typeof params.search !== 'string') {
    return { kind: 'invalid', access, message: 'Enter a valid product search.' };
  }
  if (params.status !== undefined && (typeof params.status !== 'string' || !statuses.has(params.status as ProductStatusFilter))) {
    return { kind: 'invalid', access, message: 'Choose a valid product status filter.' };
  }

  const search = (params.search ?? '').trim();
  if (search.length > searchLimit || /[\u0000-\u001f\u007f]/.test(search)) {
    return { kind: 'invalid', access, message: `Search must be ${searchLimit} characters or fewer.` };
  }
  if (current.role === 'user' && params.status !== undefined && params.status !== 'active') {
    return { kind: 'forbidden' };
  }

  const status = current.role === 'user' ? 'active' : (params.status as ProductStatusFilter | undefined) ?? 'all';
  const filters = { search, status };
  try {
    const products = await deps.listProducts({ role: current.role, ...filters });
    return { kind: 'ok', access, filters, products };
  } catch {
    return { kind: 'unavailable', access };
  }
}

function privateJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function handleProductListRequest(request: Request, deps: Dependencies) {
  let params: URLSearchParams;
  try { params = new URL(request.url).searchParams; }
  catch { return privateJson(400, { error: 'Enter valid product list filters.' }); }

  const searchValues = params.getAll('q');
  const statusValues = params.getAll('status');
  const result = await loadProductList({
    search: searchValues.length > 1 ? searchValues : searchValues[0],
    status: statusValues.length > 1 ? statusValues : statusValues[0],
  }, deps);

  if (result.kind === 'unauthenticated') return privateJson(401, { error: 'Sign in to continue.' });
  if (result.kind === 'forbidden') return privateJson(403, { error: 'You do not have access to Product Management.' });
  if (result.kind === 'invalid') return privateJson(400, { error: result.message });
  if (result.kind === 'unavailable') return privateJson(503, { error: 'Product records are temporarily unavailable.' });
  return privateJson(200, { products: result.products, search: result.filters.search, status: result.filters.status });
}
