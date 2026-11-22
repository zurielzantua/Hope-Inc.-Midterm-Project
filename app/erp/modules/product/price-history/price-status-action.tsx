'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PriceStatusAction({ productCode, effectiveDate }: { productCode: string; effectiveDate: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function softDelete() {
    if (saving || !window.confirm('Soft-delete this price record? It will remain in history but will no longer affect current-price calculations.')) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/product/${encodeURIComponent(productCode)}/price-history/${encodeURIComponent(effectiveDate)}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: true }),
      });
      const result = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
      if (!response.ok) {
        setError(typeof result?.message === 'string' ? result.message : typeof result?.error === 'string' ? result.error : 'Price could not be deactivated. Try again.');
        return;
      }
      const query = new URLSearchParams(window.location.search);
      query.set('notice', 'deleted');
      router.replace(`/erp/modules/product/${encodeURIComponent(productCode)}/price-history?${query.toString()}`);
    } catch {
      setError('Price could not be deactivated. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={softDelete} disabled={saving} aria-busy={saving} className="text-sm font-semibold text-teal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60">
        {saving ? 'Saving…' : 'Soft delete'}
      </button>
      {error && <span role="alert" className="max-w-56 text-xs text-error">{error}</span>}
    </span>
  );
}
