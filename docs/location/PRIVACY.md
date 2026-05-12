# Location Privacy & Address-Data Constitution

> **Status:** governance document. Defines the binding privacy
> contract for every Pet Wash module that captures, stores,
> reads, displays, or transmits a customer or provider address.
>
> This document does NOT itself ship runtime code. It is the
> contract every downstream Location-touching PR must cite and
> obey. Treat it like a constitution — not a guideline.
>
> **Authority:** CEO sign-off required before any text in this
> document changes. Counsel sign-off required on §10 (Israeli
> Privacy Protection Law), §11 (GDPR), §13 (consent wording),
> and §14 (emergency disclosure). Changes are themselves PRs
> in the Location program (one purpose per PR, per
> `docs/location/PROGRAM.md` §1.1).

---

## 0. Why this document exists

Pet Wash is about to start persisting structured customer and
provider addresses across multiple modules (`PR-LOCATION-
PROFILES-1`, `PR-PROVIDER-SERVICE-AREAS-1`, `PR-BOOKINGS-CITY-
SEARCH-1`, `PR-LOCATION-ADDRESS-MATCHING-1`, and beyond). Each
module has its own product team, its own UX, and its own
deadline. Without a shared privacy contract written down,
those modules will each invent their own rule for who can see
what — exactly the spaghetti pattern the platform-skill
forensic audit (2026-05-10) flagged for auth.

This document is the single source of truth so every later
PR has only to **cite** the rule, not re-decide it.

**Hard pre-condition for downstream PRs:** any PR that persists,
displays, transmits, exports, or backfills a customer or
provider address **MUST** cite the §3.x rule that governs it.
If a rule does not yet exist for a new flow, this document is
extended first (its own PR) before the runtime PR opens.

---

## 1. Scope

### 1.1 In scope
- Customer profile addresses
- Provider base address + service-area declaration
- Booking-time address snapshots
- Lost-pet (PawFinder) location data
- PetTrek transport pickup / drop-off addresses
- K9000 wash-station location (already public — see §9.5)
- Coordinates captured at any of the above tiers
- Postcode field (currently unused; rules apply once
  `PR-LOCATION-POSTCODE-RUNTIME-1` lands)
- Audit-log entries that reference an address
- Google Sheet, Google Drive, GCS, and Firestore copies of
  any of the above
- Consent wording for address capture
- Export and deletion paths under Israeli Privacy Protection
  Law and GDPR

### 1.2 Out of scope (handled by other documents)
- Payment-instrument privacy (PCI scope — owned by the
  finance / Tranzila / Nayax / SUMIT / UPay docs)
- Pet medical history privacy (separate health-data doc)
- Biometric / KYC document privacy (owned by KYC docs)
- Marketing-consent privacy (owned by marketing-consent doc)
- Employee / contractor employment-record privacy (owned by
  HR docs)

If you are unsure which document applies, default to the
**stricter** one until Counsel clarifies.

---

## 2. Hard rules (every downstream PR MUST obey)

1. **No free-text city.** Every address row stores
   `citySymbol` (from `shared/data/israel-cities.ts`). Display
   strings are derived, not stored as the source of truth.
   See `docs/location/PROGRAM.md` §1.2.
2. **No silent persistence.** A PR that persists a street-
   level field MUST cite the §3.x rule in this document that
   authorises the storage.
3. **Minimum viable scope.** Capture only the fields needed
   for the immediate transaction. A booking flow that needs
   the city does not collect the street; a walk that needs
   the street does not collect the apartment until the walker
   is accepted.
4. **Manual confirm always wins.** The match engine SUGGESTS;
   no auto-assign reveals one party's address to the other
   without explicit human confirmation. See PROGRAM.md §1.10.
5. **No live coordinate sharing without an explicit user
   action.** A user MUST tap a button labelled in their
   language to start a live-location share. The share MUST
   stop automatically (see §6.4 for the time limit).
6. **No silent background geolocation.** The browser /
   mobile-app `navigator.geolocation` API MUST NOT be polled
   in the background, on app boot, on page load, or on
   passive route changes.
7. **No IP-based geolocation auto-fill.** IP → city is
   ALLOWED only as an opt-in suggestion that the user must
   accept before any field is filled. Even then, the
   selection MUST round-trip through the City Picker
   (`@/components/location/CityPicker`) so the canonical
   `citySymbol` is the persisted value.
