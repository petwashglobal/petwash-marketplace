# Marketplace split clearing — design read off the OpenAPI spec (2026-09-19), NOT built

Source of truth: `docs/finance/sumit-upay-marketplace-integration-2026-09-19.md` (read the spec, not the help centre; where they disagree the spec won twice, both in our favour).

## Why it matters

Today the whole booking amount — the provider's share included — clears through PetWash's own UPay terminal into PetWash's account. That is the structure the aggregator terms may forbid (PetWash clearing for other businesses) and it makes PetWash pay clearing on money that is not its revenue. The marketplace mechanism fixes both.

## The mechanism

`POST /billing/payments/multivendorcharge/` — one card charge, `Items[]`, **each item carrying its own `CompanyID` + `APIKey`**. Response `Vendors[]`, one `Charge_Response` per company with its own `DocumentID` / `DocumentNumber` / `DocumentDownloadURL`. For a ₪1,000 job under the gross model: item 1 ₪1,000 on the provider's company, item 2 ₪150 platform fee on PetWash. The customer is charged once; each company issues its own document in its own name; each settles to its own terminal.

- `AutoCapture` empty = J4 (capture) by default — the help article's "J5 only" is wrong.
- `openupayterminal` `Program` defaults to `OFFICEGUYNEW10` = **1.5 %** for terminals opened via the API. PetWash's own contract rate is only visible on the UPay statement.
- Flags worth knowing: `VATIncluded`, `VATRate`, `DocumentType`, `DraftDocument`, `SendDocumentByEmail`, `DocumentLanguage`, `MerchantNumber`, `AuthoriseOnly` (validate without processing — a real test mode), `SingleUseToken`.

## Sequence

1. Once per provider, at their **first booking** (never at signup): `POST /website/companies/create/` (our `Credentials`, `Company{Name,CorporateNumber,…}`, `User`, `Applications:[CreditCard(0), Accounting(7)]`, `BizPackage: P1 | P1Yearly`, `ApprovePayment:true` — **PetWash is billed ₪19+VAT/month or ₪228/year per provider**). Returns `CompanyID, APIKey, APIPublicKey, UserPassword`.
2. `POST /billing/generalbilling/openupayterminal/` with the provider's credentials + bank details + `Program`. UPay runs its own onboarding and may refuse.
3. Every booking: `multivendorcharge` with the two items; store each vendor's `DocumentID` on the booking.
4. Refund: `POST /accounting/documents/cancel/` per document with that company's credentials; partial = credit document per company.

## The secret this forces us to hold

Each provider's SUMIT `APIKey` can issue tax documents and move money in their name. It belongs in the encrypted PII vault (`piiFieldCrypto`), never in a log or an error payload, with a revocation path when a provider leaves. Design requirement, not a footnote.

## Still open (only the CEO can close these)

1. Written confirmation from SUMIT/UPay that this structure satisfies the aggregator terms.
2. PetWash's own negotiated clearing rate and where the per-transaction fee is visible (SUMIT clearing reports carry no fee column).
3. UPay's approval criteria and lead time per provider; bulk route or one by one.
4. Whether a dormant provider company can be **suspended** rather than closed (₪228/year bleed).
5. Allocation numbers for documents issued in the provider's name.

The seven-question Hebrew email is drafted, unsent: `docs/finance/sumit-marketplace-questions-2026-09-18.md`.

## Do not

- Build any of this behind a flag "just to be ready" — it stores provider credentials and bills PetWash per provider; it needs the answers above and a CPA line first.
- Call `openupayterminal` or `companies/create` from a diagnostic. They are not read-only.
