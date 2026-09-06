# Rail B — Supplier / Expense Automation into SUMIT

| | |
|---|---|
| **Status** | DESIGN NOTE ONLY — **NOT SCHEDULED**. No code, no migrations, no routes, no flags. |
| **Date** | 2026-09-06 |
| **Blocked behind** | Rail A (K9000 income → Nayax → SUMIT) must be finished, live and stable first. |
| **Company** | פט וואש בע"מ / Pet Wash Ltd, VAT 18% |
| **Fiscal source of truth** | SUMIT (app.sumit.co.il). This design does not create a second one. |

---

## 0. Why this note exists

SUMIT currently holds income and **an empty expenses module**. The consequence is
narrow and factual: the cash-flow report shows revenue against zero cost, so the
profit picture it displays is not the real one. Rail B is the work that would fill
the expense side. It is written down now so the shape is agreed; it is deliberately
not scheduled.

**Rail A** (income) is out of scope here: K9000 stations → Nayax terminals → fiscal
bridge (`server/services/nayaxSumitBridge.ts`) → one SUMIT `InvoiceAndReceipt` per
settled transaction. Rail B is the mirror on the money-OUT side, and it is a
*different animal*: income documents are generated from events we ourselves caused,
whereas expense documents are generated from **documents other people send us**. We
do not control their format, arrival time, or accuracy. That asymmetry drives every
safety rule below.

---

## 1. HARD SAFETY RULES (non-negotiable)

These are stated first because they constrain everything after them.

1. **Never infer an expense from a bank movement, an email body, a spreadsheet, or a
   dashboard placeholder, and never book it automatically.** A debit on the bank
   statement is evidence that money left. It is *not* an accounting document and it
   never becomes one by itself.
2. **Every SUMIT expense entry must be supported by one of exactly three things:**
   a supplier document, actual payment evidence, or an explicitly defined
   supplier-payment workflow (see §3). Nothing else may create an entry.
3. **No invented VAT.** VAT is read off the supplier document or it is not recorded.
   It is never derived by multiplying a total by 0.18 because "that is usually the
   rate". Exempt suppliers, zero-rated items, and עוסק פטור suppliers exist.
4. **No guessed supplier invoice number.** If the document number cannot be read, the
   item stops for a human. Placeholders such as `UNKNOWN`, `N/A`, or a generated
   sequence are forbidden.
5. **No duplicate invoice.** A supplier invoice is booked once. Deduplication is a
   gate, not a report.
6. **AI/OCR may EXTRACT; it may never FABRICATE.** A missing accounting field stays
   missing. High-confidence extractions may auto-populate a draft; anything ambiguous
   is marked `NEEDS_REVIEW` and waits for a person.
7. **No AI decides tax deductibility.** Classification follows rules the bookkeeper
   has approved in advance. An unmapped supplier or an unmapped expense type is an
   exception, not a judgement call for the system.
8. **The bookkeeper is the authority on treatment.** Engineers report observations —
   "SUMIT expenses module is empty", "this invoice has no VAT line". Engineers do
   **not** state fiscal treatment, VAT period, deductibility, or legal sufficiency.
   This note follows its own rule: it describes plumbing, not accounting rulings.

---

## 2. Target flow

```
supplier invoice arrives (email / PDF / uploaded file)
  → Pet Wash expense intake            (capture + store the original, hashed)
  → identify supplier                  (known supplier, or exception)
  → extract invoice number, date, amount, VAT
  → deduplicate                        (supplier × invoice number × date × amount)
  → create the appropriate SUMIT supplier/expense document   (§3)
  → connect payment if already paid
  → flag exceptions for review         (never guess, never silently drop)
```

Every stage may only ever move an item forward to `NEEDS_REVIEW`. No stage is
permitted to invent a value in order to keep the pipeline flowing.

---

## 3. The three SUMIT document choices (must be exact)

The choice depends on **what exists at the moment we record**: the document, the
payment, or both.

| Situation | SUMIT document | Notes |
|---|---|---|
| Supplier invoice received **AND** already paid | **`חשבונית ותשלום לספק/ית`** | The single combined document. Use only when both the invoice and a real payment are in hand. |
| Invoice exists, **payment will happen later** | **`חשבונית ספק/ית`** | Records the liability. The payment is connected later; it is not pre-recorded. |
| Pet Wash **paid**, but the supplier invoice **has not arrived yet** | **`תיעוד תשלום לספק/ית`** | This is the *payments-awaiting-invoice* workflow — **"תשלומים מחכים לחשבונית"**. The payment is documented and left open until the supplier's invoice arrives and is matched to it. |

