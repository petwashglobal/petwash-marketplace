/**
 * CEO §73 #12 (2026-08-28) — CLIENT wizard bank/payout section.
 *
 * Server + admin halves shipped in commit 22d8f24b1 (migration 0133
 * + /apply Zod + admin ProviderKycReview card). This test pins the
 * CLIENT half: the wizard collects the four bank fields on step 3,
 * writes them into the draft blob for cross-device hydration, and
 * appends them to the submit FormData with the same IBAN
 * canonicalisation the server expects (strip whitespace + uppercase).
 *
 * A rename anywhere on the pipe (state var, FormData key, draft key,
 * hydrate key) trips CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderOnboarding.tsx'),
  'utf8',
);

describe('ProviderOnboarding — bank / payout client wizard section (CEO §73 #12)', () => {
  it('declares four bank state hooks', () => {
    expect(SRC).toMatch(/const \[bankName, setBankName\] = useState\(''\)/);
    expect(SRC).toMatch(/const \[bankBranchCode, setBankBranchCode\] = useState\(''\)/);
    expect(SRC).toMatch(/const \[bankIban, setBankIban\] = useState\(''\)/);
    expect(SRC).toMatch(/const \[bankAccountHolder, setBankAccountHolder\] = useState\(''\)/);
  });

  it('renders the four inputs with data-testid anchors so the E2E can find them', () => {
    expect(SRC).toMatch(/data-testid="section-bank-payout"/);
    expect(SRC).toMatch(/data-testid="input-bank-name"/);
    expect(SRC).toMatch(/data-testid="input-bank-branch"/);
    expect(SRC).toMatch(/data-testid="input-bank-iban"/);
    expect(SRC).toMatch(/data-testid="input-bank-holder"/);
  });

  it('IBAN input forces dir="ltr" + font-mono (Hebrew RTL must not flip digits)', () => {
    const ibanIdx = SRC.indexOf('data-testid="input-bank-iban"');
    expect(ibanIdx).toBeGreaterThan(0);
    // Walk back to the enclosing <input> so a matching-but-unrelated
    // dir/mono elsewhere on the page can't accidentally pass this.
    const inputStart = SRC.lastIndexOf('<input', ibanIdx);
    const inputEnd   = SRC.indexOf('/>', ibanIdx);
    const block = SRC.slice(inputStart, inputEnd);
    expect(block).toMatch(/dir="ltr"/);
    expect(block).toMatch(/font-mono/);
  });

  it('every bank input fires scheduleDraftSave onBlur — cross-device hydration works', () => {
    // Grep every bank input and confirm each has onBlur pointing at the
    // draft-save debounce. Otherwise device B's hydrate wouldn't see
    // what device A typed until the applicant hit Submit.
    for (const tid of ['input-bank-name', 'input-bank-branch', 'input-bank-iban', 'input-bank-holder']) {
      const idx = SRC.indexOf(`data-testid="${tid}"`);
      expect(idx).toBeGreaterThan(0);
      const start = SRC.lastIndexOf('<input', idx);
      const end   = SRC.indexOf('/>', idx);
      const block = SRC.slice(start, end);
      expect(block).toMatch(/onBlur=\{scheduleDraftSave\}/);
    }
  });

  it('draftStep2Step3 blob carries a bank sub-object', () => {
    // Mirrors the shape the server projects back to /draft — hydrate
    // and save-side use the same key. Rename here + not there =
    // data loss on second device.
    expect(SRC).toMatch(/bank:\s*\{\s*\n\s*bankName,\s*\n\s*bankBranchCode,\s*\n\s*bankIban,\s*\n\s*bankAccountHolder,\s*\n\s*\},/);
  });

  it('mount-hydrate reverse-mirrors the bank sub-object into state', () => {
    expect(SRC).toMatch(/const bk = d\.draftStep2Step3\?\.bank/);
    expect(SRC).toMatch(/setBankName\(\(v\)\s*=>\s*v \|\| bk\.bankName\)/);
    expect(SRC).toMatch(/setBankBranchCode\(\(v\)\s*=>\s*v \|\| bk\.bankBranchCode\)/);
    expect(SRC).toMatch(/setBankIban\(\(v\)\s*=>\s*v \|\| bk\.bankIban\)/);
    expect(SRC).toMatch(/setBankAccountHolder\(\(v\)\s*=>\s*v \|\| bk\.bankAccountHolder\)/);
  });

  it('submit FormData appends the four fields with the same IBAN normalisation the server uses', () => {
    expect(SRC).toMatch(/formData\.append\('bankName',\s*bankName\.trim\(\)\)/);
    expect(SRC).toMatch(/formData\.append\('bankBranchCode',\s*bankBranchCode\.trim\(\)\)/);
    // Server strips whitespace + uppercases; client does the same so a
    // paste with a hidden non-breaking space still matches after round-trip.
    expect(SRC).toMatch(/formData\.append\('bankIban',\s*bankIban\.replace\(\/\\s\+\/g,\s*''\)\.toUpperCase\(\)\)/);
    expect(SRC).toMatch(/formData\.append\('bankAccountHolder',\s*bankAccountHolder\.trim\(\)\)/);
  });

  it('debounce dep list includes all four bank fields (so edits actually schedule a save)', () => {
    // If a field is missing from the dep list, editing it won't fire
    // the debounce → nothing saves → the second device sees stale state.
    expect(SRC).toMatch(/bankName,\s*bankBranchCode,\s*bankIban,\s*bankAccountHolder,\s*\n\s*\]\);/);
  });
});
