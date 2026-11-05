import { redirect } from 'next/navigation';
import { authorizeRequest } from '@/lib/auth/server';
import { LogoutButton } from '../logout-button';
import { UserManagementClient } from './user-management-client';

export const dynamic = 'force-dynamic';

export default async function UserManagementPage() {
  const access = await authorizeRequest();
  if (!access.allowed) redirect('/');
  if (access.role !== 'admin' && access.role !== 'superadmin') redirect('/erp');

  return (
    <main className="min-h-screen bg-cloud px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-md bg-navy px-5 py-4 text-white">
          <p className="text-base font-bold">HOPE, INC. / ERP SYSTEM</p>
          <p className="text-sm text-white/75">ERP · USER MANAGEMENT</p>
        </header>
        <nav aria-label="ERP navigation" className="flex flex-wrap items-center gap-3 rounded-md bg-navy px-5 py-3 text-sm text-white">
          <a className="font-semibold" href="/erp">HOPE ERP</a><span aria-hidden="true">|</span>
          <a href="/erp">Dashboard</a><span aria-hidden="true">|</span>
          <span aria-current="page">Users</span><span className="ml-auto"><LogoutButton /></span>
        </nav>
        <UserManagementClient actorRole={access.role} />
      </div>
    </main>
  );
}
