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
| REST API exists | `app.sumit.co.il/help/developers/swagger/index.html` (Swagger UI link itself is public, content gated) |
| Endpoint families: Accounting (Documents), Payments (Methods), Payments (Payments) | CEO research summary, 2026-05-23 |
| Webhooks for payment success/failure | SUMIT marketing site |
| Sandbox environment exists | SUMIT marketing site |
| Direct integration with חשבוניות ישראל (ITA) for SHAAM allocation | SUMIT marketing site |
| Supports עוסק פטור (חשבונית עסקה), עוסק מורשה (חשבונית מס), חברה (חשבונית מס) | Bank-of-Israel attachment confirmation |
| Tokenisation of cards | SUMIT marketing site |
| JavaScript embed for payment forms | SUMIT marketing site |
| WooCommerce plugin exists (proves the API is production-grade) | wordpress.org plugin page |

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

### 2.2 Endpoint path

**Assumption**: `POST /accounting/documents/create/` (trailing slash).

**Possible alternatives**:
- `POST /accounting/documents/Create/` (PascalCase, .NET convention)
- `POST /v1/accounting/documents`
- `POST /api/accounting/documents/create`

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
value of `SUMIT_SANDBOX` → sandbox URL). Operators must explicitly
set `SUMIT_SANDBOX='false'` to opt into production. This is intentional:
- A misconfigured deploy never accidentally hits production SUMIT.
- The "any other value → sandbox" rule defends against typos like
  `SUMIT_SANDBOX='False'` (capital F) or `'0'`.

Default sandbox URL: `https://sandbox-api.sumit.co.il`
Default production URL: `https://api.sumit.co.il`

Both can be overridden with `SUMIT_API_BASE_URL`.

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
- [ ] Run one sandbox test invoice end-to-end via mode=api against
      `https://sandbox-api.sumit.co.il`. Confirm `sumit_document_id`
      gets populated and `sumit_outbound_events` shows the success
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
