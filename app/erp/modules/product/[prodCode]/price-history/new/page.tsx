import { notFound, redirect } from 'next/navigation';
import { isPriceHistoryRole, type PriceHistoryActor } from '@/lib/price-history';
import { priceHistoryDependencies } from '@/lib/price-history-server';
import { ErpShell } from '../../../../../erp-shell';
import { PriceHistoryForm } from '../../../price-history/price-history-form';

export const dynamic = 'force-dynamic';

type AddPricePageProps = { params: Promise<{ prodCode: string }> };

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Price History is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function AddPricePage({ params }: AddPricePageProps) {
  const { prodCode } = await params;
  if (!/^[A-Za-z0-9]{6}$/.test(prodCode)) notFound();

  const deps = priceHistoryDependencies();
  let access: PriceHistoryActor | null;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (access.unavailable) return <Unavailable />;
  if (!isPriceHistoryRole(access.role) || !access.modules.some(({ code }) => code === 'product') || !access.rights.includes('add_price')) notFound();

  let product;
  try { product = await deps.getProduct(prodCode.toUpperCase(), access.role); }
  catch { return <Unavailable />; }
  if (!product || product.status === 'inactive') notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/product">
      <PriceHistoryForm mode="add" product={product} />
    </ErpShell>
  );
}
