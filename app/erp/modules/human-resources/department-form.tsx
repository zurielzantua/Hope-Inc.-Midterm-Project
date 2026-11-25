'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DepartmentFormRecord } from '@/lib/department-mutations-server';

type DepartmentFormProps = { mode: 'add' | 'edit'; role: string; department?: DepartmentFormRecord };

export function DepartmentForm({ mode, role, department }: DepartmentFormProps) {
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
    const details = { name: String(form.get('name') ?? '') };
    const body = isEdit
      ? details
      : { departmentCode: String(form.get('departmentCode') ?? ''), ...details };

    try {
      const response = await fetch(isEdit
        ? `/api/department/${encodeURIComponent(department?.departmentCode ?? '')}`
        : '/api/department', {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        setError(typeof result?.error === 'string' ? result.error : 'Department could not be saved. Try again.');
        return;
      }
      router.replace(`/erp/modules/human-resources?notice=${mode === 'add' ? 'created' : 'updated'}`);
    } catch {
      setError('Department could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Human Resources / Departments</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">
          {isEdit ? 'Edit Department' : 'Add Department'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isEdit ? 'Update the department name. The department code identifies this record.' : 'Enter a department code and name.'}
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <form onSubmit={submit} className="rounded-md border border-line bg-surface p-5 shadow-soft sm:p-7">
          <h2 className="border-b border-line pb-3 text-lg font-bold text-navy">Department information</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="departmentCode" className="mb-1 block text-sm font-medium text-ink">Department Code *</label>
              <input
                id="departmentCode"
                name="departmentCode"
                required
                minLength={1}
                maxLength={3}
                pattern="[A-Za-z0-9]{1,3}"
                readOnly={isEdit}
                defaultValue={department?.departmentCode ?? ''}
                placeholder="e.g. HRD"
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">Department Name *</label>
              <input
                id="name"
                name="name"
                required
                maxLength={20}
                defaultValue={department?.name ?? ''}
                placeholder="Enter department name"
                className="form-input"
              />
            </div>
          </div>

          {isEdit && isManager && department && (
            <section aria-label="Department status" className="mt-5 rounded-md border border-line bg-cloud p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Status / Stamp (system generated)</h3>
              <p className="mt-2 text-sm font-semibold text-ink">{department.status === 'inactive' ? 'Inactive' : 'Active'}</p>
              <p className="mt-1 text-sm text-muted">{department.stamp || '—'}</p>
            </section>
          )}

          {error && <p role="alert" className="mt-5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-ink">{error}</p>}

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            <Link href="/erp/modules/human-resources" className="button-secondary">Cancel</Link>
            <button type="submit" disabled={saving} className="button-primary disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Department' : 'Add Department'}
            </button>
          </div>
        </form>

        <aside className="h-fit rounded-md border border-teal/20 bg-teal/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal">Rights &amp; validation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">
            <li>This form is available only when the matching Department action right is assigned.</li>
            <li>Department Code is unique and cannot be changed after creation.</li>
            <li>Status and Stamp are generated by the system and cannot be edited here.</li>
          </ul>
          <p className="mt-4 text-sm text-muted">Department Code accepts 1–3 letters or numbers; Department Name is limited to 20 characters.</p>
        </aside>
      </div>
    </>
  );
}
