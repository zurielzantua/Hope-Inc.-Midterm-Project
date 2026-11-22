import { checkRequestOrigin, isJsonRequest } from '@/lib/auth/request-origin';
import type { ErpModule } from '@/lib/auth/erp-modules';

export type ProductInput = { productCode: string; description: string; unit: 'pc' | 'ea' | 'mtr' | 'pkg' | 'ltr' };
export type ProductEditInput = Omit<ProductInput, 'productCode'>;
export type ProductMutationActor = { userId: string; role: string; modules: ErpModule[]; rights: string[] };

type Dependencies = {
  appOrigin?: string;
  getActor: () => Promise<ProductMutationActor | null>;
  createProduct: (input: ProductInput) => Promise<void>;
  updateProduct: (productCode: string, input: ProductEditInput, role: string) => Promise<boolean>;
};

const PRODUCT_CODE = /^[A-Z0-9]{6}$/;
const UNITS = new Set(['pc', 'ea', 'mtr', 'pkg', 'ltr']);
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

function parseProduct(value: unknown, includeProductCode: boolean): ProductInput | ProductEditInput | null {
  if (!isRecord(value)) return null;
  const expected = includeProductCode ? ['productCode', 'description', 'unit'] : ['description', 'unit'];
  if (Object.keys(value).length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) return null;
  if (!validText(value.description, 30) || typeof value.unit !== 'string' || !UNITS.has(value.unit)) return null;

  const details: ProductEditInput = { description: value.description.trim(), unit: value.unit as ProductEditInput['unit'] };
  if (!includeProductCode) return details;
  if (typeof value.productCode !== 'string' || !PRODUCT_CODE.test(value.productCode.trim().toUpperCase())) return null;
  return { productCode: value.productCode.trim().toUpperCase(), ...details };
}

function duplicateProduct(error: unknown) {
  return isRecord(error) && error.code === '23505';
}

async function authorizedActor(request: Request, requiredRight: 'add_product' | 'edit_product', deps: Dependencies) {
  if (!checkRequestOrigin(request, deps.appOrigin).ok || !isJsonRequest(request)) {
    return { response: json(403, { error: 'Request not allowed.' }) };
  }
  let actor: ProductMutationActor | null;
  try { actor = await deps.getActor(); }
  catch { return { response: json(503, { error: 'Product Management is temporarily unavailable.' }) }; }
  if (!actor) return { response: json(401, { error: 'Sign in to continue.' }) };
  if (!['user', 'admin', 'superadmin'].includes(actor.role) ||
      !actor.modules.some(({ code }) => code === 'product') || !actor.rights.includes(requiredRight)) {
    return { response: json(403, { error: 'You do not have permission to perform this Product action.' }) };
  }
  return { actor };
}

async function readBody(request: Request) {
  try { return await request.json(); }
  catch { return null; }
}

export async function handleCreateProductRequest(request: Request, deps: Dependencies) {
  const access = await authorizedActor(request, 'add_product', deps);
  if ('response' in access) return access.response;
  const input = parseProduct(await readBody(request), true);
  if (!input) return json(400, { error: 'Enter a 6-character product code, a description of up to 30 characters, and an allowed unit.' });
  try {
    await deps.createProduct(input as ProductInput);
    return json(201, { saved: true });
  } catch (error) {
    if (duplicateProduct(error)) return json(409, { error: 'That product code is already in use.' });
    return json(503, { error: 'Product could not be saved. Try again or contact an administrator.' });
  }
}

export async function handleUpdateProductRequest(request: Request, productCode: string, deps: Dependencies) {
  const access = await authorizedActor(request, 'edit_product', deps);
  if ('response' in access) return access.response;
  const normalizedCode = typeof productCode === 'string' ? productCode.trim().toUpperCase() : '';
  if (!PRODUCT_CODE.test(normalizedCode)) return json(404, { error: 'Product not found.' });
  const input = parseProduct(await readBody(request), false);
  if (!input) return json(400, { error: 'Enter a description of up to 30 characters and choose an allowed unit.' });
  try {
    if (!await deps.updateProduct(normalizedCode, input as ProductEditInput, access.actor.role)) {
      return json(404, { error: 'Product not found or unavailable for editing.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    if (duplicateProduct(error)) return json(409, { error: 'The product update conflicts with an existing record.' });
    return json(503, { error: 'Product could not be saved. Try again or contact an administrator.' });
  }
}