8. **No live third-party geocoding by default.** The Google
   Places guard (`PR-LOCATION-GUARD-PLACES-1`) gates the
   proxy endpoints. Until §13.4 consent text is shown to a
   user, that user's input MUST NOT hit Google Places.
9. **No coordinates before acceptance.** A provider does
   NOT see a customer's exact coordinates until the provider
   has accepted a booking. See §6 for the rounding rules.
10. **No apartment / floor / entrance before acceptance.**
    These fields are dispatch-only and are revealed strictly
    after the customer accepts the matched provider AND the
    provider accepts the booking. See §6.3.
11. **Every read is logged.** Any non-customer access to a
    stored address is audit-logged. The customer themselves
    is exempt. See §7.
12. **Every export is logged.** Bulk export of address data
    to Google Sheets, Drive, GCS, BigQuery, or any other
    sink is a privileged operation. See §8.
13. **Right to deletion is honoured within 30 days.** See §11.
14. **Provider visibility is a function of state, not role.**
    A "provider" role is not enough to view a customer
    address. The provider must be currently accepted on a
    specific live booking with that customer. See §6.
15. **Children and family members are inferred, not
    declared.** See §12 for the safety edge cases.

---

## 3. Data inventory (what may be stored)

Field-level posture. Maps each field to the strictest tier
that applies. Stricter wins.

| Field                | Tier | Stored when                                  | Visible to                                                                   |
|----------------------|------|----------------------------------------------|------------------------------------------------------------------------------|
| `citySymbol`         | T0   | always (city is selected)                    | customer + any internal staff; not pseudonymised in logs                     |
| `serviceCitySymbols` | T0   | provider opts in                             | the public marketplace (provider chose to publish this)                      |
| `streetAddress`      | T1   | customer chooses to give it                  | customer + matched providers AFTER acceptance + admin with audit reason      |
| `buildingNumber`     | T1   | customer chooses to give it                  | same as T1                                                                   |
| `apartment`          | T2   | customer chooses to give it                  | customer + matched provider AFTER both-sides acceptance + admin with reason  |
| `postcode`           | T1   | postcode runtime ships (deferred)            | same as T1; "NOT TRUSTED" flag remains until then                            |
| `lat` / `lng`        | T1   | verified by a customer action (pin, share)   | customer + matched provider AFTER acceptance, rounded per §6                 |
| `formattedAddress`   | T1   | derived from the above                       | display-only; never parsed back; same visibility as its underlying fields    |
| `preferredAreas`     | T0   | provider opts in                             | public (provider published)                                                  |
| `blockedAreas`       | T0   | provider opts in                             | match engine only; not displayed to customers                                |
| `matchScore`         | T0   | match engine logs                            | admin only (audit + tuning); never to provider or customer                   |
| `selectedProviderId` | T0   | customer manually picks                      | the two parties; admin                                                       |

**Tier definitions:**
- **T0** — non-sensitive at the row level. City-only addresses
  do not identify a household. Safe to log raw.
- **T1** — sensitive. Identifies a household when combined
  with name + phone. MUST be pseudonymised in any non-PII log
  surface.
- **T2** — strictly dispatch-only. NEVER appears in marketing
  data, BI extracts, analytics events, or partner shares.

If a future field doesn't fit any of T0/T1/T2, the field MUST
be classified in this table **before** persistence ships.

---

## 4. Access matrix (who can see what)

A row may be read **only** when ALL conditions on its
intersection hold. Rules of last resort:
- If no row applies → access denied.
- If two rows apply → the stricter one wins.

