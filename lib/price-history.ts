import { checkRequestOrigin, isJsonRequest } from '@/lib/auth/request-origin';
import type { ErpModule } from '@/lib/auth/erp-modules';

export type PriceHistoryRole = 'user' | 'admin' | 'superadmin';
export type PriceHistoryActor = {
  userId: string;
  role: string;
  modules: ErpModule[];
  rights: string[];
  unavailable: boolean;
};
export type PriceProduct = {
  productCode: string;
  description: string | null;
  unit: string | null;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};
export type PriceHistoryRow = {
  effectiveDate: string;
  unitPrice: string;
  status?: 'active' | 'inactive';
  stamp?: string | null;
};
export type PriceHistoryData = {
  access: { role: PriceHistoryRole; modules: ErpModule[]; rights: string[] };
  product: PriceProduct;
  records: PriceHistoryRow[];
  asOfDate: string;
  currentPrice: string | null;
  currentPriceEffectiveDate: string | null;
};

type ViewDependencies = {
  getActor: () => Promise<PriceHistoryActor | null>;
  getProduct: (productCode: string, role: PriceHistoryRole) => Promise<PriceProduct | null>;
  listPriceHistory: (productCode: string, role: PriceHistoryRole) => Promise<PriceHistoryRow[]>;
  getCurrentPrice: (productCode: string, asOfDate: string) => Promise<string | null>;
};
type MutationDependencies = ViewDependencies & {
  appOrigin?: string;
  isProductActive: (productCode: string) => Promise<boolean>;
  createPrice: (productCode: string, input: { effectiveDate: string; unitPrice: string }) => Promise<void>;
  updatePrice: (productCode: string, effectiveDate: string, unitPrice: string, role: PriceHistoryRole) => Promise<boolean>;
  softDeletePrice: (productCode: string, effectiveDate: string) => Promise<boolean>;
};

const PRODUCT_CODE = /^[A-Z0-9]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidPriceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export function normalizeUnitPrice(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length > 11 || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [rawWhole, fraction = ''] = value.trim().split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '');
  if (whole.length > 8 || (whole.length === 8 && whole > '99999999')) return null;
  if (Number(whole) === 0 && Number(fraction) === 0) return null;
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

