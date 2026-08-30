/**
 * Household + Service Location — CEO Business Doctrine §62, §63.
 *
 * A single household holds an owner + household-scope instructions
 * (door / access / alarm / emergency contact) + a set of pets. One
 * booking covering multiple pets from the same household reuses
 * household-scope data ONCE, not four times.
 *
 * §62–§63 discipline:
 *   • Access instructions are per-booking authorised (§32) — the
 *     household stores them, the booking gets a snapshot.
 *   • Per-pet care lives on `BookingPet.perPetCarePlan`, not here.
 */
import type { PetId } from './bookingParty';

export type AccessMethod = 'IN_PERSON' | 'KEY_HANDOFF' | 'LOCKBOX' | 'DOORMAN' | 'SMART_LOCK';

export interface ServiceLocation {
  addressLine: string;                 // "5 King George St."
  city: string;
  countryCode: 'IL';
  floor?: string;
  apartment?: string;
  landmark?: string;                   // "yellow gate on the left"
}

export interface EmergencyContact {
  displayName: string;                 // masked at rest — never full raw name at API edge
  maskedPhone: string;                 // "•••• 4321" — real phone accessed via masked-call
}

export interface VetInfo {
  clinicName: string;
  maskedPhone: string;
  addressLine?: string;
}

export interface HouseholdAccessInstructions {
  method: AccessMethod;
  notes?: string;                      // "code is 4321, close the gate behind you"
  parkingHint?: string;
}

/**
 * A household — the owner's place-of-service context.
 */
export interface Household {
  householdId: string;
  ownerUid: string;
  serviceLocation: ServiceLocation;
  petIds: PetId[];
  emergencyContact: EmergencyContact;
  vet?: VetInfo;
  /**
   * Household-wide access instructions — NOT copied to the provider
   * until a booking authorises them via `HouseholdAuthorizedSnapshot`.
   */
  accessInstructions?: HouseholdAccessInstructions;
}

/**
 * Per-booking authorised snapshot of household data. This is what the
 * provider actually SEES on a confirmed booking. The customer
 * explicitly opts in via `KYA_SHARE_MEDICAL_FOR_BOOKING` /
 * per-booking access grant (§33 discipline).
 */
export interface HouseholdAuthorizedSnapshot {
  bookingId: string;
  householdId: string;
  serviceLocation: ServiceLocation;    // always visible on a confirmed booking
  emergencyContact?: EmergencyContact; // opt-in
  vet?: VetInfo;                       // opt-in
  accessInstructions?: HouseholdAccessInstructions; // opt-in
  authorizedAt: string;                // ISO
  authorizedPetIds: PetId[];           // subset the snapshot applies to
}

/**
 * Build the provider's view of a household for a specific booking.
 * Only pets on the booking are surfaced; only opt-in fields flow.
 * Fields the customer did NOT authorize come back undefined — the
 * UI shows a friendly "not shared" message, not the raw fields.
 */
export interface AuthorizationChoices {
  emergencyContact: boolean;
  vet: boolean;
  accessInstructions: boolean;
}

export function buildAuthorizedSnapshot(
  household: Household,
  bookingId: string,
  bookingPetIds: PetId[],
  choices: AuthorizationChoices,
  authorizedAt: string = new Date().toISOString(),
): HouseholdAuthorizedSnapshot {
  // Only pets that are BOTH on the household AND on the booking flow through.
  const authorizedPetIds = bookingPetIds.filter((p) => household.petIds.includes(p));

  return {
    bookingId,
    householdId: household.householdId,
    serviceLocation: household.serviceLocation,
    emergencyContact: choices.emergencyContact ? household.emergencyContact : undefined,
    vet: choices.vet ? household.vet : undefined,
    accessInstructions: choices.accessInstructions ? household.accessInstructions : undefined,
    authorizedAt,
    authorizedPetIds,
  };
}

/**
 * Runtime guard the provider-view endpoint uses BEFORE surfacing a
 * snapshot: refuses a snapshot whose authorizedPetIds is empty (the
 * booking includes a pet that isn't in this household — a defect).
 */
export function isSnapshotValid(snapshot: HouseholdAuthorizedSnapshot): boolean {
  return snapshot.authorizedPetIds.length > 0;
}
