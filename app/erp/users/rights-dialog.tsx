'use client';

import { useEffect, useMemo, useState } from 'react';
import { getModuleSelection, groupRights, setRightsSelection, type UserRight } from '@/lib/auth/user-rights';

type RightsTarget = {
  authUserId: string;
  firstName: string;
  lastName: string;
  roleName: string;
};

type Props = {
  user: RightsTarget;
  onClose: () => void;
  onSaved: () => void;
};

function getError(status: number) {
  if (status === 400) return 'The permission selection is invalid. Reload the list and try again.';
  if (status === 401 || status === 403) return 'Your session does not allow permission changes for this account.';
  if (status === 404) return 'This account is no longer available for Rights Management.';
  if (status === 503) return 'Rights Management is temporarily unavailable. Please try again later.';
  return 'Rights Management could not complete the request.';
}

export function RightsDialog({ user, onClose, onSaved }: Props) {
  const [rights, setRights] = useState<UserRight[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const modules = useMemo(() => groupRights(rights), [rights]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError('');
      setSaveError('');
      setNotice('');
      try {
        const response = await fetch(`/api/user-management/rights?userId=${encodeURIComponent(user.authUserId)}`, { cache: 'no-store' });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(String(response.status));
        if (!body || typeof body !== 'object' || !('rights' in body) || !Array.isArray(body.rights) || body.rights.length !== 36) {
          throw new Error('503');
        }
        if (!active) return;
        const loadedRights = body.rights as UserRight[];
        setRights(loadedRights);
        setSelectedIds(loadedRights.filter((right) => right.isAssigned).map((right) => right.rightId));
      } catch (reason) {
        if (!active) return;
        const status = reason instanceof Error && /^\d+$/.test(reason.message) ? Number(reason.message) : 503;
        setLoadError(getError(status));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [user.authUserId, reloadKey]);

  function setModule(moduleRights: UserRight[], checked: boolean) {
    setSelectedIds((current) => setRightsSelection(current, moduleRights.map((right) => right.rightId), checked));
    setSaveError('');
    setNotice('');
  }

  function setRight(rightId: number, checked: boolean) {
    setSelectedIds((current) => setRightsSelection(current, [rightId], checked));
    setSaveError('');
    setNotice('');
  }

  async function saveRights() {
    if (loading || saving || loadError) return;
    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      const response = await fetch('/api/user-management/rights', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ userId: user.authUserId, rightIds: selectedIds }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setNotice('Rights saved.');
      onSaved();
    } catch (reason) {
      const status = reason instanceof Error && /^\d+$/.test(reason.message) ? Number(reason.message) : 503;
      setSaveError(getError(status));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-3 sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rights-dialog-title"
        aria-busy={loading || saving}
        tabIndex={-1}
        onKeyDown={(event) => { if (event.key === 'Escape' && !saving) onClose(); }}
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        <header className="bg-navy px-5 py-4 text-white sm:px-7">
          <p className="text-sm font-bold">HOPE, INC. / ERP SYSTEM</p>
          <p className="text-xs text-white/75">ERP · PERMISSIONS</p>
          <h2 id="rights-dialog-title" className="mt-3 font-display text-xl font-bold">Manage access rights</h2>
          <p className="mt-1 text-sm text-white/75">{user.firstName} {user.lastName} · {user.roleName}</p>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6">
          <p className="mb-4 rounded-md bg-cloud px-3 py-2 text-sm text-muted">
            Five modules · 36 action rights total
          </p>

          {loading && <p role="status" className="py-8 text-center text-sm text-muted">Loading permissions…</p>}
          {!loading && loadError && (
            <div role="alert" className="rounded-md border border-error/30 bg-error/10 p-4 text-sm text-ink">
              <p>{loadError}</p>
              <button type="button" className="mt-3 font-semibold text-navy underline" onClick={() => setReloadKey((key) => key + 1)} disabled={saving}>Try again</button>
            </div>
          )}

          {!loading && !loadError && (
            <div className="space-y-3">
              {modules.map((module) => {
                const moduleIds = module.rights.map((right) => right.rightId);
                const { checked: allSelected, indeterminate: partiallySelected } = getModuleSelection(moduleIds, selectedIds);
                return (
                  <section key={module.moduleCode} aria-labelledby={`rights-module-${module.moduleCode}`} className="rounded-md bg-cloud p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex min-h-10 items-center gap-2 font-semibold text-navy">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(node) => { if (node) node.indeterminate = partiallySelected; }}
                          aria-label={`Select all ${module.moduleName} rights`}
                          disabled={saving}
                          onChange={(event) => setModule(module.rights, event.target.checked)}
                          className="size-4 accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                        />
                        <span id={`rights-module-${module.moduleCode}`}>{module.moduleName}</span>
                      </label>
                      <div className="flex items-center gap-2 text-sm font-semibold text-navy">
                        <button type="button" className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal" onClick={() => setModule(module.rights, true)} disabled={saving}>All</button>
                        <span aria-hidden="true">/</span>
                        <button type="button" className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal" onClick={() => setModule(module.rights, false)} disabled={saving}>None</button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-x-4 gap-y-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-3">
                      {module.rights.map((right) => (
                        <label key={right.rightId} className="flex min-h-9 items-start gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={selected.has(right.rightId)}
                            disabled={saving}
                            onChange={(event) => setRight(right.rightId, event.target.checked)}
                            className="mt-0.5 size-4 accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                          />
                          <span>{right.rightName}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {notice && <p role="status" className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-ink">{notice}</p>}
          {saveError && <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-ink">{saveError}</p>}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void saveRights()} disabled={loading || saving || Boolean(loadError)}>
            {saving ? 'Saving…' : 'Save rights'}
          </button>
        </footer>
      </section>
    </div>
  );
}
