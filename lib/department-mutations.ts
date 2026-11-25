import { checkRequestOrigin, isJsonRequest } from '@/lib/auth/request-origin';
import type { ErpModule } from '@/lib/auth/erp-modules';

export type DepartmentInput = { departmentCode: string; name: string };
export type DepartmentEditInput = Omit<DepartmentInput, 'departmentCode'>;
export type DepartmentMutationActor = { userId: string; role: string; modules: ErpModule[]; rights: string[] };

type Dependencies = {
  appOrigin?: string;
  getActor: () => Promise<DepartmentMutationActor | null>;
  createDepartment: (input: DepartmentInput) => Promise<void>;
  updateDepartment: (departmentCode: string, input: DepartmentEditInput, role: string) => Promise<boolean>;
  updateDepartmentStatus: (departmentCode: string, isDeleted: boolean) => Promise<boolean>;
};

const DEPARTMENT_CODE = /^[A-Z0-9]{1,3}$/;
const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    Array.from(value.trim()).length <= 20 && !/[\u0000-\u001f\u007f]/.test(value);
}

function parseDepartment(value: unknown, includeCode: boolean): DepartmentInput | DepartmentEditInput | null {
  if (!isRecord(value)) return null;
  const expected = includeCode ? ['departmentCode', 'name'] : ['name'];
  if (Object.keys(value).length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) return null;
  if (!validName(value.name)) return null;

  const details: DepartmentEditInput = { name: value.name.trim() };
  if (!includeCode) return details;
  if (typeof value.departmentCode !== 'string') return null;
  const departmentCode = value.departmentCode.trim().toUpperCase();
  if (!DEPARTMENT_CODE.test(departmentCode)) return null;
  return { departmentCode, ...details };
}

function duplicateDepartment(error: unknown) {
  return isRecord(error) && error.code === '23505';
}

function blockedByActiveHistory(error: unknown) {
  return isRecord(error) && error.code === 'P0001' && typeof error.message === 'string' &&
    /^Cannot delete department row: \d+ active related record\(s\) still exist\.$/.test(error.message);
}

async function authorizedActor(
  request: Request,
  requiredRight: 'add_department' | 'edit_department' | 'delete_department' | null,
  deps: Dependencies,
) {
  if (!checkRequestOrigin(request, deps.appOrigin).ok || !isJsonRequest(request)) {
    return { response: json(403, { error: 'Request not allowed.' }) };
  }
  let actor: DepartmentMutationActor | null;
  try { actor = await deps.getActor(); }
  catch { return { response: json(503, { error: 'Human Resources is temporarily unavailable.' }) }; }
  if (!actor) return { response: json(401, { error: 'Sign in to continue.' }) };
  if (!['user', 'admin', 'superadmin'].includes(actor.role) ||
      !actor.modules.some(({ code }) => code === 'human_resources') ||
      (requiredRight !== null && !actor.rights.includes(requiredRight))) {
    return { response: json(403, { error: 'You do not have permission to perform this Department action.' }) };
  }
  return { actor };
}

async function readBody(request: Request) {
  try { return await request.json(); }
  catch { return null; }
}

export async function handleCreateDepartmentRequest(request: Request, deps: Dependencies) {
  const access = await authorizedActor(request, 'add_department', deps);
  if ('response' in access) return access.response;
  const input = parseDepartment(await readBody(request), true);
  if (!input) return json(400, { error: 'Enter a unique department code (1–3 letters or numbers) and name.' });
  try {
    await deps.createDepartment(input as DepartmentInput);
    return json(201, { saved: true });
  } catch (error) {
    if (duplicateDepartment(error)) return json(409, { error: 'That department code is already in use.' });
    return json(503, { error: 'Department could not be saved. Try again or contact an administrator.' });
  }
}

export async function handleUpdateDepartmentRequest(request: Request, departmentCode: string, deps: Dependencies) {
  const access = await authorizedActor(request, 'edit_department', deps);
  if ('response' in access) return access.response;
  const normalizedCode = typeof departmentCode === 'string' ? departmentCode.trim().toUpperCase() : '';
  if (!DEPARTMENT_CODE.test(normalizedCode)) return json(404, { error: 'Department not found.' });
  const input = parseDepartment(await readBody(request), false);
  if (!input) return json(400, { error: 'Enter a valid department name.' });
  try {
    if (!await deps.updateDepartment(normalizedCode, input as DepartmentEditInput, access.actor.role)) {
      return json(404, { error: 'Department not found.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    if (duplicateDepartment(error)) return json(409, { error: 'The department update conflicts with an existing record.' });
    return json(503, { error: 'Department could not be saved. Try again or contact an administrator.' });
  }
}

export async function handleDepartmentStatusRequest(request: Request, departmentCode: string, deps: Dependencies) {
  // The HR rights catalogue has Delete Department but no separate Restore right.
  const access = await authorizedActor(request, null, deps);
  if ('response' in access) return access.response;
  const normalizedCode = typeof departmentCode === 'string' ? departmentCode.trim().toUpperCase() : '';
  if (!DEPARTMENT_CODE.test(normalizedCode)) return json(404, { error: 'Department not found.' });
  const body = await readBody(request);
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.isDeleted !== 'boolean') {
    return json(400, { error: 'Choose a valid Department status action.' });
  }
  if (body.isDeleted && !access.actor.rights.includes('delete_department')) {
    return json(403, { error: 'You do not have permission to perform this Department action.' });
  }
  if (!body.isDeleted && access.actor.role === 'user') {
    return json(403, { error: 'Only Admins and Superadmins can restore departments.' });
  }

  try {
    if (!await deps.updateDepartmentStatus(normalizedCode, body.isDeleted)) {
      return json(404, { error: 'Department not found or its status has changed. Refresh the list.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    if (blockedByActiveHistory(error)) {
      return json(409, {
        code: 'ACTIVE_DEPENDENTS',
        message: 'This department has active Job History records and cannot be deactivated.',
      });
    }
    return json(503, { error: 'Department status could not be changed. Try again or contact an administrator.' });
  }
}
