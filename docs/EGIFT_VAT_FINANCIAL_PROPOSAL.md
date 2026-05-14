# EGift VAT & Financial Architecture — Audit and Proposal

**Status:** Audit + proposal for review. NO code changes. NO schema changes. NO config changes.
**Companion docs:** `BACKUP_RETENTION_ARCHITECTURE.md`, `EGIFT_LUXURY_ATMOSPHERE_REDESIGN.md`.
**Scope:** VAT presentation, financial reconciliation, ledger correctness, recipient/buyer delivery flow, refund/cancellation, admin tools.
**Out of scope:** gift card artwork, hero visual atmosphere (covered by separate proposal), payment processor migration.

---

## Important warnings before any implementation

1. **Nothing in this PR changes infrastructure, code, schema, or VAT behavior.** It is a written proposal.
2. **VAT treatment for gift cards in Israel has THREE plausible interpretations.** The audit found that the codebase documents `vatMode = 'deferred_liability'` for egift but does not implement it. This proposal does not pick a side — it makes the choice **configurable** so the CEO and CPA decide together, not the engineer.
3. **Israeli VAT rate is 18% as of January 2025** per the Israel Tax Authority circular, confirmed in `shared/israel-compliance-config.ts:30`.
4. **CPA sign-off is REQUIRED before any of three policies in `shared/israel-compliance-config.ts` are treated as final** (agent model, Osek Patur, withholding tax). These are explicitly marked provisional in code. The same standard applies to the chosen `EGIFT_VAT_MODE`.
5. **The proposal preserves all existing ledger integrity guarantees** (append-only `egift_events`, SHA256 hash chain, `walletLedgerEntries` double-entry) and adds rather than replaces.
6. **Default mode is `disabled_pending_review`** — implementing the flag without flipping it produces zero behavior change from today.

---

## 0. TL;DR

The audit found that PetWash's gift-card system is **architecturally solid** for ledger integrity (append-only `eVouchers`, `eVoucherRedemptions`, `egift_events`, `walletLedgerEntries` with SHA256 hash chaining) and **architecturally incomplete** for VAT handling.

The five gaps that this proposal fixes:

1. **VAT is not displayed**, **not calculated**, and **not stored** in the egift flow. The flow sends `₪100` straight to Nayax without breaking out VAT (`server/routes/gift-cards.ts:331-412`, `server/services/EgiftFinancialService.ts:83-264`). When the CPA asks "how was VAT collected on egift sales?", the answer today is "it wasn't".
2. **Three siloed ledgers** (`eVouchers`, `egift_events`, `walletLedgerEntries`) are each correct internally but require manual cross-reconciliation. There is no unified "outstanding gift card liability" view.
3. **No refund or cancellation flow** exists for egifts. If a buyer disputes a charge or wants to cancel, the manual process today is direct SQL.
4. **Admin tooling is minimal** — only orphaned-egift listing. No supervised reissue, no two-person rule on refunds, no audit of admin egift actions.
5. **Partial redemption** is supported by the schema (`eVouchers.remainingAmount`, `eVoucherRedemptions.amount`) but not implemented in the redemption route — it marks the whole voucher REDEEMED on first use.

The proposal addresses all five with **one configurable flag** (`EGIFT_VAT_MODE`), **additive schema columns** (no destructive changes), **a 5-phase rollout** (each phase reversible), and an explicit **CPA sign-off gate** before any VAT mode flips from `disabled_pending_review`.

---

## 1. What the audit found

Verified by code audit of the full repo, May 2026.

### 1.1 Single source of truth for denominations (good)

- `server/lib/egift-denominations.ts:18` — `EGIFT_ALLOWED_DENOMINATIONS = [100, 250, 500, 1000]`.
- Validation via `parseEgiftDenomination()` (line 26-44).
- **Drift risk:** denominations are also hardcoded in `client/src/pages/EGift.tsx:537-541` and detected via tier-by-value in `server/services/egiftEmailService.ts:40-45`. Three independent copies. **Recommendation:** export `EGIFT_ALLOWED_DENOMINATIONS` to a shared schema file consumed by all three. Not part of this proposal's critical path but tagged as cleanup.

### 1.2 Israeli VAT framework exists but is not wired into egift

