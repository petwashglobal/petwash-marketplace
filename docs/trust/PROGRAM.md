# Living Trust Ecosystem — Program

> **Status:** governance document. Defines the binding rules
> and the PR sequence for every Pet Wash module that shapes
> how users feel trust, safety, and belonging across the
> platform.
>
> This document does NOT itself ship runtime code. It is the
> contract every downstream TRUST-* PR must cite and obey.
> Treat it like a constitution — not a guideline.
>
> **Authority:** CEO sign-off required to change any rule.
> Counsel sign-off required on §14 (Provider Safety &
> Capability Declaration), §17 (Bilingual canonical
> wording), §18 (Israel heat-safety operational claims).
>
> **Version:** 2026-05-13
> **Constitutional references:** `docs/location/PRIVACY.md`
> §3, §7, §10, §11, §13, §14, §17 · Provider & Host
> Services Agreement (PR-LEGAL-A #246) §4, §9, §10, §11, §15

---

## 0. Why this document exists

Pet Wash is emotionally closer to its users than Uber.
People care more about their pet than about a taxi. That
proximity is the platform's real moat — but only if every
trust surface acts together. The forensic audit of the
auth subsystem (2026-05-10) showed how a "core capability"
becomes a spaghetti layer when each team invents its own
truth. The Location program (`docs/location/PROGRAM.md`)
applied the corrective pattern: lock the rules first, then
ship single-purpose PRs against them.

This document is the same corrective pattern for the
trust surface. The 12 modules below (Pet Passport,
Provider Trust Card, Live Booking Cards, Safety Widget,
Badge taxonomy, Pet Timeline, IL-aware notifications,
WhatsApp channel, Home dock, Social proof, Provider
Safety & Capability Declaration, plus the doc you are
reading) are coupled only through these rules.

The constitutional anchor for everything below is §8 of
the Provider & Host Services Agreement (merged in
PR-LEGAL-A #246):

> "Pet Wash Ltd is not an insurance company, insurance
> broker or insurance adviser."

Nothing in this program may contradict that. The repo-wide
FORBIDDEN_PATTERNS scan landed in PR-LEGAL-B #247 / #248
extends to every file added under this program.

---

## 1. Scope

### 1.1 In scope
- Pet identity (Pet Passport)
- Provider identity (Provider Trust Card)
- Live booking status cards
- Safety widget (SOS, share live trip, nearest emergency
  vet)
- Badge taxonomy (verified-by-platform attributes)
- Per-pet timeline view
- IL-aware notifications (heat warnings, vaccination
  renewals, pet birthdays, favourite-walker availability,
  rain alerts)
- WhatsApp deep-link channel (`wa.me/?text=`)
- Home "what's happening right now" dock
- Social-proof component (neighbours-in-citySymbol pattern)
- **Provider Safety & Capability Declaration**
  (foundational layer — see §14)

### 1.2 Out of scope (handled by other documents)
- Money, payouts, wallet, escrow, payment processing
- K9000 hardware integration
- Auth subsystem
- Schema migrations on protected tables without separate
  approval
- Insurance promises of any kind (forbidden by §8 of the
  Agreement + PR #248 regression lock)
- Marketing-consent privacy (owned by marketing-consent
  doc)
- Full medical / health records (forbidden by H12)

If you are unsure which document applies, default to the
stricter one until Counsel clarifies.

---

## 2. Hard rules (every TRUST-* PR MUST obey)

These are binding invariants. The regression test in this
PR asserts each one verbatim.

**H1.** Pet identity is canonical. One pets row per pet;
every consumer reads through it, never duplicates
allergies / vet / chip / vaccinations.

**H2.** Provider identity is canonical. One profile row
per provider per platform; every consumer reads through
it.

**H3.** Live status events flow through booking
LifecycleService only. No platform invents its own state
machine.

**H4.** WhatsApp / SMS / FCM are channels, not sources of
truth. The booking row is the source of truth; channels
are projections.

**H5.** Address staging from PRIVACY.md §6 is law. Living
cards never reveal more than the booking stage allows.

**H6.** No fake social proof. "X neighbours in citySymbol
used this provider" requires ≥3 distinct verified
customers, no per-customer attribution.

**H7.** No new insurance promises. PR #248
FORBIDDEN_PATTERNS scan keeps holding.

**H8.** Hebrew-first. Every new card ships with HE + EN
at minimum. Other locales follow.

**H9.** iPhone Safari + safe-area + 100dvh mandatory on
every new surface.

**H10.** Single audit-log verb per consumer action.
PRIVACY.md §7 verb taxonomy extends; no parallel logging.

**H11.** Provider Safety & Capability Declaration is
MANDATORY in onboarding, framed as "fitness and
capability to safely perform selected services," NOT as
employment medical screening. Not a hidden checkbox. Not
skippable.

**H12.** Pet Wash NEVER collects full medical records,
diagnoses, medications, psychiatric or disability
details, or protected medical information, unless
external legal counsel explicitly approves collection
for a specific regulated role. Default posture: no
medical data storage.

**H13.** Doctor confirmation, when requested for higher-
risk roles, is a narrow "fit to safely perform the
selected service category" attestation. NO diagnosis
disclosure to Pet Wash. NO medical file upload by
default. The platform stores only boolean + expiry +
version + signed-at + category.

**H14.** Independent-contractor wording is mandatory.
No employment medical screening language. The phrases
listed in the FORBIDDEN_MEDICAL_WORDING set (see §15)
must never appear in marketing / onboarding / provider-
facing copy. The regression scan enforces.

**H15.** Israeli proportionality test. Data collected
must be proportionate to the legitimate purpose. Walker
→ minimal. PetTrek driver → more. Reactive-dog handler
→ more. No blanket asks.

---

## 3. Living Trust Ecosystem — module map

| # | Module | Owns | First PR id |
|---|---|---|---|
| 1 | Pet Passport | unified per-pet identity card + spec | TRUST-B (spec), TRUST-C (UI) |
| 2 | Provider Trust Card | unified per-provider identity card | TRUST-D |
| 3 | Live Booking Card | warm milestone timeline for active bookings | TRUST-E |
| 4 | Safety Widget | SOS, share live trip, nearest vet | TRUST-F |
| 5 | Badge taxonomy | verified attributes (Heat-Aware Walker, etc.) | TRUST-G |
| 6 | Pet Timeline | per-pet history view | TRUST-H |
| 7 | IL-aware notifications | heat / vaccination / birthday / rain / favourite available | TRUST-I |
| 8 | WhatsApp deep-link channel | `wa.me/?text=` helpers | TRUST-J |
| 9 | Home dock | "what's happening right now" living cards | TRUST-K |
| 10 | Social proof | neighbours-in-citySymbol verified-only aggregate | TRUST-L |
| 11 | **Provider Safety & Capability Declaration** | **mandatory fitness & capability ack at onboarding** | **TRUST-SCD-MODULE** + downstream PRs |
| 12 | This governance doc | binding rules + PR sequence | TRUST-A (this PR) |

Per H1–H15, no module reads from another module's
private storage. Every module reads from the canonical
identity (pet or provider) plus the booking row.

---

## 4. Pet identity (Pet Passport summary)

Full spec lives in TRUST-B (typed module) and TRUST-C
(UI component). This doc declares the canonical-identity
rule:

- One `pets` row per pet.
- All allergies, vet contact, chip number, vaccinations,
  preferred treats, temperament, walking preferences,
  emergency contact live on that row OR on rows that
  FK back to it.
- The Pet Passport view JOINs through that row plus
  per-platform history (walks, washes, sits, training,
  vet visits, weight history, photos).
- No duplicate persistence of pet attributes on a
  per-platform table without an explicit `pets` FK.

Israeli operational notes:
- Microchip number + עיריית רישוי (municipal dog licence)
  number are sensitive identifiers. T1 per PRIVACY.md §3.
- Primary vet contact is high-trust data; the customer
  typically has ONE primary vet.
- Storage rule for chip and licence numbers: yes, store
  the digits; never display in surfaces visible to other
  customers; redact in non-authenticated contexts.

---

## 5. Provider identity (Provider Trust Card summary)

Full spec lives in TRUST-D. This doc declares:

- One profile row per provider per platform
  (`walker_profiles`, `sitter_profiles`, `trainers`,
  `pettrek_providers`, `contractors`).
- Customer-facing fields surfaced: profile photo,
  verified badge, years of experience, repeat-customer %,
  pet types handled, response time, "last active",
  languages spoken, suburb (citySymbol), badges (see §8),
  Safety & Capability Declaration version + signed_at
  (see §14).
- Fields that REMAIN private: full address, apartment,
  phone, email, raw GPS history. PRIVACY.md §3–§6
  staging governs reveal.

---

## 6. Live Booking Card (summary)

Full spec lives in TRUST-E.

- One card per active booking on the customer's home.
- Driven by `BookingLifecycleService` state machine.
- Warm milestone strings replace dry state names. The
  card never invents state — it projects.
- Audit-log verb: `live-booking-card-status-changed`.

---

## 7. Safety Widget (summary)

Full spec lives in TRUST-F.

- Always-present inside an active booking.
- One-tap actions: SOS, share live trip via WhatsApp,
  call nearest emergency vet, report incident.
- "Share live trip" requires explicit customer tap and
  is governed by PRIVACY.md §6.4 (4-hour auto-stop,
  revocable).
- §14 of PRIVACY.md (emergency disclosure) governs the
  admin side of SOS.
- Audit-log verbs: `safety-widget-opened`,
  `live-trip-share-sent`.

---

## 8. Badge taxonomy (summary)

Full spec lives in TRUST-G. Curated list of verified
attributes admins can award:

- Heat-Aware Walker (heat-safety ack signed)
- Senior Pet Specialist
- Puppy Specialist
- Med-Experienced (medication administration ack signed)
- Large-Dog Comfortable
- Reactive-Dog Trained
- Calm With Strangers
- Multi-Pet OK
- Vet-Visit Trained
- Safety Declaration Signed v<x>

Badges are READ-ONLY data + helpers in a typed module.
No runtime award without admin action + audit log entry.

---

## 9. Pet Timeline (summary)

Full spec lives in TRUST-H. Consolidated per-pet history:

- Walks, washes, sits, training, vet visits.
- Weight history (when captured).
- Photos and notes (with `pets` FK).
- Reminders (vaccination renewals, grooming due,
  birthday).

The timeline is a READ-ONLY surface. Writes happen
elsewhere; the timeline projects.

---

## 10. IL-aware notifications (summary)

Full spec lives in TRUST-I.

- Heat-warning push (Open-Meteo or IMS — TBD per Q3 of
  §21).
- Vaccination renewal reminders.
- Pet birthday rewards.
- Favourite walker available now.
- Rain expected → reschedule walk prompt.
- Tel Aviv summer 11:00–16:00 default block on walks.

Notification types respect existing FCM + email + SMS
consent (PRIVACY.md §13). Adds no new comms channel.

---

## 11. WhatsApp deep-link channel (summary)

Full spec lives in TRUST-J.

- `shared/lib/whatsappChannel.ts` — `wa.me/?text=`
  helpers.
- No new dependency. No paid Twilio numbers.
- Used by Safety Widget (§7) for "share live trip" and
  by Live Booking Card (§6) for "I'm arriving" /
  "Running late".
- Twilio masked-number bridge is a SEPARATE finance-
  gated PR. Until that ships, customer/provider real
  numbers never auto-link.

---

## 12. Home dock (summary)

Full spec lives in TRUST-K.

- Pet-first home, not platform-first.
- Surfaces every active booking, every overdue
  vaccination, every wash-credit reminder as a living
  card.
- iPhone Safari 100dvh + safe-area mandatory (H9).
- RTL safe.

---

## 13. Social proof (summary)

Full spec lives in TRUST-L.

- Privacy-safe aggregate: "3 neighbours in citySymbol
  X used this walker".
- Minimum threshold: 3 distinct verified customers
  in the same citySymbol (proposed; final number is
  Q5 of §21).
- Never per-customer attribution. No names. No counts
  below threshold.

---

## 14. Provider Safety & Capability Declaration

**This is a foundational layer of the platform, not a
hidden checkbox.** Every provider sees it. Every
provider signs it. The signature is one of the gates
admin review checks before approving the provider.

### 14.1 Why this is foundational

Pet Wash operates in real-world environments involving
animals, public spaces, private homes, apartment
buildings, transport, heat exposure, physical handling,
live customer interaction, and emergency scenarios. The
platform therefore requires a proportionate provider
safety and capability declaration process designed to:

- improve operational safety
- reduce preventable incidents
- support responsible provider onboarding
- strengthen trust for customers and providers
- avoid false insurance assumptions (H7)
- avoid employment-law misclassification (H14)
- avoid invasive medical-data collection (H12)

### 14.2 Risk-tier model

**Level 1 — Standard Declaration (mandatory for all
providers).** Applies to walkers, sitters, trainers,
hosts, station support, and general marketplace
providers.

**Level 2 — Enhanced Safety Declaration (conditional).**
Triggered when the provider selects one of:

- PetTrek drivers
- overnight hosting
- key holding / home access
- medication administration
- reactive / aggressive dog handling
- large-dog handling
- special-needs pets
- elderly-pet mobility handling
- multi-pet transport

Level 2 adds additional service-category
acknowledgments, may set a training-confirmation flag,
may set a vehicle-compliance flag (PetTrek only), may
require an optional doctor fitness confirmation, and
routes the application to the admin enhanced-review
queue. `enhanced_verification_required` becomes `true`.

### 14.3 Level-1 mandatory acknowledgments (8 items, yes/no only)

1. capable of safely performing selected services
2. understands animal handling responsibilities
3. understands leash / control obligations
4. will operate responsibly and lawfully
5. will not provide services under impairment
6. will stop providing services if temporarily unsafe
7. will follow platform safety procedures
8. will comply with animal welfare obligations

Each acknowledgment is a yes/no checkbox. No diagnosis.
No medication. No condition. No reason text.

### 14.4 Level-2 trigger taxonomy

The nine-reason taxonomy in §14.2 is a superset of the
existing `ENHANCED_VERIFICATION_REASONS` constant in
`shared/legal/providerDeclaration.ts` (which currently
holds four reasons: `home_access`, `overnight_sitting`,
`key_holding`, `pet_transport`).

Five new reasons join in the TRUST-SCD-MODULE PR:

- `large_dog_handling`
- `medication_admin`
- `reactive_aggressive`
- `special_needs_pets`
- `elderly_pet_mobility`
- `multi_pet_transport`

Backwards-compatible. Existing signers continue to
satisfy Level 1 plus the original four reasons.

### 14.5 Doctor confirmation rule (H13)

Doctor confirmation NEVER asks for diagnosis disclosure
to Pet Wash. The narrow attestation is:

> "Fit to safely perform [service category]."

Stored fields only:

- `doctor_confirmation_required`            boolean
- `doctor_confirmation_received`            boolean
- `doctor_confirmation_expiry`              timestamp
- `doctor_confirmation_category`            varchar
  (e.g. `pet_transport_fit_to_drive`)

NEVER stored: diagnosis text, psychiatric reports,
medication lists, protected medical conditions, medical
file upload URL, condition codes.

If a doctor letter is required as paper evidence for a
specific high-risk role, the letter is reviewed by an
admin and only the yes/no flag is persisted. The letter
itself is not stored in PetWash systems by default.

### 14.6 PetTrek-specific extras (Level 2)

When `pet_transport` is selected:

- valid Israeli driver licence in the required class
- vehicle insurance per applicable law
- declaration of fitness to drive (no known impairment
  that would affect safe driving)
- will not operate while fatigued, impaired, or
  otherwise unfit to drive
- will produce, on reasonable request, a doctor
  confirmation of fitness to drive for this service
  category (see §14.5)

### 14.7 Independent-contractor wording rules (H14)

DO use:
- "fit to safely perform [service]"
- "no known impairment affecting service safety"
- "physically capable of [service]"
- "not under the influence"
- "responsible to stop if no longer fit"

NEVER use (regression-test-enforced — see §15):
- "medically healthy"
- "mentally healthy"
- "free from illness"
- "medically approved"
- "medical approval"
- "employee medical"
- "passed medical"
- "company medical clearance"
- Hebrew equivalents (see §15)

### 14.8 Acceptance evidence

Captured on signature:

- `version`              the declaration version
- `signed_at`            timestamp
- `ip_address`
- `user_agent`
- `device_info`
- `selected_roles`       array of service categories
- `enhanced_required`    boolean
- `doctor_confirmation_required` + `_received` +
  `_expiry` + `_category`
- `language_displayed`   `he` or `en`

No raw declaration body in the signature row. The body
is a versioned typed-module constant. Signatures
reference it by version.

### 14.9 Revoke + safety-hold + expiry flow

- Admin may revoke a declaration with a reason. Two-
  admin rule applies if the provider has live bookings
  (mirrors PRIVACY.md §14 emergency two-person rule).
- Safety-hold action: temporary suspension while review
  is in progress. Audit-logged.
- Expiry: a declaration may have an expiry (12 months
  proposed; final value is Q8 of §21). On expiry the
  provider is prompted to re-sign before further
  bookings.

---

## 15. Storage spec (shape only — no schema in this PR)

ALLOWED on the declaration row (per H12):

- `declaration_id`               primary key
- `user_id`
- `provider_application_id`      FK
- `version`
- `level`                        `'standard'` or `'enhanced'`
- `selected_roles`               text array
- `enhanced_required`            boolean
- `enhanced_reasons`             text array (drawn from
                                 §14.4 taxonomy)
- `heat_safety_accepted`         boolean (see §18)
- `impairment_commitment`        boolean
- `non_medical_acknowledged`     boolean
- `doctor_confirmation_required` boolean
- `doctor_confirmation_received` boolean
- `doctor_confirmation_expiry`   timestamp
- `doctor_confirmation_category` varchar
- `signed_at`                    timestamp
- `ip_address`                   varchar
- `user_agent`                   text
- `device_info`                  text
- `language_displayed`           `'he'` or `'en'`
- `revoked_at`                   timestamp
- `revoked_by`                   varchar
- `revoke_reason`                text

FORBIDDEN by design (H12):

- `diagnosis_text`            NEVER
- `medications`               NEVER
- `psychiatric_history`       NEVER
- `disability_details`        NEVER
- `medical_file_upload_url`   NEVER
- `condition_codes`           NEVER

FORBIDDEN_MEDICAL_WORDING (regression-enforced; H14):

- `medically healthy`
- `mentally healthy`
- `free from illness`
- `medically approved`
- `medical approval`
- `employee medical`
- `passed medical`
- `company medical clearance`
- `medical history check`
- Hebrew equivalents that are NEVER to appear in
  marketing or onboarding copy in this program

---

## 16. Audit verbs taxonomy

Extends the PRIVACY.md §7 set. New verbs:

| Verb | Actor | Target | Notes |
|---|---|---|---|
| `provider-safety-capability-declaration-signed` | provider uid | declaration_id | metadata: version, level, selected_roles, enhanced_required, language_displayed, ip, device. No raw body. |
| `provider-safety-capability-declaration-revoked` | admin uid | declaration_id | metadata: reason. Two-admin rule when live bookings exist. |
| `provider-doctor-confirmation-requested` | admin uid | declaration_id | metadata: reason_category. |
| `provider-doctor-confirmation-received` | admin uid OR system | declaration_id | metadata: expiry, category. No diagnosis. |
| `provider-safety-hold-applied` | admin uid | user_id | metadata: reason_short, expected_resolution. |
| `provider-safety-capability-declaration-expired` | system scheduler | declaration_id | metadata: expired_at, next_action. |
| `provider-trust-card-rendered` | system | provider uid | T0, one-shot per session. |
| `live-booking-card-status-changed` | system | booking_id | metadata: from_state, to_state, channel. |
| `safety-widget-opened` | customer uid | booking_id | metadata: reason. |
| `live-trip-share-sent` | customer uid | booking_id | per PRIVACY.md §6.4 (4-hour auto-stop). |

---

## 17. Bilingual canonical wording (Hebrew-first)

These six paragraphs are the source-of-truth Hebrew
text for the Safety & Capability Declaration. They
land in the TRUST-SCD-MODULE typed module verbatim.
English equivalents are supplied by Counsel before any
runtime enforcement PR ships; until then the
onboarding UI defaults to Hebrew with an interim
translation affordance.

**HE.1 — onboarding header**

> "כחלק מהצטרפותך לפלטפורמת פט וואש, הנך מאשר/ת כי
> הינך מסוגל/ת לבצע את השירותים שבחרת בצורה בטוחה,
> אחראית ובהתאם לדין החל."

**HE.2 — scope acknowledgment**

> "ידוע לי כי השירותים בפלטפורמה עשויים לכלול טיפול
> והליכה עם חיות מחמד, נסיעות, עבודה בתנאי מזג אוויר
> משתנים, כניסה לבתי לקוחות, טיפול בכלבים גדולים או
> אנרגטיים, והתמודדות עם מצבים בלתי צפויים."

**HE.3 — capability self-declaration**

> "אני מאשר/ת כי למיטב ידיעתי אינני מודע/ת למגבלה
> העלולה למנוע ממני לבצע את השירותים שבחרתי באופן
> בטוח עבור חיות המחמד, הלקוחות, הציבור או עבורי."

The "למיטב ידיעתי" ("to the best of my knowledge")
framing is intentional. It anchors the statement as a
good-faith capability self-attestation, not as a
medical claim.

**HE.4 — non-impairment commitment**

> "אני מתחייב/ת שלא להעניק שירות תחת השפעת אלכוהול,
> סמים, עייפות קיצונית או כל מצב אחר העלול לפגוע
> בשיקול הדעת, בערנות או בבטיחות."

**HE.5 — heat-safety acknowledgment**

> "אני מתחייב/ת לפעול באחריות בתנאי חום ומזג אוויר
> קיצוניים, לרבות הימנעות מהליכה על מדרכות חמות,
> הקפדה על מים זמינים וזיהוי סימני מצוקה אצל חיות
> מחמד."

**HE.6 — non-medical disclaimer + reporting duty**

> "ידוע לי כי פט וואש בע״מ אינה גוף רפואי ואינה
> מבצעת הערכה רפואית אישית לספקים, וכי האחריות לעדכן
> במקרה של שינוי מהותי ביכולתי להעניק את השירות
> חלה עליי."

---

## 18. Israel heat-safety layer

Mandatory for outdoor-service providers (walkers,
PetTrek drivers, sitters with outdoor time). The
acknowledgments below are operational, not marketing.

1. **Hot asphalt awareness** — choose grass / shade
   routes when paw-burn risk exists (ground above ~28 °C
   is unsafe for paws).
2. **Hydration** — carry water for walks ≥30 minutes,
   especially in air temperatures above 28 °C.
3. **Unsafe summer hours** — avoid extended outdoor
   activity during 11:00–16:00 in June–September unless
   the customer specifically requests it AND ground /
   weather conditions allow.
4. **Brachycephalic dog risks** — pugs, French
   bulldogs, Boston terriers and other short-nosed
   breeds have heightened heat sensitivity.
5. **Pet distress signs** — heavy panting, drooling,
   weakness, vomiting → stop activity.
6. **Vehicle heat dangers** (PetTrek) — never leave a
   pet in a vehicle unattended. Vehicle interior
   reaches 50 °C+ within minutes in Israeli summer.
7. **Water availability obligation** — water present
   and offered during outdoor service.

This layer feeds downstream:

- Heat-warning push notifications (TRUST-I, data source
  Q3 of §21).
- "Heat-Aware Walker" badge from the TRUST-G badge
  taxonomy.
- Admin review queue when a heat-incident is reported.

---

## 19. Connections to existing systems

| System | TRUST-* connection |
|---|---|
| `docs/location/PRIVACY.md` | T0/T1/T2 tiering governs every consumer-facing trust surface. §6 staging, §7 audit logging, §14 emergency disclosure all extend here. |
| Provider & Host Services Agreement (PR-LEGAL-A #246) | §4, §9, §10, §11, §15 are the legal anchors for the Safety & Capability Declaration. |
| `shared/legal/providerDeclaration.ts` | Existing `ENHANCED_VERIFICATION_REASONS` taxonomy is the seed for §14.4. Backwards-compatible. |
| Provider approval queue (`/api/admin/provider-review`) | New filter "Declaration: enhanced review required". New admin actions: safety-hold, doctor-confirmation request, mark expired. |
| CityPicker (PR #243) + service-area onboarding | Step ordering documented in §14 — KYC → service roles + cities → Agreement reading → SCD → tax/business/bank → insurance certificate upload → final admin review. |
| PetTrek onboarding | SCD Level 2 + PetTrek extras (§14.6) become a mandatory step before the driver appears in the dispatcher pool. |
| `AuditLedgerService` | Accepts the new verbs from §16. No new service. No new infra. |
| FCM + email + SMS + push consents | TRUST-I notifications use existing channels. No new channel added in this program. |
| Booking lifecycle service | TRUST-E projects state events; no state-machine change. |

---

## 20. PR sequence

Each row is a separate PR with single-purpose scope.

| # | PR id | Purpose | Schema? | Counsel? |
|---|---|---|---|---|
| 1 | TRUST-A | this governance doc + regression test | no | rules-doc only |
| 2 | TRUST-SCD-MODULE | typed Safety & Capability Declaration module (HE.1–HE.6 + Level-1 + 9-reason taxonomy + heat-safety + FORBIDDEN_MEDICAL_WORDING) | no | Counsel reviews HE wording before any UI rolls out |
| 3 | TRUST-B | Pet Passport types | no | no |
| 4 | TRUST-C | Pet Passport UI component | no | no |
| 5 | TRUST-D | Provider Trust Card UI component | no | no |
| 6 | TRUST-E | Live Booking Card UI | no | no |
| 7 | TRUST-F | Safety Widget UI + WhatsApp share | no | Counsel reviews live-trip-share copy |
| 8 | TRUST-G | Badge taxonomy module | no | no |
| 9 | TRUST-H | Pet Timeline page | no | no |
| 10 | TRUST-I | IL-aware notifications channel | no | Counsel reviews push copy |
| 11 | TRUST-J | WhatsApp deep-link helpers | no | no |
| 12 | TRUST-K | Home dock | no | no |
| 13 | TRUST-L | Social-proof component | no | no |
| 14 | TRUST-SCD-SCHEMA | additive `provider_safety_capability_declarations` table | YES — separate approval | yes |
| 15 | TRUST-SCD-API | server routes for accept / status / revoke / doctor-update | no | yes |
| 16 | TRUST-SCD-UI | onboarding step rendering the bilingual declaration | no | yes |
| 17 | TRUST-SCD-ADMIN | admin queue extension + doctor-confirmation workflow | no | yes |
| 18 | TRUST-SCD-COUNSEL-FLIP | one-line PR that flips the typed module's `SAFETY_CAPABILITY_COUNSEL_APPROVED` to `true` after Counsel sign-off | no | yes |

Order is suggested, not strict. Module-only PRs (1, 2,
3, 8, 11) can land before any UI/API/Schema PR.

---

## 21. Open CEO decisions

Each one blocks a specific downstream PR. The CEO
answers in chat; the answer is folded into this doc in
a follow-up PR before the relevant runtime PR opens.

| # | Question | Blocks PR |
|---|---|---|
| Q1 | Counsel-approved English translation of HE.1–HE.6 | TRUST-SCD-UI |
| Q2 | Doctor-confirmation upload medium — short attestation form vs short letter | TRUST-SCD-ADMIN |
| Q3 | Heat-warning data source — Open-Meteo, IMS, or both | TRUST-I |
| Q4 | Twilio masked-number bridge budget approval | (future, post-TRUST-J) |
| Q5 | Social-proof minimum threshold (proposed: 3 verified customers in same citySymbol) | TRUST-L |
| Q6 | WhatsApp Business API onboarding (Meta business verification + template approval) | (future, post-TRUST-J) |
| Q7 | Pet chip + רישוי municipal integration partner | (future, scoped under Pet Passport) |
| Q8 | Declaration expiry period (proposed: 12 months) | TRUST-SCD-SCHEMA |

---

## 22. Definition of "done" for this PR

This PR is done when:

1. `docs/trust/PROGRAM.md` is merged to main.
2. `server/tests/trustProgramDoc.regression.test.ts` is
   merged with it, pinning the section headings, hard
   rules H1–H15 verbatim, the six Hebrew canonical
   paragraphs HE.1–HE.6 verbatim, the seven heat-safety
   items, and the FORBIDDEN_MEDICAL_WORDING absence
   scan.
3. Every later TRUST-* PR cites this doc in its body.

No code other than the doc and its regression test
ships in this PR. No schema, no UI, no route, no API,
no env var. Future PRs implement the rules in this
document, one at a time, per PROGRAM.md §1.1.

---

## 23. Non-goals

- This doc does NOT itself enforce anything at runtime.
  Enforcement is the job of every runtime PR that
  follows.
- This doc does NOT replace Counsel review for any
  individual provision. It is a working baseline.
- This doc does NOT redefine the city dataset
  (PR-LOCATION-CITIES-1), the address model
  (PR-LOCATION-ADDRESS-MODEL-1), the city picker
  (PR-LOCATION-CITY-PICKER-1), the Provider & Host
  Services Agreement (PR-LEGAL-A #246), or the §8
  insurance-consistency lock (PR-LEGAL-B #247 / #248).
  Those documents stand; this one cites them.

---

## 24. Change log

| Date | PR | Change |
|---|---|---|
| 2026-05-13 | TRUST-A | First version. Living Trust Ecosystem program + Provider Safety & Capability Declaration foundation. |

Future entries are added by the PR that changes a rule.
This table is the canonical history of TRUST-* rule
changes.
