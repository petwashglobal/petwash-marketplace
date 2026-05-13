/**
 * PR-LEGAL-A — Provider & Host Services Agreement (source of truth).
 *
 * Canonical bilingual body of the Pet Wash Ltd Provider &
 * Host Services Agreement. This module is data + types only:
 *   - no UI
 *   - no API routes
 *   - no schema
 *   - no payment / auth / wallet / K9000 / Nayax / SUMIT /
 *     UPay / Tranzila / Stripe imports
 *   - no insurance promises, sums, coverage claims, or
 *     claim-approval language
 *
 * Three independent gates determine whether the runtime is
 * allowed to enforce this agreement against a provider:
 *
 *   PROVIDER_HOST_AGREEMENT_VERSION
 *     The dated tag. Bumped whenever the legal text changes.
 *     Signatures store this string so an admin can tell what
 *     a provider actually agreed to.
 *
 *   PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED
 *     Per CEO directive 2026-05-12 (chat) — defaults to
 *     `false`. Server-side gate middleware (delivered in
 *     PR-LEGAL-D) MUST NOT block bookings on agreement
 *     acceptance until this flag is `true`. The flip is a
 *     one-line follow-up PR after Counsel has reviewed the
 *     full text + flow.
 *
 *   PROVIDER_HOST_AGREEMENT_HE_VERIFIED
 *     The Hebrew text in `PROVIDER_HOST_AGREEMENT_HE_RAW`
 *     was supplied via a mobile chat session and the
 *     copy-paste preserved a vertical line-per-word RTL
 *     layout that does NOT render as valid Hebrew prose.
 *     Until a verified clean Hebrew body is supplied — by
 *     Counsel, by a Word/PDF transcription, or by re-pasting
 *     from a desktop session — the Hebrew variant MUST NOT
 *     be displayed to providers. The runtime falls back to
 *     English. This flag defaults to `false`.
 *
 * Legal-sufficiency disclaimer (do not remove):
 *   This file stores the literal text supplied by the CEO.
 *   It does NOT itself assert that the agreement is legally
 *   binding under any specific statute (Israeli Electronic
 *   Transactions Law, GDPR, etc.). Legal sufficiency is
 *   Counsel-to-confirm before any enforcement gate flips.
 */

// ─────────────────────────────────────────────────────────────
// 1. Type surface
// ─────────────────────────────────────────────────────────────

export type AgreementLanguage = "en" | "he";

export interface AgreementSection {
  /** Stable section id matching the legal source text. */
  readonly id: string;
  /** Localised display title. */
  readonly title: string;
  /** Verbatim body text in the section's language. */
  readonly body: string;
}

export interface AgreementBody {
  /** Document title in the section's language. */
  readonly title: string;
  /** Free-form display string for the "last updated" stamp. */
  readonly lastUpdated: string;
  /** Ordered sections, verbatim. */
  readonly sections: readonly AgreementSection[];
}

// ─────────────────────────────────────────────────────────────
// 2. Version + counsel + language-verification gates
// ─────────────────────────────────────────────────────────────

/** Dated tag for this version of the agreement text. */
export const PROVIDER_HOST_AGREEMENT_VERSION = "2026-05-12" as const;

/**
 * Counsel-approved-for-enforcement flag. Defaults to `false`.
 * PR-LEGAL-D's booking gate middleware reads this and stays
 * in collect-only mode until it flips to `true` via a
 * follow-up one-line PR after Counsel sign-off.
 */
export const PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED = false as const;

/** English body is the canonical verbatim text supplied by CEO. */
export const PROVIDER_HOST_AGREEMENT_EN_VERIFIED = true as const;

/**
 * Hebrew body is NOT yet verified. The raw supplied text is
 * preserved in `PROVIDER_HOST_AGREEMENT_HE_RAW` for reference
 * but MUST NOT be presented to providers until a verified
 * clean Hebrew prose body lands in a follow-up PR.
 */
export const PROVIDER_HOST_AGREEMENT_HE_VERIFIED = false as const;

/** Provenance tag used in audit-log metadata. */
export const PROVIDER_HOST_AGREEMENT_SOURCE = "petwash-provider-host-agreement" as const;

// ─────────────────────────────────────────────────────────────
// 3. English body — verbatim, verified
// ─────────────────────────────────────────────────────────────

