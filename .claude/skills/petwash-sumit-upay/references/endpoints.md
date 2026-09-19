# SUMIT endpoints PetWash calls — as `server/services/SumitClient.ts` uses them

Base URL: `https://api.sumit.co.il` (`SUMIT_API_BASE_URL` overrides; there is no sandbox host). Auth is **in the body**, never a header: `Credentials: { CompanyID: <number>, APIKey: <string> }`. Every response is an envelope; read it with `readSumitEnvelope()` — `Status: 0` (or `"Success"`) is success, anything else is a refusal even on HTTP 200. Full official spec: `https://api.sumit.co.il/swagger/v1/swagger.json` (OpenAPI 3.1.1, 84 endpoints); our reading of it: `docs/integrations/sumit-officeguy-api-reference-2026.md`.

| Endpoint | `SumitClient` method | Used for | Verified facts / gotchas |
|---|---|---|---|
| `POST /billing/payments/beginredirect/` | `beginRedirect` | opens the hosted payment page | Body: `RedirectURL`, `ExternalIdentifier`, `DocumentDescription` (**stamped `PW-REF <externalId>` — the only thread back to the order**), `ExpirationHours` (default 1; booking uses 2), `Customer{Name,EmailAddress}`, `Items[{Item{Name},Quantity,UnitPrice}]`, `VATIncluded:true`, `DraftDocument` (default true so our own official document is the only final one), `Language` (enum name, not ISO). SUMIT appends `OG-CustomerID, OG-PaymentID, OG-ExternalIdentifier` to the RedirectURL. Response URL field name is read defensively. |
| `POST /billing/payments/get/` | `getTransaction` → `interpretSumitPaymentGet` | authoritative re-verify on /return | Payment object fields: `ID, CustomerID, Date, ValidPayment, Status, StatusDescription, Amount, Currency, PaymentMethod, AuthNumber`. **No ExternalIdentifier** (confirmed by SUMIT 2026-09-18). Rejects `amountCents <= 0`. |
| `POST /billing/payments/list/` | `listPayments` | the unclaimed watch; `/pay` replacement-link guard | Date window + paging (`StartIndex`), `validOnly`. Same Payment object — no order link. |
| `POST /billing/payments/charge/` | `chargeSavedCard` | charge a stored card | Gated by `SUMIT_SAVED_CARD_CHARGE_ENABLED` + `CARD_VAULT_ENABLED` — **dark in prod**. Body shape marked best-known/unverified; fails closed. |
| `POST /billing/recurring/charge/` `/cancel/` `/listforcustomer/` | `chargeRecurring`, `cancelRecurring`, `listRecurringForCustomer` | subscriptions | `SUMIT_RECURRING_CHARGE_ENABLED` — **dark in prod**; confirm body in `SUMIT_SANDBOX=true` first. |
| `POST /billing/paymentmethods/setforcustomer/` `/getforcustomer/` `/remove/` | `setForCustomer`, `getForCustomer`, `removeSavedMethod` | card vault | Dark (`CARD_VAULT_ENABLED`). The ₪1 save-card page (`/api/payments/save-card/start`) is a **real charge**, never auto-refunded. |
| `POST /accounting/documents/create/` | `createDocument`, `createCustomerReceipt`, `createCreditDocument` | every tax document | Type from `sumitDocumentMapping.ts`. Idempotent by our reference; a create is refused after an `INCONCLUSIVE` lookup. Response carries `DocumentID`, `DocumentNumber`, `DocumentDownloadURL`. |
| `POST /accounting/documents/list/` | `findDocumentByExternalReference`, `listDocumentsInWindow`, `listDocumentsForCustomer` | duplicate-prevention, the PW-REF stamp lookup, customer financials | **No server-side ExternalReference or customer filter** — page a date window and match rows. `DateFrom/DateTo` ISO only (`DD/MM` is silently read as `MM/DD`). `IncludeDrafts:true` for the payment-page document. Document date = ISSUE date; service→issue lag measured median 30 days, so centre windows on the create attempt, not the service. |
| `POST /accounting/customers/create/` `/getdetailsurl/` | `createCustomer`, `getCustomerDetailsUrl` | CRM sync (dark: `SUMIT_CUSTOMER_SYNC_ENABLED`) | `SumitSyncService.runCustomerSync` records `pending_swagger` and returns true without calling — do not rely on it. |
| `POST /accounting/general/getvatrate/` | `connectionTest` | `POST /api/admin/sumit/connection-test` | Returned 200 / 18 % on 2026-07-05; the one safe "are we wired" call. |
| `POST /accounting/documents/cancel/` | — (not wired) | full cancel of a document | Per document, per company. A partial refund is a CreditInvoice via `documents/create`, not a cancel. |
| `POST /billing/payments/multivendorcharge/` | — (not built) | marketplace split | See <marketplace.md>. |
| `POST /billing/generalbilling/openupayterminal/` | — (not built) | open a provider's UPay terminal | Takes bank details + `Program` (default `OFFICEGUYNEW10`, 1.5 %). |
| `POST /website/companies/create/` | — (not built) | create a provider's SUMIT company | Returns that company's `APIKey` — a secret we would have to vault (`piiFieldCrypto`) and revoke. |
| `triggers/triggers/subscribe/` | workflow `sumit-trigger-subscription.yml` | CRM-folder trigger → `/api/sumit/trigger/<token>` | Not a payment event stream; it wakes the unclaimed watch, nothing more. |

## Reading a payment safely (`interpretSumitPaymentGet`)

`valid` only when the envelope is success, the returned `ID` equals the expected PaymentID, `ValidPayment` is true and `Amount > 0`. Anything else is `not_valid` with a reason; a transport failure is `unreachable` and must never be read as "not paid".

## Language on the hosted page

`Language` is the `Accounting_Typed_Language` enum **name** (`Hebrew`, `English`, …), mapped by `sumitPageLanguage()`. A foreign-card holder must be able to read the form — pass the customer's language, not a constant.
