# SUMIT activation playbook — 2026-05-23

**Goal:** take the SUMIT integration from "framework exists but inert" to
"first real test invoice landed and verified," with explicit human gates
at every step and a one-click rollback at all times.

**Hard rule:** no automatic activation. Every step below is a manual
admin action. The dispatcher is gated by FOUR independent layers (parent
flag + send flag + activation mode + per-mode env). Skipping any of
them is a process error.

## 1. What's already on main (after Mission-4 lands)

- `SumitDispatcher` strategy router with four modes:
  - `off` (default) — every send returns sent:false reason:"mode is off"
  - `email` — forwards to `ACCOUNTANT_EMAIL` via guarded SendGrid
  - `api` — direct HTTP via `SumitClient` (currently inert: returns wired:false
    until the swagger spec is loaded and tested)
  - `csv_export` — placeholder, not implemented this PR
- `SumitPreflightCheck.runPreflight(facts)` — pure decision logic
  with 7 invoice/supplier gates + per-mode env-presence gates
- `GET /api/admin/sumit/health` — current mode + flags + env presence + status counts
- `GET /api/admin/sumit/preflight/:id` — per-invoice readiness checklist
- `AdminSumitControl` page at `/admin/sumit` — read-only status panel
- All routes 404 when `ff.supplier_invoice_control.enabled` is OFF

## 2. SUMIT capabilities (per CEO's research, 2026-05-23)

