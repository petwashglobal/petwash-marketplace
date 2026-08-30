/**
 * ActionButton React component — source-anchored regression pin.
 *
 * Locks the doctrine's rules for the shared render layer:
 *   • state machine (IDLE → AWAITING_CONFIRMATION → SUBMITTING → DONE) §7
 *   • confirmation UX matches confirmationLevel §5/§43/§44
 *   • destructive button repeats verb — never bare "Yes" §80
 *   • error copy maps ReasonCode → user-facing text §78 §83 §84
 *   • data-testids stable so E2E can target
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'components', 'action', 'ActionButton.tsx'),
  'utf8',
);

describe('ActionButton — state machine (doctrine §7)', () => {
  it('carries IDLE / AWAITING_CONFIRMATION / SUBMITTING / DONE phases', () => {
    for (const p of ['IDLE', 'AWAITING_CONFIRMATION', 'SUBMITTING', 'DONE']) {
      expect(SRC).toMatch(new RegExp(`'${p}'`));
    }
  });

  it('disables the button during SUBMITTING (double-click safety §8)', () => {
    expect(SRC).toMatch(/phase === 'SUBMITTING'[\s\S]{0,60}phase === 'DONE'/);
  });
});

describe('ActionButton — confirmation UX (doctrine §5 §43 §44)', () => {
  it('needsConfirmationPrompt returns true for LIGHT_CONFIRM / REVIEW_SCREEN / EXPLICIT_CONFIRM / REAUTH_AND_CONFIRM', () => {
    for (const level of ['LIGHT_CONFIRM', 'REVIEW_SCREEN', 'EXPLICIT_CONFIRM', 'REAUTH_AND_CONFIRM']) {
      expect(SRC).toMatch(new RegExp(`level === '${level}'`));
    }
  });

  it('NONE and TOAST_UNDO fire without a modal prompt', () => {
    // The needsConfirmationPrompt function does NOT list these levels.
    const fnIdx = SRC.indexOf('function needsConfirmationPrompt');
    const end = SRC.indexOf('}', fnIdx);
    const body = SRC.slice(fnIdx, end);
    expect(body).not.toMatch(/'NONE'/);
    expect(body).not.toMatch(/'TOAST_UNDO'/);
  });

  it('REAUTH_AND_CONFIRM shows the re-verify notice inside the dialog', () => {
    expect(SRC).toMatch(/REAUTH_AND_CONFIRM[\s\S]{0,400}re-verify your identity/);
  });
});

describe('ActionButton — destructive verb discipline (doctrine §80)', () => {
  it('confirmation button uses the ACTION label — never bare "Yes"', () => {
    // The confirm-verb button renders {label}, not a hardcoded "Yes".
    const idx = SRC.indexOf('action-confirm-verb-');
    expect(idx).toBeGreaterThan(0);
    const window = SRC.slice(idx, idx + 300);
    expect(window).toMatch(/\{label\}/);
    expect(window).not.toMatch(/>Yes</);
    expect(window).not.toMatch(/>OK</);
  });
});

describe('ActionButton — visual kind maps to Tailwind classes', () => {
  it('destructive → red-600', () => {
    expect(SRC).toMatch(/case 'destructive':[\s\S]{0,120}bg-red-600/);
  });

  it('safety → amber-600', () => {
    expect(SRC).toMatch(/case 'safety':[\s\S]{0,120}bg-amber-600/);
  });

  it('primary → emerald-700 (PetWash brand)', () => {
    expect(SRC).toMatch(/case 'primary':[\s\S]{0,120}bg-emerald-700/);
  });
});

describe('ActionButton — reason-code → user copy map (§78 §83 §84)', () => {
  it('PAYMENT_UNCERTAIN copy does NOT invite a re-Pay tap prematurely (§84)', () => {
    expect(SRC).toMatch(/PAYMENT_UNCERTAIN[\s\S]{0,200}confirming your payment/);
    // Explicitly NOT: "please try again" or "Pay Again" for uncertain payments.
    const idx = SRC.indexOf("case 'PAYMENT_UNCERTAIN'");
    const end = SRC.indexOf('case', idx + 1);
    const body = SRC.slice(idx, end);
    expect(body).not.toMatch(/try again/i);
    expect(body).not.toMatch(/Pay Again/i);
  });

  it('REAUTH_REQUIRED, QUOTE_CHANGED, STALE_PREVIEW, PROVIDER_NO_LONGER_AVAILABLE all mapped', () => {
    for (const code of [
      'REAUTH_REQUIRED',
      'QUOTE_CHANGED',
      'STALE_PREVIEW',
      'PROVIDER_NO_LONGER_AVAILABLE',
      'PET_SPECIES_UNSUPPORTED',
    ]) {
      expect(SRC).toMatch(new RegExp(`case '${code}'`));
    }
  });

  it('unmapped code falls through to a graceful "contact support" copy — never raw text', () => {
    expect(SRC).toMatch(/default:[\s\S]{0,200}contact support/i);
  });
});

describe('ActionButton — data-testids stable for E2E', () => {
  it('the button, confirm-verb, cancel, result, and error each carry a testid', () => {
    expect(SRC).toMatch(/data-testid=\{`action-btn-\$\{action\.type\.toLowerCase\(\)\}`\}/);
    expect(SRC).toMatch(/data-testid=\{`action-confirm-\$\{action\.type\.toLowerCase\(\)\}`\}/);
    expect(SRC).toMatch(/data-testid=\{`action-confirm-verb-\$\{action\.type\.toLowerCase\(\)\}`\}/);
    expect(SRC).toMatch(/data-testid=\{`action-cancel-\$\{action\.type\.toLowerCase\(\)\}`\}/);
    expect(SRC).toMatch(/data-testid=\{`action-result-\$\{action\.type\.toLowerCase\(\)\}`\}/);
    expect(SRC).toMatch(/data-testid=\{`action-error-\$\{action\.type\.toLowerCase\(\)\}`\}/);
  });

  it('data-risk + data-confirmation attrs surface for E2E assertions', () => {
    expect(SRC).toMatch(/data-risk=\{action\.riskLevel\}/);
    expect(SRC).toMatch(/data-confirmation=\{action\.confirmationLevel\}/);
  });
});
