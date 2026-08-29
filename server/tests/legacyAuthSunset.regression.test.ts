/**
 * CEO FLY MODE II §23 + §25 (2026-08-29) — legacy auth sunset pins.
 *
 * §23 (TikTok OAuth duplicate) — pins the beacon on both legacy
 *   /api/auth/tiktok/{start,callback} handlers so on-call can see
 *   whether TikTok is still delivering codes to the legacy path
 *   vs the canonical /api/auth/social/tiktok/*. NO retirement here
 *   — CEO forbids 410 until external console + telemetry confirm.
 *
 * §25 (customAuth surgical delete) — pins:
 *   • setupCustomAuth() is gone from server/customAuth.ts (proven
 *     dead: zero mounts across the whole server tree);
 *   • requireAuth() remains exported (live code depends on it);
 *   • no route registration (`app.post|get|patch|use`) remains in
 *     the file — the installer block is empty.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

const CUSTOM_AUTH = fs.readFileSync(
  path.resolve(__dirname, '..', 'customAuth.ts'),
  'utf8',
);

describe('CEO FLY MODE II §23 — TikTok legacy-duplicate observability', () => {
  it('/api/auth/tiktok/start records deprecation beacon on every hit', () => {
    const startIdx = ROUTES.indexOf("app.get('/api/auth/tiktok/start'");
    expect(startIdx).toBeGreaterThan(0);
    // The beacon call must sit within the first 400 chars of the
    // handler — a retrofit that runs it after the crypto work
    // defeats the point (telemetry stops firing on error paths).
    const block = ROUTES.slice(startIdx, startIdx + 400);
    expect(block).toMatch(
      /recordDeprecationHit\(req, '\/api\/auth\/tiktok\/start:legacy-duplicate'\)/,
    );
  });

  it('/api/auth/tiktok/callback records the same beacon', () => {
    const cbIdx = ROUTES.indexOf("app.get('/api/auth/tiktok/callback'");
    expect(cbIdx).toBeGreaterThan(0);
    const block = ROUTES.slice(cbIdx, cbIdx + 500);
    expect(block).toMatch(
      /recordDeprecationHit\(req, '\/api\/auth\/tiktok\/callback:legacy-duplicate'\)/,
    );
  });

  it('carries the §23 rationale — no 410 until external + telemetry confirm', () => {
    // Preamble comment before the /start handler must say: canonical
    // twin at /api/auth/social/tiktok/*, do not retire until TikTok
    // console + beacon zero.
    const idx = ROUTES.indexOf("app.get('/api/auth/tiktok/start'");
    const preface = ROUTES.slice(Math.max(0, idx - 900), idx);
    expect(preface).toMatch(/§23/);
    expect(preface).toMatch(/api\/auth\/social\/tiktok/);
    expect(preface).toMatch(/TikTok Developer console/);
  });
});

describe('CEO FLY MODE II §25 — customAuth surgical delete', () => {
  it('setupCustomAuth is DELETED — no function definition remains', () => {
    expect(CUSTOM_AUTH).not.toMatch(/export function setupCustomAuth/);
    expect(CUSTOM_AUTH).not.toMatch(/^function setupCustomAuth/m);
  });

  it('requireAuth REMAINS exported (live code depends on it)', () => {
    expect(CUSTOM_AUTH).toMatch(/export async function requireAuth/);
  });

  it('no route registration remains — the installer is gone', () => {
    // Any `app.<verb>(...)` line means a leftover installer body.
    expect(CUSTOM_AUTH).not.toMatch(/\bapp\.(get|post|patch|put|delete|use)\(/);
  });

  it('the §25 rationale comment is preserved so a refactor cannot re-add the installer silently', () => {
    expect(CUSTOM_AUTH).toMatch(/§25/);
    expect(CUSTOM_AUTH).toMatch(/never mounted/);
    expect(CUSTOM_AUTH).toMatch(/requireAuth/);
  });

  it('the file exports EXACTLY one identifier — requireAuth', () => {
    const exports = CUSTOM_AUTH.match(/^export\s+(async\s+)?(function|const|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm) || [];
    expect(exports.length).toBe(1);
    expect(exports[0]).toMatch(/requireAuth/);
  });
});