| Reader              | T0 (city)                   | T1 (street/building/lat-lng)                                                                                | T2 (apartment)                                                                |
|---------------------|------------------------------|--------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Customer (self)     | always                       | always                                                                                                       | always                                                                         |
| Provider            | always                       | only after the customer has matched + the provider has accepted the specific live booking; rounded per §6   | only after BOTH parties have accepted; full precision                          |
| Admin (regular)     | always                       | with a justified audit-logged reason recorded against the support ticket                                    | with a justified audit-logged reason recorded against the support ticket       |
| Super-admin         | always                       | same as admin; super-admin bypass is NOT a free pass                                                        | same as admin                                                                  |
| Coworker AI         | T0 only (per PROGRAM.md)      | never (must summarise via aggregate / city-level)                                                            | never                                                                          |
| Marketing pipeline  | T0 only                      | never                                                                                                        | never                                                                          |
| Analytics / BI      | aggregate only                | never                                                                                                        | never                                                                          |
| Partner / franchisee| T0 within their region only   | never (their own region's customers are still PetWash customers)                                            | never                                                                          |
| Police / emergency  | per §14                      | per §14                                                                                                      | per §14                                                                        |
| Anyone else         | never                        | never                                                                                                        | never                                                                          |

**Audit trail required** for every access at T1 or T2 that is
not "Customer (self)". See §7.

---

## 5. Retention

| Tier | Active retention                            | After deletion request                              |
|------|----------------------------------------------|------------------------------------------------------|
| T0   | Indefinite (city is not PII at the row)      | retained for booking-history aggregates              |
| T1   | While the user is active + 24 months         | redacted within 30 days; aggregate row kept           |
| T2   | While the booking is open + 90 days post-completion | redacted within 30 days of request OR 90 days post-completion, whichever comes first |
| Coordinates captured for a single booking | same as T1 for that booking |                                                     |
| Booking snapshot (`customerAddressSnapshot`) | retained 7 years per Israeli tax law as a redacted snapshot (see §10) | NEVER fully deleted; redacted in place (apartment + lat/lng nulled)            |

**Snapshot rule:** Israeli tax law (Income Tax Ordinance,
section 25) requires a 7-year invoice trail. The address that
appears on an invoice is part of that record. The PR that
adds the booking snapshot (`PR-BOOKINGS-CITY-SEARCH-1`) MUST
store the snapshot in a separate immutable table; deletion
requests redact (T2 nulled, T1 hashed) but DO NOT remove the
row.

---

## 6. Provider visibility — the rule everyone asks about

Stage-by-stage visibility for every booking flow.

### 6.1 Before customer picks a provider (search / discovery)
- The customer sees: provider's `baseCitySymbol`, public
  `preferredAreas`, public stats (rating, distance bucket).
- The provider sees: NOTHING. Specifically: not the
  customer's identity, not the customer's address, not the
  customer's city, not the customer's coordinates.
- The match engine ranks providers using customer fields
  internally but NEVER exposes the inputs to any provider.

### 6.2 After customer requests, before provider accepts
- The customer sees: provider's identity, public photo,
  rating, public address summary.
- The provider sees: customer's `citySymbol` only. Plus
  whatever the customer has explicitly written in the
  booking note. Plus the booking metadata (date, pet type,
  duration). NEVER street, building, apartment, or
  coordinates.
- This window is the provider's decision window. They have
  enough to say yes / no without seeing the household.

### 6.3 After provider accepts
- The customer sees: provider's identity + contact info.
- The provider sees: `streetAddress`, `buildingNumber`,
  rounded coordinates (3 decimal places ~ 100 m square per
  §6.5). The full coordinates and the apartment number
  remain hidden.
- An audit-log entry MUST be written: actor (provider),
  action ("address-revealed-on-accept"), target (bookingId),
  before/after (level 0 → level 1).

### 6.4 After the service window starts (customer confirms
   the provider has arrived OR the timer enters the "live"
   state)
- The provider sees: `apartment`, full unrounded
  coordinates, any access notes the customer added.
- The customer MAY choose to share a live coordinate stream
  with the provider for the duration of the live state. The
  stream MUST:
   - require an explicit "Share live location" button tap by
     the customer
   - display a clear in-app indicator that sharing is active
   - auto-stop at booking completion or 4 hours, whichever
     comes first
   - be revocable by the customer at any time with one tap

### 6.5 Coordinate rounding policy
- **3 decimal places** (~ 111 m at the equator, slightly
  less in Israel) is the "T1-acceptance" precision shown to
  a provider on accept.
- **Full precision** is reserved for the live state per §6.4.
- **0 decimal places** (city-centre approximation) is the
  precision used in any non-PII surface (analytics events,
  Coworker AI summaries).
- Rounding is applied at read time, not at write time —
  storage retains full precision so a future legal request
  can produce the exact record.

### 6.6 Walkers — do they see apartment numbers?
- **Not before pickup confirmation.** A walker is in the
  same provider role as a sitter; §6.3 applies. The
  apartment becomes visible at §6.4 (pickup confirmation).
- Pickup confirmation requires the customer to tap "I am
  ready to hand over" (or equivalent) in the app, OR for the
  walker to scan the customer's per-booking QR code. EITHER
  action gates apartment visibility.

