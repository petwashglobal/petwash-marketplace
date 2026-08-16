# SUMIT Full-Service Adoption — Phased Plan (CEO 2026-08-16)

**Status:** MERGE-BLOCKED. Design only. No production behaviour change until each phase is explicitly signed off. Companion audit that mapped current state: see the "Full SUMIT integration audit" report attached to this session (SumitClient.ts + 57 files + 20 docs).

**Origin:** CEO 2026-08-16 —
> "all sumit.co.il team said we not using their amazing full service right smart, we dont get how good legal they are and we member user with dashboard control panel , israel invoices all"

Translation: SUMIT's engineering / product team have told us we are not using the platform correctly. They handle:
1. All Israeli invoices with legal weight (registered ITA-clearance software, מספר תוכנה 00215702).
2. A hosted customer / member dashboard where every invoice, receipt, subscription and past charge lives — one legally-authoritative place.
3. Marketplace split, saved-card charging, recurring billing, refund/void — all first-class.

Today we route about 15 % of what they can do through them. The other 85 % we do in-house, in code we own and are liable for. This doc lays out how to close that gap without breaking a live business.

## 1. What we do today (verified in code)

| Layer | We call SUMIT for | We do in-house (duplicates SUMIT capability) |
|---|---|---|
| Fiscal doc issuance | `createDocument` / `createCustomerReceipt` / `createCreditDocument` for supplier invoices + some receipts | `IsraeliDigitalReceiptService` (1,323 LOC), `TaxSequenceService`, `invoiceSequence.ts`, `VATCalculatorService` |
| Payment page | `beginRedirect` (hosted, PCI SAQ-A) for `SumitBookingPayment`, `payments-sumit`, `egift-guest` | Nayax rail (separate provider — kept as before) |
| Payment vault | `setForCustomer` + `chargeSavedCard` + `chargeRecurring` — **NEVER USED** because no SUMIT customer exists to charge | Full saved-card + recurring code exists as dead code |
| ITA clearance ("Model H", Digital Invoice Law 2024) | Nothing — SUMIT would do this for us | `IsraeliTaxAPIService`, `IsraeliTaxAuthorityAPI`, `ITAComplianceMonitoringService`, `ElectronicInvoicingService` — direct OAuth to ITA ourselves |
| Marketplace commission split | Nothing | `EscrowService`, `payoutGate`, `ProviderPayoutService`, `WalletLedger` — all custom money math |
| Refund / void | Only writes a credit doc via `createCreditDocument` — never voids the actual card | `RefundService` — records the obligation; card void marked "Phase 2" |
| Customer master | Nothing — `/accounting/customers/create/` is never called | Every SUMIT doc issued anonymously with `Customer` inlined |
| Inbound reads | Nothing — every call is OUTBOUND write | N/A |

## 2. Why this matters (the CEO's point)

- **Legal delegation.** When we are the invoice issuer, we own the audit trail, the numbering, the SHAAM allocation, the ITA relationship. If we make SUMIT the issuer, they are the ITA-registered software and the party of record for the tax authority. That is the "how good legal they are" line.
- **Dashboard.** SUMIT hosts a customer portal — for each `SUMIT CustomerID` there is a login where they see every invoice/receipt/subscription/statement. We have never created a SUMIT customer, so no PetWash member has that dashboard reachable. That is the "member user with dashboard control panel" line.
- **One source of truth for money to a customer.** Every eGift, every wash, every Prestige charge lives in one place — visible to the customer, exportable by them, cross-referable by any auditor. That is the "israel invoices all" line.

## 3. Phased plan — order by legal-safety win

Each phase is a separate PR, each stays behind a hard-off feature flag until the CEO flips it in production.

### PHASE 2 — Sync SUMIT customer for every PetWash member (SAFEST START)

**Why first:** unblocks Phases 3, 5, 6. Zero money-math change. Zero legal delegation. Purely a foreign-key propagation.

