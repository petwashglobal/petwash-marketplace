/**
 * Refund → SUMIT credit: authority, over-credit and recovery.
 * Fixtures only. No SUMIT call, no document issued, credited or modified.
 */
import { describe, it, expect } from 'vitest';
import {
  ORIGINAL_RESOLUTION_SOURCE as SRC, REFUND_STATE, REFUND_BLOCKER,
  refundExternalReference, refundBlockers, mayIssueCredit,
  remainingCreditableMinor, recoveryDecision, interpretCreditResult,
  type RefundEventView,
} from '../services/nayaxRefundRail';

const REG = new Set(['182374', '182403', '182443', '182462']);
const known = (m?: string) => !!m && REG.has(m);

const ev = (o: Partial<RefundEventView> = {}): RefundEventView => ({
  refundTransactionId: '6990000517', machineId: '182443',
  amountMinor: 4800, currency: 'ILS',
  originalTransactionId: '4595298208',
  originalResolutionSource: SRC.NAYAX_AUTHORITATIVE,
  originalFiscalDocumentId: 'DOC-1', originalAmountMinor: 4800,
  confirmedCreditedMinor: 0, reversalIsFinal: true,
  // Added 2026-09-06: a credit must carry the Nayax close of the REFUND as its
  // fiscal date, so the happy-path fixture now supplies one. Its absence is a
  // blocker in its own right — pinned below.
  refundSettledAt: new Date('2026-09-05T09:30:00Z'),
  ...o,
});

describe('refund identity is the refund event, never the sale', () => {
  it('keys on the Nayax refund transaction id', () => {
    expect(refundExternalReference('6990000517')).toBe('nayax-credit:6990000517');
  });
  it('gives two refunds against one sale distinct references', () => {
    expect(refundExternalReference('4360000783'))
      .not.toBe(refundExternalReference('4360000781'));
  });
});

describe('only authoritative parentage authorises a credit', () => {
  it('allows a Nayax-authoritative original', () => {
    expect(mayIssueCredit(ev(), known)).toBe(true);
  });

  it('allows a human-resolved original', () => {
    expect(mayIssueCredit(ev({ originalResolutionSource: SRC.HUMAN_RESOLVED }), known)).toBe(true);
  });

  // THE CENTRAL RULE. One heuristic candidate is still a heuristic candidate:
  // 23.6% of card sales are not uniquely identified by (card, machine, amount),
  // so "exactly one match" is an artefact of the window, not proof of parentage.
  it('BLOCKS a single heuristic candidate — one guess is still a guess', () => {
    const e = ev({ originalResolutionSource: SRC.HEURISTIC_SUGGESTION });
    expect(refundBlockers(e, known)).toContain(REFUND_BLOCKER.ORIGINAL_NOT_AUTHORITATIVE);
    expect(mayIssueCredit(e, known)).toBe(false);
  });

  it('blocks when no original has been resolved at all', () => {
    expect(refundBlockers(ev({ originalTransactionId: null }), known))
      .toContain(REFUND_BLOCKER.NO_ORIGINAL);
  });

  it('blocks when the original has no fiscal document of its own', () => {
    expect(refundBlockers(ev({ originalFiscalDocumentId: null }), known))
      .toContain(REFUND_BLOCKER.NO_ORIGINAL_FISCAL_DOCUMENT);
  });

  it('blocks a reversal that is not final', () => {
    expect(refundBlockers(ev({ reversalIsFinal: false }), known))
      .toContain(REFUND_BLOCKER.REVERSAL_NOT_FINAL);
  });

  it('blocks an unregistered machine', () => {
    expect(refundBlockers(ev({ machineId: '999999' }), known))
      .toContain(REFUND_BLOCKER.UNKNOWN_MACHINE);
  });

  it('reports every blocker at once, not just the first', () => {
    const b = refundBlockers(ev({
      originalTransactionId: null, machineId: '999999', reversalIsFinal: false,
    }), known);
    expect(b).toEqual(expect.arrayContaining([
      REFUND_BLOCKER.NO_ORIGINAL, REFUND_BLOCKER.UNKNOWN_MACHINE,
      REFUND_BLOCKER.REVERSAL_NOT_FINAL,
    ]));
  });
});