- `shared/israel-compliance-config.ts:30` — `ISRAEL_VAT_RATE = 0.18`. Single source of truth for the 18% rate.
- `shared/schema-payments.ts:58,66,68` — `pwPayments` table has `vatCents`, `vatRate`, `vatMode` columns.
- `shared/schema-payments.ts:205-271` — `pwTaxDocuments` table for invoice/receipt VAT records.
- `server/services/IsraeliVATReclaimService.ts` — computes monthly Output VAT (revenue × 1.18 reverse calc) and Input VAT (approved expenses) for tax filing.
- `server/services/TransactionEngine.ts:72` — `'egift': { vatMode: 'deferred_liability' }` is the **declared intent** for egift but **not implemented anywhere downstream**.

**The gap:** in the egift purchase path (`server/routes/gift-cards.ts:331-412` → `server/nayaxService.ts:79-200`), the amount sent to the payment processor is the user-selected gift value (100 / 250 / 500 / 1000 ILS) with **no VAT addition and no VAT line item**. The `egift_events` and `eVouchers` tables have **no `vatCents` column**. The `IsraeliVATReclaimService` reconciles revenue at the aggregate level, not at the per-egift event level — so reconciliation drift between "VAT on egift" and "VAT on completed wash" is not detectable today.

### 1.3 Ledger architecture (good)

Three append-only ledgers cover egift events:

- **`eVouchers`** (`shared/schema.ts`) — primary voucher record. States: ISSUED → CLAIMED → ACTIVE → REDEEMED | EXPIRED | CANCELLED.
- **`eVoucherRedemptions`** — append-only per-redemption record with `voucherId`, `amount`, `locationId`, `nayaxSessionId`, `kycType`, `createdAt`.
- **`eVoucherEvents`** — audit trail per state transition: ISSUED, CLAIMED, ACTIVATED, REDEEMED, PARTIAL_REDEEM, EXPIRED, CANCELLED.
- **`egift_events`** — separate ledger used by `EgiftFinancialService` with `eventType`, `userId`, `amountCents`, `currency`, `ledgerEntryId`, `sha256Hash`, `metadata`, `idempotencyKey`.
- **`walletLedgerEntries`** (`shared/schema.ts:11675-11750`) — double-entry ledger with `eventType` including `egift_issue`, `egift_claim`, `egift_redeem`; SHA256 `previousHash + entryHash` chain.

Anti-pattern check: direct balance updates without ledger entries are **AVOIDED**. `walletAccounts.egiftBalanceCents` is updated only in the same transaction as the ledger insert (e.g., `server/services/EgiftFinancialService.ts:127-133`).

### 1.4 Buyer flow (purchase) — what fires today

1. Frontend POST from `client/src/pages/EGift.tsx:754-795` with `amount`, `recipientName`, `recipientEmail`, `message`, `senderName`, `senderEmail`.
2. Server validates denomination at `server/routes/gift-cards.ts:331-412`. Honors `PETWASH_EGIFT_PURCHASE_ENABLED` kill-switch.
3. `NayaxPaymentService.initiatePayment()` (`server/nayaxService.ts:79-200`) sends `amount: 100|250|500|1000` to Nayax. **No VAT computed. No VAT line item. The full amount is collected as if it were the gift credit value.**
4. Webhook callback (in `nayax-webhooks.ts`) creates the voucher.
5. `egiftEmailService` sends the recipient email (`server/services/egiftEmailService.ts:321-348`) and the buyer confirmation email (`server/routes/accounting.ts:862-903`).

### 1.5 Recipient delivery (good — but missing some fields)

- Wired and firing: `server/services/egiftEmailService.ts:321-348` sends transactional email with sender name, recipient name, amount, occasion emoji, QR code, wallet pass URLs (Apple/Google), serial number, expiry.
- **Missing fields:** redemption instructions for non-QR paths (e.g., entering a code manually), refund policy text, link to recipient's wallet view.
- **Security:** QR code embeds `voucherId + code + hash`. Server verifies the hash on redemption (`server/routes/gift-cards.ts:430`). Wallet pass tokens have 72-hour validity (`server/lib/walletPassToken.ts`). **The redemption link itself is not HMAC-signed** — relies on UUID entropy + code hash. This is acceptable but not best-in-class.

### 1.6 Buyer confirmation (partial — missing financial fields)

- Wired at `server/routes/accounting.ts:862-903` and `server/routes/gift-cards.ts:273-309`.
- Includes: buyer name, recipient name, gift value, currency, voucher ID, personal message, seasonal theme.
- **Missing:** transaction ID, receipt/invoice number, VAT amount, link to formal invoice.

### 1.7 Redemption (good for full redemption, partial-redemption gap)

