/**
 * Map an opened universal/deep link to an in-app route (2026-09-13).
 * Only our own web hosts are honoured — a link to any other host is ignored,
 * so a crafted URL cannot steer the app. Returns path+query+hash, or null.
 */
const OWN_HOSTS = new Set(['petwash.co.il', 'www.petwash.co.il']);

export function inAppPathFromDeepLink(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !OWN_HOSTS.has(u.hostname.toLowerCase())) return null;
  if (u.pathname.startsWith('/api/')) return null;
  const path = u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`;
  if (path.startsWith('//')) return null;
  return `${path}${u.search}${u.hash}`;
}