**Deliverables:**
1. New table `sumit_customers`:
   ```sql
   CREATE TABLE sumit_customers (
     user_id             VARCHAR(128) PRIMARY KEY,   -- Firebase UID
     sumit_customer_id   VARCHAR(128) NOT NULL UNIQUE,
     synced_at           TIMESTAMP    NOT NULL DEFAULT now(),
     source              VARCHAR(32)  NOT NULL,       -- 'signup' | 'backfill' | 'manual'
     external_reference  VARCHAR(128) NOT NULL         -- our idempotency handle (uid)
   );
   ```
   Not touching the `users` or `customers` tables — additive-only.
2. `SumitClient.createCustomer` method — POST `/accounting/customers/create/` with `{ Credentials, Customer: { Name, EmailAddress, PhoneNumber, ExternalIdentifier, Language: 'Hebrew' } }`. Idempotent via `ExternalIdentifier = uid` (SUMIT's own dedup) and via our own pre-check against `sumit_customers`. When not wired: `{wired:false}` no-op (same pattern as siblings).
3. `SumitCustomerService.syncForUser(uid)` — checks `sumit_customers`; if absent, calls `createCustomer`; on success inserts the row. Fail-soft — never throws to caller.
4. **Fire-and-forget hook** at the end of `activateFromVerifiedPayment` and post-signup activation. Signup must never fail because SUMIT is degraded.
5. **Feature flag** `SUMIT_CUSTOMER_SYNC_ENABLED` — default `false`. Nothing fires in prod until CEO flips it.
6. Backfill script queued (dry-run first) to walk existing verified users.

**What can go wrong:** SUMIT rejects a duplicate `ExternalIdentifier` on a retry — we catch and treat as "already synced". SUMIT is down — the fire-and-forget swallows and logs; a nightly reconciler retries. No money impact either way.

### PHASE 3 — Member dashboard link (visible customer value)

**Depends on:** Phase 2.

- Add a "My Invoices / החשבוניות שלי" surface on the account page.
- Deep-link to the SUMIT customer portal for the member's `sumit_customer_id`. Confirmed with SUMIT: what is the portal URL scheme? (Design question — need SUMIT support answer.)
- Optionally mirror an invoice-list view in-app via a SUMIT read API (per Phase 7).

### PHASE 4 — Marketplace `multivendorcharge` (BIGGEST DELETION, D12 firewall)

**Depends on:** Phase 2 (needs SUMIT customer per member + SUMIT sub-business per provider).

**What it retires:** `EscrowService`, `payoutLedger`, `ProviderPayoutService`, most of `payoutGate`, disclosed-agent commission math in `VATCalculatorService`.

**Why huge:** every one of those files is money code we own. Moving to SUMIT `multivendorcharge` means the split, the payout, the T+1 clearing, and the provider KYC/AML happen inside SUMIT/Upay — we call one API and record the reference.

**Why NOT first:** D12 firewall applies — this changes the money rail for every marketplace booking. Needs explicit CEO signoff AND at least one full sandbox reconciliation run against the current escrow numbers before flipping in prod.

### PHASE 5 — Subscriptions (Prestige tiers, wash packages)

**Depends on:** Phase 2.

- Enable `chargeRecurring` + a renewal scheduler.
- Move Prestige tier billing from "manual charge on signup" to "SUMIT standing order" (הוראת קבע).
- Wash-package auto-refill on N-remaining threshold.

### PHASE 6 — Webhook lifecycle completion

- Complete the `sumit-webhook.ts` skeleton: handle `document.confirmed`, `document.failed`, `subscription.created`, `subscription.cancelled`, `recurring.charged`, `recurring.failed`.
- Drive Prestige membership state from SUMIT truth instead of polling.
- Update `digital_receipts.sumit_document_id` when SUMIT confirms.

### PHASE 7 — Inbound reads

- Wire whatever SUMIT read APIs let us: invoice listing, payout report, customer statement, aging.
- Mirror in the admin dashboard so operators don't leave PetWash for reconciliation.

### PHASE 1 — Delegate ITA / SHAAM to SUMIT (BIGGEST LEGAL WIN, biggest deletion)

**Deliberately last.** This is the most valuable in terms of legal risk offloaded — SUMIT becomes the issuer of record for every Israeli invoice, the ITA's counterparty is SUMIT not us. But it is also the deepest deletion (retires `IsraeliTaxAPIService`, `IsraeliTaxAuthorityAPI`, `ITAComplianceMonitoringService`, `ElectronicInvoicingService`, gapless-numbering code, most of `IsraeliDigitalReceiptService`).

**Why last:** requires (a) every payment class already going through SUMIT (Phases 2 + 4 + 5), (b) CPA / counsel signoff on the cutover, (c) one full month of dual-issue reconciliation ("SUMIT issued but we also self-issued") before we switch `issuer_of_record` universally to `sumit` and stop self-issuing.

## 4. Roll-forward / rollback contract

Every phase must ship:
- Behind a feature flag that defaults to `false` in prod.
- With a small canary path (staff-only account, one franchise, one payment class) before global flip.
- With a `sumit_outbound_events` audit row per API call (already exists — reuse).
- With an inverse migration where possible (adding a nullable column, not deleting).
- With a "dual-issue" period where we keep both paths writing so a rollback is a flag flip, not a code revert.

**Money code guardrails from `petwash-money-booking-invariants` skill:**
- §1 slot-lock — unchanged; SUMIT does not manage bookings.
- §2 receipt at fiscal event — MOVES to SUMIT once Phase 1 lands; must be verified in dual-issue period.
- §3 VAT per `paymentClass` — MOVES to SUMIT `VATIncluded` per doc type; the CPA mapping table must survive as documentation even after code delete.
- §4 money-in idempotent — SUMIT already supports `ExternalIdentifier` for dedup; we must key on our own idempotency handle every call.
- §5 encrypted PII — SUMIT customer sync must NOT ship national-ID; only the `sumit_customer_id` mapping.
- §6 `booking_requests` canonical — unchanged.

## 5. Open questions for SUMIT support

1. Portal URL scheme for a member deep-link — is it `https://sumit.co.il/customer/{CustomerID}` or an SSO-signed URL?
2. `multivendorcharge` sub-business creation flow — do providers need to submit KYC via a SUMIT-hosted onboarding page, or can we push their KYC docs via API?
3. Reporting API surface — is there a `/reports/invoices/list` we can call for the in-app admin dashboard, or is CSV export the only path?
4. Cutover process for `issuer_of_record` — can SUMIT accept a historical dump of our self-issued numbers so their sequence continues without a gap, or do we start their sequence at 1 and keep our historical numbers frozen?
5. Model H allocation number: is it fetched automatically per invoice, or do we need to pre-provision a batch?
6. Do they support Apple Pay / Google Pay / Bit on the hosted page today (audit doc §1 rows 6-9)?

## 6. Order of operations (recommended)

```
Phase 2  →  Phase 3  →  Phase 6 (webhook)  →  Phase 5 (subscriptions)
                                     ↓
                                  Phase 7 (reads)
                                     ↓
                             Phase 4 (multivendorcharge, D12)
                                     ↓
                             Phase 1 (SHAAM delegation, counsel signoff)
```

Phase 2 is a one-day PR. Phase 4 is a two-week project. Phase 1 is a legal/CPA project first, code second.

## 7. What we ship in the immediate next PR

**Infrastructure only, flag OFF:**
- Migration `0116_sumit_customers.sql` — additive table.
- `SumitClient.createCustomer` method.
- `SumitCustomerService.syncForUser(uid)`.
- Env flag `SUMIT_CUSTOMER_SYNC_ENABLED=false`.
- No caller wiring yet — the sync is exported but not invoked from any hot path.
- Regression test that pins the "flag off = no HTTP call" behaviour.

Once CEO approves the design + SUMIT support answers Q1 (portal URL), a second PR wires the fire-and-forget hook and adds the "My Invoices" surface.

---

**Companion documents:**
- `docs/finance/sumit-activation-checklist-2026-06-15.md`
- `docs/finance/sumit-api-known-vs-assumed-2026-05-23.md`
- `docs/SUMIT_CAPABILITIES_AUDIT.md`
- `docs/legal/tax-sequence-hardening-2026.md`
- `docs/finance/PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V3.md`

**Companion PRs (queued behind this doc):**
- `PR-SUMIT-PHASE-2-INFRA` — the code from §7 above.
- `PR-SUMIT-PHASE-2-WIRE` — the fire-and-forget hook + backfill script (requires SUMIT support Q1 answer).
- `PR-SUMIT-PHASE-3-DASHBOARD` — the "My Invoices" surface.
