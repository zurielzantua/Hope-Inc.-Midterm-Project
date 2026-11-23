import type { ErpModule } from '@/lib/auth/erp-modules';

export type CustomerListRole = 'user' | 'admin' | 'superadmin';
export type CustomerStatusFilter = 'active' | 'inactive' | 'all';
export type CustomerListFilters = { search: string; status: CustomerStatusFilter };
export type CustomerListAccess = {
  role: string;
  modules: ErpModule[];
  unavailable: boolean;
};
export type CustomerListRow = {
  customerNo: string;
  name: string | null;
  address: string | null;
  paymentTerms: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};

type CustomerListQuery = CustomerListFilters & { role: CustomerListRole };
type Dependencies = {
  getAccess: () => Promise<CustomerListAccess | null>;
  listCustomers: (query: CustomerListQuery) => Promise<CustomerListRow[]>;
};
type Access = { role: CustomerListRole; modules: ErpModule[] };
export type CustomerListResult =
  | { kind: 'ok'; access: Access; filters: CustomerListFilters; customers: CustomerListRow[] }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'invalid'; access: Access; message: string }
  | { kind: 'unavailable'; access?: Access };

const roles = new Set<CustomerListRole>(['user', 'admin', 'superadmin']);
const statuses = new Set<CustomerStatusFilter>(['active', 'inactive', 'all']);
const searchLimit = 100;

function isCustomerListRole(role: string): role is CustomerListRole {
  return roles.has(role as CustomerListRole);
}

export function customerSearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const literal = pattern.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return ['custno', 'custname', 'address', 'payterm']
    .map((column) => `${column}.ilike."${literal}"`)
    .join(',');
}

function accessFor(role: CustomerListRole, modules: ErpModule[]): Access {
  return { role, modules };
}

export async function loadCustomerList(
  params: { search?: unknown; status?: unknown },
  deps: Dependencies,
): Promise<CustomerListResult> {
  let current: CustomerListAccess | null;
  try { current = await deps.getAccess(); }
  catch { return { kind: 'unavailable' }; }
  if (!current) return { kind: 'unauthenticated' };
  if (!isCustomerListRole(current.role)) return { kind: 'forbidden' };

  const access = accessFor(current.role, current.modules);
  if (current.unavailable) return { kind: 'unavailable', access };
  if (!current.modules.some((module) => module.code === 'customer')) return { kind: 'forbidden' };

  if (params.search !== undefined && typeof params.search !== 'string') {
    return { kind: 'invalid', access, message: 'Enter a valid customer search.' };
  }
  if (params.status !== undefined && (typeof params.status !== 'string' || !statuses.has(params.status as CustomerStatusFilter))) {
    return { kind: 'invalid', access, message: 'Choose a valid customer status filter.' };
  }

  const search = (params.search ?? '').trim();
  if (search.length > searchLimit || /[\u0000-\u001f\u007f]/.test(search)) {
    return { kind: 'invalid', access, message: `Search must be ${searchLimit} characters or fewer.` };
  }
  const status = current.role === 'user'
    ? 'active'
    : (params.status as CustomerStatusFilter | undefined) ?? 'all';
  const filters = { search, status };

  try {
    const customers = await deps.listCustomers({ role: current.role, ...filters });
    return { kind: 'ok', access, filters, customers };
  } catch {
    return { kind: 'unavailable', access };
  }
}

function privateJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function handleCustomerListRequest(request: Request, deps: Dependencies) {
  let params: URLSearchParams;
  try { params = new URL(request.url).searchParams; }
  catch { return privateJson(400, { error: 'Enter valid customer list filters.' }); }

  const searchValues = params.getAll('q');
  const statusValues = params.getAll('status');
  const result = await loadCustomerList({
    search: searchValues.length > 1 ? searchValues : searchValues[0],
    status: statusValues.length > 1 ? statusValues : statusValues[0],
  }, deps);

  if (result.kind === 'unauthenticated') return privateJson(401, { error: 'Sign in to continue.' });
  if (result.kind === 'forbidden') return privateJson(403, { error: 'You do not have access to Customer Management.' });
  if (result.kind === 'invalid') return privateJson(400, { error: result.message });
  if (result.kind === 'unavailable') return privateJson(503, { error: 'Customer records are temporarily unavailable.' });
  return privateJson(200, {
    customers: result.customers,
    search: result.filters.search,
    status: result.filters.status,
  });
}
