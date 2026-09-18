# SUMIT + Upay marketplace: how the pieces actually compose

Source: **the OpenAPI spec itself** — `https://api.sumit.co.il/swagger/v1/swagger.json`
(`openapi 3.1.1`, "SUMIT API - Full", 84 endpoints). Read 2026-09-19.

Everything below is read off that document. Where the help centre contradicts it,
the spec wins — and in two places it does contradict it, both in our favour.

---

## Two corrections to what I reported on 2026-09-18

**1. "J5 only" is WRONG.** The help article says of `multivendorcharge`:
*"ניתן לבצע רק תפיסת מסגרת אשראי (J5)"*. The spec says the opposite:

> `AutoCapture` — Should the credit card transaction be captured automatically
> (J4), or only authorized (J5). **Leave empty for "True" (Auto capture).**
> Please note, when setting AutoCapture to false, "Order" documents will be
> issued instead of invoices/receipts.

So immediate capture is the DEFAULT. J5 is an option we may choose, not a
limitation we must design around. The blocking question I was going to email
about is answered.

**2. The clearing rate is documented.** `openupayterminal` takes a `Program`:

> Upay program. **Defaults to the OFFICEGUYNEW10 program (1.5% without payments
> clearing)**

Enum: `OFFICEGUYNEW10`, `UPAYTRANSACTION`, `OFFICEGUYNEWMONTHLY10`,
`OFFICEGUYMONTHLYNEW10`. So a terminal we open through the API lands on **1.5%**
unless we ask for another program. Pet Wash's own existing contract rate may
differ — that is still only visible on the Upay statement / bank deposit — but
for every PROVIDER terminal we would open, 1.5% is the documented default.

---

## The mechanism: one charge, many companies

`POST /billing/payments/multivendorcharge/` takes `Items[]`, and **each item
carries its own company credentials**:

```
MultiVendorChargeItem:
  Item, Quantity, UnitPrice, Total, Currency, Description,
  CompanyID: integer      ← the vendor's SUMIT company
  APIKey:    string       ← that vendor's API key
```

The response is `{ Vendors: [ Charge_Response, ... ] }`, one per vendor, each
with its own `DocumentID`, `DocumentNumber`, `CustomerID`, `DocumentDownloadURL`.

That is the whole thing. ONE card charge to the customer, split into items, and
**each company issues its own document in its own name** for its own share.

For a ₪1,000 job under the gross model:

| item | amount | CompanyID |
|---|---|---|
| the walk / stay / lesson | ₪1,000 | the PROVIDER's company |
| Pet Wash service fee | ₪150 | Pet Wash |

Customer is charged ₪1,150 once. Provider's ₪1,000 settles to the provider's own
Upay terminal and their own bank; Pet Wash's ₪150 settles to ours. The provider's
invoice is issued by the provider's company automatically.

**This is simultaneously the compliance fix and the margin fix.** Pet Wash stops
carrying other businesses' money through its own merchant account (the thing the
Nayax/Upay terms forbid), and stops paying clearing on the provider's share.

Other charge-level flags that matter: `VATIncluded`, `VATRate`, `DocumentType`,
`DraftDocument`, `SendDocumentByEmail`, `DocumentLanguage`, `MerchantNumber`
(only when a company has several terminals), `AuthoriseOnly` (validate without
processing — a real test mode), `SingleUseToken`, `CreditCardAuthNumber`.

---

## The full sequence

### Once per provider, at their FIRST BOOKING — never at signup

1. **`POST /website/companies/create/`**
   Body: `Credentials` (ours), `Company`, `User`, `Applications[]`,
   `BizPackage`, `ApprovePayment`.
   - `Company`: `Name`, `CorporateNumber` (ח.פ./עוסק), `EmailAddress`, `Phone`,
     `Address`, `Country`, `CompanyType`, plus `English_*` variants.
   - `Applications` we need: **`CreditCard` (0)** and **`Accounting` (7)**.
     Spec warns: *"installing applications might incur additional charges."*
   - `BizPackage`: **`P1`** (monthly) or **`P1Yearly`** — the מסלול התחלה
     we priced at ₪19+VAT/month or ₪228/year.
   - `ApprovePayment: true` — spec: *"the calling company must have an active
     payment method and approve the biz package payment."* **We are billed.**
   - Returns: **`CompanyID`, `APIKey`, `APIPublicKey`, `UserPassword`.**

2. **`POST /billing/generalbilling/openupayterminal/`**
   Body: that provider's `Credentials`, `BankCode`, `BranchCode`,
   `AccountNumber`, `Program`.
   Upay then runs its own onboarding on that provider and may refuse.

### Every booking

3. **`POST /billing/payments/multivendorcharge/`** with the two items above.
   `AutoCapture` left empty → J4, money captured, real invoices/receipts issued.
   Store each vendor's `DocumentID` from `Vendors[]` against the booking.

### Refunds

4. **`POST /accounting/documents/cancel/`** — `{ Credentials, DocumentID,
   Description }`. Per document, so the provider's document is cancelled with
   the PROVIDER's credentials and ours with ours. A partial refund is not a
   cancel — that is `documents/create` with a credit type, per company, for that
   company's share.

---

## What this forces us to hold, and the risk in it

`companies/create` hands back **each provider's SUMIT `APIKey`**, and
`multivendorcharge` requires it on every item. So Pet Wash must store a
credential that can issue tax documents and move money in the provider's name.

That is a materially bigger secret than anything we hold today. It belongs in
the same encrypted vault as ID/passport/IBAN (`piiFieldCrypto`), never in a log,
never in an error payload, and it needs a revocation story for when a provider
leaves. This is a design requirement, not a footnote.

---

## What is STILL genuinely unanswered

1. **The contractual question.** Whether this structure satisfies Nayax's and
   Upay's terms is for them to confirm in writing. The spec shows the mechanism
   exists; it cannot tell us we are permitted to operate it.
2. **Pet Wash's OWN clearing rate.** 1.5% is the default for terminals opened
   through the API. Ours was negotiated separately and appears only on the Upay
   statement / bank deposit — SUMIT's clearing reports carry no fee column.
3. **Upay's approval criteria** for individual providers, and the time it takes.
4. **Whether a dormant provider's company can be suspended** rather than closed,
   to stop the ₪228/year bleed.
5. **Webhooks.** `triggers/triggers/subscribe/` is CRM folder/view based
   (`URL`, `Folder`, `View`, `TriggerType`) — it is not a payment-event stream.
   Payment state still has to be read back via `billing/payments/get` /
   `payments/list`, which is what we already do.

Questions 1, 3 and 4 are the email. 2 is the bank statement. 5 is a design note.