const EN_SECTIONS: readonly AgreementSection[] = [
  {
    id: "1",
    title: "ABOUT PET WASH",
    body:
`Pet Wash Ltd operates a technology-based pet care marketplace and related services platform connecting pet owners with independent providers and businesses.

Services may include:
- Pet sitting
- Dog walking
- Pet transportation
- Pet hosting
- Pet-related training
- Self-service wash support
- Pet care marketplace services
- Other approved services

Pet Wash may also operate physical self-service wash stations, digital applications, loyalty systems, booking systems and related technologies.`,
  },
  {
    id: "2",
    title: "INDEPENDENT PROVIDER STATUS",
    body:
`You acknowledge and agree that:

- You operate as an independent contractor unless expressly agreed otherwise in writing.
- Pet Wash is not your employer.
- Nothing in this Agreement creates an employment relationship, partnership, agency, franchise or joint venture.
- You are responsible for your own taxes, reporting obligations, insurance, licenses and business compliance.
- You control when, where and whether to accept bookings or provide services.
- You may work with other companies or platforms unless specifically prohibited by written agreement or applicable law.`,
  },
  {
    id: "3",
    title: "ELIGIBILITY REQUIREMENTS",
    body:
`To use Pet Wash provider services you must:

- Be at least 18 years old
- Provide accurate information
- Maintain a valid mobile number and email
- Be legally permitted to provide services in your jurisdiction
- Pass any required onboarding or verification steps
- Maintain lawful conduct
- Comply with this Agreement and all platform policies

Pet Wash may request:

- Government identification
- Selfie verification
- Address confirmation
- Business registration
- Insurance documents
- Tax information
- Vehicle information
- Criminal declaration or background documentation where legally permitted`,
  },
  {
    id: "4",
    title: "PROVIDER RESPONSIBILITIES",
    body:
`Providers must:

- Treat animals safely and humanely
- Follow reasonable customer instructions
- Maintain professional conduct
- Arrive on time
- Maintain safe equipment and environments
- Communicate honestly
- Protect customer property and privacy
- Immediately report incidents, injuries, emergencies or safety concerns
- Comply with animal welfare laws and local regulations

Providers must never:

- Abuse or neglect animals
- Misrepresent qualifications
- Share customer information improperly
- Use unsafe transport methods
- Operate while intoxicated or impaired
- Commit fraud or deceptive conduct
- Circumvent platform payment systems where prohibited`,
  },
  {
    id: "5",
    title: "HOSTING & HOME-BASED SERVICES",
    body:
`If you provide pet hosting or home-based services:

- You are solely responsible for ensuring your premises are safe and appropriate.
- You confirm pets are kept in humane conditions.
- You must disclose other animals present where relevant.
- You must immediately inform owners about injuries, illness, escapes or emergencies.
- You remain responsible for supervision and safety during the booking period.

Pet Wash does not inspect or guarantee provider homes unless explicitly stated.`,
  },
  {
    id: "6",
    title: "BOOKINGS & PLATFORM OPERATIONS",
    body:
`Bookings may be requested through the platform.

Pet Wash may:

- Match users with providers
- Display provider profiles
- Process bookings
- Process payments
- Apply platform rules
- Suspend or remove providers where necessary

Providers understand:

- Booking requests are not guaranteed
- Platform visibility may vary
- Ratings and reviews may impact visibility
- Customers may cancel subject to policy
- Pet Wash may investigate disputes or complaints`,
  },
  {
    id: "7",
    title: "PAYMENTS & FEES",
    body:
`Payments may be processed through third-party payment providers.

You authorize Pet Wash to:

- Collect customer payments
- Deduct applicable fees or commissions
- Process refunds or adjustments where appropriate
- Hold or delay payouts during investigations
- Maintain transaction records

Providers must not:

- Request unauthorized off-platform payments
- Manipulate pricing
- Circumvent platform commission systems

Payout timing may vary depending on:

- Verification status
- Banking systems
- Fraud reviews
- Chargebacks
- Technical or regulatory requirements`,
  },
  {
    id: "8",
    title: "INSURANCE DISCLAIMER",
    body:
`IMPORTANT NOTICE:

Pet Wash Ltd is not an insurance company, insurance broker or insurance adviser.

Any reference to protection programs, coverage, support or benefits does not replace the Provider's own obligation to maintain legally required insurance.

Providers remain solely responsible for maintaining appropriate:

- Public liability insurance
- Vehicle insurance
- Professional insurance
- Pet-care insurance
- Business insurance
- Workers compensation where legally required

Any platform-related insurance or support program, if offered, is subject entirely to:

- Policy terms
- Insurer approval
- Coverage conditions
- Applicable law

Coverage may not apply in all circumstances.

Pet Wash makes no guarantee that any claim will be approved or covered.

Providers should obtain independent legal and insurance advice.`,
  },
  {
    id: "9",
    title: "PET HEALTH & SAFETY",
    body:
`Providers acknowledge that:

- Animals may behave unpredictably
- Some pets may become aggressive, anxious or sick
- Injuries may occur despite reasonable care

Providers agree:

- Never to knowingly place pets in unsafe situations
- To use suitable restraints and transport methods
- To follow emergency procedures where necessary
- To seek veterinary assistance in emergencies where reasonable

Pet owners remain responsible for:

- Accurate pet information
- Vaccination status
- Medical disclosures
- Behavioral disclosures`,
  },
  {
    id: "10",
    title: "BACKGROUND CHECKS & VERIFICATION",
    body:
`Pet Wash may conduct or request verification procedures including:

- Identity checks
- Selfie/liveness verification
- Address verification
- Criminal declarations
- Insurance verification
- Manual reviews

Approval is not guaranteed.

Pet Wash reserves the right to:

- Reject applications
- Request additional documents
- Suspend access
- Remove providers at any time where reasonably necessary for safety, compliance or operational reasons.`,
  },
  {
    id: "11",
    title: "PRIVACY & DATA",
    body:
`Providers agree that Pet Wash may collect, process and store information including:

- Identity information
- Contact details
- Device information
- Booking information
- Communications
- Ratings and reviews
- Location information where enabled
- Financial and payout information
- Verification records

Information may be used for:

- Platform operations
- Fraud prevention
- Safety
- Customer support
- Legal compliance
- Payment processing
- Analytics
- Service improvement

Providers must protect customer privacy and confidential information.`,
  },
  {
    id: "12",
    title: "PLATFORM ACCESS & SUSPENSION",
    body:
`Pet Wash may suspend, restrict or terminate provider access where reasonably necessary, including for:

- Safety concerns
- Complaints
- Fraud
- Misconduct
- False information
- Poor service quality
- Legal or regulatory issues
- Payment disputes
- Breach of this Agreement

Pet Wash may investigate incidents and request cooperation from providers.`,
  },
  {
    id: "13",
    title: "LIMITATION OF LIABILITY",
    body:
`To the maximum extent permitted by law:

- Pet Wash provides the platform on an "as available" basis.
- Pet Wash does not guarantee booking volume, income or uninterrupted platform availability.
- Pet Wash is not responsible for the acts, omissions or conduct of users, pet owners or providers.
- Pet Wash is not responsible for indirect, incidental or consequential damages.

Nothing in this Agreement excludes rights that cannot legally be excluded under applicable law.`,
  },
  {
    id: "14",
    title: "TAXES & COMPLIANCE",
    body:
`Providers remain solely responsible for:

- Income reporting
- VAT obligations
- Business registration
- Tax invoices
- Record keeping
- Regulatory compliance

Where applicable, providers may be required to submit:

- עוסק פטור
- עוסק מורשה
- Company details
- Tax identification details
- Banking information`,
  },
  {
    id: "15",
    title: "DIGITAL SIGNATURE & CONSENT",
    body:
`By digitally signing this Agreement, you confirm that:

- All information provided is accurate
- You understand your obligations
- You understand Pet Wash is a technology platform and not your employer
- You understand insurance limitations
- You agree to comply with platform rules and applicable laws

Electronic signatures, digital approvals, IP logs, timestamps and electronic acceptance records may be used as evidence of agreement and consent.`,
  },
  {
    id: "16",
    title: "GOVERNING LAW",
    body:
`This Agreement shall be governed in accordance with the laws applicable in the State of Israel unless otherwise required by mandatory law.`,
  },
];

