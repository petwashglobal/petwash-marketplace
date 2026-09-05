/**
 * REGRESSION PIN — "Finish & Invoice" double-submit / silent-failure guard
 * on POSJobs.tsx (found auditing the provider journey's complete→earnings
 * step for the booking-e2e sprint: double-tap guards + honest error states).
 *
 * finishMutation is a TWO-LEG action:
 *   1. POST /api/orchestrator/job-complete (creates the invoice)
 *   2. actionMutation.mutateAsync({action:'complete'}) inside onSuccess
 *      (flips the booking to provider_marked_complete)
 *
 * The button's disabled state was `finishMutation.isPending` — which
 * TanStack Query flips back to false the moment leg 1's promise resolves,
 * i.e. BEFORE leg 2 (awaited inside onSuccess) even starts. Two bugs
 * followed:
 *
 *   - Double-submit: the button re-enabled itself while leg 2 was still in
 *     flight. A provider tapping again fired a SECOND
 *     /api/orchestrator/job-complete call — a duplicate invoice — for a job
 *     that, from their view, was already "done".
 *   - Silent failure: if leg 2 rejected, there was no try/catch around it,
 *     so it surfaced as an unhandled rejection inside onSuccess — no toast,
 *     modal stuck open, no indication the invoice succeeded but the
 *     booking status didn't move.
 *
 * Fixed: a `finishing` flag spans both legs (set on click, cleared in
 * finally/onError), gates the button, and leg 2 is wrapped in try/catch
 * with a toast that's explicit about "invoice sent, but status didn't
 * update" rather than a generic failure — so the provider doesn't re-tap
 * and double-invoice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, 'POSJobs.tsx'), 'utf8');

describe('POSJobs — Finish & Invoice spans both legs of the mutation', () => {
  it('declares a `finishing` state that is not just finishMutation.isPending', () => {
    expect(SRC).toMatch(/const \[finishing, setFinishing\] = useState\(false\)/);
  });

  it('the Finish & Invoice button disables on `finishing`, not on finishMutation.isPending alone', () => {
    const btnStart = SRC.indexOf('setFinishing(true); finishMutation.mutate(finishModal!)');
    expect(btnStart).toBeGreaterThan(-1);
    const btnRegion = SRC.slice(btnStart, btnStart + 400);
    expect(btnRegion).toMatch(/disabled=\{finishing/);
    expect(btnRegion).not.toMatch(/disabled=\{finishMutation\.isPending/);
  });

  it('setFinishing(true) fires synchronously in the click handler, before the async mutation starts', () => {
    expect(SRC).toMatch(/onClick=\{\(\) => \{ setFinishing\(true\); finishMutation\.mutate\(finishModal!\); \}\}/);
  });

  it('leg 2 (marking the booking complete) is wrapped in try/catch, not a bare await', () => {
    const start = SRC.indexOf('onSuccess: async (res: any, modal)');
    expect(start).toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('onError: (err: any) => {\n      setFinishing', start));
    expect(body).toMatch(/try\s*\{[\s\S]*actionMutation\.mutateAsync[\s\S]*\}\s*catch/);
  });

  it('a leg-2 failure tells the provider the invoice already went out (prevents a re-tap double-invoice)', () => {
    const start = SRC.indexOf('onSuccess: async (res: any, modal)');
    const body = SRC.slice(start, SRC.indexOf('onError: (err: any) => {\n      setFinishing', start));
    expect(body).toMatch(/catch \(err: any\) \{[\s\S]*Invoice[\s\S]*sent[\s\S]*variant:\s*'destructive'/);
  });

  it('finishing resets to false on both success and failure paths (finally + onError)', () => {
    expect(SRC).toMatch(/\}\s*finally\s*\{\s*setFinishing\(false\);\s*\}/);
    const onErrorStart = SRC.indexOf('onError: (err: any) => {\n      setFinishing');
    expect(onErrorStart).toBeGreaterThan(-1);
  });
});
