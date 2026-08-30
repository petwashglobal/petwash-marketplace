/**
 * SupportCaseJourneyLoader — CEO DEEP-LOGIC §84 loader for kind=support_case.
 *
 * Support cases don't have a durable table yet — the pure evaluator
 * in SupportCaseService returns SupportCase records that live only
 * in the caller's memory. We expose a small SupportCaseStore
 * interface so this loader can be wired against:
 *   • an in-memory Map (dev / seeded scenarios),
 *   • an eventual Postgres table without touching the loader body.
 *
 * §72 discipline: NEVER fabricate a case. If the store has no entry
 * for the id → NOT_FOUND. If the actor is not the opener or the
 * assigned support owner → NOT_A_PARTY.
 */
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import { resolveSupportCaseJourney } from '../SupportCaseJourneyResolver';
import type { SupportCase } from '../SupportCaseService';

export interface SupportCaseStore {
  getById(caseId: string): Promise<SupportCase | undefined> | (SupportCase | undefined);
}

/** Small in-memory store — the default. Callers can `.put()` cases to it. */
export class InMemorySupportCaseStore implements SupportCaseStore {
  private byId = new Map<string, SupportCase>();
  put(sc: SupportCase): void { this.byId.set(sc.caseId, sc); }
  getById(caseId: string): SupportCase | undefined { return this.byId.get(caseId); }
  clear(): void { this.byId.clear(); }
}

let defaultStore: SupportCaseStore = new InMemorySupportCaseStore();
export function getDefaultSupportCaseStore(): SupportCaseStore { return defaultStore; }
export function setDefaultSupportCaseStore(s: SupportCaseStore): void { defaultStore = s; }

/**
 * Map the persistent SupportCase status onto the resolver's per-actor
 * status. The resolver's OPEN/AWAITING_STAFF/AWAITING_CUSTOMER map to
 * different sides of the state machine; ADMIN_ASSIGNED means staff has
 * picked it up so the customer is waiting; PENDING_ACTOR uses the case's
 * own waitingOnRole to route the wait.
 */
function toResolverStatus(sc: SupportCase): 'OPEN' | 'AWAITING_STAFF' | 'AWAITING_CUSTOMER' | 'RESOLVED_PENDING_CONFIRMATION' | 'CLOSED' {
  switch (sc.status) {
    case 'OPEN':            return 'OPEN';
    case 'ADMIN_ASSIGNED':  return 'AWAITING_STAFF';
    case 'PENDING_ACTOR':   return sc.waitingOnRole === 'CUSTOMER' || sc.waitingOnRole === 'PROVIDER' ? 'AWAITING_CUSTOMER' : 'AWAITING_STAFF';
    case 'RESOLVED':        return 'RESOLVED_PENDING_CONFIRMATION';
    case 'CLOSED':          return 'CLOSED';
    default:                return 'OPEN';
  }
}

export function makeSupportCaseJourneyLoader(store: SupportCaseStore = getDefaultSupportCaseStore()): JourneyLoader {
  return async ({ id, actorUid }): Promise<LoaderOutcome> => {
    try {
      const sc = await store.getById(id);
      if (!sc) return { code: 'NOT_FOUND' };

      const isOpener = sc.openedBy === actorUid;
      const isStaff  = sc.supportOwnerUid === actorUid;
      if (!isOpener && !isStaff) return { code: 'NOT_A_PARTY' };

      const actorRole = isStaff ? 'STAFF' : 'OPENER';
      const journey = resolveSupportCaseJourney({
        snapshot: {
          caseId: sc.caseId,
          status: toResolverStatus(sc),
          openerUid: sc.openedBy,
          assignedStaffUid: sc.supportOwnerUid,
        },
        actorUid,
        actorRole,
      });
      return { code: 'OK', journey };
    } catch {
      return { code: 'NOT_FOUND' };
    }
  };
}

export const supportCaseJourneyLoader: JourneyLoader = (input) =>
  makeSupportCaseJourneyLoader()(input);
