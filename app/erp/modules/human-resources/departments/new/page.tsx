import { notFound, redirect } from 'next/navigation';
import { departmentMutationDependencies } from '@/lib/department-mutations-server';
import { ErpShell } from '../../../../erp-shell';
import { DepartmentForm } from '../../department-form';

export const dynamic = 'force-dynamic';

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Human Resources is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function AddDepartmentPage() {
  const deps = departmentMutationDependencies();
  let access;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (!access.modules.some(({ code }) => code === 'human_resources') || !access.rights.includes('add_department')) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/human-resources">
      <DepartmentForm mode="add" role={access.role} />
    </ErpShell>
  );
}
