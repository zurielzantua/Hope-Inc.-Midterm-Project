import Link from 'next/link';
import { canAccessSystemSettings, canAccessUserManagement, type ErpModule } from '@/lib/auth/erp-modules';
import { LogoutButton } from './logout-button';

type ErpShellProps = {
  role: string;
  modules: readonly ErpModule[];
  currentPath: string;
  moduleLinksUnavailable?: boolean;
  children: React.ReactNode;
};

function navigationLink(href: string, label: string, currentPath: string) {
  const current = href === currentPath;
  return (
    <Link
      key={href}
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${current ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
    >
      {label}
    </Link>
  );
}

export function ErpShell({ role, modules, currentPath, moduleLinksUnavailable = false, children }: ErpShellProps) {
  return (
    <main className="min-h-screen bg-cloud px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-md bg-navy p-4 text-white shadow-soft lg:sticky lg:top-5 lg:min-h-[calc(100vh-2.5rem)]">
          <Link href="/erp" className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze">
            <span className="block text-sm font-bold">HOPE, INC.</span>
            <span className="block text-xs text-white/65">ERP SYSTEM</span>
          </Link>
          <nav aria-label="ERP navigation" className="mt-5 flex flex-wrap items-center gap-1 lg:flex-col lg:items-stretch">
            {navigationLink('/erp', 'Dashboard', currentPath)}
            {canAccessUserManagement(role) && navigationLink('/erp/users', 'User Management', currentPath)}
            {canAccessSystemSettings(role) && navigationLink('/erp/settings', 'System Settings', currentPath)}
            <p className="w-full px-3 pb-1 pt-4 text-xs font-semibold text-white/55">Modules</p>
            {modules.map((module) => navigationLink(module.href, module.name, currentPath))}
            {moduleLinksUnavailable && <p role="alert" className="w-full px-3 py-2 text-xs text-white/70">Module access is temporarily unavailable.</p>}
            {!moduleLinksUnavailable && modules.length === 0 && <p className="w-full px-3 py-2 text-xs text-white/70">No modules assigned.</p>}
          </nav>
          <div className="mt-5 lg:absolute lg:bottom-4 lg:left-4 lg:right-4">
            <LogoutButton />
          </div>
        </aside>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </main>
  );
}
