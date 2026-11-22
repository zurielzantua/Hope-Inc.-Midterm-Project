'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProductStatusAction({ productCode, isDeleted, canDelete, canRestore }: {
  productCode: string;
  isDeleted: boolean;
  canDelete: boolean;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextIsDeleted = !isDeleted;
  if (isDeleted ? !canRestore : !canDelete) return null;

  async function changeStatus() {
    if (saving) return;
    if (nextIsDeleted && !window.confirm('Move this product to Inactive? It can be restored later.')) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/product/${encodeURIComponent(productCode)}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: nextIsDeleted }),
      });
      const result = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
      if (!response.ok) {
        setError(typeof result?.message === 'string' ? result.message : typeof result?.error === 'string' ? result.error : 'Product status could not be changed. Try again.');
        return;
      }
      const query = new URLSearchParams(window.location.search);
      query.set('notice', nextIsDeleted ? 'deleted' : 'restored');
      router.replace(`/erp/modules/product?${query.toString()}`);
    } catch {
      setError('Product status could not be changed. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={changeStatus} disabled={saving} aria-busy={saving} className="text-sm font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60">
        {saving ? 'Saving…' : isDeleted ? 'Restore' : 'Soft delete'}
      </button>
      {error && <span role="alert" className="max-w-56 text-xs text-error">{error}</span>}
    </span>
  );
}
