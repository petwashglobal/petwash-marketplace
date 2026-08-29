/**
 * ActingContextResolver — Business Doctrine §3.3, §14.8.
 *
 * Every business-scoped request resolves its ActingContext (actorUid,
 * workspaceContext, transactionRole) BEFORE authorising anything. The
 * doctrine forbids UI selection + body input from granting authority
 * (§14.8). This resolver derives all three from:
 *
 *   1. The authenticated Firebase uid (Bearer / session) — never body.
 *   2. The entity relationship (booking parties, order buyer, thread party).
 *   3. The workspace hint from the URL / header (which is UI selection,
 *      informational only — it decides VIEW, not authority).
 *
 * The resolver is PURE — callers pass in the entity relationship they
 * already looked up. Keeping it dep-free means it can run inside routes,
 * middleware, or subagent workflows without pulling in the DB layer.
 */
import type {
  ActingContext,
  TransactionRole,
  WorkspaceContext,
} from '../../../shared/marketplace/actors';

/** The workspace the UI is currently rendering. Hint only — not authority. */
export type WorkspaceHint = WorkspaceContext | 'UNKNOWN';

export interface BookingActors {
  bookerUid: string;
  providerUid: string;
}

export interface ShopOrderActors {
  buyerUid: string;
  // MERCHANT is always PetWash (or a partner merchant later); no uid field.
}

export interface EGiftActors {
  buyerUid: string;
  recipientUid?: string;
}

/**
 * Resolve the ActingContext for a booking transaction (§2 example table).
 * Throws when the caller is neither the booker nor the provider — the caller
 * must not be handling this booking at all.
 */
export function contextForBooking(
  actorUid: string,
  actors: BookingActors,
  hint: WorkspaceHint = 'UNKNOWN',
): ActingContext {
  const role = roleForBooking(actorUid, actors);
  if (role === null) {
    throw new Error('actor is not a party on this booking');
  }
  return {
    actorUid,
    workspaceContext: workspaceForBookingRole(role, hint),
    transactionRole: role,
  };
}

/**
 * Same for shop orders. Only the buyer + MERCHANT (system) can act; STAFF
 * from a support case is resolved through the SUPPORT context, not here.
 */
export function contextForShopOrder(
  actorUid: string,
  actors: ShopOrderActors,
  hint: WorkspaceHint = 'UNKNOWN',
): ActingContext {
  if (actorUid !== actors.buyerUid) {
    throw new Error('actor is not the buyer on this shop order');
  }
  return {
    actorUid,
    workspaceContext: hint === 'ADMIN' ? 'ADMIN' : 'PET_PARENT',
    transactionRole: 'BUYER',
  };
}

/**
 * eGift is buyer + recipient (business doctrine §43). Buyer holds the
 * receipt; recipient holds the entitlement.
 */
export function contextForEGift(
  actorUid: string,
  actors: EGiftActors,
  hint: WorkspaceHint = 'UNKNOWN',
): ActingContext {
  if (actorUid === actors.buyerUid) {
    return {
      actorUid,
      workspaceContext: hint === 'ADMIN' ? 'ADMIN' : 'PET_PARENT',
      transactionRole: 'BUYER',
    };
  }
  if (actorUid === actors.recipientUid) {
    return {
      actorUid,
      workspaceContext: hint === 'ADMIN' ? 'ADMIN' : 'PET_PARENT',
      transactionRole: 'RECIPIENT',
    };
  }
  throw new Error('actor is not a party on this eGift');
}

/**
 * Self-booking guard (§14.4, §53). Kept here so every future actor
 * resolver has one place to consult it — do not fork this check.
 */
export function isSelfBooking(actors: BookingActors): boolean {
  return actors.bookerUid === actors.providerUid;
}

function roleForBooking(uid: string, actors: BookingActors): TransactionRole | null {
  if (uid === actors.bookerUid && uid === actors.providerUid) {
    // Self-booking is BLOCKED elsewhere (§53); if a caller reaches this
    // branch with equal uids, treat them as BOOKER by convention so the
    // guard has a canonical shape to reject.
    return 'BOOKER';
  }
  if (uid === actors.bookerUid) return 'BOOKER';
  if (uid === actors.providerUid) return 'PROVIDER';
  return null;
}

/**
 * Workspace hint reconciliation.
 * If the UI says PROVIDER but the actor is the BOOKER on THIS booking, the
 * TRANSACTION ROLE wins. The workspace hint is view-only (§14.8) — but the
 * doctrine's §72 rule says: "workspace switch should preserve entity — a
 * booking where the actor is customer stays customer-shaped." So the
 * resolver refuses to render this booking under PROVIDER workspace, and
 * projects the workspace back to PET_PARENT.
 */
function workspaceForBookingRole(
  role: TransactionRole,
  hint: WorkspaceHint,
): WorkspaceContext {
  if (hint === 'ADMIN') return 'ADMIN';
  if (role === 'PROVIDER') return 'PROVIDER';
  return 'PET_PARENT';
}
