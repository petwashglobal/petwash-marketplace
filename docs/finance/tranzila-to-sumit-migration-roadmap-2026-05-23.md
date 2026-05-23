# Tranzila → SUMIT migration roadmap (platforms only)

**CEO order, 2026-05-23**: kill Tranzila for the marketplace platforms
(Sitter Suite, Walk My Pet, etc.); SUMIT becomes the sole payment +
invoicing rail for platform bookings; Nayax stays for K9000 dual-bay
station hardware.

**Pushback the writing agent recorded at the time of the order (§0.10):**
this is a 6-8 PR migration over weeks, not a single PR. The reasoning
is below in §1. The PR-by-PR plan is in §3.

## 1. Why "kill Tranzila in one PR" is reckless

Static-scan footprint as of 2026-05-23: **712 Tranzila references
across 10+ files** in server/.

### Tranzila-owned files

- `server/services/TranzilaChargebackService.ts`
- `server/services/TranzilaPaymentRequestService.ts`
- `server/services/TranzilaService.ts`
- `server/services/TranzilaChargebackMapper.ts`
- `server/services/TranzilaPaymentRequestMapper.ts`
- `server/services/TranzilaWebhookService.ts`
- `server/services/TranzilaDocumentMapper.ts`
- `server/routes/tranzila-webhooks.ts`
- `server/routes/tranzila-event-webhooks.ts`
- `server/routes/finance/tranzila-admin.ts`

### What would break if Tranzila were deleted today

1. **Every in-flight booking** that has a stored Tranzila token for
   recurring or "save card for later." Customers would lose payment
   methods.
2. **Active recurring/subscription charges.** Tranzila is the
   processor for any standing order; deleting the integration leaves
   subscriptions orphaned.
3. **Pending chargebacks.** Chargeback dispute windows are **6 months**.
   Tranzila is the channel for receiving the dispute, providing
   evidence, and processing the outcome. Deleting Tranzila code mid-window
   forfeits the dispute and loses the money automatically.
4. **Already-charged refunds.** Refunding a Tranzila charge requires
   the Tranzila API. Switching to SUMIT does not let us refund a
   Tranzila charge.
5. **PCI compliance during transition.** Mixed-state PCI is more
   fragile than either fully-Tranzila or fully-SUMIT. Customer card
   data must never cross a partially-migrated path.
6. **AGENT_MODEL_POLICY conflict.** The disclosed-vs-undisclosed agent
   decision is still pending CPA. Switching processors could change
   the VAT attribution model and so this decision must come FIRST.

### What "killing Tranzila" actually requires (logical order)

| # | What | Why |
|---|------|-----|
| 0 | Lock the AGENT_MODEL_POLICY decision with CPA | VAT attribution may differ between disclosed/undisclosed and Tranzila/SUMIT models differ in fee structure |
| 1 | Payment-rail abstraction (dispatcher) | Same pattern as Mission-4's SUMIT invoice dispatcher; one boolean flag per rail |
| 2 | SUMIT payment integration (sandbox) | Real charge flow against SUMIT test cards |
| 3 | Token-migration strategy | Customers re-authorize, OR vault transfer if SUMIT supports it, OR honor-existing-tokens-via-Tranzila-shim until they expire |
| 4 | Parallel running (percentage rollout) | 1% → 10% → 50% → 100% over weeks; metric: payment success rate vs. Tranzila baseline |
| 5 | Recurring/subscription cutover | Each subscription is a per-customer state change |
| 6 | Chargeback wind-down | Keep Tranzila READ paths alive for 6 months after last new charge to handle disputes |
| 7 | Refund wind-down | Keep Tranzila REFUND path alive for 6 months after last new charge |
| 8 | Tranzila code removal | Only after #6 and #7 have aged out and no pending state remains |

## 2. What is NOT this migration

- **K9000 stations** — stays on Nayax DOT terminals. Per the CEO order
  on 2026-05-23. Nayax has different operational properties (kiosk
  hardware, code-reader UX, station heartbeat) and is not being
  replaced.
- **Customer wallet ledger** — internal accounting layer is unchanged;
  the rail under it switches.
- **K9000 revenue invoicing** — SUMIT will handle K9000 *invoicing*
  (Mission-4 framework already accommodates this), but K9000 *payment
  capture* stays on Nayax.

## 3. Sequenced PR plan

Each PR is independently approvable. CEO sign-off required PR by PR.

### PR-T0 — CPA decision on AGENT_MODEL_POLICY (no code)
- Lock `shared/israel-compliance-config.ts::AGENT_MODEL_POLICY.model`
- Set `pendingCpaSignoff = false`
- Document the chosen model + reasoning
- **Blocks everything downstream.** Without this, switching processors
  could silently change VAT obligations.

