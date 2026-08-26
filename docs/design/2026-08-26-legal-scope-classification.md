# Legal document scope classification — the 17 LEGACY-ONLY set

Correction pass #2 §11-12: do NOT convert every passive legal page
into "one user clicked once forever". Classify first. This doc pins
the scope for each of the 17 documents that currently have no
canonical writer, so the follow-up work builds the right shape of
acceptance (or explicitly does not) rather than defaulting to
account-scope for all of them.

The registry already declares a `scope` field per document
(`shared/lib/legalDocumentRegistry.ts` — LegalDocumentScope). This
doc is the audit; the registry values encode the answer.

## Scope vocabulary

| Scope | Row-per-what | Example |
|---|---|---|
| `account`     | one row per user, ever | Terms of Service |
| `provider`    | one row per provider application | Independent-provider declaration |
| `service`     | one row per (provider, service_type) | Dog-walking safety (walker only) |
| `booking`     | one row per booking | Emergency vet authorisation |
| `pet`         | one row per pet | Owner-declared aggressive-dog flag |
| `transaction` | one row per payment | Recurring debit authorisation |

## The 17 remaining documents

### Customer-side (7)

| Key | Proposed scope | Evidence style | Notes |
|---|---|---|---|
| `cancellation_refund_14g` | **account** — informational | Show on Shop + booking checkout as CheckoutLegalNotice (already exists client-side); server records ACCEPTANCE only if the surface presents a checkbox. Otherwise INFORMATIONAL only. | Consumer Protection Law §14ג applies at the transaction moment; the acceptance itself is a one-time acknowledgement of the policy. |
| `wallet_egift_terms` | **account** | Accept-checkbox on first wallet top-up + first eGift redeem. Idempotent per-account thereafter. | `requiredFor: wallet_topup` in the registry. |
| `booking_rules` | **booking** | New row per booking submit. `scopeId = bookingId`. | The rules can (and will) change over time — evidence must be per-booking. Registry: `scope: 'booking'`. |
| `pet_owner_responsibility` | **pet** | Accepted per pet at Pet Passport add. `scopeId = petId`. | The responsibility relates to the specific pet; ownership can transfer. Registry: `scope: 'pet'`. |
| `emergency_vet_authorisation` | **booking** | Per booking — the owner authorises emergency vet care for THIS service. `scopeId = bookingId`. | NOT lifetime. A booking-scoped authorisation is the honest evidence. Registry: `scope: 'booking'`. |
| `reviews_content_policy` | **transaction** | Per-review submit. `scopeId = reviewId`. Never a one-time account gate. | Reviewer accepts the policy at the moment of writing the review — that's the only meaningful moment. |
| `community_guidelines` | **account** — informational | No checkbox needed; render on About / Community pages. | Not a signature-required document. |
| `home_access_property_authority` | **booking** | Per booking that requires provider entry into owner's home. `scopeId = bookingId`. | Property access is service-specific, not lifetime. Registry: `scope: 'booking'`. |

### Provider-side (9)

| Key | Proposed scope | Evidence style | Notes |
|---|---|---|---|
| `provider_reconfirmation` | **provider** — recurring | New row PER RECONFIRMATION EVENT (annual by default). Version bumps trigger a fresh row via `versionExpected` 410. | Recurring evidence, not one-time. |
| `provider_truth_declaration` | **provider** | Signed at initial onboarding + on each reconfirmation event. | Same shape as `provider_reconfirmation`. |
| `provider_confidentiality` | **provider** | One-time at onboarding; version bump = new signature. | Standard NDA lifecycle. |
| `provider_brand_use` | **provider** | One-time at onboarding; version bump = new signature. | Brand-guidelines evolve. |
| `provider_payout_rules` | **provider** — recurring | Re-accepted on any payout-rate change (registry `currentVersion` bump). | Money-touching rules must be evidenced per version. |
| `provider_cancellation` | **provider** — recurring | Same as payout_rules — bump-triggered re-accept. | Cancellation policy is a money rule. |
| `provider_no_circumvention` | **provider** | One-time at onboarding; version bump = new signature. | Off-platform ban. |
| `provider_background_check_consent` | **provider** — recurring | New row PER BACKGROUND-CHECK ROUND (annual). `scopeId` = the check run id if we have one. | Rechecks require a fresh consent, not the historic one. |
| `provider_self_declaration_no_convictions` | **provider** — recurring | Paired with `provider_background_check_consent` — same round. | Statement of fact that must be re-affirmed. |

## What NOT to do

- Do NOT wire a `POST /api/legal/accept` call on every passive-display
  page just to say "we captured evidence". A page that renders
  informational text with no checkbox has NO acceptance to record;
  logging a fake acceptance every render is worse than nothing.
- Do NOT default the 4 booking-scoped documents to `scope: 'account'`.
  A one-time click at signup is dishonest evidence for a
  per-booking authorisation.
- Do NOT extend `legal_acceptances.unique(user_id, document_key,
  doc_version)` today. The schema needs `scope_type` + `scope_id`
  columns before per-booking / per-pet evidence lands; that migration
  is a separate design step (correction pass #2 §12).

## Schema follow-up (design only, no migration yet)

To support per-booking / per-pet / per-transaction evidence honestly,
the table needs (proposed):

```sql
ALTER TABLE legal_acceptances
  ADD COLUMN scope_type VARCHAR(24)  -- 'account'|'provider'|'service'|'booking'|'pet'|'transaction'
    NOT NULL DEFAULT 'account',
  ADD COLUMN scope_id   VARCHAR(64);  -- NULL only for account-scope

-- Replace the single partial unique index with a scope-aware one:
DROP INDEX IF EXISTS ...current partial unique...;
CREATE UNIQUE INDEX legal_acceptances_unique_scope
  ON legal_acceptances (user_id, document_key, doc_version, scope_type, COALESCE(scope_id, ''));
```

Migration NOT prepared this session — captured for a controlled deploy
window.

## Wiring plan (post-schema)

Order of implementation, once scope columns land:

1. **Booking-scoped bundle** at booking submit — a single server-side
   call after quote acceptance writes rows for
   `booking_rules`, `emergency_vet_authorisation` (if applicable),
   `home_access_property_authority` (if applicable).
2. **Pet-scoped** at Pet Passport add — `pet_owner_responsibility`.
3. **Transaction-scoped** at review submit — `reviews_content_policy`.
4. **Provider annual reconfirmation** — a cron creates a
   "reconfirmation window" event; the provider accepts each doc
   per-round; consent lands with `scope_type='provider'` +
   `scope_id=<roundId>`.

Owner: parent engineering session (next lane).
Deploy window required: yes (schema change touches evidence).
