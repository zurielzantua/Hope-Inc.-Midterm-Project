'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

type Stage = 'idle' | 'invalid' | 'submitting' | 'sent' | 'rate-limited' | 'unavailable';

export function ForgotPasswordForm() {
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim().toLowerCase();
    if (!email || Array.from(email).length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStage('invalid');
      return;
    }

    setBusy(true);
    setStage('submitting');
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email }),
      });
      if (response.status === 202) setStage('sent');
      else if (response.status === 400) setStage('invalid');
      else if (response.status === 429) setStage('rate-limited');
      else setStage('unavailable');
    } catch {
      setStage('unavailable');
    } finally {
      setBusy(false);
    }
  }

  const messages: Partial<Record<Stage, string>> = {
    invalid: 'Enter a valid email address.',
    submitting: 'Sending reset instructions…',
    sent: 'If an account exists for that email, reset instructions will be sent. Check your inbox and spam folder.',
    'rate-limited': 'Too many reset requests. Wait a while, then try again.',
    unavailable: 'Password reset is temporarily unavailable. Please try again later.',
  };
  const message = messages[stage];
  const isError = ['invalid', 'rate-limited', 'unavailable'].includes(stage);

  return (
    <div className="px-1 pb-1 pt-7 sm:px-3">
      <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">Forgot your password?</h1>
      <p className="mt-2 text-sm text-muted">Enter your account email and we’ll send a secure reset link.</p>
      {message && <p role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} className="mt-4 rounded-md border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-ink">{message}</p>}

      {stage !== 'sent' && (
        <form className="mt-5 space-y-4" onSubmit={submit} aria-busy={busy}>
          <div>
            <label className="field-label" htmlFor="reset-request-email">Email address</label>
            <input className="form-input" id="reset-request-email" name="email" type="email" autoComplete="email" maxLength={320} required disabled={busy} />
          </div>
          <button type="submit" className="button-primary w-full" disabled={busy}>
            {busy && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />}
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-muted">
        <Link className="font-semibold text-teal underline underline-offset-4" href="/#access-panel">Return to sign in</Link>
      </p>
    </div>
  );
}
