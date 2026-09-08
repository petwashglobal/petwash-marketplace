# Money-authority route census — 2026-09-08

Spec for the StepUp v3 migration. Produced because "the three admin routes"
was not a census, and the map has to exist before the migration can be called
complete.

Scope: routes where a human (admin / executive / franchise_owner / support)
causes value to move or changes who is allowed to move it. System processes are
listed separately — they have no human to prompt and are not step-up surfaces.

## Headline

**The approval matrix governs `/api/financial-approvals/*` and nothing else.**

Nine admin wallet routes move real value. None of them consults
`checkFinancialAuthority`. None has step-up. Eight have no cap of any kind.

| route | matrix | step-up | cap |
|---|---|---|---|
| `POST /admin/wallet/release` | — | — | none |
| `POST /admin/wallet/refund` | — | — | none |
| `POST /admin/wallet/adjust` | — | — | none |
| `POST /admin/wallet/support/release-hold` | — | — | none |
| `POST /admin/wallet/support/issue-refund` | — | — | none |
| `POST /admin/wallet/support/credit` | — | — | ₪500 |
| `POST /admin/wallet/payout-entries/mark-paid` | — | — | none |
| `POST /admin/wallet/refund-requests/:id/approve` | — | — | none |
| `POST /admin/wallet/disputes/:caseRef/apply-resolution` | — | — | none |

`/admin/wallet/adjust` accepts `{ userId, amountCents, type: 'credit'|'debit' }`
behind a bare `customClaims.admin` check. One admin can credit any wallet any
amount, with no second approver and no ceiling. The thresholds and
second-approval roles hardened in #2317 do not apply to it.

These routes are NOT the same defect as `/payout-release-gate`. There the
amount was derivable from a settlement and the caller was lying about it. Here
the amount IS the admin's intent — there is nothing to derive. The right
control is a step-up proof BOUND to the chosen amount plus an authority band,
not a canonical lookup.

## Already corrected

| route | was | now |
|---|---|---|
| `POST /api/financial-approvals/payout-release-gate` | body amount + body ownership selected the rule | derived from `station_settlements` incl. `franchise_owner_id` (#2317) |
| `POST /api/financial-approvals/approve` | body amount + body ownership | derived from the business object (#2317) |
| `POST /api/financial-approvals/second-approve` | mutated before validating | validate → full fingerprint → conditional transition (#2317) |
| `POST/PATCH/DELETE /api/financial-approvals/matrix` | `franchise_owner` could edit rules governing itself | admin/executive only (#2317) |

## Open, with reasons

- `POST /api/financial-approvals/check` — takes `amount_cents` AND `user_role`
  from the caller. Mutates nothing, so not a bypass; it is an oracle that
  reports which amount clears which role. Needs its own review.
- `payout_release/release` execution — `/queue` emits `payout_batches.batch_id`
  while the executor updated `station_settlements.id`. Failing closed since
  #2317 (`PAYOUT_BATCH_EXECUTOR_NOT_IMPLEMENTED`). A real batch executor does
  not exist and was not invented.
- Provider payout destination — `contractor_bank_details` is canonical;
  `providers.bankAccount` is not written by anything; the executor reads
  `provider.bankAccountNumber`, which is not a column. Destination is never
  snapshotted onto `super_app_payouts`, so a later bank change would redirect
  an already-approved payout. Unreachable today only because the fields are
  phantom and `BANK_PAYOUT_LIVE` is off. Separate PR.

## Not step-up surfaces

- `ProviderPayoutService.autoReleaseExpiredEscrows()` — system process, no
  human present. Protect the destination and the gates, not with an OTP.
- Real Israeli bank transfer — deliberately stubbed behind `BANK_PAYOUT_LIVE`.
  Do not enable.

## Suggested order

1. The nine wallet routes above — authority band + amount-bound step-up.
   `adjust` and `support/*` first: they mint value with no ceiling.
2. `/check` authorization.
3. Payout destination model (canonical → verified → immutable snapshot).
4. Batch executor, or removal of the batch case from the generic rail.

The remaining ~140 `/admin/wallet/*` routes are configuration, analytics,
governance and reporting. They are policy surfaces rather than money surfaces
and belong in a policy-mutation review of the kind #2317 applied to the matrix,
not in the money migration.
