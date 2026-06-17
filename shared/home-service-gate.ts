/**
 * Pure (DB-free) home-service booking gate.
 *
 * For any service where a provider ENTERS or STAYS in a customer's home
 * (pet sitting, overnight, drop-in, house sitting, home grooming/training),
 * a booking must NOT proceed until every legal prerequisite is satisfied:
 *   • customer signed the Property Authority & Home Access Declaration
 *   • customer completed the property/access form
 *   • customer completed the pet-care form
 *   • customer accepted the insurance / no-cover notice
 *   • provider signed the Home Access Agreement
 *
 * No declaration = no booking. (Spec: "No property authority declaration = no booking.")
 */
export const HOME_SERVICE_TYPES = [
  'pet_sitting', 'drop_in_visit', 'overnight_sitting', 'house_sitting',
  'cat_sitting', 'puppy_senior_sitting', 'home_grooming', 'home_training',
] as const;
export type HomeServiceType = (typeof HOME_SERVICE_TYPES)[number];

export function isHomeService(serviceType: string): boolean {
  return (HOME_SERVICE_TYPES as readonly string[]).includes(serviceType);
}

export interface HomeBookingPrereqs {
  propertyAuthoritySigned: boolean;
  propertyFormComplete: boolean;
  petCareComplete: boolean;
  insuranceNoticeAccepted: boolean;
  providerHomeAccessAgreementSigned: boolean;
}

export type HomeBookingStatus =
  | 'property_authority_missing'
  | 'property_details_missing'
  | 'pet_care_details_missing'
  | 'insurance_notice_missing'
  | 'provider_acceptance_pending'
  | 'ready';

export interface HomeBookingGateResult {
  bookable: boolean;
  status: HomeBookingStatus;
  missing: string[];
}

/**
 * Resolve whether a home-service booking can proceed. Returns the FIRST blocking
 * status (so the UI can route the user to the exact missing step) plus the full
 * missing list. Order matters: authority first (the hard legal gate).
 */
export function resolveHomeBookingGate(p: HomeBookingPrereqs): HomeBookingGateResult {
  const missing: string[] = [];
  if (!p.propertyAuthoritySigned) missing.push('property_authority_declaration');
  if (!p.propertyFormComplete) missing.push('property_access_form');
  if (!p.petCareComplete) missing.push('pet_care_form');
  if (!p.insuranceNoticeAccepted) missing.push('insurance_no_cover_notice');
  if (!p.providerHomeAccessAgreementSigned) missing.push('provider_home_access_agreement');

  let status: HomeBookingStatus = 'ready';
  if (!p.propertyAuthoritySigned) status = 'property_authority_missing';
  else if (!p.propertyFormComplete) status = 'property_details_missing';
  else if (!p.petCareComplete) status = 'pet_care_details_missing';
  else if (!p.insuranceNoticeAccepted) status = 'insurance_notice_missing';
  else if (!p.providerHomeAccessAgreementSigned) status = 'provider_acceptance_pending';

  return { bookable: missing.length === 0, status, missing };
}