describe('over-credit protection works on money, not link counts', () => {
  it('computes headroom from amounts', () => {
    expect(remainingCreditableMinor(4800, 0)).toBe(4800);
    expect(remainingCreditableMinor(4800, 2000)).toBe(2800);
    expect(remainingCreditableMinor(4800, 4800)).toBe(0);
  });

  it('allows a partial refund inside the remaining balance', () => {
    expect(mayIssueCredit(ev({ amountMinor: 2000, confirmedCreditedMinor: 0 }), known)).toBe(true);
  });

  it('allows a SECOND partial refund inside what remains', () => {
    expect(mayIssueCredit(ev({
      refundTransactionId: '6990000518', amountMinor: 2800, confirmedCreditedMinor: 2000,
    }), known)).toBe(true);
  });

  it('blocks a second refund that would exceed the original', () => {
    const e = ev({ refundTransactionId: '6990000518', amountMinor: 3000, confirmedCreditedMinor: 2000 });
    expect(refundBlockers(e, known)).toContain(REFUND_BLOCKER.EXCEEDS_REMAINING);
  });

  it('blocks crediting an already fully-credited sale', () => {
    expect(mayIssueCredit(ev({ confirmedCreditedMinor: 4800 }), known)).toBe(false);
  });

  // An unreadable balance is NOT headroom.
  it('treats an unknown original amount as no headroom, never as unlimited', () => {
    expect(remainingCreditableMinor(null, 0)).toBeNull();
    expect(refundBlockers(ev({ originalAmountMinor: null }), known))
      .toContain(REFUND_BLOCKER.EXCEEDS_REMAINING);
  });

  it('blocks a non-positive refund amount', () => {
    expect(refundBlockers(ev({ amountMinor: 0 }), known))
      .toContain(REFUND_BLOCKER.NON_POSITIVE_AMOUNT);
  });
});

describe('recovery — a second ambiguous create is forbidden', () => {
  it('links and marks issued when the document is FOUND', () => {
    const d = recoveryDecision({ outcome: 'FOUND' }, 1);
    expect(d).toMatchObject({ state: REFUND_STATE.ISSUED, recreate: false });
  });

  it('permits exactly one recreate on a definitive ABSENT', () => {
    expect(recoveryDecision({ outcome: 'ABSENT' }, 1)).toMatchObject({ recreate: true });
    expect(recoveryDecision({ outcome: 'ABSENT' }, 2)).toMatchObject({
      recreate: false, state: REFUND_STATE.NEEDS_RECONCILIATION,
    });
  });

  it('NEVER recreates on INCONCLUSIVE', () => {
    const d = recoveryDecision({ outcome: 'INCONCLUSIVE' }, 1);
    expect(d.recreate).toBe(false);
    expect(d.state).toBe(REFUND_STATE.NEEDS_RECONCILIATION);
  });

  // The reference exists — just not under the type we searched for.
  it('NEVER recreates when the reference exists under an unexpected type', () => {
    const d = recoveryDecision({ outcome: 'FOUND_MISMATCH' }, 1);
    expect(d.recreate).toBe(false);
    expect(d.state).toBe(REFUND_STATE.NEEDS_RECONCILIATION);
  });

  it('only ABSENT ever authorises a create', () => {
    for (const o of ['FOUND', 'FOUND_MISMATCH', 'INCONCLUSIVE'] as const) {
      expect(recoveryDecision({ outcome: o }, 1).recreate).toBe(false);
    }
  });
});

describe('createCreditDocument never throws — so silence is not success', () => {
  it('treats a returned document id as the ONLY confirmation', () => {
    expect(interpretCreditResult({ wired: true, sumitDocumentId: 'CR-9' }))
      .toMatchObject({ state: REFUND_STATE.ISSUED, documentId: 'CR-9' });
  });

  it('does not mark issued when no document id came back', () => {
    for (const r of [
      { wired: true, sumitDocumentId: null, reason: 'sumit_error' },
      { wired: false },
      null,
      undefined,
    ]) {
      expect(interpretCreditResult(r as any).state).toBe(REFUND_STATE.PENDING_LOOKUP);
    }
  });

  it('a resolved promise alone never means the credit exists', () => {
    expect(interpretCreditResult({ wired: true } as any).state).not.toBe(REFUND_STATE.ISSUED);
  });
});

describe('a credit with no Nayax close is withheld (bookkeeper dating rule, 2026-09-06)', () => {
  it('blocks when the refund settlement instant is missing', () => {
    expect(refundBlockers(ev({ refundSettledAt: null }), known))
      .toContain(REFUND_BLOCKER.NO_REFUND_SETTLEMENT_TIME);
    expect(mayIssueCredit(ev({ refundSettledAt: undefined }), known)).toBe(false);
  });

  it('blocks when the instant is present but unusable', () => {
    expect(refundBlockers(ev({ refundSettledAt: new Date('nonsense') }), known))
      .toContain(REFUND_BLOCKER.NO_REFUND_SETTLEMENT_TIME);
  });

  it('does not block when a real close is present', () => {
    expect(refundBlockers(ev(), known)).not.toContain(REFUND_BLOCKER.NO_REFUND_SETTLEMENT_TIME);
    expect(mayIssueCredit(ev(), known)).toBe(true);
  });
});