function normalizedProductCode(value: unknown) {
  return typeof value === 'string' && PRODUCT_CODE.test(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : null;
}

function validRole(role: string): role is PriceHistoryRole {
  return role === 'user' || role === 'admin' || role === 'superadmin';
}

export function isPriceHistoryRole(role: string): role is PriceHistoryRole {
  return validRole(role);
}

function priceDateFromRecords(records: readonly PriceHistoryRow[], asOfDate: string) {
  return records.filter((row) => row.effectiveDate <= asOfDate && row.status !== 'inactive')
    .at(-1)?.effectiveDate ?? null;
}

export type PriceHistoryPageResult =
  | { kind: 'ok'; data: PriceHistoryData }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

export async function loadPriceHistoryPage(productCodeValue: unknown, asOfDate: string, deps: ViewDependencies): Promise<PriceHistoryPageResult> {
  let actor: PriceHistoryActor | null;
  try { actor = await deps.getActor(); }
  catch { return { kind: 'unavailable' }; }
  if (!actor) return { kind: 'unauthenticated' };
  if (actor.unavailable) return { kind: 'unavailable' };
  if (!validRole(actor.role) || !actor.modules.some(({ code }) => code === 'product')) return { kind: 'forbidden' };
  const productCode = normalizedProductCode(productCodeValue);
  if (!productCode || !isValidPriceDate(asOfDate)) return { kind: 'not_found' };

  try {
    const product = await deps.getProduct(productCode, actor.role);
    if (!product) return { kind: 'not_found' };
    const [records, currentPrice] = await Promise.all([
      deps.listPriceHistory(productCode, actor.role),
      deps.getCurrentPrice(productCode, asOfDate),
    ]);
    return {
      kind: 'ok',
      data: {
        access: { role: actor.role, modules: actor.modules, rights: actor.rights },
        product,
        records,
        asOfDate,
        currentPrice,
        currentPriceEffectiveDate: priceDateFromRecords(records, asOfDate),
      },
    };
  } catch {
    return { kind: 'unavailable' };
  }
}

function allowedWrite(request: Request, appOrigin?: string) {
  return checkRequestOrigin(request, appOrigin).ok && isJsonRequest(request);
}

async function priceActor(request: Request, requiredRight: 'add_price' | 'edit_price' | 'delete_price', deps: MutationDependencies) {
  if (!allowedWrite(request, deps.appOrigin)) return { response: json(403, { error: 'Request not allowed.' }) };
  let actor: PriceHistoryActor | null;
  try { actor = await deps.getActor(); }
  catch { return { response: json(503, { error: 'Price History is temporarily unavailable.' }) }; }
  if (!actor) return { response: json(401, { error: 'Sign in to continue.' }) };
  if (actor.unavailable) return { response: json(503, { error: 'Price History is temporarily unavailable.' }) };
  if (!validRole(actor.role) || !actor.modules.some(({ code }) => code === 'product') || !actor.rights.includes(requiredRight)) {
    return { response: json(403, { error: 'You do not have permission to perform this Price History action.' }) };
  }
  return { actor: { ...actor, role: actor.role } };
}

async function readBody(request: Request) {
  try { return await request.json(); }
  catch { return null; }
}

function priceInput(body: unknown, includeDate: boolean) {
  if (!isRecord(body)) return null;
  const expected = includeDate ? ['effectiveDate', 'unitPrice'] : ['unitPrice'];
  if (Object.keys(body).length !== expected.length || expected.some((key) => !Object.hasOwn(body, key))) return null;
  const unitPrice = normalizeUnitPrice(body.unitPrice);
  if (!unitPrice) return null;
  if (!includeDate) return { unitPrice };
  if (!isValidPriceDate(body.effectiveDate)) return null;
  return { effectiveDate: body.effectiveDate, unitPrice };
}

function inactiveParentError(error: unknown) {
  return isRecord(error) && error.code === '23514' && error.message === 'active_parent_required';
}

function writeFailure(error: unknown, conflict: string) {
  if (isRecord(error) && error.code === '23505') return json(409, { error: conflict });
  if (inactiveParentError(error)) {
    return json(409, { code: 'INACTIVE_PARENT', message: 'Price history requires an active Product.' });
  }
  if (isRecord(error) && error.code === '23514') return json(400, { error: 'Enter a positive price with no more than two decimal places.' });
  return json(503, { error: 'Price History could not be saved. Try again or contact an administrator.' });
}

export async function handleCreatePriceRequest(request: Request, productCodeValue: string, deps: MutationDependencies) {
  const access = await priceActor(request, 'add_price', deps);
  if ('response' in access) return access.response;
  const productCode = normalizedProductCode(productCodeValue);
  if (!productCode) return json(404, { error: 'Product not found.' });
  const input = priceInput(await readBody(request), true);
  if (!input || typeof input.effectiveDate !== 'string') return json(400, { error: 'Enter a valid effective date and positive Unit Price.' });
  try {
    if (!await deps.isProductActive(productCode)) return json(404, { error: 'Product not found or inactive.' });
    await deps.createPrice(productCode, input);
    return json(201, { saved: true });
  } catch (error) {
    return writeFailure(error, 'A price record already exists for that Product and Effective Date.');
  }
}

export async function handleUpdatePriceRequest(request: Request, productCodeValue: string, effectiveDate: string, deps: MutationDependencies) {
  const access = await priceActor(request, 'edit_price', deps);
  if ('response' in access) return access.response;
  const productCode = normalizedProductCode(productCodeValue);
  if (!productCode || !isValidPriceDate(effectiveDate)) return json(404, { error: 'Price record not found.' });
  const input = priceInput(await readBody(request), false);
  if (!input) return json(400, { error: 'Enter a positive Unit Price with no more than two decimal places.' });
  try {
    if (!await deps.isProductActive(productCode)) return json(404, { error: 'Product not found or inactive.' });
    if (!await deps.updatePrice(productCode, effectiveDate, input.unitPrice, access.actor.role)) {
      return json(404, { error: 'Price record not found or unavailable for editing.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    return writeFailure(error, 'This price record conflicts with an existing Product and Effective Date.');
  }
}

export async function handleDeletePriceRequest(request: Request, productCodeValue: string, effectiveDate: string, deps: MutationDependencies) {
  const access = await priceActor(request, 'delete_price', deps);
  if ('response' in access) return access.response;
  const productCode = normalizedProductCode(productCodeValue);
  if (!productCode || !isValidPriceDate(effectiveDate)) return json(404, { error: 'Price record not found.' });
  const body = await readBody(request);
  if (!isRecord(body) || Object.keys(body).length !== 1 || body.isDeleted !== true) {
    return json(400, { error: 'Choose a valid Price History delete action.' });
  }
  try {
    if (access.actor.role === 'user' && !await deps.isProductActive(productCode)) return json(404, { error: 'Price record not found.' });
    if (!await deps.softDeletePrice(productCode, effectiveDate)) {
      return json(404, { error: 'Price record not found or already inactive.' });
    }
    return json(200, { saved: true });
  } catch (error) {
    return writeFailure(error, 'This price record could not be deactivated.');
  }
}
