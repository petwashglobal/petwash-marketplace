/**
 * Money visibility (CEO 2026-07-24: "sync of nayax to bookkeeping is it
 * possible, its showing on nayax core now, im not smart enough").
 *
 * It IS possible today: the manual Nayax Core CSV import rail exists and is
 * idempotent. The gap was DISCOVERY — the bookkeeping page showed ₪0 with no
 * hint that a CSV import fills it. Now an empty ledger explains both routes
 * (webhook = distributor-gated; CSV = works now) and links straight to it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const page = R('client/src/pages/AdminBookkeeping.tsx');
const importRoute = R('server/routes/admin-nayax-events.ts');

describe('empty bookkeeping tells the CEO how to fill it', () => {
  it('shows the import CTA only when every station has zero revenue AND zero washes', () => {
    expect(page).toMatch(/s\.totals\.grossCents === 0 && s\.totals\.washes === 0/);
    expect(page).toContain('bk-import-cta');
  });

  it('links straight to the Nayax import screen', () => {
    expect(page).toMatch(/go\('\/admin\/nayax-events'\)/);
    expect(page).toContain('bk-goto-import');
  });

  it('states the honest truth about what the import does', () => {
    expect(page).toMatch(/לא מזכה נקודות/);   // no points credited
    expect(page).toMatch(/לא נוגע בארנקים/);  // no wallet writes
  });
});

describe('the import rail behind it stays safe', () => {
  it('is idempotent on the external transaction id (re-upload cannot double-count)', () => {
    expect(importRoute).toMatch(/onConflictDoNothing\(\{ target: nayaxTransactionEvents\.externalTransactionId \}\)/);
  });

  it('is record-only — no loyalty award on import', () => {
    expect(importRoute).toMatch(/RECORD-ONLY/);
  });
});
