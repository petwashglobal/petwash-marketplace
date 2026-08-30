/**
 * CommunicationScopingService — CEO PROGRAM 8 (Chat Experience).
 *
 * Pure evaluator. Given an entity (booking A, booking B, shop order,
 * meet-and-greet, support case) and the actor + counterparty,
 * decides the canonical thread key so:
 *   • Booking A chat is separate from Booking B chat.
 *   • Support is separate from booking chat.
 *   • Shop order support is separate.
 *   • Meet & Greet gets its own thread when the product requires it.
 *
 * The evaluator also decides the CommunicationStatusCode the thread
 * should be in for the actor (§84 CommunicationState.status).
 */

export type CommsEntityKind =
  | 'booking'
  | 'shop_order'
  | 'gift'
  | 'meet_greet'
  | 'support_case'
  | 'provider_application';

export interface ThreadKeyInput {
  entityKind: CommsEntityKind;
  entityId: string;
  /** True if a separate support thread should be spun off from the entity thread. */
  isSupportEscalation?: boolean;
}

/**
 * Returns a stable thread key that never collides across entities.
 * The `entity:id` pattern keeps threads bounded to the entity;
 * `support:` prefix separates a support escalation from the entity
 * thread even when they share an entityId.
 */
export function threadKeyFor(input: ThreadKeyInput): string {
  const base = `${input.entityKind}:${input.entityId}`;
  if (input.isSupportEscalation) return `support:${base}`;
  return base;
}

export type CommsStatusCode = 'OPEN' | 'READ_ONLY' | 'ARCHIVED' | 'NO_THREAD_YET';

export interface CommsStatusInput {
  entityCurrentState: string;                  // e.g. 'CONFIRMED', 'COMPLETED', 'CANCELLED'
  threadExists: boolean;
  readOnlyStates?: string[];
  archivedStates?: string[];
}

/**
 * READ_ONLY when the entity is in a "closed" phase where new messages
 * should NOT be sent but existing history remains visible. ARCHIVED
 * when the entity itself is terminal AND the product chose to fold
 * the thread away (opt-in via archivedStates).
 */
export function statusFor(input: CommsStatusInput): CommsStatusCode {
  if (!input.threadExists) return 'NO_THREAD_YET';
  const state = (input.entityCurrentState || '').toUpperCase();
  if (input.archivedStates?.map((s) => s.toUpperCase()).includes(state)) return 'ARCHIVED';
  if (input.readOnlyStates?.map((s) => s.toUpperCase()).includes(state)) return 'READ_ONLY';
  return 'OPEN';
}