- Route at `server/routes/gift-cards.ts:414-550`. Atomic transaction: `UPDATE eVouchers SET status='REDEEMED'` + `INSERT eVoucherRedemptions`. Race-condition safe.
- Credit transfer: `EgiftFinancialService.brainRedeem()` (`server/services/EgiftFinancialService.ts:296-592`) decrements `walletAccounts.egiftBalanceCents` and inserts ledger entries in the same transaction.
- **Partial redemption gap:** the schema supports `remainingAmount` and `eVoucherRedemptions.amount < initialAmount`, but the redemption route at line 441-444 marks the **entire voucher REDEEMED** on first use. So a ₪100 card used for ₪50 of services loses the remaining ₪50 — or is force-redeemed into the wallet at ₪100, depending on the flow path. **This is a real bug, not just a missing feature.**

### 1.8 Admin tools (minimal)

- Found: `GET /api/admin/wallet/orphan-egift-customers` at `server/routes/admin.ts:1458`.
- **Not found:** admin cancel, admin refund, admin reissue, admin search by recipient email, admin extend expiry.
- **Two-person rule:** no evidence of any two-person approval flow on egift operations.
- **Audit logging of admin egift actions:** indirect via `walletLedgerEntries.createdBy` (varchar 128). No dedicated egift admin audit table.

### 1.9 Refund / cancellation (missing entirely)

- No refund route exists for egifts. Searched: `refund`, `cancel`, `void`, `reverse` in egift context — nothing.
- The schema would support reversal (insert a reverse `walletLedgerEntries` row), but no service or route invokes it.
- Implication: dispute / chargeback handling today is manual SQL.

### 1.10 Financial reconciliation (good for aggregate, missing for egift specifically)

- `server/services/FinancialReconciliationService.ts:128-1000+` runs monthly (`server/backgroundJobs.ts:224`).
- Reconciles: escrow ↔ provider payouts, VAT records, invoice sequencing (gap detection), receipt tracking.
- **Egift gap:** does NOT separately track outstanding egift balance. The "outstanding liability" of unredeemed gift cards is computable from `eVouchers.remainingAmount WHERE status='ACTIVE'` but is not reported.

---

## 2. The three VAT modes — proposal

The codebase already has a comment declaring `vatMode = 'deferred_liability'` for egift. This proposal makes that mode **explicit and configurable**, with three documented values that the CPA can choose between.

### 2.1 Mode A — `purchase_vat` (VAT charged at purchase, recipient gets gross credit)

**Customer sees in checkout:**

```
קרדיט מתנה:       ₪100
מע״מ 18%:         ₪18
סה״כ לתשלום:      ₪118
```

**Accounting treatment:**
- The buyer pays ₪118. The platform owes ₪18 VAT to ITA immediately at sale.
- The recipient is issued a gift credit of ₪100 (pre-VAT).
- When the recipient redeems against an actual service, **no additional VAT event** — the VAT was already collected at purchase.
- Implementation: in `server/services/EgiftFinancialService.ts`, on `PURCHASED` event, write `vatCents = amountCents × 0.18`, `vatRate = '0.18'`, `vatMode = 'purchase_vat'` into `egift_events`. Reconciliation picks this up automatically.

**Pros:**
- Buyer's payment exactly matches the VAT receipt at purchase time. Clean accounting trail.
- Recipient never sees VAT — the ₪100 they have is ₪100 of services.
- Matches the CEO's example in the brief.

**Cons:**
- The platform collects VAT before any service is actually rendered. If the gift expires unredeemed, the VAT was still collected. Refund must reverse both the principal AND the VAT.
- May not match CPA's preferred treatment if they want the VAT event tied to service delivery.

### 2.2 Mode B — `redemption_vat` (deferred VAT, current declared intent)

**Customer sees in checkout:**

```
קרדיט מתנה:       ₪100
סה״כ לתשלום:      ₪100
```

(no VAT line — the sale is recorded as a stored-value deposit, not a taxable supply)

**Recipient sees on redemption** (when actually using credit for a wash/service):

```
שירות:           ₪100
שולם מקרדיט מתנה: ₪100
מע״מ 18% (כלול): ₪15.25
```

(VAT is reverse-calculated from the gross service price at the moment of consumption — the standard Israeli approach for VAT-inclusive pricing on services)

**Accounting treatment:**
- The buyer pays ₪100 → recorded as **deferred liability** (PetWash owes the recipient ₪100 of services).
- No VAT event at purchase.
- When the recipient redeems for a ₪100 wash, the wash records VAT in the ordinary way (the wash is a taxable supply; reverse-calc 100/1.18 = ₪84.75 service value, ₪15.25 VAT).
- Implementation: in `egift_events`, on `PURCHASED` event, write `vatCents = 0`, `vatMode = 'redemption_vat'`. On `REDEEMED`, the receiving service's normal VAT path fires — egift just funds the payment.

