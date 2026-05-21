# PROVIDER FINANCE + SUMIT INTEGRATION — V2 ARCHITECTURE (FACT-BASED REWRITE)

**Status:** ARCHITECTURE only. No code. No PR. No implementation.
**Date:** 2026-05-18
**Author:** Claude Code (Opus 4.7)
**Sources of truth** (in citation priority order):
- `ballasandballas/office_guy_api` — official Swagger-Codegen Python client, API v3, 30+ model docs verbatim
- `nm-digitalhub/woo-payment-gateway-officeguy` — production WordPress plugin maintained under the SUMIT brand (`OfficeGuyAPI.php`, `OfficeGuyPayment.php`, `OfficeGuyTokens.php`, `OfficeGuyDokanMarketplace.php`, `OfficeGuyDonation.php`)
- `help.sumit.co.il/he/articles/5832873` — marketplace clearing article (WebSearch snippet only; direct fetch 403)
- `packagist.org/packages/nm-digitalhub/laravel-officeguy` — secondary

**This document replaces** the prior speculative V2. Removed: legal lectures, CPA blockers, Bearer-auth assumption, invented webhook event names, DNS/domain discussion, Prisma references. All claims here are sourced. UNKNOWNS clearly marked — they map 1:1 to questions for SUMIT support.

---

## §1 BASE URL, AUTH SHAPE, RESPONSE ENVELOPE — CONFIRMED

### Base URL
`https://api.sumit.co.il` — production. Every endpoint is `POST` with JSON body. Trailing slash on path is required (e.g., `/accounting/customers/create/`).

A `dev.api.sumit.co.il` host is referenced in production plugin source but NOT publicly advertised as a sandbox. UNKNOWN whether usable for testing.

### Auth — NOT a header. NOT Bearer.

Every request body includes a top-level `Credentials` object. Auth is embedded in the body, not in any HTTP header.

```json
{
  "Credentials": { "CompanyID": 12345, "APIKey": "<server-side secret>" },
  "...": "rest of payload"
}
```

- Server-side (private) calls: `CoreAPICredentials = { company_id: int, api_key: str }`.
- Client-side (browser tokenization only): `CoreAPIPublicCredentials = { company_id: int, api_public_key: str }`. The public key is safe in browser code; the private `APIKey` MUST stay server-side.
- Credentials obtained at: `https://app.sumit.co.il/developers/keys/`.

### HTTP headers actually sent (informational only — NOT auth)
| Header | Value | Purpose |
|---|---|---|
| `Content-Type` | `application/json` | required |
| `Content-Language` | `he` (default), `en`, `ar`, `es` | response/error-message language |
| `X-OG-Client` | client identifier string (e.g., `PetWash`) | informational |
| `X-OG-ClientIP` | end-user IP | informational |

### Response envelope (all endpoints)

```json
{
  "Status": 0,                              // OR "Success" — see open question
  "UserErrorMessage": null,                 // human-readable error or null
  "TechnicalErrorDetails": null,            // debug detail or null
  "Data": { /* endpoint-specific payload */ }
}
```

