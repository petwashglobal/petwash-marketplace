/**
 * AvailableActionsResolver — Meet & Greet + Prestige + Provider Application
 * behavior pins (doctrine §40 / integrity §4, §6, §14 / business §17.7).
 */
import { describe, it, expect } from 'vitest';
import {
  meetGreetAvailableActions,
  prestigeAvailableActions,
  providerApplicationAvailableActions,
  type MeetGreetActionContext,
  type PrestigeActionContext,
  type ProviderApplicationActionContext,
} from '../services/marketplace/AvailableActionsResolver';

function has(actions: { type: string }[], type: string): boolean {
  return actions.some((a) => a.type === type);
}

const mgCtx = (o: Partial<MeetGreetActionContext> = {}): MeetGreetActionContext => ({
  participant: 'PROVIDER',
  phase: 'PROPOSED',
  bothPartiesAcknowledged: true,
  ...o,
});

// ── Meet & Greet ──────────────────────────────────────────────────────

describe('Meet & Greet availability (integrity §4 / §6)', () => {
  it('provider on PROPOSED with both-acks sees ACCEPT + SUGGEST_TIME + DECLINE', () => {
    const list = meetGreetAvailableActions(mgCtx());
    expect(has(list, 'MEET_GREET_ACCEPT')).toBe(true);
    expect(has(list, 'MEET_GREET_SUGGEST_TIME')).toBe(true);
    expect(has(list, 'MEET_GREET_DECLINE')).toBe(true);
  });

  it('missing acknowledgements → ACCEPT hidden; MEET_GREET_ACKNOWLEDGE surfaced (integrity §6)', () => {
    const list = meetGreetAvailableActions(mgCtx({ bothPartiesAcknowledged: false }));
    expect(has(list, 'MEET_GREET_ACCEPT')).toBe(false);
    expect(has(list, 'MEET_GREET_ACKNOWLEDGE')).toBe(true);
  });

  it('customer on PROPOSED cannot ACCEPT on the provider\'s behalf', () => {
    const list = meetGreetAvailableActions(mgCtx({ participant: 'CUSTOMER' }));
    expect(has(list, 'MEET_GREET_ACCEPT')).toBe(false);
    expect(has(list, 'MEET_GREET_DECLINE')).toBe(true);
  });

  it('CONFIRMED phase surfaces COMPLETE (either party)', () => {
    const provider = meetGreetAvailableActions(mgCtx({ phase: 'CONFIRMED' }));
    const customer = meetGreetAvailableActions(mgCtx({ phase: 'CONFIRMED', participant: 'CUSTOMER' }));
    expect(has(provider, 'MEET_GREET_COMPLETE')).toBe(true);
    expect(has(customer, 'MEET_GREET_COMPLETE')).toBe(true);
  });

  it('COMPLETED → fast rebook via BOOKING_REQUEST_SUBMIT (customer only)', () => {
    const customer = meetGreetAvailableActions(mgCtx({ phase: 'COMPLETED', participant: 'CUSTOMER' }));
    const provider = meetGreetAvailableActions(mgCtx({ phase: 'COMPLETED', participant: 'PROVIDER' }));
    expect(has(customer, 'BOOKING_REQUEST_SUBMIT')).toBe(true);
    expect(has(provider, 'BOOKING_REQUEST_SUBMIT')).toBe(false);
  });

  it('CANCELLED / COMPLETED never surface ACCEPT / SUGGEST_TIME / DECLINE', () => {
    for (const phase of ['CANCELLED', 'COMPLETED'] as const) {
      const list = meetGreetAvailableActions(mgCtx({ phase }));
      expect(has(list, 'MEET_GREET_ACCEPT')).toBe(false);
      expect(has(list, 'MEET_GREET_SUGGEST_TIME')).toBe(false);
      expect(has(list, 'MEET_GREET_DECLINE')).toBe(false);
    }
  });

  it('SUPPORT_CONTACT_OPEN always available on a Meet & Greet thread', () => {
    for (const phase of ['PROPOSED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const) {
      const list = meetGreetAvailableActions(mgCtx({ phase }));
      expect(has(list, 'SUPPORT_CONTACT_OPEN')).toBe(true);
    }
  });
});

// ── Prestige ──────────────────────────────────────────────────────────

const pCtx = (o: Partial<PrestigeActionContext> = {}): PrestigeActionContext => ({
  status: 'NONE',
  hasVerifiedEmail: true,
  hasVerifiedMobile: true,
  ...o,
});

describe('Prestige availability (integrity §14)', () => {
  it('NONE with verified contacts → PRESTIGE_JOIN enabled + requiresPreview', () => {
    const list = prestigeAvailableActions(pCtx());
    const join = list.find((a) => a.type === 'PRESTIGE_JOIN')!;
    expect(join.enabled).toBe(true);
    expect(join.requiresPreview).toBe(true);
  });

  it('NONE with missing verified contact → JOIN disabled + CONSENT_REQUIRED reasonCode', () => {
    const noEmail = prestigeAvailableActions(pCtx({ hasVerifiedEmail: false }));
    const j1 = noEmail.find((a) => a.type === 'PRESTIGE_JOIN')!;
    expect(j1.enabled).toBe(false);
    expect(j1.reasonCode).toBe('CONSENT_REQUIRED');

    const noMobile = prestigeAvailableActions(pCtx({ hasVerifiedMobile: false }));
    const j2 = noMobile.find((a) => a.type === 'PRESTIGE_JOIN')!;
    expect(j2.enabled).toBe(false);
  });

  it('ACTIVE → JOIN hidden, CANCEL_MEMBERSHIP surfaced', () => {
    const list = prestigeAvailableActions(pCtx({ status: 'ACTIVE' }));
    expect(has(list, 'PRESTIGE_JOIN')).toBe(false);
    expect(has(list, 'PRESTIGE_CANCEL_MEMBERSHIP')).toBe(true);
  });

  it('CANCELLED → JOIN surfaced (re-join path)', () => {
    const list = prestigeAvailableActions(pCtx({ status: 'CANCELLED' }));
    expect(has(list, 'PRESTIGE_JOIN')).toBe(true);
    expect(has(list, 'PRESTIGE_CANCEL_MEMBERSHIP')).toBe(false);
  });
});

// ── Provider Application ──────────────────────────────────────────────

const paCtx = (o: Partial<ProviderApplicationActionContext> = {}): ProviderApplicationActionContext => ({
  participant: 'APPLICANT',
  phase: 'READY_TO_SUBMIT',
  hasAcceptedActiveAgreement: true,
  missingChecklistItems: 0,
  ...o,
});

describe('Provider Application availability (business §17.7)', () => {
  it('READY_TO_SUBMIT with agreement accepted + 0 missing items → SUBMIT enabled', () => {
    const list = providerApplicationAvailableActions(paCtx());
    const s = list.find((a) => a.type === 'PROVIDER_APPLICATION_SUBMIT')!;
    expect(s.enabled).toBe(true);
  });

  it('READY_TO_SUBMIT with missing checklist items → SUBMIT disabled + reasonCode', () => {
    const list = providerApplicationAvailableActions(paCtx({ missingChecklistItems: 2 }));
    const s = list.find((a) => a.type === 'PROVIDER_APPLICATION_SUBMIT')!;
    expect(s.enabled).toBe(false);
    expect(s.reasonCode).toBe('CONSENT_REQUIRED');
  });

  it('READY_TO_SUBMIT without agreement → SUBMIT disabled + AGREEMENT_REACCEPTANCE_REQUIRED', () => {
    const list = providerApplicationAvailableActions(paCtx({ hasAcceptedActiveAgreement: false }));
    const s = list.find((a) => a.type === 'PROVIDER_APPLICATION_SUBMIT')!;
    expect(s.enabled).toBe(false);
    expect(s.reasonCode).toBe('AGREEMENT_REACCEPTANCE_REQUIRED');
    // AGREEMENT_ACCEPT surfaces so the applicant can complete the gate.
    expect(has(list, 'PROVIDER_AGREEMENT_ACCEPT')).toBe(true);
  });

  it('DRAFT surfaces SAVE_DRAFT + ADD/REMOVE service + UPLOAD_ID', () => {
    const list = providerApplicationAvailableActions(paCtx({ phase: 'DRAFT' }));
    expect(has(list, 'PROVIDER_APPLICATION_SAVE_DRAFT')).toBe(true);
    expect(has(list, 'PROVIDER_APPLICATION_ADD_SERVICE')).toBe(true);
    expect(has(list, 'PROVIDER_APPLICATION_REMOVE_SERVICE')).toBe(true);
    expect(has(list, 'PROVIDER_APPLICATION_UPLOAD_ID')).toBe(true);
    // Not submittable yet from DRAFT — must reach READY_TO_SUBMIT first.
    expect(has(list, 'PROVIDER_APPLICATION_SUBMIT')).toBe(false);
  });

  it('CHANGES_REQUESTED allows UPLOAD_ID + SAVE_DRAFT + WITHDRAW', () => {
    const list = providerApplicationAvailableActions(paCtx({ phase: 'CHANGES_REQUESTED' }));
    expect(has(list, 'PROVIDER_APPLICATION_UPLOAD_ID')).toBe(true);
    expect(has(list, 'PROVIDER_APPLICATION_SAVE_DRAFT')).toBe(true);
    expect(has(list, 'PROVIDER_APPLICATION_WITHDRAW')).toBe(true);
  });

  it('SUBMITTED / UNDER_REVIEW surface WITHDRAW only (not SUBMIT again)', () => {
    for (const phase of ['SUBMITTED', 'UNDER_REVIEW'] as const) {
      const list = providerApplicationAvailableActions(paCtx({ phase }));
      expect(has(list, 'PROVIDER_APPLICATION_WITHDRAW')).toBe(true);
      expect(has(list, 'PROVIDER_APPLICATION_SUBMIT')).toBe(false);
    }
  });

  it('APPROVED / REJECTED / WITHDRAWN never surface SUBMIT or WITHDRAW', () => {
    for (const phase of ['APPROVED', 'REJECTED', 'WITHDRAWN'] as const) {
      const list = providerApplicationAvailableActions(paCtx({ phase }));
      expect(has(list, 'PROVIDER_APPLICATION_SUBMIT')).toBe(false);
      expect(has(list, 'PROVIDER_APPLICATION_WITHDRAW')).toBe(false);
    }
  });
});
