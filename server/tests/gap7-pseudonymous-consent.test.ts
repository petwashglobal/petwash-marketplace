/**
 * Gap 7 — user_interaction_logs pseudonymous_user_id + consent_level were schema
 * columns that nothing populated. Both /track/interaction and /track/interactions
 * must now set them: a hashed (non-PII) id derived from the session, and a consent
 * level defaulting to the conservative 'none'.
 *
 * Source-introspection (the handlers are DB/session-bound in a huge routes file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

// Both tracking handlers live in this slice.
const start = src.indexOf("'/api/track/interaction'");
const region = src.slice(start, start + 4000);

describe('Gap 7 — pseudonymous + consent populated on tracking', () => {
  it('sets a hashed pseudonymousUserId (never the raw uid)', () => {
    // single writer uses assignment (`x.pseudonymousUserId = crypto...`),
    // batch writer uses object literal (`pseudonymousUserId: crypto...`).
    const count = (region.match(/pseudonymousUserId[:=\s]+\s*crypto\.createHash\('sha256'\)/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('sets consentLevel, defaulting to the conservative "none"', () => {
    expect(region).toMatch(/consentLevel:/);
    expect(region).toMatch(/'none'/);
  });

  it('does not seed the pseudonymous id from the raw firebase uid', () => {
    expect(region).not.toMatch(/update\(`uil:\$\{[^}]*firebaseUid/);
  });
});
