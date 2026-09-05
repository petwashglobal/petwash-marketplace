/**
 * ssrfGuard — the one safe way to fetch a caller-supplied URL.
 *
 * WHY THIS EXISTS
 * ---------------
 * Anywhere the server fetches a URL that a caller can influence, an attacker
 * can point it at infrastructure only the server can reach:
 *
 *   http://169.254.169.254/computeMetadata/v1/  -> GCP metadata: service-account
 *                                                  tokens for the whole project
 *   http://127.0.0.1:8080/                      -> our own unauthenticated
 *                                                  admin/debug surfaces
 *   http://10.x / 172.16-31.x / 192.168.x       -> anything else in the VPC
 *   http://[::1]  /  http://[::ffff:127.0.0.1]  -> the IPv6 spellings of the same
 *
 * Two mistakes make a guard useless, and both were present in this codebase:
 *
 *  1. VALIDATING THE STRING, NOT THE DESTINATION. `new URL(u).hostname` can be
 *     a DNS name that resolves to 127.0.0.1 ("DNS rebinding" / `localtest.me`
 *     style). You must resolve the name and check every A/AAAA record.
 *
 *  2. VALIDATING ONLY THE FIRST URL. `fetch()` follows redirects by default.
 *     An attacker supplies a perfectly public https://evil.com that answers
 *     `302 Location: http://169.254.169.254/...`. The guard passed, the request
 *     still lands on the metadata service. This is THE classic bypass, and the
 *     only fix is `redirect: 'manual'` with a re-validation on every hop.
 *
 * safeFetch() below does both. Every caller-supplied URL must go through it.
 *
 * NOTE ON TOCTOU: resolving the name and then letting the OS resolve it again
 * inside fetch() leaves a small rebinding window. Closing it fully requires
 * pinning the socket to the validated IP (a custom agent + Host header), which
 * breaks TLS SNI for the common cases we have. We therefore validate every hop
 * and keep the redirect budget small; the residual risk is an attacker who
 * controls an authoritative DNS server AND wins a sub-second race. Documented
 * rather than silently ignored.
 */

import dns from 'dns/promises';
import net from 'net';
import { isPublicIP } from '../utils/ipValidation';

export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED';
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

/** Schemes we will ever speak. `http:` only when a caller explicitly opts in. */
const DEFAULT_ALLOWED_PROTOCOLS = ['https:'] as const;

/**
 * Hostnames that are never legitimate targets regardless of what DNS says.
 * Belt-and-braces on top of the IP checks.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

/**
 * Reject an IPv6 literal that is not a globally-routable unicast address.
 * `isPublicIP` in ../utils/ipValidation handles IPv4 thoroughly and covers ::1
 * and fe80::/10, but not unique-local fc00::/7 or the unspecified/multicast
 * space, so we complete the picture here.
 */
function isPublicIPv6(addr: string): boolean {
  const a = addr.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!a || a === '::' || a === '::1') return false;
  // IPv4-mapped / IPv4-compatible — defer to the IPv4 rules.
  // TWO spellings must be handled. `new URL()` normalises the dotted form to
  // hex, so `::ffff:127.0.0.1` arrives as `::ffff:7f00:1` and a dotted-quad-
  // only regex silently lets loopback through. (Caught by the pin in
  // server/tests/ssrfGuard.test.ts.)
  const mappedDotted = a.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return isPublicIP(mappedDotted[1]);
  const mappedHex = a.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPublicIP(dotted);
  }
  // Unique-local fc00::/7 (fc.. and fd..)
  if (/^f[cd][0-9a-f]{2}:/.test(a)) return false;
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(a)) return false;
  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(a)) return false;
  // Discard-only 100::/64
  if (/^100:0*:/.test(a) || a === '100::') return false;
  // Documentation 2001:db8::/32
  if (/^2001:0*db8:/.test(a)) return false;
  return true;
}

/** True only for an address literal that is safe to connect to. */
export function isPublicAddress(addr: string): boolean {
  const version = net.isIP(addr);
  if (version === 4) return isPublicIP(addr);
  if (version === 6) return isPublicIPv6(addr);
  return false;
}

