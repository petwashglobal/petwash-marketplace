/**
 * REGRESSION PIN — POSCalendar "Availability saved" toast must not fire on
 * a rejected save (found during the booking-e2e provider-journey audit,
 * scope: "kill any toast.success that fires regardless of the server
 * result").
 *
 * Two compounding bugs made this a live false-success:
 *
 * 1. profileMutation / consoleMutation's mutationFn resolved with
 *    `.then(r => r.json())` and never checked `r.ok`. A 401/400/500
 *    response with a JSON error body (e.g. {error: '...'}) still resolved
 *    the mutation successfully instead of rejecting it.
 *
 * 2. handleSave awaited both mutateAsync calls with no try/catch, then
 *    unconditionally called toast({ title: 'Availability saved' }) on the
 *    next line. Even after fixing (1), an actual network failure would
 *    throw out of handleSave as an unhandled rejection with ZERO user
 *    feedback — no success toast (fine) but also no error toast, no retry
 *    affordance, just a button that silently stopped spinning.
 *
 * Fixed: both mutationFns now throw on `!r.ok`, and handleSave wraps the
 * Promise.all in try/catch — success toast only in the try branch after
 * both saves are confirmed 2xx, destructive error toast in the catch.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, 'POSCalendar.tsx'), 'utf8');
// Strip line comments so the code-shape assertions below don't accidentally
// match the explanatory prose describing the old, fixed bug.
const CODE = SRC.replace(/^\s*\/\/.*$/gm, '');

describe('POSCalendar — save mutations check response.ok', () => {
  it('profileMutation throws on a non-ok response instead of resolving', () => {
    const start = SRC.indexOf('const profileMutation = useMutation');
    expect(start).toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('const consoleMutation', start));
    expect(body).toMatch(/if\s*\(!r\.ok\)\s*throw new Error/);
  });

  it('consoleMutation throws on a non-ok response instead of resolving', () => {
    const start = SRC.indexOf('const consoleMutation = useMutation');
    expect(start).toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('const daysInMonth', start));
    expect(body).toMatch(/if\s*\(!r\.ok\)\s*throw new Error/);
  });

  it('neither mutationFn resolves via a bare `.then(r => r.json())` any more', () => {
    // The two read-only GET queries (profile/console settings load) are out
    // of scope here — a failed read shows empty data, not a false success
    // toast. Only the two SAVE mutations matter for this pin.
    const profileMutationBody = CODE.slice(
      CODE.indexOf('const profileMutation = useMutation'),
      CODE.indexOf('const consoleMutation = useMutation'),
    );
    const consoleMutationBody = CODE.slice(
      CODE.indexOf('const consoleMutation = useMutation'),
      CODE.indexOf('const daysInMonth'),
    );
    expect(profileMutationBody).not.toMatch(/\.then\(r => r\.json\(\)\)/);
    expect(consoleMutationBody).not.toMatch(/\.then\(r => r\.json\(\)\)/);
  });
});

describe('POSCalendar — handleSave reports both outcomes', () => {
  it('the success toast is inside a try block, not unconditional after the await', () => {
    const start = SRC.indexOf('const handleSave = async ()');
    expect(start).toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('};', start));
    expect(body).toMatch(/try\s*\{[\s\S]*Promise\.all\([\s\S]*Availability saved[\s\S]*\}\s*catch/);
  });

  it('a failed save shows a destructive error toast, not silence', () => {
    const start = SRC.indexOf('const handleSave = async ()');
    const body = SRC.slice(start, SRC.indexOf('};', start));
    expect(body).toMatch(/catch\s*\(err[\s\S]*variant:\s*'destructive'/);
  });
});
