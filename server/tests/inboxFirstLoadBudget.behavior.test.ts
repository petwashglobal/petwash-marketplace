/**
 * InboxFirstLoadBudget — Program 49.
 */
import { describe, it, expect } from 'vitest';
import { budgetFirstLoad, isValidCursor } from '../services/marketplace/InboxFirstLoadBudget';

describe('InboxFirstLoadBudget', () => {
  it('no cursor + no requestedLimit → 50 first-load bound', () => {
    const out = budgetFirstLoad({ workspace: 'PET_PARENT' });
    expect(out.effectiveLimit).toBe(50);
    expect(out.useKeyset).toBe(false);
    expect(out.reasonCode).toBe('FIRST_LOAD_BOUNDED');
  });

  it('client asks for 200 → clamped to 50 on first load', () => {
    expect(budgetFirstLoad({ workspace: 'PET_PARENT', requestedLimit: 200 }).effectiveLimit).toBe(50);
  });

  it('follow-page (cursor present) → hard-capped at 25', () => {
    const out = budgetFirstLoad({
      workspace: 'PET_PARENT',
      requestedLimit: 200,
      cursor: { afterAt: '2026-08-30T00:00:00Z', afterId: 'X-1' },
    });
    expect(out.effectiveLimit).toBe(25);
    expect(out.useKeyset).toBe(true);
    expect(out.reasonCode).toBe('FOLLOW_PAGE_KEYSET');
  });

  it('client asks for 10 → honoured (not silently expanded)', () => {
    expect(budgetFirstLoad({ workspace: 'PET_PARENT', requestedLimit: 10 }).effectiveLimit).toBe(10);
  });

  it('non-numeric requestedLimit → default 50', () => {
    expect(budgetFirstLoad({ workspace: 'PET_PARENT', requestedLimit: Number.NaN }).effectiveLimit).toBe(50);
  });

  it('isValidCursor detects a missing / unparsable afterAt', () => {
    expect(isValidCursor(undefined)).toBe(false);
    expect(isValidCursor({ afterAt: '', afterId: 'X' })).toBe(false);
    expect(isValidCursor({ afterAt: 'not-a-date', afterId: 'X' })).toBe(false);
    expect(isValidCursor({ afterAt: '2026-08-30T00:00:00Z', afterId: 'X' })).toBe(true);
  });
});
