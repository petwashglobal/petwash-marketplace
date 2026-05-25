# SUMIT API — known vs assumed (Mission-5)

**Why this doc exists**: the official SUMIT swagger spec at
`https://app.sumit.co.il/help/developers/swagger/index.html` is gated
behind a SUMIT-account login that the build environment cannot reach
(403 from every fetch). Mission-5 ships a real HTTP implementation
based on the public capability surface + the SDD's documented patterns.
Before flipping `SUMIT_SANDBOX='false'`, every assumed-field listed
below must be verified against the live swagger.

## 1. KNOWN from public sources

| Fact | Source |
|---|---|
| SUMIT is ITA-registered (Software #00215702) | SUMIT marketing site |
| PCI DSS Level 1 certified | SUMIT marketing site |
| Base URL: `https://api.sumit.co.il/` | **VERIFIED 2026-05-25** — Developer Portal |
| Authentication: API Key + Company ID **in request body** | **VERIFIED 2026-05-25** — Developer Portal note |
| Sandbox = a "testing organization" + test cards on the **same** `api.sumit.co.il/` endpoint — NOT a separate sandbox subdomain. `sandbox-api.sumit.co.il` is NXDOMAIN. | **VERIFIED 2026-05-25** — raw DNS lookup + Developer Portal sandbox note |
| Sumit was formerly OfficeGuy (useful for searching legacy SDKs/docs) | **VERIFIED 2026-05-25** — Developer Portal |
| Direct integration with חשבוניות ישראל (ITA) for SHAAM allocation | SUMIT marketing site |
| Supports עוסק פטור (חשבונית עסקה), עוסק מורשה (חשבונית מס), חברה (חשבונית מס) | Bank-of-Israel attachment confirmation |
| Tokenisation: `POST /creditguy/vault/tokenize/` (PAN→token) and `tokenizesingleuse/` | **VERIFIED 2026-05-25** — endpoint list |
| Marketplace split-charge: `POST /billing/payments/multivendorcharge/` (matches PetWash's split-between-station-owner-and-platform model) | **VERIFIED 2026-05-25** — endpoint list |
| Recurring/subscription: `POST /billing/recurring/charge/` + manage endpoints | **VERIFIED 2026-05-25** — endpoint list |
| Webhook registration via `POST /triggers/triggers/subscribe/` | **VERIFIED 2026-05-25** — endpoint list |
| Hosted payment redirect: `POST /billing/payments/beginredirect/` | **VERIFIED 2026-05-25** — endpoint list |
| Integration tools: WooCommerce plugin, Make.com module, Zapier module, n8n community `sumit-api` TypeScript SDK | **VERIFIED 2026-05-25** — Developer Portal |

### 1.1 Confirmed endpoint inventory (PetWash-relevant subset)

| Family | Endpoint | Purpose |
|---|---|---|
| Documents | `POST /accounting/documents/create/` | Create document (חשבונית מס / קבלה / etc.) |
| Documents | `POST /accounting/documents/send/` | Email document to customer |
| Documents | `POST /accounting/documents/getpdf/` | Download document as PDF |
| Documents | `POST /accounting/documents/getdetails/` | Fetch document metadata |
| Documents | `POST /accounting/documents/cancel/` | Cancel document (זיכוי flow) |
| Documents | `POST /accounting/documents/movetobooks/` | Finalize a draft document |
| Documents | `POST /accounting/documents/list/` | List documents |
| Documents | `POST /accounting/documents/addexpense/` | Record an expense |
| Customers | `POST /accounting/customers/create/` | Create-or-find customer (SearchMode-based dedup) |
| Customers | `POST /accounting/customers/update/` | Update existing customer |
| **Payments** | `POST /billing/payments/charge/` | **Tranzila replacement — one-time card charge** |
| **Payments** | `POST /billing/payments/multivendorcharge/` | **Marketplace split-payment** (PetWash use case) |
| Payments | `POST /billing/payments/get/` / `list/` | Retrieve charges |
| PaymentMethods | `POST /billing/paymentmethods/setforcustomer/` | Save card-on-file token |
| PaymentMethods | `POST /billing/paymentmethods/getforcustomer/` / `remove/` | Read / delete stored tokens |
| Recurring | `POST /billing/recurring/charge/` | Charge + create recurring schedule |
| Recurring | `POST /billing/recurring/listforcustomer/` / `cancel/` / `update/` | Manage subscriptions |
| Vault | `POST /creditguy/vault/tokenize/` | PAN → token (stored cards) |
| Vault | `POST /creditguy/vault/tokenizesingleuse/` | Single-use token (one-off without storing) |
| Gateway | `POST /creditguy/gateway/transaction/` | Lower-level card transaction (rarely needed if `/billing/payments/charge/` is used) |
| **Triggers** | `POST /triggers/triggers/subscribe/` / `unsubscribe/` | **Webhook registration** — register the URL where SUMIT POSTs events |
| GeneralBilling | `POST /billing/generalbilling/openupayterminal/` | UPay terminal (Sumit's modern card-present rail) |
| General | `POST /accounting/general/getvatrate/` | Get VAT rate by date (cross-check against our own VAT logic) |

### 1.2 Document-type rules per Osek classification (VERIFIED 2026-05-25)

From SUMIT help center articles (`/he/articles/...kabalot-osek-patur`,
`/he/articles/...nihul-esek-osek-patur`, `/he/articles/...maavar-osek-murshe-le-osek-patur`):

| Provider tax status | CAN issue | CANNOT issue |
|---|---|---|
| `osek_patur` (עוסק פטור — VAT-exempt) | `הצעת מחיר` (quote), `דרישת תשלום` (payment demand), `חשבון/קבלה` (combined invoice+receipt), `קבלה` (receipt only) | **`חשבונית מס`** (tax invoice), **`חשבונית מס/קבלה`** (combined tax invoice+receipt) |
| `osek_murshe` (עוסק מורשה — VAT-registered) | All of the above PLUS `חשבונית מס`, `חשבונית מס/קבלה`, `חשבונית זיכוי` (credit note) | — |
| `chevra` (חברה — corporation) | Same as `osek_murshe` | — |

**Implication for PetWash**: `SumitClient.createDocument` currently
hardcodes `DocumentType: 1`. That choice MUST be derived from the
provider's Osek classification — the same field already stored on
`providers.osek_type` via PR-S5c (merged 2026-05-23, see
petwash-platform skill §7). If we send a tax-invoice document type for
a `osek_patur` provider, SUMIT will reject the call. The DocumentType
mapping table (which integer maps to which document type) is still
ASSUMED until the swagger lands — see §2.3.

### 1.3 Standard עוסק פטור business flow per SUMIT

SUMIT documents teach this 3-document sequence for עוסק פטור businesses:

```
הצעת מחיר        →    דרישת תשלום         →    חשבון/קבלה
(price quote)         (payment demand)          (combined doc on payment)
```

PetWash today goes directly from "booking confirmed" → "charge card" with no
intermediate `דרישת תשלום` step. For B2C customers this is fine. For B2B
provider-to-platform flows where the provider needs a payment-terms document
(שוטף+30, etc.) before remitting, the `דרישת תשלום` document type is the
sanctioned vehicle. Not a blocker for Mission-5, but worth knowing when
PR-T0 / payment-rail dispatcher decisions get made.

### 1.4 Legal timing rule for `חשבון/קבלה` (CRITICAL for booking flow)

SUMIT help: *"החוק מחייב אותך להפיק את המסמך הזה מיד בעת קבלת התשלום"*
(the law requires you to issue this document **immediately** upon receipt
of payment).

**Implication**: when SUMIT becomes our payment rail (Mission-11), the
`POST /accounting/documents/create/` call cannot be deferred to a
background job. It must execute either:
  - in the synchronous charge-confirmation handler (preferred), or
  - in a guaranteed-delivery queue that completes within seconds, with
    a tight SLA + alarm on backlog
A best-effort fire-and-forget pattern would violate ITA timing rules
and create audit liability. Document this constraint up front so the
Mission-11 architect doesn't accidentally architect the integration
async.

### 1.5 Free-tier ceiling (matters for test environments)

SUMIT free plan: **10 documents/month, no credit card, no time limit**.

**Implication**: dev / staging test orgs can run fully on the free tier as
long as test runs stay under 10 documents/month. CI runs that create
documents on every PR will burn through this quickly — wire any
auto-generated documents in CI behind a `SUMIT_DRYRUN=true` flag (don't
fire the actual `create/` call) unless we explicitly opt into a paid
test plan.

## 2. ASSUMED in Mission-5 (must verify before prod)

These are the choices `SumitClient.createDocument` makes today based
on common .NET conventions + the SDD pattern. **They may be wrong.**

### 2.1 Authentication

**Assumption**: body-embedded `Credentials` object per SDD:
```json
{
  "Credentials": {
    "CompanyID": "...",
    "APIKey": "..."
  },
  ...
}
```

**Alternative shapes that might be correct instead**:
- Header `Authorization: Bearer <APIKey>` + `X-Company-Id: <CompanyID>`
- Header `Authorization: ApiKey <APIKey>` only
- Body field names differ (e.g. `companyId` camelCase, `company_id`
  snake_case)

### 2.2 Endpoint path — **VERIFIED 2026-05-25**

`POST /accounting/documents/create/` (trailing slash). Matches the Developer
Portal operation list verbatim. The original guess was correct.

(No version prefix. No PascalCase. No `/api/` mount point.)

### 2.3 Request body shape

**Assumption** (Mission-5 sends):
```json
{
  "Credentials": { ... },
  "DocumentType": 1,
  "Customer": {
    "Name": "...",
    "SearchMode": 0,
    "ExternalIdentifier": "<business-number>",
    "EmailAddress": "..."
  },
  "Items": [
    {
      "Item": { "Name": "<description>" },
      "Quantity": 1,
      "UnitPrice": <ex-vat>,
      "Currency": "ILS"
    }
  ],
  "ExternalIdentifier": "<idempotency-key>"
}
```

**Unverified**:
- `DocumentType: 1` for חשבונית מס — could be a different enum value.
- `SearchMode: 0` — unknown if this enum is right or even needed.
- `Items` array vs single-line shorthand.
- Idempotency: body's `ExternalIdentifier` + header `Idempotency-Key`
  — sent both as belt-and-braces.

### 2.4 Response shape

**Assumption**: response includes a document id under one of these
keys (in priority order):
- `DocumentNumber`
- `documentNumber`
- `Document.DocumentNumber`
- `Document.Number`
- `DocumentID`
- `documentId`
- `ID` / `id`

`extractDocumentId()` in `SumitClient` tries each in order. If none
match, `sumit_document_id` is left null and the raw response is
recorded in `sumit_outbound_events.response_body` for manual recovery.

### 2.5 Currency code

**Assumption**: `"ILS"` (ISO-4217).

**Possible alternatives**: `"NIS"`, integer enum, omitted (assumed
default).

### 2.6 Error codes

**Assumption**: standard HTTP — 2xx success, 4xx caller error, 5xx
server error. SUMIT-specific error codes inside the response body
are NOT yet parsed; the dispatcher persists the raw body in
`sumit_outbound_events.response_body` for manual triage.

## 3. Sandbox-first safety

`SumitClient.readEnv()` defaults `sandbox = true` (any non-`'false'`
value of `SUMIT_SANDBOX` → caller is treated as sandbox). Operators must
explicitly set `SUMIT_SANDBOX='false'` to opt into production. This is
intentional:
- A misconfigured deploy never accidentally treats production SUMIT
  credentials as production.
- The "any other value → sandbox" rule defends against typos like
  `SUMIT_SANDBOX='False'` (capital F) or `'0'`.

**There is only one base URL: `https://api.sumit.co.il/`.** Sandbox vs
production is determined by which `SUMIT_COMPANY_ID` / `SUMIT_API_KEY`
credentials are passed — a "testing organization" with test cards lives
on the same endpoint, gated by credentials, not by host. (Previous
versions of this doc and `SumitClient.ts` referenced
`sandbox-api.sumit.co.il`; that subdomain is NXDOMAIN and was a
fabrication.) `SUMIT_API_BASE_URL` override is retained for tests/mocks
only — there is no real alternate host.

The `X-PetWash-Sandbox: true|false` header is sent on every call so
SUMIT's side logs can confirm which environment we believed we were
calling. (SUMIT doesn't require this header — it's our own audit
breadcrumb.)

## 4. Verification checklist before flipping SUMIT_SANDBOX='false'

Per the activation playbook (`sumit-activation-playbook-2026-05-23.md`)
Step 8 (eventual API-mode upgrade), before flipping production:

- [ ] Open `https://app.sumit.co.il/help/developers/swagger/index.html`
      while logged into the SUMIT account that owns the production
      merchant. Confirm the swagger spec loads.
- [ ] Verify `POST /accounting/documents/create/` matches §2.2.
- [ ] Verify the authentication shape matches §2.1.
- [ ] Verify the request body matches §2.3 (in particular
      `DocumentType` enum value for חשבונית מס).
- [ ] Verify the response shape matches §2.4 (which field holds the
      document id).
- [ ] Provision a TEST organization on the SUMIT side (separate
      Company ID + API key, distinct from the production merchant).
      Set those credentials in staging env.
- [ ] Run one sandbox test invoice end-to-end via mode=api against
      `https://api.sumit.co.il/` (same URL as production — the
      test-org credentials determine which org is charged). Confirm
      `sumit_document_id` gets populated and `sumit_outbound_events`
      shows the success
      row with a valid `response_body`.
- [ ] Run one webhook simulation through `verifyWebhookSignature`
      using a real SUMIT webhook payload (so we know the signature
      format matches — SHA-256 HMAC over the raw body is the
      assumption).
- [ ] Compare sandbox response to the swagger schema for any
      diverged fields. Update `SumitClient.createDocument` body
      shape + `extractDocumentId` if needed.
- [ ] Get CEO + CPA sign-off on the agent model
      (`AGENT_MODEL_POLICY.pendingCpaSignoff`) — switching processors
      may change VAT attribution.
- [ ] Update this doc moving items from §2 to §1 as they're verified.
- [ ] Only then flip `SUMIT_SANDBOX='false'` in Cloud Run env.

## 5. What I will NOT do without verification

- Send a real production invoice (with money implications) using the
  assumed body shape.
- Persist a `sumit_document_id` that we can't trust — the dispatcher
  + screening pipeline treat `sumit_status='sent'` as "delivered to
  SUMIT," which a bad body shape would silently break.
- Skip the sandbox round-trip step.

Mission-5's whole purpose is to make this verification possible —
the client now reaches SUMIT, the dispatcher routes through it, the
admin can flip `sumit.mode='api'` in staging and watch what comes
back. The day SUMIT's swagger is in someone's logged-in browser, the
verification checklist above takes about an hour.