### 6.7 PetTrek drivers — pickup and drop-off addresses
- Two T1 addresses per ride. Both are revealed on accept
  (same as §6.3). Apartment numbers at both addresses are
  T2 and revealed at pickup confirmation (same as §6.6).
- A driver's live coordinate stream during transit is
  governed by §6.4.
- The customer sees the driver's live position during the
  ride; the driver does NOT see the customer's live
  position. Symmetry is intentionally broken in the
  customer's favour for safety.

### 6.8 PawFinder — lost-pet privacy
- A lost-pet report is a customer choosing to make a SHORT
  RADIUS of their home public for the duration of the
  search. The radius MUST be:
   - rounded to city-level by default
   - widened only by explicit customer action
   - retracted automatically when the pet is reported found
- A finder (a member of the public) sees the rounded
  radius and the pet photo. They do NOT see the customer's
  street, building, apartment, or coordinates until the
  customer initiates contact.

### 6.9 K9000 stations — public locations
- K9000 station coordinates are PUBLIC by design (kiosks
  are physical infrastructure shown on the public map).
- Per-customer reservation timestamps at a K9000 station
  are T1 (a household routine is identifiable).
- K9000 station logs MUST NOT be joined with marketing or
  partner data sets at the per-customer level.

### 6.10 Academy / training sessions
- If the session is at the customer's home → same rules as
  Sitter Suite.
- If at the trainer's studio → only `baseCitySymbol` of the
  studio is needed; the trainer's full address is THEIR
  privacy choice, not the customer's.
- If at a park → the park is named (public landmark); no
  household address is captured.

---

## 7. Audit logging

Every read or mutation of a T1 or T2 field MUST emit an
audit-log entry through the existing `AuditLedgerService`.
The entry MUST include:

- `actor`            — user uid + role at the time
- `action`           — one of: `read-address`,
                       `address-revealed-on-accept`,
                       `address-redacted-on-deletion`,
                       `address-exported`,
                       `address-emergency-disclosure`,
                       `address-precision-elevated`,
                       `live-location-share-started`,
                       `live-location-share-stopped`
- `target`           — bookingId or userId being read
- `before` / `after` — visibility level (0, 1, 2) for
                       reveal/elevation events; field names
                       for redaction
- `reason`           — required for admin-driven reads;
                       free-form text linked to a support
                       ticket or compliance request
- `traceId`          — request-scoped correlation id

The audit log entry MUST NOT itself contain the raw T1/T2
fields. Logs reference the booking; the booking row is the
canonical source.

---

## 8. Export & sync to Google (Sheets, Drive, GCS)

The platform already integrates with Google Sheets (26
service files), Google Drive (8), and GCS (22) — see the
existing data-pipeline audit. The following rules apply to
ANY pipeline that writes a customer or provider address into
any of those sinks.

### 8.1 Sheets
- Receipts and invoices written to Google Sheets MUST use
  the booking snapshot (per §5), NOT the live customer
  profile. This means an admin who later edits the customer
  profile does not retroactively change the Sheet row.
- Sheets exports of address data are T1-stripped by default.
  An admin who needs a T1 export MUST add a justified
  comment in the Sheet header row; an audit-log entry is
  written.
- Sheets MUST NOT be used to display T2 fields. Ever.

### 8.2 Drive
- Tax-document archival to Drive may include the booking
  snapshot's T1 fields (an invoice legally references an
  address). T2 fields MUST be redacted before write.
- Drive folder ACLs MUST be reviewed quarterly. The PR
  that adds the audit step is `PR-LOCATION-PRIVACY-DRIVE-
  AUDIT-1` (planned).

### 8.3 GCS
- Customer-document buckets (`petwash-secure-documents`)
  obey the Firebase Cloud Storage rules (already in place).
  No change.
- Code backup, Firestore export, and log retention buckets
  MUST NOT receive T1 or T2 fields outside the booking-
  snapshot path. Logs are pseudonymised before write.

### 8.4 Google Places
- The proxy endpoints (`/api/google/places-autocomplete`,
  `/api/google/places-details`) are guarded by
  `PR-LOCATION-GUARD-PLACES-1`.
- Live calls MAY proceed ONLY in environments where the
  user has been shown the consent text in §13.4 within the
  last 12 months.
- Server-side `traceId` and the user's input string MUST
  NOT be persisted longer than 7 days at the proxy layer.