**Pros:**
- Matches standard Israeli VAT treatment for stored-value gift cards / prepaid services.
- If gift expires unredeemed, no VAT was collected — no reversal needed.
- Aligns with `vatMode = 'deferred_liability'` already declared in `TransactionEngine.ts`.

**Cons:**
- Buyer's payment of ₪100 looks "VAT-free" at the moment of purchase — confusing for buyers expecting a tax breakdown.
- Recipient sees VAT at redemption time, which is unusual UX for gift card products.
- Requires the service-side flow to be aware that the payment source is an egift (to attribute the VAT correctly).

### 2.3 Mode C — `disabled_pending_review` (current state, default)

**Customer sees:** no VAT line item, just `₪100` total.
**Accounting:** the platform's current behavior — VAT is not separately recorded on egift events. Aggregate reconciliation via `IsraeliVATReclaimService` continues to work on revenue totals.
**This is the safe default while the CPA reviews the choice between Mode A and Mode B.**

### 2.4 Recommended decision tree for the CPA

(For the CPA's review, not the engineer's decision):

1. Are egift sales currently treated as **taxable supply at the moment of sale**?
   - **Yes** → Mode A (`purchase_vat`).
   - **No, they are treated as deferred liability** → Mode B (`redemption_vat`).
   - **Unclear / never asked** → Mode C until decided.
2. Has the platform's VAT filing for egift been historically based on full revenue (Mode A treatment) or service-render revenue (Mode B treatment)?
   - The audit could not answer this from code alone. CPA must confirm.

---

## 3. Schema additions (additive only — no destructive changes)

### 3.1 New columns on `egift_events`

| Column | Type | Default | Purpose |
|---|---|---|---|
| `vatCents` | integer | `0` | VAT amount in cents for this event. Mode A: 18 cents per shekel on PURCHASED. Mode B: 0 on PURCHASED, reverse-calc at REDEEMED. |
| `vatRate` | varchar(8) | `'0.00'` | Rate applied. Modes A/B: `'0.18'`. Mode C: `'0.00'`. |
| `vatMode` | varchar(32) | `'disabled_pending_review'` | Records which mode was active at the event. Allows historical reconstruction if mode changes. |
| `grossCents` | integer | (same as `amountCents`) | Total charged including VAT. Mode A on PURCHASED: `amountCents + vatCents`. Mode B: `amountCents`. Mode C: `amountCents`. |
| `netCents` | integer | (same as `amountCents`) | Net revenue after VAT. Mode A on PURCHASED: `amountCents`. Mode B: `amountCents`. Mode C: `amountCents`. |
| `processorFeeCents` | integer | `0` | Fee paid to Nayax for this event, if known at the time. |
| `outstandingLiabilityCents` | integer | `0` | Snapshot of the platform's outstanding egift liability AT THIS EVENT. Used for daily balance verification. |

All seven columns are nullable initially; existing rows backfill with `0` / current-mode-default. No `NOT NULL` constraint until the migration is followed by a backfill confirmed by the CPA.

### 3.2 New columns on `eVouchers`

| Column | Type | Default | Purpose |
|---|---|---|---|
| `purchaseVatCents` | integer | `0` | VAT collected at purchase if Mode A; 0 if Mode B or C. |
| `purchaseGrossCents` | integer | (computed) | Total amount buyer paid. Always recorded. |
| `deliveredAt` | timestamp | NULL | When the recipient delivery email was confirmed sent (timestamps from `egiftEmailService`). |
| `firstRedeemedAt` | timestamp | NULL | Distinct from `activatedAt`; tracks the first redemption event specifically. |
| `vatModeAtPurchase` | varchar(32) | `'disabled_pending_review'` | Snapshot of `EGIFT_VAT_MODE` at the time this voucher was issued. |

### 3.3 New table `egift_admin_actions` (optional — Phase 4)

For Phase 4 (admin tooling), introduce an append-only admin-action log specific to egifts:

```
id            uuid PK
voucherId     uuid FK → eVouchers
adminUserId   varchar(128) FK → adminUsers
actionType    varchar(64)  -- 'cancel','refund','reissue','extend_expiry','release_to_recipient'
reason        text
beforeState   jsonb        -- snapshot of voucher state before action
afterState    jsonb        -- snapshot of voucher state after action
approvedBy    varchar(128) NULL  -- second admin for two-person rule
approvedAt    timestamp NULL
createdAt     timestamp DEFAULT NOW
```

