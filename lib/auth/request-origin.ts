const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export type OriginFailure = 'untrusted' | 'misconfigured';
export type OriginCheck = { ok: true } | { ok: false; reason: OriginFailure };
export type RedirectResolution = { ok: true; redirectTo: string } | { ok: false; reason: OriginFailure };

function isLocalDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

function parseConfiguredOrigin(configured: string) {
  try {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    const loopbackHttp = isLocalDevelopment() && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
    if (!loopbackHttp && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopbackPair(originHeader: string, requestOrigin: string) {
  try {
    const header = new URL(originHeader);
    const request = new URL(requestOrigin);
    return header.protocol === 'http:' && request.protocol === 'http:' &&
      header.port === request.port &&
      LOOPBACK_HOSTS.has(header.hostname) && LOOPBACK_HOSTS.has(request.hostname);
  } catch {
    return false;
  }
}

/**
 * Rejects cross-site form posts while accepting the browser origin the request
 * actually arrived on. A configured app URL may name a different public origin
 * (for example behind a proxy); localhost and 127.0.0.1 are interchangeable
 * only outside production.
 */
export function checkRequestOrigin(request: Request, configured: string | undefined): OriginCheck {
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return { ok: false, reason: 'misconfigured' };
  }

  const origin = request.headers.get('origin');
  if (!origin) return { ok: false, reason: 'untrusted' };

  let configuredOrigin: string | null = null;
  if (configured) {
    configuredOrigin = parseConfiguredOrigin(configured);
    if (!configuredOrigin) return { ok: false, reason: 'misconfigured' };
  }

  if (origin === requestOrigin) return { ok: true };
  if (configuredOrigin && origin === configuredOrigin) return { ok: true };
  if (isLocalDevelopment() && isLoopbackPair(origin, requestOrigin)) return { ok: true };
  return { ok: false, reason: 'untrusted' };
}

/** Resolves the post-verification redirect to an origin the request is allowed to use. */
export function resolveRedirect(request: Request, configured: string | undefined, path: string): RedirectResolution {
  const check = checkRequestOrigin(request, configured);
  if (!check.ok) return check;

  const origin = request.headers.get('origin');
  const configuredOrigin = configured ? parseConfiguredOrigin(configured) : null;
  const base = configuredOrigin && origin === configuredOrigin ? configuredOrigin : new URL(request.url).origin;
  return { ok: true, redirectTo: new URL(path, base).toString() };
}

export function isJsonRequest(request: Request) {
  return request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}