export const PROVIDER_HOST_AGREEMENT_EN: AgreementBody = {
  title: "PET WASH LTD — PROVIDER & HOST SERVICES AGREEMENT",
  lastUpdated: "May 2026",
  sections: EN_SECTIONS,
};

// ─────────────────────────────────────────────────────────────
// 4. Hebrew body — raw, NOT verified
//
// The text below was supplied via a mobile chat session.
// The mobile RTL rendering produced a vertical line-per-word
// layout. Joining lines yields broken Hebrew prose that does
// NOT carry the legal meaning of the underlying agreement.
//
// We preserve the raw text VERBATIM here (per CEO directive
// "use the bilingual agreement bodies verbatim from my
// supplied text") so a future PR can use it for forensic
// reconstruction. We DO NOT expose this as displayable text.
//
// PROVIDER_HOST_AGREEMENT_HE_VERIFIED is `false`. The runtime
// MUST fall back to the English body until a verified Hebrew
// prose body is supplied (Counsel, Word/PDF transcription, or
// a clean desktop re-paste).
//
// Mandatory phrase that the verified Hebrew body MUST contain
// in its §8 section (per CEO directive 2026-05-12):
//   "פט וואש בע״מ אינה חברת ביטוח, סוכנות ביטוח או יועצת ביטוח"
// ─────────────────────────────────────────────────────────────

