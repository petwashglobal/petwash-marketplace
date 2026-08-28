/**
 * CEO §73 #17 (2026-08-28) — multi-service approval.
 *
 * The /apply path already fans queue rows out per selected service, so
 * a walker+sitter+trainer applicant lands on three admin platform
 * queues. Until this commit the /admin/applications/approve endpoint
 * derived platformId from application.providerType SCALAR only —
 * approving that applicant inserted a `providers` row on walk_my_pet
 * and left sitter_suite / academy silently empty. The applicant's
 * sitter side was pending forever with nothing behind it.
 *
 * Fix: read internal_notes.providerTypes[] (the same source the queue
 * fan-out uses) and INSERT a providers row per selected platform,
 * idempotent via ON CONFLICT DO NOTHING. Falls back to the primary
 * scalar for pre-multi-service rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('provider approve inserts providers-row per selected service (CEO §73 #17)', () => {
  it('reads providerTypes[] out of internal_notes with a scalar fallback', () => {
    // Same source the queue fan-out at /apply uses — so the same
    // list drives both "which queues does this land on" and "which
    // platforms does approval unlock".
    expect(SRC).toMatch(/const applicantTypes: string\[\]/);
    expect(SRC).toMatch(/JSON\.parse\(\(application as any\)\.internalNotes\)/);
    expect(SRC).toMatch(/Array\.isArray\(notes\?\.providerTypes\)/);
    // Fallback to application.providerType when the internal_notes
    // blob is absent (pre-multi-service rows). Never crash.
    expect(SRC).toMatch(/return clean\.length \? clean : \[application\.providerType\]/);
  });

  it('maps each selected type through providerTypeToPlatformId and de-dupes', () => {
    expect(SRC).toMatch(/const platformIds = Array\.from\(new Set\(/);
    expect(SRC).toMatch(/applicantTypes\.map\(\(t\) => providerTypeToPlatformId\[t\]\)\.filter\(Boolean\)/);
  });

  it('inserts one providers row per platformId (for-of loop, not a single INSERT)', () => {
    // Anchor the approve block: everything after this label was rewritten
    // to the multi-service shape. A regression that reverts to a single
    // INSERT will drop the loop and trip this assertion.
    const approveIdx = SRC.indexOf("CEO §73 #17 (2026-08-28): MULTI-SERVICE APPROVAL");
    expect(approveIdx).toBeGreaterThan(0);
    const window = SRC.slice(approveIdx, approveIdx + 4000);
    expect(window).toMatch(/for \(const platformId of platformIds\)/);
    expect(window).toMatch(/INSERT INTO providers/);
    expect(window).toMatch(/ON CONFLICT DO NOTHING/);
  });

  it('logs a warn (not an error) when no selected type maps to a platform', () => {
    // The old code silently no-op'd when platformId was missing.
    // Multi-service shape still logs — but includes the full
    // applicantTypes list so ops can see what the reviewer tried.
    expect(SRC).toMatch(/No platformId mapping for any selected providerType/);
    expect(SRC).toMatch(/applicantTypes/);
  });
});
