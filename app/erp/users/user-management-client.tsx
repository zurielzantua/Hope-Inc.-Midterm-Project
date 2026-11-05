'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type ActorRole = 'admin' | 'superadmin';
type UserRow = {
  authUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleCode: 'user' | 'admin' | 'superadmin';
  roleName: string;
  accountState: 'pending' | 'approved';
  isBlocked: boolean;
  isDeleted: boolean;
};
type Editor = { mode: 'add' } | { mode: 'edit'; user: UserRow } | null;
type StatusFilter = 'all' | 'pending' | 'approved' | 'blocked' | 'deleted';

function statusOf(user: UserRow): Exclude<StatusFilter, 'all'> {
  if (user.isDeleted) return 'deleted';
  if (user.isBlocked) return 'blocked';
  return user.accountState;
}

function statusText(status: Exclude<StatusFilter, 'all'>) {
  return status === 'approved' ? 'Approved' : status[0].toUpperCase() + status.slice(1);
}

function statusClass(status: Exclude<StatusFilter, 'all'>) {
  if (status === 'blocked' || status === 'deleted') return 'border-error/30 bg-error/10 text-error';
  if (status === 'pending') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-success/30 bg-success/10 text-success';
}

function errorMessage(status: number) {
  if (status === 400) return 'Check the entered information and try again.';
  if (status === 404) return 'This account cannot be managed or was not found.';
  if (status === 409) return 'A user with this email already exists.';
  if (status === 429) return 'Too many attempts. Wait a while, then try again.';
  if (status === 401 || status === 403) return 'Your session does not allow this action.';
  return 'User Management is temporarily unavailable. Please try again.';
}

