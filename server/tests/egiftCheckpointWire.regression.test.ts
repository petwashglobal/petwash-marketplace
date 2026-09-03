/**
 * Lane C.3 · JourneyCheckpoint wire on the BuyGiftCard flow
 * (post-release 2026-09-03).
 *
 * Fifth of six resumable customer journeys. BuyGiftCard is a
 * single-page form for a gift purchase; submit navigates the
 * browser to SUMIT's hosted page after POST /api/egift/guest/start.
 *
 * The endpoint + hook are already exercised behaviourally by
 * server/tests/journeyCheckpointsRoute.behavior.test.ts. This pin
 * locks the egift-specific wire — the wizard details for HE + EN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'pages', 'BuyGiftCard.tsx',
  ),
  'utf8',
);

describe('BuyGiftCard · JourneyCheckpoint wire (Lane C.3 egift)', () => {
  it('imports useJourneyCheckpoint from the canonical hook', () => {
    expect(SRC).toMatch(
      /import \{ useJourneyCheckpoint \} from ["']@\/hooks\/useJourneyCheckpoint["'];/,
    );
  });

  it('imports useFirebaseAuth so the enabled:!!user guard works on the guest surface', () => {
    // The endpoint /api/egift/guest/start allows anonymous buyers, but
    // the checkpoint save endpoint requires validateFirebaseToken — a
    // signed-out browser would 401 on every save. Gating on !!user
    // keeps guests fully functional (form state only) while signed-in
    // users get the resume-hint.
    expect(SRC).toMatch(
      /import \{ useFirebaseAuth \} from ["']@\/auth\/AuthProvider["'];/,
    );
    expect(SRC).toMatch(/const \{ user \} = useFirebaseAuth\(\);/);
  });

  it('calls the hook with the egift domain, enabled only when signed in', () => {
    expect(SRC).toMatch(
      /useJourneyCheckpoint<EgiftCheckpointPayload>\(["']egift["'], \{\s*\n?\s*enabled: !!user,\s*\n?\s*\}\)/,
    );
  });

  it('hydrate effect fills fields ONLY when the user has not already typed', () => {
    // The hydrate pattern is `prev.<field> || (typeof p.<field> === 'string' ? p.<field> : '')`
    // so a user who has typed anything wins over the saved draft.
    expect(SRC).toMatch(/senderName:\s+prev\.senderName\s+\|\| \(typeof p\.senderName === 'string' \? p\.senderName : ''\)/);
    expect(SRC).toMatch(/senderEmail:\s+prev\.senderEmail\s+\|\| \(typeof p\.senderEmail === 'string' \? p\.senderEmail : ''\)/);
    expect(SRC).toMatch(/recipientName:\s+prev\.recipientName\s+\|\| \(typeof p\.recipientName === 'string' \? p\.recipientName : ''\)/);
    expect(SRC).toMatch(/recipientEmail:\s+prev\.recipientEmail\s+\|\| \(typeof p\.recipientEmail === 'string' \? p\.recipientEmail : ''\)/);
    expect(SRC).toMatch(/amount:\s+prev\.amount\s+\|\| \(typeof p\.amount === 'string' \? p\.amount : ''\)/);
    expect(SRC).toMatch(/message:\s+prev\.message\s+\|\| \(typeof p\.message === 'string' \? p\.message : ''\)/);
  });

  it('save effect skips while loading (SUMIT redirect in flight) and on empty forms', () => {
    expect(SRC).toMatch(/if \(loading\) return;/);
    expect(SRC).toMatch(/nothing meaningful yet/);
  });

  it('save payload carries only resumable intent — NEVER payment or fiscal truth', () => {
    // Pin the exact payload keys we save.
    expect(SRC).toMatch(
      /void checkpoint\.save\(\{[\s\S]{0,900}senderName:[\s\S]{0,200}senderEmail:[\s\S]{0,200}recipientName:[\s\S]{0,200}recipientEmail:[\s\S]{0,200}recipientPhone:[\s\S]{0,200}amount:[\s\S]{0,200}message:[\s\S]{0,200}deliveryDate:[\s\S]{0,200}updatedAt:/,
    );
    // Widest save region — no forbidden keys anywhere.
    const region = SRC.match(/void checkpoint\.save\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    for (const k of [
      'chargeId', 'paidAt', 'refundId', 'fiscalDocumentNumber',
      'settlementId', 'transactionId', 'redirectUrl', 'paymentUrl',
      'voucherCode', 'eGiftId',
    ]) {
      expect(region).not.toContain(k);
    }
  });

  it('checkpoint.clear() fires BEFORE window.location.href — the redirect terminates JS context', () => {
    // Pin ordering: `void checkpoint.clear();` must appear
    // immediately before `window.location.href = url`.
    expect(SRC).toMatch(
      /void checkpoint\.clear\(\);\s*\n\s*window\.location\.href = url;/,
    );
  });
});
