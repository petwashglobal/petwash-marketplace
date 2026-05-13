/**
 * PR-LEGAL-A-REWRITE — Provider & Host Services Agreement (source of truth).
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
 * This rewrite supersedes the 16-section v2026-05-12 body
 * (PR-LEGAL-A #246) with a 23-section v2026-05-13 body that
 * incorporates the Israel-2026 legal review punch list, the
 * security / UX / legal-consistency council findings, and the
 * CEO's locked strategic adjustments:
 *
 *   - Independent-contractor and anti-integration architecture
 *     preserved exactly. No supervision wording. No mandatory
 *     availability. No response-time enforcement. No ranking
 *     penalties. No performance-control phrasing.
 *   - Premium, balanced, trust-oriented tone. No surveillance
 *     or compliance-authority register.
 *   - §22 references "device metadata reasonably necessary for
 *     fraud prevention and account-security purposes" — NOT
 *     "device fingerprint hash" in provider-facing text.
 *   - §7 retention principle includes "where lawful and
 *     reasonably possible" to cover legal holds, disputes,
 *     fraud investigations and statutory retention duties.
 *   - Verification under §11 is for platform access, fraud
 *     prevention, AML compliance, legal compliance and
 *     Customer trust only — NOT employment supervision.
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
 *     Per CEO directive — defaults to `false`. Server-side
 *     gate middleware (PR-LEGAL-D) MUST NOT block bookings on
 *     agreement acceptance until this flag is `true`. The flip
 *     is a one-line follow-up PR after Counsel sign-off.
 *
 *   PROVIDER_HOST_AGREEMENT_HE_VERIFIED
 *     The Hebrew prose body in `PROVIDER_HOST_AGREEMENT_HE`
 *     is null until Counsel returns verified Hebrew text. The
 *     PR-LEGAL-A-REWRITE Hebrew prose lives in
 *     `PROVIDER_HOST_AGREEMENT_HE_DRAFT` for Counsel review;
 *     the runtime falls back to English until verified. This
 *     flag defaults to `false`.
 *
 * Legal-sufficiency disclaimer (do not remove):
 *   This file stores the literal text shown to providers. It
 *   does NOT itself assert that the agreement is legally
 *   binding under any specific statute. Legal sufficiency is
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
export const PROVIDER_HOST_AGREEMENT_VERSION = "2026-05-13" as const;

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
 * Hebrew body is NOT yet verified. The DRAFT Hebrew prose
 * (PROVIDER_HOST_AGREEMENT_HE_DRAFT) is preserved alongside
 * for Counsel review, but MUST NOT be presented to providers
 * until a verified clean Hebrew body lands in a follow-up PR
 * (PR-LEGAL-A-HE) and this flag is flipped to `true`.
 */
export const PROVIDER_HOST_AGREEMENT_HE_VERIFIED = false as const;

/** Provenance tag used in audit-log metadata. */
export const PROVIDER_HOST_AGREEMENT_SOURCE = "petwash-provider-host-agreement" as const;

// ─────────────────────────────────────────────────────────────
// 3. §22 acceptance-evidence guidance (normative for PR-LEGAL-D)
// ─────────────────────────────────────────────────────────────

/**
 * §22 acceptance evidence — minimum fields the booking-gate
 * middleware (PR-LEGAL-D) MUST record on each acceptance event.
 * This list is normative; PR-LEGAL-D implements; PR-LEGAL-C
 * designs the storage schema. The provider-facing §22 body
 * uses softer language ("device metadata reasonably necessary
 * for fraud prevention and account-security purposes"); this
 * comment block is the engineering contract.
 *
 * Cryptographic agility: production may adopt these fields in
 * a phased rollout proportional to platform scale. Where
 * Pet Wash later adopts upgraded hashing or signed-timestamp
 * standards, historical verifiability of prior acceptance
 * records MUST be preserved (re-hash with both old and new
 * algorithms during the migration window, store both).
 *
 * Identity of the agreement shown:
 *   - agreement version (matches PROVIDER_HOST_AGREEMENT_VERSION)
 *   - agreement version hash (SHA-256 of the canonical bilingual
 *     source bytes, or the upgraded successor algorithm)
 *   - rendered-language hash (hash of the exact bytes — HTML or
 *     PDF — actually displayed in the locale shown)
 *   - locale rendered (he-IL or en-IL)
 *
 * Identity of the signer and the event:
 *   - acceptance event ID (UUIDv7 or successor)
 *   - prior acceptance event hash (chains events per account)
 *   - account ID
 *   - ISO-8601 timestamp, Asia/Jerusalem tz
 *   - signed-time anchor (RFC 3161 trusted timestamp or
 *     successor), independent of wall-clock
 *   - IP address
 *   - device metadata reasonably necessary for fraud
 *     prevention and account-security purposes (the §22
 *     provider-facing wording)
 *   - user-agent hash
 *   - TLS session fingerprint hash
 *
 * Storage guarantees (target architecture; phased rollout
 * allowed):
 *   - append-only / WORM-equivalent
 *   - minimum 7-year retention after last booking or account
 *     closure (whichever is later), subject to §7 lawful
 *     retention rules
 *   - daily Merkle root published internally to a second
 *     system so backdating a single row is detectable
 *   - rendered bytes snapshotted to immutable object storage
 *     at acceptance time, keyed by event ID
 *
 * Re-acceptance: a fresh event is logged with BOTH old and
 * new version hashes; prior row is NEVER overwritten.
 *
 * Re-acceptance triggers — Material Change as defined in §0:
 * a change to §10 (fees), §15 (liability), §17 (governing
 * law), §18 (dispute resolution), §19 (language precedence),
 * or §22 (acceptance mechanics).
 */

// ─────────────────────────────────────────────────────────────
// 4. English body — verbatim, verified
// ─────────────────────────────────────────────────────────────

