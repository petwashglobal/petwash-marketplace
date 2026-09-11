/**
 * Runtime secrets the code REFUSES to run without must actually reach the
 * live Cloud Run revision.
 *
 * Audit 2026-09-12: eight keys that throw or fail closed in production
 * (secretFieldCrypto, emailService unsubscribe, unsubToken, generateQrPayload,
 * StepUpService, wallet notify-pass-update, handoffCredentials,
 * homeAccessCrypto) were NOT in the deploy's secret mapping and not on the
 * live revision — while the pre-deploy smoke test injected dummy values for
 * some of them, so nothing ever failed in CI. Result in production: any
 * national-ID save was a 500, booking confirmation / reminder / receipt
 * emails could not be built, wallet passes never refreshed after a wash,
 * step-up proofs could not be issued.
 *
 * This pin makes the three places agree: the auto-create list, the
 * required_mappings array, and cloudrun-service.yaml.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ci = readFileSync(resolve(ROOT, '.github/workflows/petwash-ci.yml'), 'utf8');
const yaml = readFileSync(resolve(ROOT, 'cloudrun-service.yaml'), 'utf8');

/** Env vars whose absence in production is a throw / fail-closed, per the source they guard. */
const FAIL_LOUD_RUNTIME_KEYS: Array<{ name: string; guard: string; pattern: RegExp }> = [
  { name: 'TREASURY_FIELD_ENCRYPTION_KEY', guard: 'server/services/secretFieldCrypto.ts', pattern: /Refusing to start/ },
  { name: 'UNSUBSCRIBE_HMAC_SECRET',       guard: 'server/emailService.ts',               pattern: /UNSUBSCRIBE_HMAC_SECRET environment variable is required in production/ },
  { name: 'EMAIL_UNSUB_SECRET',            guard: 'server/lib/unsubToken.ts',             pattern: /EMAIL_UNSUB_SECRET missing or < 32 chars/ },
  { name: 'QR_SECRET',                     guard: 'server/utils/generateQrPayload.ts',    pattern: /QR_SECRET must be set in production/ },
  { name: 'STEP_UP_HMAC_SECRET',           guard: 'server/services/StepUpService.ts',     pattern: /step-up service is CLOSED/ },
  { name: 'INTERNAL_SERVICE_SECRET',       guard: 'server/routes/wallet.ts',              pattern: /INTERNAL_SERVICE_SECRET not configured/ },
  { name: 'HANDOFF_HMAC_SECRET',           guard: 'server/services/jobPassport/handoffCredentials.ts', pattern: /HANDOFF_HMAC_SECRET is required in production/ },
  { name: 'HOME_ACCESS_ENC_KEY',           guard: 'server/lib/homeAccessCrypto.ts',       pattern: /HOME_ACCESS_ENC_KEY missing\/invalid/ },
];

describe('fail-loud runtime secrets reach the live revision', () => {
  for (const k of FAIL_LOUD_RUNTIME_KEYS) {
    describe(k.name, () => {
      it('is still a fail-loud guard in the source (otherwise drop it from this list)', () => {
        const src = readFileSync(resolve(ROOT, k.guard), 'utf8');
        expect(src).toMatch(k.pattern);
      });
      it('is auto-created by the "Ensure required GCP secrets exist" step', () => {
        expect(ci).toMatch(new RegExp(`ensure_secret "${k.name}"\\s+"\\$\\(openssl rand -hex 32\\)"`));
      });
      it('is in required_mappings (not optional — a skip would silently re-break production)', () => {
        const required = ci.slice(ci.indexOf('required_mappings=('), ci.indexOf('optional_mappings=('));
        expect(required).toContain(`"${k.name}=${k.name}:latest"`);
      });
      it('is declared in cloudrun-service.yaml', () => {
        expect(yaml).toMatch(new RegExp(`- name: ${k.name}\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+key: latest\\n\\s+name: ${k.name}`));
      });
    });
  }

  it('the auto-create step runs before the mapping step in the same job', () => {
    expect(ci.indexOf('name: Ensure required GCP secrets exist')).toBeLessThan(ci.indexOf('id: build-cloudrun-secrets'));
  });

  it('64-hex keys: the AES-256 consumers get exactly 32 random bytes as hex', () => {
    // openssl rand -hex 32 → 64 hex chars, which is what secretFieldCrypto (KEY_BYTES*2)
    // and homeAccessCrypto (/^[0-9a-fA-F]{64}$/) require.
    expect(readFileSync(resolve(ROOT, 'server/lib/homeAccessCrypto.ts'), 'utf8')).toMatch(/\[0-9a-fA-F\]\{64\}/);
  });
});

describe('Slack alerting reads the secret that is actually provisioned', () => {
  it('lib/alerts.ts falls back to ALERTS_SLACK_WEBHOOK like monitoring.ts', () => {
    const src = readFileSync(resolve(ROOT, 'server/lib/alerts.ts'), 'utf8');
    expect(src).toMatch(/process\.env\.SLACK_WEBHOOK_URL \|\| process\.env\.ALERTS_SLACK_WEBHOOK/);
  });
});
