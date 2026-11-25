import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { departmentListDependencies } from '@/lib/department-list-server';
import { loadDepartmentList } from '@/lib/department-list';
import { ErpShell } from '../../erp-shell';
import { DepartmentStatusAction } from './department-status-action';

export const dynamic = 'force-dynamic';

type DepartmentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-cloud px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section role="alert" className="mx-auto max-w-3xl rounded-md border border-error/30 bg-surface p-5 shadow-soft">
        <h1 className="font-display text-xl font-bold text-navy">Human Resources is unavailable</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Link href="/" className="mt-4 inline-flex font-semibold text-teal underline">Return to sign in</Link>
      </section>
    </main>
  );
}

export default async function HumanResourcesPage({ searchParams }: DepartmentPageProps) {
  const params = await searchParams;
  const result = await loadDepartmentList({ search: params.q, status: params.status }, departmentListDependencies());
  if (result.kind === 'unauthenticated') redirect('/');
  if (result.kind === 'forbidden') notFound();
  if (!('access' in result) || !result.access) {
    return <ErrorPage message="Your Human Resources access could not be verified. Refresh or sign in again." />;
  }

  const { role, modules, rights } = result.access;
  const isManager = role === 'admin' || role === 'superadmin';
  const canAdd = rights.includes('add_department');
  const canEdit = rights.includes('edit_department');
  const canDelete = rights.includes('delete_department');
  const canRestore = isManager;
  const canChangeStatus = result.kind === 'ok' && result.departments.some((department) =>
    department.status === 'inactive' ? canRestore : canDelete);
  const notice = params.notice === 'created' ? 'Department added.'
    : params.notice === 'updated' ? 'Department updated.'
    : params.notice === 'deleted' ? 'Department moved to Inactive.'
    : params.notice === 'restored' ? 'Department restored.' : null;

  return (
    <ErpShell role={role} modules={modules} currentPath="/erp/modules/human-resources" moduleLinksUnavailable={result.kind === 'unavailable'}>
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · HUMAN RESOURCES</p>
      </header>

      <section className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Human Resources</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">Departments</h1>
            <p className="mt-2 text-sm text-muted">Search and manage department codes and names.</p>
          </div>
          {canAdd && <Link href="/erp/modules/human-resources/departments/new" className="button-primary">Add Department</Link>}
        </div>

        {notice && <p role="status" className="mt-4 rounded-md border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-ink">{notice}</p>}

        {result.kind === 'unavailable' ? (
          <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">
            Department records could not be loaded. Refresh the page or contact an administrator.
          </p>
        ) : result.kind === 'invalid' ? (
          <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">{result.message}</p>
        ) : (
          <>
            <form action="/erp/modules/human-resources" method="get"
              className="mt-5 grid gap-3 rounded-md border border-line bg-cloud p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
              <div>
                <label htmlFor="department-search" className="mb-1 block text-sm font-medium text-ink">Search departments</label>
                <input id="department-search" name="q" type="search" maxLength={100}
                  defaultValue={result.filters.search} placeholder="Department code or name" className="form-input" />
              </div>
              {isManager ? (
                <div>
                  <label htmlFor="department-status" className="mb-1 block text-sm font-medium text-ink">Status</label>
                  <select id="department-status" name="status" defaultValue={result.filters.status} className="form-input">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All</option>
                  </select>
                </div>
              ) : (
                <p className="pb-3 text-sm text-muted">Only active departments are shown.</p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" className="min-h-11 rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze">
                  Search
                </button>
                <Link href="/erp/modules/human-resources" className="text-sm font-medium text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                  Clear
                </Link>
              </div>
            </form>

            {result.departments.length === 0 ? (
              <p className="mt-5 rounded-md border border-line bg-surface px-4 py-5 text-sm text-muted">
                {result.filters.search ? 'No departments match this search.' : 'No departments to display.'}
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Department records</caption>
                  <thead className="bg-cloud text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">Department Code</th>
                      <th scope="col" className="px-4 py-3">Department Name</th>
                      {isManager && <th scope="col" className="px-4 py-3">Status</th>}
                      {isManager && <th scope="col" className="px-4 py-3">Stamp</th>}
                      {(canEdit || canChangeStatus) && <th scope="col" className="px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.departments.map((department) => (
                      <tr key={department.departmentCode}
                        className={`border-t border-line ${department.status === 'inactive' ? 'bg-cloud text-muted' : 'bg-surface text-ink'}`}>
                        <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold">{department.departmentCode}</th>
                        <td className="px-4 py-3">{department.name || '—'}</td>
                        {isManager && <td className="whitespace-nowrap px-4 py-3">{department.status === 'inactive' ? 'Inactive' : 'Active'}</td>}
                        {isManager && <td className="px-4 py-3">{department.stamp || '—'}</td>}
                        {(canEdit || canChangeStatus) && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              {canEdit && <Link href={`/erp/modules/human-resources/departments/${encodeURIComponent(department.departmentCode)}/edit`}
                                className="font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Edit</Link>}
                              {(department.status === 'inactive' ? canRestore : canDelete) && (
                                <DepartmentStatusAction departmentCode={department.departmentCode}
                                  isDeleted={department.status === 'inactive'} canDelete={canDelete} canRestore={canRestore} />
                              )}
                            </div>
                          </td>
                        )}
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