### PR-T1 — Payment-rail dispatcher abstraction (no behavior change)
- New `server/services/PaymentRailDispatcher.ts` modeled on
  `SumitDispatcher` (Mission-4)
- Reads SystemConfig `payments.rail` (default `tranzila`)
- Modes: `tranzila` | `sumit` | `nayax` (Nayax already isolated)
- Existing callers route through the dispatcher; default = tranzila →
  no behavior change
- Tests: dispatcher routes correctly per mode
- Risk: LOW (additive, default preserves current behavior)

### PR-T2 — SUMIT payment integration (sandbox)
- Wire SUMIT `POST /payments/...` calls (real shape from swagger)
- ONLY callable via `payments.rail = sumit` setting
- Sandbox-only env: `SUMIT_PAYMENT_SANDBOX = true`
- One-button test page in admin
- Smoke test: charge ₪1 test card, void it; verify ledger entries
- Risk: MEDIUM (new HTTP path, sandbox-only)

### PR-T3 — Token migration scaffold (no migration yet)
- Pseudo-column: `customer_payment_tokens.sumit_token`
- Service `TokenMigrationService.evaluate(customer)` — returns the
  strategy per customer (re-authorize / vault-transfer / let-expire)
- No actual migration call yet
- Risk: LOW (read-only)

### PR-T4 — Parallel running with percentage flag
- New SystemConfig: `payments.sumit_percentage` (0-100, default 0)
- On new charge: `Math.random() * 100 < percentage` → sumit rail
- Otherwise → tranzila rail (existing path)
- Metric: payment success rate per rail (live dashboard)
- Start at 1%. Watch for 48h. Bump to 10%, 50%, 100% over 2-4 weeks.
- Risk: HIGH (production money). Requires extra CEO + CPA gate.

### PR-T5 — Recurring/subscription cutover
- For each active subscription, prompt customer to re-authorize on SUMIT
  on next renewal
- Subscriptions that don't re-authorize within 30 days → pause + email
- Risk: HIGH (could break revenue if too aggressive)

### PR-T6 — Chargeback + refund wind-down monitoring
- Dashboard showing pending Tranzila chargebacks + open refund eligibility
- Alert when count drops to 0 → safe to start Tranzila code removal
- Risk: LOW (read-only monitoring)

### PR-T7 — Tranzila READ-only mode
- New SystemConfig: `tranzila.write_disabled = true`
- All new charges → SUMIT
- Tranzila routes accept INBOUND webhooks (chargebacks) but reject
  outbound charge/refund requests with explicit error
- Risk: MEDIUM (must coexist with active chargebacks)

### PR-T8 — Tranzila code removal
- ONLY after PR-T6 monitoring shows zero pending chargebacks + zero
  refund eligibility AND PR-T7 has been live for 6+ months
- Delete the 10 Tranzila files
- Delete `tranzila.*` SystemConfig entries
- Delete `process.env.TRANZILA_*` references; regen env-audit doc
- Risk: MEDIUM (deletion). Easy to revert via git.

## 4. What this session ships (related to the kill order)

This session (Mission-4) ships **only the invoice-side framework** —
no payment-rail code, no Tranzila touch, no flag flip. The framework
proves the dispatcher pattern works for SUMIT integration on a
low-risk surface (invoice issuance). PR-T1 then clones the pattern to
the payment-rail axis when CEO approves PR-T0.

## 5. Open questions for CEO before any T-PR starts

1. AGENT_MODEL_POLICY decision — disclosed or undisclosed? (CPA sign-off needed)
2. Acceptable downtime window for tests? (none expected, but plan for 0)
3. Customer communication strategy for re-authorization? (email blast,
   in-app banner, both?)
4. SUMIT merchant account already provisioned? (per CEO: secrets in
   Google Cloud Secret Manager — confirm they're for production, not just
   sandbox)
5. Tranzila contract — any minimum-volume commitments, early-termination
   fees, notice period?
6. Israeli Tax Authority — does PetWash need to update any registration
   when the processor changes? (Software #00215702 is SUMIT's; PetWash's
   own ITA registration may need an update)
7. Bank wiring — is the settlement account the same for Tranzila and SUMIT?

## 6. Rollback at any point

The dispatcher pattern means rollback is a SystemConfig flip:
`payments.rail = tranzila`. All in-flight new charges revert
immediately. No code redeploy needed.

The exception is PR-T8 (code removal) — that is a non-trivial revert
(git revert), but PR-T8 only fires when nothing is left to roll back to.
