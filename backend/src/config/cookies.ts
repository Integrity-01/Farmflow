import { env } from './env.js';

/**
 * Resolves the SameSite policy for refresh cookies. Production deployments
 * typically split the web app (Vercel) and API (Render) across domains, where
 * browsers only attach cookies to cross-site requests when SameSite=None (and
 * the cookie is Secure). Development keeps the stricter "lax" default.
 */
export function refreshCookieSameSite(): 'lax' | 'strict' | 'none' {
  if (env.COOKIE_SAMESITE !== 'auto') return env.COOKIE_SAMESITE;
  return env.NODE_ENV === 'production' ? 'none' : 'lax';
}

/** Cookies are only marked Secure over HTTPS, i.e. in production. */
export function refreshCookieSecure(): boolean {
  return env.NODE_ENV === 'production';
}
