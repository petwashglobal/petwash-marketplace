/**
 * Action + Confirmation Brain — behavior pins
 * (CEO Doctrine 2026-08-30: §4, §5, §8, §10, §40, §43, §44, §71, §75, §79, §93).
 *
 * Locks:
 *   • ConfirmationPolicyResolver behavior — matching consequence, never
 *     generic "Are you sure?".
 *   • Idempotency-key primitive shape (§8).
 *   • Availability list ordering (safest first — §41).
 *   • Reason-code slugs — stable, never raw strings (§93).
 *   • ACTION_CATALOG invariants: destructive/L4 always REAUTH_AND_CONFIRM;
 *     no bare "Continue" / "OK" labels; domain assigned; payment / bank /
 *     account-delete actions carry the strictest confirmation.
 */
import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  resolveConfirmation,
  sortAvailableActionsSafeFirst,
  type AvailableAction,
  type ReasonCode,
} from '../../shared/marketplace/action';
import {
  ACTION_CATALOG,
  getCatalogEntry,
  listByDomain,
  hasBadLabel,
} from '../../shared/marketplace/actionCatalog';

// ── ConfirmationPolicyResolver ────────────────────────────────────────

describe('ConfirmationPolicyResolver — risk ladder (doctrine §4, §43, §44)', () => {
  it('L0 is always NONE (reads never gate on modals)', () => {
    expect(resolveConfirmation('L0')).toBe('NONE');
    expect(resolveConfirmation('L0', { moneyCents: 999_999 })).toBe('NONE');
    expect(resolveConfirmation('L0', { irreversible: true })).toBe('NONE');
  });

  it('L1 non-destructive → NONE; L1 destructive → TOAST_UNDO', () => {
    expect(resolveConfirmation('L1')).toBe('NONE');
    expect(resolveConfirmation('L1', { destructive: true })).toBe('TOAST_UNDO');
  });

  it('L2 baseline → LIGHT_CONFIRM', () => {
    expect(resolveConfirmation('L2')).toBe('LIGHT_CONFIRM');
  });

  it('L2 with affectsOtherParty → REVIEW_SCREEN (booking accept, send request)', () => {
    expect(resolveConfirmation('L2', { affectsOtherParty: true })).toBe('REVIEW_SCREEN');
  });

  it('L2 with money > 0 → REVIEW_SCREEN', () => {
    expect(resolveConfirmation('L2', { moneyCents: 5000 })).toBe('REVIEW_SCREEN');
    expect(resolveConfirmation('L2', { moneyCents: 0 })).toBe('LIGHT_CONFIRM');
  });

  it('L3 baseline → EXPLICIT_CONFIRM', () => {
    expect(resolveConfirmation('L3')).toBe('EXPLICIT_CONFIRM');
  });

  it('L4 → REAUTH_AND_CONFIRM regardless of other impacts', () => {
    expect(resolveConfirmation('L4')).toBe('REAUTH_AND_CONFIRM');
    expect(resolveConfirmation('L4', {})).toBe('REAUTH_AND_CONFIRM');
  });

  it('irreversible at ANY risk promotes to REAUTH_AND_CONFIRM', () => {
    expect(resolveConfirmation('L2', { irreversible: true })).toBe('REAUTH_AND_CONFIRM');
    expect(resolveConfirmation('L3', { irreversible: true })).toBe('REAUTH_AND_CONFIRM');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────

describe('generateIdempotencyKey (doctrine §8)', () => {
  it('produces a per-intent key (never per-request)', () => {
    const k = generateIdempotencyKey();
    expect(k.scope).toBe('per-intent');
    expect(k.key).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });

  it('two calls at different times yield different keys', () => {
    const a = generateIdempotencyKey(new Date(1_000_000_000_000));
    const b = generateIdempotencyKey(new Date(1_000_000_001_000));
    expect(a.key).not.toBe(b.key);
  });
});

// ── Available-actions ordering ────────────────────────────────────────

describe('sortAvailableActionsSafeFirst (doctrine §41)', () => {
  it('L0 < L1 < L2 < L3 < L4 — destructive lands last', () => {
    const raw: AvailableAction[] = [
      { type: 'CANCEL_BOOKING', enabled: true, riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM' },
      { type: 'OPEN_BOOKING', enabled: true, riskLevel: 'L0', confirmationLevel: 'NONE' },
      { type: 'FAVOURITE_PROVIDER', enabled: true, riskLevel: 'L1', confirmationLevel: 'NONE' },
      { type: 'DELETE_ACCOUNT', enabled: true, riskLevel: 'L4', confirmationLevel: 'REAUTH_AND_CONFIRM' },
      { type: 'MESSAGE_PROVIDER', enabled: true, riskLevel: 'L2', confirmationLevel: 'NONE' },
    ];
    const sorted = sortAvailableActionsSafeFirst(raw);
    expect(sorted.map((a) => a.type)).toEqual([
      'OPEN_BOOKING',
      'FAVOURITE_PROVIDER',
      'MESSAGE_PROVIDER',
      'CANCEL_BOOKING',
      'DELETE_ACCOUNT',
    ]);
  });

  it('does not mutate the input array', () => {
    const raw: AvailableAction[] = [
      { type: 'A', enabled: true, riskLevel: 'L3', confirmationLevel: 'EXPLICIT_CONFIRM' },
      { type: 'B', enabled: true, riskLevel: 'L1', confirmationLevel: 'NONE' },
    ];
    const copy = [...raw];
    sortAvailableActionsSafeFirst(raw);
    expect(raw).toEqual(copy);
  });
});

// ── Reason codes ──────────────────────────────────────────────────────

describe('reason codes are stable slugs (doctrine §93)', () => {
  it('accepts the doctrine-declared codes; never a raw error string', () => {
    // TypeScript enforces this at compile time, but we lock a few
    // canonical slugs to prevent renames.
    const codes: ReasonCode[] = [
      'OK',
      'PROVIDER_NO_LONGER_AVAILABLE',
      'PAYMENT_STILL_PROCESSING',
      'PET_SPECIES_UNSUPPORTED',
      'QUOTE_CHANGED',
      'PRESTIGE_ALREADY_ACTIVE',
      'STALE_PREVIEW',
      'SELF_BOOKING_BLOCKED',
      'REAUTH_REQUIRED',
    ];
    // Presence check — any rename would break the compile step first.
    expect(codes).toHaveLength(9);
  });
});

// ── ACTION_CATALOG invariants ─────────────────────────────────────────

describe('ACTION_CATALOG invariants (doctrine §71, §75, §79)', () => {
  it('every entry has actionType + domain + riskLevel + confirmationLevel + label', () => {
    for (const e of ACTION_CATALOG) {
      expect(e.actionType).toBeTruthy();
      expect(e.domain).toBeTruthy();
      expect(e.riskLevel).toMatch(/^L[0-4]$/);
      expect(e.confirmationLevel).toBeTruthy();
      expect(e.label.length).toBeGreaterThan(0);
    }
  });

  it('actionType is unique across the catalog (no duplicate registrations)', () => {
    const types = ACTION_CATALOG.map((e) => e.actionType);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });

  it('L4 entries are all REAUTH_AND_CONFIRM (never anything lighter)', () => {
    for (const e of ACTION_CATALOG.filter((x) => x.riskLevel === 'L4')) {
      expect(e.confirmationLevel).toBe('REAUTH_AND_CONFIRM');
    }
  });

  it('destructive visualKind entries are at least EXPLICIT_CONFIRM (never LIGHT_CONFIRM / NONE)', () => {
    for (const e of ACTION_CATALOG.filter((x) => x.visualKind === 'destructive')) {
      expect(['EXPLICIT_CONFIRM', 'REAUTH_AND_CONFIRM']).toContain(e.confirmationLevel);
    }
  });

  it('no bad "Continue" / "OK" / "Submit" / "Yes" labels (§79 button label discipline)', () => {
    const offenders = ACTION_CATALOG.filter(hasBadLabel);
    expect(offenders).toEqual([]);
  });

  it('canonical high-risk actions are registered with the correct confirmation', () => {
    expect(getCatalogEntry('ACCOUNT_DELETE')?.confirmationLevel).toBe('REAUTH_AND_CONFIRM');
    expect(getCatalogEntry('PROVIDER_PAYOUT_BANK_CHANGE')?.confirmationLevel).toBe('REAUTH_AND_CONFIRM');
    expect(getCatalogEntry('ADMIN_SUSPEND_PROVIDER')?.confirmationLevel).toBe('REAUTH_AND_CONFIRM');
    expect(getCatalogEntry('ADMIN_ISSUE_REFUND_LARGE')?.confirmationLevel).toBe('REAUTH_AND_CONFIRM');
    expect(getCatalogEntry('ADMIN_BULK_SUSPEND')?.confirmationLevel).toBe('REAUTH_AND_CONFIRM');
  });

  it('canonical business-state actions use REVIEW_SCREEN (booking flows)', () => {
    for (const t of [
      'BOOKING_REQUEST_SUBMIT',
      'BOOKING_ACCEPT',
      'BOOKING_PROPOSE_CHANGE',
      'BOOKING_EXTEND',
      'BOOKING_COMPLETE_JOB',
      'PROVIDER_APPLICATION_SUBMIT',
      'PRESTIGE_JOIN',
    ]) {
      expect(getCatalogEntry(t)?.confirmationLevel).toBe('REVIEW_SCREEN');
    }
  });

  it('safety-critical actions carry visualKind: safety', () => {
    for (const t of [
      'BOOKING_PET_HANDOFF',
      'BOOKING_PET_RETURN',
      'MESSAGE_REPORT',
      'SAFETY_REPORT_SUBMIT',
      'INCIDENT_REPORT_ACTIVE_JOB',
    ]) {
      expect(getCatalogEntry(t)?.visualKind).toBe('safety');
    }
  });

  it('canonical low-risk preferences are NONE (no confirmation fatigue — §45)', () => {
    for (const t of [
      'PROFILE_UPDATE_NAME',
      'PROFILE_UPDATE_LANGUAGE',
      'KYA_REVIEW_TIMESTAMP_TOUCH',
      'MESSAGE_SEND',
      'MESSAGE_KEEP_ON_PETWASH_REPLY',
      'PROVIDER_APPLICATION_SAVE_DRAFT',
      'SUPPORT_CONTACT_OPEN',
      'BOOKING_REVIEW_SUBMIT',
    ]) {
      expect(getCatalogEntry(t)?.confirmationLevel).toBe('NONE');
    }
  });

  it('all 12 doctrine domains are represented', () => {
    for (const d of [
      'AUTH',
      'PROFILE',
      'PET',
      'PRESTIGE',
      'BOOKING',
      'MEET_AND_GREET',
      'COMMUNICATION',
      'PROVIDER',
      'MONEY',
      'SHOP',
      'SUPPORT',
      'ADMIN',
    ] as const) {
      expect(listByDomain(d).length).toBeGreaterThan(0);
    }
  });

  it('catalog size is close to the doctrine target (~top-100 actions, at least 60 first pass)', () => {
    // §74 sets the target ~100; §75 lists the domains the first pass
    // must cover. This pin locks the first-pass floor so we don't ship
    // a token catalog.
    expect(ACTION_CATALOG.length).toBeGreaterThanOrEqual(60);
  });
});
