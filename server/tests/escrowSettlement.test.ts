import { describe, it, expect } from 'vitest';
import { planEscrowOnCreate, planEscrowOnTerminal } from '../lib/escrowSettlement';

describe('planEscrowOnCreate (idempotent capture — no duplicate holdings)', () => {
  it('inserts a fresh holding when none exists', () => {
    expect(planEscrowOnCreate(null)).toBe('insert');
    expect(planEscrowOnCreate(undefined)).toBe('insert');
  });

  it('promotes a pending/pending_payment row to held instead of inserting a duplicate', () => {
    expect(planEscrowOnCreate('pending')).toBe('promote');
    expect(planEscrowOnCreate('pending_payment')).toBe('promote');
  });

  it('skips when already held/processed (idempotent re-entry — never double-creates)', () => {
    expect(planEscrowOnCreate('held')).toBe('skip');
    expect(planEscrowOnCreate('releasing')).toBe('skip');
    expect(planEscrowOnCreate('released')).toBe('skip');
    expect(planEscrowOnCreate('refunded')).toBe('skip');
  });
});

describe('planEscrowOnTerminal (cancel/refund — no stranded, no double settle)', () => {
  it('refunds a still-open holding on cancel/refund', () => {
    expect(planEscrowOnTerminal('pending')).toBe('refund');
    expect(planEscrowOnTerminal('pending_payment')).toBe('refund');
    expect(planEscrowOnTerminal('held')).toBe('refund');
    expect(planEscrowOnTerminal('releasing')).toBe('refund');
    expect(planEscrowOnTerminal('disputed')).toBe('refund');
  });

  it('skips when already terminal (idempotent — never refunds twice or claws back a payout)', () => {
    expect(planEscrowOnTerminal('released')).toBe('skip');
    expect(planEscrowOnTerminal('refunded')).toBe('skip');
  });

  it('skips when there is no holding to settle', () => {
    expect(planEscrowOnTerminal(null)).toBe('skip');
    expect(planEscrowOnTerminal(undefined)).toBe('skip');
  });
});
