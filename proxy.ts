import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key.startsWith('sb_secret_')) return response;
  const client = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set('Cache-Control', 'private, no-store');
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });
  try { await client.auth.getClaims(); } catch { /* Routes verify identity and account state independently. */ }
  return response;
}
export const config = { matcher: ['/erp/:path*', '/api/auth/me'] };
