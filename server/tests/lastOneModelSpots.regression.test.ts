/**
 * The last two places that priced a marketplace fee as a flat 15% of what the
 * customer paid (2026-09-17), after the one money model rollout:
 *  - admin force-confirm of an Academy booking (prestige-pass.ts): receipt fee
 *    15% of the paid amount, retry payload without the receipt fields, and a
 *    SELECT without trainer_id ("Trainer undefined" on the document)
 *  - admin escrow sync (admin-escrow-reconciliation.ts): PG row rebuilt with a
 *    flat 15% instead of the split the Firestore escrow was created with
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('admin force-confirm academy receipt', () => {
  const src = read('routes/prestige-pass.ts');
  const start = src.indexOf("[AdminWallet][ForceConfirm] Wallet debited");
  const block = src.slice(src.lastIndexOf('SELECT booking_id', start), src.indexOf('Receipt failed inline AND outbox', start));

  it('reads trainer_id and the stored fee', () => {
    expect(block).toMatch(/SELECT booking_id, user_id, trainer_id, trainer_user_id[\s\S]*total_amount, platform_fee/);
  });

  it('fee is the stored share; the outbox holds the full receipt input', () => {
    expect(block).toContain('const feeShare = storedTotal > 0 && storedFee >= 0 ? storedFee / storedTotal : PETWASH_COMMISSION_RATE;');
    expect(block).toContain('payload: receiptInput,');
    expect(block).toContain('generateReceipt(receiptInput)');
    expect(block).not.toContain('totalAmountIls * PETWASH_COMMISSION_RATE');
  });
});

describe('admin escrow sync', () => {
  it('uses the escrow doc\'s own commission', () => {
    const src = read('routes/admin-escrow-reconciliation.ts');
    expect(src).toContain("typeof fs.platformCommissionCents === 'number'");
  });
});
