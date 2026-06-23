/**
 * providerInsuranceRequirements.ts — canonical, single source of truth for which
 * insurance each provider service requires in Israel, per the CEO's insurance-logic
 * spec (docs/legal/petwash-israel-provider-insurance-logic-2026.md).
 *
 * THIS IS DATA + STRUCTURE, NOT LEGAL ADVICE. The exact policy wording, the
 * required/recommended split, and the customer-facing copy must be confirmed by an
 * Israeli insurance broker + lawyer before launch. This file lets onboarding decide
 * which documents to ask for, and admin to gate approval — without hardcoding the
 * rules in scattered places.
 *
 * MODEL (CEO clarifications): PetWash is an online, independent-contractor
 * marketplace (Wolt/Rover/MadPaws structure). Providers are independent
 * subcontractors — NOT PetWash employees — so PetWash is not the employer and does
 * not carry their liability. Providers set their own rates but not below a minimum
 * floor. PetWash is NOT an insurance company and never markets a guarantee as
 * insurance.
 */

export type InsuranceType =
  | 'public_liability'        // ביטוח צד שלישי — third-party / public liability
  | 'professional_liability'  // ביטוח אחריות מקצועית — professional / service liability
  | 'care_custody_control'    // כיסוי לבעל חיים בהשגחת הספק — injury/loss to the pet in care
  | 'premises_liability'      // home/premises liability for hosting pets
  | 'motor_pet_transport'     // vehicle insurance + pet-transport/business-use cover
  | 'product_liability'       // products applied/sold (shampoo, oils, treats, accessories)
  | 'employer_liability'      // only if the provider employs staff
  | 'property_equipment';     // machines/equipment (station operators, grooming vans)

export type RequirementLevel = 'required' | 'recommended' | 'conditional' | 'not_applicable';

export interface ServiceInsuranceSpec {
  /** Canonical service key. */
  service: string;
  labelEn: string;
  labelHe: string;
  /** Per insurance type → requirement level for this service. */
  requirements: Partial<Record<InsuranceType, RequirementLevel>>;
  /** Extra declarations the provider must make for this service. */
  declarations?: string[];
  notes?: string;
}

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, { en: string; he: string }> = {
  public_liability:       { en: 'Public / third-party liability', he: 'ביטוח צד שלישי' },
  professional_liability: { en: 'Professional / service liability', he: 'ביטוח אחריות מקצועית' },
  care_custody_control:   { en: 'Care, custody & control (pet in your care)', he: 'כיסוי לבעל חיים בהשגחת הספק' },
  premises_liability:     { en: 'Home / premises liability (hosting)', he: 'אחריות חצרים (אירוח בבית)' },
  motor_pet_transport:    { en: 'Vehicle + pet-transport cover', he: 'ביטוח רכב + הובלת חיות' },
  product_liability:      { en: 'Product liability', he: 'אחריות מוצר' },
  employer_liability:     { en: 'Employer liability (if you employ staff)', he: 'ביטוח מעבידים (אם מעסיק עובדים)' },
  property_equipment:     { en: 'Property / equipment insurance', he: 'ביטוח רכוש / ציוד' },
};

