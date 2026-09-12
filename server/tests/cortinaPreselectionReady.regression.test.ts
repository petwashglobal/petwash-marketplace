/**
 * Cortina External Prepaid — activation-readiness pins (2026-09-12).
 *
 * Re-read against devzone.nayax.com (Cortina → Prepaid Card → flows / Sale /
 * Authorization / Settlement / Void / Cancel / Sale End Notification, and
 * Start Session → Authentication Process). Each pin below is a defect that
 * WOULD have declined every real callback on the day Nayax switched us on:
 *
 *   1. the router had no JSON body parser while server/index.ts skips the
 *      global one for /api/webhooks/nayax/ → req.body undefined on every call;
 *   2. every handler demanded body.SecretToken — the spec never sends it
 *      (the secret is only the AES key for StartSession) → 401 on every call;
 *   3. /Sale (the ONLY money call in PreSelection) merely reserved, and the
 *      debit was bolted onto the OPTIONAL /SaleEndNotification → free washes;
 *   4. /SaleEndNotification carries no MachineInfo → the shared handler's bay
 *      lookup failed → a reporting ACK was answered Declined;
 *   5. no /StartSession route, so no TransactionId validation at all;
 *   6. decline code 50 does not exist in the Prepaid list.
 *
 * Source-introspection pins + behavioural tests for the stateless
 * StartSession TransactionId. No live Nayax needed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  issueStartSessionTransactionId,
  verifyStartSessionTransactionId,
  encryptStartSession,
  START_SESSION_TXN_TTL_MS,
} from '../lib/cortinaStartSession';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/nayax-cortina.ts'), 'utf8');
const indexSrc = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');

const SECRET = 'mrV3U3nsgGFrE3w5-wnBo_WCLPce-pZ1awRvTVTkungMIKThTVbj_fiXdfoGclhn0'; // Nayax worked-example token (64 chars)

describe('Cortina router parses its own JSON body', () => {
  it('server/index.ts skips the global parser for /api/webhooks/nayax/ — so the router must parse', () => {
    expect(indexSrc).toMatch(/req\.path\.startsWith\('\/api\/webhooks\/nayax\/'\)/);
    expect(src).toMatch(/router\.use\(express\.json\(/);
  });
});

describe('Callback authentication follows the spec', () => {
  it('never REQUIRES a SecretToken in the body (the secret is only the AES key)', () => {
    expect(src).not.toMatch(/assertCortinaSecret\(/);
    expect(src).not.toMatch(/StatusMessage: 'secret_not_configured' \} \}/); // old fail-closed-on-missing-echo shape
    // An echoed WRONG token is still refused — optional, never mandatory.
    expect(src).toMatch(/if \(echoed !== undefined\)[^]*cortinaDecline\(5, 'bad_secret'\)/);
  });

  it('mounts /Cortina/StartSession and answers {TranIDCipher, Status}', () => {
    expect(src).toMatch(/router\.post\(\['\/StartSession', '\/start-session', '\/Cortina\/StartSession'\]/);
    expect(src).toMatch(/random\.length !== 27/);                      // spec: 27-char RandomNumber
    expect(src).toMatch(/issueStartSessionTransactionId\(secret\)/);
    expect(src).toMatch(/encryptStartSession\(\{ secretToken: secret, transactionId, randomString: random \}\)/);
    expect(src).toMatch(/return res\.json\(\{ TranIDCipher, Status: \{ Verdict: 'Approved'/);
  });

  it('/Authorization and /Sale validate the StartSession TransactionId (≤10 min) unless explicitly disabled', () => {
    expect(src).toMatch(/function startSessionRequired\(\)[^]*CORTINA_REQUIRE_START_SESSION \|\| 'true'/);
    expect(src).toMatch(/verifyStartSessionTransactionId\(secret, parsed\.transactionId \|\| ''\)/);
    expect(src).toMatch(/cortinaDecline\(996, `transaction_id_\$\{v\.reason\}`\)/);
    // Both transaction-starting handlers call it; Settlement/Void/Cancel/Refund are keyed to existing rows instead.
    const authBlock = src.slice(src.indexOf("'/Cortina/PrePaid/Authorization'"), src.indexOf("'/Cortina/PrePaid/Sale'"));
    const saleBlock = src.slice(src.indexOf("'/Cortina/PrePaid/Sale'"), src.indexOf("'/Cortina/PrePaid/Settlement'"));
    expect(authBlock).toMatch(/assertCortinaSession\(parsed, req\.body\)/);
    expect(saleBlock).toMatch(/assertCortinaSession\(parsed, req\.body\)/);
  });

  it('applies a fail-closed Nayax IP allowlist to every Cortina route (IL production + QA by default, env-overridable)', () => {
    expect(src).toMatch(/router\.use\(createIPAllowlist\('NAYAX_CORTINA_ALLOWED_IPS', 'Cortina'\)\)/);
    expect(src).toMatch(/185\.159\.232\.2/);
    expect(src).toMatch(/31\.154\.55\.2/);
    // The allowlist middleware is registered BEFORE the first handler.
    expect(src.indexOf("createIPAllowlist('NAYAX_CORTINA_ALLOWED_IPS'")).toBeLessThan(src.indexOf("router.post(['/StartSession'"));
  });
});

describe('PreSelection money flow', () => {
  const saleBlock = src.slice(src.indexOf("'/Cortina/PrePaid/Sale'"), src.indexOf("'/Cortina/PrePaid/Settlement'"));
  const saleEndBlock = src.slice(src.indexOf("'/Cortina/SaleEndNotification'"), src.indexOf("'/Cortina/PrePaid/Void'"));

  it('/Sale is its own handler (not an alias of /Authorization) and DEBITS in the same request', () => {
    expect(src).toMatch(/router\.post\(\['\/sale', '\/Sale', '\/Cortina\/PrePaid\/Sale', '\/staticqr\/sale'\]/);
    expect(src).not.toMatch(/\['\/authorize', '\/sale'/);           // the old shared reserve-only handler
    expect(saleBlock).toMatch(/INSERT INTO k9000_redemption_reservations/);
    expect(saleBlock).toMatch(/SET status='committed', committed_at=NOW\(\)[^]*WHERE id=\$1 AND status='reserved'/);
    expect(saleBlock).toMatch(/await authorizeRedemption\(\{[^]*userId: resv\.user_id/);
    expect(saleBlock).toMatch(/SET status='cancelled'/);            // debit failure rolls the row back
  });

  it('/Sale is exactly-once on the Nayax TransactionId (inbox + idempotency key), replay → Approved without re-debit', () => {
    expect(saleBlock).toMatch(/`cortina-sale:\$\{terminalId\}:\$\{transactionId\}`/);
    expect(saleBlock).toMatch(/`cortina:\$\{terminalId\}:\$\{transactionId\}`/);
    expect(saleBlock).toMatch(/status === 'committed'\)[^]*replay: true/);
    expect(saleBlock).toMatch(/violatedConstraint\(e\) === 'uq_k9res_idempotency'/);
    expect(saleBlock).toMatch(/if \(!terminalId \|\| !code \|\| !transactionId\) return res\.json\(cortinaDecline\(997/);
  });

  it('/SaleEndNotification is a separate handler: no bay lookup, no debit, always Approved', () => {
    expect(src).toMatch(/router\.post\(\['\/sale-end-notification', '\/saleend', '\/SaleEndNotification', '\/Cortina\/SaleEndNotification'/);
    expect(saleEndBlock).not.toMatch(/resolveBay\(/);
    expect(saleEndBlock).not.toMatch(/authorizeRedemption\(/);
    expect(saleEndBlock).not.toMatch(/SET status='committed'/);   // may READ committed rows, never write them
    expect(saleEndBlock).toMatch(/return res\.json\(cortinaApprove\(\{ acknowledged: true \}\)\)/);
    // And Settlement no longer answers the SaleEnd aliases.
    expect(src).toMatch(/router\.post\(\['\/settlement', '\/Settlement', '\/Cortina\/PrePaid\/Settlement', '\/staticqr\/settlement'\]/);
  });

  it('Void/Cancel of a FRESH debited Sale auto-compensates through the audited path, older ones go to the operator queue', () => {
    const voidBlock = src.slice(src.indexOf("'/Cortina/PrePaid/Void'"), src.indexOf("'/Cortina/PrePaid/Refund'"));
    expect(voidBlock).toMatch(/fresh_commit/);
    expect(voidBlock).toMatch(/AUTO_COMPENSATE_WINDOW_MINUTES/);
    expect(voidBlock).toMatch(/await autoCompensateSession\(r\.session_id\)/);
    expect(voidBlock).toMatch(/'info', 'resolved'/);                  // auto-compensated → info row
    expect(voidBlock).toMatch(/'critical', 'open'/);                  // everything else → operator
    expect(voidBlock).not.toMatch(/washPackageCredits|cashWalletBalanceCents|egiftBalanceCents/); // no inline refund math
  });

  it('approvals carry PaymentInfo.SrvTranId and Balance; declines carry CustomDeclineCode; Amount is treated as major units', () => {
    expect(src).toMatch(/PaymentInfo: \{ SrvTranId: opts\.srvTranId \}/);
    expect(src).toMatch(/RegularCreditType: 0, RegularCredit: r\.remainingBalance/);
    expect(src).toMatch(/RegularCreditType: 1, RegularCredit: Math\.round\(r\.remainingBalance\) \/ 100/);
    expect(src).toMatch(/CustomDeclineCode: reason/);
    expect(src).toMatch(/MAJOR units/);
    expect(src).not.toMatch(/vended\?: boolean|vended === false|b\.Vended/); // dead Vended/Success flag removed
  });

  it('registers the exact URL suffixes Nayax appends to the integrator base', () => {
    for (const p of ['/Cortina/StartSession', '/Cortina/PrePaid/Authorization', '/Cortina/PrePaid/Sale',
                     '/Cortina/PrePaid/Settlement', '/Cortina/PrePaid/Void', '/Cortina/PrePaid/Cancel',
                     '/Cortina/PrePaid/Refund', '/Cortina/SaleEndNotification']) {
      expect(src).toContain(`'${p}'`);
    }
  });
});

describe('Stateless StartSession TransactionId', () => {
  it('is 36 numeric chars and verifies with the same secret', () => {
    const id = issueStartSessionTransactionId(SECRET, 1_800_000_000_000);
    expect(id).toMatch(/^\d{36}$/);
    const v = verifyStartSessionTransactionId(SECRET, id, 1_800_000_000_000 + 5_000);
    expect(v.ok).toBe(true);
  });

  it('two ids minted in the same second differ (nonce)', () => {
    const a = issueStartSessionTransactionId(SECRET, 1_800_000_000_000);
    const b = issueStartSessionTransactionId(SECRET, 1_800_000_000_000);
    expect(a).not.toBe(b);
  });

  it('rejects a forged id, a tampered digit, another secret, and malformed input', () => {
    const id = issueStartSessionTransactionId(SECRET, 1_800_000_000_000);
    const tampered = id.slice(0, 35) + ((Number(id[35]) + 1) % 10);
    expect(verifyStartSessionTransactionId(SECRET, tampered, 1_800_000_000_000)).toMatchObject({ ok: false, reason: 'bad_mac' });
    expect(verifyStartSessionTransactionId(SECRET + 'x', id, 1_800_000_000_000)).toMatchObject({ ok: false, reason: 'bad_mac' });
    expect(verifyStartSessionTransactionId(SECRET, '123456789012345678901234567890123456', 1_800_000_000_000)).toMatchObject({ ok: false, reason: 'bad_mac' });
    expect(verifyStartSessionTransactionId(SECRET, 'not-numeric', 1_800_000_000_000)).toMatchObject({ ok: false, reason: 'malformed' });
    expect(verifyStartSessionTransactionId(SECRET, '', 1_800_000_000_000)).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('expires after 10 minutes and refuses ids from the future', () => {
    const t0 = 1_800_000_000_000;
    const id = issueStartSessionTransactionId(SECRET, t0);
    expect(START_SESSION_TXN_TTL_MS).toBe(10 * 60 * 1000);
    expect(verifyStartSessionTransactionId(SECRET, id, t0 + START_SESSION_TXN_TTL_MS - 1000).ok).toBe(true);
    expect(verifyStartSessionTransactionId(SECRET, id, t0 + START_SESSION_TXN_TTL_MS + 1000)).toMatchObject({ ok: false, reason: 'expired' });
    expect(verifyStartSessionTransactionId(SECRET, id, t0 - 120_000)).toMatchObject({ ok: false, reason: 'future' });
  });

  it('the minted id round-trips through the Nayax AES-256-ECB cipher (36 + "=" + 27 = 64-char plaintext)', () => {
    const id = issueStartSessionTransactionId(SECRET);
    const cipher = encryptStartSession({ secretToken: SECRET, transactionId: id, randomString: '123456789qwertyuioasdfghjkl' });
    expect(typeof cipher).toBe('string');
    expect(Buffer.from(cipher, 'base64').length).toBe(80); // 64 bytes + one full PKCS7 block
  });
});