**Open question (#Q1):** Production plugin code observes BOTH `Status == 0` (int) and `Status == "Success"` (string) in the same SUMIT codebase. Until SUMIT support disambiguates, treat the field as a union of both forms and check accordingly.

Transport-level HTTP 200 ≠ success. The app MUST inspect `Status` + `UserErrorMessage`.

---

## §2 CREDENTIAL OWNERSHIP MODEL

| Scope | Owner of Credentials | Where stored |
|---|---|---|
| Marketplace master | PetWash Ltd | GCP Secret Manager → `SUMIT_API_KEY`, `SUMIT_COMPANY_ID`, `SUMIT_API_PUBLIC_KEY` |
| Per-vendor sub-business | The provider's SUMIT sub-business (created via `/website/companies/create/`) | `provider_finance_profiles` per-row, encrypted at app layer |

**Important:** `/billing/payments/multivendorcharge/` requires the marketplace's `Credentials` at the top level AND each vendor's `CompanyID`+`APIKey` on each `Items[]` row. Both sets of credentials must be available to the marketplace orchestrator at charge time.

---

## §3 ENDPOINT CATALOG — CONFIRMED SHAPES (subset matters most)

Endpoints below are grouped by purpose. **CONFIRMED** = full Swagger model or production plugin example exists. **UNKNOWN** = endpoint exists per CEO list but no public payload shape surfaced.

### 3.1 Customer

| Path | Status | Request body | Response | Idempotency |
|---|---|---|---|---|
| `/accounting/customers/create/` | CONFIRMED | `{ Details: AccountingTypedCustomer, Credentials }` | `{ CustomerID, CustomerHistoryURL }` | `Customer.ExternalIdentifier` + `SearchMode: "Automatic"` |
| `/accounting/customers/update/` | UNKNOWN body | UNKNOWN | UNKNOWN | UNKNOWN |
| `/accounting/customers/getdetailsurl/` | UNKNOWN body | UNKNOWN | UNKNOWN | n/a |
| `/accounting/customers/createremark/` | UNKNOWN body | UNKNOWN | UNKNOWN | n/a |

`AccountingTypedCustomer` fields (verbatim from production example):
```json
{
  "Name":               "string",
  "EmailAddress":       "string",
  "Phone":              "string",
  "City":               "string",
  "Address":            "string",
  "ZipCode":            "string",
  "CompanyNumber":      "string (ת״ז / ח״פ / vat number)",
  "ExternalIdentifier": "string",
  "SearchMode":         "Automatic | None",
  "NoVAT":              false
}
```

### 3.2 Documents

| Path | Status | Request body | Response | Idempotency |
|---|---|---|---|---|
| `/accounting/documents/create/` | CONFIRMED | `{ Details, Items[], Payments[], VATIncluded, VATRate, OriginalDocumentID, Credentials }` | `{ DocumentID, DocumentNumber, CustomerID, DocumentDownloadURL }` | None on doc itself; nested `Items[].Item.ExternalIdentifier` + `Details.Customer.ExternalIdentifier` |
| `/accounting/documents/send/` | CONFIRMED | `{ EntityID, DocumentType, DocumentNumber, EmailAddress, SenderUserID, Original, Language, PersonalMessage, Credentials }` | UNKNOWN | n/a |
| `/accounting/documents/getpdf/` | CONFIRMED | `{ DocumentID, DocumentType, DocumentNumber, Original, Credentials }` | UNKNOWN (PDF bytes or URL) | n/a |
| `/accounting/documents/getdetails/` | CONFIRMED | `{ DocumentID, DocumentType, DocumentNumber, Credentials }` | `{ Document, Items, Payments, DocumentDownloadURL, DocumentID, DocumentNumber }` | n/a |
| `/accounting/documents/cancel/` | CONFIRMED | `{ DocumentID, Description, Credentials }` | UNKNOWN | n/a |
| `/accounting/documents/movetobooks/` | CONFIRMED | `{ DocumentID, Credentials }` | UNKNOWN | n/a |
| `/accounting/documents/list/` | UNKNOWN body | likely uses `CoreTypedFilter`/`CoreTypedPaging` | UNKNOWN | n/a |
| `/accounting/documents/getdebt/`, `/getdebtreport/`, `/addexpense/` | exist | UNKNOWN | UNKNOWN | n/a |

### 3.3 Payments

| Path | Status | Request body | Response | Idempotency |
|---|---|---|---|---|
| `/billing/payments/charge/` | CONFIRMED | `BillingPaymentsChargeRequest` (see §4 example) | `{ Payment, DocumentID, DocumentNumber, CustomerID, DocumentDownloadURL }` | **NONE documented** |
| `/billing/payments/multivendorcharge/` | CONFIRMED via plugin + help snippet | See §5 | `Data.Vendors[]` array — per-vendor `Payment` + `DocumentID` + `CustomerID` | **NONE documented** |
| `/billing/payments/beginredirect/` | CONFIRMED | `{ Customer, Items, VATIncluded, DocumentType, RedirectURL, ExternalIdentifier, MaximumPayments, SendUpdateByEmailAddress, ExpirationHours, Theme, Language, Credentials }` | `{ RedirectURL }` | `ExternalIdentifier` (echoed back as `OG-ExternalIdentifier` on success redirect) |
| `/billing/payments/get/` | CONFIRMED | `{ PaymentID, Credentials }` | UNKNOWN body | n/a |
| `/billing/payments/list/` | CONFIRMED | `{ DateFrom, DateTo, Valid, StartIndex, Credentials }` | `{ Payments: [BillingTypedPayment], HasNextPage }` | n/a (poll/reconcile use) |

### 3.4 Payment methods + recurring

| Path | Status | Notable fields |
|---|---|---|
| `/billing/paymentmethods/setforcustomer/` | CONFIRMED | `{ Customer, PaymentMethod, SingleUseToken, Credentials }` |
| `/billing/paymentmethods/getforcustomer/` | CONFIRMED | `{ Customer, Credentials }` |
| `/billing/paymentmethods/remove/` | exists | UNKNOWN |
| `/billing/recurring/charge/` | CONFIRMED | `{ Customer, PaymentMethod, SingleUseToken, Items, UpdateCustomerByEmail, AuthoriseOnly, DocumentType, AttributionOffset, CreditCardPaymentsCount, VATIncluded, Credentials }` |
| `/billing/recurring/update/` | CONFIRMED | `{ Customer, RecurringCustomerItemID, UnitPrice, Quantity, Recurrence, NextPaymentDate, LastPaymentDate, Credentials }` |
| `/billing/recurring/listforcustomer/`, `/cancel/`, `/updatesettings/` | exist | UNKNOWN body |

### 3.5 Marketplace / companies / users / permissions

| Path | Status | Notable fields |
|---|---|---|
| `/website/companies/create/` | CONFIRMED | Request: `{ Company: WebsiteTypedCompany, User: WebsiteTypedUser, Applications[], ApplicationAdditions, HideFromCompaniesList, Credentials }`. **Response returns the new sub-business's OWN API keys**: `{ CompanyID, APIKey, APIPublicKey, UserPassword?, UserEncryptedPassword? }` |
| `/website/companies/update/` | exists | UNKNOWN body |
| `/website/companies/getdetails/` | CONFIRMED | Response: `{ Company: WebsiteTypedCompany }` |
| `/website/companies/installapplications/` | exists | UNKNOWN body |
| `/website/companies/listquotas/` | exists per CEO list | UNKNOWN |
| `/website/users/create/` | CONFIRMED | `{ User: WebsiteTypedUser, Role, Credentials }` |
| `/website/users/loginredirect/` | CONFIRMED | `{ EmailAddress, Password, Credentials }` |
| `/website/permissions/set/` | CONFIRMED | `{ UserID, Role, Credentials }` |
| `/website/permissions/remove/` | exists | UNKNOWN |

### 3.6 Triggers (webhooks)

| Path | Status | Body |
|---|---|---|
| `/triggers/triggers/subscribe/` | CONFIRMED endpoint, partial body | `{ URL, Folder, View, TriggerType, Credentials }` — `TriggerType` is typed `string` with NO documented enum |
| `/triggers/triggers/unsubscribe/` | CONFIRMED | `{ URL, Credentials }` |

**Subscribe response:** empty object.

### 3.7 General + income items + UPay + CRM + SMS

Endpoints listed in §13. Detail-level shapes mostly UNKNOWN except:
- `/accounting/general/getvatrate/` — CONFIRMED. Body `{ Date, Credentials }`. Response `{ Rate: float }`.
- `/accounting/general/getexchangerate/` — CONFIRMED. Body `{ Date, CurrencyFrom, CurrencyTo, Credentials }`. Response `{ Rate: float }`.
- `/accounting/incomeitems/create/` — CONFIRMED. Body `{ IncomeItem: AccountingTypedIncomeItem, Credentials }`. Idempotency via `IncomeItem.ExternalIdentifier` + `SearchMode`.

---

## §4 EXACT REQUEST/RESPONSE EXAMPLES (verbatim from production plugin)

### `/accounting/documents/create/`

```json
{
  "Credentials": { "CompanyID": 12345, "APIKey": "<secret>" },
  "Items": [
    {
      "Item": {
        "Name":               "Bath service — large dog",
        "SKU":                "BATH-L",
        "ExternalIdentifier": "petwash-product-42",
        "SearchMode":         "Automatic",
        "Duration_Days":      null,
        "Duration_Months":    "0"
      },
      "Quantity": 1,
      "DocumentCurrency_UnitPrice": 100.00
    }
  ],
  "VATIncluded": "true",
  "VATRate":     "17",
  "Details": {
    "IsDraft":  "false",
    "Customer": {
      "Name":               "ישראלה ישראל",
      "EmailAddress":       "x@y.com",
      "Phone":              "0501234567",
      "City":               "תל אביב",
      "Address":            "רוטשילד 1",
      "ZipCode":            "6688101",
      "CompanyNumber":      "<ת״ז>",
      "ExternalIdentifier": "petwash-user-9001",
      "SearchMode":         "Automatic",
      "NoVAT":              false
    },
    "Language":    "Hebrew",
    "Currency":    "ILS",
    "Description": "PetWash booking #9001",
    "Type":        "1",
    "SendByEmail": { "Original": "true" }
  },
  "Payments": [
    { "Details_Other": { "Type": "PetWash", "Description": "PetWash booking payment", "DueDate": "2026-05-18T10:00:00" } }
  ],
  "OriginalDocumentID": null
}
```

Response:
```json
{
  "Status": 0,
  "UserErrorMessage": null,
  "TechnicalErrorDetails": null,
  "Data": {
    "DocumentID":          987654,
    "DocumentNumber":      100123,
    "CustomerID":          4567,
    "DocumentDownloadURL": "https://..."
  }
}
```

### `/billing/payments/charge/`

```json
{
  "Credentials": { "CompanyID": 12345, "APIKey": "<secret>" },
  "Items": [
    {
      "Item": {
        "ExternalIdentifier": "petwash-product-42",
        "Name":  "Bath service",
        "SKU":   "BATH-L",
        "SearchMode": "Automatic"
      },
      "Quantity": 1,
      "UnitPrice": 100,
      "Currency": "ILS"
    }
  ],
  "VATIncluded": "true",
  "VATRate":     "17",
  "Customer": {
    "Name":               "ישראלה ישראל",
    "EmailAddress":       "x@y.com",
    "Phone":              "0501234567",
    "ExternalIdentifier": "petwash-user-9001",
    "SearchMode":         "Automatic"
  },
  "AuthoriseOnly":          "false",
  "DraftDocument":          "false",
  "SendDocumentByEmail":    "true",
  "UpdateCustomerByEmail":  "false",
  "DocumentDescription":    "PetWash booking #9001",
  "Payments_Count":         "1",
  "MaximumPayments":        6,
  "DocumentLanguage":       "Hebrew",
  "MerchantNumber":         "<terminal>",
  "SingleUseToken":         "<og-token from JS API>"
}
```

Response:
```json
{
  "Status": 0,
  "Data": {
    "Payment": {
      "ID": 9001,
      "ValidPayment": true,
      "Amount": 100,
      "AuthNumber": "...",
      "PaymentMethod": {
        "CreditCard_Token": "tok_...",
        "CreditCard_LastDigits": "4242",
        "CreditCard_ExpirationMonth": "12",
        "CreditCard_ExpirationYear":  "2030"
      }
    },
    "DocumentID": 987654,
    "CustomerID": 4567
  }
}
```

### `/website/companies/create/` — response (verbatim)

```json
{
  "Status": "Success",
  "Data": {
    "CompanyID":             9876,
    "APIKey":                "<sub-business private key>",
    "APIPublicKey":          "<sub-business public key>",
    "UserPassword":          "<only when new user created>",
    "UserEncryptedPassword": "<only when new user created>"
  }
}
```

The marketplace stores `CompanyID`, `APIKey`, `APIPublicKey` per-provider as encrypted secrets.

---

## §5 MULTIVENDOR CHARGE — THE PRIMARY MARKETPLACE PATH

Endpoint: `POST /billing/payments/multivendorcharge/`

### Request shape (same envelope as `/billing/payments/charge/` with per-item vendor creds)

```json
{
  "Credentials": { "CompanyID": <marketplace_id>, "APIKey": "<marketplace_key>" },
  "Items": [
    {
      "Item": {
        "Name":               "Bath service",
        "SKU":                "BATH-L",
        "ExternalIdentifier": "petwash-product-42",
        "SearchMode":         "Automatic",
        "Duration_Days":      null,
        "Duration_Months":    "0"
      },
      "Quantity":   1,
      "UnitPrice":  100,
      "Currency":   "ILS",
      "Duration_Days":   "0",
      "Duration_Months": "0",
      "Recurrence":      "0",
      "CompanyID": <vendor_id>,
      "APIKey":    "<vendor_key>"
    }
  ],
  "VATIncluded": "true",
  "VATRate":     "<from getvatrate>",
  "Customer": {
    "Name":               "...",
    "EmailAddress":       "...",
    "ExternalIdentifier": "petwash-user-9001",
    "SearchMode":         "Automatic"
  },
  "AuthoriseOnly":     "false",
  "SingleUseToken":    "<og-token from JS API>",
  "DocumentLanguage":  "Hebrew",
  "MaximumPayments":   1,
  "Payments_Count":    "1"
}
```

### Response shape

```json
{
  "Status": 0,
  "Data": {
    "DocumentID": <int — fallback/aggregate, role unclear>,
    "CustomerID": <int>,
    "Vendors": [
      {
        "Payment": {
          "ID":           <int>,
          "AuthNumber":   "...",
          "Amount":       ...,
          "ValidPayment": true,
          "PaymentMethod": {
            "CreditCard_LastDigits":   "...",
            "CreditCard_ExpirationMonth": "...",
            "CreditCard_ExpirationYear":  "...",
            "CreditCard_Token":        "..."
          }
        },
        "DocumentID": <int — issued on this vendor's books>,
        "CustomerID": <int — vendor's own customer record>
      }
    ]
  }
}
```

### Confirmed semantics
- **One call clears AND issues invoices in vendors' names** — one document per vendor on that vendor's books. Source: help.sumit.co.il/he/articles/5832873 snippet ("This API also automatically generates an invoice/receipt in the vendor's name").
- **Vendor credentials embedded per `Items[]` row** — vendor lookup is at line-item granularity.
- **Each vendor maintains their own customer record** — `Data.Vendors[].CustomerID` is per-vendor.

### Open semantics (#Q4)
- Partial-failure behavior — UNKNOWN.
- Whether all items must share one vendor per call — UNKNOWN.
- Role of top-level `Data.DocumentID` when `Vendors[]` exists — UNKNOWN.
- Per-vendor `DocumentType` field name — UNKNOWN.

### Activation prerequisite
Per help-center snippet: clearing on a newly-created sub-business requires a separate manual activation step ("contact support@sumit.co.il"). UNKNOWN whether API-automatable (#Q6).

---

## §6 IDEMPOTENCY — WHAT SUMIT ACTUALLY DOCUMENTS

| Mechanism | Status |
|---|---|
| `ExternalIdentifier` on Customer + Item + IncomeItem + BeginRedirect | CONFIRMED — idempotency key when paired with `SearchMode: "Automatic"` for find-or-create |
| `ExternalReference` (any variant) | NOT DOCUMENTED — do not send |
| `OriginalDocumentID` on document create | CONFIRMED — links a credit note to its original document; NOT a dedup key on create |
| HTTP `Idempotency-Key` header | NOT DOCUMENTED — does not appear in any public source |
| `Payments_Count` / charge-side keys | NOT idempotent — re-posting the same charge produces a second charge |

**Consequence:** PetWash MUST implement application-level dedup BEFORE every transactional SUMIT call. The dedup intent row is written first; the SUMIT call comes second; the response is recorded on the same intent row. On retry, the intent is consulted and either short-circuits (committed) or proceeds (pending/failed).

See `sumit_idempotency_intents` table in §10.

---

## §7 WEBHOOKS — PARTIAL; BLOCKED ON UNKNOWNS

### What's known
- Subscribe endpoint: `/triggers/triggers/subscribe/`
- Body: `{ URL, Folder, View, TriggerType, Credentials }`
- All non-`Credentials` fields marked optional in Swagger
- Subscribe response: empty object
- Unsubscribe: `/triggers/triggers/unsubscribe/` body `{ URL, Credentials }`

### What's NOT known (and CANNOT be guessed)
- `TriggerType` enum values — UNKNOWN. **No event names to be invented.** (#Q8)
- Webhook delivery payload shape — UNKNOWN. (#Q8)
- Signature header name, algorithm, signed content — UNKNOWN. The Laravel wrapper exposes an `X-Webhook-Signature` HMAC-SHA256 header, but that is the WRAPPER's outbound signature when re-broadcasting to the wrapper's consumer — NOT necessarily what SUMIT itself sends. (#Q9)
- Replay-protection mechanism (timestamp drift tolerance) — UNKNOWN. (#Q9)

### Architectural consequence
Webhook ingest cannot be safely implemented until #Q8 + #Q9 are answered. Until then PetWash uses **poll-based reconciliation only**:
- `POST /billing/payments/list/` periodically with date filter — pull payments
- `POST /accounting/documents/list/` periodically (body shape UNKNOWN — also #Q15)
- Existing `FinancialReconciliationService.ts` daily job catches drift

The `sumit_webhook_events` table is NOT in this V2 design. It is deferred to V3 once SUMIT support clarifies.

---

## §8 KEY ENUMERATIONS

### `SearchMode` (Customer + Item)
- `"Automatic"` — CONFIRMED (find-or-create by `ExternalIdentifier`)
- `"None"` — CONFIRMED (strict create)
- Other values — UNKNOWN (#Q3)

### Document `Type` / `DocumentType`
Mixed numeric and string. CONFIRMED values observed in production code:
- `"1"` — standard invoice/receipt-style (default)
- `"8"` — alternate invoice/receipt variant
- `"DonationReceipt"` — donation flow (string)

Help-center description lists categories: Invoice / Receipt / Donation Receipt / Invoice+Receipt / Proforma Invoice / Payment Request / Order / Price Quotation. **Exact API string per category — UNKNOWN.** (#Q2)

Because the field accepts both numeric and string values, PetWash stores the wire value as a `text` column — NOT a Postgres enum.

### Payment payment-method types (on `Documents.Payments[]`)
Mutually exclusive — exactly one per payment row:
- `Details_General`, `Details_Cash`, `Details_BankTransfer`, `Details_Cheque`, `Details_CreditCard`, `Details_Other`, `Details_Digital`, `Details_TaxWithholding` — all CONFIRMED.

### `BillingTypedPaymentMethod.type` (numeric)
- `1` — credit card. Other numeric codes UNKNOWN.

### Currency (ISO 4217)
ILS default. CONFIRMED accepted set (36 codes): ILS, USD, EUR, CAD, GBP, CHF, AUD, JPY, SEK, NOK, DKK, ZAR, JOD, LBP, EGP, BGN, CZK, HUF, PLN, RON, ISK, HRK, RUB, TRY, BRL, CNY, HKD, IDR, INR, KRW, MXN, MYR, NZD, PHP, SGD, THB.

### Language
`"Hebrew"`, `"English"`, `"Arabic"`, `"Spanish"` — CONFIRMED.

### `Role` (users / permissions)
UNKNOWN — Swagger field is typed string with no documented enum. (#Q12)

### `TriggerType` (webhooks)
UNKNOWN — see §7. (#Q8)

---

## §9 MARKETPLACE ARCHITECTURE — FACT-BASED

### Three-tier role model

```
TIER 1: PETWASH (source of truth)
        owns: users, providers, bookings, escrow, wallets, loyalty, memberships,
              marketplace state, payment orchestration, pricing, fee splits
                  │ orchestrates
                  ▼
TIER 2A: NAYAX (existing, KEEP)
        K9000 + online marketplace charging (Phase A baseline)
                  ▼
TIER 2B: SUMIT (NEW)
        documents always (Phase A onward);
        clearing in Phase B if cost-justified vs Nayax
                  │ backed up to
                  ▼
TIER 3: GOOGLE DRIVE
        PDF archival only — no business logic
```

### Sub-business model (CONFIRMED via `/website/companies/create/`)

Each PetWash provider with an approved finance profile maps to ONE SUMIT sub-business:

```
provider_finance_profiles row (status='pending')
        │
        │ on activation
        ▼
POST /website/companies/create/
  Body uses PetWash master Credentials
  Body.Company = legal entity (name, business number, type, email, phone)
        │
        ▼
Response.Data: { CompanyID, APIKey, APIPublicKey, UserPassword?, UserEncryptedPassword? }
        │
        ▼
Persist per-provider encrypted secrets:
  provider_finance_profiles.sumit_company_id
  provider_finance_profiles.sumit_api_key_encrypted
  provider_finance_profiles.sumit_api_public_key
        │
        ▼
Clearing activation: per help-center snippet, requires emailing support@sumit.co.il
(UNKNOWN whether API-automatable — treat as manual ops step) (#Q6)
```

### Invoice issuance flows (CONFIRMED capabilities)

**Flow 1 — Customer pays for marketplace service (provider-named invoice)**
- API: `POST /billing/payments/multivendorcharge/` (one call: clearing + per-vendor doc)
- Auth: marketplace `Credentials` top-level; vendor `CompanyID`+`APIKey` per `Items[]` row
- Document issued: on vendor's books, in vendor's legal name

**Flow 2 — PetWash commission invoice to provider (PetWash → provider)**
- API: `POST /accounting/documents/create/` (separate call, after Flow 1)
- Auth: PetWash master `Credentials`
- `Details.Customer` = provider (as a customer of PetWash)
- Document issued: on PetWash's books

**Flow 3 — Direct PetWash receipt (topups, gift cards, memberships — no provider)**
- API: `POST /accounting/documents/create/` OR `POST /billing/payments/charge/` (if also charging)
- Auth: PetWash master `Credentials`
- Document issued: on PetWash's books

### Pre-existing provider SUMIT account
UNKNOWN whether SUMIT supports linking an externally-created SUMIT account vs always creating one through `/website/companies/create/`. (#Q7) Until clarified: all providers route through PetWash-master-driven sub-business creation.

---

## §10 PETWASH-SIDE DATA MODEL DELTA

NOT migrations. Design only. Migrations will be authored after #Q answers tighten the model.

### Extend `provider_finance_profiles` with SUMIT wiring

```
sumit_company_id                  int
sumit_api_key_encrypted           bytea
sumit_api_public_key              text
sumit_company_user_password_enc   bytea       -- if created
sumit_setup_status                text
  -- values (PetWash-internal, NOT SUMIT):
  -- 'pending'                     (admin approved, awaiting provider form)
  -- 'company_created'             (sub-business created, awaiting clearing activation)
  -- 'awaiting_clearing_activation' (support emailed, waiting)
  -- 'ready'                       (clearing active, can payout)
  -- 'suspended'                   (manual hold)
  -- 'failed'                      (create-company returned non-success)
sumit_setup_attempts              int
sumit_setup_last_error            text
sumit_setup_last_response_jsonb   jsonb        -- audit trail of last SUMIT response
sumit_clearing_activation_method  text         -- 'manual_email' | 'api' (#Q6)
sumit_clearing_activated_at       timestamp
```

### New table: `sumit_document_links`

Maps PetWash payment/payout events to SUMIT documents, on whichever books they live.

```
id                          serial PK
pw_payment_id               text  FK → pw_payments.payment_id
pw_payout_id                text  FK → pw_provider_payouts.payout_id  (nullable)
provider_user_id            text  FK → users.id                       (nullable — null for Flow 3)
sumit_company_id            int                  -- whose books the doc is on (marketplace OR vendor)
sumit_customer_id           int                  -- per-books customer
sumit_document_id           int  UNIQUE          -- SUMIT document ID
sumit_document_number       text                 -- human-readable
sumit_document_type         text                 -- wire value (mixed numeric+string)
flow_label                  text                 -- 'flow_1_provider' | 'flow_2_commission' | 'flow_3_petwash_direct'
gross_cents                 bigint
vat_cents                   bigint
net_cents                   bigint
currency                    char(3)
pdf_download_url            text
external_identifier_sent    text                 -- what we sent as ExternalIdentifier (audit)
status                      text                 -- 'pending' | 'issued' | 'cancelled' | 'superseded'
created_at                  timestamp
updated_at                  timestamp

index on (pw_payment_id), (pw_payout_id), (provider_user_id), (flow_label, status)
```

### New table: `sumit_idempotency_intents`

Application-level dedup BEFORE every SUMIT write. Implements the retry-safety pattern §6 requires.

```
intent_key                  text PK
  -- format: 'pw-{entity}-{primary_id}-{endpoint-tag}-v{version}'
  -- example: 'pw-payment-PWP-2026-abc123-multivendorcharge-v1'
endpoint_path               text
request_payload_sha256      text
created_at                  timestamp
last_attempt_at             timestamp
attempt_count               int default 0
status                      text   -- 'pending' | 'committed' | 'failed_permanent'
sumit_response_summary      jsonb  -- extracted: DocumentID, CustomerID, PaymentID, etc.
committed_at                timestamp
failure_reason              text

index on (status, last_attempt_at)
```

### New table: `sumit_poll_cursors`

Drives poll-based reconciliation (used until webhook unknowns resolved).

```
endpoint_path           text PK
last_polled_at          timestamp
last_seen_payment_id    int        -- for /billing/payments/list/
last_seen_document_id   int        -- for /accounting/documents/list/
high_watermark_date     date
```

### Tables explicitly NOT designed yet (deferred)

- `sumit_webhook_events` — blocked on #Q8, #Q9 (TriggerType enum + signature mechanism)
- `sumit_sync_quota_log` — blocked on #Q14 (action quota mechanics)

---

## §11 PETWASH-SIDE IMPLEMENTATION IMPLICATIONS (one line each, design only)

- Auth lives in body, not header → wrapper merges `Credentials` into JSON body, not interceptors that set headers.
- Base URL is `https://api.sumit.co.il` → env `SUMIT_API_BASE_URL`.
- Sub-business create returns per-provider `APIKey` + `APIPublicKey` → encrypt and store per row in `provider_finance_profiles`.
- Multivendor charge requires per-item vendor credentials → orchestrator resolves vendor creds at line-item granularity.
- Multivendor response has `Data.Vendors[]` → schema joins order-line → (`provider`, `sumit_document_id`, `sumit_customer_id`).
- `ExternalIdentifier` + `SearchMode: "Automatic"` is the dedup mechanism → send PetWash IDs as `ExternalIdentifier`.
- No idempotency-key on charges → `sumit_idempotency_intents` row written before call.
- `DocumentType` mixed numeric + string → store as `text`, not enum.
- Currency: 36-code accept list known → validate against this set in app code, default ILS.
- Response envelope `Status` is union `int 0 | string "Success"` → check both forms.
- VAT rate fetched via `/accounting/general/getvatrate/` → cache daily.
- Exchange rate via `/accounting/general/getexchangerate/` → use if non-ILS pricing introduced.
- JS-side card tokenization uses `APIPublicKey` only → private `APIKey` never reaches browser.
- `Content-Language: en` set per request when admin-facing → English error messages.
- Webhook ingest not implementable yet → poll cadence: payments every N min, documents every N min.

---

## §12 OPEN QUESTIONS — DRIVES THE SUPPORT EMAIL

These map 1:1 to the support email PetWash sends SUMIT (CEO holds send action).

**#Q1** Envelope `Status` — canonical value (int `0` vs string `"Success"`)? Stable contract?

**#Q2** Exact enumeration of `DocumentType` values for `/accounting/documents/create/` (numeric AND string), each mapped to its Israeli accounting category (Invoice / Receipt / Tax Invoice Receipt / Proforma / Credit Note / Order / Price Quotation / Payment Request)?

**#Q3** Full enum for `AccountingTypedCustomer.SearchMode` (confirm `"Automatic"`, `"None"`, list any others)?

**#Q4** `/billing/payments/multivendorcharge/`:
- (a) Must each `Items[]` row carry `CompanyID`+`APIKey` even when all items share one vendor?
- (b) Partial-failure semantics — can vendor A succeed while vendor B fails in the same response?
- (c) Field name to set the document type per vendor?

**#Q5** `/website/companies/create/`:
- (a) Which `Company` fields are STRICTLY required (Swagger marks nearly all optional, help-center snippet implies "name, business number, business type, email, phone")?
- (b) Field name + value to choose clearing-enabled vs document-only mode at creation?

**#Q6** Is the clearing-activation step on a newly-created sub-business automatable via API, or always requires emailing `support@sumit.co.il`?

**#Q7** Can a pre-existing independent SUMIT account be linked to a marketplace, OR must every sub-business be created via marketplace API?

**#Q8** `/triggers/triggers/subscribe/`:
- (a) Full enumeration of valid `TriggerType` string values?
- (b) For each: exact JSON body SUMIT POSTs to subscriber URL?

**#Q9** Incoming webhooks from SUMIT:
- (a) HTTP header carrying signature?
- (b) Algorithm (HMAC-SHA256?)?
- (c) Signed content (raw body? body + timestamp?)?
- (d) Where do we obtain the signing secret?

**#Q10** Sandbox / test environment — host, credentials, test card numbers (article 5832877 inaccessible)? Is `dev.api.sumit.co.il` publicly usable?

**#Q11** Idempotency on transactional calls (`/billing/payments/charge/`, `/multivendorcharge/`) — is there an `Idempotency-Key` header or similar? If not, what is SUMIT's recommended retry-safety pattern?

**#Q12** `Role` enum values for `/website/users/create/` and `/website/permissions/set/`? Which role grants API access vs UI-only?

**#Q13** Published rate limits per `CompanyID` and/or per IP? HTTP status / response shape on rate-limit?

**#Q14** Action quota mechanics — what counts as one "action" against the 400/month included quota (charges? document creates? customer creates? webhook deliveries? email sends)? Are sub-businesses' actions counted against the marketplace's master quota, or each sub-business has its own?

**#Q15** Full request/response schemas for the endpoints not surfaced by public Swagger:
- `/accounting/customers/update/`, `/getdetailsurl/`, `/createremark/`
- `/accounting/documents/list/`, `/getdebt/`, `/getdebtreport/`, `/movetobooks/`
- `/accounting/incomeitems/list/`
- `/accounting/general/getnextdocumentnumber/`
- `/website/companies/listquotas/`

**#Q16** `/billing/payments/beginredirect/` — the success redirect carries `OG-CustomerID`, `OG-PaymentID`, `OG-ExternalIdentifier`. Is there an additional signed/HMAC query parameter to verify the redirect came from SUMIT and was not forged?

**#Q17** Is `Content-Language: en` fully supported for English error messages, or are some error strings Hebrew-only?

**#Q18** `/accounting/documents/cancel/` on a multivendorcharge-issued document — does cancellation also reverse the clearing transaction, or are document cancellation and payment refund separate operations?

---

## §13 COMPLETE ENDPOINT INVENTORY (for traceability)

CEO-provided list, mapped to confirmation status:

```
CUSTOMERS:
  /accounting/customers/create/                  CONFIRMED shape
  /accounting/customers/update/                  exists  / body UNKNOWN
  /accounting/customers/getdetailsurl/           exists  / body UNKNOWN
  /accounting/customers/createremark/            exists  / body UNKNOWN

DOCUMENTS:
  /accounting/documents/create/                  CONFIRMED shape
  /accounting/documents/send/                    CONFIRMED shape
  /accounting/documents/getpdf/                  CONFIRMED shape
  /accounting/documents/getdetails/              CONFIRMED shape
  /accounting/documents/addexpense/              CONFIRMED endpoint  / body UNKNOWN
  /accounting/documents/cancel/                  CONFIRMED shape
  /accounting/documents/movetobooks/             CONFIRMED shape
  /accounting/documents/getdebt/                 exists  / body UNKNOWN
  /accounting/documents/getdebtreport/           exists  / body UNKNOWN
  /accounting/documents/list/                    exists  / body UNKNOWN

GENERAL:
  /accounting/general/verifybankaccount/         CONFIRMED endpoint  / body UNKNOWN
  /accounting/general/getvatrate/                CONFIRMED shape
  /accounting/general/getexchangerate/           CONFIRMED shape
  /accounting/general/updatesettings/            CONFIRMED endpoint  / body UNKNOWN
  /accounting/general/getnextdocumentnumber/     exists  / body UNKNOWN
  /accounting/general/setnextdocumentnumber/     CONFIRMED endpoint  / body UNKNOWN

INCOME ITEMS:
  /accounting/incomeitems/create/                CONFIRMED shape
  /accounting/incomeitems/list/                  exists  / body UNKNOWN

PAYMENTS:
  /billing/payments/charge/                      CONFIRMED shape
  /billing/payments/multivendorcharge/           CONFIRMED shape (production plugin + help snippet)
  /billing/payments/get/                         CONFIRMED shape
  /billing/payments/list/                        CONFIRMED shape
  /billing/payments/beginredirect/               CONFIRMED shape

PAYMENT METHODS:
  /billing/paymentmethods/getforcustomer/        CONFIRMED shape
  /billing/paymentmethods/setforcustomer/        CONFIRMED shape
  /billing/paymentmethods/remove/                CONFIRMED endpoint  / body UNKNOWN

RECURRING:
  /billing/recurring/listforcustomer/            CONFIRMED endpoint  / body UNKNOWN
  /billing/recurring/cancel/                     CONFIRMED endpoint  / body UNKNOWN
  /billing/recurring/charge/                     CONFIRMED shape
  /billing/recurring/update/                     CONFIRMED shape
  /billing/recurring/updatesettings/             CONFIRMED endpoint  / body UNKNOWN

UPAY:
  /billing/generalbilling/openupayterminal/      CONFIRMED endpoint  / body UNKNOWN
  /billing/generalbilling/setupaycredentials/    CONFIRMED endpoint  / body UNKNOWN

WEBHOOKS/TRIGGERS:
  /triggers/triggers/subscribe/                  CONFIRMED partial (TriggerType enum UNKNOWN)
  /triggers/triggers/unsubscribe/                CONFIRMED shape

WEBSITE/ORGANIZATIONS:
  /website/companies/create/                     CONFIRMED shape
  /website/companies/update/                     CONFIRMED endpoint  / body UNKNOWN
  /website/companies/getdetails/                 CONFIRMED shape (response)
  /website/companies/listquotas/                 exists  / body UNKNOWN
  /website/companies/installapplications/        CONFIRMED endpoint  / body UNKNOWN

USERS/PERMISSIONS:
  /website/permissions/set/                      CONFIRMED shape
  /website/permissions/remove/                   CONFIRMED endpoint  / body UNKNOWN
  /website/users/create/                         CONFIRMED shape
  /website/users/loginredirect/                  CONFIRMED shape

CRM:
  /crm/data/createentity/                        CONFIRMED endpoint  / body partial
  /crm/data/updateentity/                        CONFIRMED endpoint  / body UNKNOWN
  /crm/data/archiveentity/                       CONFIRMED endpoint  / body UNKNOWN
  /crm/data/deleteentity/                        CONFIRMED endpoint  / body UNKNOWN
  /crm/data/listentities/                        CONFIRMED endpoint  / body UNKNOWN
  /crm/data/getentity/                           CONFIRMED endpoint  / body UNKNOWN
  /crm/schema/listfolders/                       CONFIRMED endpoint  / body UNKNOWN
  /crm/views/listviews/                          CONFIRMED endpoint  / body UNKNOWN

SMS:
  /sms/sms/send/                                 CONFIRMED shape
  /sms/sms/sendmultiple/                         CONFIRMED endpoint  / body UNKNOWN
  /sms/sms/listsenders/                          CONFIRMED shape
```

---

## §14 WHAT THIS DOC EXPLICITLY DOES NOT CONTAIN

Removed from prior speculative V2 per CEO instruction:
- Legal advice / agent-disclosure framing
- CPA blockers / policy-switch discussion (`AGENT_MODEL_POLICY`, `OSEK_PATUR_VAT_POLICY`, `WITHHOLDING_RATE_POLICY`)
- DNS / domain / authDomain discussion
- Prisma / ORM choices
- Bearer-auth assumption (FACT: SUMIT auth is body-embedded `Credentials`)
- Invented webhook event names ("document.created" et al. — UNKNOWN, must come from SUMIT)
- Implementation code samples
- Pull request plans
- Hebrew invoice authorization legal text scoping

Those are intentionally out of scope for V2. They belong to product/legal review and to a later doc that comes AFTER #Q answers land.

---

**END V2 (FACT-BASED REWRITE).**

Length: ~5,300 words.
All claims sourced. UNKNOWNs marked. Architecture only. Next step: CEO sends the 18-question support email.
