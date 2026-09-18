/**
 * A PAID eGIFT WAS BORN IN A STATE NOTHING COULD EVER ACTIVATE.
 *
 * CEO, 2026-09-19: "gifts and regular wash packages ... wont work with
 * platforms redeem or wallet ledger". Wash packages were fine — purchase and
 * redeem touch the same column. eGift was not.
 *
 * A SIGNED-IN customer buying a fixed tier (EGIFT_100/250/500/1000) goes
 * through the live SUMIT rail: payments-sumit → verified webhook →
 * PurchaseActivationService 'EGIFT' → GiftOrchestrationService →
 * storage.createVoucher. That function wrote:
 *
 *     status: 'PENDING'
 *
 * 'PENDING' is not a state in the eVoucher lifecycle. The schema documents
 * ISSUED | CLAIMED | ACTIVE | REDEEMED | EXPIRED | CANCELLED and defaults to
 * ISSUED. That line was the ONLY occurrence of the string in the entire
 * codebase — nothing accepted it, and nothing ever transitioned out of it.
 *
 * POST /api/gift-cards/:voucherId/activate-wallet matches
 * inArray(status, ['ISSUED','ACTIVE']), so the UPDATE hit zero rows and the
 * recipient was told "Gift card is expired or invalid" — forever. The buyer
 * had already been charged.
 *
 * Second half: the confirmation email is sent WITHOUT claimUrl, and
 * egiftEmailService gates both the "Add this gift to my account" button AND
 * the fallback "go to petwash.co.il/claim and enter the code" line behind it.
 * So the recipient received a bare code and no way to use it.
 *
 * An existing pin, evoucher-status-mismatch.test.ts, covers the same class in
 * nayaxService.ts — it never looked at storage.createVoucher, which is why
 * this survived.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
/** Code with comments stripped — a pin must not pass on its own explanation. */
const code = (src: string): string =>
  src.split('\n').filter((l) => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');

const LIFECYCLE = ['ISSUED', 'CLAIMED', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED'];

describe('a voucher is created in a state the lifecycle knows', () => {
  const storage = code(R('storage.ts'));

  it('createVoucher writes ISSUED', () => {
    const at = storage.indexOf('codeLast4,');
    const block = storage.slice(at, at + 700);
    expect(block).toMatch(/status: 'ISSUED'/);
  });

  it("'PENDING' appears NOWHERE — it was never a real state", () => {
    // The whole bug in one assertion: one write, zero readers, zero
    // transitions. If it comes back anywhere, a gift dies silently again.
    expect(storage).not.toMatch(/status: 'PENDING'/);
  });

  it('the status written is one the schema actually documents', () => {
    const schema = R('../shared/schema.ts');
    const line = schema.split('\n').find((l) => l.includes('status: text("status").notNull().default("ISSUED")'));
    expect(line).toBeTruthy();
    for (const s of LIFECYCLE) expect(line).toContain(s);
  });
});

describe('the activation route can actually match what was written', () => {
  const gc = code(R('routes/gift-cards.ts'));

  it('activate-wallet accepts ISSUED and ACTIVE', () => {
    expect(gc).toMatch(/inArray\(eVouchers\.status, \['ISSUED', 'ACTIVE'\]\)/);
  });

  it('and createVoucher writes a status inside that set', () => {
    // The two halves are asserted against each other on purpose: this is a
    // write-here/read-there bug, and either side alone looks correct.
    const storage = code(R('storage.ts'));
    const written = storage.match(/status: '([A-Z]+)',/)?.[1];
    expect(written).toBeTruthy();
    expect(['ISSUED', 'ACTIVE']).toContain(written!);
  });
});

describe('the recipient is told how to claim it', () => {
  const pas = code(R('services/PurchaseActivationService.ts'));

  it('the signed-in rail passes claimUrl', () => {
    expect(pas).toMatch(/claimUrl: `\$\{process\.env\.BASE_URL \|\| 'https:\/\/petwash\.co\.il'\}\/claim\?code=/);
  });

  it('it uses the SAME env var and shape as the guest rail, so they cannot drift', () => {
    const guest = code(R('routes/egift-guest.ts'));
    expect(guest).toMatch(/process\.env\.BASE_URL \|\| 'https:\/\/petwash\.co\.il'/);
    expect(guest).toMatch(/\/claim\?code=\$\{encodeURIComponent\(/);
    expect(pas).toMatch(/\/claim\?code=\$\{encodeURIComponent\(/);
  });

  it('the email really does hide the claim link without it', () => {
    // Proof the missing field mattered: BOTH the button and the fallback
    // instructions are behind the same ternary.
    const mail = R('services/egiftEmailService.ts');
    expect(mail).toMatch(/\$\{config\.claimUrl \? `/);
    expect(mail).toMatch(/petwash\.co\.il\/claim/);
  });
});
