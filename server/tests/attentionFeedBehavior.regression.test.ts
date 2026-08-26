/**
 * Attention feed behavioral pins — CEO 2026-08-26 correction pass §14-15.
 *
 * The composer maps booking_requests.status → an AttentionItem the
 * home renders. Every nextAction MUST open a real functional route,
 * and every actor MUST see only their side of the world. These tests
 * pin the exact matrix so a future refactor cannot silently break a
 * home CTA (e.g. by pointing "Pay" at a dead URL, or by showing the
 * customer "Accept or decline" — a provider verb — on their side).
 */
import { describe, it, expect } from 'vitest';
import { bookingItem } from '../services/attentionFeed';
import type { AttentionItem } from '@shared/lib/attentionFeed';

// Minimal shape — the mapper only reads .status, .requestId, .totalCents.
function row(status: string, extras: Record<string, any> = {}) {
  return { requestId: 'BR-TEST-1', status, totalCents: 12000, ...extras } as any;
}

function must(item: AttentionItem | null): AttentionItem {
  if (!item) throw new Error('mapper returned null');
  return item;
}

describe('Attention feed — Pet Parent side (§14)', () => {
  it('A. pending provider response → "Wait for provider" / view route', () => {
    const it0 = must(bookingItem('pet_parent', row('pending'), false));
    expect(it0.nextAction).toBe('view');
    expect(it0.priority).toBe('due_soon');
    expect(it0.destination).toBe('/bookings/BR-TEST-1');
    expect(it0.moneySummary).toBeUndefined();
  });

  it('B. accepted but payment required → PAY with money summary', () => {
    const it0 = must(bookingItem('pet_parent', row('payment_pending'), false));
    expect(it0.nextAction).toBe('pay');
    expect(it0.priority).toBe('urgent');
    expect(it0.destination).toBe('/bookings/BR-TEST-1');
    expect(it0.moneySummary?.amountCents).toBe(12000);
    expect(it0.moneySummary?.currency).toBe('ILS');
  });

  it('C. confirmed → TRACK / booking details', () => {
    const it0 = must(bookingItem('pet_parent', row('confirmed'), false));
    expect(it0.nextAction).toBe('track');
    expect(it0.destination).toBe('/bookings/BR-TEST-1');
  });

  it('E. service in-progress → TRACK', () => {
    const it0 = must(bookingItem('pet_parent', row('in_progress'), false));
    expect(it0.nextAction).toBe('track');
    expect(it0.destination).toBe('/bookings/BR-TEST-1');
  });

  it('F. provider marked complete → CONFIRM (urgent)', () => {
    const it0 = must(bookingItem('pet_parent', row('provider_marked_complete'), false));
    expect(it0.nextAction).toBe('confirm');
    expect(it0.priority).toBe('urgent');
  });

  it('G. completed → REVIEW (informational) to /review route', () => {
    const it0 = must(bookingItem('pet_parent', row('completed'), false));
    expect(it0.nextAction).toBe('review');
    expect(it0.priority).toBe('informational');
    expect(it0.destination).toBe('/bookings/BR-TEST-1/review');
  });

  it('H. unsupported status → null (empty state — CEO §14 H)', () => {
    expect(bookingItem('pet_parent', row('cancelled'), false)).toBeNull();
    expect(bookingItem('pet_parent', row('declined'), false)).toBeNull();
  });

  it('Hebrew localisation flips the title', () => {
    const en = must(bookingItem('pet_parent', row('payment_pending'), false));
    const he = must(bookingItem('pet_parent', row('payment_pending'), true));
    expect(en.title).not.toBe(he.title);
    // he title contains a Hebrew character
    expect(he.title).toMatch(/[֐-׿]/);
  });
});

describe('Attention feed — Provider side (§15)', () => {
  it('new request (pending) → ACCEPT_OR_DECLINE (urgent) to /provider/jobs', () => {
    const it0 = must(bookingItem('provider', row('pending'), false));
    expect(it0.nextAction).toBe('accept_or_decline');
    expect(it0.priority).toBe('urgent');
    expect(it0.destination).toBe('/provider/jobs/BR-TEST-1');
  });

  it('payment_pending → informational VIEW (waiting for customer money)', () => {
    const it0 = must(bookingItem('provider', row('payment_pending'), false));
    expect(it0.nextAction).toBe('view');
    expect(it0.priority).toBe('informational');
  });

  it('confirmed → START (due_soon)', () => {
    const it0 = must(bookingItem('provider', row('confirmed'), false));
    expect(it0.nextAction).toBe('start');
    expect(it0.priority).toBe('due_soon');
  });

  it('in_progress → COMPLETE (urgent)', () => {
    const it0 = must(bookingItem('provider', row('in_progress'), false));
    expect(it0.nextAction).toBe('complete');
    expect(it0.priority).toBe('urgent');
  });

  it('provider_marked_complete → informational VIEW (waiting for customer confirm)', () => {
    const it0 = must(bookingItem('provider', row('provider_marked_complete'), false));
    expect(it0.nextAction).toBe('view');
    expect(it0.priority).toBe('informational');
  });

  it('unsupported provider status → null', () => {
    // 'completed' is intentionally not in the provider projection —
    // earnings live on the Money card, not the attention feed.
    expect(bookingItem('provider', row('completed'), false)).toBeNull();
    expect(bookingItem('provider', row('cancelled'), false)).toBeNull();
  });

  it('destination always uses /provider/jobs/<id> (not the customer route)', () => {
    for (const status of ['pending', 'payment_pending', 'confirmed', 'in_progress', 'provider_marked_complete']) {
      const it0 = must(bookingItem('provider', row(status), false));
      expect(it0.destination.startsWith('/provider/jobs/')).toBe(true);
    }
  });
});

describe('Actor isolation (§27)', () => {
  it('customer verbs never leak into provider projection', () => {
    // The mapper is called with actor='provider' below for every
    // status that produces a pet_parent item. None of the pet-parent
    // verbs (pay / review / track) may appear in the provider result
    // for those statuses.
    const providerVerbs = new Set(['accept_or_decline', 'start', 'complete', 'view']);
    for (const status of ['pending', 'payment_pending', 'confirmed', 'in_progress', 'provider_marked_complete']) {
      const p = must(bookingItem('provider', row(status), false));
      expect(providerVerbs.has(p.nextAction)).toBe(true);
    }
  });

  it('provider verbs never leak into pet-parent projection', () => {
    const petParentVerbs = new Set(['view', 'pay', 'track', 'confirm', 'review']);
    for (const status of ['pending', 'payment_pending', 'confirmed', 'in_progress', 'provider_marked_complete', 'completed']) {
      const c = must(bookingItem('pet_parent', row(status), false));
      expect(petParentVerbs.has(c.nextAction)).toBe(true);
    }
  });
});
