import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { customerListDependencies } from '@/lib/customer-list-server';
import { loadCustomerList } from '@/lib/customer-list';
import { ErpShell } from '../../erp-shell';

export const dynamic = 'force-dynamic';

type CustomerPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-cloud px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section role="alert" className="mx-auto max-w-3xl rounded-md border border-error/30 bg-surface p-5 shadow-soft">
        <h1 className="font-display text-xl font-bold text-navy">Customer Management is unavailable</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Link href="/" className="mt-4 inline-flex font-semibold text-teal underline">Return to sign in</Link>
      </section>
    </main>
  );
}

export default async function CustomerPage({ searchParams }: CustomerPageProps) {
  const params = await searchParams;
  const result = await loadCustomerList({ search: params.q, status: params.status }, customerListDependencies());
  if (result.kind === 'unauthenticated') redirect('/');
  if (result.kind === 'forbidden') notFound();
  if (!('access' in result) || !result.access) return <ErrorPage message="Your Customer access could not be verified. Refresh or sign in again." />;

  const { role, modules } = result.access;
  const isManager = role === 'admin' || role === 'superadmin';

  return (
    <ErpShell role={role} modules={modules} currentPath="/erp/modules/customer" moduleLinksUnavailable={result.kind === 'unavailable'}>
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · CUSTOMER MANAGEMENT</p>
      </header>

      <section className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Customer module</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">Customer Management</h1>
        <p className="mt-2 text-sm text-muted">Search by customer number, name, address, or payment terms.</p>

        {result.kind === 'unavailable' ? (
          <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">
            Customer records could not be loaded. Refresh the page or contact an administrator.
          </p>
        ) : result.kind === 'invalid' ? (
          <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">
            {result.message}
          </p>
        ) : (
          <>
            <form action="/erp/modules/customer" method="get" className="mt-5 grid gap-3 rounded-md border border-line bg-cloud p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
              <div>
                <label htmlFor="customer-search" className="mb-1 block text-sm font-medium text-ink">Search customers</label>
                <input
                  id="customer-search"
                  name="q"
                  type="search"
                  maxLength={100}
                  defaultValue={result.filters.search}
                  placeholder="Customer no., name, address or pay terms"
                  className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                />
              </div>
              {isManager ? (
                <div>
                  <label htmlFor="customer-status" className="mb-1 block text-sm font-medium text-ink">Status</label>
                  <select
                    id="customer-status"
                    name="status"
                    defaultValue={result.filters.status}
                    className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All</option>
                  </select>
                </div>
              ) : (
                <p className="pb-3 text-sm text-muted">Only active customers are shown.</p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" className="min-h-11 rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze">
                  Search
                </button>
                <Link href="/erp/modules/customer" className="text-sm font-medium text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                  Clear
                </Link>
              </div>
            </form>

            {result.customers.length === 0 ? (
              <p className="mt-5 rounded-md border border-line bg-surface px-4 py-5 text-sm text-muted">
                {result.filters.search ? 'No customers match this search.' : 'No customers to display.'}
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Customer records</caption>
                  <thead className="bg-cloud text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">Customer No.</th>
                      <th scope="col" className="px-4 py-3">Customer Name</th>
                      <th scope="col" className="px-4 py-3">Address</th>
                      <th scope="col" className="px-4 py-3">Pay Terms</th>
                      {isManager && <th scope="col" className="px-4 py-3">Status</th>}
                      {isManager && <th scope="col" className="px-4 py-3">Stamp</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.customers.map((customer) => (
                      <tr key={customer.customerNo} className={`border-t border-line ${customer.status === 'inactive' ? 'bg-cloud text-muted' : 'bg-surface text-ink'}`}>
                        <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold">{customer.customerNo}</th>
                        <td className="px-4 py-3">{customer.name || '—'}</td>
                        <td className="px-4 py-3">{customer.address || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3">{customer.paymentTerms || '—'}</td>
                        {isManager && <td className="whitespace-nowrap px-4 py-3">{customer.status === 'inactive' ? 'Inactive' : 'Active'}</td>}
                        {isManager && <td className="px-4 py-3">{customer.stamp || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </ErpShell>
  );
}
