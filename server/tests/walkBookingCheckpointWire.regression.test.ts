/**
 * Lane C.3 · JourneyCheckpoint wire on the walk booking flow
 * (post-release 2026-09-03).
 *
 * The endpoint + hook + sitter wire landed via #2198 and are already
 * covered by supertest behavioural tests. This pin locks the SAME
 * wire onto the walk-my-pet BookingFlow so a future refactor that
 * strips the hook, forgets the clear(), or accidentally saves a
 * payment-truth key fails here loudly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'pages', 'walk-my-pet', 'BookingFlow.tsx',
  ),
  'utf8',
);
const HOOK = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'hooks', 'useJourneyCheckpoint.ts',
  ),
  'utf8',
);

describe('walk-my-pet · JourneyCheckpoint wire (Lane C.3)', () => {
  it('imports useJourneyCheckpoint from the canonical hook', () => {
    // The file uses double-quoted imports; accept either quote style.
    expect(SRC).toMatch(
      /import \{ useJourneyCheckpoint \} from ["']@\/hooks\/useJourneyCheckpoint["'];/,
    );
  });

  it('calls the hook with the walk_book domain, enabled only when signed in', () => {
    expect(SRC).toMatch(
      /useJourneyCheckpoint<WalkBookCheckpointPayload>\(["']walk_book["'], \{\s*\n?\s*enabled: !!user,\s*\n?\s*\}\)/,
    );
  });

  it('hydrate effect fills fields ONLY when the user has not already touched them', () => {
    // The pattern uses `if (X === 0 && ...)` or `if (!X && ...)` — a
    // fresh navigation with a query-param intent still wins.
    expect(SRC).toMatch(/if \(selectedPetIds\.length === 0 && Array\.isArray\(p\.selectedPetIds\)\)/);
    expect(SRC).toMatch(/if \(!selectedDate && typeof p\.selectedDate === 'string'\)/);
    expect(SRC).toMatch(/if \(!notes && typeof p\.notes === 'string'\) setNotes\(p\.notes\);/);
    expect(SRC).toMatch(/if \(!pickupAddress && typeof p\.pickupAddress === 'string'\)/);
  });

  it('save effect is guarded — never fires on pending_match / confirmation, never on empty forms', () => {
    expect(SRC).toMatch(/if \(step === 'pending_match' \|\| step === 'confirmation'\) return;/);
    expect(SRC).toMatch(/nothing meaningful to save yet/);
  });

  it('save payload carries the walk-specific fields and NEVER payment-truth keys', () => {
    // The payload passed to checkpoint.save must include the resumable
    // intent fields — pinned by literal.
    expect(SRC).toMatch(
      /void checkpoint\.save\(\{[\s\S]{0,500}walkerId: walkerId \?\? undefined,[\s\S]{0,500}selectedPetIds,[\s\S]{0,300}selectedDate: selectedDate\?\.toISOString\(\),[\s\S]{0,300}duration,[\s\S]{0,300}notes,[\s\S]{0,300}pickupAddress,[\s\S]{0,300}step,[\s\S]{0,300}updatedAt:/,
    );
    // Defence-in-depth: none of the forbidden keys appear anywhere in
    // the save payload region.
    const saveRegion = SRC.match(/void checkpoint\.save\(\{[\s\S]*?\}\);/);
    expect(saveRegion).not.toBeNull();
    const region = saveRegion?.[0] ?? '';
    for (const k of ['chargeId', 'paidAt', 'refundId', 'fiscalDocumentNumber', 'settlementId']) {
      expect(region).not.toContain(k);
    }
  });

  it('successful booking POST fires checkpoint.clear() BEFORE setStep("pending_match")', () => {
    // Ordering matters — clear() must fire while step is still
    // 'summary' so the save effect (which skips on pending_match)
    // does not re-fire and re-write the checkpoint after clear.
    expect(SRC).toMatch(
      /void checkpoint\.clear\(\);\s*\n\s*\n?\s*\/\/[^\n]*\n\s*setStep\("pending_match"\);/,
    );
  });

  it('hook contract this file relies on is stable', () => {
    // The hook must expose (hydrating, initial, save, clear). If a
    // refactor changes its shape, this fails here AND in the sitter
    // wire test, forcing a coordinated update.
    expect(HOOK).toMatch(/hydrating:\s*boolean/);
    expect(HOOK).toMatch(/initial:\s*TPayload \| null/);
    expect(HOOK).toMatch(/save:\s*\(payload: TPayload\) => Promise<void>/);
    expect(HOOK).toMatch(/clear:\s*\(\) => Promise<void>/);
  });
});
