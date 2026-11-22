'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PriceHistoryRow, PriceProduct } from '@/lib/price-history';

type PriceHistoryFormProps = { mode: 'add' | 'edit'; product: PriceProduct; price?: PriceHistoryRow };

export function PriceHistoryForm({ mode, product, price }: PriceHistoryFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = mode === 'edit';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const unitPrice = String(form.get('unitPrice') ?? '');
    const effectiveDate = String(form.get('effectiveDate') ?? '');
    const body = isEdit ? { unitPrice } : { effectiveDate, unitPrice };
    const endpoint = isEdit
      ? `/api/product/${encodeURIComponent(product.productCode)}/price-history/${encodeURIComponent(price?.effectiveDate ?? '')}`
      : `/api/product/${encodeURIComponent(product.productCode)}/price-history`;

    try {
      const response = await fetch(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
      if (!response.ok) {
        setError(typeof result?.message === 'string' ? result.message : typeof result?.error === 'string' ? result.error : 'Price could not be saved. Try again.');
        return;
      }
      router.replace(`/erp/modules/product/${encodeURIComponent(product.productCode)}/price-history?notice=${isEdit ? 'updated' : 'created'}`);
    } catch {
      setError('Price could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Price History</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">{isEdit ? 'Edit Price' : 'Add Price'}</h1>
        <p className="mt-2 text-sm text-muted">{isEdit ? 'Update the price amount for this Product and effective period.' : 'Create an effective-dated price for the selected Product.'}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <form onSubmit={submit} className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
          <h2 className="border-b border-line pb-3 text-lg font-bold text-navy">Price details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-muted">PRODUCT</span>
              <p className="min-h-11 rounded-md border border-line bg-cloud px-3 py-3 text-sm text-muted">{product.productCode} · {product.description || '—'} · {product.unit || '—'}</p>
            </div>
            <div>
              <label htmlFor="effectiveDate" className="mb-1 block text-sm font-medium text-ink">Effective Date{isEdit ? '' : ' *'}</label>
              <input id="effectiveDate" name="effectiveDate" type="date" required={!isEdit} readOnly={isEdit} defaultValue={price?.effectiveDate ?? ''} className="form-input" />
            </div>
            <div>
              <label htmlFor="unitPrice" className="mb-1 block text-sm font-medium text-ink">Unit Price *</label>
              <input id="unitPrice" name="unitPrice" type="number" required min="0.01" max="99999999.99" step="0.01" defaultValue={price?.unitPrice ?? ''} className="form-input" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">Unit Price must be greater than 0. Product Code and Effective Date preserve the price-history identity; add a new record for another period.</p>
          {error && <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">{error}</p>}

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            <Link href={`/erp/modules/product/${encodeURIComponent(product.productCode)}/price-history`} className="button-secondary">Cancel</Link>
            <button type="submit" disabled={saving} className="button-primary disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save Price'}</button>
          </div>
        </form>

        <aside className="h-fit rounded-md border border-teal/20 bg-teal/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal">Rights &amp; History</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">
            <li>This form is available only with the matching price action right.</li>
            <li>The selected Product Code is fixed to the parent Product.</li>
            <li>Each Product has one price per Effective Date.</li>
            <li>Future-dated records stay in history until their effective date.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
