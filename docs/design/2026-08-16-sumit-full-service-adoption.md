# SUMIT Full-Service Adoption — Implementation Plan (CEO 2026-08-16, revised after CEO correction)

**Principle:**
> **PetWash owns the PRODUCT. SUMIT owns the accounting/invoicing platform.** SUMIT is the already-connected accounting/invoicing system used by the company. PetWash sends SUMIT the right transaction/customer/business data. We do NOT duplicate SUMIT functionality. We do NOT redesign Israeli accounting rules ourselves. We follow the official SUMIT documentation, API/Swagger, and the existing configured company account.

**Source of the official contract:** `docs/PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md` (endpoint-by-endpoint, with fields, request/response shapes, and idempotency mechanisms verified against the SUMIT plugin + Swagger).

---

## 1. What we do today (verified in code)

| Layer | We call SUMIT for | We do in-house (duplicates SUMIT capability) |
|---|---|---|
| Fiscal doc issuance | `createDocument` / `createCustomerReceipt` / `createCreditDocument` | `IsraeliDigitalReceiptService`, `TaxSequenceService`, `invoiceSequence.ts`, `VATCalculatorService` — a parallel in-house issuer |
| Payment page | `beginRedirect` (hosted, PCI SAQ-A) | Nayax is a separate provider — unchanged |
| Payment vault | `setForCustomer` + `chargeSavedCard` + `chargeRecurring` — **NEVER USED** because no SUMIT customer has ever been created | Full saved-card + recurring code exists as dead code |
| ITA / SHAAM | Nothing | `IsraeliTaxAPIService`, `IsraeliTaxAuthorityAPI`, `ITAComplianceMonitoringService`, `ElectronicInvoicingService` — our own OAuth to ITA |
| Marketplace commission split | Nothing (SUMIT has `multivendorcharge`) | `EscrowService`, `payoutGate`, `ProviderPayoutService`, `WalletLedger` |
| Refund / void | Writes credit doc via `createCreditDocument` — never voids the actual card | `RefundService` — records the obligation only |
| Customer master | Nothing — `/accounting/customers/create/` is never called | Every SUMIT doc issued anonymously with `Details.Customer` inlined |
| Inbound reads | Nothing — every call is OUTBOUND write | N/A |
| Webhook | Only `payment.succeeded` handled | `document.confirmed / document.failed / subscription.* / recurring.*` are TODO stubs |

## 2. What SUMIT gives us that we're not using

From the SUMIT team's message and the official contract:

- **Customer master + dashboard.** Every PetWash user should be a SUMIT customer with a `CustomerHistoryURL` — SUMIT hosts the invoice-list / receipt / statement UI. This is the "member user with dashboard control panel."
- **All Israeli invoices legally.** When we send fiscal docs through SUMIT, SUMIT is the ITA-clearance software. We stop maintaining a parallel issuer.
- **Recurring / saved-card / refund** — first-class, but blocked today because we've never created a SUMIT customer to bind them to.
- **Marketplace** — `multivendorcharge` + sub-business creation + Upay clearing.
- **Wallets** — Apple Pay / Google Pay / Bit on the hosted page (activation, not code).

## 3. Order of work — smallest-first, keep signup fast

Each phase is a separate PR, all behind feature flags that default OFF. Nothing changes in production until CEO flips the flag AND the phase has been exercised against `SUMIT_SANDBOX=true`.

### Phase 2 (safest first) — Sync SUMIT customer for every PetWash member
**Ships now (this PR + companion PR-SUMIT-PHASE-2-INFRA):**
- New table `sumit_customers(user_id → sumit_customer_id, customer_history_url, source, external_reference, synced_at)`. Additive-only. No changes to `users`/`customers`/`payment_tokens`.
- `SumitClient.createCustomer` — official contract:
  - Endpoint: `POST /accounting/customers/create/`
  - Body: `{ Details: AccountingTypedCustomer, Credentials }`
  - `Details.SearchMode: "Automatic"` + `Details.ExternalIdentifier=uid` → find-or-create dedup on SUMIT side.
  - Response fields pinned: `CustomerID`, `CustomerHistoryURL`. No heuristic parsing.
- `SumitCustomerService.syncForUser(uid, profile, source)` — idempotent (pre-check `sumit_customers`, then call SUMIT with SearchMode Automatic). Fire-and-forget wrapper for hot paths — never throws.
- `SumitCustomerService.getCustomerHistoryUrl(uid)` — server-resolved read helper. Caller passes authenticated uid; browser never supplies uid.
- Feature flag: `SUMIT_CUSTOMER_SYNC_ENABLED` — default `'false'`.

**Ships in the wire-up PR (`PR-SUMIT-PHASE-2-WIRE`, follows this design merge):**
- Fire-and-forget call in `activateFromVerifiedPayment` (after PetWash activation succeeds). Signup does not slow down and cannot fail on SUMIT hiccup.
- Backfill script — **DRY RUN first**. Uses `SearchMode: "Automatic"` so a re-run cannot duplicate. Reports counts before writing.
- "My Invoices / החשבוניות שלי" surface on the account page. Server-resolved: `GET /api/me/invoices/portal-url` returns the caller's own `CustomerHistoryURL`. User A can never obtain User B's link.