### 8.5 Hard "no" list
- No customer address is to be sent to a third-party
  marketing platform (HubSpot custom property,
  Mailchimp tag, etc.) at T1 or T2.
- No customer address is to be embedded in a notification
  payload (FCM, email, SMS) at T2. T1 is acceptable only
  inside the confirmation email to that specific customer.

---

## 9. Manual vs automatic matching

| Action                                              | Allowed? |
|------------------------------------------------------|----------|
| Match engine ranks providers internally              | YES      |
| Match engine SUGGESTS top-N candidates in the UI     | YES (per PROGRAM.md §3.8 / §3.9) |
| Customer manually selects a candidate                 | REQUIRED — the only way to advance |
| Provider manually accepts a request                   | REQUIRED — the only way to reveal §6.3 fields |
| Auto-assign (no human click)                          | NEVER |
| Auto-share live location                              | NEVER |
| Auto-elevate precision (3dp → full)                   | NEVER without the §6.4 trigger |
| Auto-reveal apartment                                 | NEVER without the §6.4 trigger |

Any UI that LOOKS like an auto-action MUST in fact require
a button tap. A "suggested provider — accept?" prompt is
acceptable; a "starting handover in 3, 2, 1..." countdown
that proceeds without confirmation is not.

---

## 10. Israeli Privacy Protection Law (Law 5741-1981) posture

### 10.1 Registration
PetWash is a registered database controller under the
Israeli Privacy Protection Authority. The database number,
the official controller name, the legal address, and the
DPO contact MUST be kept up-to-date in `firebase-email-
templates` and on `/privacy-policy`.

### 10.2 Notice
Before any T1 or T2 field is collected, the user MUST be
shown the consent text in §13.

### 10.3 Purpose limitation
Address fields collected for a booking MUST NOT be reused
for an unrelated purpose (marketing campaign, partner data
share, etc.) without a fresh consent. The user has the right
to refuse the new purpose without losing the booking
functionality they originally consented to.

### 10.4 Access right
A registered data subject MAY request to view all address
data PetWash holds about them. Response MUST be delivered
within 30 days. The request flow lives in `/api/data-rights`
(existing route; see §11 for the GDPR-compatible form).

### 10.5 Correction right
A data subject MAY request a correction. PetWash MUST either
correct or explain in writing why not, within 30 days. The
audit log MUST capture the correction event.

### 10.6 Cross-border transfer
Google Cloud / Firebase data residency for PetWash is the
EU region (see existing `google-cloud-dpa-registry.ts`).
Address data does NOT leave the EU. If a future PR changes
this, it MUST update §10.6 of this document first.

### 10.7 Israeli children-protection rules
A booking customer under 14 cannot consent to T1/T2 capture
on their own. The booking MUST be tied to a parent / guardian
account that has been age-verified at signup. See §12.

---

## 11. GDPR-compatible export / delete posture

PetWash treats every customer as GDPR-protected by default,
regardless of residency, because the surface area cost of
classifying is higher than the cost of a uniform posture.

### 11.1 Article 6 lawful basis
- Booking address fields: Art. 6(1)(b) — necessary for
  performance of the booking contract.
- Marketing-derived address use: Art. 6(1)(a) — explicit
  opt-in.
- Compliance retention beyond the active window: Art. 6(1)(c)
  — legal obligation (Israeli tax law, §5).

### 11.2 Article 15 — right of access
The data subject can request a copy of every field PetWash
holds about them, including all address tiers, all live-
location share events, all audit-log entries that name them
as the target, and all booking snapshots. Response in 30 days.

### 11.3 Article 17 — right to erasure
The data subject can request deletion. PetWash MUST:
- Redact T1 and T2 in the live customer profile within 30
  days.
- Replace T1 in booking snapshots with a hash; replace T2
  with null. Snapshot rows are NOT deleted (Israeli tax law,
  §5).
- Remove the user from search indexes within 7 days.
- Notify any downstream sink (Google Sheets export rows,
  Drive folders, GCS objects) within 30 days; deletion in
  Sheets happens via `googleSheetsIntegration.ts` redaction
  patch.

### 11.4 Article 20 — portability
A machine-readable export of every address field is
delivered as JSON within 30 days. The format is documented
in `docs/finance/00-platform-role-model.md` Part X (TODO —
referenced for future PR).

### 11.5 Article 22 — automated decision making
The match engine SUGGESTS only. There is no Article-22
automated decision making with significant effect on the
data subject. If the platform ever wants to auto-assign,
that change requires:
- This document amended (§9 + §11.5)
- A documented human-review escape hatch
- Counsel sign-off

