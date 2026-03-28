export const BIOMETRIC_DOC_TYPES = [
  'selfie',
  'id',
  'national_id',
  'passport',
  'drivers_license',
  'residence_permit',
] as const;

export const BUSINESS_DOC_TYPES = [
  'business_license',
  'insurance',
  'training_cert',
  'provider_agreement',
  'other',
] as const;

export type BiometricDocType = typeof BIOMETRIC_DOC_TYPES[number];
export type BusinessDocType = typeof BUSINESS_DOC_TYPES[number];

export function isBiometricDocType(type: string): boolean {
  return (BIOMETRIC_DOC_TYPES as readonly string[]).includes(type);
}
