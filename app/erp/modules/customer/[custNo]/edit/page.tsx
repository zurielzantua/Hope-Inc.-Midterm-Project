import { notFound, redirect } from 'next/navigation';
import type { CustomerMutationActor } from '@/lib/customer-mutations';
import { customerMutationDependencies } from '@/lib/customer-mutations-server';
import { ErpShell } from '../../../../erp-shell';
import { CustomerForm } from '../../customer-form';

export const dynamic = 'force-dynamic';

type EditCustomerPageProps = { params: Promise<{ custNo: string }> };

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Customer Management is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { custNo } = await params;
  if (!/^[A-Za-z0-9]{5}$/.test(custNo)) notFound();

  const deps = customerMutationDependencies();
  let access: CustomerMutationActor | null;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (!access.modules.some(({ code }) => code === 'customer') || !access.rights.includes('edit_customer')) notFound();

  let customer;
  try { customer = await deps.getCustomerForEdit(custNo.toUpperCase(), access.role); }
  catch { return <Unavailable />; }
  if (!customer) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/customer">
      <CustomerForm mode="edit" role={access.role} customer={customer} />
    </ErpShell>
  );
}
