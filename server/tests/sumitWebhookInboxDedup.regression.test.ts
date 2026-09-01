/**
 * Regression pin — SUMIT webhook uses persistent inbox dedup around activation.
 *
 * AUDIT-MONEY-4 (#229, 2026-09-01). The webhook comment claimed
 * "we dedupe on that", but no state machine existed. A SUMIT retry
 * (which is inevitable — every webhook provider retries on transient
 * network issues) could re-run activateFromVerifiedPayment on a
 * commit that had already fired downstream side-effects (loyalty,
 * notifications). This pin fires the moment someone removes the
 * inbox wrapper.
 *
 * We don't stand up a full DB in this pin — the behaviour of
 * claimEvent/markCompleted is covered by nayaxWebhookDedup's own
 * suite. Here we only assert the WIRING:
 *
 *   • sumit-webhook imports claimEvent + markCompleted from the
 *     nayax inbox module.
 *   • The activation branch calls claimEvent BEFORE
 *     activateFromVerifiedPayment.
 *   • It uses a namespaced eventId with the `sumit:` prefix so
 *     nayax and sumit event ids never collide in the shared inbox.
 *   • It handles all three claim decisions: new/retry runs
 *     activation + markCompleted, dedup skips, conflict → 409.
 *   • Fails CLOSED on inbox unavailability (500), not silently
 *     runs activation without an audit row.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const sumit = readFileSync(join(ROOT, 'server/routes/sumit-webhook.ts'), 'utf8');

describe('#229 SUMIT webhook activation inbox dedup', () => {
  it('imports claim + markCompleted + markFailedRetryable from the nayax inbox module', () => {
    // Reuses the existing state machine — no collision because the
    // eventId is namespaced.
    expect(sumit).toMatch(
      /import\s*\{[^}]*\bclaimEvent as claimInboxEvent\b[^}]*\}[\s\S]*?from\s*['"]\.\.\/lib\/nayaxWebhookDedup['"]/,
    );
    expect(sumit).toMatch(/markCompleted as markInboxCompleted/);
    expect(sumit).toMatch(/markFailedRetryable as markInboxFailedRetryable/);
  });

  it('namespaces the inbox eventId with a "sumit:" prefix', () => {
    expect(sumit).toMatch(/const\s+inboxEventId\s*=\s*`sumit:\$\{providerReference\}`/);
  });

  it('calls claimInboxEvent BEFORE activateFromVerifiedPayment', () => {
    const claimIdx = sumit.indexOf('await claimInboxEvent({');
    const activateIdx = sumit.indexOf('await activateFromVerifiedPayment({');
    expect(claimIdx).toBeGreaterThan(0);
    expect(activateIdx).toBeGreaterThan(0);
    expect(claimIdx).toBeLessThan(activateIdx);
  });

  it('handles all three claim decisions — dedup / conflict / new', () => {
    expect(sumit).toMatch(/claim\.decision\s*===\s*['"]dedup['"]/);
    expect(sumit).toMatch(/claim\.decision\s*===\s*['"]conflict['"]/);
    // 'new' or 'retry' both run activation; the else branch is the
    // active-work path. Assert markInboxCompleted fires in the success
    // path and markInboxFailedRetryable fires in the throw path.
    expect(sumit).toMatch(/await markInboxCompleted\(inboxEventId\)/);
    expect(sumit).toMatch(/await markInboxFailedRetryable\(inboxEventId,\s*['"]activation_threw['"]\)/);
  });

  it('returns 409 concurrent_delivery for the conflict decision so SUMIT retries later', () => {
    expect(sumit).toMatch(/res\.status\(409\)\.json\(\s*\{\s*ok:\s*false,\s*error:\s*['"]concurrent_delivery['"]/);
  });

  it('fails CLOSED (500 inbox_unavailable) when the inbox itself errors', () => {
    // Not `next()` and not `res.status(200)` — a broken inbox MUST NOT
    // silently allow activation without an audit row.
    expect(sumit).toMatch(/res\.status\(500\)\.json\(\s*\{\s*ok:\s*false,\s*error:\s*['"]inbox_unavailable['"]/);
  });
});
