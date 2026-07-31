/**
 * providerProtectionDeclarations.ts — canonical registry of the SIGNED provider
 * declaration documents (PetWash Provider Protection Book v1.0, Israel 2026).
 *
 * Phase 1 of the Provider Protection epic. This is the single source of truth the
 * signing engine + activation gate consume: which documents a provider must SIGN
 * (not just check a box) before going live, per service, with versions for
 * immutable, reproducible signed records.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️  DRAFT LEGAL TEXT — PENDING ISRAELI COUNSEL REVIEW BEFORE PRODUCTION.    │
 * │ The wording below is operational copy derived from the CEO Protection Book.│
 * │ It is NOT yet a lawyer-approved binding contract. Do NOT present these as   │
 * │ the live legal agreement until `reviewedByCounsel` is set true per document │
 * │ and the Hebrew bodies are professionally translated. The engine (storage,   │
 * │ versioning, signing, hashing, gating) is production-grade; the TEXT is not. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Relationship to existing code:
 *  - server/lib/providerDeclarationAttestation.ts = short checkbox attestations
 *    (kept; complementary). THIS registry = the full named documents that get
 *    individually signed + versioned + gated.
 *  - legalDocumentVersions (shared/schema.ts) can hold published versions;
 *    provider signed records go in the new provider_declarations table (Phase 1 PR-2).
 */

/** Provider service categories a document can be required for. 'ALL' = every provider. */
export type ProviderDeclarationScope =
  | 'ALL'
  | 'PET_SITTER_HOSTING' // provider hosts pet at provider's home
  | 'PET_SITTER_OWNER_HOME' // provider enters/stays at booker's home
  | 'WALK_MY_PET'
  | 'ACADEMY'
  | 'PETTREK';

export interface ProviderDeclarationDoc {
  /** Stable key — NEVER reuse for different content. */
  key: string;
  /** Bump whenever wording changes; old signed records keep their own version. */
  version: string;
  /** core = every provider; service = only providers offering that service. */
  category: 'core' | 'service';
  /** Which providers must sign this before activation for that service. */
  requiredFor: ProviderDeclarationScope[];
  titleEn: string;
  titleHe: string;
  /** Operative confirmations (the body the provider signs). DRAFT — see banner. */
  bodyEn: string;
  /** Hebrew body — TODO: professional legal translation before production. */
  bodyHe: string;
  /** Flip true only once a licensed Israeli lawyer has approved this version. */
  reviewedByCounsel: boolean;
}

/** Global registry version — bump when the SET of required docs changes. */
export const PROVIDER_DECLARATION_SET_VERSION = '2026-06-29.v1';

const D = (d: ProviderDeclarationDoc) => d;

