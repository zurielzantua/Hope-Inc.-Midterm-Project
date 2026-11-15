import { createHash, randomBytes } from 'node:crypto';

const lifetimeMs = 15 * 60 * 1000;

export function digestSetupToken(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const bytes = Buffer.from(token, 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== token) return null;
  return createHash('sha256').update(bytes).digest('hex');
}

export function createSetupCredential(now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  return { token, digest: digestSetupToken(token)!, expiresAt: new Date(now + lifetimeMs).toISOString() };
}

// The origin must come from trusted server configuration, never a request parameter.
export function buildSetupLink(trustedOrigin: string, token: string) {
  if (!digestSetupToken(token)) throw new Error('Invalid setup credential');
  const origin = new URL(trustedOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Invalid setup origin');
  }
  const link = new URL('/set-password', origin.origin);
  link.hash = new URLSearchParams({ token }).toString();
  return link.toString();
}
