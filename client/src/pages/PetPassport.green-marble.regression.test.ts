/**
 * Pet Passport green-marble palette pin — CEO 2026-07-07 canonical spec.
 *
 * The green-marble tokens are the CEO-approved brand palette for the Pet
 * Passport surface AND ONLY the Pet Passport surface (petwash-visual-design
 * SKILL §2). A refactor that swapped these hex codes for the earlier
 * amber-on-dark palette (what PetPassport.tsx used before 2026-08-27) would
 * silently kill the luxury look CEO signed off on. This test pins every
 * passport-family file to the same 5 tokens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', 'pages');
const HOME = fs.readFileSync(path.join(ROOT, 'PetPassportHome.tsx'), 'utf8');
const DETAIL = fs.readFileSync(path.join(ROOT, 'PetPassport.tsx'), 'utf8');
const ADD = fs.readFileSync(path.join(ROOT, 'AddPetPassport.tsx'), 'utf8');
const PRINT = fs.readFileSync(path.join(ROOT, 'PetPassportPrint.tsx'), 'utf8');

// ─── Green-marble token pins ───────────────────────────────────────

describe('green-marble palette — every passport surface uses the same 5 tokens', () => {
  const TOKENS = {
    green: '#063B22',
    gold: '#D6B56D',
    marble: '#FAFAF7',
    border: '#ECE6D8',
    ink: '#121212',
  };

  it('PetPassportHome carries all 5 tokens', () => {
    expect(HOME).toContain(TOKENS.green);
    expect(HOME).toContain(TOKENS.gold);
    expect(HOME).toContain(TOKENS.marble);
    expect(HOME).toContain(TOKENS.border);
    expect(HOME).toContain(TOKENS.ink);
  });

  it('PetPassport detail carries all 5 tokens (2026-08-27 repaint)', () => {
    expect(DETAIL).toContain(TOKENS.green);
    expect(DETAIL).toContain(TOKENS.gold);
    expect(DETAIL).toContain(TOKENS.marble);
    expect(DETAIL).toContain(TOKENS.border);
    expect(DETAIL).toContain(TOKENS.ink);
  });

  it('AddPetPassport uses the marble bg + green/gold/border tokens', () => {
    expect(ADD).toContain(TOKENS.marble);
    expect(ADD).toContain(TOKENS.green);
    expect(ADD).toContain(TOKENS.gold);
    expect(ADD).toContain(TOKENS.border);
  });

  it('PetPassportPrint carries all 5 tokens for the print/PDF cover', () => {
    expect(PRINT).toContain(TOKENS.green);
    expect(PRINT).toContain(TOKENS.gold);
    expect(PRINT).toContain(TOKENS.marble);
    expect(PRINT).toContain(TOKENS.border);
    expect(PRINT).toContain(TOKENS.ink);
  });

  // Apple Wallet pet-passport pass: the JSON template was deleted in the
  // 2026-08-27 wire-only sweep because a signed .pkpass needs a model
  // DIRECTORY (pass.json + logo/icon PNGs) — a lone JSON file cannot be
  // signed by passkit-generator. Follow-up ticket ships:
  //   wallet/pet-passport-model.pass/  (pass.json + icon@2x + logo@2x + strip@2x)
  //   server route  GET /api/wallet/apple/pet-passport/:petId
  //   using the existing AppleWalletService pattern.
  // Until then the pin only covers the client surfaces above.
});

// ─── No off-brand accent creep ─────────────────────────────────────

describe('passport surfaces do not spray amber/indigo/red brand accents (§visual-design)', () => {
  // amber-300/amber-500 was the OLD passport look. Any test that fails here
  // means the palette regressed to the pre-2026-08-27 amber-on-black scheme.
  it('PetPassport detail no longer references amber-300 / amber-500 utility classes', () => {
    expect(DETAIL).not.toMatch(/amber-300|amber-400|amber-500|luxury-bg-mesh/);
  });

  it('PetPassportHome does not carry an indigo / purple accent', () => {
    expect(HOME).not.toMatch(/indigo-|purple-|violet-/);
  });

});
