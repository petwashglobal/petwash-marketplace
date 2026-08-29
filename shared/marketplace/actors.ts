/**
 * Shared marketplace actor + workspace types.
 *
 * Canonical source of truth for CEO Marketplace Business Doctrine §2, §3:
 *   USER IDENTITY != TRANSACTION ROLE.
 *   Every commercial transaction stores its ACTORS explicitly.
 *
 * See docs/architecture/petwash-marketplace-business-doctrine-2026.md
 */

export type WorkspaceContext = 'PET_PARENT' | 'PROVIDER' | 'ADMIN';

export type TransactionRole =
  | 'BOOKER'      // the party requesting/paying for a service (bookings)
  | 'PROVIDER'    // the party delivering a service (bookings)
  | 'BUYER'       // shop / eGift purchases
  | 'MERCHANT'    // PetWash or partner merchant
  | 'RECIPIENT'   // eGift recipient, refund payee where distinct
  | 'STAFF'       // internal staff / admin acting on behalf of platform
  | 'SYSTEM';     // machine-only actor (webhooks, cron)

/**
 * Every business-scoped request should be able to answer these three
 * questions independently. The server derives all three itself — never
 * from body input alone (business doctrine §14.8).
 */
export interface ActingContext {
  actorUid: string;
  workspaceContext: WorkspaceContext;
  transactionRole: TransactionRole;
}

/**
 * Actor participation in a transaction. Multiple actors per transaction
 * are allowed (e.g. eGift: buyer + recipient; booking: booker + provider).
 */
export interface TransactionActor {
  uid: string;
  role: TransactionRole;
}

/**
 * The extensible service catalog. New services join here after CEO
 * approval — never inline in a switch statement.
 */
export type ServiceType =
  | 'PET_SITTING'
  | 'DOG_WALKING'
  | 'DAYCARE'
  | 'HOME_VISIT'
  | 'TRAINING'
  | 'PET_TRANSPORT';

export type Species = 'dog' | 'cat' | 'bird' | 'rabbit' | 'reptile' | 'other';

export type PetSize = 'toy' | 'small' | 'medium' | 'large' | 'giant';

export type RateUnit =
  | 'PER_WALK'
  | 'PER_DURATION'
  | 'PER_VISIT'
  | 'PER_DAY'
  | 'PER_NIGHT'
  | 'PER_24H'
  | 'PER_SESSION'
  | 'BASE_PLUS_DISTANCE';

/**
 * Business doctrine §4.3 — rate unit MUST match service.
 * The compatibility matrix. Callers use `isRateUnitValidFor(service, unit)`
 * as a canonical guard.
 */
const RATE_UNIT_BY_SERVICE: Record<ServiceType, RateUnit[]> = {
  DOG_WALKING: ['PER_WALK', 'PER_DURATION'],
  HOME_VISIT: ['PER_VISIT'],
  DAYCARE: ['PER_DAY'],
  PET_SITTING: ['PER_NIGHT', 'PER_24H'],
  TRAINING: ['PER_SESSION'],
  PET_TRANSPORT: ['BASE_PLUS_DISTANCE'],
};

export function isRateUnitValidFor(service: ServiceType, unit: RateUnit): boolean {
  return RATE_UNIT_BY_SERVICE[service]?.includes(unit) ?? false;
}

export function validRateUnitsFor(service: ServiceType): RateUnit[] {
  return RATE_UNIT_BY_SERVICE[service] ?? [];
}
