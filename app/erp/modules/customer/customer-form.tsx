'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CustomerFormRecord } from '@/lib/customer-mutations-server';

type CustomerFormProps = { mode: 'add' | 'edit'; role: string; customer?: CustomerFormRecord };

export function CustomerForm({ mode, role, customer }: CustomerFormProps) {
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
    const details = {
      name: String(form.get('name') ?? ''),
      address: String(form.get('address') ?? ''),
      paymentTerms: String(form.get('paymentTerms') ?? ''),
    };
    const body = isEdit ? details : { customerNo: String(form.get('customerNo') ?? ''), ...details };

    try {
      const response = await fetch(isEdit
        ? `/api/customer/${encodeURIComponent(customer?.customerNo ?? '')}`
        : '/api/customer', {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setError(typeof result?.error === 'string' ? result.error : 'Customer could not be saved. Try again.');
        return;
      }
      router.replace(`/erp/modules/customer?notice=${mode === 'add' ? 'created' : 'updated'}`);
    } catch {
      setError('Customer could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Customer module</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">{isEdit ? 'Edit Customer' : 'Add Customer'}</h1>
        <p className="mt-2 text-sm text-muted">{isEdit ? 'Update the customer details. The customer number identifies this record.' : 'Enter the customer details. Fields marked * are required.'}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <form onSubmit={submit} className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
          <h2 className="border-b border-line pb-3 text-lg font-bold text-navy">Customer information</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customerNo" className="mb-1 block text-sm font-medium text-ink">Cust No. *</label>
              <input id="customerNo" name="customerNo" required maxLength={5} minLength={5} pattern="[A-Za-z0-9]{5}" readOnly={isEdit} defaultValue={customer?.customerNo ?? ''} placeholder="e.g. C0091" className="form-input" />
            </div>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">Customer Name *</label>
              <input id="name" name="name" required maxLength={20} defaultValue={customer?.name ?? ''} placeholder="Enter customer name" className="form-input" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="address" className="mb-1 block text-sm font-medium text-ink">Address *</label>
              <input id="address" name="address" required maxLength={50} defaultValue={customer?.address ?? ''} placeholder="Street, city, region" className="form-input" />
            </div>
            <div>
              <label htmlFor="paymentTerms" className="mb-1 block text-sm font-medium text-ink">Pay Terms *</label>
              <select id="paymentTerms" name="paymentTerms" required defaultValue={customer?.paymentTerms ?? ''} className="form-input">
                <option value="" disabled>Select pay terms</option>
                <option value="COD">COD</option>
                <option value="30D">30D</option>
                <option value="45D">45D</option>
              </select>
            </div>
          </div>

          {isEdit && isManager && customer && (
            <section aria-label="Customer status" className="mt-5 rounded-md border border-line bg-cloud p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Status / Stamp (system generated)</h3>
              <p className="mt-2 text-sm font-semibold text-ink">{customer.status === 'inactive' ? 'Inactive' : 'Active'}</p>
              <p className="mt-1 text-sm text-muted">{customer.stamp || '—'}</p>
            </section>
          )}

          {error && <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">{error}</p>}

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            <Link href="/erp/modules/customer" className="button-secondary">Cancel</Link>
            <button type="submit" disabled={saving} className="button-primary disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : isEdit ? 'Save Customer' : 'Add Customer'}</button>
          </div>
        </form>

        <aside className="h-fit rounded-md border border-teal/20 bg-teal/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal">Rights &amp; validation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">
            <li>This form is available only when the matching Customer action right is assigned.</li>
            <li>Customer number is unique and cannot be changed after creation.</li>
            <li>Status and Stamp are generated by the system and cannot be edited here.</li>
          </ul>
          <p className="mt-4 text-sm text-muted">Available pay terms: COD, 30D, 45D.</p>
        </aside>
      </div>
    </>
  );
}
