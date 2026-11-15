'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

type Stage = 'loading' | 'verify' | 'password' | 'invalid' | 'success';

export function FirstPasswordForm() {
  const [stage, setStage] = useState<Stage>('loading');
  const [tokenHash, setTokenHash] = useState('');
  const [invitationType, setInvitationType] = useState<'invite' | 'magiclink'>('invite');
  const [invitationId, setInvitationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get('token_hash');
    const type = fragment.get('type');
    const id = new URLSearchParams(window.location.search).get('setup_invite_id');
    window.history.replaceState(null, '', window.location.pathname);

    if (token && id && (type === 'invite' || type === 'magiclink')) {
      setTokenHash(token);
      setInvitationId(id);
      setInvitationType(type);
      setStage('verify');
      return;
    }

    fetch('/api/auth/first-password/status', { cache: 'no-store' })
      .then((response) => {
        if (response.ok) setStage('password');
        else {
          setMessage(response.status === 503
            ? 'First-password setup is temporarily unavailable. Please try again later.'
            : 'This invitation is unavailable. If you already set your password, sign in; otherwise contact an administrator.');
          setStage('invalid');
        }
      })
      .catch(() => {
        setMessage('First-password setup is temporarily unavailable. Please try again later.');
        setStage('invalid');
      });
  }, []);

  async function verifyInvitation() {
    if (busy || !tokenHash) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/first-password/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ tokenHash, type: invitationType, invitationId }),
      });
      if (response.ok) {
        setTokenHash('');
        setStage('password');
      } else if (response.status === 400 || response.status === 403) {
        setTokenHash('');
        setMessage('This invitation is invalid, expired, or unavailable for this account. Contact an administrator.');
        setStage('invalid');
      } else setMessage('First-password setup is temporarily unavailable. Please try again later.');
    } catch {
      setMessage('First-password setup is temporarily unavailable. Please try again later.');
    } finally { setBusy(false); }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') ?? '');
    const confirmation = String(values.get('confirmation') ?? '');
    if (password.length < 6 || password !== confirmation) {
      setMessage(password.length < 6 ? 'Enter at least 6 characters.' : 'Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/first-password/complete', {
        method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ password }),
      });
      if (response.ok) setStage('success');
      else if (response.status === 400) setMessage('The password does not meet the current password requirements.');
      else if (response.status === 401 || response.status === 403) {
        setMessage('This setup session is no longer available. Contact an administrator.');
        setStage('invalid');
      } else setMessage('Password setup could not be completed. Try again or contact an administrator.');
    } catch {
      setMessage('Password setup could not be completed. Try again or contact an administrator.');
    } finally { setBusy(false); }
  }

  return (
    <div className="px-1 pb-1 pt-7 sm:px-3">
      <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">Set your first password</h1>
      <p className="mt-2 text-sm text-muted">Continue using your one-time invitation.</p>
      {message && <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-ink">{message}</p>}

      {stage === 'loading' && <p role="status" className="mt-5 text-sm text-muted">Checking your setup session…</p>}
      {stage === 'verify' && (
        <div className="mt-5 space-y-4">
          <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-navy">Verify the invitation to continue. You will not be signed in to the ERP yet.</p>
          <button type="button" className="button-primary w-full" disabled={busy} onClick={verifyInvitation}>
            {busy ? 'Verifying…' : 'Verify invitation'}
          </button>
        </div>
      )}
      {stage === 'password' && (
        <form className="mt-5 space-y-4" onSubmit={submitPassword} aria-busy={busy}>
          <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-navy">Email link verified. Complete setup before signing in.</p>
          <div>
            <label className="field-label" htmlFor="first-password">New password</label>
            <input className="form-input" id="first-password" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required disabled={busy} />
          </div>
          <div>
            <label className="field-label" htmlFor="confirm-first-password">Confirm password</label>
            <input className="form-input" id="confirm-first-password" name="confirmation" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required disabled={busy} />
          </div>
          <button type="submit" className="button-primary w-full" disabled={busy}>{busy ? 'Setting password…' : 'Set password'}</button>
        </form>
      )}
      {stage === 'success' && <p role="status" className="mt-5 rounded-md bg-success/10 px-3 py-2 text-sm text-ink">Your password is set. Sign in with your new password.</p>}
      {(stage === 'invalid' || stage === 'success') && <a href="/" className="mt-5 inline-block font-semibold text-teal underline underline-offset-4">Go to sign in</a>}
    </div>
  );
}
