import { notFound, redirect } from 'next/navigation';
import { canAccessSystemSettings } from '@/lib/auth/erp-modules';
import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { ErpShell } from '../erp-shell';

export const dynamic = 'force-dynamic';

export default async function SystemSettingsPage() {
  const moduleAccess = await loadCurrentErpModules().catch(() => null);
  if (!moduleAccess) redirect('/');
  if (!canAccessSystemSettings(moduleAccess.role)) notFound();

  return (
    <ErpShell role={moduleAccess.role} modules={moduleAccess.modules} currentPath="/erp/settings" moduleLinksUnavailable={moduleAccess.unavailable}>
      <header className="rounded-md bg-navy px-5 py-4 text-white">
        <p className="text-sm font-semibold">HOPE, INC. / ERP SYSTEM</p>
        <p className="text-xs text-white/70">ERP · SYSTEM SETTINGS</p>
      </header>
      <section className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
        <h1 className="font-display text-2xl font-bold text-navy">System Settings</h1>
        <p className="mt-2 text-sm text-muted">This page is restricted to Superadmins. Configuration controls are outside DEV-08.</p>
      </section>
    </ErpShell>
  );
}