const EN_SECTIONS: readonly AgreementSection[] = [
  {
    id: "0",
    title: "DEFINITIONS",
    body:
`For the purposes of this Agreement, the following terms have the meanings set out below:

"Pet Wash" or "Pet Wash Ltd" — Pet Wash Ltd, an Israeli private company, Israeli company number 517145033, trading under the names Pet Wash and פט וואש בע״מ.

"Platform" — the Pet Wash website, mobile applications, application programming interfaces, kiosks, hardware and related technology operated by Pet Wash.

"Provider" — an individual or business entity approved by Pet Wash to offer pet-care services through the Platform.

"Host" — a Provider who provides home-based services or whose own premises are used to accommodate pets during the service.

"Customer" — a pet owner or authorised representative who uses the Platform to obtain pet-care services.

"Booking" — a confirmed reservation of services arranged between a Customer and a Provider through the Platform.

"Content" — text, photographs, video, reviews, schedules and other materials submitted by the Provider to the Platform.

"Service Category" — a type of pet-care service offered through the Platform, including sitting, walking, hosting, transport, training and other approved categories.

"Privacy Notice" — the Pet Wash privacy notice published on the Platform.

"Verification Notice" — the Pet Wash verification notice published on the Platform, listing the specific checks applied to each Service Category and updated from time to time.

"Material Change" — a change to §10, §15, §17, §18, §19 or §22 that triggers a fresh acceptance event.

"Agreement" — this Provider & Host Services Agreement.`,
  },
  {
    id: "1",
    title: "PLATFORM ROLE",
    body:
`Pet Wash Ltd operates a technology platform that connects pet owners with independent providers, including sitters, walkers, hosts, trainers, transport providers and other approved service providers.

Pet Wash provides technology, booking tools, payment facilitation, support tools, trust and safety processes, and marketplace administration. Pet Wash does not itself provide pet sitting, walking, transport, hosting, training or veterinary services unless expressly stated in writing.`,
  },
  {
    id: "2",
    title: "INDEPENDENT CONTRACTOR STATUS",
    body:
`The Provider acts as an independent contractor and not as an employee, worker, agent, partner, franchisee or representative of Pet Wash.

The Provider sets their own hours, may work for competing platforms or for their own private clients, is not required to accept any minimum volume of bookings, and may decline bookings, subject only to neutral and generally applicable platform integrity, fraud-prevention and safety measures. Platform rules apply to use of the Platform only and do not regulate how the Provider organises their independent business.

The Provider controls whether to apply, accept, reject or perform bookings, subject to applicable law, safety obligations and the Customer's agreement.

Nothing in this Agreement creates an employment relationship, partnership, agency, franchise or joint venture.`,
  },
  {
    id: "3",
    title: "PROVIDER RESPONSIBILITY",
    body:
`The Provider is solely responsible for performing services safely, lawfully and professionally, treating each animal with care and in line with applicable animal-welfare standards.

The Provider must:
- follow reasonable owner instructions
- maintain safe premises, equipment and means of transport
- disclose relevant limitations, risks or conflicts
- promptly report incidents, injuries, escapes or emergencies
- comply with applicable animal-welfare law and local regulations
- promptly notify Pet Wash of any suspected compromise of their account credentials

Vehicle transport: where the Service Category involves transporting animals in a vehicle, the Provider warrants that they hold any motor-vehicle insurance required by applicable law and that the vehicle is roadworthy. Pet Wash facilitates the booking only and disclaims responsibility for transport incidents, consistent with §6.`,
  },
  {
    id: "4",
    title: "ANIMAL WELFARE AND DOG SUPERVISION",
    body:
`Providers handling dogs must verify, where applicable, that each dog is licensed, microchipped and currently vaccinated, and must comply with municipal leashing rules and off-leash-zone designations.

Where a Host accepts multiple pets concurrently, the Host warrants that they hold any municipal kennel licence or comparable permit required for that activity by the local authority where the service is performed.`,
  },
  {
    id: "5",
    title: "HOST AND HOME-BASED SERVICES",
    body:
`If the Provider hosts pets at home or at any premises controlled by the Provider, the Provider is solely responsible for ensuring that the premises are safe, suitable, clean, secure and lawful for the service.

Pet Wash does not guarantee, certify or inspect every Provider's premises unless expressly stated.

Where the Provider holds keys or access credentials to a Customer's or Host's premises during a Booking, the Provider is responsible for safekeeping of those keys, must return them on suspension or termination of the relevant Booking, and bears responsibility for any premises damage caused by the Provider, allocated as between Provider and Customer in accordance with §12 and applicable law.`,
  },
  {
    id: "6",
    title: "INSURANCE DISCLAIMER",
    body:
`Pet Wash Ltd is not an insurance company, insurance broker, insurance agent or insurance adviser.

Any references to safety, trust, protection, support, claims assistance or provider requirements do not mean that Pet Wash provides insurance or guarantees that any claim, loss, damage, injury, veterinary cost, property damage or third-party claim will be covered.

Providers remain solely responsible for obtaining and maintaining any insurance required by law or appropriate for the services they provide, including public liability, vehicle, business, professional or pet-care insurance where applicable.

Any third-party insurance product, if ever made available, will be subject only to the policy wording, insurer approval, exclusions, limits and applicable law. Pet Wash does not guarantee claim approval or payment.`,
  },
  {
    id: "7",
    title: "PRIVACY AND PERSONAL DATA",
    body:
`Pet Wash processes the Provider's personal data as a data controller, in accordance with its Privacy Notice and the Privacy Protection Law, 5741-1981. Verification data, including identity documents and selfie images submitted under §11, is processed solely for trust-and-safety, fraud-prevention, legal-compliance and platform-access purposes.

Pet Wash applies a data-minimisation principle. The Provider's account, booking and tax records may be retained for the period required by Israeli commercial record-keeping law; verification artefacts are retained for a shorter window of approximately 24 months after account closure, where lawful and reasonably possible, subject to legal holds, disputes, fraud investigations and statutory retention obligations.

The Provider has the rights of access, correction and deletion of personal data in accordance with §13 of the Privacy Protection Law. Pet Wash will notify the Provider and the Israeli Privacy Protection Authority of a Severe Security Incident affecting the Provider's personal data, without undue delay, in accordance with the law.

Pet Wash uses categories of sub-processors typical for a digital marketplace, including cloud hosting, payment processing, communications (SMS, email), and identity-verification vendors, subject to contractual safeguards.

Any transfer of personal data outside Israel will rely on a country offering adequate protection or on contractual safeguards under the Privacy Protection Regulations (Transfer of Data Abroad), 5761-2001.

Pet Wash maintains the providers and hosts database in accordance with the registration obligations under the Privacy Protection Law, where applicable to the data volumes and categories processed.`,
  },
  {
    id: "8",
    title: "NON-DISCRIMINATION AND ACCESSIBILITY",
    body:
`The Provider shall not discriminate against Customers on any prohibited ground under the Prohibition on Discrimination in Products, Services and Entry to Public Places Law, 5761-2000.

The Provider shall make reasonable accommodations for Customers with disabilities and for certified service or assistance animals, to the extent the Service Category allows, in accordance with the Equal Rights for People with Disabilities Law, 5758-1998 and the regulations issued thereunder.`,
  },
  {
    id: "9",
    title: "TAX, BUSINESS AND LEGAL COMPLIANCE",
    body:
`The Provider is solely responsible for taxes, VAT, business registration, invoices, receipts, bookkeeping, permits, licences, social insurance and reporting obligations relating to their activity through the Platform.

The Provider warrants that they hold the correct Israeli tax status for that activity (עוסק פטור, עוסק מורשה, חברה בע״מ or another lawful classification) and will notify Pet Wash of any change.

Pet Wash may request business details, tax identification, bank details or supporting documents before allowing payouts or platform approval.`,
  },
  {
    id: "10",
    title: "PAYMENTS AND PLATFORM FEES",
    body:
`Pet Wash may facilitate Customer payments through approved payment providers. Pet Wash may deduct platform fees, commissions, refunds, chargebacks, adjustments, taxes or amounts lawfully owed before payout.

Where platform rules require payment through the Platform, the Provider shall not bypass the Platform's payment system in respect of Customers introduced through the Platform, within the post-introduction window set out in the published platform rules. Outside that scope, the Provider remains free to receive payment from their own clients and through any other lawful channel.

Customer cancellation and refund mechanics are determined by Pet Wash from time to time in accordance with the Consumer Protection Law, 5741-1981 and the published Customer terms. The Provider acknowledges that Customers have statutory cancellation and refund rights under Israeli law that operate independently of this Agreement.`,
  },
  {
    id: "11",
    title: "VERIFICATION AND SAFETY CHECKS",
    body:
`Pet Wash may apply verification and safety checks proportionate to the Service Category, the level of access to pets and premises, and applicable law.

Such checks may include identity verification, selfie verification, business or entity verification, insurance-document upload, residential or service-area confirmation, criminal declaration, and a background check where required by law or where a Customer-safety risk is identified.

Verification and safety checks are for platform access, fraud prevention, anti-money-laundering compliance, legal compliance and Customer trust only. They do not constitute employment supervision, operational management, or any form of behavioural or performance control of the Provider's independent business.

The lawful basis for processing verification data is set out in §7. Verification artefacts will be retained on the minimisation principle described in §7.

Platform approval is not guaranteed. Pet Wash may refuse, suspend or remove a Provider under the single suspension standard set out in §14, where reasonably necessary for safety, compliance, fraud prevention, Customer protection, platform integrity or legal reasons.

The specific checks applied to each Service Category are published in Pet Wash's Verification Notice, updated from time to time.`,
  },
  {
    id: "12",
    title: "CUSTOMER RELATIONSHIP",
    body:
`The service relationship for each Booking is between the Customer and the Provider. Pet Wash provides the Platform tools and may assist with support, communication, payments, dispute facilitation and safety processes, but Pet Wash is not the direct provider of the pet-care service.

Premises damage, lost or damaged property and other Booking-specific disputes are allocated between Customer and Provider in accordance with applicable law, the Customer's terms with Pet Wash, the published platform rules, and the §5 key-holding allocation where applicable. Pet Wash may assist with documentation and dispute facilitation but does not adjudicate civil liability between Customer and Provider.`,
  },
  {
    id: "13",
    title: "INTELLECTUAL PROPERTY AND CONTENT LICENCE",
    body:
`The Provider retains ownership of Content they upload. The Provider grants Pet Wash a non-exclusive, worldwide, royalty-free licence to host, display, reproduce, adapt and promote the Content, solely for the purpose of operating the Platform, including search, listings, marketing, support and analytics.

Section 19 (Language Precedence) governs the scope of this licence as it does the rest of this Agreement. Where the Provider removes Content from the Platform, Pet Wash will cease active display within a reasonable period; non-display retention for backups, audit logs and archival evidence may continue where lawful and reasonably necessary.`,
  },
  {
    id: "14",
    title: "ACCOUNT SUSPENSION AND TERMINATION",
    body:
`Either party may terminate this Agreement at any time by written notice through the Platform or to the contacts in §20.

Pet Wash may suspend the Provider's access to the Platform where reasonably necessary for safety, compliance, fraud prevention, Customer protection, platform integrity or legal reasons. A single suspension standard applies across §11 and this §14. Where reasonably possible and not contrary to safety, fraud or legal duties, Pet Wash will give the Provider advance notice of suspension and a fair opportunity to respond.

On termination, the Provider may request export of their own account data within thirty days. Thereafter, retention follows §7 and applicable law.`,
  },
  {
    id: "15",
    title: "LIMITATION OF LIABILITY",
    body:
`To the maximum extent permitted by law, Pet Wash is not responsible for the acts, omissions, negligence, misconduct, availability or service quality of any Provider or Customer.

Nothing in this Agreement excludes or limits rights or remedies that cannot be excluded or limited under applicable Israeli law.`,
  },
  {
    id: "16",
    title: "MODIFICATIONS AND EFFECTIVE DATE",
    body:
`Pet Wash may update this Agreement from time to time. Material Changes, as defined in §0, will be notified to the Provider in advance through the Platform, together with the new version's effective date.

Continued use of the Platform after the effective date of a Material Change constitutes acceptance of the updated Agreement.`,
  },
  {
    id: "17",
    title: "GOVERNING LAW AND JURISDICTION",
    body:
`This Agreement is governed by the laws of the State of Israel.

The competent courts of Tel Aviv-Jaffa shall have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement, subject to non-waivable consumer or labour forum rights of the Provider.`,
  },
  {
    id: "18",
    title: "DISPUTE RESOLUTION",
    body:
`Before commencing proceedings, the parties will first attempt good-faith resolution through the Pet Wash support channels listed in §20, for a period of thirty days.

The parties may also agree to non-binding mediation in Tel Aviv-Jaffa.

Nothing in this section limits a party's right to seek urgent or interim relief, or to pursue any non-waivable statutory remedy, including rights under the Class Actions Law, 5766-2006, or the consumer-protection and labour forums preserved under §17.`,
  },
  {
    id: "19",
    title: "LANGUAGE PRECEDENCE",
    body:
`This Agreement is presented in Hebrew and in English for the Provider's convenience.

In any conflict between the Hebrew and English versions, the Hebrew version shall prevail. The rendered-language hash recorded under §22 evidences which language was displayed to the Provider at the time of acceptance, without prejudice to §17.`,
  },
  {
    id: "20",
    title: "NOTICES AND CONTACTS",
    body:
`Legal notices: legal@petwash.co.il
Privacy and data-subject requests: privacy@petwash.co.il
General support: support@petwash.co.il

Pet Wash will communicate with the Provider through the contact details on the Provider's account and through in-Platform notifications. Legal notices to Pet Wash Ltd, Israeli company number 517145033, shall be sent to the canonical legal address above.`,
  },
  {
    id: "21",
    title: "SEVERABILITY",
    body:
`If any provision of this Agreement is found to be unenforceable, in whole or in part, the remaining provisions shall continue in full force and effect, and the unenforceable provision shall be construed to the closest enforceable meaning.`,
  },
  {
    id: "22",
    title: "DIGITAL ACCEPTANCE",
    body:
`By applying, registering, accepting Bookings, digitally signing or continuing to use the provider Platform, the Provider confirms that they have read, understood and agreed to this Agreement.

Digital acceptance records may include the agreement version, the rendered-language hash, an ISO-8601 timestamp in Asia/Jerusalem time, the Provider's account identifier, the Provider's IP address, device metadata reasonably necessary for fraud prevention and account-security purposes, and other technical metadata reasonably necessary for security, fraud prevention, legal compliance and platform-integrity purposes, as described in the Privacy Notice.

Where Pet Wash adopts upgraded cryptographic hashing or signed-timestamp standards in the future, the historical verifiability of prior acceptance records will be preserved.`,
  },
];

