import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Reset password | Hope, Inc.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-4 py-8 text-ink">
      <section className="w-full max-w-xl rounded-xl border border-line bg-surface p-5 shadow-xl sm:p-7">
        <header className="rounded-md bg-navy px-5 py-4 text-white">
          <p className="text-base font-bold">HOPE, INC. / ERP SYSTEM</p>
          <p className="text-sm text-white/75">AUTH · PASSWORD RESET</p>
        </header>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
