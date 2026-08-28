/**
 * AdminEgiftReservationSandbox — source-pin regression.
 *
 * The sandbox is pre-activation admin tooling that exercises the real
 * §22-29 reserve → commit → release lifecycle. A refactor that changes
 * any of these invariants must trip this test:
 *
 *   • Never auto-reserves on mount — commit/release require an explicit
 *     button click. A useEffect that fired reserve() would burn eGift
 *     value the second an admin opened the page.
 *   • The commit and release buttons are disabled while status !== 'RESERVED'
 *     — no COMMIT-without-RESERVE / RELEASE-without-RESERVE from the UI.
 *   • The idempotencyKey field is optional — passing '' undefined the
 *     value so the server's default replay-safety applies.
 *   • The intendedCommercial dropdown carries the SIX canonical events
 *     (K9000_WASH, SHOP_ITEM, PROVIDER_BOOKING_SITTER/WALK/ACADEMY/PETTREK)
 *     — a refactor that added a new one silently is fine, but a refactor
 *     that removed one breaks the surface for its commercial flow.
 *   • The page mounts the shipped EgiftBalanceCard AND the shipped
 *     useEgiftReservation hook — never a bespoke fetch that would drift
 *     from the pinned §22 discipline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'AdminEgiftReservationSandbox.tsx'),
  'utf8',
);

describe('AdminEgiftReservationSandbox — pre-activation discipline', () => {
  it('imports the shipped kit — useEgiftReservation + EgiftBalanceCard', () => {
    expect(SRC).toMatch(/from ['"]@\/hooks\/useEgiftReservation['"]/);
    expect(SRC).toMatch(/from ['"]@\/components\/egift\/EgiftBalanceCard['"]/);
  });

  it('never auto-reserves on mount — no useEffect that calls r.reserve', () => {
    // A useEffect wired to call r.reserve on mount would burn eGift
    // value the second a staff user opened the page. Ban it.
    expect(SRC).not.toMatch(/useEffect\([^)]*r\.reserve/);
    // Also ban a bare top-level call to r.reserve outside a handler.
    // Every reserve call MUST live inside an onClick.
    const reserveHits = SRC.match(/r\.reserve\(/g) ?? [];
    const onClickReserveHits = SRC.match(/onClick=\{\(\)\s*=>\s*r\.reserve/g) ?? [];
    expect(reserveHits.length).toBe(onClickReserveHits.length);
  });

  it('commit + release buttons disabled unless status === RESERVED', () => {
    // The state-machine guard that keeps commit-without-reserve and
    // release-without-reserve impossible.
    expect(SRC).toMatch(/disabled=\{inFlight \|\| status !== 'RESERVED'\}[\s\S]*?r\.commit/);
    expect(SRC).toMatch(/disabled=\{inFlight \|\| status !== 'RESERVED'\}[\s\S]*?r\.release/);
  });

  it('idempotencyKey is optional — empty string becomes undefined', () => {
    // The reserve call MUST pass `idempotencyKey || undefined` so the
    // server's replay-safety applies when the operator leaves it blank.
    expect(SRC).toMatch(/idempotencyKey:\s*idempotencyKey\s*\|\|\s*undefined/);
  });

  it('carries all six intendedCommercial buckets', () => {
    // If a refactor drops one, the sandbox can no longer exercise that
    // commercial flow — trip the test.
    for (const c of [
      'K9000_WASH',
      'SHOP_ITEM',
      'PROVIDER_BOOKING_SITTER',
      'PROVIDER_BOOKING_WALK',
      'PROVIDER_BOOKING_ACADEMY',
      'PROVIDER_BOOKING_PETTREK',
    ]) {
      expect(SRC).toContain(`'${c}'`);
    }
  });

  it('surfaces §28 vs §29 language on the release / commit buttons', () => {
    // A refactor that softens the release copy to "refund" would
    // silently erase the CEO §28 distinction. Pin the wording.
    expect(SRC).toMatch(/§28 not a refund/);
    expect(SRC).toMatch(/§29 REDEEMED/);
  });
});
