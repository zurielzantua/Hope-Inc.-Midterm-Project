export type UserRight = {
  moduleId: number;
  moduleCode: string;
  moduleName: string;
  rightId: number;
  rightCode: string;
  rightName: string;
  isAssigned: boolean;
};

export type RightsModule = {
  moduleId: number;
  moduleCode: string;
  moduleName: string;
  rights: UserRight[];
};

type RightsActor = { userId: string; role: string };
type RightsDependencies = {
  getActor: () => Promise<RightsActor | null>;
  loadRights: (targetUserId: string) => Promise<unknown>;
  saveRights: (targetUserId: string, rightIds: number[]) => Promise<boolean>;
};

const MODULE_NAMES = new Map([
  ['customer', 'Customer'],
  ['product', 'Product'],
  ['human_resources', 'Human Resources'],
  ['sales', 'Sales'],
  ['reports', 'Reports'],
]);
const MODULE_ORDER = Array.from(MODULE_NAMES.keys());
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserRight(value: unknown): value is UserRight {
  if (!isRecord(value)) return false;
  return Number.isSafeInteger(value.moduleId) && Number(value.moduleId) > 0 &&
    typeof value.moduleCode === 'string' && MODULE_NAMES.get(value.moduleCode) === value.moduleName &&
    Number.isSafeInteger(value.rightId) && Number(value.rightId) > 0 &&
    typeof value.rightCode === 'string' && typeof value.rightName === 'string' &&
    typeof value.isAssigned === 'boolean';
}

function completeRightsCatalog(value: unknown): value is UserRight[] {
  if (!Array.isArray(value) || value.length !== 36 || !value.every(isUserRight)) return false;
  if (new Set(value.map((right) => right.rightId)).size !== 36) return false;
  return MODULE_ORDER.every((moduleCode) => value.some((right) => right.moduleCode === moduleCode));
}

function allowedWrite(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return false;
  return request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

function rpcError(error: unknown) {
  if (!isRecord(error)) return json(503, { error: 'Rights Management is temporarily unavailable.' });
  const message = typeof error.message === 'string' ? error.message : '';
  if (error.code === 'PGRST202' || error.code === '42883' ||
      (error.code === '42501' && /permission denied for function/i.test(message)) ||
      (error.status === 404 && /could not find the function|does not exist/i.test(message))) {
    return json(503, { error: 'Rights Management requires a database update that is not available yet.' });
  }
  if (error.code === '22023') return json(400, { error: 'Choose permissions from the available list.' });
  if (error.code === 'P0002') return json(404, { error: 'This account is not available for Rights Management.' });
  if (error.code === '42501') return json(403, { error: 'You cannot manage permissions for this account.' });
  return json(503, { error: 'Rights Management is temporarily unavailable.' });
}

export function groupRights(rights: readonly UserRight[]): RightsModule[] {
  const modules = new Map<string, RightsModule>();
  for (const right of rights) {
    let module = modules.get(right.moduleCode);
    if (!module) {
      module = { moduleId: right.moduleId, moduleCode: right.moduleCode, moduleName: right.moduleName, rights: [] };
      modules.set(right.moduleCode, module);
    }
    module.rights.push(right);
  }
  return Array.from(modules.values()).sort((a, b) => MODULE_ORDER.indexOf(a.moduleCode) - MODULE_ORDER.indexOf(b.moduleCode));
}

export function setRightsSelection(current: readonly number[], rightIds: readonly number[], selected: boolean): number[] {
  const next = new Set(current);
  for (const rightId of rightIds) {
    if (selected) next.add(rightId);
    else next.delete(rightId);
  }
  return Array.from(next).sort((a, b) => a - b);
}

export function getModuleSelection(rightIds: readonly number[], selectedIds: readonly number[]) {
  const selected = new Set(selectedIds);
  const selectedCount = rightIds.filter((rightId) => selected.has(rightId)).length;
  return {
    checked: rightIds.length > 0 && selectedCount === rightIds.length,
    indeterminate: selectedCount > 0 && selectedCount < rightIds.length,
  };
}

async function getManager(deps: RightsDependencies) {
  let actor: RightsActor | null;
  try { actor = await deps.getActor(); }
  catch { return { response: json(503, { error: 'Rights Management is temporarily unavailable.' }) }; }
  if (!actor) return { response: json(401, { error: 'Sign in to continue.' }) };
  if ((actor.role !== 'admin' && actor.role !== 'superadmin') || !UUID.test(actor.userId)) {
    return { response: json(403, { error: 'You cannot access Rights Management.' }) };
  }
  return { actor };
}

export async function handleReadUserRights(request: Request, deps: RightsDependencies) {
  let targetUserId: string | null;
  try { targetUserId = new URL(request.url).searchParams.get('userId'); }
  catch { return json(400, { error: 'Enter a valid user ID.' }); }
  if (!targetUserId || !UUID.test(targetUserId)) return json(400, { error: 'Enter a valid user ID.' });

  const manager = await getManager(deps);
  if ('response' in manager) return manager.response;
  try {
    const rights = await deps.loadRights(targetUserId.toLowerCase());
    if (!completeRightsCatalog(rights)) return json(503, { error: 'The permission catalogue is incomplete.' });
    return json(200, { rights });
  } catch (error) {
    return rpcError(error);
  }
}

export async function handleSaveUserRights(request: Request, deps: RightsDependencies) {
  try {
    if (!allowedWrite(request)) return json(403, { error: 'Request not allowed.' });
  } catch {
    return json(403, { error: 'Request not allowed.' });
  }

  const manager = await getManager(deps);
  if ('response' in manager) return manager.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return json(400, { error: 'Enter a valid permission update.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 2 ||
      typeof body.userId !== 'string' || !UUID.test(body.userId) ||
      !Array.isArray(body.rightIds) || body.rightIds.length > 36 ||
      body.rightIds.some((rightId) => !Number.isSafeInteger(rightId) || Number(rightId) <= 0) ||
      new Set(body.rightIds).size !== body.rightIds.length) {
    return json(400, { error: 'Enter a valid permission update.' });
  }

  try {
    const saved = await deps.saveRights(body.userId.toLowerCase(), body.rightIds as number[]);
    if (!saved) return json(503, { error: 'Rights Management did not save the requested changes.' });
    return json(200, { saved: true });
  } catch (error) {
    return rpcError(error);
  }
}
