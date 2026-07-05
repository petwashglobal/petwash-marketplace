# CPA memo — VAT on marketplace bookings (disclosed-agent vs principal)

**For:** PetWash Ltd accountant (רו"ח קופרברג עזרא ושות')
**From:** PetWash engineering, 2026-07-05
**Status:** DECISION REQUIRED before any code change. Not implemented — flagged.

> This is the one item from the 2026-07-05 fiscal audit that engineering will **not**
> change without your sign-off, because it changes what PetWash declares to the ITA.

## The finding

On a marketplace booking (pet sitting, dog walking, academy — sitter/walker/instructor
is an **independent provider**), PetWash issues the customer a חשבונית מס/קבלה and
computes **VAT (18%) on the FULL customer charge**.

- Code: `server/services/IsraeliDigitalReceiptService.ts:366`
  `const vatBreakdown = this.calculateVATBreakdown(params.totalAmount);`
- The booking passes `totalAmount = full customer charge`
  (`sitter-suite.ts:1137`, `walk-my-pet.ts:806`, `academy.ts:591`).

**The inconsistency:** PetWash's own **payout/settlement** code already treats PetWash as a
**disclosed agent** — it computes broker commission and VAT **on the commission only**, per
עוסק פטור/מורשה status (`IsraeliDigitalReceiptService.calculateProviderSettlement`,
`calculateVATBreakdown`-style commission math at lines ~289–303). So the settlement side says
"agent, VAT on commission"; the customer-receipt side says "principal, VAT on the whole
amount." One of them is wrong.

## Example (numbers)

A ₪500 pet-sitting booking, 15% platform commission (₪75), provider keeps ₪425.

| Model | PetWash's customer receipt | PetWash output VAT declared | Provider issues |
|---|---|---|---|
| **A — Disclosed agent** (memory says this is the intended model) | קבלה for ₪500 received *on behalf of the provider*; PetWash tax-invoices its **₪75 commission** (VAT ₪11.44 of it) | VAT on **₪75** only | Their own invoice for **₪425** (VAT if עוסק מורשה) |
| **B — Principal / reseller** | חשבונית מס/קבלה for the full ₪500 (VAT ₪76.27) | VAT on **₪500**, minus input VAT on what it pays the provider | Invoice to **PetWash** for ₪425 |
| **Current code** | חשבונית מס/קבלה for full ₪500, VAT ₪76.27 | VAT on **₪500**, **no input-VAT offset wired** | (provider side handled separately) |

The current code matches **B's customer document** but **without B's input-VAT mechanics** and
**against** the disclosed-agent model the payout code implements → PetWash is likely
**over-declaring output VAT** on the marketplace GMV.

## What we need you to decide

1. **Which model** applies to PetWash marketplace bookings — **A (disclosed agent)** or **B
   (principal/reseller)**? (Memory + prior guidance say A.)
2. Under the chosen model, **what document should PetWash issue the customer** for a booking,
   and **on what amount is PetWash's VAT**?
3. Does it differ by provider tax status (עוסק פטור vs עוסק מורשה vs חברה)?

## What engineering will do once you confirm

- **If A (disclosed agent):** change the booking customer document so PetWash's VAT is on the
  **commission** (the settlement code already computes it — we reuse `brokerCommission` /
  `vatOnCommission` instead of `params.totalAmount`), and issue the customer a receipt for
  money received on behalf of the provider. Wire provider-side invoicing per status.
- **If B (principal):** keep full-amount VAT on the customer receipt **and** wire the
  **input-VAT offset** on provider payouts (currently missing), so net VAT is correct.

Either way it is a ~1-file change to the receipt call; the blocker is the **tax decision**, not
the code. Reference the settlement math already in `calculateProviderSettlement`.