export const PROVIDER_HOST_AGREEMENT_EN: AgreementBody = {
  title: "PET WASH LTD — PROVIDER & HOST SERVICES AGREEMENT",
  lastUpdated: "May 2026",
  sections: EN_SECTIONS,
};

// ─────────────────────────────────────────────────────────────
// 5. Hebrew body — DRAFT prose (NOT verified) + RAW (provenance)
//
// The DRAFT Hebrew prose below mirrors the 23 EN sections in
// clean Hebrew prose (not mobile-RTL-fragmented). It is
// preserved for Counsel review. PROVIDER_HOST_AGREEMENT_HE
// remains `null` and PROVIDER_HOST_AGREEMENT_HE_VERIFIED
// remains `false`. The runtime falls back to English via
// getAgreementBody() until PR-LEGAL-A-HE flips both:
//   PROVIDER_HOST_AGREEMENT_HE = { ...HE_DRAFT contents }
//   PROVIDER_HOST_AGREEMENT_HE_VERIFIED = true
// after Counsel verifies the prose and confirms the §6
// mandatory phrase is present.
//
// The RAW Hebrew block from the prior PR is also kept below
// for forensic provenance of the CEO's mobile-chat paste.
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

const HE_SECTIONS_DRAFT: readonly AgreementSection[] = [
  {
    id: "0",
    title: "הגדרות",
    body:
`לצורך הסכם זה, למונחים הבאים תהיה המשמעות הקבועה להלן:

"פט וואש" או "פט וואש בע״מ" — פט וואש בע״מ, חברה ישראלית פרטית, מספר חברה 517145033, הפועלת תחת השם פט וואש ובשם פט וואש בע״מ.

"הפלטפורמה" — אתר האינטרנט של פט וואש, היישומונים לנייד, ממשקי תכנות, עמדות שירות, חומרה וטכנולוגיות נלוות המופעלים על-ידי פט וואש.

"נותן השירות" — יחיד או גוף עסקי שאושר על-ידי פט וואש לספק שירותי טיפול בבעלי חיים באמצעות הפלטפורמה.

"מארח" — נותן שירות המספק שירותים מבוססי-בית או שהמקום שבחזקתו משמש לאירוח חיות מחמד במהלך השירות.

"לקוח" — בעל חיית מחמד או מי שמוסמך לפעול בשמו, המשתמש בפלטפורמה לקבלת שירותים.

"הזמנה" — הזמנת שירות שאושרה בין לקוח לנותן שירות באמצעות הפלטפורמה.

"תכנים" — טקסט, תמונות, וידאו, חוות-דעת, לוחות זמנים וחומרים אחרים שמעלה נותן השירות לפלטפורמה.

"קטגוריית שירות" — סוג של שירות המוצע באמצעות הפלטפורמה, לרבות שמירה, הליכה, אירוח, הסעה, אילוף וקטגוריות מאושרות אחרות.

"הודעת הפרטיות" — הודעת הפרטיות של פט וואש המפורסמת בפלטפורמה.

"הודעת האימות" — הודעת האימות של פט וואש המפורסמת בפלטפורמה, המפרטת את אמצעי האימות החלים על כל קטגוריית שירות ומתעדכנת מעת לעת.

"שינוי מהותי" — שינוי בסעיפים 10, 15, 17, 18, 19 או 22 המחייב מתן הסכמה מחדש.

"ההסכם" — הסכם נותני שירות ומארחים זה.`,
  },
  {
    id: "1",
    title: "תפקיד הפלטפורמה",
    body:
`פט וואש בע״מ מפעילה פלטפורמה טכנולוגית המחברת בין בעלי חיות מחמד לבין נותני שירות עצמאיים, לרבות סיטרים, ווקרים, מארחים, מאלפים, מסיעי בעלי חיים ונותני שירות מאושרים נוספים.

פט וואש מספקת טכנולוגיה, כלי הזמנה, סיוע בעיבוד תשלומים, כלי תמיכה, תהליכי אמון ובטיחות וניהול פלטפורמה. פט וואש בעצמה אינה מספקת שירותי שמירה, הליכה, הסעה, אירוח, אילוף או שירותים וטרינריים, אלא אם נאמר אחרת במפורש ובכתב.`,
  },
  {
    id: "2",
    title: "מעמד נותן שירות עצמאי",
    body:
`נותן השירות פועל כקבלן עצמאי ולא כעובד, שליח, סוכן, שותף, זכיין או נציג של פט וואש.

נותן השירות קובע את שעות עבודתו לפי שיקול דעתו, רשאי להעניק שירותים גם דרך פלטפורמות מתחרות או ללקוחותיו הפרטיים, אינו מחויב להיקף הזמנות מינימלי, ורשאי לסרב להזמנות, בכפוף בלבד לאמצעים נייטרליים ובעלי תחולה כללית של שלמות הפלטפורמה, מניעת הונאה ובטיחות. כללי הפלטפורמה חלים על אופן השימוש בפלטפורמה בלבד ואינם מסדירים את ניהול עסקו העצמאי של נותן השירות.

נותן השירות שולט אם להגיש בקשה, לקבל, לדחות או לבצע הזמנות, בכפוף לדין החל, לחובות בטיחות ולהסכמות עם הלקוח.

שום דבר בהסכם זה אינו יוצר יחסי עובד-מעביד, שותפות, סוכנות, זכיינות או מיזם משותף.`,
  },
  {
    id: "3",
    title: "אחריות נותן השירות",
    body:
`נותן השירות אחראי באופן בלעדי לביצוע השירותים בצורה בטוחה, חוקית ומקצועית, תוך טיפול בכל בעל חיים בזהירות ובהתאם לסטנדרטים של רווחת בעלי חיים החלים בדין.

נותן השירות חייב:
- לפעול לפי הוראות סבירות של בעל חיית המחמד
- לשמור על מקום, ציוד ואמצעי הסעה בטוחים
- לגלות מגבלות, סיכונים או ניגודי עניינים רלוונטיים
- לדווח ללא דיחוי על אירוע, פציעה, בריחה או מצב חירום
- לפעול בהתאם לחוק צער בעלי חיים ולתקנות הרלוונטיות
- להודיע לפט וואש בע״מ ללא דיחוי על כל חשד לפגיעה בפרטי הגישה לחשבונו

הסעת בעלי חיים: כאשר קטגוריית השירות כוללת הסעת בעלי חיים ברכב, נותן השירות מצהיר כי ברשותו ביטוח רכב הנדרש לפי דין וכי הרכב כשיר לתנועה. פט וואש מסייעת בתיווך ההזמנה בלבד ומסירה אחריות בגין אירועי הסעה, בהתאם לסעיף 6.`,
  },
  {
    id: "4",
    title: "רווחת בעלי חיים וחוק להסדרת הפיקוח על כלבים",
    body:
`נותן שירות המטפל בכלבים יוודא, ככל שרלוונטי, כי כל כלב מחוסן, מסומן בשבב וברשותו רישיון תקף, ויפעל בהתאם לכללי הרצועה ולשטחים המותרים להתרה ברשות המקומית.

מארח המקבל מספר חיות מחמד במקביל מצהיר כי ברשותו רישיון פנסיון או היתר מקביל הנדרש לפעילות זו על-ידי הרשות המקומית במקום מתן השירות.`,
  },
  {
    id: "5",
    title: "אירוח ושירותים בבית נותן השירות",
    body:
`אם נותן השירות מארח חיות מחמד בביתו או במקום שבשליטתו, נותן השירות אחראי באופן בלעדי לכך שהמקום בטוח, מתאים, נקי, מאובטח וחוקי למתן השירות.

פט וואש בע״מ אינה מתחייבת לבדוק, לאשר או לפקח על כל מקום של נותן שירות, אלא אם נאמר אחרת במפורש.

כאשר נותן השירות מחזיק במפתחות או באמצעי גישה לחצריו של לקוח או של מארח במהלך הזמנה, הוא אחראי לשמירתם, חייב להחזירם בעת השעיה או סיום ההזמנה הרלוונטית, ונושא באחריות לכל נזק לחצרים שנגרם על-ידיו, בכפוף לחלוקת אחריות עם הלקוח לפי סעיף 12 ולדין החל.`,
  },
  {
    id: "6",
    title: "הבהרת ביטוח",
    body:
`פט וואש בע״מ אינה חברת ביטוח, סוכנות ביטוח, סוכן ביטוח או יועצת ביטוח.

כל אזכור של בטיחות, אמון, הגנה, תמיכה, סיוע בתביעות או דרישות מנותני שירות אינו אומר שפט וואש מספקת ביטוח או מבטיחה שכיסוי, תביעה, נזק, פציעה, הוצאה וטרינרית, נזק לרכוש או תביעת צד שלישי יאושרו או ישולמו.

נותן השירות אחראי באופן בלעדי להשיג ולהחזיק בכל ביטוח הנדרש לפי דין או המתאים לשירותים שהוא מספק, לרבות ביטוח אחריות צד ג׳, ביטוח רכב, ביטוח עסקי, ביטוח מקצועי או ביטוח שירותי טיפול בחיות מחמד, לפי העניין.

כל מוצר ביטוח צד שלישי, אם יוצע בעתיד, יהיה כפוף אך ורק לתנאי הפוליסה, אישור המבטח, חריגים, מגבלות והדין החל. פט וואש אינה מתחייבת לאישור או תשלום של כל תביעה.`,
  },
  {
    id: "7",
    title: "פרטיות ומידע אישי",
    body:
`פט וואש בע״מ מעבדת מידע אישי של נותן השירות כבעלת מאגר מידע, בהתאם להודעת הפרטיות שלה ולחוק הגנת הפרטיות, התשמ״א-1981. נתוני אימות, לרבות מסמכי זיהוי ותמונות סלפי המוגשים לפי סעיף 11, מעובדים אך ורק לצורכי אמון ובטיחות, מניעת הונאה, ציות לדין וגישה לפלטפורמה.

פט וואש פועלת לפי עיקרון של צמצום מידע. נתוני חשבון, הזמנות ומסים עשויים להישמר למשך התקופה הנדרשת לפי דיני שמירת רשומות מסחריות; פריטי אימות יישמרו לתקופה קצרה יותר של כ-24 חודשים לאחר סגירת החשבון, ככל שהדבר אפשרי באופן סביר ועומד בדין, וזאת בכפוף לעיכובים משפטיים, מחלוקות, חקירות הונאה וחובות שמירה סטטוטוריות.

נותן השירות זכאי לעיין במידע אודותיו, לתקנו ולבקש את מחיקתו בהתאם לסעיף 13 לחוק הגנת הפרטיות. פט וואש בע״מ תודיע לנותן השירות ולרשות להגנת הפרטיות על אירוע אבטחה חמור הפוגע במידע האישי של נותן השירות, ללא דיחוי בלתי סביר, בהתאם לדין.

פט וואש משתמשת בקטגוריות של מעבדים-משניים אופייניות לפלטפורמה דיגיטלית, לרבות אחסון ענן, עיבוד תשלומים, תקשורת (SMS ודוא״ל) וספקי אימות זהות, בכפוף להגנות חוזיות.

כל העברה של מידע אישי אל מחוץ לישראל תיעשה אל מדינה המספקת רמת הגנה נאותה או על בסיס הגנות חוזיות לפי תקנות הגנת הפרטיות (העברת מידע אל מאגרים שמחוץ לגבולות המדינה), התשס״א-2001.

פט וואש בע״מ מנהלת את מאגר נותני השירות והמארחים בהתאם לחובות הרישום שבחוק הגנת הפרטיות, ככל שהדבר חל על היקפי וסוגי המידע המעובדים.`,
  },
  {
    id: "8",
    title: "איסור הפליה ונגישות",
    body:
`נותן השירות לא יפלה לקוחות על בסיס עילה אסורה לפי החוק לאיסור הפליה במוצרים, בשירותים ובכניסה למקומות בידור ולמקומות ציבוריים, התשס״א-2000.

נותן השירות יבצע התאמות סבירות עבור לקוחות עם מוגבלות ועבור כלבי שירות וכלבי סיוע מאושרים, ככל שהדבר אפשרי במסגרת קטגוריית השירות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998 ולתקנות שהותקנו מכוחו.`,
  },
  {
    id: "9",
    title: "מסים, עסק ועמידה בדרישות הדין",
    body:
`נותן השירות אחראי באופן בלעדי למסים, מע״מ, רישום עסקי, חשבוניות, קבלות, הנהלת חשבונות, היתרים, רישיונות, ביטוח לאומי ודיווחים הנוגעים לפעילותו דרך הפלטפורמה.

נותן השירות מצהיר כי הוא מחזיק בסיווג מס ישראלי תקף לפעילותו (עוסק פטור, עוסק מורשה, חברה בע״מ או סיווג חוקי אחר), ויעדכן את פט וואש בע״מ בכל שינוי.

פט וואש רשאית לדרוש פרטי עסק, זיהוי מס, פרטי בנק או מסמכים תומכים לפני אישור תשלומים או אישור נותן השירות בפלטפורמה.`,
  },
  {
    id: "10",
    title: "תשלומים ועמלות פלטפורמה",
    body:
`פט וואש רשאית לאפשר תשלומי לקוחות באמצעות ספקי תשלום מאושרים. פט וואש רשאית לנכות עמלות פלטפורמה, החזרים, הכחשות עסקה, התאמות, מסים או סכומים המגיעים כדין לפני העברת התשלום לנותן השירות.

כאשר כללי הפלטפורמה מחייבים תשלום דרך הפלטפורמה, נותן השירות לא יעקוף את מערכת התשלום של הפלטפורמה ביחס ללקוחות שהוצגו לו דרך הפלטפורמה, וזאת בתוך חלון הזמן שנקבע בכללי הפלטפורמה המפורסמים. מחוץ להיקף האמור, נותן השירות נותר חופשי לקבל תשלום מלקוחותיו שלו ובכל ערוץ חוקי אחר.

מנגנוני ביטול והחזר ללקוחות נקבעים מעת לעת על-ידי פט וואש בע״מ בהתאם לחוק הגנת הצרכן, התשמ״א-1981 ולתנאי הלקוח המפורסמים. נותן השירות מאשר כי ללקוחות יש זכויות ביטול והחזר סטטוטוריות לפי הדין הישראלי, הפועלות באופן בלתי תלוי בהסכם זה.`,
  },
  {
    id: "11",
    title: "אימות ובדיקות בטיחות",
    body:
`פט וואש בע״מ רשאית להפעיל בדיקות אימות ובטיחות המידתיות לקטגוריית השירות, לרמת הגישה לבעלי החיים ולחצרים, ולדין החל.

בדיקות אלה עשויות לכלול אימות זהות, אימות סלפי, אימות עסקי, העלאת מסמכי ביטוח, אישור אזור מגורים או אזור שירות, הצהרה פלילית ובדיקת רקע — אך ורק כאשר הדבר נדרש לפי דין או כאשר זוהה סיכון לבטיחות הלקוח.

האימות ובדיקות הבטיחות נועדו לגישה לפלטפורמה, למניעת הונאה, לעמידה בדיני איסור הלבנת הון, לציות לדין ולאמון הלקוחות בלבד. הם אינם מהווים פיקוח תעסוקתי, ניהול תפעולי, או כל צורה של בקרה התנהגותית או של ביצועים על העסק העצמאי של נותן השירות.

הבסיס החוקי לעיבוד נתוני האימות מפורט בסעיף 7. פריטי אימות יישמרו לפי עיקרון הצמצום שבסעיף 7.

אישור נותן השירות בפלטפורמה אינו מובטח. פט וואש רשאית לדחות, להשעות או להסיר נותן שירות לפי סטנדרט ההשעיה האחיד שבסעיף 14, כאשר הדבר נדרש באופן סביר מטעמי בטיחות, ציות, מניעת הונאה, הגנה על לקוחות, שמירה על שלמות הפלטפורמה או סיבות משפטיות.

אמצעי האימות הספציפיים החלים על כל קטגוריית שירות מפורסמים בהודעת האימות של פט וואש בע״מ ומתעדכנים מעת לעת.`,
  },
  {
    id: "12",
    title: "הקשר מול הלקוח",
    body:
`הקשר למתן השירות בכל הזמנה הוא בין הלקוח לבין נותן השירות. פט וואש מספקת כלי פלטפורמה ועשויה לסייע בתמיכה, תקשורת, תשלומים, הקלת מחלוקות ותהליכי בטיחות, אך פט וואש אינה נותנת את השירות הישיר של טיפול בחיית המחמד.

נזק לחצרים, אובדן או נזק לרכוש ומחלוקות נוספות הנוגעות להזמנה ייפתרו בין הלקוח לבין נותן השירות בהתאם לדין החל, לתנאי הלקוח מול פט וואש בע״מ, לכללי הפלטפורמה המפורסמים ולחלוקת האחריות שבסעיף 5 (מפתחות ואחזקת חצרים) ככל שרלוונטי. פט וואש עשויה לסייע בתיעוד ובהקלת המחלוקת, אך אינה מכריעה בחבות אזרחית בין הלקוח לנותן השירות.`,
  },
  {
    id: "13",
    title: "קניין רוחני ורישיון תכנים",
    body:
`נותן השירות שומר על הבעלות בתכנים שהעלה. נותן השירות מעניק לפט וואש בע״מ רישיון בלתי ייחודי, עולמי וללא תמלוגים, לארח, להציג, לשכפל, להתאים ולקדם את התכנים, וזאת אך ורק לצורך הפעלת הפלטפורמה, לרבות חיפוש, מודעות, שיווק, תמיכה וניתוח.

סעיף 19 (עדיפות לשונית) חל גם על היקף רישיון זה כפי שהוא חל על יתר הוראות ההסכם. כאשר נותן השירות מסיר תכנים מהפלטפורמה, פט וואש תפסיק את ההצגה הפעילה בתוך פרק זמן סביר; שמירה לצרכים שאינם הצגה, לרבות גיבויים, יומני ביקורת וראיות ארכיוניות, עשויה להימשך ככל שהדבר חוקי וסביר.`,
  },
  {
    id: "14",
    title: "השעיה וסיום",
    body:
`כל צד רשאי לסיים הסכם זה בכל עת בהודעה בכתב באמצעות הפלטפורמה או לאיש הקשר המפורט בסעיף 20.

פט וואש בע״מ רשאית להשעות את גישתו של נותן השירות לפלטפורמה כאשר הדבר נדרש באופן סביר מטעמי בטיחות, ציות, מניעת הונאה, הגנה על לקוחות, שמירה על שלמות הפלטפורמה או סיבות משפטיות. סטנדרט השעיה אחיד חל הן על סעיף 11 והן על סעיף זה. ככל שהדבר אפשרי באופן סביר ואינו עומד בסתירה לחובות בטיחות, הונאה או דין, פט וואש בע״מ תיתן לנותן השירות הודעה מוקדמת על השעיה והזדמנות הוגנת להשמיע את עמדתו.

עם סיום ההתקשרות רשאי נותן השירות לבקש ייצוא של נתוני חשבונו תוך שלושים ימים. לאחר מכן השמירה תיעשה לפי סעיף 7 והדין החל.`,
  },
  {
    id: "15",
    title: "הגבלת אחריות",
    body:
`במידה המרבית המותרת לפי דין, פט וואש בע״מ אינה אחראית למעשים, מחדלים, רשלנות, התנהגות, זמינות או איכות השירות של כל נותן שירות או לקוח.

אין בהסכם זה כדי לשלול או להגביל זכויות או סעדים שלא ניתן לשלול או להגביל לפי דין החל בישראל.`,
  },
  {
    id: "16",
    title: "שינויים ומועד תחילה",
    body:
`פט וואש בע״מ רשאית לעדכן הסכם זה מעת לעת. שינוי מהותי, כהגדרתו בסעיף 0, יובא לידיעת נותן השירות מראש באמצעות הפלטפורמה, יחד עם מועד התחילה של הגרסה החדשה.

המשך שימוש בפלטפורמה לאחר מועד התחילה של שינוי מהותי מהווה הסכמה להסכם המעודכן.`,
  },
  {
    id: "17",
    title: "דין חל וסמכות שיפוט",
    body:
`על הסכם זה יחולו דיני מדינת ישראל.

סמכות השיפוט הייחודית בכל סכסוך הנובע מהסכם זה או הקשור בו תהיה לבתי המשפט המוסמכים במחוז תל אביב-יפו, בכפוף לזכויות פורום צרכניות או דיני עבודה שאינן ניתנות להתניה של נותן השירות.`,
  },
  {
    id: "18",
    title: "יישוב מחלוקות",
    body:
`בטרם פתיחת הליכים, יפעלו הצדדים תחילה ליישוב המחלוקת בתום לב באמצעות ערוצי התמיכה של פט וואש בע״מ המפורטים בסעיף 20, במשך שלושים ימים.

הצדדים רשאים גם להסכים לגישור בלתי-מחייב בתל אביב-יפו.

אין בסעיף זה כדי לגרוע מזכותו של צד לבקש סעד דחוף או זמני, או לפעול לכל סעד סטטוטורי שאינו ניתן להתניה, לרבות זכויות לפי חוק תובענות ייצוגיות, התשס״ו-2006, ולפורומים צרכניים או של דיני עבודה הנשמרים לפי סעיף 17.`,
  },
  {
    id: "19",
    title: "עדיפות לשונית",
    body:
`הסכם זה מוצג בעברית ובאנגלית לנוחות נותן השירות.

בכל סתירה בין הנוסח העברי לנוסח האנגלי, יגבר הנוסח העברי. ההאש של השפה שהוצגה (rendered-language hash) שנשמר לפי סעיף 22 משמש כראיה לשפה שהוצגה לנותן השירות במועד הקבלה, מבלי לגרוע מסעיף 17.`,
  },
  {
    id: "20",
    title: "הודעות ופרטי קשר",
    body:
`הודעות משפטיות: legal@petwash.co.il
ענייני פרטיות ובקשות בעלי מידע: privacy@petwash.co.il
תמיכה כללית: support@petwash.co.il

פט וואש בע״מ תפנה לנותן השירות באמצעות פרטי הקשר בחשבונו ובאמצעות התראות בפלטפורמה. הודעות משפטיות לפט וואש בע״מ, מספר חברה 517145033, יישלחו לכתובת הקנונית המשפטית לעיל.`,
  },
  {
    id: "21",
    title: "הפרדת תניות",
    body:
`ככל שתנאי כלשהו בהסכם זה יימצא בלתי אכיף, כולו או חלקו, יוסיפו יתר התנאים לעמוד בתוקפם המלא, והתנאי הבלתי אכיף יפורש למשמעות האכיפה הקרובה ביותר.`,
  },
  {
    id: "22",
    title: "קבלה דיגיטלית",
    body:
`באמצעות הגשת בקשה, הרשמה, קבלת הזמנות, חתימה דיגיטלית או המשך שימוש בפלטפורמת נותני השירות, נותן השירות מאשר כי קרא, הבין והסכים להסכם זה.

רשומות קבלה דיגיטלית עשויות לכלול את גרסת ההסכם, את ההאש של השפה שהוצגה, חותמת זמן ISO-8601 בשעון Asia/Jerusalem, את מזהה החשבון של נותן השירות, את כתובת ה-IP של נותן השירות, מטא-נתונים של מכשיר הנדרשים באופן סביר למניעת הונאה ולאבטחת חשבון, ומטא-נתונים טכניים נוספים הנדרשים באופן סביר לצורכי אבטחה, מניעת הונאה, ציות לדין ושלמות הפלטפורמה, כמפורט בהודעת הפרטיות.

ככל שפט וואש בע״מ תאמץ בעתיד תקני הצפנה או חתימת-זמן מתקדמים יותר, יישמר תוקף האימות של רשומות קבלה היסטוריות.`,
  },
];