Append-only by application convention. Phase 3 of the backup-retention architecture (DB triggers) would later enforce this at the database level.

### 3.4 Environment variable `EGIFT_VAT_MODE`

New runtime config (injected via GCP Secret Manager in `cloudrun-service.yaml`):

```
EGIFT_VAT_MODE = "disabled_pending_review"   // default
                | "purchase_vat"
                | "redemption_vat"
```

Read at app startup, exposed via a typed config object. Changing the value requires a Cloud Run revision deploy — there is no admin-UI toggle, because changing VAT mode mid-stream is an accounting event that must be timestamped and signed off.

---

## 4. UX presentation principles (luxury, compact, no tables)

The CEO's brief is explicit: minimal luxury presentation, clean spacing, strong black typography, pure white background, subtle metallic gold accents only.

### 4.1 Checkout summary block

**Recommended layout** (Mode A example — Mode C shows just the total line; Mode B shows similar with a "VAT applied at redemption" footnote):

The summary lives inline in the checkout flow, NOT a separate table. Three rows, each row is a flexbox with the label on the start side and the value on the end side. Hairline divider between rows. Total line is one weight heavier and uses a deeper ink tone.

Visual treatment to match Phase B atmosphere:
- Container: `bg-stage-white shadow-stage-soft rounded-[clamp(12px,1.5vw,16px)] p-editorial-md`.
- Each row: `flex justify-between items-baseline py-[clamp(8px,1.5vw,12px)]`.
- Row 1 label "קרדיט מתנה" / "Gift credit": `text-[12px] tracking-[0.2em] text-gold-luxe font-semibold uppercase`.
- Row 1 value "₪100": `text-[clamp(18px,2.4vw,24px)] font-light text-ink-900`.
- Row 2 label "מע״מ 18%" / "VAT 18%": same as Row 1 label.
- Row 2 value "₪18": `text-[clamp(16px,2.2vw,22px)] font-light text-ink-800` (slightly de-emphasized).
- 1px hairline rule `bg-ink-900/8` between rows 2 and 3.
- Row 3 label "סה״כ לתשלום" / "Total to pay": `text-[13px] tracking-[0.2em] text-ink-900 font-semibold`.
- Row 3 value "₪118": `text-[clamp(22px,3vw,32px)] font-light text-ink-900`.

No table headers, no zebra striping, no card-style emphasis on rows. Reads as a Cartier hospitality bill.

### 4.2 Recipient email VAT disclosure

If Mode A is selected, the recipient email continues to show only the **net gift credit** (e.g., "₪100 PetWash gift") — the recipient never sees VAT, because the VAT is the buyer's transaction with PetWash, not the recipient's. No change to the recipient email's emotional design.

If Mode B is selected, the recipient email includes a brief footnote at the bottom: "מע״מ ייחויב בעת מימוש השירות" / "VAT applies on service redemption". One line, small, not a banner.

### 4.3 Buyer confirmation email — added fields

Currently missing per audit: transaction ID, VAT, receipt number. After this proposal lands:

- Order ID (existing, possibly renamed).
- Transaction ID from Nayax (already stored in `eVouchers.nayaxTxId`).
- Date & time of purchase.
- Gross paid: ₪118 (Mode A) or ₪100 (Mode B/C).
- VAT amount: ₪18 (Mode A) or ₪0 (Mode B/C) with footnote.
- Usable gift credit: ₪100.
- Recipient name + masked email.
- Delivery status (queued / sent / delivered).
- Link to formal Israeli VAT invoice (חשבונית מס) when available — this requires the existing `pwTaxDocuments` flow to be wired to egift, which is a Phase 3 follow-up.

---

## 5. Ledger correctness requirements

For each gift card lifecycle event, the system must record a complete trail with these properties:

1. **Append-only.** Every state transition is an INSERT, never an UPDATE or DELETE of a prior ledger row.
2. **Hash-chained.** Every `egift_events` row carries `sha256Hash` chained to the previous row's hash (already implemented).
3. **Idempotent.** Every event has an `idempotencyKey` so retries cannot double-record (already implemented).
4. **Cross-ledger consistency.** A single ledger entry must exist in `egift_events`, with a corresponding `walletLedgerEntries` entry for any wallet movement, and an `eVoucherEvents` entry for any voucher state change. All three carry the same `referenceId` (the egift event id) so reconciliation is a simple join.

### 5.1 Required events per lifecycle stage

