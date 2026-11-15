import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { ErpShell } from './erp-shell';

export const dynamic = 'force-dynamic';

export default async function ErpPage() {
  const moduleAccess = await loadCurrentErpModules().catch(() => null);
  if (!moduleAccess) redirect('/');

  return (
    <ErpShell
      role={moduleAccess.role}
      modules={moduleAccess.modules}
      currentPath="/erp"
      moduleLinksUnavailable={moduleAccess.unavailable}
    >
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · DASHBOARD</p>
      </header>
      <section>
        <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">Welcome to your workspace</h1>
        <p className="mt-2 text-sm text-muted">Protected · Only modules assigned to your account are shown.</p>
      </section>

      {moduleAccess.unavailable ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">
          Module access could not be loaded. Refresh the page or contact an administrator.
        </p>
      ) : moduleAccess.modules.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-5 text-sm text-muted">
          No modules are assigned to your account yet. Contact an administrator.
        </p>
      ) : (
        <section id="modules" aria-label="Available ERP modules" className="grid gap-3 sm:grid-cols-2">
          {moduleAccess.modules.map((module) => (
            <Link
              key={module.code}
              href={module.href}
              className="group rounded-md border border-line bg-surface p-4 shadow-soft transition-colors hover:border-teal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <h2 className="font-semibold text-navy">{module.name}</h2>
              <p className="mt-1 text-sm text-muted">{module.description}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal">
                Open module <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </section>
      )}
    </ErpShell>
  );
}
