/**
 * JourneyStateService — CEO DEEP-LOGIC §84-§87 dispatch.
 *
 * A single entry point that, given (kind, id, actorUid), loads the
 * durable snapshot for that entity, verifies the actor is a party
 * to it, and returns the JourneyState for that actor's projection.
 *
 * The service knows NOTHING about persistence — every kind registers
 * its own loader. Kinds without a registered loader return
 * `NOT_IMPLEMENTED` (the router surfaces 501), keeping the dispatch
 * surface honest instead of pretending an empty answer is real data.
 *
 * Doctrine discipline:
 *   • ActorUid comes from the auth token upstream; loaders receive it
 *     as the authoritative principal and MUST refuse ("NOT_A_PARTY")
 *     if the actor is not a party to the entity.
 *   • Loaders return `null` for missing entities → NOT_FOUND.
 *   • Loaders may return `{ snapshot, projection }` — projection is
 *     the pre-computed JourneyState — OR delegate to a resolver call
 *     inside themselves. The service does not re-compute.
 */
import type { JourneyState } from '@shared/marketplace/journeyState';

export type JourneyKind =
  | 'booking'
  | 'shop_order'
  | 'gift'
  | 'wallet_topup'
  | 'refund'
  | 'support_case'
  | 'provider_application'
  | 'prestige_member'
  | 'k9000_session'
  | 'pet'
  | 'payout';

export type LoaderOutcome =
  | { code: 'OK'; journey: JourneyState }
  | { code: 'NOT_FOUND' }
  | { code: 'NOT_A_PARTY' };

export type JourneyLoader = (
  input: { id: string; actorUid: string },
) => Promise<LoaderOutcome> | LoaderOutcome;

export type DispatchOutcome =
  | { code: 'OK'; journey: JourneyState }
  | { code: 'NOT_FOUND' }
  | { code: 'NOT_A_PARTY' }
  | { code: 'NOT_IMPLEMENTED'; kind: string }
  | { code: 'INVALID_KIND'; kind: string };

const VALID_KINDS = new Set<JourneyKind>([
  'booking', 'shop_order', 'gift', 'wallet_topup', 'refund',
  'support_case', 'provider_application', 'prestige_member',
  'k9000_session', 'pet', 'payout',
]);

export class JourneyStateService {
  private loaders = new Map<JourneyKind, JourneyLoader>();

  registerLoader(kind: JourneyKind, loader: JourneyLoader): void {
    this.loaders.set(kind, loader);
  }

  hasLoader(kind: JourneyKind): boolean {
    return this.loaders.has(kind);
  }

  async resolveJourney(
    kindRaw: string,
    id: string,
    actorUid: string,
  ): Promise<DispatchOutcome> {
    if (!VALID_KINDS.has(kindRaw as JourneyKind)) {
      return { code: 'INVALID_KIND', kind: kindRaw };
    }
    const kind = kindRaw as JourneyKind;
    const loader = this.loaders.get(kind);
    if (!loader) return { code: 'NOT_IMPLEMENTED', kind };
    const out = await loader({ id, actorUid });
    return out;
  }
}

/** Module-scoped default singleton (routes wire against this one). */
let defaultInstance: JourneyStateService | null = null;
export function getDefaultJourneyStateService(): JourneyStateService {
  if (!defaultInstance) defaultInstance = new JourneyStateService();
  return defaultInstance;
}

/** Tests only — replace the default with a fresh instance. */
export function __resetDefaultJourneyStateServiceForTests(): void {
  defaultInstance = null;
}
