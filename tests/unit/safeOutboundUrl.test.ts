/**
 * tests/unit/safeOutboundUrl.test.ts
 *
 * Unit tests for the safeIPUrl SSRF guard helper.
 * Ensures private/reserved IPs are blocked and legitimate public IPs pass.
 */
import { describe, it, expect } from 'vitest';
import { safeIPUrl } from '../../server/lib/safeOutboundUrl';

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
