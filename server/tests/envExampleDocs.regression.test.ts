/**
 * Issue #153 PR-ENV-DOCS — env.example documentation source pins.
 *
 * Both audit lanes (R1 + R2) flagged the same gap: env vars READ in
 * production code but ABSENT from .env.example. New deploys silently
 * disable features (META_WHATSAPP_*) or auto-create fresh sheets
 * (GOOGLE_FORMS_SPREADSHEET_ID) without operator visibility.
 *
 * This PR is docs-only — no behaviour change. The companion fail-close
 * for production (GOOGLE_FORMS_SPREADSHEET_ID required in prod) ships
 * separately as PR-SHEETS-FAIL-CLOSE.
 *
 * These pins prevent silent re-drift: if anyone removes a documented
 * env var from .env.example, CI fails before merge.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
const whatsappMeta = readFileSync(
  resolve(ROOT, 'server/services/WhatsAppMetaService.ts'),
  'utf8',
);
const whatsappWebhook = readFileSync(
  resolve(ROOT, 'server/enterprise/whatsappWebhook.ts'),
  'utf8',
);

describe('PR-ENV-DOCS .env.example coverage', () => {
  it('1. Tranzila is fully removed — TRANZILA_* keys are NOT in .env.example', () => {
    // Tranzila was ripped out (code + flags + routes + env keys). The former
    // "TRANZILA_API_KEY is documented" pin is inverted: it must be absent now.
    expect(envExample).not.toMatch(/TRANZILA_/);
  });

  it('2. META_WHATSAPP_ACCESS_TOKEN is documented (read in WhatsAppMetaService.ts)', () => {
    expect(whatsappMeta).toMatch(/process\.env\.META_WHATSAPP_ACCESS_TOKEN/);
    expect(envExample).toMatch(/^META_WHATSAPP_ACCESS_TOKEN=/m);
  });

  it('3. META_WHATSAPP_PHONE_NUMBER_ID is documented', () => {
    expect(whatsappMeta).toMatch(/process\.env\.META_WHATSAPP_PHONE_NUMBER_ID/);
    expect(envExample).toMatch(/^META_WHATSAPP_PHONE_NUMBER_ID=/m);
  });

  it('4. META_WHATSAPP_BUSINESS_PHONE is documented', () => {
    expect(whatsappMeta).toMatch(/process\.env\.META_WHATSAPP_BUSINESS_PHONE/);
    expect(envExample).toMatch(/^META_WHATSAPP_BUSINESS_PHONE=/m);
  });

  it('5. META_WEBHOOK_SECRET is documented (HMAC verify in whatsappWebhook.ts)', () => {
    expect(whatsappWebhook).toMatch(/process\.env\.META_WEBHOOK_SECRET/);
    expect(envExample).toMatch(/^META_WEBHOOK_SECRET=/m);
  });

  it('6. GOOGLE_FORMS_SPREADSHEET_ID note flags REQUIRED-in-production', () => {
    expect(envExample).toMatch(/GOOGLE_FORMS_SPREADSHEET_ID/);
    // The doc line MUST mention production explicitly so anyone reading
    // sees the prod-vs-dev divergence before deploying.
    const idx = envExample.indexOf('GOOGLE_FORMS_SPREADSHEET_ID=');
    expect(idx).toBeGreaterThan(0);
    const window_ = envExample.slice(Math.max(0, idx - 800), idx);
    expect(window_).toMatch(/REQUIRED in production/);
  });

  it('7. REDIS_URL note flags multi-instance / brute-force exposure', () => {
    expect(envExample).toMatch(/REDIS_URL/);
    const idx = envExample.indexOf('REDIS_URL=');
    expect(idx).toBeGreaterThan(0);
    const window_ = envExample.slice(Math.max(0, idx - 800), idx);
    // Must mention multi-instance / Cloud Run / brute-force / Memorystore
    // so the reader knows why in-memory fallback is unsafe in prod.
    expect(window_).toMatch(/multi-instance|Cloud Run|brute-force|Memorystore/i);
  });

  it('8. NO env-var VALUES were committed accidentally — placeholders only', () => {
    // Sanity: scan for value-shaped strings on right-hand side of newly
    // documented vars. They must be empty (= NOTHING) or obviously
    // placeholder text. Reject anything resembling JWT / API key / hex token.
    for (const name of [
      'META_WHATSAPP_ACCESS_TOKEN',
      'META_WHATSAPP_PHONE_NUMBER_ID',
      'META_WHATSAPP_BUSINESS_PHONE',
      'META_WEBHOOK_SECRET',
    ]) {
      const re = new RegExp(`^${name}=(.*)$`, 'm');
      const match = envExample.match(re);
      expect(match).toBeTruthy();
      const rhs = (match![1] ?? '').trim();
      // Reject JWT/AWS/GitHub-token/long-hex shapes
      expect(rhs).not.toMatch(/^eyJ[A-Za-z0-9_-]{10,}/);
      expect(rhs).not.toMatch(/^AKIA[0-9A-Z]{16}$/);
      expect(rhs).not.toMatch(/^ghp_[A-Za-z0-9]{20,}/);
      expect(rhs).not.toMatch(/^[a-f0-9]{32,}$/);
      expect(rhs).not.toMatch(/^[A-Za-z0-9_-]{40,}$/);
    }
  });
});
