/**
 * CEO §60 (2026-08-28) — booking-flow error toasts.
 *
 * The walk-my-pet and sitter-suite booking flows used to render
 * `error.message` verbatim in the destructive toast. ApiError builds
 * error.message as "400: ..." + the server's copy, so a raw server
 * string (or a status prefix) reached the customer's screen.
 *
 * Fix: read the stable errorCode off error.body and switch on THAT.
 * CARE_INFO_REQUIRED (CEO §5) gets a bespoke HE/EN toast telling the
 * customer to tick the booking-scoped share or pick a different
 * service. Unknown codes fall back to a neutral "אירעה שגיאה"/"try
 * again" copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WALK = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'walk-my-pet', 'BookingFlow.tsx'),
  'utf8',
);
const SITTER = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'sitter-suite', 'BookingFlow.tsx'),
  'utf8',
);

describe('booking flows — friendly errorCode mapping (CEO §60 / §5)', () => {
  it('walk-my-pet reads error.body?.errorCode — not error.message', () => {
    // Pin the read. A regression that reverted to error.message on the
    // toast description would re-open the leak.
    expect(WALK).toMatch(/const code = String\(error\?\.body\?\.errorCode \|\| ''\);/);
    // And the destructive toast description MUST NOT be error.message
    // any more. Locate the catch block by its opener.
    const catchIdx = WALK.indexOf('} catch (error: any) {');
    const finallyIdx = WALK.indexOf('} finally {', catchIdx);
    const block = WALK.slice(catchIdx, finallyIdx);
    expect(block).not.toMatch(/description:\s*error\.message\s*\|\|/);
  });

  it('walk-my-pet renders the CARE_INFO_REQUIRED bespoke HE/EN copy', () => {
    const catchIdx = WALK.indexOf('} catch (error: any) {');
    const finallyIdx = WALK.indexOf('} finally {', catchIdx);
    const block = WALK.slice(catchIdx, finallyIdx);
    expect(block).toMatch(/if \(code === 'CARE_INFO_REQUIRED'\)/);
    expect(block).toContain('נדרש שיתוף מידע רפואי');
    expect(block).toContain('Sharing medical information is required for this service');
  });

  it('sitter-suite reads status + errorCode from ApiError.body', () => {
    // The sitter flow switches on both status (for 401/403) AND the
    // stable errorCode (for CARE_INFO_REQUIRED). Pin both reads.
    const catchIdx = SITTER.indexOf('} catch (error: any) {');
    const finallyIdx = SITTER.indexOf('} finally {', catchIdx);
    const block = SITTER.slice(catchIdx, finallyIdx);
    expect(block).toMatch(/const status = Number\(error\?\.status \|\| 0\);/);
    expect(block).toMatch(/const code = String\(error\?\.body\?\.errorCode \|\| ''\);/);
    // The previous errorMsg.includes("401") substring hack is gone.
    expect(block).not.toMatch(/errorMsg\.includes\("Authentication"\)/);
    expect(block).not.toMatch(/errorMsg\.includes\("401"\)/);
  });

  it('sitter-suite renders the CARE_INFO_REQUIRED bespoke HE/EN copy', () => {
    const catchIdx = SITTER.indexOf('} catch (error: any) {');
    const finallyIdx = SITTER.indexOf('} finally {', catchIdx);
    const block = SITTER.slice(catchIdx, finallyIdx);
    expect(block).toMatch(/} else if \(code === 'CARE_INFO_REQUIRED'\)/);
    expect(block).toContain('נדרש שיתוף מידע רפואי');
    expect(block).toContain('Sharing medical information is required for this service');
  });

  it('sitter-suite fallback toast is NEUTRAL — no errorMsg / error.message leaks in', () => {
    const catchIdx = SITTER.indexOf('} catch (error: any) {');
    const finallyIdx = SITTER.indexOf('} finally {', catchIdx);
    const block = SITTER.slice(catchIdx, finallyIdx);
    // The neutral else branch must not template error.message into the
    // description string.
    expect(block).not.toMatch(/description:\s*errorMsg\s*\|\|/);
    expect(block).not.toMatch(/description:\s*error\.message\s*\|\|/);
    expect(block).toContain('אירעה שגיאה. אין חיוב. נסו שוב.');
  });
});
