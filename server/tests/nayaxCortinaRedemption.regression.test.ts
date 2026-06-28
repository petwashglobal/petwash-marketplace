/**
 * Nayax Cortina pre-paid redemption — reserve → commit → release (per
 * docs/design/2026-06-25-k9000-closedloop-prepaid-redemption.md). PetWash is the
 * Cortina payment method; authorise RESERVES (no debit), settlement COMMITS
 * (atomic ledger debit, exactly-once on replay, card NEVER charged), a sweep
 * RELEASES (TTL + max_wash_seconds ceiling, since K9000 emits no completion).
 * DARK until NAYAX_CORTINA_ENABLED. Source-introspection (Nayax-runtime-bound).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/nayax-cortina.ts'), 'utf8');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');
const migPath = resolve(ROOT, 'migrations/0076_k9000_redemption_reservations.sql');

describe('Nayax Cortina pre-paid redemption (reserve→commit→release)', () => {
  it('is dark until NAYAX_CORTINA_ENABLED + mounted CSRF-exempt', () => {
    expect(src).toMatch(/if \(!cortinaEnabled\(\)\) return res\.status\(503\)/);
    expect(routes).toMatch(/app\.use\('\/api\/webhooks\/nayax\/cortina', nayaxCortinaRoutes\)/);
  });

  it('migration 0076: reservation table + the two partial unique indexes + recon queue', () => {
    expect(existsSync(migPath)).toBe(true);
    const m = readFileSync(migPath, 'utf8');
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS k9000_redemption_reservations/);
    expect(m).toMatch(/uq_k9res_idempotency/);                       // exactly-once settlement
    expect(m).toMatch(/uq_k9res_active_bay ON k9000_redemption_reservations\(bay_id\) WHERE status = 'reserved'/);
    expect(m).toMatch(/uq_k9res_active_user_station[^]*WHERE status = 'reserved'/);
    expect(m).toMatch(/max_wash_seconds/);                           // anti-hang ceiling
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS k9000_reconciliation_breaks/);
  });

  it('AUTHORISE reserves (TCC Try) — NO debit; dual-scan blocked by the unique index', () => {
    expect(src).toMatch(/INSERT INTO k9000_redemption_reservations/);
    expect(src).toMatch(/'reserved'/);
    expect(src).toMatch(/isUniqueViolation\(e\)\) return res\.json\(cortinaDecline\(6, 'bay_or_user_already_reserved'\)\)/);
  });

  it('SETTLEMENT is exactly-once: replay → Approved, else claim reserved→committed then debit', () => {
    expect(src).toMatch(/status === 'committed'[^]*replay: true/);   // replay short-circuit
    expect(src).toMatch(/SET status='committed', idempotency_key=\$1[^]*WHERE bay_id=\$3 AND user_id=\$4 AND status='reserved'/);
    expect(src).toMatch(/await authorizeRedemption\(\{/);            // debit only after the claim
    expect(src).toMatch(/SET status='cancelled'/);                   // roll back if debit fails
  });

  it('uses ENGINE literals (gift_credit/wallet_balance), never egift/cash', () => {
    expect(src).toMatch(/'gift_credit'/);
    expect(src).toMatch(/'wallet_balance'/);
    expect(src).not.toMatch(/return 'egift'|return 'cash'/);
  });

  it('RELEASE sweep exists — expires TTL + closes bays past the ceiling (no completion signal)', () => {
    expect(src).toMatch(/export async function releaseStaleCortinaReservations/);
    expect(src).toMatch(/status='expired'[^]*status='reserved' AND expires_at < NOW\(\)/);
    expect(src).toMatch(/closeBaySession\(row\.session_id, 'timed_out'\)/);
  });

  it('wire-format is pre-aligned to the verified Cortina Static-QR spec (nested BasicInfo/MachineInfo/DeviceInfo)', () => {
    // Verified nested shape recognised, with the legacy flat keys kept as fallbacks.
    expect(src).toMatch(/BasicInfo\b/);
    expect(src).toMatch(/MachineInfo\b/);
    expect(src).toMatch(/DeviceInfo\b/);
    expect(src).toMatch(/machine\.Id \?\? machine\.id/);            // machine identity source
    // Identity keys on MachineInfo.Id, NOT DeviceInfo.HwSerial (which changes on swaps).
    expect(src).toMatch(/log only — do NOT key identity on it/);
    expect(src).toMatch(/b\.TerminalId \?\? b\.terminalId \?\? b\.UniQR/); // flat fallbacks preserved
  });

  it('VOID callback exists and is money-safe (release reserve; flag — never auto-refund — a committed debit)', () => {
    expect(src).toMatch(/router\.post\('\/void'/);
    expect(src).toMatch(/if \(!cortinaEnabled\(\)\) return res\.status\(503\)/); // dark-gated like the others
    // Reserved (no debit) → cancelled; committed (debited) → recon break, NOT auto-refund.
    expect(src).toMatch(/r\.status === 'reserved'[^]*status='cancelled'/);
    expect(src).toMatch(/r\.status === 'committed'[^]*k9000_reconciliation_breaks/);
    expect(src).toMatch(/break_type[^]*void_after_commit|'void_after_commit'/);
    expect(src).not.toMatch(/void[^]*refundToWallet|void[^]*reverseEntry/);     // no blind refund math in void
  });
});
