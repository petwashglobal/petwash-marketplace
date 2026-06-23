# SUMIT / OfficeGuy API Reference (הנהלת חשבונות) — 2026-06-23

Authoritative endpoint surface provided by the CEO. Base URL `https://api.sumit.co.il`
(one base; sandbox vs prod selected by credentials, NOT a separate host). All POST.
**Do NOT call live SUMIT from dev** — code-map only; the CEO operates live billing.

## ⚠️ Code vs reference — findings

Our `server/services/SumitClient.ts` + `SumitSyncService.ts` endpoints, checked against this list:

| We call | In official list? | Note |
|---|---|---|
| `/accounting/documents/create/` | ✅ | ok |
| `/accounting/documents/cancel/` | ✅ | ok |
| `/accounting/customers/create/` | ✅ | ok |
| `/accounting/general/getvatrate/` | ✅ | ok |
| `/billing/payments/beginredirect/` | ✅ | ok |
| `/billing/recurring/charge/` | ✅ | ok (use for הוראת קבע / subscriptions) |
| `/billing/paymentmethods/setforcustomer/` | ✅ | ok |
| **`/billing/payments/gettransaction/`** (SumitClient.ts:648,656) | ❌ **NOT in list** | Likely WRONG → 404. Official has `/billing/payments/get/` (payment details) and `/creditguy/gateway/gettransaction/` (CC transaction details). **Confirm which we need and fix.** |

## High-value endpoints we should ADOPT (not yet wired)
- `/accounting/documents/movetobooks/` — finalize a DRAFT document (issue the official tax doc only after payment confirmed).
- `/accounting/documents/getpdf/` + `/accounting/documents/send/` — fetch + email the invoice/receipt PDF to the customer.
- `/accounting/documents/getdetails/` / `/list/` — reconcile our records vs SUMIT.
- `/billing/recurring/charge/` + `/listforcustomer/` + `/cancel/` — recurring billing (הוראת קבע) for memberships/subscriptions.
- `/billing/payments/charge/` + `/multivendorcharge/` — direct charge (multivendor = marketplace split).
- `/creditguy/vault/tokenizesingleusejson/` — tokenize card for single use (no PAN stored).
- `/accounting/general/getnextdocumentnumber/` / `/setnextdocumentnumber/` — align our tax sequence with SUMIT's.
- `/triggers/triggers/subscribe/` — SUMIT → our webhook for document/payment events (alternative to polling).
- `/sms/sms/send/` — only if we route SMS via SUMIT (we use Twilio; likely skip).

## Full surface (for mapping)

**Accounting · Transactions:** `/books/transactions/createbatch/`
**Accounting · Customers:** create · update · getdetailsurl · createremark
**Accounting · Documents:** send · getpdf · getdetails · create · addexpense · cancel · movetobooks · getdebt · getdebtreport · list
**Accounting · General:** verifybankaccount · getvatrate · getexchangerate · updatesettings · getnextdocumentnumber · setnextdocumentnumber
**Accounting · IncomeItems:** create · list
**CreditGuy · Billing:** load · process · getstatus
**CreditGuy · Gateway:** transaction · gettransaction · beginredirect · getreferencenumbers
**CreditGuy · Vault:** tokenize · tokenizesingleuse · tokenizesingleusejson
**CRM · Data:** createentity · updateentity · archiveentity · deleteentity · listentities · getentity · countentityusage · getentityprinthtml · getentitieshtml
**CRM · Schema:** getfolder · listfolders   **CRM · Views:** listviews
**Customer service · Tickets:** create
**Deals:** adddeal · createremark
**Email subscriptions · MailingLists:** list · add
**Fax:** send
**Payments · GeneralBilling:** openupayterminal · setupaycredentials  (← uPay terminal)
**Payments · PaymentMethods:** getforcustomer · setforcustomer · remove
**Payments · Payments:** charge · multivendorcharge · get · list · beginredirect
**Payments · Recurring:** listforcustomer · cancel · charge · update · updatesettings
**Scheduled documents:** createfromdocument
**SMS:** mailinglists/list · mailinglists/add · sms/send · sms/sendmultiple · sms/listsenders
**Stock:** list
**Triggers:** subscribe · unsubscribe  (make.com/zapier or direct)
**Website · Companies:** create · update · getdetails · listquotas · installapplications
**Website · Permissions:** set · remove   **Website · Users:** create · loginredirect

## See also
[[sumit-api-reference-2026-06]] (memory) · server/services/SumitClient.ts · SumitSyncService.ts · payments-sumit.ts · sumit-webhook.ts
