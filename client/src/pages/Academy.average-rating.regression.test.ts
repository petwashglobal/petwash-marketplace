/**
 * Academy stats strip — "average rating" must not print NaN.
 *
 * Live QA 2026-09-10: /academy/ showed "NaN · דירוג ממוצע" because the
 * average divided by trainers.length with zero trainers (/api/academy/trainers
 * is empty in production). Show "—" until there is something to average.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'Academy.tsx'), 'utf8');

describe('Academy — average rating with no trainers', () => {
  it('guards the division by trainers.length', () => {
    expect(SRC).toContain("trainers.length > 0 ? (trainers.reduce((sum, t) => sum + parseFloat(t.averageRating), 0) / trainers.length).toFixed(2) : '—'");
  });
  it('has no unguarded average-over-length left', () => {
    expect(SRC).not.toMatch(/\{\(trainers\.reduce\([^)]*\)[^}]*\/ trainers\.length\)\.toFixed/);
  });
});
