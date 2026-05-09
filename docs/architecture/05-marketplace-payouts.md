# 05 — Marketplace Payout Architecture

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Part 4 (Provider Commission & Payouts), Part 8 (Escrow / Booking Money Flow).

---

## 1. Objective

Define the end-to-end payout pipeline from "booking completed" to "money in provider bank account" — including escrow release timing, dispute freezes, withholding tax, statement generation, fraud controls, and failed-payout recovery.

The forensic audit's most-dangerous finding (#4) was: **marketplace provider payout is a NOOP today** (`NayaxSitterMarketplaceService.processSitterPayout` only logs; walk-my-pet has no payout call at all). Every provider statement to date overstates payouts. PR-J fixed customer-side wallet verification; this section is what closes the provider-side payout truth.

---

## 2. Current state

| Surface | Today |
|---|---|
| Sitter payout call | `server/services/NayaxSitterMarketplaceService.ts:151-185` — logs only, no money moves |
| Walker payout call | NONE wired |
| Withholding tax (`ניכוי מס במקור`) | Recorded in `IsraeliDigitalReceiptService.recordProviderSettlement`; not actually withheld at payout time (no payout exists) |
| Commission split | Hardcoded 7.5% at `routes/sitter-suite.ts` complete handler (audit flagged: should be 15% per `VERTICAL_CONFIG`) |
| Escrow | `escrow_payments` (Firestore) + `escrow_holdings` (Postgres) — two parallel stores, no reconciliation; `SitterAdvancedBookingEngine.moveToEscrow()` is a `logger.info` line (audit finding #9) |
| Dispute freeze | NONE — chat-flagged disputes don't freeze payout |
| Bank-side outbound | NONE — no Masav file generation, no Mizrahi-Tefahot API call |
| Loyalty discount handling | Pro-rata reduces provider payout (`BaseLuxuryBookingEngine.ts:160-182`) — illegal under Provider Master Agreement (audit finding #7) |
| Provider statement (חשבונית) | NONE generated |
| Failed-payout recovery | NONE — no retry / no manual queue |

---

## 3. Target architecture

### 3.1 Lifecycle states (booking → payout)

```
booking.confirmed
        ↓
[customer pays]
        ↓
booking.paid               ← funds in trust at bank (Section 04 invoice issued)
        ↓
[service completed]
        ↓
booking.completed          ← P&L revenue recognised (Part 0.2.1)
        ↓
[release window elapses]   ← typically 24h hold (Part 8.3 dispute window)
        ↓
booking.eligible_for_payout
        ↓
[batched into next payout window]
        ↓
payout_batch.queued
        ↓
[batch executed via Masav file]
        ↓
payout_batch.executed
        ↓
[bank confirms]
        ↓
payout_batch.settled       ← terminal happy path
─────────────────────────────────────────
   ↓ (alternate paths)
booking.disputed           ← freezes payout for the booking
booking.refunded           ← refund flow runs; payout cancelled or clawed back
payout_batch.failed        ← bank rejected; retry policy fires
payout_batch.partial       ← some line items succeeded, some didn't
```

### 3.2 Per-vertical commission split (single source of truth)

Already defined in `server/services/TransactionEngine.ts:VERTICAL_CONFIG`. Payout pipeline must read from this constant — never inline a percentage.

| Vertical | Commission | Provider net | Notes |
|---|---|---|---|
| sitter-suite | 15% | 85% | Bug today: hardcoded 7.5% — fixes via PR-PAYOUT-3 |
| walk-my-pet | 15% | 85% | |
| pettrek | 15% | 85% | |
| pet-wash-hub | 15% | 85% | |
| paw-finder | 15% | 85% | |
| plush-lab | 15% | 85% | |

K9000 = principal sale, no commission (Pet Wash is the seller).

### 3.3 Loyalty discount → provider payout (legal stance)

Per Part 0.2.4 / Provider Master Agreement clause:

- **Customer-facing discount** is funded by Pet Wash (marketing expense)
- **Provider receives full service price net of platform fee**, NOT the discounted amount
- Today's pro-rata reduction is illegal under the agreement clause and must be removed

Worked example:
- Provider price: ₪100, commission 15% → provider net would be ₪85 / Pet Wash fee ₪15
- Customer has loyalty 20% discount: customer pays ₪80
- Provider STILL receives ₪85 (full net)
- Pet Wash absorbs ₪5 (the discount above commission) as marketing expense
- Pet Wash net: ₪15 fee − ₪5 discount funding = ₪10 (not ₪10.5 if pro-rata applied)

### 3.4 Withholding tax (`ניכוי מס במקור`)

Provider tax-status snapshot (Part 1.5) determines withholding rate at payout time, not at booking time. Snapshot captured on first payout per provider; immutable thereafter.

| Provider tax status | Withholding |
|---|---|
| `osek_morsheh` (authorised) with valid certificate | per certificate (often 0% or low rate) |
| `osek_morsheh` without certificate on file | default rate per Tax Authority directive |
| `osek_patur` (exempt) | per Tax Authority schedule (typically applies above threshold) |
| Foreign provider | out of scope v1 |

Withheld amount goes to a separate `withholding_payable` ledger account; remitted monthly to the Tax Authority.

### 3.5 Payout batching

- Daily? Weekly? CFO + CEO decide (Open Q below).
- Each batch: Masav file (semicolon-delimited, English headers, no BOM — Mizrahi-Tefahot format already documented in `routes/prestige-pass.ts:6866`) submitted to bank.
- Each line item: provider id, gross, withholding, net, IBAN/account ref (encrypted via `TreasuryConfigService` pattern).
- Confirmation: bank returns success / partial / failure per line; we mark per-line state.

### 3.6 Dispute freeze

When a chat dispute is opened (existing `booking-chat.ts` infrastructure), the corresponding booking flips to `disputed` state which:

1. Blocks the `eligible_for_payout` transition for that booking
2. Holds the trust funds in `wallet.escrow_pending` (per Section 02 bucket)
3. Surfaces in admin dispute queue
4. Releases when admin resolves (in favour of customer → refund, in favour of provider → payout proceeds)

### 3.7 Provider statement

A statement is a tax-document-class document (Section 04) issued per provider per period. Format includes:
- Per-booking line item: gross, fee, net
- Discount funding from Pet Wash (where applicable)
- Withholding amount
- Net to bank
- Period totals
- Bank reference (Masav batch id)

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| Payout pipeline literally doesn't move money | critical |
| No Masav file generator | critical |
| No bank-side reconciliation | critical |
| Loyalty pro-rata bug | high (illegal under PMA) |
| Hardcoded 7.5% commission at sitter `/complete` | high (truth divergence from `VERTICAL_CONFIG`) |
| Two escrow stores (Firestore + Postgres) with no reconciliation | high |
| `moveToEscrow()` is a log line | high |
| No dispute freeze | high |
| No provider statement document | high |
| No failed-payout retry | medium |
| No fraud controls on payout (e.g. velocity caps, KYC re-check) | high |
| Provider tax-status snapshot table not implemented | medium (Part 1.5) |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- Lifecycle state machine (Section 3.1) implemented end-to-end
- `VERTICAL_CONFIG` becomes the single source for commission rates (close hardcoded-7.5% bug)
- Loyalty pro-rata fix (provider gets full net regardless of customer discount; Pet Wash absorbs)
- Provider tax-status snapshot table (Part 1.5)
- Withholding ledger account (`withholding_payable`)
- Daily / weekly Masav batch generator (cadence per CEO decision)
- Bank API integration via existing `enterprise/mizrahiBank.ts` pattern (read-only initially; write enabled once tested)
- Per-batch reconciliation
- Provider statement document (Section 04 class)
- Dispute-freeze gate
- Escrow consolidation: pick ONE escrow store (Postgres recommended for joinability) — separate spec PR for the Firestore→Postgres consolidation

**Deferred scope:**
- Push notifications to providers on payout settled
- Provider portal for statement download (UX, separate)
- Alternative bank rails (Bit, Paybox, foreign banks)
- Foreign provider tax handling

---

## 6. Legal / regulatory / financial assumptions

- Pet Wash holds provider funds in trust between booking-paid and payout-settled (Part 0.4 trust custody).
- Provider Master Agreement governs commission rate, payout cadence, withholding handling, dispute hold rights, clawback rules.
- Withholding rate per provider per snapshot per Tax Authority directive in force at the time.
- Masav file format = Mizrahi-Tefahot semicolon CSV (already documented in code; reuse).
- Bank reconciliation must tie per-batch-line outcomes to ledger entries.

---

## 7. Open questions for human decision

1. **Payout cadence** — daily / weekly / monthly? CEO + CFO decide. Daily likely best for v1 trust but operationally heaviest.
2. **Dispute hold default** — 24h auto-release window post-completion? Or longer for first-time providers?
3. **Withholding default rate** — when no certificate is on file (Part 0.7.3 open question).
4. **First-payout KYC re-verification** — required before first money outbound?
5. **Velocity caps** — max payout per provider per period (anti-fraud)?
6. **Clawback rule for chargebacks received post-payout** — offset next payout or invoice the provider directly? Counsel recommendation.
7. **Escrow consolidation** — Postgres only, with Firestore as a deprecated mirror? (Recommend yes.)

---

## 8. Dependency graph

**This section blocks:**
- Live marketplace launch (no live marketplace until provider payouts work)
- Section 04 (Israeli compliance) — provider statements consume the document classes there
- Section 09 (fraud) — payout-side fraud controls

**This section is blocked by:**
- Section 01 (PaymentProvider adapter) — payouts route through adapter
- Section 02 (wallet bucket separation) — `wallet.escrow_pending` bucket needed
- Section 03 (Nayax reconciliation) — settlement must be reconciled before payout releases (otherwise we pay providers from unsettled funds)
- Section 04 (compliance) — provider statement format
- Provider Master Agreement signed
- Bank Masav write access (Mizrahi-Tefahot) provisioned
- Trust account separation operational at bank (Part 0.4.2)
- Provider tax-status snapshot table (Part 1.5)

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Payout fires before settlement reconciled | Pay providers from non-existent funds | State machine gate: `eligible_for_payout` requires `nayax_settlement_match.matched=true` for the funding txn |
| Loyalty pro-rata regresses | Provider underpaid | Source-pin test on `BaseLuxuryBookingEngine.ts` payout calculation; integration test pins worked example |
| Wrong commission rate | Provider over/under-paid | Source-pin test asserts every payout reads from `VERTICAL_CONFIG`; no inline percentages allowed |
| Masav file rejected by bank | Batch fails wholesale | Per-line state tracking; per-line retry; manual review queue if same line fails twice |
| Withholding rate wrong | Tax filing wrong | Snapshot at payout time + CPA monthly review |
| Dispute opened post-payout | Money out, no clawback | Clawback policy (Open Q above) + provider agreement clause |
| Escrow drift between Firestore + Postgres | Customer or provider sees different balance | Consolidate to single store + reconciliation alert during transition |
| `moveToEscrow` no-ops silently | Funds appear "released" but never actually held | Source-pin test that the function call site invokes a real DB write; integration test on the escrow-bucket balance |

---

## 10. Reconciliation strategy

- Per-batch: bank confirmation file → per-line success / failure → ledger update.
- Per-day: sum(payouts executed) == sum(masav file lines).
- Per-week: per-provider statement total == sum(individual booking nets) == sum(payouts received by provider).
- Per-month: trust account opening + customer payments − refunds − payouts == trust account closing balance (bank statement).
- Per-quarter: withholding remitted to Tax Authority == sum(`withholding_payable` debits).

---

## 11. Rollback / offset strategy

- Wrong payout sent → corrective debit (clawback) on next batch + offsetting ledger entry. Never edit the original payout row.
- Wrong commission rate → corrective adjustment per Provider Statement, with paired credit-note / debit-note. CPA approval per case.
- Loyalty pro-rata regression caught in production → emergency rollback of the offending PR; corrective adjustment per under-paid provider.
- Bank API rollback: kill switch (Part 10.5) freezes all outbound.

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-PAYOUT-SPEC` | This document | spec |
| `PR-PAYOUT-1` | Provider tax-status snapshot table + capture-on-onboarding flow (Part 1.5) | schema-migration + runtime |
| `PR-PAYOUT-2` | Lifecycle state machine schema (eligible_for_payout / payout_batch states) | schema-migration |
| `PR-PAYOUT-3` | Hardcoded-rate fix at sitter `/complete` (read from `VERTICAL_CONFIG`) | runtime (small, fast) |
| `PR-PAYOUT-4` | Loyalty pro-rata fix at `BaseLuxuryBookingEngine` (provider gets full net) | runtime |
| `PR-PAYOUT-5` | Escrow consolidation: Firestore → Postgres deprecation; single-store invariant | schema-migration + runtime |
| `PR-PAYOUT-6` | Dispute freeze gate | runtime |
| `PR-PAYOUT-7` | Withholding ledger account + monthly remittance helper | runtime |
| `PR-PAYOUT-8` | Masav batch generator (writes file; bank submission gated OFF) | runtime |
| `PR-PAYOUT-9` | Bank submission cutover (gated ON via env flag; CEO approval) | runtime + Ops |
| `PR-PAYOUT-10` | Per-batch reconciliation + alert | runtime |
| `PR-PAYOUT-11` | Provider statement document generation (consumes Section 04) | runtime |
| `PR-PAYOUT-12` | Failed-payout retry + manual review queue | runtime |
| `PR-PAYOUT-13` | Velocity caps + first-payout KYC gate (consumes Section 09) | runtime + Sec |

Each carries the full 12-field metadata.
