# SUMIT capabilities deep-dive + future missions — 2026-05-23

**Source**: public SUMIT marketing pages, SUMIT.co.il developer center,
WooCommerce plugin notes, plus capability confirmation from CEO.

**Scope of this doc**: strategic planning only. No code change in this PR.
The activation framework lives in Mission-4 (commit `d4a2423`); the
Tranzila migration plan in `tranzila-to-sumit-migration-roadmap-2026-05-23.md`.

## 1. SUMIT capability surface (full picture)

What SUMIT (Software #00215702, ITA-registered, PCI DSS Level 1) actually
supports — well beyond what we've been planning for:

### Documents (already in Mission-4 scope)
- חשבונית מס (tax invoice) — for עוסק מורשה + חברה
- חשבונית עסקה (transaction invoice) — for עוסק פטור
- קבלה (receipt)
- חשבונית זיכוי (credit note)
- תעודת משלוח (delivery note)
- Digital signature (auto-signed, ITA-compliant)
- Direct integration with חשבוניות ישראל (ITA system) — SUMIT obtains
  the SHAAM allocation number on our behalf

### Payments (NOT in Mission-4 — separate workstream)
- Credit card clearing (immediate charge)
- Authorization-only ("J5") with later capture
- Refunds + voids
- Recurring / standing orders (VAT-exempt variants supported)
- Tokenization — save cards without holding PAN ourselves
- Payments JavaScript API — embedded payment forms on our site
- PCI DSS Level 1 — they hold the PAN, we don't

### Reconciliation (NEW for us)
- **Bank-of-Israel Open Banking sync** — sanctioned, token-based,
  no stored credentials; pulls transactions on demand
- Legacy bank sync via stored creds (fallback for non-OB banks)
- Auto-matches bank credits/debits to invoice/expense records
- Reports unmatched movements (catches missed bookings)

### Expense automation (NEW for us)
- AI receipt parsing — photo, email, or WhatsApp drop-in
- Auto-classifies into expense categories
- Auto-creates the SUMIT expense entry
- Could replace or feed our supplier-invoice OCR pipeline

### Customer / CRM
- Entity sync (create/update customer records via API)
- Guest checkout (one-off charges without account)
- Webhook callbacks on every event

### Compliance
- ITA-registered software (Software #00215702)
- PCI DSS Level 1
- Israeli Privacy Law compliant
- Maintains the legal document trail at SUMIT's side

## 2. What we already do vs. what SUMIT does better

| PetWash today | SUMIT equivalent | Decision |
|---|---|---|
| Tranzila card clearing | SUMIT `POST /payments/...` | Migrate per `tranzila-to-sumit-migration-roadmap` (multi-PR) |
| Issue invoices via `israeliTax.ts` + internal numbering | SUMIT documents API | Switch source-of-truth to SUMIT (PR-S5b API mode) |
| OCR via Google Vision + Gemini fraud | SUMIT AI receipt parsing | **Keep PetWash OCR** — our fraud-detection logic is custom + we need OCR on the screening pipeline BEFORE SUMIT. But SUMIT can be the secondary store. |
| ITA SHAAM via PR-S5a + assumed manual entry | SUMIT direct ITA integration | Switch — SUMIT requests SHAAM on our behalf. PR-S5a's columns still useful for screening, but the request itself goes through SUMIT. |
| Bank reconciliation: nothing | SUMIT Open Banking sync | **New mission — high value.** Cash-flow visibility we currently lack. |

## 3. Proposed future missions (rough sizing)

Each is its own PR with its own approval gate. None auto-starts.

### Mission-5 — SUMIT API mode lock-in (small)
- Trigger: CEO provides the swagger spec (paste, repo file, or Drive)
- Drop the real `POST /accounting/documents/...` shape into
  `SumitClient.createDocument`
- Test mode against SUMIT sandbox + test supplier
- Switch staging `sumit.mode` → `api`, verify, then production cutover
- Risk: MEDIUM. ~200 LOC. Builds directly on Mission-4 dispatcher.

### Mission-6 — Bank-of-Israel Open Banking reconciliation (medium-large)
- New service `BankReconciliationService` that pulls bank transactions
  via SUMIT's Open Banking endpoint
- New page `/admin/finance/reconciliation` — shows unmatched bank
  movements + suggested matches to existing invoices/expenses
- New schema: `bank_reconciliation_records` table
- Cron job: nightly sync, alert on >30 unmatched movements
- Risk: HIGH (touches bank data + Open Banking authorization flow).
  Requires CPA + privacy-officer sign-off.
- Value: catches missing income, missing refunds, missing payouts.
  ~600 LOC.

### Mission-7 — Provider self-service view (medium)
- New page `/provider/my-invoices` — each provider sees ONLY their
  own submitted invoices + SUMIT status + payment status
- New route `GET /api/provider/my-invoices` — RBAC: provider role,
  filtered by `uploadedBy = currentUser.uid`
- Provider gets to see when their invoice was sent to the accountant
  and (eventually) when payment cleared
- Risk: MEDIUM. Provider-facing means brand-quality polish matters.
  ~400 LOC.

### Mission-8 — Accountant role + read-only view (small-medium)
- New role `accountant` between `staff` and `finance_admin`
- Can view all `ready_for_accountant` invoices
- Can mark "entered in SUMIT" manually (closes the loop when admin
  forgets to flip status via the SUMIT-sent email response)
- Cannot upload new invoices, cannot approve/reject, cannot see SUMIT
  control panel
- Risk: LOW-MEDIUM. RBAC change is sensitive but isolated.
  ~250 LOC.

### Mission-9 — SUMIT webhook receiver (small)
- New route `POST /api/sumit/webhook` — HMAC-validated via
  `SUMIT_WEBHOOK_SECRET`
- Handles: `document.created`, `document.confirmed`,
  `document.failed`, `payment.success`, `payment.failed`
- Updates `supplier_invoices.sumit_status` to `confirmed`
- Idempotent via webhook event id
- Risk: MEDIUM (public route + payload signature verify). ~150 LOC.
- Prereq: Mission-5 must land first (API mode live before webhooks
  make sense).

### Mission-10 — AI receipt drop-in (large, exploratory)
- Provider can WhatsApp / email an invoice photo directly
- Our backend forwards to SUMIT's AI parser
- Returns a structured invoice ready for screening
- This is `mobile-app` / WhatsApp territory — needs design first
- Risk: HIGH (new ingress channel). Park until others land.
- Value: lowest-friction provider onboarding step.

### Mission-11 — SUMIT credit-card clearing (REPLACES Tranzila for platforms)
- This is the Tranzila migration. See
  `tranzila-to-sumit-migration-roadmap-2026-05-23.md` PR-T0 through
  PR-T8.
- Multi-month project. Not a single PR.

## 4. What I will NOT do without explicit per-mission approval

Per Guardian discipline:
- Build any of Missions 5–11 without separate CEO "approve Mission-X"
- Touch any Tranzila code
- Touch K9000 / Nayax runtime
- Activate SUMIT in any mode (flag stays OFF)
- Add SUMIT credentials to env (CEO does that via Google Cloud Secret Manager)
- Touch wallet / escrow / ledger
- Change AGENT_MODEL_POLICY (still pending CPA)

## 5. Suggested priority order

If CEO wants to "make SUMIT live soon" while staying safe:

1. **Merge Mission-4 (this branch)** — framework lands inert.
2. **Test Mission-4 in staging** with email mode + a fake `ACCOUNTANT_EMAIL`.
3. **Mission-5 API mode** — drop in the swagger when CEO has it.
4. **Mission-9 Webhook** — close the confirmation loop.
5. **Mission-8 Accountant role** — let the accountant mark things done.
6. **Mission-7 Provider self-service** — show providers their status.
7. **Mission-6 Bank reconciliation** — high value but high risk; do last.
8. **Mission-10 AI receipt drop-in** — only after 5–9 are bedded in.
9. **Mission-11 Tranzila → SUMIT payments** — separate, multi-month project.

## 6. Access-control map (for the security follow-up in this PR)

| Surface | Current gate | Tightened gate after this PR |
|---|---|---|
| `/admin/supplier-invoices` (list + approve) | AdminRouteGuard + access ≥ 8 | Unchanged — finance admin can manage |
| `/admin/suppliers` (classify) | AdminRouteGuard + access ≥ 8 | Unchanged |
| `/admin/sumit` (control panel, env presence, flags) | AdminRouteGuard + access ≥ 8 | **Super-admin only** — control surfaces must not be visible to regular finance admins |
| `/api/admin/sumit/health` + `/preflight/:id` | Same as above | **Super-admin only** (this PR) |
| (Future) `/provider/my-invoices` | Provider role | Provider sees only their own (Mission-7) |
| (Future) `/admin/accountant/queue` | Accountant role | Accountant read-only on ready_for_accountant (Mission-8) |

## 7. Privacy / confidentiality observations

- SUMIT secrets live in Google Cloud Secret Manager (per CEO confirmation,
  2026-05-23) — never echoed in code, logs, or git.
- The SUMIT control panel only ever shows env-PRESENCE booleans, never
  the values themselves.
- Bank-account data (when Open Banking lands in Mission-6) is the most
  sensitive class of data this platform will touch — needs explicit
  privacy-officer review.
- Provider invoice files contain ח.פ., bank account numbers, supplier
  names — already PII. The current firebase signed-URL pattern (7-day
  expiry) is acceptable but should be reviewed.
- The "providers can see their own; others should not" principle is
  Mission-7's whole purpose.