/**
 * Status enum for the Hebrew body. Three legal states:
 *   "raw-unverified"   the user's mobile-rendered raw text
 *                      is preserved but cannot be displayed
 *   "awaiting-counsel" a verified prose body is drafted but
 *                      Counsel has not signed off
 *   "verified"         Counsel-approved verified prose
 */
export type AgreementProseStatus =
  | "raw-unverified"
  | "awaiting-counsel"
  | "verified";

export interface AgreementRawSource {
  readonly lang: AgreementLanguage;
  readonly status: AgreementProseStatus;
  readonly rawSupplied: string;
  readonly notes: string;
}

/**
 * Raw Hebrew agreement text as supplied by CEO in chat,
 * preserved verbatim including the broken vertical line
 * layout. NOT to be displayed to providers.
 *
 * To replace this raw block with a verified prose body:
 *   1. Counsel supplies clean Hebrew prose (Word / PDF /
 *      desktop paste).
 *   2. A follow-up PR adds an EN-shape AgreementBody for
 *      Hebrew, populates `PROVIDER_HOST_AGREEMENT_HE`, and
 *      flips `PROVIDER_HOST_AGREEMENT_HE_VERIFIED` to `true`.
 *   3. The regression test asserts the §8 mandatory phrase
 *      appears in the verified body before approving the
 *      flip.
 */
export const PROVIDER_HOST_AGREEMENT_HE_RAW: AgreementRawSource = {
  lang: "he",
  status: "raw-unverified",
  notes:
    "Mobile RTL chat paste produced a vertical line-per-word layout. " +
    "Cannot be displayed as Hebrew prose. Awaiting verified clean " +
    "body from Counsel or desktop re-paste. " +
    "PROVIDER_HOST_AGREEMENT_HE_VERIFIED must remain false until " +
    "verified prose lands and §8 mandatory phrase is present.",
  rawSupplied:
`# פט #
בע"מ
וואש
הסכם #
שירות
ונותני
ספקים
# PET WASH LTD - PROVIDER & HOST SERVICES AGREEMENT
2026
מאי
לאחרונה:
עודכן
וואש"
,
("פט
בע"מ
וואש
פט
בין
היחסים
מערכת
את
מסדיר
("ההסכם")
זה
שירות
ונותני
ספקים
הסכם
או
קבלן
מאמן,
נהג,
כלבים,
מוליך
פטסיטר,
מארח,
,
עצמאי
ספק
כל
לבין
"אנחנו")
"הפלטפורמה"
"החברה"
,
,
. אליה
הקשורים
ובשירותים
וואש
פט
בפלטפורמת
המשתמש
"אתה")
,
("הספק"
אחר
מאושר
שירות
נותן
חתימה
ספק,
חשבון
הפעלת
הזמנות,
קבלת
אונבורדינג,
תהליך
השלמת
מועמדות,
הגשת
הרשמה,
באמצעות
לכל
והסכמת
הבנת
קראת,
כי
מאשר
הנך
וואש,
פט
של
הספק
בשירותי
שימוש
או
זה
הסכם
על
דיגיטלית
. זה
בהסכם
המפורטים
התנאים`,
};

/**
 * Verified Hebrew prose body. Populated only when Counsel has
 * signed off on a clean Hebrew translation that mirrors the
 * 16 EN sections and contains the §8 mandatory phrase.
 * Until then, this is null and the runtime must fall back to
 * English.
 */
export const PROVIDER_HOST_AGREEMENT_HE: AgreementBody | null = null;

// ─────────────────────────────────────────────────────────────
// 5. Public surface
// ─────────────────────────────────────────────────────────────

/**
 * Returns the body to display for a given language, respecting
 * verification gates. Falls back to English if Hebrew is
 * requested but `PROVIDER_HOST_AGREEMENT_HE_VERIFIED` is `false`
 * or the verified body has not been populated yet.
 */
export function getAgreementBody(
  language: AgreementLanguage,
): AgreementBody {
  if (
    language === "he" &&
    PROVIDER_HOST_AGREEMENT_HE_VERIFIED &&
    PROVIDER_HOST_AGREEMENT_HE !== null
  ) {
    return PROVIDER_HOST_AGREEMENT_HE;
  }
  return PROVIDER_HOST_AGREEMENT_EN;
}

/**
 * Returns the effective language that getAgreementBody would
 * use for the given requested language. Useful for callers
 * that need to record `language_displayed` accurately even
 * when fallback kicks in.
 */
export function getEffectiveLanguage(
  requested: AgreementLanguage,
): AgreementLanguage {
  if (
    requested === "he" &&
    PROVIDER_HOST_AGREEMENT_HE_VERIFIED &&
    PROVIDER_HOST_AGREEMENT_HE !== null
  ) {
    return "he";
  }
  return "en";
}