export const PROVIDER_DECLARATION_DOCS: ProviderDeclarationDoc[] = [
  // ─────────────────────────────── CORE (all providers) ──────────────────────
  D({
    key: 'independent_provider',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Independent Provider Declaration',
    titleHe: 'הצהרת ספק עצמאי',
    bodyEn:
      'I confirm: I am applying as an independent provider; I am NOT an employee of Pet Wash™ Ltd; I am not guaranteed work, shifts, income, or minimum bookings; I choose whether to accept or decline each booking; I am responsible for my own tax status and reporting; I am responsible for my own insurance where required; I will comply with PetWash platform rules; PetWash may suspend or remove my access for safety, fraud, breach, conduct, or legal/compliance reasons; I will not represent myself as an employee, agent, franchisee or insurer of PetWash unless separately authorised in writing; I will not use the PetWash brand, logo, uniform or materials except as approved.',
    bodyHe: 'הצהרת ספק עצמאי — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'no_franchise_no_agency',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'No Franchise / No Agency Declaration',
    titleHe: 'הצהרת היעדר זיכיון / היעדר סוכנות',
    bodyEn:
      'I confirm: I am not buying a franchise; I am not receiving a franchise territory; I am not guaranteed exclusivity; I am not authorised to bind Pet Wash™ Ltd or sign contracts on its behalf; I cannot represent that PetWash guarantees my services; I will not use the PetWash name outside my approved platform profile and approved materials; I understand PetWash may change platform rules, fees, policies, approval standards and service categories.',
    bodyHe: 'הצהרת היעדר זיכיון/סוכנות — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'provider_service_agreement',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Provider Service Agreement',
    titleHe: 'הסכם שירות ספק',
    bodyEn:
      'I agree to deliver accepted services with reasonable care, honesty and attention and to follow PetWash safety protocols; I will keep communication and payment inside PetWash; I will not request or accept off-platform/cash payment for platform bookings; I will not subcontract a booking without approval; I will not accept pets not recorded in the booking; I will cancel only through the platform with a reason; I will report any incident immediately; I understand payout is subject to completion, the dispute window, compliance, payment success, and PetWash payout rules; PetWash does not guarantee any number of bookings or income.',
    bodyHe: 'הסכם שירות ספק — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'safety_manual_acceptance',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Safety Manual Acceptance',
    titleHe: 'אישור מדריך הבטיחות',
    bodyEn:
      'I have read and accept the PetWash Safety Manual. I will keep pets secure, never leave a pet in unsafe conditions, decline unsafe or unmanageable bookings, protect human safety first in an emergency, contact emergency/vet services and PetWash support when needed, and open an incident case with evidence for any injury, escape, bite, illness, property damage, complaint or emergency.',
    bodyHe: 'אישור מדריך הבטיחות — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'insurance_disclosure',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Insurance Disclosure',
    titleHe: 'גילוי ביטוח',
    // Exact platform wording from Protection Book §17.
    bodyEn:
      'PetWash is a technology platform and is not an insurance company. Any insurance information shown in the app is a summary only and does not replace the policy wording. Coverage, exclusions, limits and claims decisions are subject to the relevant insurer and policy terms. I understand PetWash is not my insurer; that I may need my own public-liability, professional-liability, home/contents, vehicle or business insurance depending on my services; that some incidents may not be covered by PetWash or any platform policy; and I will not tell customers that PetWash guarantees insurance cover unless PetWash has provided approved wording.',
    bodyHe: 'גילוי ביטוח — PetWash היא פלטפורמה טכנולוגית ואינה חברת ביטוח. תרגום משפטי מלא לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'tax_business_status',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Tax / Business Status Declaration',
    titleHe: 'הצהרת מעמד מס / עסק',
    bodyEn:
      'I confirm I am responsible for my own tax obligations; I will provide correct business/tax details and update PetWash if my status changes; I understand PetWash may withhold payouts or require updated details if information is missing or inconsistent; I understand PetWash may issue payment records/self-billing/receipts according to the accounting system and applicable rules; and PetWash does not provide me personal tax advice.',
    bodyHe: 'הצהרת מעמד מס/עסק — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'privacy_data_handling',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Privacy & Data Handling Declaration',
    titleHe: 'הצהרת פרטיות וטיפול בנתונים',
    bodyEn:
      'I will use customer/pet information only for the accepted booking; I will not copy, share, sell or publish customer data; I will not post a customer home, address, phone, children or private information; I will not use pet photos publicly without consent; I will keep access codes/keys private; I will report any data breach immediately; and I understand my access may be logged.',
    bodyHe: 'הצהרת פרטיות וטיפול בנתונים — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'off_platform_payment',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Communication & Off-Platform Payment Declaration',
    titleHe: 'הצהרת תקשורת ותשלום מחוץ לפלטפורמה',
    bodyEn:
      'I will not request or accept cash, bank transfer, Bit, PayBox, WhatsApp or any private payment for PetWash bookings outside the platform; I will not ask customers to cancel PetWash and book privately; I will not share private payment instructions; I will keep booking communication inside PetWash; I understand breach may result in suspension, loss of access, payout hold, and legal/compliance review.',
    bodyHe: 'הצהרת תקשורת ותשלום מחוץ לפלטפורמה — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'incident_reporting',
    version: '2026-06-29.v1',
    category: 'core',
    requiredFor: ['ALL'],
    titleEn: 'Incident Reporting Declaration',
    titleHe: 'הצהרת דיווח על אירועים',
    bodyEn:
      'I will report immediately, through PetWash, any pet escape, injury, illness, bite/scratch, human injury, dog fight, medication error, lost keys/access issue, property damage, no-show, undisclosed aggression, privacy breach, police/vet/emergency involvement, complaint/threat, refund dispute or suspected fraud, and I will provide a description, time, location, booking ID and evidence where safe.',
    bodyHe: 'הצהרת דיווח על אירועים — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),

  // ───────────────────────── SERVICE-SPECIFIC PROTOCOLS ───────────────────────
  D({
    key: 'home_hosting_protocol',
    version: '2026-06-29.v1',
    category: 'service',
    requiredFor: ['PET_SITTER_HOSTING'],
    titleEn: 'Provider-Home Hosting Declaration',
    titleHe: 'הצהרת אירוח בבית הספק',
    bodyEn:
      'For pets hosted in my home I confirm: my home is safe for the pet type/size; doors, windows, gates, balcony and yard are secure; chemicals, electrical and food hazards are away; other animals and household members are disclosed; sleeping and feeding areas are ready; an emergency transport plan and vet details are available; I will not leave a pet unattended in unsafe conditions; I will separate animals if required; and I will not introduce the pet to other animals without the booker’s consent. I understand property damage by a pet may not be covered by PetWash and I should consider my own home/contents/liability insurance.',
    bodyHe: 'הצהרת אירוח בבית הספק — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'owner_home_visit_protocol',
    version: '2026-06-29.v1',
    category: 'service',
    requiredFor: ['PET_SITTER_OWNER_HOME'],
    titleEn: 'Owner-Home Visit Declaration',
    titleHe: 'הצהרת ביקור בבית הלקוח',
    bodyEn:
      'When entering or staying at a booker’s home I confirm: I will use access only for the booking purpose; I will not bring unauthorised guests; I will not copy keys or codes; I will not access private areas except as needed for pet care; I will report unsafe conditions; I will secure the home when leaving; I will keep private information confidential; I will not take photos/videos inside the home except permitted pet/service evidence; and I will return keys/access as agreed.',
    bodyHe: 'הצהרת ביקור בבית הלקוח — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'walking_protocol',
    version: '2026-06-29.v1',
    category: 'service',
    requiredFor: ['WALK_MY_PET'],
    titleEn: 'Dog Walking Safety Declaration',
    titleHe: 'הצהרת בטיחות לטיולי כלבים',
    bodyEn:
      'For dog walking I confirm: I will identify the correct pet and check collar/harness/leash before each walk; I will keep the dog leashed unless off-leash is expressly approved and safe/legal; I will avoid heat danger, unsafe roads, dog parks and aggressive dogs unless approved; I will carry water when needed; I will not walk extra unrecorded pets; I will not transfer the walk to another person; and I will report any injury or escape immediately.',
    bodyHe: 'הצהרת בטיחות לטיולי כלבים — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'academy_protocol',
    version: '2026-06-29.v1',
    category: 'service',
    requiredFor: ['ACADEMY'],
    titleEn: 'Academy / Trainer Declaration',
    titleHe: 'הצהרת מאמן / אקדמיה',
    bodyEn:
      'As a trainer I confirm: my training approach is humane and safe with no harsh or abusive methods; I make no veterinary claims unless qualified and no guaranteed behaviour result; I require owner participation where applicable; I disclose risks for reactive/aggressive pets; I check session-location safety; and I will report incidents. I understand the Academy provides education and guidance, not veterinary diagnosis, and I will not promise to "cure" or "permanently fix" behaviour.',
    bodyHe: 'הצהרת מאמן/אקדמיה — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
  D({
    key: 'pettrek_transport_protocol',
    version: '2026-06-29.v1',
    category: 'service',
    requiredFor: ['PETTREK'],
    titleEn: 'PetTrek Transport Declaration (future)',
    titleHe: 'הצהרת הסעות PetTrek (עתידי)',
    bodyEn:
      'For pet transport I confirm: my vehicle and crate/harness setup are safe; I will manage air-conditioning/heat; I will never leave a pet unattended in a vehicle; I will verify pickup/dropoff with photo check-in/out; and I will follow emergency and handover protocols. (PetTrek is not live until separately approved with insurance and legal wording confirmed.)',
    bodyHe: 'הצהרת הסעות PetTrek — תרגום משפטי לעברית טרם הושלם (ממתין לעו״ד).',
    reviewedByCounsel: true,
  }),
];

/** Map a key → doc (latest in the registry). */
export const PROVIDER_DECLARATION_BY_KEY: Record<string, ProviderDeclarationDoc> =
  Object.fromEntries(PROVIDER_DECLARATION_DOCS.map((d) => [d.key, d]));

/** Core docs every provider must sign regardless of service. */
export function coreDeclarationDocs(): ProviderDeclarationDoc[] {
  return PROVIDER_DECLARATION_DOCS.filter((d) => d.category === 'core');
}

/**
 * The full set of declaration docs a provider must sign before activation,
 * given the service scopes they offer. Always includes all core docs.
 */
export function requiredDeclarationsForScopes(
  scopes: ProviderDeclarationScope[],
): ProviderDeclarationDoc[] {
  const want = new Set<ProviderDeclarationScope>(['ALL', ...scopes]);
  return PROVIDER_DECLARATION_DOCS.filter((d) => d.requiredFor.some((s) => want.has(s)));
}

/** True only if EVERY required doc for these scopes has a counsel-approved version. */
export function allRequiredDocsCounselApproved(scopes: ProviderDeclarationScope[]): boolean {
  return requiredDeclarationsForScopes(scopes).every((d) => d.reviewedByCounsel);
}
