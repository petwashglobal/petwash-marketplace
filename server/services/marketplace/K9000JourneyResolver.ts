/**
 * K9000JourneyResolver — CEO NEXT-AUTO §14 refill.
 *
 * JourneyState for a K9000 station session. States drawn from the
 * existing station-payment lifecycle (initiated / authorized /
 * vend_pending / vend_success / settled / voided / failed / refunded).
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type MoneyState,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type K9000SessionStatus =
  | 'initiated'
  | 'authorized'
  | 'vend_pending'
  | 'vend_success'
  | 'settled'
  | 'voided'
  | 'failed'
  | 'refunded';

export interface K9000JourneySnapshot {
  sessionId: string;
  status: K9000SessionStatus;
  customerUid: string;
  stationId: string;
  amountCents: number;
  currency?: 'ILS';
}

export function resolveK9000Journey(input: { snapshot: K9000JourneySnapshot; actorUid: string }): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'k9000_session', id: s.sessionId };
  const actor: JourneyState['actor'] = { role: 'CUSTOMER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const money: MoneyState = { amountCents: s.amountCents, currency: 'ILS', labelCode: 'STATION_AMOUNT' };
  const [waitingOn, obligations, primary, priority] = classify(s);
  return {
    ...base,
    waitingOn,
    obligations,
    money,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
    deadlines: [],
  };
}

function classify(s: K9000JourneySnapshot): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'initiated':
    case 'authorized':
      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'STATION_STARTING' }], 'VIEW_STATION_SESSION', 'MEDIUM'];
    case 'vend_pending':
      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'STATION_VEND_PENDING' }], 'VIEW_STATION_SESSION', 'HIGH'];
    case 'vend_success':
    case 'settled':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'STATION_SUCCESS' }], 'VIEW_RECEIPT', 'INFO'];
    case 'failed':
      return ['PETWASH', [{ type: 'NONE', severity: 'REQUIRED', reasonCode: 'STATION_FAILED' }], 'CONTACT_SUPPORT', 'HIGH'];
    case 'voided':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'STATION_VOIDED' }], 'VIEW_STATION_SESSION', 'INFO'];
    case 'refunded':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'REFUNDED' }], 'VIEW_REFUND_STATUS', 'INFO'];
    default:
      return ['NONE', [], undefined, 'INFO'];
  }
}
