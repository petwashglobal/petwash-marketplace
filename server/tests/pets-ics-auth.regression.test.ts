/**
 * Issue #153 Mission-3 PR-2 — ICS endpoint auth regression pin.
 *
 * BEFORE this fix:
 *   `server/routes/pets.ts:421` mounted GET /api/pets/:petId/health-events/
 *   :eventId/ics with NO middleware. The header comment literally said
 *   "public, no auth (share-friendly)". The handler accepted `uid` from the
 *   query string and returned an iCal payload from the private Firestore
 *   path `users/${uid}/pets/${petId}/health_events/${eventId}` containing
 *   the pet's name and the medical event's title/date. Any caller who
 *   guessed a Firebase UID + petId + eventId combination could pull
 *   private medical-event data. UIDs are not secret (they leak in URLs,
 *   responses, referrer headers, logs).
 *
 *   The Money Brain Audit (issue #153, comment 4400506165) verified zero
 *   legitimate non-authenticated callers: the only client caller, at
 *   `client/src/pages/Pets.tsx:262`, was an authenticated page that
 *   already had a Firebase Bearer token in scope and was sending the UID
 *   redundantly through the URL.
 *
 * AFTER this fix:
 *   • Server route is mounted with `validateFirebaseToken` middleware,
 *     same as every other handler in the same file.
 *   • UID is read from the verified token (`req.firebaseUser!.uid`),
 *     never from the query string. The handler no longer references
 *     `req.query.uid` at all.
 *   • The pre-existing dead `firestore.collectionGroup('health_events')`
 *     probe (which never used its result) is removed.
 *   • Client `client/src/pages/Pets.tsx` no longer puts `?uid=` in the URL.
 *     It downloads the ICS via authenticated fetch + blob URL, attaching
 *     `Authorization: Bearer ${authToken}` so the iPhone "Add to Calendar"
 *     flow keeps working without the medical-data leak.
 *
 * This source-pin test fails if any of the seven guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const PETS_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'pets.ts'),
  'utf8',
);
const CLIENT_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'Pets.tsx'),
  'utf8',
);

describe('Issue #153 Mission-3 PR-2 — ICS endpoint auth (server)', () => {
  it('mounts the ICS route with validateFirebaseToken middleware', () => {
    expect(PETS_SRC).toMatch(
      /router\.get\(\s*['"]\/:petId\/health-events\/:eventId\/ics['"]\s*,\s*validateFirebaseToken\s*,/,
    );
  });

  it('reads uid from the verified Firebase token, not the query string', () => {
    // The handler must take the UID from req.firebaseUser.uid. The phrase
    // `req.query.uid` MUST NOT appear anywhere in the file — regression
    // protection if a future PR re-introduces it.
    const icsBlock =
      PETS_SRC.match(
        /router\.get\(\s*['"]\/:petId\/health-events\/:eventId\/ics['"][\s\S]{0,1500}^\}\);/m,
      )?.[0] ?? '';
    expect(icsBlock).toMatch(/const\s+uid\s*=\s*req\.firebaseUser!\.uid/);
    expect(PETS_SRC).not.toMatch(/req\.query\.uid/);
  });

  it('removes the obsolete "public, no auth" comment', () => {
    expect(PETS_SRC).not.toMatch(/public,\s*no\s*auth/);
    // Replacement comment records the fix rationale:
    expect(PETS_SRC).toMatch(/Issue #153 Mission-3 PR-2/);
  });

  it('removes the dead collectionGroup probe', () => {
    // The pre-fix code did a `firestore.collectionGroup('health_events')`
    // query whose result was never consumed. It must be gone.
    expect(PETS_SRC).not.toMatch(/collectionGroup\(['"]health_events['"]\)/);
    expect(PETS_SRC).not.toMatch(/firestore\.collection\(['"]placeholder['"]\)/);
  });

  it('preserves validateFirebaseToken on every other pet route (regression)', () => {
    // Every router handler in pets.ts that mutates or reads private data
    // must still be Bearer-gated. Pin the canonical 12 handlers.
    const expected = [
      `router.get('/', validateFirebaseToken`,
      `router.get('/:petId', validateFirebaseToken`,
      `router.post('/', validateFirebaseToken`,
      `router.patch('/:petId', validateFirebaseToken`,
      `router.delete('/:petId', validateFirebaseToken`,
      `router.get('/admin/all', validateFirebaseToken, isAdmin`,
      `router.post('/intake-form', validateFirebaseToken`,
      `router.get('/intake-forms', validateFirebaseToken`,
      `router.get('/:petId/health-events', validateFirebaseToken`,
      `router.post('/:petId/health-events', validateFirebaseToken`,
      `router.delete('/:petId/health-events/:eventId', validateFirebaseToken`,
    ];
    for (const sig of expected) {
      expect(PETS_SRC).toContain(sig);
    }
  });
});

describe('Issue #153 Mission-3 PR-2 — ICS endpoint auth (client)', () => {
  it('drops the ?uid= query parameter from the ICS URL', () => {
    // The pre-fix shape was:
    //   `/api/pets/${petId}/health-events/${ev.id}/ics?uid=${userId || ''}`
    // No occurrence of `?uid=` may remain anywhere in Pets.tsx.
    expect(CLIENT_SRC).not.toMatch(/health-events\/[^"'`]+\/ics\?uid=/);
    expect(CLIENT_SRC).not.toMatch(/ics\?uid=\$\{userId/);
  });

  it('downloads the ICS via authenticated fetch with Authorization: Bearer', () => {
    // The new pattern fetches the URL with a Bearer header, gets a blob,
    // builds a blob URL, and triggers a synthetic anchor click. Pin the
    // critical lines so a future PR cannot regress to a bare <a href>.
    expect(CLIENT_SRC).toMatch(
      /fetch\(\s*[`'"][^`'"]*\/api\/pets\/\$\{petId\}\/health-events\/\$\{ev\.id\}\/ics[`'"]/,
    );
    expect(CLIENT_SRC).toMatch(
      /Authorization:\s*`Bearer \$\{authToken\}`/,
    );
    expect(CLIENT_SRC).toMatch(/URL\.createObjectURL\(blob\)/);
    expect(CLIENT_SRC).toMatch(/URL\.revokeObjectURL\(blobUrl\)/);
  });

  it('replaces the <a href={icsUrl}> anchor with a button that triggers the download', () => {
    // Specifically: there must be a button with data-testid starting
    // "button-download-ics-" so e2e tests can target it. There must NOT
    // be a bare <a href={icsUrl} download={...}> anchor anymore (that
    // pattern leaked URLs into referrer headers).
    expect(CLIENT_SRC).toMatch(/data-testid=\{`button-download-ics-\$\{ev\.id\}`\}/);
    expect(CLIENT_SRC).not.toMatch(/<a\s+href=\{icsUrl\}/);
    expect(CLIENT_SRC).not.toMatch(/const\s+icsUrl\s*=/);
  });
});
