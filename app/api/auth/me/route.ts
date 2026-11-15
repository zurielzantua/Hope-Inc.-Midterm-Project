import { authorizeRequest } from '@/lib/auth/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await authorizeRequest();
  return Response.json(access.allowed ? { authorized: true } : { error: 'Access denied.' }, {
    status: access.allowed ? 200 : 401,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