---

## 12. Children, family, and safety edge cases

### 12.1 Minor customer
A customer profile MUST carry an `ageVerifiedAt` timestamp
before any T1 / T2 field is captured. Pets owned by minors
are tied to the parent / guardian profile.

### 12.2 Shared household
If a household has more than one PetWash account at the same
address, the addresses are stored per-account. Cross-account
reads happen only when both accounts explicitly link.

### 12.3 Domestic violence / restricted-visibility flag
A customer MAY set a `restrictedVisibility=true` flag on
their profile. With the flag on:
- T1 reveal at §6.3 is deferred to §6.4 (provider gets only
  city until pickup confirmation).
- Coordinates are always city-centre approximation to
  marketing and analytics.
- Coworker AI is blocked from naming the household even at
  T0.
- An admin who needs T1 access MUST escalate to a named DPO
  and the audit log records `restricted-visibility-override`.

### 12.4 Minor pet handler
If the household sends a minor to receive a provider (e.g. a
teenager hands the dog to a walker), the provider's identity
verification result is shown to the parent on the parent's
device, NOT to the minor. The minor never sees the
provider's KYC status.

---

## 13. Consent wording (UI copy)

### 13.1 General consent at signup
- Hebrew: "אני מסכים/ה שעתון הכתובת שאמסור ישמש לשליחת
  שירות מבקש כלב, וייחשף לספק שאני בוחר/ת, רק לאחר אישור
  ידני שלי ושל הספק/ית. הכתובת המלאה תיחשף רק בעת המסירה
  בפועל."
- English: "I agree that the address I provide will be used
  to dispatch the pet-care service I book. The full address
  will be revealed only to the provider I have manually
  chosen, only after I and the provider both confirm. The
  apartment number is revealed only at handover."

### 13.2 City picker
The city picker (`PR-LOCATION-CITY-PICKER-1`) MUST display
no consent text inside the sheet — picking a city is the
opening of a consent dialogue, not consent itself. Consent
language belongs on the form the picker is embedded in.

### 13.3 Booking-time street capture
At the point where the customer types a street address, the
form MUST display a one-line notice in Hebrew + English: the
address will be sent to the matched provider only on
acceptance. The notice MUST be visible without scrolling.

### 13.4 Google Places consent
Before any keystroke triggers a Google Places call, the user
MUST have accepted a one-time notice explaining that the
auto-complete query is sent to Google. The notice MUST be
recorded in `audit_events` with action `places-consent-given`
and a 12-month TTL. After expiry the notice is re-shown.

### 13.5 Live-location share consent
The "Share live location" button MUST be clearly labelled.
The first time the user taps it, a one-time confirmation
modal MUST explain the 4-hour auto-stop and the revoke path
(§6.4).

---

## 14. Emergency disclosure

Israeli police and emergency services may request address
data without prior customer consent under §29A of the
Israeli Privacy Protection Law (criminal investigation) or
under emergency-services legislation (saving life).

### 14.1 Process
1. Request received in writing (warrant, court order, or
   emergency-services case number) at `privacy@petwash.co.il`.
2. Verified by a named officer of the platform — DPO or
   acting DPO. Two-person rule applies.
3. Response delivered to the requesting authority only,
   never to a third party.
4. Audit-log entry written with action
   `address-emergency-disclosure`, target uid, reason
   (case number or warrant number), actor (DPO).
5. The data subject is notified post-hoc unless the request
   explicitly forbids notification.

### 14.2 What is NOT a §14 case
- A provider asking for a customer's address out-of-band:
  refuse.
- An admin "just checking": §7 audit rules apply; not §14.
- A partner / franchisee curious about coverage: aggregate
  data only; never per-customer.

---

## 15. Manual vs automatic — UI-level rules

A summary table for the implementation PRs:

| UI element                                    | Auto-action allowed? |
|-----------------------------------------------|-----------------------|
| City picker opens                             | YES (the user tapped) |
| Search filters cities                         | YES                   |
| Top-N suggested providers list                | YES                   |
| Provider request submitted                    | NO — explicit tap     |
| Provider accept                               | NO — explicit tap     |
| Reveal street to provider                     | NO — function of accept |
| Reveal apartment                              | NO — function of handover |
| Start live-location share                     | NO — explicit tap     |
| Stop live-location share at 4h                | YES (auto-timer + notice) |
| Refresh provider rating cache                 | YES                   |
| Cache cleanup                                 | YES                   |

