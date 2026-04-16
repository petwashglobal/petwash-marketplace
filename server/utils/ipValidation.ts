/**
 * Returns true only for routable public IPv4/IPv6 addresses.
 * Rejects loopback, link-local, private, and other reserved ranges
 * to prevent SSRF via external geolocation API calls.
 */
export function isPublicIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();

  // IPv6 loopback / unspecified
  if (trimmed === '::1' || trimmed === '::' || trimmed.toLowerCase() === '0:0:0:0:0:0:0:1') return false;
  // IPv6 link-local (fe80::/10)
  if (/^fe[89ab][0-9a-f]:/i.test(trimmed)) return false;
  // IPv4-mapped IPv6 — unwrap and re-check
  const ipv4Mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) return isPublicIP(ipv4Mapped[1]);

  // Must be a valid IPv4 address from here on
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets;

  if (a === 0) return false;           // 0.0.0.0/8 — unspecified
  if (a === 10) return false;          // 10.0.0.0/8 — RFC 1918
  if (a === 127) return false;         // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return false;  // 169.254.0.0/16 — APIPA/link-local
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12 — RFC 1918
  if (a === 192 && b === 168) return false;  // 192.168.0.0/16 — RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 — CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 — benchmarking
  if (a === 203 && b === 0 && octets[2] === 113) return false; // 203.0.113.0/24 — documentation
  if (a === 192 && b === 0 && octets[2] === 2) return false;   // 192.0.2.0/24 — documentation
  if (a === 192 && b === 88 && octets[2] === 99) return false; // 192.88.99.0/24 — 6to4 relay
  if (a === 255) return false;         // 255.255.255.255 broadcast

  return true;
}
