import { notFound, redirect } from 'next/navigation';
import { customerMutationDependencies } from '@/lib/customer-mutations-server';
import { ErpShell } from '../../../erp-shell';
import { CustomerForm } from '../customer-form';

export const dynamic = 'force-dynamic';

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Customer Management is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function AddCustomerPage() {
  const deps = customerMutationDependencies();
  let access;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (!access.modules.some(({ code }) => code === 'customer') || !access.rights.includes('add_customer')) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/customer">
      <CustomerForm mode="add" role={access.role} />
    </ErpShell>
  );
}
