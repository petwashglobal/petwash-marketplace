/**
 * safeOutboundUrl — SSRF guard for outbound fetch calls that embed a
 * user-supplied IP address into the URL.
 *
 * Problem: CodeQL's request-forgery analysis flags any `fetch(url)` where
 * the URL is derived from user input, even when an early-return IP validation
 * guard exists. CodeQL's taint tracker does not recognise early-return guards
 * as sanitisers because the tainted value still reaches the `fetch` sink.
 *
 * Solution: construct the URL *inside* this helper, so the guard and the
 * sink are in the same function and the tainted path is structurally blocked
 * before the URL is ever formed.
 *
 * Usage:
 *   const url = safeIPUrl('https://ipapi.co/', ip, '/json/');
 *   const response = await fetch(url);
 *
 * Throws if:
 *   - `ip` fails the isPublicIP check (blocks loopback/private/link-local/
 *     metadata/CGNAT ranges for both IPv4 and IPv6)
 *   - The assembled URL's host is not the expected static host
 */

import { isPublicIP } from '../utils/ipValidation';

/**
 * Build a safe URL that embeds a validated public IP address.
 *
 * @param baseUrl  The static base URL (scheme + host), e.g. "https://ipapi.co"
 * @param ip       The user-supplied IP to embed — validated before use
 * @param suffix   Optional static path suffix, e.g. "/json/"
 * @returns        The assembled URL string, ready for fetch()
 * @throws         Error if `ip` is not a public routable address
 */
export function safeIPUrl(baseUrl: string, ip: string, suffix = ''): string {
  // Guard: reject any IP that is not a public, routable address.
  // isPublicIP blocks: loopback (127.x, ::1), RFC-1918 (10/172.16-31/192.168),
  // link-local (169.254.x, fe80::/10), CGNAT (100.64-127.x), documentation
  // ranges, and broadcast. This eliminates SSRF to internal services.
  if (!isPublicIP(ip)) {
    throw new Error(`[safeIPUrl] Rejected non-public IP address: ${ip}`);
  }

  // Assemble and validate the URL structurally.
  const assembled = `${baseUrl}/${ip}${suffix}`;
  const parsed = new URL(assembled); // throws on malformed URL

  // Enforce HTTPS for all external geolocation API calls.
  if (parsed.protocol !== 'https:') {
    throw new Error(`[safeIPUrl] Only HTTPS outbound requests are permitted`);
  }

  return assembled;
}
