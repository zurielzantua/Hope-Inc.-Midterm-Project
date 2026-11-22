'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProductFormRecord } from '@/lib/product-mutations-server';

type ProductFormProps = { mode: 'add' | 'edit'; role: string; product?: ProductFormRecord };

export function ProductForm({ mode, role, product }: ProductFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = mode === 'edit';
  const isManager = role === 'admin' || role === 'superadmin';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const details = { description: String(form.get('description') ?? ''), unit: String(form.get('unit') ?? '') };
    const body = isEdit ? details : { productCode: String(form.get('productCode') ?? ''), ...details };

    try {
      const response = await fetch(isEdit
        ? `/api/product/${encodeURIComponent(product?.productCode ?? '')}`
        : '/api/product', {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setError(typeof result?.error === 'string' ? result.error : 'Product could not be saved. Try again.');
        return;
      }
      router.replace(`/erp/modules/product?notice=${mode === 'add' ? 'created' : 'updated'}`);
    } catch {
      setError('Product could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Product module</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
        <p className="mt-2 text-sm text-muted">{isEdit ? 'Update the product details. Product Code identifies this record.' : 'Enter the product details. Fields marked * are required.'}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <form onSubmit={submit} className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
          <h2 className="border-b border-line pb-3 text-lg font-bold text-navy">Product information</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="productCode" className="mb-1 block text-sm font-medium text-ink">Product Code *</label>
              <input id="productCode" name="productCode" required maxLength={6} minLength={6} pattern="[A-Za-z0-9]{6}" readOnly={isEdit} defaultValue={product?.productCode ?? ''} placeholder="e.g. AD0042" className="form-input" />
            </div>
            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-ink">Description *</label>
              <input id="description" name="description" required maxLength={30} defaultValue={product?.description ?? ''} placeholder="Enter product description" className="form-input" />
            </div>
            <div>
              <label htmlFor="unit" className="mb-1 block text-sm font-medium text-ink">Unit *</label>
              <select id="unit" name="unit" required defaultValue={product?.unit ?? ''} className="form-input">
                <option value="" disabled>Select unit</option>
                <option value="pc">pc</option>
                <option value="ea">ea</option>
                <option value="mtr">mtr</option>
                <option value="pkg">pkg</option>
                <option value="ltr">ltr</option>
              </select>
            </div>
          </div>

          {isEdit && isManager && product && (
            <section aria-label="Product status and stamp" className="mt-5 rounded-md border border-line bg-cloud p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Status / Stamp (admin only)</h3>
              <p className="mt-2 text-sm font-semibold text-ink">{product.status === 'inactive' ? 'Inactive' : 'Active'}</p>
              <p className="mt-1 text-sm text-muted">{product.stamp || '—'}</p>
            </section>
          )}

          {error && <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">{error}</p>}

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            <Link href="/erp/modules/product" className="button-secondary">Cancel</Link>
            <button type="submit" disabled={saving} className="button-primary disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save Product'}</button>
          </div>
        </form>

        <aside className="h-fit rounded-md border border-teal/20 bg-teal/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal">Rights &amp; validation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">
            <li>This form is available only when the matching Product action right is assigned.</li>
            <li>Product Code is unique and cannot be changed after creation.</li>
            <li>Status and Stamp are generated by the system and are read-only.</li>
          </ul>
          <p className="mt-4 text-sm text-muted">Allowed units: pc, ea, mtr, pkg, ltr.</p>
        </aside>
      </div>
    </>
  );
}
