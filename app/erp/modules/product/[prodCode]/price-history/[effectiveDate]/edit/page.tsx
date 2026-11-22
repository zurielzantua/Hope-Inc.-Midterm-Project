import { notFound, redirect } from 'next/navigation';
import { isPriceHistoryRole, isValidPriceDate, type PriceHistoryActor } from '@/lib/price-history';
import { priceHistoryDependencies } from '@/lib/price-history-server';
import { ErpShell } from '../../../../../../erp-shell';
import { PriceHistoryForm } from '../../../../price-history/price-history-form';

export const dynamic = 'force-dynamic';

type EditPricePageProps = { params: Promise<{ prodCode: string; effectiveDate: string }> };

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Price History is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function EditPricePage({ params }: EditPricePageProps) {
  const { prodCode, effectiveDate } = await params;
  if (!/^[A-Za-z0-9]{6}$/.test(prodCode) || !isValidPriceDate(effectiveDate)) notFound();

  const deps = priceHistoryDependencies();
  let access: PriceHistoryActor | null;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (access.unavailable) return <Unavailable />;
  if (!isPriceHistoryRole(access.role) || !access.modules.some(({ code }) => code === 'product') || !access.rights.includes('edit_price')) notFound();

  let product;
  let price;
  try { product = await deps.getProduct(prodCode.toUpperCase(), access.role); }
  catch { return <Unavailable />; }
  if (!product || product.status === 'inactive') notFound();
  try { price = await deps.getPriceForEdit(prodCode.toUpperCase(), effectiveDate, access.role); }
  catch { return <Unavailable />; }
  if (!price) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/product">
      <PriceHistoryForm mode="edit" product={product} price={price} />
    </ErpShell>
  );
}
