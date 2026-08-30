/**
 * Permission matrix — CEO Business Doctrine §16, §14.8, §72.
 *
 * The doctrine's permission table encoded as pure predicates. Every
 * route that answers "can this actor do X to this entity" MUST go
 * through this module — do not fork the check.
 *
 * Rules:
 *   • Authority derives from (authenticatedUid, entity-relationship).
 *   • Never trust body `customerId | providerId | ownerId` (§14.8).
 *   • Workspace hint is view-only; transaction role wins (§72).
 *   • Staff / admin scope is separately audited.
 */
import type { WorkspaceContext } from './actors';

// ── Shared context shape ─────────────────────────────────────────────

export interface BookingRel {
  bookerUid: string;
  providerUid: string;
  bookingPhase: 'DRAFT' | 'REQUESTED' | 'QUOTED' | 'ACCEPTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  paymentPhase: 'NOT_REQUIRED' | 'UNPAID' | 'PENDING' | 'AUTHORIZED' | 'PAID' | 'PARTIAL_REFUND' | 'REFUNDED' | 'FAILED';
}

export interface StaffScope {
  isStaff: boolean;
  scope?: 'support' | 'finance' | 'trust_safety' | 'admin' | 'super_admin';
}

export interface PermissionActor {
  uid: string;
  workspaceHint: WorkspaceContext | 'UNKNOWN';
  staff?: StaffScope;
}

// ── Booking permissions ──────────────────────────────────────────────

function isBookingParty(actor: PermissionActor, rel: BookingRel): boolean {
  return actor.uid === rel.bookerUid || actor.uid === rel.providerUid;
}

function isStaff(actor: PermissionActor): boolean {
  return actor.staff?.isStaff === true;
}

export function canReadBooking(actor: PermissionActor, rel: BookingRel): boolean {
  return isBookingParty(actor, rel) || isStaff(actor);
}

export function canMessageOnBookingThread(
  actor: PermissionActor,
  rel: BookingRel,
  policyEngineAllowed: boolean,
): boolean {
  if (!isBookingParty(actor, rel) && !isStaff(actor)) return false;
  return policyEngineAllowed;
}

/**
 * Chat cannot change price. Only structured quote actions do (§57).
 * This helper is what the SEND_REVISED_QUOTE handler consults BEFORE
 * writing.
 */
export function canProposeBookingPriceChange(
  actor: PermissionActor,
  rel: BookingRel,
): boolean {
  if (actor.uid !== rel.providerUid) return false;
  // Provider can revise up until the customer has locked (CONFIRMED).
  return (
    rel.bookingPhase === 'REQUESTED' ||
    rel.bookingPhase === 'QUOTED' ||
    rel.bookingPhase === 'ACCEPTED' ||
    rel.bookingPhase === 'IN_PROGRESS'
  );
}

export function canAcceptRevisedQuote(
  actor: PermissionActor,
  rel: BookingRel,
): boolean {
  // Only the BOOKER accepts a revised price the provider proposed.
  return actor.uid === rel.bookerUid && rel.bookingPhase !== 'CANCELLED' && rel.bookingPhase !== 'COMPLETED';
}

export function canCancelBooking(actor: PermissionActor, rel: BookingRel): boolean {
  if (!isBookingParty(actor, rel) && !isStaff(actor)) return false;
  return (
    rel.bookingPhase === 'REQUESTED' ||
    rel.bookingPhase === 'QUOTED' ||
    rel.bookingPhase === 'ACCEPTED' ||
    rel.bookingPhase === 'CONFIRMED' ||
    rel.bookingPhase === 'IN_PROGRESS'
  );
}

export function canAddPetMidBooking(
  actor: PermissionActor,
  rel: BookingRel,
): boolean {
  if (!isBookingParty(actor, rel)) return false;
  // Provider proposes + customer accepts, or vice versa; either party
  // may initiate the structured request.
  return rel.bookingPhase === 'CONFIRMED' || rel.bookingPhase === 'IN_PROGRESS';
}

/**
 * Owner contact reveal ladder (§11.1). Pre-booking = no reveal;
 * confirmed = masked; in-progress = prominent; completed = expires.
 * Emergency access is a SEPARATE structured action per §14.4.
 */
export function canAccessOwnerContact(
  actor: PermissionActor,
  rel: BookingRel,
): boolean {
  if (actor.uid !== rel.providerUid && !isStaff(actor)) return false;
  return rel.bookingPhase === 'CONFIRMED' || rel.bookingPhase === 'IN_PROGRESS';
}

/**
 * Emergency contact + vet info during ACTIVE service. Safety beats
 * marketplace-leakage concerns (§14.4). Distinct from casual owner
 * contact reveal — this is authorized structured access during a live
 * job only.
 */
export function canAccessEmergencyInfo(
  actor: PermissionActor,
  rel: BookingRel,
): boolean {
  if (actor.uid !== rel.providerUid) return false;
  return rel.bookingPhase === 'IN_PROGRESS';
}

// ── Earnings + fiscal document scoping ────────────────────────────────

export interface EarningsRequest {
  requestedForUid: string;
  actor: PermissionActor;
}

export function canReadProviderEarnings(req: EarningsRequest): boolean {
  return req.actor.uid === req.requestedForUid || isStaff(req.actor);
}

export interface FiscalDocumentRequest {
  kind: 'CUSTOMER_RECEIPT' | 'PROVIDER_EARNINGS';
  ownerUid: string;                    // buyer or provider
  actor: PermissionActor;
}

export function canReadFiscalDocument(req: FiscalDocumentRequest): boolean {
  if (isStaff(req.actor)) return true;
  return req.actor.uid === req.ownerUid;
}

// ── Self-booking guard (§14.4) ────────────────────────────────────────

export function isSelfBookingAttempt(rel: BookingRel): boolean {
  return rel.bookerUid === rel.providerUid;
}

// ── Admin actions ─────────────────────────────────────────────────────

export function canPerformAdminAction(
  actor: PermissionActor,
  action: 'search' | 'refund_large' | 'suspend_provider' | 'bulk_message' | 'bulk_suspend',
): boolean {
  if (!isStaff(actor)) return false;
  const scope = actor.staff?.scope;
  switch (action) {
    case 'search':
      return scope !== undefined;             // any staff can search
    case 'refund_large':
      return scope === 'finance' || scope === 'admin' || scope === 'super_admin';
    case 'suspend_provider':
      return scope === 'trust_safety' || scope === 'admin' || scope === 'super_admin';
    case 'bulk_message':
      return scope === 'admin' || scope === 'super_admin';
    case 'bulk_suspend':
      return scope === 'super_admin';         // only super_admin
  }
}