/**
 * DRAFT Hebrew prose body — mirrors the 23 EN sections in
 * clean Hebrew prose. Counsel must verify before it can be
 * promoted to `PROVIDER_HOST_AGREEMENT_HE` and before
 * `PROVIDER_HOST_AGREEMENT_HE_VERIFIED` flips to `true`.
 *
 * The runtime MUST NOT read this body for display. Use
 * `getAgreementBody()` which respects the verification gate.
 */
export const PROVIDER_HOST_AGREEMENT_HE_DRAFT: AgreementBody = {
  title: "פט וואש בע״מ — הסכם נותני שירות ומארחים",
  lastUpdated: "מאי 2026",
  sections: HE_SECTIONS_DRAFT,
};

/**
 * Raw Hebrew agreement text as supplied by CEO in chat to the
 * prior PR (PR-LEGAL-A #246), preserved verbatim including the
 * broken vertical line layout. NOT to be displayed to providers.
 *
 * Provenance only. Replaced by HE_DRAFT (above) for any future
 * promotion to PROVIDER_HOST_AGREEMENT_HE under PR-LEGAL-A-HE.
 */
export const PROVIDER_HOST_AGREEMENT_HE_RAW: AgreementRawSource = {
  lang: "he",
  status: "raw-unverified",
  notes:
    "Mobile RTL chat paste produced a vertical line-per-word layout. " +
    "Cannot be displayed as Hebrew prose. Superseded by " +
    "PROVIDER_HOST_AGREEMENT_HE_DRAFT for Counsel review. " +
    "PROVIDER_HOST_AGREEMENT_HE_VERIFIED must remain false until " +
    "Counsel verifies the HE_DRAFT prose.",
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
 * signed off on the HE_DRAFT prose and confirmed the §6
 * mandatory phrase is present.
 * Until then, this is null and the runtime must fall back to
 * English.
 */
export const PROVIDER_HOST_AGREEMENT_HE: AgreementBody | null = null;

// ─────────────────────────────────────────────────────────────
// 6. Public surface
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
