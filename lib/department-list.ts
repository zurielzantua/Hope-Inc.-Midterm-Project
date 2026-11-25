import type { ErpModule } from '@/lib/auth/erp-modules';

export type DepartmentRole = 'user' | 'admin' | 'superadmin';
export type DepartmentStatusFilter = 'active' | 'inactive' | 'all';
export type DepartmentListRow = {
  departmentCode: string;
  name: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};
export type DepartmentListFilters = { search: string; status: DepartmentStatusFilter };
export type DepartmentListAccess = {
  role: string;
  modules: ErpModule[];
  rights?: string[];
  unavailable: boolean;
};

type DepartmentQuery = DepartmentListFilters & { role: DepartmentRole };
type Dependencies = {
  getAccess: () => Promise<DepartmentListAccess | null>;
  listDepartments: (query: DepartmentQuery) => Promise<DepartmentListRow[]>;
};
type Access = { role: DepartmentRole; modules: ErpModule[]; rights: string[] };
export type DepartmentListResult =
  | { kind: 'ok'; access: Access; filters: DepartmentListFilters; departments: DepartmentListRow[] }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'invalid'; access: Access; message: string }
  | { kind: 'unavailable'; access?: Access };

const roles = new Set<DepartmentRole>(['user', 'admin', 'superadmin']);
const statuses = new Set<DepartmentStatusFilter>(['active', 'inactive', 'all']);
const searchLimit = 100;

export function departmentSearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const literal = pattern.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return ['deptcode', 'deptname'].map((column) => `${column}.ilike."${literal}"`).join(',');
}

export async function loadDepartmentList(
  params: { search?: unknown; status?: unknown },
  deps: Dependencies,
): Promise<DepartmentListResult> {
  let current: DepartmentListAccess | null;
  try { current = await deps.getAccess(); }
  catch { return { kind: 'unavailable' }; }
  if (!current) return { kind: 'unauthenticated' };
  if (!roles.has(current.role as DepartmentRole)) return { kind: 'forbidden' };

  const role = current.role as DepartmentRole;
  const access = { role, modules: current.modules, rights: current.rights ?? [] };
  if (current.unavailable) return { kind: 'unavailable', access };
  if (!current.modules.some(({ code }) => code === 'human_resources')) return { kind: 'forbidden' };

  if (params.search !== undefined && typeof params.search !== 'string') {
    return { kind: 'invalid', access, message: 'Enter a valid department search.' };
  }
  if (params.status !== undefined &&
      (typeof params.status !== 'string' || !statuses.has(params.status as DepartmentStatusFilter))) {
    return { kind: 'invalid', access, message: 'Choose a valid department status filter.' };
  }

  const search = (params.search ?? '').trim();
  if (search.length > searchLimit || /[\u0000-\u001f\u007f]/.test(search)) {
    return { kind: 'invalid', access, message: `Search must be ${searchLimit} characters or fewer.` };
  }
  const status = role === 'user'
    ? 'active'
    : (params.status as DepartmentStatusFilter | undefined) ?? 'all';
  const filters = { search, status };

  try {
    const departments = await deps.listDepartments({ role, ...filters });
    return { kind: 'ok', access, filters, departments };
  } catch {
    return { kind: 'unavailable', access };
  }
}

function privateJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function handleDepartmentListRequest(request: Request, deps: Dependencies) {
  let params: URLSearchParams;
  try { params = new URL(request.url).searchParams; }
  catch { return privateJson(400, { error: 'Enter valid department list filters.' }); }

  const searchValues = params.getAll('q');
  const statusValues = params.getAll('status');
  const result = await loadDepartmentList({
    search: searchValues.length > 1 ? searchValues : searchValues[0],
    status: statusValues.length > 1 ? statusValues : statusValues[0],
  }, deps);

  if (result.kind === 'unauthenticated') return privateJson(401, { error: 'Sign in to continue.' });
  if (result.kind === 'forbidden') return privateJson(403, { error: 'You do not have access to Human Resources.' });
  if (result.kind === 'invalid') return privateJson(400, { error: result.message });
  if (result.kind === 'unavailable') return privateJson(503, { error: 'Department records are temporarily unavailable.' });
  return privateJson(200, {
    departments: result.departments,
    search: result.filters.search,
    status: result.filters.status,
  });
}