export interface SafeFetchOptions {
  /** Extra protocols beyond https:. Pass ['http:'] only for a known-plaintext peer. */
  allowedProtocols?: readonly string[];
  /** Maximum redirect hops to follow. Every hop is re-validated. */
  maxRedirects?: number;
  /** Abort after this many ms (whole chain). */
  timeoutMs?: number;
  /** If set, the final host must be one of these (exact, case-insensitive). */
  allowedHosts?: readonly string[];
  /** Cap on the response body we will buffer, in bytes. */
  maxBytes?: number;
}

/**
 * Validate a single URL: scheme, hostname denylist, and every IP the hostname
 * resolves to. Throws SsrfBlockedError on any failure.
 */
export async function assertSafeUrl(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<URL> {
  const allowedProtocols = opts.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('Malformed URL');
  }

  if (!allowedProtocols.includes(url.protocol)) {
    throw new SsrfBlockedError(
      `Protocol ${url.protocol} is not allowed (allowed: ${allowedProtocols.join(', ')})`,
    );
  }

  // Credentials in the URL are a redirect/parsing-confusion aid, never needed.
  if (url.username || url.password) {
    throw new SsrfBlockedError('Credentials in URL are not allowed');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) throw new SsrfBlockedError('URL has no host');
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SsrfBlockedError(`Host ${hostname} is blocked`);
  }
  // `.internal`, `.local`, `.localhost` are never public.
  if (/\.(internal|local|localhost|home\.arpa)$/.test(hostname)) {
    throw new SsrfBlockedError(`Host ${hostname} is in a private namespace`);
  }

  if (opts.allowedHosts && !opts.allowedHosts.some((h) => h.toLowerCase() === hostname)) {
    throw new SsrfBlockedError(`Host ${hostname} is not in the allowlist`);
  }

  // If the host is an IP literal, check it directly — no DNS involved.
  if (net.isIP(hostname)) {
    if (!isPublicAddress(hostname)) {
      throw new SsrfBlockedError(`Address ${hostname} is not a public routable address`);
    }
    return url;
  }

  // Otherwise resolve and require EVERY answer to be public. A single private
  // record is enough to reject — an attacker only needs one to win.
  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new SsrfBlockedError(`Could not resolve host ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new SsrfBlockedError(`Host ${hostname} resolved to no addresses`);
  }

  for (const addr of addresses) {
    if (!isPublicAddress(addr)) {
      throw new SsrfBlockedError(
        `Host ${hostname} resolves to non-public address ${addr}`,
      );
    }
  }

  return url;
}

/**
 * Fetch a caller-supplied URL with SSRF protection on EVERY redirect hop.
 *
 * Redirects are followed manually (`redirect: 'manual'`) so each new Location
 * is re-validated before we connect to it. Following them with the built-in
 * follower would let hop 2 reach 169.254.169.254 even though hop 1 was public.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      // Re-validate on EVERY hop — this is the whole point of the manual loop.
      const url = await assertSafeUrl(current, opts);

      const res = await fetch(url, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (res.status < 300 || res.status > 399) return res;

      const location = res.headers.get('location');
      if (!location) return res; // 3xx with no Location — hand it back as-is.

      if (hop === maxRedirects) {
        throw new SsrfBlockedError(`Too many redirects (>${maxRedirects})`);
      }
      // Resolve relative Locations against the hop we just validated.
      current = new URL(location, url).toString();
    }
    throw new SsrfBlockedError('Redirect loop exhausted');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * safeFetch + a hard cap on how many bytes we buffer. Use this whenever the
 * response body is going into memory (image moderation, link previews) so a
 * hostile endpoint cannot stream us out of RAM.
 */
export async function safeFetchBuffer(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<{ buffer: Buffer; contentType: string; status: number }> {
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const res = await safeFetch(rawUrl, {}, opts);

  const declared = Number(res.headers.get('content-length') || '0');
  if (declared > maxBytes) {
    throw new SsrfBlockedError(`Response too large (${declared} > ${maxBytes} bytes)`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new SsrfBlockedError(
      `Response too large (${arrayBuffer.byteLength} > ${maxBytes} bytes)`,
    );
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    status: res.status,
  };
}
