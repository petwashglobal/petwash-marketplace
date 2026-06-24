# SDD — K9000 Dual-Bay Closed-Loop Pre-Paid Non-Cash Redemption

**Status:** Draft for green-light review
**Author:** SDD Writer Agent (on behalf of Nir Hadad, CEO)
**Date:** 2026-06-25
**Path:** `docs/design/2026-06-25-k9000-closedloop-prepaid-redemption.md`
**Supersedes / extends:** `docs/design/2026-05-22-petwash-pass-k9000-redemption.md`

> Scope: the "₪0-to-card" closed-loop pre-paid redemption rail at the physical
> K9000 2.0 Twin station. Nayax DOT/Cortina at the machine edge, SUMIT/UPay for
> checkout + Israeli bookkeeping documents, PetWash backend as system of record.
> Legally structured for Israel as **prepaid wash entitlements** in Phase 1.

---

## 1. Executive summary

The CEO's master plan (Appendix A, verbatim) is sound and we adopt ~90% of it.
This document does four things on top of it:

1. **Reconciles the plan to what is already shipped.** Two pieces of the rail
   are already in the tree behind dark flags: SUMIT checkout +
   `PurchaseActivationService` (#1041) and the Nayax Cortina payment-method
   webhooks (#1042, `server/routes/nayax-cortina.ts`). The redemption engine
   `authorizeRedemption()` (`server/services/K9000RedemptionService.ts`) already
   does atomic debit + bay-session open + audit-hash. We do **not** rebuild
   these; we add the missing **reservation stage**, the **completion signal**,
   the **reconciliation engine**, and the **caps/legal envelope**.

2. **Makes the Cortina-vs-Spark decision** (Caution #1): **Cortina StaticQR +
   our-ledger Settlement is the primary rail; Spark Remote Start is the
   documented fallback.** Justification in §6.

3. **Resolves the completion-signal gap** (Caution #2): the K9000 emits no
   "wash finished" webhook, and — critically — the Nayax `Settlement` webhook
   confirms a *vend dispense*, **not** a *wash completion*. We therefore split
   "commit money" (driven by Settlement) from "release the bay" (driven by a
   **deterministic server-side duration timer + heartbeat**, never by a signal
   the hardware cannot produce). This is the single most important correction to
   the plan's clean state machine. See §5.

4. **Locks the legal posture** (Caution #3): Phase 1 ships **prepaid wash
   entitlements** (a right to N washes), which is a *deferred-revenue* obligation
   to deliver a service, **not** stored monetary value. This sits further outside
   the ISA non-bank payment-services perimeter than even a capped wallet, because
   it is non-redeemable for cash *by construction* (there is no money balance to
   redeem). The 2026 ISA exemption envelope (ILS 1,500 unidentified / 3,000
   identified) is the planning ceiling for the **Phase-2 wallet**, not for
   Phase-1 entitlements. See §9.

**One-line recommendation:** ship the **reservation stage + commit/release split
+ reconciliation skeleton** as the first PR, on top of the already-merged
#1041/#1042, with everything dark behind `NAYAX_CORTINA_ENABLED` until Nayax
sandbox confirms the Cortina Settlement contract.

---

## 2. Grounding — what exists today (cited)

| Concern | File / location | State |
|---|---|---|
| Flow B redemption engine (atomic debit + session + audit hash) | `server/services/K9000RedemptionService.ts:131` `authorizeRedemption()` | **Live** (behind callers) |
| Bay lookup by station+side | `K9000RedemptionService.ts:237` `findBay()` | Live |
| Bay session open (marks busy) | `K9000RedemptionService.ts:325` `openBaySession()` | Live |
| Bay session close (resets ready) | `K9000RedemptionService.ts:381` `closeBaySession()` | **Live but never called by a completion signal** |
| 30-sec cleanup grace window | `K9000RedemptionService.ts:444` `enterCleanupPhase()` / `:530` `finalizeCleanup()` / `:613` `registerCleanupRecovery()` | Live but unwired |
| Auto-compensation (START_PUMP no-ACK → refund) | `K9000RedemptionService.ts:1098` `autoCompensateSession()` | Live, idempotent (guards double-refund at `:1125`) |
| Velocity anti-fraud (3/hr) | `K9000RedemptionService.ts:85`, `:192` | Live |
| Nayax Cortina payment-method webhooks | `server/routes/nayax-cortina.ts` (`/authorize`, `/settlement`) | **Dark** behind `NAYAX_CORTINA_ENABLED` |
| Per-bay Nayax IDs | `shared/schema.ts:1014` `nayaxTerminalId`, `:1015` `nayaxQrReaderId`; unique `uq_station_side` `:1052` | Live |
| Bay/session schema + lifecycle states | `shared/schema.ts:1001` (`station_bays`), `:1074` (`bay_sessions`) | Live |
| SUMIT hosted checkout (server-owned catalog, no client price) | `server/routes/payments-sumit.ts:44` `PHASE1_PRODUCTS`, `:88` `/begin` | Live (flag-gated) |
| Purchase → fulfilment switch (wash/package/credit/egift) | `PurchaseActivationService.activateProduct` (#1041) | Live |
| eGift moved off Nayax onto SUMIT | #1041 | Done |
| Coupons (validate + redeemAtomic + abuse-gate + unique-per-user) | `server/services/CouponService.ts`, migration 0075 (#1035) | Live |
| Spark remote-start service (fallback target) | `server/services/NayaxSparkService.ts` | Present, `executeRemoteVend` exists |

### 2.1 Inconsistencies found while grounding (must fix)

1. **Redemption-type literal drift.** The engine type union is
   `wash_package | wallet_balance | gift_credit | loyalty_benefit | promo_coupon`
   (`K9000RedemptionService.ts:62`), but the Cortina route's `pickRedemptionType()`
   returns `'wash_package' | 'egift' | 'cash'` (`nayax-cortina.ts:53-60`) and
   passes them straight into `authorizeRedemption()`. `'egift'`/`'cash'` are **not
   valid engine literals** — `validateBalance`/`creditTypeForRedemption` will mis-map
   or throw. **This is a live bug behind the flag.** Fix: one shared mapping
   (`'egift' → 'gift_credit'`, `'cash' → 'wallet_balance'`) in a single helper,
   covered by a test. *(Change to the plan: the plan assumed the route was final;
   it is not.)*

2. **`closeBaySession()` is dead.** Nothing calls it on a real completion
   because no completion signal exists. Bays hang `busy`. Resolved in §5.

3. **Settlement currently *creates* the debit AND the session in one webhook
   call** (`nayax-cortina.ts:122`). That collapses reserve+commit into one step,
   so there is no reservation to release if Settlement is replayed or arrives
   late. Resolved by the reservation stage in §5.

---

## 3. The four separated concerns (adopted from the plan, mapped to our code)

The plan's core architectural insight — separate **identity / entitlement
balance / vend-authorisation / bookkeeping documents** — is correct and already
half-realised. Mapping:

| Concern | Owner | Our implementation |
|---|---|---|
| Customer identity | PetWash | Firebase UID; HMAC `passLinkToken` (`server/lib/passTokens.ts`) carries `userId` into the QR |
| Entitlement / stored value balance | PetWash (system of record) | `wallet_accounts` columns: `washPackageCredits` (entitlement, Phase 1), `cashWalletBalanceCents` / `egiftBalanceCents` / `promoBalanceCents` (stored value, Phase 2+) |
| Machine vend-authorisation | Nayax cloud + PetWash | Cortina `/authorize` + `/settlement`; PetWash answers `Approved/Declined` |
| Israeli bookkeeping documents | SUMIT (registered ITA software) | SUMIT issues חשבונית/קבלה on the **purchase** (top-up / package buy), per the document-policy matrix in §8 |

**Key money-flow invariant (unchanged from the plan, restated for clarity):**
the fiscal document is issued at **purchase** (SUMIT, online), **not** at
**redemption** (Cortina, at the machine). Redemption only *consumes* an
already-paid entitlement and so issues **no card charge and no new tax invoice** —
at most an internal delivery/consumption record. This is exactly the closed-loop
property that keeps redemption outside the payment-services perimeter.

---

## 4. Device-ID model (adopted; concrete column mapping)

The plan's site/station/bay/asset/serial/device hierarchy maps onto existing
columns; no new identity table is required for Phase 1:

```
Site            → kioskMachines.kioskId (station = site unit, 1 cabinet)
Station         → kioskMachines.kioskId
Bay             → station_bays.id  (the REDEMPTION UNIT — per the plan)
  side          → station_bays.side  ('left'|'right'), unique per station (uq_station_side)
  K9000 asset   → station_bays.stationCode (e.g. K9000-TLV-001) + (NEW) k9000AssetSerial
  Nayax device  → station_bays.nayaxTerminalId  (VPOS/ONYX terminal)
  DOT QR reader → station_bays.nayaxQrReaderId
  Merchant      → (NEW) station_bays.nayaxMerchantId  (Cortina integrator/merchant)
```

**The bay is the redemption unit** — confirmed and already enforced by
`uq_station_side` and `resolveBay(terminalId)` (`nayax-cortina.ts:41`).

---

## 5. The improved state machine (Cautions #1 & #2 resolved)

### 5.1 Why the plan's clean machine cannot run as-is

The plan's lifecycle is
`issued → presented → reserved → authorised → committed → released → exception`,
with "commit ONLY on positive vend evidence" and "release on completion". Two
hardware facts break the last two transitions:

- **There is no wash-completion webhook.** The K9000 2.0 Twin is a Nayax-MDB
  vending unit with no exposed completion telemetry (MEMORY: *K9000 hardware
  reality*). It cannot tell us the wash *finished*.
- **The Nayax `Settlement` webhook confirms a vend *dispense*, not a wash
  *completion*.** Nayax docs: Settlement "notifies integrators when a product
  has been vended on the device … to initiate the settlement process" — and the
  docs explicitly do **not** assert device-side completion verification
  ([Nayax StaticQR Settlement](https://devzone.nayax.com/docs/static-qr-settlement)).
  For a wash, "vended" means "the wash time was granted and the pumps were
  armed", i.e. the *start*, not the *end*.

**Resolution — split COMMIT from RELEASE:**

- **COMMIT (money)** is driven by the **Cortina `Settlement` webhook** =
  positive vend evidence = the wash was granted. This is the moment we debit the
  entitlement. Correct and honest: the customer received the thing they paid for
  (wash time).
- **RELEASE (bay availability)** is driven by a **deterministic server-side
  duration timer** (paid wash seconds + the 30-sec grace window), reconciled
  against **heartbeat freshness** (`station_bays.lastHeartbeat`,
  `BAY_HEARTBEAT_STALE_SECONDS=180`, `K9000RedemptionService.ts:248`). We never
  wait for a completion signal the hardware cannot send.

This is the **TCC (Try-Confirm-Cancel)** pattern, which 2025-2026 distributed-
transaction guidance recommends precisely for reservation-based vend flows
([AWS saga choreography](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-choreography.html),
[Temporal saga guide](https://temporal.io/blog/mastering-saga-patterns-for-distributed-transactions-in-microservices)).
Try = reserve; Confirm = commit on Settlement; Cancel = release/compensate on
timeout. Every step is idempotent.

### 5.2 The state machine (final)

```
                 ┌──────────── issue (purchase via SUMIT) ────────────┐
                 ▼                                                     │
  ENTITLEMENT: washPackageCredits += N   (deferred revenue liability) │
                 │                                                     │
   customer scans bay QR (passLinkToken, 30–120s, nonce, bay-bound)   │
                 ▼                                                     │
  ┌─ Cortina /authorize ──────────────────────────────────────────┐  │
  │ resolveBay(terminalId) → (station, side)                       │  │
  │ verify token → userId; pickRedemptionType(userId)             │  │
  │ bay.status == 'ready' ?  AND  no active reservation on bay ?   │  │
  │ velocity OK ?  entitlement >= 1 ?                              │  │
  │   → create RESERVATION row (status='reserved', TTL 120s)       │  │  Cancel path:
  │   → answer Approved   (NO debit yet)                           │  │  reservation TTL
  └───────────────────────────────────────────────────────────────┘  │  expires (no
                 │ Nayax arms the vend                                 │  Settlement) →
                 ▼                                                     │  release bay,
  ┌─ Cortina /settlement (POSITIVE VEND EVIDENCE) ────────────────┐   │  reservation
  │ idempotency_key = token+terminalId+nayaxTransactionId         │   │  → 'expired'
  │ load reservation; if already 'committed' → return Approved    │   │  (no money moved)
  │ ATOMIC:  debit entitlement  +  reservation→'committed'         │   │
  │          +  openBaySession(status='active')  +  audit hash    │   │
  │   → answer Approved (Status.Verdict)                          │   │
  │   if entitlement gone / bay race → Declined+code (no debit)   │───┘
  └───────────────────────────────────────────────────────────────┘
                 │ wash runs (expectedDurationSeconds)
                 ▼
  ┌─ RELEASE (deterministic, server-driven — NOT a hardware signal) ─┐
  │ scheduled at activatedAt + paidSeconds → enterCleanupPhase()     │
  │ + 30s grace → finalizeCleanup() → closeBaySession('completed')   │
  │ bay → 'ready'.  Recovery: registerCleanupRecovery() on boot.     │
  └──────────────────────────────────────────────────────────────────┘

  EXCEPTION paths:
   - Settlement never arrives within reservation TTL  → reservation 'expired',
     bay released, NO debit (money never moved — nothing to compensate).
   - Settlement arrives, debit done, but START_PUMP/vend later fails to arm
     → autoCompensateSession() reverses the debit (idempotent, :1098).
   - heartbeat stale > 180s during 'active' → fault detector flags bay; bay
     auto-released after max-duration ceiling so it can never hang 'busy'.
```

### 5.3 Why a reservation stage (vs the current one-shot Settlement debit)

Today Settlement both debits and opens the session in one call
(`nayax-cortina.ts:122`). Problems: (a) a **replayed** Settlement double-debits;
(b) a **late** Settlement can debit after the bay was already reused; (c) there is
no record of the *intent* to redeem if Settlement never arrives. The reservation
row fixes all three:

- **Idempotency:** Settlement is keyed on `idempotency_key`
  (`token+terminalId+nayaxTransactionId`); a second Settlement finds the
  reservation already `committed` and returns `Approved` **without** re-debiting.
  This mirrors the auto-compensation idempotency already proven at
  `K9000RedemptionService.ts:1125`.
- **One active reservation per instrument per bay:** a partial unique index
  enforces "no dual-bay racing" — exactly the plan's requirement.
- **Honest late-arrival handling:** if Settlement is late and the reservation
  already `expired`, we decline (code 6) — Nayax must not report a paid wash.

---

## 6. Cortina vs Spark — the decision (Caution #1)

**Decision: Cortina StaticQR + our-ledger Settlement is PRIMARY. Spark Remote
Start is the documented FALLBACK.**

### Rationale

| Dimension | Cortina StaticQR (PRIMARY) | Spark Remote Start (FALLBACK) |
|---|---|---|
| Who initiates the vend | Customer scans the bay's static DOT QR; Nayax cloud calls **us** to authorise, then to settle | **We** call Nayax server-to-server (`StartSession`/`TriggerTransaction`) to arm the machine |
| "₪0-to-card" closed loop | **Native** — we are registered as the Cortina *payment method*; Settlement debits **our** ledger, the card is never charged | Possible but we own the start trigger and must reconcile our own initiated vends |
| Already built | **Yes** — `nayax-cortina.ts` (#1042) + per-bay `nayaxTerminalId`/`nayaxQrReaderId` | `NayaxSparkService.executeRemoteVend` exists but is wired for the card-pay flow |
| Failure surface | Nayax owns the device handshake; we only answer Approved/Declined | We own retry/void/cancel lifecycle (`CancelTransaction`) and the network round-trip to the device |
| Device support | VPOS/ONYX, MDB level-3, **PreSelection Enabled = Yes** ([remote-vend docs](https://devzone.nayax.com/docs/cortina/staticqr/remote-vend)) | VPOS/ONYX, server-to-server activation |
| Static QR on the bay | One printed sticker per bay (no screen needed) | Needs an app-driven start UX |

**Why Cortina wins for us:** the closed-loop "already-paid, free-at-machine"
model *is* the Cortina payment-method model — Settlement-against-our-ledger is the
zero-cost vend by design, and it is already coded. The DOT reader being
input-only is fine: we never need the reader to start a vend; Nayax cloud does,
and asks us. Spark would force us to own the start trigger and a second
reconciliation surface for no closed-loop benefit.

**Why keep Spark as fallback:** if Nayax sandbox reveals that registering
PetWash as a Cortina payment method is not available on our merchant tier, or the
Settlement-decides-debit contract isn't supported, Spark Remote Start
(`StartSession → TriggerTransaction → Settlement/Cancel`) is the proven
server-to-server alternative, and we already have the service skeleton. The state
machine in §5 is **rail-agnostic**: reserve/commit/release map onto Spark's
`StartSession`/`Transaction`/`Stop`+`Timeout` webhooks unchanged.

**Hard dependency (CEO/Nayax-ops):** Nayax must confirm in sandbox (a) PetWash as
a Cortina payment method, (b) `PreSelection Enabled = Yes` per bay, (c) the exact
`Settlement` request fields and the `Status.Verdict`/`Code` response contract, and
(d) **which side fired** (per-bay TerminalId resolution — already handled by
`resolveBay`). Until then, everything stays dark behind `NAYAX_CORTINA_ENABLED`.

---

## 7. Data-model deltas (vs current schema)

All additive. Migration numbering continues from 0075 (#1035).

### 7.1 NEW table — `k9000_redemption_reservations`

The reservation stage (TCC "Try" record). This is the one genuinely new table.

```
k9000_redemption_reservations
  id                 varchar pk (uuid)
  reservation_ref    varchar unique         -- e.g. RES-<ts>-<nanoid>
  user_id            varchar not null        -- FK users.id (from verified token)
  bay_id             varchar not null        -- FK station_bays.id
  station_id         varchar not null        -- denormalized
  side               varchar(5) not null
  redemption_type    varchar(20) not null    -- CANONICAL engine literal (wash_package|...)
  idempotency_key    varchar not null        -- token + terminalId + nayaxTransactionId
  nayax_terminal_id  varchar
  nayax_transaction_id varchar               -- echoed from Settlement when present
  status             varchar(16) not null default 'reserved'
                       -- reserved | committed | expired | cancelled
  session_id         varchar                 -- FK bay_sessions.id, set on commit
  expires_at         timestamp not null      -- created_at + RESERVATION_TTL (120s)
  committed_at       timestamp
  created_at         timestamp default now()
  updated_at         timestamp default now()

INDEXES / CONSTRAINTS:
  unique (idempotency_key)                                  -- exactly-once Settlement
  partial unique (bay_id) where status='reserved'           -- ONE active reservation per bay
  partial unique (user_id, station_id) where status='reserved' -- one per instrument per station
  index (status, expires_at)                                -- TTL sweep
```

The two **partial unique indexes** are the plan's "one active reservation per
instrument per station AND per bay" — enforced in the database, not in code.

### 7.2 ALTER `station_bays` (device-ID completeness)

```
+ k9000_asset_serial   varchar      -- physical K9000 unit serial (audit/asset)
+ nayax_merchant_id     varchar      -- Cortina integrator/merchant id
+ max_wash_seconds      integer default 600  -- ceiling that forces RELEASE (anti-hang)
```

### 7.3 ALTER `bay_sessions` (commit linkage)

```
+ reservation_ref      varchar      -- FK k9000_redemption_reservations.reservation_ref
+ commit_source        varchar(16)  -- 'cortina_settlement' | 'spark_transaction' | 'manual'
```
(`status` already has the full lifecycle at `schema.ts:1114`; no change needed.)

### 7.4 NEW table — `k9000_reconciliation_breaks` (recon exception queue, §8)

```
k9000_reconciliation_breaks
  id, recon_date, break_type, bay_id, station_id,
  nayax_ref, petwash_session_id, sumit_doc_id,
  expected_json, observed_json, severity, status (open|resolved|accepted),
  resolved_by, resolved_at, created_at
  index (recon_date, status)
```

### 7.5 No change to instrument storage

Phase-1 entitlements use the existing `wallet_accounts.washPackageCredits`
(integer units). **No money column is touched at redemption** for entitlements,
which is the legal crux (§9). Phase-2 stored value reuses the existing
`cashWalletBalanceCents`/`egiftBalanceCents` columns under the cap engine.

---

## 8. Reconciliation engine spec

A daily idempotent sweep producing the plan's **4-column reconciliation**, with a
break queue (`k9000_reconciliation_breaks`) surfaced in the existing Alerts
Center (MEMORY: *Alerts Center*, `admin_alerts`).

**The four columns:**

| # | Source | PetWash access |
|---|---|---|
| 1 | **Nayax Core** transactions | Nayax reporting API / settlement export keyed by `nayaxTransactionId` |
| 2 | **K9000 audit** (local operational evidence) | bay audit menus / asset counters (manual or export) |
| 3 | **PetWash ledger** | `bay_sessions` + `credit_transactions` + `audit_ledger` (hash-chained) |
| 4 | **SUMIT documents** | SUMIT issued docs on the **purchase** (not redemption) |

**Match keys:** redemption matches on `(bay_id, nayaxTransactionId, reservation_ref)`;
purchase-to-document matches on `purchases.surfaceRefId ↔ SUMIT externalId`
(`payments-sumit.ts:130`).

**Break types the sweep must detect:**
- Nayax Settlement with **no** committed reservation (vend granted, we didn't
  debit) → money-leak alert, severity high.
- Committed reservation with **no** Nayax Settlement (we debited, no vend) →
  candidate for `autoCompensateSession()`.
- Session `busy`/`active` older than `max_wash_seconds` → hung bay; force release.
- Purchase `paid` in SUMIT with no entitlement credited → fulfilment gap.
- Entitlement credited with no SUMIT document → fiscal gap.

**Cadence:** daily cron (reuse the hourly Alerts Center cron infra). Output:
`k9000_reconciliation_breaks` rows + one digest alert. **KPI target (plan):**
recon breaks < 3 / 1000 redemptions; auto-reversal < 15 min for > 99%.

### Document-policy matrix (accountant-configurable — do NOT hardcode)

Per the plan, VAT/document timing must be configuration, not code. Phase-1 matrix
(counsel/accountant to confirm exact SUMIT `Type` per row — see MEMORY *SUMIT API
reference*):

| Instrument | Issued at | SUMIT doc | VAT timing |
|---|---|---|---|
| Direct one-off wash (online) | purchase | InvoiceAndReceipt | on sale |
| **Prepaid wash entitlement (P1)** | purchase | Invoice/Receipt for the *package* | **on sale** (deferred-revenue recognised on redemption per accountant policy) |
| Closed-loop stored value (P2) | load | Receipt for the load (not a taxable supply until spent — accountant to confirm) | on spend |
| Promotional coupon | n/a | none (marketing expense) | n/a |

This matrix lives in a config table/JSON read by the issuance path, never inline.

---

## 9. Israel legal posture (Caution #3) — what we assert, what counsel must confirm

### 9.1 The enacted framework (2026, cited)

- **Regulation of Payment Services and Payment Initiation Services Law,
  5783-2023** — published June 2023, **in force June 2024**
  ([Barnea](https://barlaw.co.il/practice_areas/regulation/capital-markets-regulation/client_updates/israel-regulation-of-payment-services-law-comes-into-effect/),
  [Herzog](https://herzoglaw.co.il/en/news-and-insights/the-regulation-of-payment-and-payment-initiation-services-law-is-approved-by-the-knesset-in-the-second-and-third-readings/)).
- The ISA **exemption envelope is enacted**: a payment-account manager is exempt
  where the **maximum daily accrued balance is ILS 1,500 for an *unidentified*
  customer or ILS 3,000 for an *identified* customer**, with an aggregate cap
  (≈ ILS 5M daily) and a transitional path (apply within 3 months of breaching;
  may grow to ILS 7M during review)
  ([Barnea 2025 outlook](https://barlaw.co.il/regulated-payment-services-and-financial-services-in-israel-summary-and-outlook-for-2025/),
  [Vixio](https://www.vixio.com/insights/pc-regulatory-influencer-israels-regulator-eyes-innovation-and)).
  So the CEO's "₪1,500/3,000 envelope" is **confirmed enacted** — it is no longer
  just draft commentary.
- **Closed-loop / gift-card / loyalty models are expressly contemplated** by the
  new regime ("the payments market will now be open to gift card providers and
  consumer loyalty clubs which use closed-loop models") — but being *contemplated*
  is not the same as being *carved out*; the exemption thresholds and the closed-
  loop characterisation are what keep us outside the licensing perimeter.
- An exempt-entity **notification regime** to the ISA exists (draft rules
  published) and there is a **June 6, 2026** deadline relevant to entities
  *already* licensed for related financial services — **counsel must check whether
  any notification obligation attaches to us as an exempt closed-loop issuer.**

### 9.2 Why Phase-1 **entitlements** are lower risk than even a capped wallet

A prepaid **wash entitlement** is a *right to receive a specific service* (N
washes), recorded as `washPackageCredits` (an integer count), with:
- **no monetary balance** to redeem → **cannot be cashed out by construction**
  (there is literally no ILS figure to return);
- **PetWash-only, non-transferable, no interest, expiry, explicit T&Cs**;
- redemption issues **no card charge and no new tax document** — it consumes a
  pre-paid service obligation (deferred revenue).

This is the strongest possible closed-loop posture: it is the legal equivalent of
a multi-ride transit punch-card, not an e-money balance. A capped *wallet* (P2)
still holds **money**, which is exactly the object the payment-services law
regulates; entitlements hold a **service right**, which is ordinary commercial
deferred revenue. Hence Phase 1 ships entitlements first.

### 9.3 Migration path P1 → P2 (capped wallet)

When P2 turns on stored monetary value (`cashWalletBalanceCents` etc.):
- enforce the **ILS 1,500 unidentified / 3,000 identified** per-account ceiling in
  the top-up path (`payments-sumit.ts` already bounds top-up at ≤ ₪10,000 at
  `:57`; tighten to the legal cap, keyed on identification status);
- add the aggregate-daily monitor and the 3-month-breach alert;
- keep non-transferable, no-cash-out, no-interest, expiry;
- file any ISA exempt-entity notification counsel requires.

### 9.4 What counsel MUST confirm (blocking for P2, advisory for P1)

1. That a prepaid wash **entitlement** (service right, no money balance) sits
   **outside** the payment-services perimeter entirely (P1 launch assumption).
2. The exact **identification** standard that distinguishes the ILS 1,500 vs
   3,000 ceiling, and whether our Firebase-verified customers count as
   "identified".
3. Whether any **ISA exempt-entity notification** attaches to us, and the
   June 6, 2026 deadline's applicability.
4. SUMIT **document type + VAT timing** for package sale vs stored-value load vs
   consumption (feeds §8 matrix).
5. T&Cs language for non-transferable / no-cash-out / expiry (consumer-protection
   compliant).

> **Planning-envelope caveat (unchanged from the plan):** treat ILS 1,500/3,000
> as the **planning ceiling**. It is enacted, but its application to our exact
> instrument design is a legal conclusion only counsel can give.

---

## 10. Fraud controls (adopted + concretised)

| Control | Mechanism | Status |
|---|---|---|
| Single-use signed QR, bay-bound, short TTL (30–120s) | `passLinkToken` (HMAC, nonce) verified in `/authorize` + `/settlement` | Live; add explicit `expiresIn` + bay binding |
| No offline redemption | Cortina cloud round-trip required; we are the authoriser | Inherent |
| Exactly-once vend | `idempotency_key` unique on reservation; replayed Settlement → no re-debit | NEW (§5.3) |
| One reservation per instrument per bay/station | partial unique indexes (§7.1) | NEW |
| Velocity rules | `VELOCITY_MAX_REDEMPTIONS=3/hr` (`K9000RedemptionService.ts:85`) | Live |
| Dual-approval break-glass for manual free wash | admin endpoint requiring two admin sign-offs; logged to `audit_ledger` | NEW (small) |
| Immutable non-destructive ledger (compensating entries) | hash-chained `audit_ledger`; compensation is an *added* entry, never a delete (`:1098`) | Live |
| Bay-hang prevention | `max_wash_seconds` ceiling + heartbeat staleness (180s) → forced release | NEW (§5.2) |

**KPIs (plan, adopted):** redemption success > 98.5%; duplicate < 0.05%; recon
breaks < 3/1000; auto-reversal < 15 min > 99%; manual free wash < 1%; doc
exceptions < 0.5%. Wire these into the recon digest.

---

## 11. Phased rollout mapped to OUR build

| Phase | Plan scope | Mapped to our build |
|---|---|---|
| **P1** | Prepaid wash **entitlements** + coupons ONLY (no wallet/reload) | **DONE:** SUMIT checkout + `PurchaseActivationService` (#1041), Cortina webhooks (#1042), `authorizeRedemption`, coupons (#1035). **NEXT (this SDD):** reservation stage, commit/release split, recon skeleton, literal-drift fix |
| **P2** | Closed-loop stored value, low caps | Turn on `cashWalletBalanceCents` spend at machine + enforce ILS 1,500/3,000 caps + counsel sign-off |
| **P3** | eGift gifting | eGift already on SUMIT (#1041); add gift-to-recipient binding |
| **P4** | Reloadable / memberships | Prestige membership bridge + reload UX |

**The first PR (recommended):**
1. Fix the redemption-type literal drift (`'egift'→'gift_credit'`,
   `'cash'→'wallet_balance'`) with a shared mapper + test.
2. Add `k9000_redemption_reservations` table + the two partial unique indexes
   (migration 0076).
3. Refactor `nayax-cortina.ts`: `/authorize` creates a `reserved` row (no debit);
   `/settlement` commits idempotently (debit + session + reservation→committed).
4. Wire RELEASE: schedule `enterCleanupPhase`→`finalizeCleanup`→`closeBaySession`
   off `expectedDurationSeconds`, with `registerCleanupRecovery()` on boot and a
   `max_wash_seconds` ceiling so a bay can never hang.
5. Recon skeleton: `k9000_reconciliation_breaks` table + a daily cron that flags
   committed-without-Settlement and Settlement-without-commit.

All dark behind `NAYAX_CORTINA_ENABLED`. Per CEO rule (MEMORY: *batch one big
merge*) this is **one branch / one PR / one deploy**.

---

## 12. "To go live" checklist

### PetWash code (us)
- [ ] Fix redemption-type literal drift (shared mapper + test).
- [ ] Migration 0076: `k9000_redemption_reservations` + partial unique indexes.
- [ ] Migration: `station_bays` (+`k9000_asset_serial`, `nayax_merchant_id`, `max_wash_seconds`); `bay_sessions` (+`reservation_ref`, `commit_source`).
- [ ] Refactor Cortina `/authorize` (reserve) and `/settlement` (idempotent commit) per §5.
- [ ] Wire deterministic RELEASE timer + boot recovery + max-duration ceiling.
- [ ] Recon table + daily cron + Alerts Center break surfacing.
- [ ] Caps engine stubs for P2 (ILS 1,500/3,000) — code present, flag-off.
- [ ] Dual-approval break-glass endpoint for manual free wash.
- [ ] Finalise Cortina wire field names in `parseCortinaRequest`/`cortinaApprove`/`cortinaDecline` against the live spec; map our verdict to `Status.Verdict`+`Code`.
- [ ] Tests: idempotent Settlement (no double-debit), reservation TTL expiry releases bay with no money moved, commit-without-Settlement compensation.

### CEO / Nayax-ops
- [ ] Nayax sandbox: confirm PetWash as a **Cortina payment method** and the exact `Settlement` request/response contract (+ decline codes 1/5/6/992).
- [ ] Enable **PreSelection = Yes** per bay; confirm VPOS/ONYX + MDB level-3.
- [ ] Provision per-bay `nayaxTerminalId` / `nayaxQrReaderId` / `nayaxMerchantId`; confirm Nayax reports **which side** fired.
- [ ] Confirm `MACHINE_ACTIVATION_URL` / Cortina webhook URLs reachable (MEMORY: *K9000 Nayax go-live state*).
- [ ] Set `NAYAX_CORTINA_ENABLED=true` only after sandbox sign-off.
- [ ] SUMIT live creds confirmed (`SUMIT_ENABLED=true`, `SUMIT_SANDBOX=false`).
- [ ] Print/affix one static DOT QR per bay.

### Counsel
- [ ] Confirm P1 entitlement sits outside the payment-services perimeter (§9.2).
- [ ] Confirm "identified vs unidentified" standard → which cap applies in P2.
- [ ] Confirm ISA exempt-entity notification obligation + June 6, 2026 relevance.
- [ ] Approve SUMIT document type + VAT timing matrix (§8).
- [ ] Approve T&Cs: non-transferable / no-cash-out / expiry.

---

## 13. Stop-and-summarize

- **Recommended first PR:** reservation stage + commit/release split + recon
  skeleton + literal-drift fix, dark behind `NAYAX_CORTINA_ENABLED`, one merge.
- **Out of scope:** Phase-2 wallet caps enforcement (stub only), P3 gifting, P4
  memberships, Spark primary path (fallback only), any new fiscal-document
  issuance at redemption (there is none by design), real Nayax reporting-API
  ingestion for recon column #1 (skeleton uses export until creds land).
- **Open questions:** Does our Nayax merchant tier permit PetWash-as-Cortina-
  payment-method? Does Nayax echo `nayaxTransactionId` on both `/authorize` and
  `/settlement` (needed for the idempotency key)? Exact SUMIT `Type` per matrix
  row? Are Firebase-verified customers "identified" for the ILS 3,000 ceiling?
- **Key fraud/safety risks:** (1) Settlement replay double-debit — mitigated by
  the unique `idempotency_key`. (2) Bay hang ('busy' forever) — mitigated by the
  deterministic RELEASE timer + `max_wash_seconds` ceiling, since no completion
  signal exists. (3) Money-leak: Settlement-without-commit (vend granted, not
  debited) — caught by the recon sweep. (4) Legal: shipping stored value before
  counsel sign-off — mitigated by entitlements-first (no money balance) in P1.
- **Tests needed:** idempotent Settlement, reservation-TTL release with no money
  moved, compensation on commit-without-vend, literal-drift mapping, cap
  enforcement (P2), recon break detection.
- **Feature flags:** `NAYAX_CORTINA_ENABLED` (master), `SUMIT_ENABLED`,
  `SUMIT_SANDBOX`, plus a new `K9000_WALLET_CAPS_ENABLED` for P2.
- **Rollback plan:** set `NAYAX_CORTINA_ENABLED=false` → `/authorize` and
  `/settlement` return 503 decline (already coded, `nayax-cortina.ts:80,105`);
  the reservation table and timers are inert with no traffic; entitlements
  purchased via SUMIT remain valid and redeemable later. No data migration to
  reverse (all additive). Public walk-up card payment (plain Nayax, Flow A) is
  unaffected throughout.

---

## Appendix A — CEO master plan (verbatim)

> Closed-loop PetWash-only instrument (NOT a wallet first): redeemable only for PetWash services, non-transferable, no cash-out, no interest, low caps, expiry, explicit T&Cs — to stay outside Israel's ISA non-bank payment-services licensing perimeter (Regulation of Payment & Payment-Initiation Services Law 2023, in force 2024). Draft exemption commentary (Barnea) cites closed-system caps ~ILS 1,500 (or 3,000 if designated) — treat as PLANNING ENVELOPE, counsel must confirm. Architecture separates FOUR things: customer identity / stored-value(entitlement) balance / machine vend-authorisation / Israeli bookkeeping documents — PetWash owns the first three; SUMIT owns documents (registered ITA bookkeeping software, REST API, JS tokenisation to cut PCI). Nayax = machine-side scan + vend evidence ONLY; K9000 = local operational evidence (audit menus, asset/serial). Principle: ATOMICITY WITH REVERSIBLE STAGES — state machine issued→presented→reserved→authorised→committed→released→exception; short-lived single-use signed QR (30–120s, nonce, bay-bound); idempotency_key per token+station+bay; ONE active reservation per instrument per station AND per bay (no dual-bay racing); commit ONLY on positive vend evidence; release/exception on failure. Four instrument types: direct one-off / prepaid-wash-entitlement (deferred revenue) / closed-loop stored value (liability) / promotional coupon (marketing expense). Accountant-configurable document-policy matrix (do NOT hardcode VAT/doc timing). Daily 4-column reconciliation: Nayax Core ↔ K9000 audit ↔ PetWash ledger ↔ SUMIT docs → exception queue. MDB > Pulse > relay(last-resort) wiring hierarchy. Device-ID model: site/station/bay/k9000 asset+serial/nayax device/dot serial/merchant. Make the BAY the redemption unit. Fraud: single-use signed QR, no offline redemption, velocity rules, dual-approval break-glass for manual free wash, immutable non-destructive ledger (compensating entries). Phased rollout: P1 prepaid-wash-entitlements + coupons ONLY (no wallet/reload); P2 closed-loop stored value low caps; P3 eGift gifting; P4 reloadable/memberships. KPIs: redemption >98.5%, dup <0.05%, recon breaks <3/1000, auto-reversal<15min >99%, manual-free-wash <1%, doc exceptions <0.5%.

## Appendix B — what we changed in the plan, and why

1. **Split COMMIT from RELEASE.** The plan's "commit on vend, release on
   completion" can't run: there is no completion webhook and Settlement = vend
   *start*, not wash *end*. Commit = Settlement; Release = deterministic timer +
   heartbeat. (§5)
2. **Added a real reservation row** (the plan named the *state* but our current
   code collapses reserve+commit into one Settlement call). The reservation table
   + partial unique indexes deliver the plan's "one reservation per instrument
   per bay/station" in the DB. (§5.3, §7.1)
3. **Idempotency key = token+terminalId+nayaxTransactionId** (the plan said
   token+station+bay; we add the Nayax transaction id so a replayed Settlement is
   provably the same event). (§5.3)
4. **Cortina chosen as primary, Spark explicitly fallback**, with the state
   machine made rail-agnostic so the fallback is a config swap, not a rewrite.
   (§6)
5. **Confirmed the ILS 1,500/3,000 envelope is ENACTED** (not just draft Barnea
   commentary) and added the exempt-entity notification + June 6 2026 angle.
   (§9.1)
6. **Flagged a live literal-drift bug** behind the dark flag that the plan
   assumed away. (§2.1)

## Appendix C — sources

- Nayax Cortina StaticQR Settlement: https://devzone.nayax.com/docs/static-qr-settlement
- Nayax Cortina StaticQR Remote Vend: https://devzone.nayax.com/docs/cortina/staticqr/remote-vend
- Israel Payment Services Law in force (Barnea): https://barlaw.co.il/practice_areas/regulation/capital-markets-regulation/client_updates/israel-regulation-of-payment-services-law-comes-into-effect/
- Israel 2025 outlook + ILS 1,500/3,000 exemption (Barnea): https://barlaw.co.il/regulated-payment-services-and-financial-services-in-israel-summary-and-outlook-for-2025/
- Knesset approval / closed-loop gift-card opening (Herzog): https://herzoglaw.co.il/en/news-and-insights/the-regulation-of-payment-and-payment-initiation-services-law-is-approved-by-the-knesset-in-the-second-and-third-readings/
- ISA exempt-entity notification draft rules (Herzog): https://herzoglaw.co.il/en/news-and-insights/isa-published-for-public-comments-the-draft-rules-regarding-notification-to-the-isa-by-exempt-entities/
- Regulator innovation/competition framing (Vixio): https://www.vixio.com/insights/pc-regulatory-influencer-israels-regulator-eyes-innovation-and
- Saga/TCC reservation + idempotency best practice (AWS): https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-choreography.html
- Saga pattern durable execution (Temporal): https://temporal.io/blog/mastering-saga-patterns-for-distributed-transactions-in-microservices
