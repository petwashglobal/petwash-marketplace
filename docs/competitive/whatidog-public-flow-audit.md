# WhatIDog — Public Flow Audit

**Reviewed on:** 2026-08-18
**Sources:**
- CEO screenshot 2026-08-18 showing App Store listing (WhatIDog, id6761102098, "Discover" section, 4+ Years / Travel / EN / 30 MB / Get button)
- CEO screenshot showing two Hebrew screens: (1) "רואים תמיד איפה הכלב שלך" — customer map view with a walker's photo pinned on the route, tap-to-open drawer at "תחילת טיול 15:04", "מעקב אחר טיולים" header; (2) "מגדירים שעה ויום וזהו" — provider/booking summary showing provider "יובל · 3 שנות ניסיון · ★5.0 (4)", phone "052-3000911", booking summary date 8 Nov 2025, time 15:00, location "ויטל 28 תל אביב", service "טיול", pet "בראנו · צ'ארלי", total "600 ₪", CTA row "מעקב טיול / ביטול הזמנה"
- Public claim from CEO conversation: "was never in Israel until I launched K9000 stations" — competitive framing, not a factual technical claim about their backend
- App Store public listing (id6761102098)
- Public website: whatsadog.com (URL observed on CEO's browser tab)

Every technical claim below is marked. Nothing about their private backend is stated as fact.

## OBSERVED — customer surfaces

- **Live walk map** (screenshot 1). Customer sees a mapped route with the provider's photo pinned at the current location. Header text "מעקב אחר טיולים" ("track walks"). A bottom sheet reads "תחילת טיול 15:04" ("walk started 15:04"). Overall message: "רואים תמיד איפה הכלב שלך" ("always see where your dog is").
- **Booking summary card** (screenshot 2). Header text "מגדירים שעה ויום וזהו" ("set time and day and that's it"). A provider info block shows profile photo, name, "3 שנות ניסיון" ("3 years experience"), star rating "★5.0 (4)", and a phone-number affordance. A "סיכום" ("summary") block lists date/time/location/service/pet/total (₪600). A CTA row shows "מעקב טיול" (primary — "track walk") and "ביטול הזמנה" (secondary — "cancel booking").
- **Progressive disclosure:** the app is public in the Israeli App Store as of 2026-08-18. Metadata visible on the listing: "4+ Years", "Travel", "EN", "30 MB".

## PUBLICLY DOCUMENTED

- App Store listing subtitle and screenshots on whatsadog.com are the publicly documented product framing. Read from public sources only.

## INFERRED (label everything)

- **INFERRED**: they likely have a canonical booking record with (provider, pet, date, time, address, total, status) — matches the shape of the summary card. Cannot see the schema.
- **INFERRED**: primary CTA on the booking-summary screen after acceptance is "track walk" (מעקב טיול). We infer this transitions to a live-map screen once the provider starts the walk. Not confirmed from source.
- **INFERRED**: their provider likely presses a start-walk action that toggles a location-sharing session. Timing "תחילת טיול 15:04" implies a discrete start event.
- **INFERRED**: they gate live-map access to booking participants only (nothing on the public listing suggests otherwise); we treat this as good-practice inference for PetWash's OWN design — do not report it as their behavior.
- **INFERRED**: the "phone" affordance next to the provider block appears direct-dial (052-… format shown). PetWash should NOT copy exposing a raw personal number; the correct pattern per master architecture is masked/relay contact if we do it.

## UNKNOWN

- Their private backend, actual auth model, how they secure the live map, retention policy of location samples, how they handle disconnected providers, whether their live map back-fills route history on reconnect, and their money/payment flow. Do not assume.

## Product lessons for PetWash (per CEO benchmark rule)

Take principles, not screens:

1. **Customer booking summary is dense but scannable.** One card answers: who, when, where, which pet, how much, primary next action. PetWash `client/src/pages/booking/CustomerBookingDetail` should mirror this information density (without copying their layout).
2. **Primary action changes with state.** ACCEPTED → "track walk"; the cancel action is visibly secondary. PetWash's booking-detail component should surface ONE primary CTA that reflects the current booking state (see master architecture §"Provider Booking Card").
3. **Live map is the emotional peak.** The message "רואים תמיד איפה הכלב שלך" ("always see where your dog is") is the promise the whole product is anchored on. PetWash's live-map delivery must be lossy-safe (see master architecture §"Connection loss" / §"GPS security" — server-derived subscription, no client-chosen providerId).
4. **Provider trust chip** — years of experience + star rating with review count are the two things next to the provider photo. PetWash provider cards already display these; make sure they're never invented client-side (server-authoritative rating).

## PetWash's competitive advantage over WhatIDog (observable, non-defamatory)

Purely descriptive of features PetWash has today that were not visible on their listing/website:

- K9000 self-serve wash stations (physical infrastructure)
- Prestige loyalty & tier progression
- eGift purchase + partial redemption
- SUMIT-integrated Israeli-compliant fiscal documents
- Multi-service provider capabilities (walker + sitter + boarding + training on one account)
- Verified identity + KYC document pipeline
- Provider commission model with escrow + audit trail

These are PetWash's own product statements — no comparative marketing claim about WhatIDog. If we use any of these in customer copy, it must go through the `petwash-marketing-legal` skill.

## Do NOT

- Copy their tagline ("רואים תמיד איפה הכלב שלך") or any Hebrew wording
- Copy the exact position/composition of their summary card
- Copy their star + review-count chip pixel style
- Publish any statement about their private backend
- Claim they "stole" from PetWash publicly — that's a defamation risk; keep competitive framing internal
