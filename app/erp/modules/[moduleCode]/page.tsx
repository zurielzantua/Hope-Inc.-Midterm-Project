import { notFound, redirect } from 'next/navigation';
import { canAccessErpModule, getErpModuleBySlug } from '@/lib/auth/erp-modules';
import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { ErpShell } from '../../erp-shell';

export const dynamic = 'force-dynamic';

export default async function ErpModulePage({ params }: { params: Promise<{ moduleCode: string }> }) {
  const { moduleCode } = await params;
  const module = getErpModuleBySlug(moduleCode);
  if (!module) notFound();

  const moduleAccess = await loadCurrentErpModules().catch(() => null);
  if (!moduleAccess) redirect('/');
  if (moduleAccess.unavailable || !canAccessErpModule(module.code, moduleAccess.modules.map((item) => item.code))) notFound();

  return (
    <ErpShell role={moduleAccess.role} modules={moduleAccess.modules} currentPath={module.href}>
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · MODULE WORKSPACE</p>
      </header>
      <section className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
        <h1 className="font-display text-2xl font-bold text-navy">{module.name}</h1>
        <p className="mt-2 text-sm text-muted">This Sprint 1 workspace provides navigation and permission checks. Module operations are outside DEV-08.</p>
      </section>
    </ErpShell>
  );
}
