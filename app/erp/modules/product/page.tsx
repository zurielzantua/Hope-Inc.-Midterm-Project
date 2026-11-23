import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { loadProductList } from '@/lib/product-list';
import { productListDependencies } from '@/lib/product-list-server';
import { ErpShell } from '../../erp-shell';
import { ProductStatusAction } from './product-status-action';

export const dynamic = 'force-dynamic';

type ProductPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-cloud px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section role="alert" className="mx-auto max-w-3xl rounded-md border border-error/30 bg-surface p-5 shadow-soft">
        <h1 className="font-display text-xl font-bold text-navy">Product Management is unavailable</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Link href="/" className="mt-4 inline-flex font-semibold text-teal underline">Return to sign in</Link>
      </section>
    </main>
  );
}

export default async function ProductPage({ searchParams }: ProductPageProps) {
  const params = await searchParams;
  const result = await loadProductList({ search: params.q, status: params.status }, productListDependencies());
  if (result.kind === 'unauthenticated') redirect('/');
  if (result.kind === 'forbidden') notFound();
  if (!('access' in result) || !result.access) return <ErrorPage message="Your Product access could not be verified. Refresh or sign in again." />;

  const { role, modules, rights } = result.access;
  const isManager = role === 'admin' || role === 'superadmin';
  const canAdd = rights.includes('add_product');
  const canEdit = rights.includes('edit_product');
  const canDelete = rights.includes('delete_product');
  const canRestore = isManager;
  const canChangeStatus = result.kind === 'ok' && result.products.some((product) =>
    product.status === 'inactive' ? canRestore : canDelete);
  const search = result.kind === 'ok' ? result.filters.search : typeof params.q === 'string' ? params.q : '';
  const status = result.kind === 'ok' ? result.filters.status : typeof params.status === 'string' && ['active', 'inactive', 'all'].includes(params.status) ? params.status : 'all';
  const notice = params.notice === 'created' ? 'Product added.' : params.notice === 'updated' ? 'Product updated.'
    : params.notice === 'deleted' ? 'Product moved to Inactive.' : params.notice === 'restored' ? 'Product restored.' : null;

  return (
    <ErpShell role={role} modules={modules} currentPath="/erp/modules/product" moduleLinksUnavailable={result.kind === 'unavailable'}>
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · PRODUCT MANAGEMENT</p>
      </header>

      <section className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Product module</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">Product Management</h1>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="mt-2 text-sm text-muted">Search by product code, description, or unit.</p>
          {canAdd && <Link href="/erp/modules/product/new" className="button-primary">Add Product</Link>}
        </div>

        {notice && <p role="status" className="mt-4 rounded-md border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-ink">{notice}</p>}

        <form action="/erp/modules/product" method="get" className="mt-5 grid gap-3 rounded-md border border-line bg-cloud p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <div>
            <label htmlFor="product-search" className="mb-1 block text-sm font-medium text-ink">Search products</label>
            <input id="product-search" name="q" type="search" maxLength={100} defaultValue={search} placeholder="Product code, description or unit" className="form-input" />
          </div>
          {isManager ? (
            <div>
              <label htmlFor="product-status" className="mb-1 block text-sm font-medium text-ink">Status</label>
              <select id="product-status" name="status" defaultValue={status} className="form-input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>
          ) : <p className="pb-3 text-sm text-muted">Only active products are shown.</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="button-primary">Search</button>
            <Link href="/erp/modules/product" className="text-sm font-medium text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Clear</Link>
          </div>
        </form>

        {result.kind === 'unavailable' ? (
          <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">Product records could not be loaded. Refresh the page or contact an administrator.</p>
        ) : result.kind === 'invalid' ? (
          <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">{result.message}</p>
        ) : result.products.length === 0 ? (
          <p className="mt-5 rounded-md border border-line bg-surface px-4 py-5 text-sm text-muted">{result.filters.search ? 'No products match this search.' : 'No products to display.'}</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <caption className="sr-only">Product records</caption>
              <thead className="bg-cloud text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Product code</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                  <th scope="col" className="px-4 py-3">Unit</th>
                  <th scope="col" className="px-4 py-3">Current price</th>
                  <th scope="col" className="px-4 py-3">Price History</th>
                  {isManager && <th scope="col" className="px-4 py-3">Status</th>}
                  {isManager && <th scope="col" className="px-4 py-3">Stamp</th>}
                  {(canEdit || canChangeStatus) && <th scope="col" className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {result.products.map((product) => (
                  <tr key={product.productCode} className={`border-t border-line ${product.status === 'inactive' ? 'bg-cloud text-muted' : 'bg-surface text-ink'}`}>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold">{product.productCode}</th>
                    <td className="px-4 py-3">{product.description || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{product.unit || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">—</td>
                    <td className="px-4 py-3"><Link href={`/erp/modules/product/${encodeURIComponent(product.productCode)}/price-history`} className="font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Prices</Link></td>
                    {isManager && <td className="whitespace-nowrap px-4 py-3">{product.status === 'inactive' ? 'Inactive' : 'Active'}</td>}
                    {isManager && <td className="px-4 py-3">{product.stamp || '—'}</td>}
                    {(canEdit || canChangeStatus) && <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-3">
                      {canEdit && <Link href={`/erp/modules/product/${encodeURIComponent(product.productCode)}/edit`} className="font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Edit</Link>}
                      {(product.status === 'inactive' ? canRestore : canDelete) && (
                        <ProductStatusAction
                          productCode={product.productCode}
                          isDeleted={product.status === 'inactive'}
                          canDelete={canDelete}
                          canRestore={canRestore}
                        />
                      )}
                    </div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ErpShell>
  );
}
