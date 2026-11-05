import { redirect } from 'next/navigation';
import { authorizeRequest } from '@/lib/auth/server';
import { LogoutButton } from './logout-button';
export const dynamic = 'force-dynamic';
export default async function ErpPage() {
  const access = await authorizeRequest();
  if (!access.allowed) redirect('/');
  return <main className="app-shell min-h-screen p-8"><div className="mx-auto max-w-4xl"><h1 className="font-display text-3xl font-bold">Hope, Inc. ERP</h1><p className="mt-4">You are signed in.</p><div className="mt-6"><LogoutButton /></div></div></main>;
}
