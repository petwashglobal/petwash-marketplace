import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PawFinder.tsx'), 'utf8');

// Regression pin for COMPETITIVE (WhatIDog gap, 2026-08-19): the
// PawFinder upload response now carries { identification } from Gemini
// (server PR #1957). Client must auto-fill species / breed / primaryColor
// on the report form so a distraught owner sees a pre-filled report
// instead of a blank one. Preserve any manual edits.

describe('PawFinder — client auto-fill from server identification (COMPETITIVE)', () => {
  it('reads identification from the upload response', () => {
    expect(SRC).toMatch(/const ident = j\.identification/);
  });

  it('skips degraded results and requires a real confidence floor', () => {
    expect(SRC).toMatch(/!ident\.degraded/);
    expect(SRC).toMatch(/\(ident\.confidence \?\? 0\) >= 0\.35/);
  });

  it('never overwrites what the user already typed — only defaults', () => {
    // breed / colorPrimary guards use prev.<field>.trim() (empty check).
    expect(SRC).toMatch(/!prev\.breed\.trim\(\)/);
    expect(SRC).toMatch(/!prev\.colorPrimary\.trim\(\)/);
    // petType guard compares against the EMPTY_FORM default.
    expect(SRC).toMatch(/prev\.petType === EMPTY_FORM\.petType/);
  });

  it('bounds the string lengths on both auto-filled text fields', () => {
    expect(SRC).toMatch(/String\(ident\.breedGuess\)\.slice\(0,\s*100\)/);
    expect(SRC).toMatch(/String\(ident\.primaryColor\)\.slice\(0,\s*60\)/);
  });

  it('surfaces an honest bilingual "auto-filled" nudge toast', () => {
    expect(SRC).toMatch(/🤖 זיהוי אוטומטי/);
  });
});