Consequences that follow directly from the table:

- The third row is the correct answer to "we paid but have no invoice". Booking a
  `חשבונית ספק/ית` with fabricated details, in order to make the books look
  complete, is the exact failure mode this note exists to prevent.
- An item may legitimately sit in the awaiting-invoice state for a long time. That
  is a visible, honest open item — not an error to be cleared by inventing a
  document.
- Whether a given case belongs in row 1 or rows 2+3 is a bookkeeping decision when
  it is not obvious. The system's job is to present it, not to settle it.

---

## 4. Real expense categories for this business

Not a taxonomy proposal — this is the actual cost base that would flow through
Rail B, useful for sizing the supplier list and the classification rules the
bookkeeper would approve:

- Nayax monthly terminal fees
- Water
- Electricity
- K9000 consumables
- Shampoo / conditioner
- Station maintenance
- Insurance
- Freight
- Municipal costs
- Contractor / vendor invoices

Each category maps to one or more known suppliers. An invoice from a supplier with
no mapping is an exception, handled by a human — never auto-classified by
similarity to a category name.

---

## 5. Later phase — "smart intake"

Only after the manual path in §2 is running, understood, and trusted. The
automation adds speed; it must not add authority.

```
accounts@ email intake
  → supplier PDF attachment captured + stored (original preserved, hashed)
  → recognise supplier, document number, document date, totals, VAT
  → duplicate check against everything already booked
  → match against a known payment (bank / card / awaiting-invoice item)
  → produce a DRAFT / REVIEW item — never a booked document
  → on human approval: SUMIT expense API call (§3 chooses the document type)
  → the accountant sees a clean exception queue, not a pile of raw PDFs
```

Properties this phase must keep:

- **Draft-first.** Extraction produces a draft. A person promotes it. There is no
  confidence threshold high enough to skip that for a document type we have not
  proven.
- **Idempotent send.** One supplier invoice ↔ one SUMIT document, with a
  deterministic key, so a retry can never issue a second entry. Rail A already
  applies this discipline (`nayax-bay:<TransactionID>` in `nayaxSumitBridge.ts`);
  Rail B needs the same guarantee before any automated send.
- **The exception queue is the product.** The measure of success is not "how many
  invoices were booked automatically" but "how short and how honest the review
  queue is".
- **Originals are never discarded.** The PDF is the evidence; the extracted fields
  are a convenience layer over it.

---

## 6. Open questions / not decided

Listed as unresolved rather than assumed. None of these should be answered by an
engineer alone.

1. **SUMIT expense API surface is UNVERIFIED.** `server/services/SumitClient.ts`
   today calls only `/accounting/documents/create/`, `/accounting/customers/*` and
   `/accounting/general/getvatrate/`. No supplier/expense endpoint has been probed
   or confirmed. Whether the three document types in §3 are all reachable via API —
   or whether some are UI-only — is unknown and must be established from SUMIT's own
   Swagger before any build.
2. **Supplier master data.** Where the canonical supplier list lives, and how it
   relates to the existing `suppliers` / `supplier_invoices` structures already in
   the repo (see `docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md`
   and `docs/design/2026-05-27-universal-outgoings-ap-engine.md`). Rail B should
   extend those, not fork a third supplier concept.
3. **Duplicate key definition.** Supplier × invoice number is the obvious key, but
   suppliers reuse numbers across years and some issue credit notes on the same
   number. The exact key needs the bookkeeper's confirmation.
4. **Credit notes / זיכוי from suppliers.** Not covered above at all. Needs its own
   treatment.
5. **Recurring fixed costs** (Nayax monthly fee, insurance premium). Whether these
   are booked from the arriving document each period, or under a standing
   arrangement, is a bookkeeper decision.
6. **Who approves.** The role that may promote a draft to a booked SUMIT expense,
   and whether a second pair of eyes is required above a threshold.
7. **Matching payments.** Bank data ingestion is not designed here, and per rule
   §1.1 bank movement alone can never create an expense — its only possible role is
   *matching* an existing document or awaiting-invoice item.
8. **Historical backlog.** Whether past expenses get loaded at all, and by whom. Not
   an engineering decision.

---

## 7. Scheduling

**NOT SCHEDULED.** Rail A (K9000 income → Nayax → SUMIT) must be complete and
stable in production before any Rail B work begins. Until then this note is a
description of the intended shape, and nothing in it should be read as a commitment
or as an approved accounting method.
