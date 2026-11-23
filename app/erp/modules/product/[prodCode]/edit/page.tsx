import { notFound, redirect } from 'next/navigation';
import type { ProductMutationActor } from '@/lib/product-mutations';
import { productMutationDependencies } from '@/lib/product-mutations-server';
import { ErpShell } from '../../../../erp-shell';
import { ProductForm } from '../../product-form';

export const dynamic = 'force-dynamic';

type EditProductPageProps = { params: Promise<{ prodCode: string }> };

function Unavailable() {
  return <main className="min-h-screen bg-cloud p-6 text-ink"><p role="alert" className="mx-auto max-w-xl rounded-md border border-error/30 bg-surface p-5">Product Management is temporarily unavailable. Refresh or contact an administrator.</p></main>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { prodCode } = await params;
  if (!/^[A-Za-z0-9]{6}$/.test(prodCode)) notFound();

  const deps = productMutationDependencies();
  let access: ProductMutationActor | null;
  try { access = await deps.getActor(); }
  catch { return <Unavailable />; }
  if (!access) redirect('/');
  if (!access.modules.some(({ code }) => code === 'product') || !access.rights.includes('edit_product')) notFound();

  let product;
  try { product = await deps.getProductForEdit(prodCode.toUpperCase(), access.role); }
  catch { return <Unavailable />; }
  if (!product) notFound();

  return (
    <ErpShell role={access.role} modules={access.modules} currentPath="/erp/modules/product">
      <ProductForm mode="edit" role={access.role} product={product} />
    </ErpShell>
  );
}
