import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Nayax audit 2026-08-20 SEV-1/SEV-2 pins:
//
// 1. server/nayaxService.ts:verifyWebhookSignature must strip `sha256=` and
//    length-check before crypto.timingSafeEqual (otherwise every real signed
//    webhook throws or rejects).
// 2. server/services/NayaxOnlinePaymentService.ts:verifyWebhookSignature must
//    fail-CLOSED when NAYAX_WEBHOOK_SECRET is unset (was `return true`, a
//    silent HMAC bypass if any caller drops the route-level enforcement).
// 3. server/routes/nayax-webhooks.ts:validateNayaxSignature must read the raw
//    buffer from req.body (where express.raw() actually puts it), not from
//    the unset req.rawBody — otherwise every /nayax/terminal, /nayax/settlement
//    and /nayax/refund call silently 500'd on "Cannot validate signature".
// 4. server/routes/nayax-webhooks.ts payment/checkout-payment/booking-request-payment
//    routes must NOT re-serialise a parsed body when the raw buffer is missing —
//    a JSON.stringify() fallback is a silent HMAC-bypass trap.
// 5. server/routes/nayax-cortina.ts inbound routes must require the shared
//    NAYAX_CORTINA_SECRET_TOKEN in the body. Previously the routes were
//    guarded ONLY by the cortinaEnabled() env flag, so anyone reaching
//    /api/webhooks/nayax/cortina/settlement could trigger a real ledger DEBIT
//    against a live reservation.