/** Per-service requirements matrix. */
export const SERVICE_INSURANCE: Record<string, ServiceInsuranceSpec> = {
  dog_walking: {
    service: 'dog_walking', labelEn: 'Dog walking', labelHe: 'טיולי כלבים',
    requirements: { public_liability: 'required', care_custody_control: 'recommended' },
    declarations: ['animal_safety_declaration'],
  },
  pet_sitting: {
    service: 'pet_sitting', labelEn: 'Pet sitting (customer home)', labelHe: 'פט-סיטינג בבית הלקוח',
    requirements: { public_liability: 'required', care_custody_control: 'required', professional_liability: 'recommended' },
    declarations: ['customer_home_privacy_addendum', 'enhanced_trust_review'],
    notes: 'Theft/damage cover to be checked with broker.',
  },
  pet_hosting: {
    service: 'pet_hosting', labelEn: 'Pet hosting (provider home)', labelHe: 'אירוח בבית הספק',
    requirements: { public_liability: 'required', care_custody_control: 'required', premises_liability: 'required' },
    declarations: ['host_premises_photos', 'landlord_permission_declaration', 'max_pets_limit', 'home_business_cover_confirmed'],
    notes: 'Normal home insurance may NOT cover business pet hosting — provider must confirm with insurer.',
  },
  grooming: {
    service: 'grooming', labelEn: 'Grooming', labelHe: 'טיפוח',
    requirements: { public_liability: 'required', professional_liability: 'required', care_custody_control: 'required', product_liability: 'conditional' },
    declarations: ['experience_training_declaration'],
    notes: 'product_liability required if applying products.',
  },
  mobile_grooming: {
    service: 'mobile_grooming', labelEn: 'Mobile grooming', labelHe: 'טיפוח נייד',
    requirements: { public_liability: 'required', professional_liability: 'required', care_custody_control: 'required', product_liability: 'required', motor_pet_transport: 'conditional', property_equipment: 'recommended' },
    declarations: ['experience_training_declaration'],
  },
  pet_transport: {
    service: 'pet_transport', labelEn: 'Pet transport', labelHe: 'הסעת חיות',
    requirements: { public_liability: 'required', care_custody_control: 'required', motor_pet_transport: 'required' },
    declarations: ['driver_licence', 'vehicle_registration', 'business_pet_transport_use_confirmed', 'pet_restraint_declaration', 'transport_addendum'],
    notes: 'PetWash does NOT cover automotive liability — that is the provider vehicle policy (Rover excludes it too).',
  },
  training: {
    service: 'training', labelEn: 'Training', labelHe: 'אילוף',
    requirements: { public_liability: 'required', professional_liability: 'required', care_custody_control: 'recommended' },
    declarations: ['experience_training_declaration'],
  },
  station_operator: {
    service: 'station_operator', labelEn: 'Station operator / Smart Hub', labelHe: 'מפעיל עמדה / K9000',
    requirements: { public_liability: 'required', product_liability: 'required', property_equipment: 'required', employer_liability: 'conditional' },
    declarations: ['machine_insurance', 'maintenance_agreement', 'safety_checklist', 'approved_chemicals_only', 'employs_staff_declaration'],
  },
};

/**
 * Onboarding disclaimer — DRAFT copy, must be lawyer-approved before launch.
 * Mirrors the spec's "PetWash is not insurance" framing.
 */
export const INSURANCE_DISCLAIMER = {
  en: 'You are applying as an independent provider. You are responsible for having insurance suitable for the services you provide. PetWash Ltd is not an insurance company and does not provide a replacement for your insurance. PetWash may require insurance documents before approving certain services.',
  he: 'הינך מגיש/ה בקשה כספק/ית עצמאי/ת. באחריותך להחזיק בביטוח המתאים לשירותים שאתה/את מספק/ת. פטוואש בע״מ אינה חברת ביטוח ואינה מהווה תחליף לביטוח שלך. פטוואש עשויה לדרוש מסמכי ביטוח לפני אישור שירותים מסוימים.',
} as const;

/** Phrases PetWash must NEVER use (would imply it is the insurer). */
export const FORBIDDEN_INSURANCE_CLAIMS = [
  'fully insured by PetWash',
  'all damages covered',
  'guaranteed compensation',
  'we cover everything',
  'no risk',
] as const;

/** Resolve the insurance types a provider must/should hold for a set of services. */
export function requiredInsuranceForServices(serviceKeys: string[]): {
  required: InsuranceType[];
  recommended: InsuranceType[];
} {
  const required = new Set<InsuranceType>();
  const recommended = new Set<InsuranceType>();
  for (const key of serviceKeys) {
    const spec = SERVICE_INSURANCE[key];
    if (!spec) continue;
    for (const [type, level] of Object.entries(spec.requirements) as [InsuranceType, RequirementLevel][]) {
      if (level === 'required') required.add(type);
      else if (level === 'recommended' || level === 'conditional') recommended.add(type);
    }
  }
  // A type that is required by any service should not also appear as recommended.
  for (const t of required) recommended.delete(t);
  return { required: [...required], recommended: [...recommended] };
}
