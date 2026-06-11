# PetWash™ Platform Tax 360° — Israeli VAT/invoicing across all three money models

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Status** | Research synthesis — sourced from official gov.il/primary-law pages + platform comparators. Four items flagged for verbatim verification + one accountant confirmation letter (template at bottom) |
| **Requested by** | CEO 2026-06-11: "send legal israel agent and source the way… all wrapped 360 degrees… I need facts" |
| **Companions** | VAT attribution matrix (PR #375 companion doc), `docs/legal/shop-returns-cancellation-policy-2026-06-10.md`, sibling commerce SDD `docs/design/2026-05-25-commerce-promotions-pricing.md` |
| **Method note** | Research agents could read search-engine extracts of official pages but not always the full documents; every claim carries its source URL and a CONFIRMED/SECONDARY/UNVERIFIED label. Open the URL before quoting in anything legal-facing. |

---

## 0. The one-paragraph version

VAT is **18%** (since 1.1.2025; no 2026 change enacted). For the **marketplace**, Israeli VAT's disclosed-agent rule decides everything: if the provider's name and the agency fact appear on the customer-facing documents, PetWash owes VAT **only on its 15% commission**; if not disclosed, the law deems two back-to-back sales and VAT is owed on **100% of the booking**. For **eGifts**, sale of a multi-purpose voucher is not a VAT event (קבלה at sale, VAT at redemption) — but 2025 tax ruling **1108/25** makes **expired unredeemed balances VAT-liable**, and the **January-2026 gift-card regime** requires an **annual balance/expiry notice** to holders and extendability up to 15 years for balances over ₪150. The **allocation-number threshold dropped to ₪5,000 on 1.6.2026** — live now, both for invoices we issue and invoices we accept. Every comparator platform (Wolt, Gett, Uber, Rover, MadPaws) runs the same venue model PetWash runs; the two failure modes on record are hidden fees at checkout (Wolt, twice) and controlling providers like employees (Wolt couriers, Uber UK).

## 1. Model A — Stations + Shop (100% PetWash revenue)

Straightforward: PetWash is the seller. Consumer prices VAT-inclusive (18/118 embedded), SUMIT issues חשבונית מס/קבלה.

- **VAT 18%** — CONFIRMED: ITA interpretation directive on the increase ([gov.il PDF](https://www.gov.il/BlobFolder/dynamiccollectorresultitem/represent-info-051224-2/he/vat_represent-info-051224-2.pdf)); rate history ([gov.il](https://www.gov.il/he/pages/vat-history)). The floated 2026 return to 17% did not happen (ynet, SECONDARY).
- **Allocation numbers (חשבוניות ישראל)** — CONFIRMED on gov.il: ≥₪10,000 pre-VAT from 1.1.2026 ([gov.il](https://www.gov.il/he/pages/sa311225-1)), **≥₪5,000 pre-VAT from 1.6.2026 — in force now** ([gov.il](https://www.gov.il/he/pages/pa240525-1)). Applies when we ISSUE B2B invoices ≥ threshold (franchise/suppliers/corporate) and when we RECEIVE supplier invoices ≥ threshold (no allocation number → no input-VAT deduction). Verification service: [verify-vendor-invoice-information](https://www.gov.il/he/service/verify-vendor-invoice-information). Our receipt-OCR already extracts מספרי הקצאה (PR #375).

## 2. Model B — Marketplace (15% commission) — the load-bearing rule

**The disclosed-agent rule** (תקנות מס ערך מוסף, התשל"ו-1976 — text via [Wikisource](https://he.wikisource.org/wiki/תקנות_מס_ערך_מוסף); regulation number commonly cited as תקנה 5 — **verify before citing**):

> עוסק המוכר נכס או נותן שירות לקונה באמצעות שלוח הפועל בשמו של העוסק — רואים את העוסק כמוכר או כנותן השירות לקונה, ואת השלוח כנותן שירות לעוסק, **אם עובדת השליחות ושמו של העוסק כשולח צוינו על המסמכים** שמוציא השלוח לקונה; לא צוינו — רואים את הנכס כנמכר או את השירות כניתן **פעמיים**.

- **Disclosed agent** (provider named + agency stated on booking confirmation/receipt): provider sells the service to the consumer; PetWash's VAT-able supply = the 15% commission (+18% VAT on it, invoiced to the provider).
- **Undisclosed**: deemed double sale → VAT on the full booking amount. **This is a document-formatting requirement worth ~15% of marketplace GMV.**
- Comparators run exactly this (CONFIRMED* from their official pages): Gett — the driver's meter issues the only consumer tax invoice and the driver invoices Gett ([Gett driver FAQ](https://www.gett.com/il/help/drivers/)); Rover — "all transactions … are between Pet Owners and Service Providers" ([ToS](https://www.rover.com/terms/tos/)); MadPaws — contract between sitter and owner only, 20% commission with insurance bundled in ([ToS](https://www.madpaws.com.au/about/terms/), [fees](https://help.madpaws.com.au/support/solutions/articles/9000111732)); Wolt — invoices on the merchant's behalf with the merchant's identity on the document, principal only for its own delivery fee ([Wolt IL ToS](https://explore.wolt.com/en/isr/terms)).
- **Conduct guardrail** (why contracts alone don't save you): Wolt IL couriers held de-facto employees by the TLV labor court ([LoC summary](https://www.loc.gov/item/global-legal-monitor/2022-09-13/israel-labor-court-clarifies-labor-relations-rules-applicable-in-platform-economy-businesses/)); Uber UK forced to principal + VAT on full fares after Uber BV v Aslam ([UKSC](https://www.supremecourt.uk/cases/uksc-2019-0029)). Providers must keep real autonomy: own prices, own schedule, accept/decline freedom. Never constrain their off-platform prices (Wolt's ₪5.5M MFN settlement, Dec 2025 — [Wolt's own settlement page](https://explore.wolt.com/he/isr/legal/class-action-settlement-41552-08-22)).

**Paying providers — patur vs murshe vs withholding:**

| | עוסק מורשה | עוסק פטור |
|---|---|---|
| Gives us | חשבונית מס (18% VAT; we deduct as input tax — needs allocation number if ≥₪5,000) | קבלה only — no VAT, nothing to deduct |
| 2026 patur ceiling | — | **₪122,833**/yr ([Kol Zchut](https://www.kolzchut.org.il/he/עוסק_פטור), SECONDARY — confirm on gov.il amounts page) |
| Our 15% invoice to them | חשבונית מס + 18% VAT | same (they just can't deduct it) |

- **ניכוי מס במקור (withholding)**: the platform as payer likely must withhold from provider payouts — default **20%** (30% without proper books), overridden per-provider by their אישור ניכוי מס במקור (0–30%). Primary regulations: [תקנות ניכוי מתשלומים בעד שירותים או נכסים](https://www.nevo.co.il/law_html/law01/255_374.htm) (CONFIRMED text exists; rates/thresholds SECONDARY — verify). **Official per-provider certificate lookup to automate: [secapp.taxes.gov.il/gmIshurim](https://secapp.taxes.gov.il/gmIshurim/firstPage.aspx)** (CONFIRMED official service). Annual reporting Forms 0851/0856 (SECONDARY).
- **Self-billing on providers' behalf**: no general permission found for a platform to issue tax invoices in its murshe providers' names — only narrow cases (תקנה 6א list; agricultural-marketer analogue; חוק מע"מ §20 with the VAT Director's consent). **Wolt does it — presumably under arrangement.** If we want Wolt-style "one document from PetWash," it needs a pre-ruling. Until then: provider issues their own document; we issue the commission invoice + payout statement.

## 3. Model C — eGifts (multi-purpose vouchers)

- **Sale = not a VAT event.** Multi-purpose voucher is a negotiable instrument excluded from "טובין"; issue **קבלה** at sale; VAT crystallizes at redemption by whoever supplies the wash/product/service (ITA position since 1988/2011/2014 rulings; framework restated in **ruling 1108/25**; analysis [Calcalist](https://www.calcalist.co.il/local_news/article/bjaj0011f11le), [Grant Thornton](https://www.grantthornton.co.il/insights1/tax-insignths/2025/value_added_tax/) — SECONDARY describing official ruling; **pull 1108/25 verbatim from the [rulings DB](https://www.gov.il/he/service/preliminary-taxation-decisions)**).
- **NEW — breakage is taxable**: per 1108/25, when a voucher **expires unredeemed**, the retained amount becomes VAT-liable turnover. Our ledger must tag expired-voucher income as VAT-able at expiry.
- **Redemption split follows the model**: redeemed on K9000/shop → we remit 18/118 of the redemption; redeemed on marketplace → provider's supply + our commission VAT per §2.
- **Consumer-law validity (product requirements)**: ≥5-year validity (Amendment 33, since 2014 — [primary law](https://www.nevo.co.il/law_html/law00/70305.htm)); **new January-2026 regime** (SECONDARY press — [TheMarker 14.1.2026](https://www.themarker.com/markets/2026-01-14/ty-article/0000019b-bc43-d6d3-a59b-bd6bafa50000): extendable to 15 years total for balances >₪150; **annual balance+expiry notice required for balances >₪20**; primary instrument not yet located — **verify before building**).

## 4. What this means we BUILD (engineering backlog, in priority order)

1. **Agent-disclosure on marketplace documents** — booking confirmations/receipts must carry the provider's name + business number + "service provided by X; PetWash acts as intermediary" line. ~Copy + template change; worth 15% of GMV in VAT exposure.
2. **Provider KYC additions** — capture per provider: osek classification (already built, PR #375 ✓), withholding certificate (אישור ניכוי) + automated lookup against [gmIshurim](https://secapp.taxes.gov.il/gmIshurim/firstPage.aspx); apply per-provider withholding rate at payout.
3. **eGift annual notice job** — yearly email/SMS with balance + expiry for balances >₪20 (Jan-2026 regime), plus the 15-year extension flow for >₪150.
4. **Breakage VAT tagging** — expired-voucher income flagged VAT-able in the ledger (1108/25).
5. **Allocation-number plumbing** — request numbers on our ≥₪5,000 B2B invoices (SUMIT supports the ITA API); reject/flag supplier invoices ≥₪5,000 without one (screening rule exists for VAT-mismatch — extend it).

## 5. Verbatim-verification list (before anything legal-facing cites this doc)

1. Agency regulation number in תקנות מע"מ (cited as תקנה 5) — open Wikisource/Nevo.
2. Ruling **1108/25** full text from the rulings DB (breakage VAT).
3. 2026 patur ceiling on the official amounts page ([gov.il](https://www.gov.il/he/pages/vat-rate-amount-new)).
4. The January-2026 gift-card instrument (רשומות) — annual-notice + 15-year extension details.

## 6. The one letter to ask the accounting firm for (their liability, our facts)

> "We confirm that: (1) PetWash's marketplace operates as a disclosed agent for VAT purposes and, provided provider identity and agency are stated on customer-facing documents per תקנות מע"מ, VAT applies to PetWash's commission only; (2) sale of PetWash multi-purpose eGift vouchers is not a VAT transaction and a receipt (קבלה) is the correct document, with VAT due at redemption and on expired balances per ruling 1108/25; (3) PetWash's withholding-at-source obligations toward marketplace providers are correctly implemented as [described/attached]."

Three sentences to sign — not billable research.