| Stage | egift_events.eventType | walletLedgerEntries.eventType | eVoucherEvents.eventType |
|---|---|---|---|
| Buyer click → server creates pending | `PURCHASE_INITIATED` | (none — no money moved yet) | (none — no voucher created yet) |
| Nayax payment authorized | `PAYMENT_AUTHORIZED` | (none) | (none) |
| Nayax payment confirmed | `PAYMENT_CONFIRMED` | `egift_purchase` (credit to platform liability) | (none) |
| Voucher issued | `VOUCHER_ISSUED` | (none) | `ISSUED` |
| Recipient delivery sent | `DELIVERY_SENT` | (none) | (none, but `eVouchers.deliveredAt` updated) |
| Recipient claims (first view) | `CLAIMED` | (none) | `CLAIMED` |
| Partial redemption | `PARTIAL_REDEEM` | `egift_redeem` (debit egift liability, credit service revenue) | `PARTIAL_REDEEM` |
| Full redemption | `REDEEMED` | `egift_redeem` (final tranche) | `REDEEMED` |
| Refund (Phase 4) | `REFUND_ISSUED` | `egift_refund` (debit revenue, credit buyer payment method) | `CANCELLED` |
| Admin cancellation (Phase 4) | `ADMIN_CANCELLED` | (none, or refund if applicable) | `CANCELLED` |
| Expiry (auto, scheduled job) | `EXPIRED` | `egift_expiry_writeoff` (only if accounting policy treats expiry as revenue recognition) | `EXPIRED` |

Notably, **REDEEMED today force-marks the whole voucher as redeemed even for partial redemption** (audit finding §1.7). Phase 3 fixes this by introducing the explicit `PARTIAL_REDEEM` flow.

### 5.2 Outstanding liability snapshot

A new daily reconciliation step computes:

```
outstanding_egift_liability_cents =
    SUM(eVouchers.remainingAmount * 100)
    WHERE status IN ('ACTIVE','CLAIMED','ISSUED')
      AND expiresAt > NOW()
```

This is written to a new `egift_liability_snapshots` table once per day. Phase 3 deliverable.

---

## 6. Fraud / audit protection

Existing strengths to preserve:

- `egift_events.sha256Hash` chain.
- `walletLedgerEntries.previousHash` + `entryHash` blockchain-style chain (`shared/schema.ts:11675-11750`).
- `auditLedger` daily Merkle snapshot (`server/backgroundJobs.ts:423`).
- Atomic SQL transactions wrapping voucher state + redemption.

Additions:

- **Daily integrity check job** verifies that `egift_events` hash chain has no breaks. Reuses the existing pattern from `auditLedger`. Alerts on regression.
- **Daily liability check** verifies that `SUM(remainingAmount for ACTIVE vouchers)` equals `walletLedgerEntries` net egift balance. Drift between the two is a P0 alert.
- **Per-event audit completeness check** verifies that for every `egift_events.eventType = 'REDEEMED'`, a corresponding `eVoucherRedemptions` row exists with the same `voucherId` and `amount`. Drift is a P1 alert.
- **Admin action audit:** all writes to `egift_admin_actions` are append-only, mirrored to `auditEvents` table for cross-system searchability.

---

## 7. Notification updates

### 7.1 Buyer confirmation email — fields to add

Current fields per audit: buyer email, buyer name, recipient name, gift value, currency, voucher ID, personal message, seasonal theme.

Add:
- Order ID (`eVouchers.id` short form).
- Transaction ID (`eVouchers.nayaxTxId`).
- Date & time (Asia/Jerusalem).
- Amount paid (gross).
- VAT amount + rate (or "VAT will apply at redemption" footnote for Mode B; or omit entirely for Mode C).
- Usable gift credit (net of VAT in Mode A; same as gross in B/C).
- Recipient (name + masked email).
- Delivery status with timestamp.
- Link to formal VAT invoice if available.

### 7.2 Recipient delivery email — fields to add

Current per audit: sender name, recipient name, amount, occasion emoji, QR code, serial number, expiry, eligible services list, wallet pass URLs.

Add:
- Sender's optional personal message (currently exists but not always included).
- Secure redemption link (HMAC-signed in Phase 2 — currently relies on UUID entropy + code hash).
- "How to redeem" inline instructions for non-QR paths.
- Optional: "VAT applies at redemption" footnote (Mode B only).

### 7.3 No reduction in elegance

Current recipient email is intentionally minimal and emotional (per `egiftEmailService.ts`). All additions must respect that aesthetic — they are footers and small print, not banners.

---

## 8. Refund and cancellation flow (currently missing — Phase 4)