---

## 16. Open CEO decisions blocking downstream PRs

| Question                                                       | Blocks PR                              | Default until decided           |
|-----------------------------------------------------------------|----------------------------------------|---------------------------------|
| Approved postcode source (Israel Post / Google / GovMap)        | PR-LOCATION-POSTCODE-RUNTIME-1         | NOT TRUSTED, no runtime read    |
| Approved district / region source                               | PR-LOCATION-ADDRESS-MODEL-1 extension  | null                            |
| T1 active retention (24 months proposed)                        | runtime confirmation                   | 24 months                       |
| T2 post-completion retention (90 days proposed)                 | runtime confirmation                   | 90 days                         |
| Live-location share auto-stop (4 hours proposed)                | runtime confirmation                   | 4 hours                         |
| Coordinate rounding precision on accept (3 dp proposed)         | runtime confirmation                   | 3 dp ~100 m                     |
| Auto-assign ever?                                               | PR-BOOKINGS-NEARBY-MATCHING-1          | NEVER                           |
| Google Sheet sync direction (read-only / round-trip)            | PR-LOCATION-ADMIN-1                    | read-only                       |
| Restricted-visibility flag UX surface                           | PR-LOCATION-PROFILES-1                 | hidden toggle in safety settings |
| DPO public name + contact                                       | runtime publishing                     | privacy@petwash.co.il           |
| GDPR portability JSON format                                    | PR-DATA-RIGHTS-PORTABILITY-1           | unspecified                     |
| Children verification flow                                      | PR-LOCATION-PROFILES-1                 | tied to parent KYC              |

The CEO answers in chat; the answer is folded into this
document in a follow-up PR before the relevant runtime PR
opens.

---

## 17. How downstream PRs cite this document

Every Location-touching PR opening AFTER this document is
merged MUST:

1. Open with a line in the PR body:
   `Constitutional reference: docs/location/PRIVACY.md §X.Y`
2. Pick the §X.Y rule(s) that authorise the change.
3. If no rule exists yet, extend this document FIRST in a
   separate PR, then open the runtime PR.
4. Add a regression test that pins the new behaviour against
   the §X.Y rule (so a future PR cannot silently violate it).

The test pattern is established by:
- `server/tests/israelCitiesDataset.regression.test.ts`
- `server/tests/addressModel.regression.test.ts`
- `server/tests/googlePlacesGuard.regression.test.ts`
- `server/tests/cityPicker.regression.test.ts`

Each adds a `FORBIDDEN_PATTERNS` / boundary scan. The privacy
tests work the same way: every protected behaviour gets a
regex or import-graph assertion that fails LOUDLY if a future
PR drifts.

---

## 18. Change log

| Date       | PR                         | Change                                |
|------------|----------------------------|----------------------------------------|
| 2026-05-12 | PR-LOCATION-PRIVACY-1      | First version. Constitutional baseline. |

Future entries are added by the PR that changes a rule.
This table is the canonical history of address-data rule
changes.

---

## 19. Non-goals of this document

- This document does NOT define the data model. That lives
  in `shared/data/address-model.ts` (PR-LOCATION-ADDRESS-
  MODEL-1).
- This document does NOT define the city dataset. That lives
  in `shared/data/israel-cities.ts` (PR-LOCATION-CITIES-1).
- This document does NOT define the UI primitives. The
  picker lives in `@/components/location/CityPicker`
  (PR-LOCATION-CITY-PICKER-1).
- This document does NOT itself enforce anything at runtime.
  Enforcement is the job of every runtime PR that follows.
- This document does NOT replace Counsel review for any
  individual provision. It is a working baseline, not a
  legal opinion.

---

## 20. Definition of "done" for this PR

The PR is done when:

1. `docs/location/PRIVACY.md` is merged to main.
2. `server/tests/locationPrivacy.regression.test.ts` is
   merged with it, pinning the section headings and the
   "no runtime code in this PR" invariant.
3. Every downstream PR template (informal — applied by the
   agent at PR-open time) includes a "Constitutional
   reference" line.

No code other than the doc and its regression test ships in
this PR. No schema, no migration, no UI, no route, no env
var. Future PRs that implement the rules in this document
ship one at a time, per PROGRAM.md §1.1.