SUMIT (sumit.co.il) is registered with the Israeli Tax Authority
(Software #00215702) and PCI DSS Level 1 certified. Known capability
surface:

- **Documents** — `POST /accounting/documents/...` — tax invoices
  (חשבונית מס), receipts (קבלה), credit notes (חשבונית זיכוי),
  delivery notes
- **Digital signatures** — auto-signed by SUMIT, ITA-compliant
- **SHAAM allocation** — SUMIT requests the מספר הקצאה from ITA on
  our behalf before issuing an above-threshold document
- **Payments** — `POST /payments/...` — card clearing, J5 (authorization-only),
  recurring + standing orders, tokenization
- **Webhooks** — payment success/failure callbacks; document confirmation
- **Sandbox** — testing mode with test cards
- **WooCommerce plugin** exists (proves the API is production-grade)

The Swagger spec is at
`https://app.sumit.co.il/help/developers/swagger/index.html` but is
gated behind an authenticated SUMIT session. CEO will provide the
exact request shape when ready; the dispatcher will need no logic change.

## 3. Activation steps (do these in order)

Each step requires explicit CEO sign-off. Do NOT batch them.

### Step 0 — verify deploy + framework live
- Mission-4 merged to main and prod deploy green
- Open `/admin/sumit` — should show mode=`off`, flags=`false/false`,
  env presence reflecting current secrets (likely all `false` if
  nothing set yet)
- Open `/admin/supplier-invoices/:id/preflight` for any invoice — should
  return all checks failed (mode off, flags off)

### Step 1 — turn on the parent flag in staging only
- In staging admin → SystemConfig → set
  `ff.supplier_invoice_control.enabled = true`
- Verify `/api/supplier-invoices` returns 200 (not 404)
- Verify `/admin/sumit/health` still shows mode=`off`
- Upload one test invoice for a test supplier; verify it screens correctly
- **DO NOT** flip `ff.supplier_invoice_control.sumit_send.enabled` yet

### Step 2 — verify in staging that "send" still rejects
- Click "Send to SUMIT" on the test invoice
- Expected: `wired:false, reason:"SUMIT activation mode is off ..."`
- Verify `supplier_invoices.sumit_status` updated to `failed` with
  that reason in `sumit_last_error`
- Verify `sumit_outbound_events` has the failed row recorded
- This proves audit + persistence still work in the new dispatcher path

### Step 3 — first email-mode test (staging only)
- Provision `ACCOUNTANT_EMAIL` as a TEST inbox you own (NOT the real
  accountant) — e.g. `nir.h+sumit-test@petwash.co.il`
- Confirm `SENDGRID_API_KEY` is set in staging
- Set `sumit.mode = email`
- Set `ff.supplier_invoice_control.sumit_send.enabled = true`
- Open `/admin/sumit/preflight/<test-invoice-id>` — every check should
  be green
- Click "Send to SUMIT"
- Verify:
  1. Email arrives at the test inbox within 60s
  2. Subject = `[PetWash] Supplier Invoice #X — <supplier> — ₪<amount>`
  3. Body has the structured JSON block + Hebrew summary table
  4. Original invoice file is attached
  5. `supplier_invoices.sumit_status = sent`
  6. `supplier_invoices.sumit_document_id = "email:<idempotencyKey>"`
  7. `sumit_outbound_events` has the success row
  8. `audit_events` has `supplier_invoice_sumit_sent` with `mode=email`
- Click "Send" a second time on the SAME invoice — expected: 409
  INVALID_STATE "already sent" (idempotency works)

### Step 4 — staging cleanup
- Set `sumit.mode = off`
- Set `ff.supplier_invoice_control.sumit_send.enabled = false`
- Verify the test inbox received exactly ONE email

### Step 5 — production prep
- In Cloud Run env: ensure `ACCOUNTANT_EMAIL` is the REAL accountant
  inbox (NOT a test address). Use the same Secret Manager mechanism
  already in place for SENDGRID_API_KEY.
- Verify accountant has been notified that PetWash emails will start
  arriving and can identify the from-domain
  (`accounting@petwash.co.il` by default; configurable via
  `PETWASH_FROM_EMAIL`)
- Decide which suppliers are eligible for email-mode SUMIT today
  (likely: only suppliers already classified `murshe` or `chevra`, not
  `patur` and not `unknown`)

### Step 6 — production single-invoice test
- In prod admin → SystemConfig → enable both flags + set `sumit.mode = email`
- Pick ONE real supplier invoice that's already at status
  `ready_for_accountant`
- Open `/admin/sumit/preflight/<id>` — confirm all checks green
- Click "Send to SUMIT"
- Verify the accountant received the email and can manually enter it
  in SUMIT
- Confirm with the accountant that the JSON block is helpful (or trim
  it based on feedback)

### Step 7 — gradual production rollout
- Keep `sumit.mode = email`
- Wait 1-2 weeks of human-clicked sends from the admin UI
- Track:
  - Email delivery success rate (should be ~100%)
  - Accountant feedback on the format
  - Any false-positive preflight blocks (suppliers stuck unclassified)
  - `sumit_outbound_events` accumulating cleanly
- DO NOT bulk-send. Every send remains a per-invoice human click.

### Step 8 — eventual API-mode upgrade
- Get the SUMIT swagger spec from
  app.sumit.co.il/help/developers/swagger/ (CEO logged in)
- Save to `docs/finance/sumit-api-spec.json`
- Replace `SumitClient.createDocument` HTTP body with the real shape
- Switch staging `sumit.mode = api`
- Run Step 3-4 again with mode=api this time
- Then production cutover from email → api
- Email remains as a fallback (`sumit.mode = email` if API goes down)

## 4. Rollback procedure (any step)

Single source of truth: the `sumit.mode` config value.

- **Soft rollback** (1 second): `systemConfig.set('sumit.mode', 'off')`.
  Every subsequent click returns sent:false. Already-sent invoices
  unchanged.
- **Hard rollback** (1 minute):
  `systemConfig.set('ff.supplier_invoice_control.sumit_send.enabled', false)`.
  The route returns 404. UI hides the Send button.
- **Nuclear** (1 hour):
  `systemConfig.set('ff.supplier_invoice_control.enabled', false)`.
  The entire supplier-invoice feature returns 404. Existing data
  retained.

**Never delete supplier_invoices, sumit_outbound_events, or audit_events
rows during rollback.** They are the legal/audit record. Rolling back
the activation does not roll back the records.

## 5. Preflight gate inventory (what blocks a send)

| Gate | Source | Blocking reason (Hebrew label) |
|------|--------|-------------------------------|
| Parent flag | SystemConfig | `דגל-ראשי כבוי` |
| Send flag | SystemConfig | `דגל שליחה כבוי` |
| Activation mode | SystemConfig | `מצב פעיל: off` |
| Invoice exists | DB | `חשבונית קיימת` |
| Invoice status | DB | `חשבונית לא במצב המתאים` |
| Risk level | DB | `סיכון אדום` |
| Idempotency | DB | `כבר נשלח ל-SUMIT` |
| Supplier present | DB | `ספק משויך` |
| Supplier approved | DB | `ספק לא מאושר` |
| Supplier classified | DB | `ספק לא מסווג` |
| Env: API (mode=api) | env | `SUMIT_API_KEY חסר` etc |
| Env: Email (mode=email) | env | `ACCOUNTANT_EMAIL חסר` |

## 6. Out of scope for this playbook

- **SUMIT credit-card clearing** (`POST /payments/...`) — different
  workstream. CEO ordered "kill Tranzila for platforms" on 2026-05-23;
  the migration plan is in `docs/finance/tranzila-to-sumit-migration-roadmap-2026-05-23.md`
  and is a multi-PR project.
- **K9000 / Nayax** — stays on Nayax DOT terminals per CEO order;
  SUMIT only handles invoice/document side for K9000 revenue.
- **Customer-facing payment forms** — SUMIT has a JavaScript embed
  API; integration is a separate PR after Tranzila migration.
- **Webhook receiver** — `POST /api/sumit/webhook` will land in a
  follow-up PR once SUMIT API mode is live and we know the callback
  shape.
- **Reconciliation job** — `sumit_status='sent'` older than 24h should
  trigger an alert; separate cron PR.
