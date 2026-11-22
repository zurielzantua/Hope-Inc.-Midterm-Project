import { notFound, redirect } from 'next/navigation';
import { productMutationDependencies } from '@/lib/product-mutations-server';
import { ErpShell } from '../../../erp-shell';
import { ProductForm } from '../product-form';

export const dynamic = 'force-dynamic';

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Product Management is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function AddProductPage() {
  const deps = productMutationDependencies();
  let access;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (!access.modules.some(({ code }) => code === 'product') || !access.rights.includes('add_product')) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/product">
      <ProductForm mode="add" role={access.role} />
    </ErpShell>
  );
}
