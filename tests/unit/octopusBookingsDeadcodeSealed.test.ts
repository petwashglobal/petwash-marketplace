/**
 * PR-DANGER-4 regression pins — /v1/bookings/* dead handlers stay deleted.
 *
 * All four handlers under `router.all('/v1/bookings*', …)` at
 * server/routes/octopus-engine.ts:97 are unreachable via the sentinel,
 * but the code below the sentinel was still ~250 lines of live money-
 * mutating logic (PAYMENT_CAPTURED / PROVIDER_EARNING / PLATFORM_FEE
 * ledger inserts + escrow.releaseEscrowPayment side-effect). One
 * mount-order reorder in a future PR would have resurrected an
 * admin-gated path capable of double-counting revenue against the
 * canonical booking_requests table.
 *
 * This test verifies:
 *   1) None of the four booking handler routes exist anywhere in the
 *      file at ANY path.
 *   2) The /v1/bookings* sentinel is still in place and registers
 *      BEFORE any surviving router mount for the /v1/bookings* prefix.
 *   3) No client file references the retired paths.
 *   4) The canonical booking-complete rail exists elsewhere in the
 *      codebase — deletion is safe because a live equivalent exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const src = read('server/routes/octopus-engine.ts');

describe('PR-DANGER-4 — /v1/bookings/* handlers stay deleted', () => {
  it('POST /v1/bookings/:id/complete handler is gone from octopus-engine.ts', () => {
    // The money-side handler CEO explicitly flagged. Inserted
    // PAYMENT_CAPTURED + PROVIDER_EARNING + PLATFORM_FEE ledger rows
    // + released escrow on the deprecated octopus_bookings table.
    expect(src).not.toMatch(/router\.post\(\s*['"][^'"]*\/v1\/bookings\/:id\/complete['"]/);
  });

  it('POST /v1/bookings/:id/cancel handler is gone', () => {
    expect(src).not.toMatch(/router\.post\(\s*['"][^'"]*\/v1\/bookings\/:id\/cancel['"]/);
  });

  it('GET /v1/bookings/:id handler is gone', () => {
    expect(src).not.toMatch(/router\.get\(\s*['"][^'"]*\/v1\/bookings\/:id['"]/);
  });

  it('GET /v1/bookings list handler is gone', () => {
    // Careful: only match the exact `/v1/bookings` string, not the :id or
    // /complete/cancel variants that share the prefix. Escape the trailing
    // quote boundary.
    expect(src).not.toMatch(/router\.get\(\s*['"]\/v1\/bookings['"]\s*,/);
  });

  it('POST /v1/bookings create handler is gone', () => {
    // Regression: the create handler took `body.userId` and would insert
    // an octopus_bookings row at `body.price` if the sentinel ever went
    // away. Sentinel-shadowed today, deleted here belt-and-braces.
    expect(src).not.toMatch(/router\.post\(\s*['"]\/v1\/bookings['"]\s*,/);
  });

  it('/v1/bookings* sentinel is still mounted with the canonical migration table', () => {
    // If a future refactor removed the sentinel, everything that made the
    // (now-deleted) handlers harmless would be gone. Pin the sentinel +
    // its migration table so the message keeps pointing at the right rail.
    expect(src).toMatch(/router\.all\(\s*['"]\/v1\/bookings\*['"]/);
    const sentinel = src.match(
      /router\.all\(\s*['"]\/v1\/bookings\*['"][\s\S]{0,700}?\}\);\s*\n/,
    );
    expect(sentinel, 'bookings sentinel missing').toBeTruthy();
    expect(sentinel![0]).toMatch(/V1_DEPRECATED/);
    expect(sentinel![0]).toMatch(/\/api\/booking-requests/);
    expect(sentinel![0]).toMatch(/\/api\/provider-dashboard\/v2\/bookings/);
  });

  it('sentinel index precedes every remaining router mount for /v1/bookings*', () => {
    // Belt-and-braces on the mount-order rule. There should be zero
    // surviving `router.post/get/patch/delete` for `/v1/bookings*` after
    // this PR — but if a future author adds one back, this test asserts
    // it MUST sit after the sentinel or the guarantee is void.
    const sentinelIdx = src.indexOf(`router.all('/v1/bookings*'`);
    expect(sentinelIdx).toBeGreaterThan(-1);
    const anyBookingsMountRe = /router\.(post|get|patch|delete)\(\s*['"]\/v1\/bookings/g;
    let m: RegExpExecArray | null;
    const offendingBefore: number[] = [];
    while ((m = anyBookingsMountRe.exec(src))) {
      if (m.index < sentinelIdx) offendingBefore.push(m.index);
    }
    expect(offendingBefore, `router.<verb> for /v1/bookings mounted BEFORE sentinel: ${offendingBefore.join(', ')}`).toEqual([]);
  });
});

describe('PR-DANGER-4 — zero client callers + canonical rail exists', () => {
  it('no client file references any of the four retired paths', () => {
    const clientDir = path.join(root, 'client', 'src');
    const bad: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/octopus\/v1\/bookings/.test(content)) {
          bad.push(full.slice(root.length + 1));
        }
      }
    };
    walk(clientDir);
    expect(bad, `caller(s) of retired /v1/bookings paths: ${bad.join(', ')}`).toEqual([]);
  });

  it('canonical booking-complete rail exists in the codebase (safe to delete the dead one)', () => {
    // If the canonical rail did not exist, deleting the dead handler would
    // leave the platform with no way to complete a booking at all. Verify
    // the two canonical live paths the sentinel migration table promises.
    const unifiedBooking = read('server/routes/unified-booking.ts');
    expect(unifiedBooking).toMatch(/BOOKING_COMPLETED/);
    const sitterSuite = read('server/routes/sitter-suite.ts');
    expect(sitterSuite).toMatch(/\/bookings\/:id\/complete/);
  });
});
