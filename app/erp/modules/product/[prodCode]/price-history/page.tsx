import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { loadPriceHistoryPage } from '@/lib/price-history';
import { priceHistoryDependencies, todayInManila } from '@/lib/price-history-server';
import { ErpShell } from '../../../../erp-shell';
import { PriceStatusAction } from '../../price-history/price-status-action';

export const dynamic = 'force-dynamic';

type PriceHistoryPageProps = {
  params: Promise<{ prodCode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ErrorPage() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Price History is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

function formatPrice(value: string | null) {
  return value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

export default async function PriceHistoryPage({ params, searchParams }: PriceHistoryPageProps) {
  const [{ prodCode }, query] = await Promise.all([params, searchParams]);
  const result = await loadPriceHistoryPage(prodCode, todayInManila(), priceHistoryDependencies());
  if (result.kind === 'unauthenticated') redirect('/');
  if (result.kind === 'forbidden' || result.kind === 'not_found') notFound();
  if (result.kind === 'unavailable') return <ErrorPage />;

  const { access, product, records, asOfDate, currentPrice, currentPriceEffectiveDate } = result.data;
  const isManager = access.role === 'admin' || access.role === 'superadmin';
  const productActive = product.status !== 'inactive';
  const canAdd = productActive && access.rights.includes('add_price');
  const canEdit = productActive && access.rights.includes('edit_price');
  const canDelete = access.rights.includes('delete_price');
  const notice = query.notice === 'created' ? 'Price added.'
    : query.notice === 'updated' ? 'Price updated.'
    : query.notice === 'deleted' ? 'Price moved to Inactive.' : null;

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/product">
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · PRODUCT MANAGEMENT</p>
      </header>

      <section className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Product module</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">Price History</h1>
        <p className="mt-2 text-sm text-muted">{product.productCode} · {product.description || '—'} · {product.unit || '—'}</p>

        {notice && <p role="status" className="mt-4 rounded-md border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-ink">{notice}</p>}

        <section aria-label="Current price" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-surface px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current price as of {asOfDate}</p>
            <p className="mt-1 text-2xl font-bold text-navy">{formatPrice(currentPrice)}</p>
            <p className="mt-1 text-sm text-muted">Latest active effective date: {currentPriceEffectiveDate ?? '—'}</p>
          </div>
          {canAdd && <Link href={`/erp/modules/product/${encodeURIComponent(product.productCode)}/price-history/new`} className="button-primary">+ Add Price</Link>}
        </section>

        {records.length === 0 ? (
          <p className="mt-5 rounded-md border border-line bg-surface px-4 py-5 text-sm text-muted">No price history records to display.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
              <caption className="sr-only">Price history for {product.productCode}</caption>
              <thead className="bg-cloud text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Effective Date</th>
                  <th scope="col" className="px-4 py-3">Unit Price</th>
                  {isManager && <th scope="col" className="px-4 py-3">Status</th>}
                  {isManager && <th scope="col" className="px-4 py-3">Stamp</th>}
                  {(canEdit || canDelete) && <th scope="col" className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const inactive = record.status === 'inactive';
                  return (
                    <tr key={record.effectiveDate} className={`border-t border-line ${inactive ? 'bg-cloud text-muted' : 'bg-surface text-ink'}`}>
                      <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold">{record.effectiveDate}</th>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatPrice(record.unitPrice)}</td>
                      {isManager && <td className="whitespace-nowrap px-4 py-3">{inactive ? 'Inactive' : 'Active'}</td>}
                      {isManager && <td className="px-4 py-3">{record.stamp || '—'}</td>}
                      {(canEdit || (canDelete && !inactive)) && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            {canEdit && <Link href={`/erp/modules/product/${encodeURIComponent(product.productCode)}/price-history/${encodeURIComponent(record.effectiveDate)}/edit`} className="font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Edit</Link>}
                            {canDelete && !inactive && <PriceStatusAction productCode={product.productCode} effectiveDate={record.effectiveDate} />}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Link href="/erp/modules/product" className="inline-flex text-sm font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Back to Product Management</Link>
    </ErpShell>
  );
}
