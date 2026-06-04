/**
 * tests/unit/safeOutboundUrl.test.ts
 *
 * Unit tests for the safeIPUrl SSRF guard helper.
 * Ensures private/reserved IPs are blocked and legitimate public IPs pass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeIPUrl, safeIPFetch } from '../../server/lib/safeOutboundUrl';

const BASE = 'https://ipapi.co';

describe('safeIPUrl — SSRF guard', () => {

  // ── Legitimate public IPs ─────────────────────────────────────────────────

  it('allows a legitimate public IPv4 address', () => {
    const url = safeIPUrl(BASE, '8.8.8.8', '/json/');
    expect(url).toBe('https://ipapi.co/8.8.8.8/json/');
  });

  it('allows a different legitimate public IPv4 address', () => {
    const url = safeIPUrl(BASE, '1.1.1.1', '/json/');
    expect(url).toBe('https://ipapi.co/1.1.1.1/json/');
  });

  it('allows no suffix (defaults to empty string)', () => {
    const url = safeIPUrl('https://ip-api.com/json', '8.8.8.8');
    expect(url).toBe('https://ip-api.com/json/8.8.8.8');
  });

  // ── Loopback ──────────────────────────────────────────────────────────────

  it('blocks IPv4 loopback 127.0.0.1', () => {
    expect(() => safeIPUrl(BASE, '127.0.0.1', '/json/')).toThrow('non-public IP');
  });

  it('blocks IPv4 loopback 127.0.0.2', () => {
    expect(() => safeIPUrl(BASE, '127.0.0.2', '/json/')).toThrow('non-public IP');
  });

  it('blocks IPv6 loopback ::1', () => {
    expect(() => safeIPUrl(BASE, '::1', '/json/')).toThrow('non-public IP');
  });

  // ── RFC-1918 private ranges ───────────────────────────────────────────────

  it('blocks 10.x.x.x private range', () => {
    expect(() => safeIPUrl(BASE, '10.0.0.1', '/json/')).toThrow('non-public IP');
  });

  it('blocks 172.16.x.x private range', () => {
    expect(() => safeIPUrl(BASE, '172.16.0.1', '/json/')).toThrow('non-public IP');
  });

  it('blocks 172.31.x.x private range', () => {
    expect(() => safeIPUrl(BASE, '172.31.255.255', '/json/')).toThrow('non-public IP');
  });

  it('blocks 192.168.x.x private range', () => {
    expect(() => safeIPUrl(BASE, '192.168.1.1', '/json/')).toThrow('non-public IP');
  });

  // ── Link-local / metadata ─────────────────────────────────────────────────

  it('blocks 169.254.x.x link-local (AWS/GCP metadata)', () => {
    expect(() => safeIPUrl(BASE, '169.254.169.254', '/json/')).toThrow('non-public IP');
  });

  it('blocks 169.254.0.1 link-local', () => {
    expect(() => safeIPUrl(BASE, '169.254.0.1', '/json/')).toThrow('non-public IP');
  });

  // ── CGNAT ─────────────────────────────────────────────────────────────────

  it('blocks 100.64.x.x CGNAT range', () => {
    expect(() => safeIPUrl(BASE, '100.64.0.1', '/json/')).toThrow('non-public IP');
  });

  // ── Non-HTTPS ─────────────────────────────────────────────────────────────

  it('blocks HTTP (non-HTTPS) base URLs', () => {
    expect(() => safeIPUrl('http://ipapi.co', '8.8.8.8', '/json/')).toThrow('Only HTTPS');
  });

  // ── Empty / invalid input ─────────────────────────────────────────────────

  it('blocks empty string IP', () => {
    expect(() => safeIPUrl(BASE, '', '/json/')).toThrow('non-public IP');
  });

  it('blocks a non-IP string (hostname injection attempt)', () => {
    // e.g. attacker passes "evil.example.com" as the IP field
    expect(() => safeIPUrl(BASE, 'evil.example.com', '/json/')).toThrow('non-public IP');
  });

  it('blocks an IP with a path traversal attempt', () => {
    // e.g. "8.8.8.8/../../../etc/passwd" — isPublicIP rejects non-dotted-quad
    expect(() => safeIPUrl(BASE, '8.8.8.8/../../../etc/passwd', '/json/')).toThrow('non-public IP');
  });
});

describe('safeIPFetch — SSRF-safe fetch (host pinned, guard + sink in one fn)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as any));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the pinned host for a legitimate public IP', async () => {
    await safeIPFetch(BASE, '8.8.8.8', '/json/');
    expect(fetch).toHaveBeenCalledTimes(1);
    const target = (fetch as any).mock.calls[0][0];
    expect(String(target)).toBe('https://ipapi.co/8.8.8.8/json/');
  });

  it('forwards the init (e.g. AbortSignal) to fetch', async () => {
    const controller = new AbortController();
    await safeIPFetch(BASE, '1.1.1.1', '/json/', { signal: controller.signal });
    expect((fetch as any).mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it('rejects a private IP before any fetch happens', async () => {
    await expect(safeIPFetch(BASE, '10.0.0.1', '/json/')).rejects.toThrow('non-public IP');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects the cloud-metadata IP before any fetch happens', async () => {
    await expect(safeIPFetch(BASE, '169.254.169.254', '/json/')).rejects.toThrow('non-public IP');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-HTTPS base before any fetch happens', async () => {
    await expect(safeIPFetch('http://ipapi.co', '8.8.8.8', '/json/')).rejects.toThrow('Only HTTPS');
    expect(fetch).not.toHaveBeenCalled();
  });
});
