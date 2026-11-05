'use client';
import { useState } from 'react';
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.assign('/');
    } catch { setError('Unable to sign out. Please try again.'); setBusy(false); }
  }
  return <div><button type="button" className="button-primary" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <p role="alert">{error}</p>}</div>;
}
