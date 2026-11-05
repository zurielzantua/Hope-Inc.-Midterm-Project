export type ManagerRole = 'admin' | 'superadmin';
export type ManagedRole = 'user' | 'admin' | 'superadmin';
export type UserManagementRow = {
  authUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleCode: ManagedRole;
  roleName: string;
  accountState: 'pending' | 'approved';
  isBlocked: boolean;
  isDeleted: boolean;
};
export type UserChange = { firstName: string; lastName: string } | { isBlocked: boolean };

type Dependencies = {
  getActorRole: () => Promise<string | null>;
  listUsers: (role: ManagerRole) => Promise<UserManagementRow[]>;
  createUser: (input: { firstName: string; lastName: string; email: string }) => Promise<Response>;
  updateUser: (role: ManagerRole, userId: string, change: UserChange) => Promise<UserManagementRow | null>;
};

const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function allowedPost(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  try { return request.headers.get('origin') === new URL(request.url).origin && contentType === 'application/json'; }
  catch { return false; }
}

async function managerRole(deps: Dependencies) {
  let role: string | null;
  try { role = await deps.getActorRole(); }
  catch { return { response: json(503, { error: 'User Management is temporarily unavailable.' }) }; }
  if (!role) return { response: json(401, { error: 'Sign in to continue.' }) };
  if (role !== 'admin' && role !== 'superadmin') return { response: json(403, { error: 'You cannot access User Management.' }) };
  return { role };
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value.trim()).length <= 100;
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value.trim()).length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function canManageUserRole(actorRole: string, targetRole: string) {
  if (targetRole === 'superadmin') return false;
  if (actorRole === 'superadmin') return targetRole === 'user' || targetRole === 'admin';
  return actorRole === 'admin' && targetRole === 'user';
}

export function visibleRoleCodes(actorRole: ManagerRole): ManagedRole[] {
  return actorRole === 'admin' ? ['user'] : ['user', 'admin', 'superadmin'];
}

export function accountStatusLabel(account: { is_deleted: boolean; is_blocked: boolean; account_state: string }) {
  if (account.is_deleted) return 'Deleted';
  if (account.is_blocked) return 'Blocked';
  return account.account_state === 'pending' ? 'Pending' : 'Approved';
}

export async function handleListManagedUsers(deps: Dependencies) {
  const access = await managerRole(deps);
  if ('response' in access) return access.response;
  try { return json(200, { users: await deps.listUsers(access.role as ManagerRole) }); }
  catch { return json(503, { error: 'User Management is temporarily unavailable.' }); }
}

export async function handleCreateManagedUser(request: Request, deps: Dependencies) {
  if (!allowedPost(request)) return json(403, { error: 'Request not allowed.' });
  const access = await managerRole(deps);
  if ('response' in access) return access.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return json(400, { error: 'Enter a first name, last name, and valid email.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 3 || !validName(body.firstName) || !validName(body.lastName) || !validEmail(body.email)) {
    return json(400, { error: 'Enter a first name, last name, and valid email.' });
  }

  try {
    const result = await deps.createUser({
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.trim().toLowerCase(),
    });
    if (result.status === 201) return json(201, { status: 'pending' });
    if (result.status === 400) return json(400, { error: 'Enter a first name, last name, and valid email.' });
    if (result.status === 409) return json(409, { error: 'This user could not be added with those details.' });
    if (result.status === 429) return json(429, { error: 'Too many user creation attempts. Try again later.' });
    return json(503, { error: 'User Management is temporarily unavailable.' });
  } catch {
    return json(503, { error: 'User Management is temporarily unavailable.' });
  }
}

export async function handleUpdateManagedUser(request: Request, deps: Dependencies) {
  if (!allowedPost(request)) return json(403, { error: 'Request not allowed.' });
  const access = await managerRole(deps);
  if ('response' in access) return access.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return json(400, { error: 'Enter a valid user update.' }); }
  if (!isRecord(body) || typeof body.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)) {
    return json(400, { error: 'Enter a valid user update.' });
  }

  let change: UserChange;
  const fields = Object.keys(body).filter((key) => key !== 'userId');
  if (fields.length === 2 && fields.includes('firstName') && fields.includes('lastName') && validName(body.firstName) && validName(body.lastName)) {
    change = { firstName: body.firstName.trim(), lastName: body.lastName.trim() };
  } else if (fields.length === 1 && fields[0] === 'isBlocked' && typeof body.isBlocked === 'boolean') {
    change = { isBlocked: body.isBlocked };
  } else {
    return json(400, { error: 'Only name or block status can be changed here.' });
  }

  try {
    const user = await deps.updateUser(access.role as ManagerRole, body.userId.toLowerCase(), change);
    if (!user) return json(404, { error: 'This user cannot be managed or was not found.' });
    return json(200, { user });
  } catch {
    return json(503, { error: 'User Management is temporarily unavailable.' });
  }
}
