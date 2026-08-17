# Mad Paws — Public Flow Audit

**Reviewed on:** 2026-08-18
**Sources (public):**
- madpaws.com.au (public homepage + service pages)
- Mad Paws public help center on becoming a pet sitter
- Public App Store / Play Store listing

PUBLIC OBSERVATIONS ONLY. Every technical claim below is marked.

## OBSERVED — customer surfaces

- **Service picker first.** Homepage surfaces service categories (Pet Sitting, Dog Walking, Doggy Day Care, House Sitting, Pet Grooming) as the first-click choice.
- **Postcode + dates before results.** After picking a service, the customer enters a postcode and date range; results are filtered to that scope.
- **Sitter card** — photo, name, star rating, review count, rate/night, distance in km, "verified" indicator, "check availability" primary CTA.
- **Meet & Greet** — publicly documented as a required (or strongly recommended) step for overnight bookings.
- **Booking-linked chat** — one conversation per sitter relationship.

## OBSERVED — provider (sitter) onboarding

- **Guided step wizard.** Publicly documented as a multi-step application: profile, services, rates, availability, verification, photos.
- **Simple activation.** Public help-center language stresses "quick to get started" — application friction is a positioning claim.
- **Same account for multi-service.** Public copy shows sitters offering multiple services from one profile (e.g. sitting + walking).
- **Explicit accept/decline** on incoming bookings — publicly documented as the sitter's action after a customer request.

## PUBLICLY DOCUMENTED

- Meet & Greet flow.
- Sitter approval process is manual review.
- Sitters can set their own rates within Mad Paws-set ranges.
- Payments flow through Mad Paws (they hold funds, release to sitter post-service).

## INFERRED (label everything)

- **INFERRED**: their booking has a canonical state machine (Request → Accept → Confirm → Meet & Greet → Confirmed → In Progress → Completed → Reviewed). Standard marketplace shape; not confirmed from source.
- **INFERRED**: sitter dashboard shows "Requests" + "Upcoming" at the top level. Consistent with public screenshots.

## UNKNOWN

- Auth model, exact identity model (single-account with additive capabilities vs. separate owner/sitter identities — public copy is ambiguous), specific backend, payment processor, dispute resolution mechanism, refund logic. Do not assume.

## Product principles for PetWash

1. **Simple provider joining is a positioning weapon.** Every friction point in provider onboarding that isn't required for compliance or safety is a lost provider. PetWash's provider dashboard must:
   - Never re-ask information we already securely know from the customer account (name, verified email, verified mobile, DOB, profile photo where suitable).
   - Show a clear per-section progress bar.
   - Let a provider fill sections in any order except where business rules require otherwise.
2. **Guided ≠ blocking.** Wizards can be linear-looking without being linear — every "Save & Continue" persists server-side, so the provider can quit and resume from a different device.
3. **Simple accept/decline UI on incoming bookings.** Two large buttons. Not a menu of secondary actions.
4. **Rates within platform range.** PetWash may not want to set ranges yet, but the pattern (server-side validation of provider-configured rates) is worth reusing.

## Do NOT

- Copy Mad Paws copy or their exact section titles
- Reproduce their card layout / typography
- Claim comparative parity ("we do everything Mad Paws does") without CEO + `petwash-marketing-legal` sign-off
