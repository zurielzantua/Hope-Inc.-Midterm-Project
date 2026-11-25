import { notFound, redirect } from 'next/navigation';
import type { DepartmentMutationActor } from '@/lib/department-mutations';
import { departmentMutationDependencies } from '@/lib/department-mutations-server';
import { ErpShell } from '../../../../../erp-shell';
import { DepartmentForm } from '../../../department-form';

export const dynamic = 'force-dynamic';

type EditDepartmentPageProps = { params: Promise<{ deptCode: string }> };

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Human Resources is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function EditDepartmentPage({ params }: EditDepartmentPageProps) {
  const { deptCode } = await params;
  if (!/^[A-Za-z0-9]{1,3}$/.test(deptCode)) notFound();

  const deps = departmentMutationDependencies();
  let access: DepartmentMutationActor | null;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (!access.modules.some(({ code }) => code === 'human_resources') || !access.rights.includes('edit_department')) notFound();

  let department;
  try { department = await deps.getDepartmentForEdit(deptCode.toUpperCase(), access.role); }
  catch { return <Unavailable />; }
  if (!department) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/human-resources">
      <DepartmentForm mode="edit" role={access.role} department={department} />
    </ErpShell>
  );
}
