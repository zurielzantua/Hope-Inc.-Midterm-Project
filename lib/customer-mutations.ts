import { checkRequestOrigin, isJsonRequest } from '@/lib/auth/request-origin';
import type { ErpModule } from '@/lib/auth/erp-modules';

export type CustomerInput = { customerNo: string; name: string; address: string; paymentTerms: 'COD' | '30D' | '45D' };
export type CustomerEditInput = Omit<CustomerInput, 'customerNo'>;
export type CustomerMutationActor = { userId: string; role: string; modules: ErpModule[]; rights: string[] };

type Dependencies = {
  appOrigin?: string;
  getActor: () => Promise<CustomerMutationActor | null>;
  createCustomer: (input: CustomerInput) => Promise<void>;
  updateCustomer: (customerNo: string, input: CustomerEditInput, role: string) => Promise<boolean>;
  updateCustomerStatus: (customerNo: string, isDeleted: boolean) => Promise<boolean>;
};

const PAYMENT_TERMS = new Set(['COD', '30D', '45D']);
const CUSTOMER_NO = /^[A-Z0-9]{5}$/;
const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    Array.from(value.trim()).length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function parseCustomer(value: unknown, includeCustomerNo: boolean): CustomerInput | CustomerEditInput | null {
  if (!isRecord(value)) return null;
  const expected = includeCustomerNo
    ? ['customerNo', 'name', 'address', 'paymentTerms']
    : ['name', 'address', 'paymentTerms'];
  if (Object.keys(value).length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) return null;
  if (!validText(value.name, 20) || !validText(value.address, 50) ||
      typeof value.paymentTerms !== 'string' || !PAYMENT_TERMS.has(value.paymentTerms)) return null;

  const details: CustomerEditInput = {
    name: value.name.trim(),
    address: value.address.trim(),
    paymentTerms: value.paymentTerms as CustomerEditInput['paymentTerms'],
  };
  if (!includeCustomerNo) return details;
  if (typeof value.customerNo !== 'string' || !CUSTOMER_NO.test(value.customerNo.trim().toUpperCase())) return null;
  return { customerNo: value.customerNo.trim().toUpperCase(), ...details };
}

function duplicateCustomer(error: unknown) {
  return isRecord(error) && error.code === '23505';
}

function blockedByActiveChildren(error: unknown) {
  return isRecord(error) && error.code === 'P0001' && typeof error.message === 'string' &&
    /^Cannot delete customer row: \d+ active related record\(s\) still exist\.$/.test(error.message);
}

async function authorizedActor(request: Request, requiredRight: 'add_customer' | 'edit_customer' | 'delete_customer' | null, deps: Dependencies) {
  if (!checkRequestOrigin(request, deps.appOrigin).ok || !isJsonRequest(request)) {
    return { response: json(403, { error: 'Request not allowed.' }) };
  }
  let actor: CustomerMutationActor | null;
  try { actor = await deps.getActor(); }
  catch { return { response: json(503, { error: 'Customer Management is temporarily unavailable.' }) }; }
  if (!actor) return { response: json(401, { error: 'Sign in to continue.' }) };
  if (!['user', 'admin', 'superadmin'].includes(actor.role) ||
      !actor.modules.some(({ code }) => code === 'customer') ||
      (requiredRight !== null && !actor.rights.includes(requiredRight))) {
    return { response: json(403, { error: 'You do not have permission to perform this Customer action.' }) };
  }
  return { actor };
}

async function readBody(request: Request) {
  try { return await request.json(); }
  catch { return null; }
}

export async function handleCreateCustomerRequest(request: Request, deps: Dependencies) {
  const access = await authorizedActor(request, 'add_customer', deps);
  if ('response' in access) return access.response;
  const input = parseCustomer(await readBody(request), true);
  if (!input) return json(400, { error: 'Enter a unique 5-character customer number, name, address, and valid pay terms.' });
  try {
    await deps.createCustomer(input as CustomerInput);
    return json(201, { saved: true });
  } catch (error) {
    if (duplicateCustomer(error)) return json(409, { error: 'That customer number is already in use.' });
    return json(503, { error: 'Customer could not be saved. Try again or contact an administrator.' });
  }
}

export async function handleUpdateCustomerRequest(request: Request, customerNo: string, deps: Dependencies) {
  const access = await authorizedActor(request, 'edit_customer', deps);
  if ('response' in access) return access.response;
  const normalizedNo = typeof customerNo === 'string' ? customerNo.trim().toUpperCase() : '';
  if (!CUSTOMER_NO.test(normalizedNo)) return json(404, { error: 'Customer not found.' });
  const input = parseCustomer(await readBody(request), false);
  if (!input) return json(400, { error: 'Enter a name, address, and valid pay terms.' });
  try {
    if (!await deps.updateCustomer(normalizedNo, input as CustomerEditInput, access.actor.role)) {
      return json(404, { error: 'Customer not found.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    if (duplicateCustomer(error)) return json(409, { error: 'The customer update conflicts with an existing record.' });
    return json(503, { error: 'Customer could not be saved. Try again or contact an administrator.' });
  }
}

export async function handleCustomerStatusRequest(request: Request, customerNo: string, deps: Dependencies) {
  // The Student Guide's 36-right catalog has Delete but no separate Restore right.
  const access = await authorizedActor(request, null, deps);
  if ('response' in access) return access.response;
  const normalizedNo = typeof customerNo === 'string' ? customerNo.trim().toUpperCase() : '';
  if (!CUSTOMER_NO.test(normalizedNo)) return json(404, { error: 'Customer not found.' });
  const body = await readBody(request);
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.isDeleted !== 'boolean') {
    return json(400, { error: 'Choose a valid Customer status action.' });
  }
  if (body.isDeleted && !access.actor.rights.includes('delete_customer')) {
    return json(403, { error: 'You do not have permission to perform this Customer action.' });
  }
  if (!body.isDeleted && access.actor.role === 'user') {
    return json(403, { error: 'Only Admins and Superadmins can restore customers.' });
  }

  try {
    if (!await deps.updateCustomerStatus(normalizedNo, body.isDeleted)) {
      return json(404, { error: 'Customer not found or its status has changed. Refresh the list.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    if (blockedByActiveChildren(error)) {
      return json(409, {
        code: 'ACTIVE_DEPENDENTS',
        message: 'This customer has active related records and cannot be deactivated.',
      });
    }
    return json(503, { error: 'Customer status could not be changed. Try again or contact an administrator.' });
  }
}