export function UserManagementClient({ actorRole }: { actorRole: ActorRole }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editor, setEditor] = useState<Editor>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const loadUsers = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/user-management', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('users' in result) || !Array.isArray(result.users)) throw new Error('invalid response');
      setUsers(result.users as UserRow[]);
    } catch (reason) {
      const status = reason instanceof Error && /^\d+$/.test(reason.message) ? Number(reason.message) : 503;
      setError(errorMessage(status));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const status = statusOf(user);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesRole = roleFilter === 'all' || user.roleCode === roleFilter;
      const fullName = `${user.firstName} ${user.lastName}`.toLocaleLowerCase();
      const matchesSearch = !needle || fullName.includes(needle) || user.email.toLocaleLowerCase().includes(needle);
      return matchesStatus && matchesRole && matchesSearch;
    });
  }, [users, search, statusFilter, roleFilter]);

  function openAdd() {
    setFirstName(''); setLastName(''); setEmail(''); setError(''); setNotice(''); setEditor({ mode: 'add' });
  }

  function openEdit(user: UserRow) {
    setFirstName(user.firstName); setLastName(user.lastName); setEmail(user.email); setError(''); setNotice(''); setEditor({ mode: 'edit', user });
  }

  function closeEditor() {
    if (busy) return;
    setEditor(null);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !editor) return;
    setBusy(true); setError('');
    try {
      const response = editor.mode === 'add'
        ? await fetch('/api/user-management', {
            method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
            body: JSON.stringify({ firstName, lastName, email }),
          })
        : await fetch('/api/user-management/update', {
            method: 'PATCH', headers: { 'content-type': 'application/json' }, cache: 'no-store',
            body: JSON.stringify({ userId: editor.user.authUserId, firstName, lastName }),
          });
      if (!response.ok) throw new Error(String(response.status));
      setEditor(null);
      setNotice(editor.mode === 'add'
        ? 'User added as Pending. A password setup invitation is available after approval.'
        : 'User details updated.');
      await loadUsers(false);
    } catch (reason) {
      const status = reason instanceof Error && /^\d+$/.test(reason.message) ? Number(reason.message) : 503;
      setError(errorMessage(status));
    } finally {
      setBusy(false);
    }
  }

  async function setBlocked(user: UserRow) {
    if (busy || user.isDeleted || user.roleCode === 'superadmin') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/user-management/update', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ userId: user.authUserId, isBlocked: !user.isBlocked }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setNotice(user.isBlocked ? 'User unblocked.' : 'User blocked.');
      await loadUsers(false);
    } catch (reason) {
      const status = reason instanceof Error && /^\d+$/.test(reason.message) ? Number(reason.message) : 503;
      setError(errorMessage(status));
    } finally {
      setBusy(false);
    }
  }

  const showRoleFilter = actorRole === 'superadmin';

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">User Management</h1>
          <p className="mt-1 text-sm text-muted">{actorRole === 'admin' ? 'Manage User accounts.' : 'Manage User and Admin accounts.'}</p>
        </div>
        <button type="button" className="button-primary" onClick={openAdd}>+ Add User</button>
      </div>

      <div className="mt-5 grid gap-3 rounded-md bg-cloud p-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
        <label className="sr-only" htmlFor="user-search">Search by name or email</label>
        <input id="user-search" className="form-input" type="search" placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Status:</span>
          <select className="form-input min-h-10 w-auto py-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="blocked">Blocked</option><option value="deleted">Deleted</option>
          </select>
        </label>
        {showRoleFilter && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Role:</span>
            <select className="form-input min-h-10 w-auto py-2" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All</option><option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option>
            </select>
          </label>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-ink">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-ink">{notice}</p>}

      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead className="bg-cloud text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted" role="status">Loading users…</td></tr>}
            {!loading && filteredUsers.map((user) => {
              const status = statusOf(user);
              const canManage = !user.isDeleted && user.roleCode !== 'superadmin' && (actorRole === 'superadmin' || user.roleCode === 'user');
              return (
                <tr key={user.authUserId}>
                  <td className="px-4 py-3 font-medium text-navy">{user.firstName} {user.lastName}</td>
                  <td className="px-4 py-3 text-ink">{user.email}</td>
                  <td className="px-4 py-3 text-ink">{user.roleName}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{statusText(status)}</span></td>
                  <td className="px-4 py-3">
                    {canManage ? <div className="flex flex-wrap items-center gap-3">
                      <button type="button" className="font-semibold text-teal underline-offset-4 hover:underline" disabled={busy} onClick={() => openEdit(user)}>Edit</button>
                      <button type="button" className="font-semibold text-navy underline-offset-4 hover:underline" disabled={busy} onClick={() => void setBlocked(user)}>{user.isBlocked ? 'Unblock' : 'Block'}</button>
                    </div> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
            {!loading && filteredUsers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No users match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-editor-title" className="w-full max-w-lg rounded-xl border border-line bg-surface p-5 shadow-2xl sm:p-7">
            <h2 id="user-editor-title" className="font-display text-xl font-bold text-navy">{editor.mode === 'add' ? 'Add User' : 'Edit User'}</h2>
            <form className="mt-5 space-y-4" onSubmit={saveUser} aria-busy={busy}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="field-label" htmlFor="managed-first-name">First name</label><input className="form-input" id="managed-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required disabled={busy} autoComplete="given-name" /></div>
                <div><label className="field-label" htmlFor="managed-last-name">Last name</label><input className="form-input" id="managed-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required disabled={busy} autoComplete="family-name" /></div>
              </div>
              <div>
                <label className="field-label" htmlFor="managed-email">Email address</label>
                <input className="form-input" id="managed-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required disabled={busy || editor.mode === 'edit'} readOnly={editor.mode === 'edit'} autoComplete="email" />
                {editor.mode === 'add' && <p className="mt-1 text-xs text-muted">The account will start as User and Pending.</p>}
              </div>
              {error && <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-ink">{error}</p>}
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button type="button" className="button-secondary" onClick={closeEditor} disabled={busy}>Cancel</button>
                <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Saving…' : editor.mode === 'add' ? 'Add User' : 'Save changes'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