The audit confirmed no refund or cancellation code exists for egifts. Proposed flow:

### 8.1 Refund request initiation

- Source 1: Buyer requests refund within a defined window (recommend 14 days from purchase, before any redemption). Admin reviews and decides.
- Source 2: Payment-processor chargeback notification (webhook from Nayax).
- Source 3: Admin-initiated for legitimate disputes / errors.

In all three cases, the refund is **not auto-executed**. It enters a `pending_refund` state in `egift_admin_actions` and requires admin approval.

### 8.2 Refund execution

For Mode A (purchase_vat) refund of an unredeemed card:
1. Insert `egift_events.eventType = 'REFUND_ISSUED'` with `amountCents = -100*100`, `vatCents = -18*100`, `grossCents = -118*100`.
2. Insert `walletLedgerEntries.eventType = 'egift_refund'` reversing the platform liability.
3. Update `eVouchers.status = 'CANCELLED'`.
4. Insert `eVoucherEvents.eventType = 'CANCELLED'`.
5. Insert `egift_admin_actions` row with `beforeState`, `afterState`, `approvedBy`, `approvedAt`.
6. Call Nayax refund API (if within the processor's refund window) OR queue a manual refund task.
7. Email both buyer and recipient about the cancellation.

For Mode B (redemption_vat) refund: same flow, but `vatCents` deltas are zero — no VAT was collected at purchase, so no VAT to reverse.

For Mode C: same as Mode B (no VAT to reverse).

### 8.3 Partial refund

Same as refund, but with `amountCents` proportional. Only applies to unredeemed or partially-redeemed cards.

### 8.4 Refund after partial redemption

Allowed in principle (refund the remaining balance) — same flow but `amountCents = remainingAmount * 100`, not the full initial amount.

### 8.5 Refund window enforcement

Configurable: `EGIFT_REFUND_WINDOW_DAYS` env var, default 14. Buyer-initiated refund requests outside the window are rejected unless admin override (two-person rule, Phase 4).

---

## 9. Admin tools (currently minimal — Phase 4)

Audit found only `GET /api/admin/wallet/orphan-egift-customers`. Phase 4 introduces:

- `GET /api/admin/egift/search` — filter by recipient email, sender email, voucher ID, status, date range.
- `GET /api/admin/egift/:voucherId` — full voucher detail with all ledger entries.
- `POST /api/admin/egift/:voucherId/cancel` — initiate cancellation. Records to `egift_admin_actions` with reason.
- `POST /api/admin/egift/:voucherId/refund` — initiate refund. Requires reason. Two-person approval (per backup-retention §3.6) before execution.
- `POST /api/admin/egift/:voucherId/reissue` — for cases where the recipient never received the email. Creates a new voucher, links it to the original, cancels the original.
- `POST /api/admin/egift/:voucherId/extend-expiry` — extends `expiresAt` with reason. Single-admin authority but full audit trail.

All routes require `requireAdmin` + step-up OTP (per backup-retention §3.6 once Phase 4 of that proposal ships).

---

## 10. Phased rollout

### Phase 1 — Foundation (1 day, no behavior change)

- Add `EGIFT_VAT_MODE` env var defaulting to `disabled_pending_review`.
- Add the seven new columns to `egift_events` (§3.1) and five new columns to `eVouchers` (§3.2) via Drizzle migration. All nullable / default 0.
- No code path reads the new columns or the env var yet.
- Verify: TSC clean, vitest passes, deploy preview renders identically.

### Phase 2 — Display + recording (2 days, default mode unchanged)

- Implement the three-row checkout summary (§4.1) — visible only when mode is `purchase_vat` or `redemption_vat`. Mode `disabled_pending_review` continues to show only the total.
- Wire `egift_events` writes to populate the new columns based on `EGIFT_VAT_MODE`.
- Add buyer email fields (§7.1) — non-VAT fields ship unconditionally; VAT fields gated on mode.
- Default mode stays `disabled_pending_review` until CPA sign-off.

### Phase 3 — Liability tracking + partial redemption (2 days)

- Add daily liability-snapshot job (§5.2).
- Add daily hash-chain integrity job (§6).
- Fix the partial-redemption bug in the redemption route (audit §1.7) — split into `PARTIAL_REDEEM` vs `REDEEMED` based on `remainingAmount` after the redemption.
- Reconciliation report extended to include outstanding egift liability.

### Phase 4 — Admin tools + refund flow (3 days)

- Add `egift_admin_actions` table (§3.3) and the six admin routes (§9).
- Implement refund flow (§8). Refund Mode A reverses VAT; Modes B/C don't.
- Two-person rule for refunds — depends on backup-retention §3.6 Phase 4 step-up OTP infrastructure.

### Phase 5 — CPA cutover (variable time, depends on CPA)

- CPA reviews modes A vs B.
- CEO + CPA jointly sign off on mode selection.
- Deploy with the chosen `EGIFT_VAT_MODE` value.
- Historical egift transactions remain in Mode C (cannot retroactively recompute VAT without explicit CPA approval of the methodology).

**Total estimated effort:** ~8 engineer-days across 4 implementation PRs (Phase 1-4), plus the CPA decision time (Phase 5) which is external.

---

## 11. Out of scope

- Gift card artwork.
- Hero atmosphere redesign (separate proposal in `EGIFT_LUXURY_ATMOSPHERE_REDESIGN.md`).
- Migration off Nayax to SUMIT or another processor.
- Changes to non-egift payment paths (booking, K9000, marketplace).
- Retroactive VAT computation on historical egift transactions (CPA decision only).
- Multi-currency support (currently ILS only; out of scope).
- Gift card issuance to non-Israeli buyers (out of scope; current flow assumes Israeli VAT).
- Replacing the existing three-ledger architecture (`eVouchers`, `egift_events`, `walletLedgerEntries`) with a unified ledger — out of scope; reconciliation is the right approach.

---

## 12. Decision points awaiting CEO + CPA input

A. **VAT mode selection.** CPA chooses between Mode A (`purchase_vat`) and Mode B (`redemption_vat`). Default `disabled_pending_review` stays until written sign-off.

B. **Refund window.** Default 14 days. CPA may have a different recommendation based on Israeli consumer law.

C. **Refund of expired vouchers.** Should an unredeemed expired voucher still be refundable on request, or is expiry final? Accounting and legal counsel weigh in.

D. **Two-person approval threshold.** For refund / cancellation of vouchers above what value should two-admin approval be mandatory? Recommend ₪500 default.

E. **Backfill historical data.** Should the new columns on `egift_events` and `eVouchers` be backfilled for past records (with Mode C / zero VAT values)? Recommend yes — backfill all historical rows with `vatMode = 'disabled_pending_review'`, `vatCents = 0`. This is non-destructive and gives reconciliation a complete dataset.

F. **Partial-redemption behavior.** The audit found that the current redemption route marks the full voucher REDEEMED on first use, regardless of amount used. Confirm intent: should ₪100 cards behave as "single-use voucher" (current) or "stored-value balance" (proposed Phase 3 fix)? They're different products with different legal treatment.

G. **HMAC-signing redemption links.** Phase 2 add, or defer? Default: defer to Phase 4 unless there's a security concern flagged by the audit.

---

## 13. References

Primary sources cited in this proposal:

- `client/src/pages/EGift.tsx:537-541, 754-795` — frontend denomination + purchase trigger.
- `server/lib/egift-denominations.ts:18, 26-44` — backend denomination source of truth.
- `server/routes/gift-cards.ts:331-412, 414-550` — purchase + redemption routes.
- `server/nayaxService.ts:79-200` — payment processor integration.
- `server/services/EgiftFinancialService.ts:83-264, 296-592` — egift ledger writes.
- `server/services/egiftEmailService.ts:52-348` — recipient email.
- `server/services/IsraeliVATReclaimService.ts` — VAT framework.
- `server/services/FinancialReconciliationService.ts:128-1000+` — monthly reconciliation.
- `shared/schema.ts` — eVouchers, eVoucherRedemptions, eVoucherEvents, walletLedgerEntries.
- `shared/schema-payments.ts:58, 66, 68, 205-271` — pwPayments, pwTaxDocuments.
- `shared/israel-compliance-config.ts:30, 75-88, 103-114, 139, 159-167` — VAT rate, agent model, Osek Patur policy, withholding.
- `server/services/TransactionEngine.ts:72` — `vatMode = 'deferred_liability'` declared intent.
- `server/backgroundJobs.ts:224, 423` — monthly reconciliation, daily Merkle snapshot.

Israeli legal references:

- VAT Law 5736-1975 — https://www.icnl.org/wp-content/uploads/Israel_vat1975.pdf
- Income Tax Ordinance 5721-1961 — https://www.icnl.org/wp-content/uploads/Israel_Ordinance.pdf
- ITA circular January 2025 — VAT rate 18% (referenced in `shared/israel-compliance-config.ts:30`).

---

**End of audit and proposal. No code, no schema, no infrastructure changed. Awaiting CEO + CPA review and decisions A through G.**
