/**
 * Lane C.3 · JourneyCheckpoint wire on ProviderOnboarding (provider_apply)
 * — the sixth and final resumable journey (post-release 2026-09-03).
 *
 * Long multi-step KYC-heavy wizard. Only pre-verification text
 * choices are persisted; NEVER government-ID digits, uploaded
 * document blobs, or verification / approval status — those live
 * in the KYC vault and provider_applications table and are
 * re-fetched on resume.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'pages', 'ProviderOnboarding.tsx',
  ),
  'utf8',
);

describe('ProviderOnboarding · JourneyCheckpoint wire (Lane C.3 provider_apply)', () => {
  it('imports useJourneyCheckpoint from the canonical hook', () => {
    expect(SRC).toMatch(
      /import \{ useJourneyCheckpoint \} from ["']@\/hooks\/useJourneyCheckpoint["'];/,
    );
  });

  it('calls the hook with the provider_apply domain, enabled only when signed in', () => {
    expect(SRC).toMatch(
      /useJourneyCheckpoint<ProviderApplyCheckpointPayload>\(["']provider_apply["'], \{\s*\n?\s*enabled: !!user,\s*\n?\s*\}\)/,
    );
  });

  it('hydrate effect fills step (1-3) and providerTypes only when untouched', () => {
    expect(SRC).toMatch(/if \(typeof p\.step === 'number' && p\.step >= 1 && p\.step <= 3 && step === 1\)/);
    expect(SRC).toMatch(/if \(providerTypes\.length === 0 && Array\.isArray\(p\.providerTypes\)\)/);
    // The filter guards against a stale row that persisted a value
    // outside the enum.
    expect(SRC).toMatch(
      /\['walker', 'sitter', 'station_operator', 'driver', 'trainer'\]\.includes\(t\)/,
    );
  });

  it('save effect emits ONLY pre-verification text — no ID digits, no blobs, no approval state', () => {
    // The payload must include the small allowlist and nothing else.
    expect(SRC).toMatch(
      /void providerApplyCheckpoint\.save\(\{[\s\S]{0,600}step,[\s\S]{0,200}providerTypes,[\s\S]{0,200}firstName:[\s\S]{0,200}lastName:[\s\S]{0,200}city:[\s\S]{0,200}ageConfirmed18Plus,[\s\S]{0,200}taxStatus:[\s\S]{0,200}updatedAt:/,
    );
    const region = SRC.match(/void providerApplyCheckpoint\.save\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    // No sensitive KYC / verification / approval fields.
    for (const k of [
      'idNumber', 'idExpiry', 'idDocumentType',
      'selfiePhoto', 'governmentId', 'backgroundCheckConsent',
      'phoneOtpId', 'phoneOtpCode', 'phoneVerified',
      'applicationSubmitted', 'biometricScore', 'biometricMatchScore',
      'chargeId', 'paidAt', 'refundId',
    ]) {
      expect(region).not.toContain(k);
    }
  });

  it('save skips when the form is empty', () => {
    expect(SRC).toMatch(
      /if \(\s*providerTypes\.length === 0 && !firstName && !lastName && !city && !taxStatus\s*\)/,
    );
  });

  it('successful submit clears the checkpoint AFTER clearRequestedProviderServices — BEFORE the pending nav', () => {
    // Ordering: the sessionStorage marker is cleared first (existing
    // behaviour), then our resumable checkpoint, then the delayed
    // navigate to /provider/pending. Pin the chain.
    expect(SRC).toMatch(
      /clearRequestedProviderServices\(\);[\s\S]{0,400}void providerApplyCheckpoint\.clear\(\);[\s\S]{0,1200}navigate\('\/provider\/pending'\)/,
    );
  });
});
