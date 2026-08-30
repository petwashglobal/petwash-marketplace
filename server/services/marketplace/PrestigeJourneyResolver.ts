/**
 * PrestigeJourneyResolver — CEO NEXT-AUTO §14 refill.
 *
 * JourneyState for the Prestige membership entitlement per actor.
 * Prestige is CAPABILITY, not a workspace (§21) — the JourneyState
 * carries entitlement status and the next best action.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type PrestigeStatus = 'NONE' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'CANCELLED';

export interface PrestigeJourneySnapshot {
  memberId?: string;
  actorUid: string;
  status: PrestigeStatus;
  hasVerifiedEmail?: boolean;
  hasVerifiedMobile?: boolean;
  freeWashesRemaining?: number;
  cashWalletCents?: number;
}

export function resolvePrestigeJourney(input: { snapshot: PrestigeJourneySnapshot }): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'prestige_member', id: s.memberId ?? s.actorUid };
  const actor: JourneyState['actor'] = { role: 'CUSTOMER', uid: s.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const [waitingOn, obligations, primary, priority] = classify(s);
  return {
    ...base,
    waitingOn,
    obligations,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
    deadlines: [],
  };
}

function classify(s: PrestigeJourneySnapshot): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'NONE':
      return ['CUSTOMER', [{ type: 'NONE', severity: 'OPTIONAL', reasonCode: 'JOIN_ELIGIBLE' }], 'PRESTIGE_JOIN', 'INFO'];
    case 'PENDING_VERIFICATION':
      return ['CUSTOMER', [{ type: 'NONE', severity: 'OPTIONAL', reasonCode: 'VERIFY_CONTACT' }], 'VERIFY_CONTACT', 'MEDIUM'];
    case 'ACTIVE':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'PRESTIGE_ACTIVE' }], 'VIEW_PRESTIGE_BENEFITS', 'INFO'];
    case 'CANCELLED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'CANCELLED' }], 'PRESTIGE_JOIN', 'INFO'];
    default:
      return ['NONE', [], undefined, 'INFO'];
  }
}
