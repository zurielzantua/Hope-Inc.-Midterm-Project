'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Stage = 'checking' | 'verify' | 'password' | 'invalid' | 'unavailable' | 'success';

export function ResetPasswordForm() {
  const [stage, setStage] = useState<Stage>('checking');
  const [tokenHash, setTokenHash] = useState('');
  const [message, setMessage] = useState('');
  const [signedOut, setSignedOut] = useState(true);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const token = fragment.get('token_hash');
    const type = fragment.get('type');
    const authError = url.searchParams.has('error') || url.searchParams.has('error_code');
    window.history.replaceState(null, '', url.pathname);

    if (authError || (token && type !== 'recovery')) {
      setMessage('This reset link is invalid, expired, or already used. Request a new link.');
      setStage('invalid');
      return;
    }
    if (token) {
      setTokenHash(token);
      setStage('verify');
      return;
    }

    fetch('/api/auth/password-reset/status', { cache: 'no-store' })
      .then((response) => {
        if (response.ok) setStage('password');
        else if (response.status === 401) {
          setMessage('This reset link is invalid, expired, or already used. Request a new link.');
          setStage('invalid');
        } else {
          setMessage('Password reset is temporarily unavailable. Please try again later.');
          setStage('unavailable');
        }
      })
      .catch(() => {
        setMessage('Password reset is temporarily unavailable. Please try again later.');
        setStage('unavailable');
      });
  }, []);

  async function verifyLink() {
    if (busy || !tokenHash) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ tokenHash }),
      });
      if (response.ok) {
        setTokenHash('');
        setStage('password');
      } else if (response.status === 400) {
        setTokenHash('');
        setMessage('This reset link is invalid, expired, or already used. Request a new link.');
        setStage('invalid');
      } else {
        setMessage('Password reset is temporarily unavailable. Please try again later.');
        setStage('unavailable');
      }
    } catch {
      setMessage('Password reset is temporarily unavailable. Please try again later.');
      setStage('unavailable');
    } finally {
      setBusy(false);
    }
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
      const response = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ password, confirmation }),
      });
      if (response.ok) {
        const result: unknown = await response.json().catch(() => null);
        setSignedOut(Boolean(result && typeof result === 'object' && 'signedOut' in result && result.signedOut === true));
        setStage('success');
      } else if (response.status === 400) {
        setMessage('Choose a password that meets the password requirements.');
      } else if (response.status === 401) {
        setMessage('This reset session is invalid or expired. Request a new reset link.');
        setStage('invalid');
      } else {
        setMessage('Password reset is temporarily unavailable. Please try again later.');
        setStage('unavailable');
      }
    } catch {
      setMessage('Password reset is temporarily unavailable. Please try again later.');
      setStage('unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-1 pb-1 pt-7 sm:px-3">
      <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">Choose a new password for your HOPE ERP account.</p>
      {message && <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-ink">{message}</p>}

      {stage === 'checking' && <p role="status" className="mt-5 text-sm text-muted">Checking your reset session…</p>}
      {stage === 'verify' && (
        <div className="mt-5 space-y-4">
          <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-navy">Verify this one-time link to continue. Expired or used links cannot be reused.</p>
          <button type="button" className="button-primary w-full" disabled={busy} onClick={verifyLink}>
            {busy ? 'Verifying…' : 'Verify reset link'}
          </button>
        </div>
      )}
      {stage === 'password' && (
        <form className="mt-5 space-y-4" onSubmit={submitPassword} aria-busy={busy}>
          <div>
            <label className="field-label" htmlFor="reset-new-password">New password</label>
            <input className="form-input" id="reset-new-password" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required disabled={busy} />
          </div>
          <div>
            <label className="field-label" htmlFor="reset-confirm-password">Confirm password</label>
            <input className="form-input" id="reset-confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={6} maxLength={1024} required disabled={busy} />
          </div>
          <button type="submit" className="button-primary w-full" disabled={busy}>
            {busy && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />}
            {busy ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      )}
      {stage === 'success' && (
        <p role="status" className="mt-5 rounded-md bg-success/10 px-3 py-2 text-sm text-ink">
          {signedOut ? 'Your password was updated. Sign in with your new password.' : 'Your password was updated, but we could not end this session automatically. Sign out before continuing.'}
        </p>
      )}
      {(stage === 'invalid' || stage === 'unavailable') && (
        <p className="mt-5 text-center text-sm text-muted">
          <Link className="font-semibold text-teal underline underline-offset-4" href="/forgot-password">Request another reset link</Link>
        </p>
      )}
      {(stage === 'invalid' || stage === 'success') && (
        <p className="mt-3 text-center text-sm text-muted">
          <Link className="font-semibold text-teal underline underline-offset-4" href="/#access-panel">Return to sign in</Link>
        </p>
      )}
    </div>
  );
}
