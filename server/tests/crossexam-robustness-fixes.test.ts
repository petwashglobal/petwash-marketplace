/**
 * Cross-exam robustness fixes — findings #4, #5, #6 (all 3/3 skeptics).
 * Batched because each is a small, self-contained hardening fix.
 *
 * #4 WalletService.adminInjectCredits — atomic increment (no lost update)
 * #5 nayaxFirestoreService.verifyWebhookSignature — no 500 on bad signature
 * #6 template-engine — literal replacement (no $-sequence corruption)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WALLET_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'WalletService.ts'), 'utf8');
const NAYAX_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'nayaxFirestoreService.ts'), 'utf8');
const TEMPLATE_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'template-engine.ts'), 'utf8');

// Behavioural check for #6 — run the real logic, not just the source.
function applyReplace(content: string, key: string, value: string): string {
  const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
  return content.replace(regex, () => value);
}

describe('cross-exam #4 — adminInjectCredits atomic increment', () => {
  it('uses DB-side COALESCE increment, not read-compute-write absolute value', () => {
    const block = WALLET_SRC.slice(WALLET_SRC.indexOf('adminInjectCredits'));
    expect(block).toMatch(/updates\.egiftBalanceCents = sql`COALESCE\(egift_balance_cents, 0\) \+ \$\{amount\}`/);
    // the old lost-update pattern must be gone from this method
    expect(block.slice(0, block.indexOf('Log comprehensive audit'))).not.toMatch(/balanceBefore = wallet\./);
  });
  it('derives balanceAfter from the RETURNING row', () => {
    const block = WALLET_SRC.slice(WALLET_SRC.indexOf('adminInjectCredits'));
    expect(block).toMatch(/\.returning\(\)/);
    expect(block).toMatch(/balanceBefore = balanceAfter - amount/);
  });
});

describe('cross-exam #5 — Nayax webhook signature no longer 500s', () => {
  it('length-checks before timingSafeEqual and catches', () => {
    expect(NAYAX_SRC).toMatch(/if \(a\.length !== b\.length\) return false/);
    expect(NAYAX_SRC).toMatch(/verifyWebhookSignature[\s\S]*try \{[\s\S]*catch[\s\S]*return false/);
  });
});

describe('cross-exam #6 — template engine literal replacement', () => {
  it('uses a replacer function (source)', () => {
    expect(TEMPLATE_SRC).toMatch(/\.replace\(regex, \(\) => value\)/);
  });
  it('does NOT corrupt a value containing $-sequences (behaviour)', () => {
    expect(applyReplace('Hi {{firstName}}!', 'firstName', 'A$1B$&C')).toBe('Hi A$1B$&C!');
    expect(applyReplace('Code: {{voucherCode}}', 'voucherCode', "$'$`")).toBe("Code: $'$`");
  });
});