### Phase 3 — Webhook lifecycle completion
Handle the SUMIT-documented events currently stubbed:
- `document.confirmed`, `document.failed` — update `digital_receipts.sumit_document_id` state.
- `subscription.created`, `subscription.cancelled` — drive Prestige membership state from SUMIT truth.
- `recurring.charged`, `recurring.failed` — surface renewal outcomes.
- `refund/cancel` — bind to `refund_transactions.sumit_credit_doc_ref`.

Idempotent processing per event (SUMIT event id).

### Phase 4 — Subscriptions (Prestige tiers, wash packages)
- Enable `chargeRecurring` — a valid `CustomerID` now exists after Phase 2.
- Move Prestige tier billing from manual charge to SUMIT standing order (הוראת קבע).
- Wash-package auto-refill on N-remaining threshold.
- No business-rule change — same amounts, same commissions, same VAT.

### Phase 5 — Inbound reads for in-app admin dashboard
- Whatever official read endpoints SUMIT exposes: invoice list, payout report, aging.
- Mirror in the admin dashboard so operators don't leave PetWash for reconciliation.

### Phase 6 — Marketplace `multivendorcharge`
Per official contract (§3.3 in the audit doc): `POST /billing/payments/multivendorcharge/` returns `Data.Vendors[]` with per-vendor Payment/DocumentID/CustomerID.

Prereqs: provider sub-businesses exist in SUMIT (`POST /website/companies/create/` — returns the sub-business's own API keys).

Once wired, SUMIT handles the customer charge, PetWash-commission slice, provider slice, and payout. We stop running our own commission math for marketplace bookings.

**No business-rule change** — the same PetWash 15% commission, same provider payout math, same refund tiers. We change the RAIL, not the RULES.

### Phase 7 — Retire the in-house parallel issuer
Once every payment class is going through SUMIT and dual-issue reconciliation shows numbers match (see §4 below), retire the in-house `IsraeliDigitalReceiptService` + `IsraeliTaxAPIService` + `IsraeliTaxAuthorityAPI` + `ITAComplianceMonitoringService` + `ElectronicInvoicingService`. The SUMIT-connected company account is the sole issuer of record.

## 4. Verify-before-cutover contract

For each phase that touches money flow, we run in **dual-write mode**:
1. Keep the current path running.
2. Add the SUMIT path behind the flag.
3. Enable flag in `SUMIT_SANDBOX=true` first — verify the wire.
4. Turn flag on in production for a small canary (one payment class, one franchise, or one staff account).
5. Compare SUMIT's numbers vs. our in-house numbers for a short observation window (not a fixed calendar month — long enough that we've seen an example of each event type).
6. If they match, expand the canary. If they don't, disable and diff.
7. Once every payment class is verified via canary, retire the in-house path.

This is a technical verification, not a legal gate. No lawyers, no external approvals. The check is "do the numbers agree between the two paths."

## 5. Security

- SUMIT credentials (`SUMIT_API_KEY`, `SUMIT_COMPANY_ID`, `SUMIT_WEBHOOK_SECRET`) are server-only, never logged, never sent to frontend, never committed. The existing `readEnv()` in `SumitClient.ts` already enforces this — we do not touch it.
- Customer identity on read helpers (e.g. `GET /api/me/invoices/portal-url`) is SERVER-resolved from the authenticated Firebase token. The uid is never accepted from a query/body.
- `sumit_customers.customer_history_url` is a URL SUMIT issued to us — treat as sensitive (contains SUMIT customer scope). Only expose to the authenticated owner.

## 6. No new business rules

This work is a rail change, not a policy change. **We do not modify:** VAT rates, commission percentages, refund rules, provider earnings math, Prestige pricing, wallet value, eGift value, invoice treatment, payout timing.

## 7. What ships with this design PR

- `docs/design/2026-08-16-sumit-full-service-adoption.md` — this doc.
- **Companion infrastructure PR** (`claude/sumit-phase-2-infra`, PR #1864): the createCustomer client method (official contract), the mapping table, the sync service, feature flag OFF, regression tests. **No caller wired.**

## 8. What ships next (immediately after this doc merges)

- `PR-SUMIT-PHASE-2-WIRE` — fire-and-forget hook in activation + backfill dry-run script + "My Invoices" surface.
- `PR-SUMIT-PHASE-3-WEBHOOKS` — complete the documented event handlers.
- `PR-SUMIT-PHASE-4-SUBS` — enable Prestige subscription via `chargeRecurring`.
- `PR-SUMIT-PHASE-5-READS` — admin dashboard invoice-list mirror.
- `PR-SUMIT-PHASE-6-MARKETPLACE` — `multivendorcharge` wiring.
- `PR-SUMIT-PHASE-7-RETIRE-INHOUSE` — retire the in-house parallel issuer after canary + dual-write verification.

Each is a separate PR, each behind its own flag, each verified in sandbox before production flip.

---

**Companion documents on main:**
- `docs/PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md` — endpoint + field reference (source of truth for the official contract).
- `docs/SUMIT_CAPABILITIES_AUDIT.md`
- `docs/finance/sumit-activation-checklist-2026-06-15.md`
- `docs/finance/sumit-activation-plan.md`
- `docs/finance/runbook-sumit-tax-authority-error.md`