const root = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('nayax audit 2026-08-20 — HMAC + Cortina inbound auth', () => {
  describe('nayaxService.ts verifyWebhookSignature', () => {
    const src = root('server/nayaxService.ts');

    it('strips the sha256= header prefix before compare', () => {
      expect(src).toMatch(/verifyWebhookSignature[\s\S]*?replace\(\s*\/\^sha256=\/[\s\S]*?providedBuf/);
    });

    it('length-checks before crypto.timingSafeEqual (never crashes on mismatch)', () => {
      expect(src).toMatch(/verifyWebhookSignature[\s\S]*?providedBuf\.length\s*===\s*expectedBuf\.length[\s\S]*?timingSafeEqual/);
    });
  });

  describe('NayaxOnlinePaymentService verifyWebhookSignature', () => {
    const src = root('server/services/NayaxOnlinePaymentService.ts');

    it('fails-CLOSED when NAYAX_WEBHOOK_SECRET is unset', () => {
      // The previous body `return true` is gone; the unset branch now returns false.
      expect(src).toMatch(/if\s*\(\s*!NAYAX_WEBHOOK_SECRET\s*\)[\s\S]{0,400}?return\s+false/);
      expect(src).not.toMatch(/if\s*\(\s*!NAYAX_WEBHOOK_SECRET\s*\)[\s\S]{0,400}?return\s+true/);
    });

    it('strips the sha256= header prefix', () => {
      expect(src).toMatch(/verifyWebhookSignature[\s\S]*?replace\(\s*\/\^sha256=\//);
    });
  });

  describe('nayax-webhooks.ts validateNayaxSignature', () => {
    const src = root('server/routes/nayax-webhooks.ts');

    it('reads the raw buffer from req.body first (express.raw puts it there), not req.rawBody', () => {
      // The corrected code prefers req.body when it's a Buffer.
      expect(src).toMatch(/Buffer\.isBuffer\(req\.body\)\s*\?\s*\(req\.body as Buffer\)\s*:\s*\(req as any\)\.rawBody/);
    });

    it('the three payment routes fail-CLOSED when raw body is missing (no JSON.stringify fallback)', () => {
      // Strip line comments so an explanatory comment mentioning the removed
      // pattern by name doesn't false-positive the "must not appear" check.
      const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(stripped).not.toMatch(/Buffer\.from\(JSON\.stringify\(req\.body\)\)/);
      // And there must be at least 3 raw_body_unavailable early-returns (one per route).
      const guards = stripped.match(/raw_body_unavailable/g) || [];
      expect(guards.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('nayax-cortina.ts inbound SecretToken enforcement', () => {
    const src = root('server/routes/nayax-cortina.ts');

    /**
     * RENAMED, NOT REMOVED — and the rename left a real hole (2026-09-12).
     *
     * This pin required `assertCortinaSecret` on all four money routes. #2396
     * replaced it: the old guard demanded `body.SecretToken`, which genuine
     * Nayax callbacks do not send, so it declined every real call. The
     * replacement `assertCortinaSession` is correct — but it was wired only to
     * the two OPENING calls, leaving /settlement, /void and /refund on
     * `cortinaEnabled()` alone, which is an env flag and not authentication.
     * That is the precise condition item 5 at the top of this file was written
     * to prevent.
     *
     * The pin was red the whole time and nobody knew: no CI job ran this file
     * until the fiscal gate began matching by pattern. So it is re-pinned to
     * the PROPERTY — every money route proves the caller knows the secret —
     * rather than to one revision's function name, which is what let a rename
     * quietly drop three routes.
     */
    it('both guards exist and derive from NAYAX_CORTINA_SECRET_TOKEN', () => {
      expect(src).toMatch(/function\s+assertCortinaSession\s*\(/);
      expect(src).toMatch(/function\s+assertCortinaCallbackOrigin\s*\(/);
      expect(src).toMatch(/process\.env\.NAYAX_CORTINA_SECRET_TOKEN/);
      expect(src).toMatch(/timingSafeEqual/);
      // Fail-closed: an unset secret refuses rather than waving the call through.
      expect(src).toMatch(/if\s*\(!secret\)[\s\S]{0,300}?cortinaDecline\(6,\s*'secret_not_configured'\)/);
    });

    it('EVERY money-touching route is guarded — opening and closing alike', () => {
      const guarded: Array<[string, RegExp]> = [
        ['authorize',  /router\.post\(\[['"]\/authorize['"][\s\S]*?assertCortinaSession\(/],
        ['sale',       /router\.post\(\[['"]\/sale['"][\s\S]*?assertCortinaSession\(/],
        ['settlement', /router\.post\(\[['"]\/settlement['"][\s\S]*?assertCortinaCallbackOrigin\(/],
        ['void',       /router\.post\(\[['"]\/void['"][\s\S]*?assertCortinaCallbackOrigin\(/],
        ['refund',     /router\.post\(\[['"]\/refund['"][\s\S]*?assertCortinaCallbackOrigin\(/],
      ];
      for (const [name, re] of guarded) expect(src, `${name} must be guarded`).toMatch(re);
      expect((src.match(/assertCortinaCallbackOrigin\(/g) || []).length).toBeGreaterThanOrEqual(4);
    });

    // The debit is the one that cannot be undone, so it gets its own pin: the
    // guard must run BEFORE the reservation is claimed, not after.
    it('settlement authenticates BEFORE it can touch a reservation', () => {
      const body = src.slice(src.indexOf("router.post(['/settlement'"));
      const guard = body.indexOf('assertCortinaCallbackOrigin(');
      const claim = body.indexOf('k9000_redemption_reservations');
      expect(guard).toBeGreaterThan(-1);
      expect(claim).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(claim);
    });

    // A closing callback arrives when the WASH ENDS. Reusing the 10-minute
    // session TTL here would decline real settlements — the #2396 failure.
    it('closing callbacks are not bound by the 10-minute session TTL', () => {
      expect(src).toMatch(/CORTINA_CALLBACK_TXN_MAX_AGE_MS\s*=\s*24 \* 60 \* 60 \* 1000/);
      expect(src).toMatch(/verifyStartSessionTransactionId\([\s\S]{0,160}?CORTINA_CALLBACK_TXN_MAX_AGE_MS/);
    });
  });
});
