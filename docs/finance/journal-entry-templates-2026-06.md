# PetWash™ — Journal-Entry Templates (illustrative)

| | |
|---|---|
| **Date** | 2026-06-12 |
| **Status** | ILLUSTRATIVE templates — structural debit/credit patterns for PetWash's money events. NOT a posted period close; example amounts only. **Review with the CPA before posting.** |
| **Basis** | VAT 18% (18/118 of any VAT-inclusive total); disclosed-agent marketplace posture + multi-purpose-voucher treatment per `platform-tax-360-2026-06.md` + ruling 1108/25. |
| **Why** | Give the bookkeeper the correct structure to post from the day money flows, so the accountant confirms rather than designs. |

> No live GL exists yet (shop preview, online payments unwired). Amounts below are illustrative (₪100 / ₪149 examples). The VAT split and the disclosed-agent commission treatment are the parts that matter — confirm with the CPA.

## 1. eGift sale — ₪100 multi-purpose voucher — *NO VAT at sale*
| Account | Debit | Credit | Memo |
|---|---|---|---|
| Cash / clearing | 100.00 | | eGift sold; קבלה (receipt), not חשבונית מס |
| Gift-card liability (deferred) | | 100.00 | liability until redeemed |

Multi-purpose voucher = negotiable instrument, excluded from "טובין"; sale is not a VAT event. VAT crystallises at redemption.

## 2. eGift redemption — ₪100 spent on a K9000 wash (100% PetWash) — *VAT here*
| Account | Debit | Credit |
|---|---|---|
| Gift-card liability | 100.00 | |
| Wash revenue | | 84.75 |
| VAT payable (18/118) | | 15.25 |

## 3. eGift breakage — ₪100 expired unredeemed (ruling 1108/25) — *now VAT-able*
| Account | Debit | Credit |
|---|---|---|
| Gift-card liability | 100.00 | |
| Breakage revenue | | 84.75 |
| VAT payable | | 15.25 |

## 4. Marketplace booking — ₪100 service, 15% commission (disclosed agent)
| Account | Debit | Credit | Memo |
|---|---|---|---|
| Cash / clearing | 100.00 | | consumer pays |
| Payable to provider | | 85.00 | provider's revenue (their VAT, their osek status) |
| Commission revenue | | 12.71 | PetWash 15%, net |
| VAT payable (18/118 of ₪15) | | 2.29 | VAT on **commission only**, not GMV |

Payout leg: Dr Payable to provider 85.00 / Cr Cash 85.00. The disclosed-agent structure is *why* VAT is on ₪15, not ₪100 — the document must name the provider + state agency (tax-360 §2).

## 5. Shop product — ₪149 engraved collar (100% PetWash)
| Account | Debit | Credit |
|---|---|---|
| Cash / clearing | 149.00 | |
| Product revenue | | 126.27 |
| VAT payable (18/118) | | 22.73 |

Plus COGS at landed unit cost: Dr COGS / Cr Inventory.

## 6. K9000 wash via Nayax (kiosk, 100% PetWash) — ₪50 example
| Account | Debit | Credit |
|---|---|---|
| Cash / clearing (Nayax settlement) | 50.00 | |
| Wash revenue | | 42.37 |
| VAT payable (18/118) | | 7.63 |

Nayax settlement fee posts separately (Dr Payment-processing expense / Cr Cash) per the Nayax statement.

## Review checklist (per entry)
- Debits = credits ✓
- VAT = 18/118 of the VAT-inclusive total ✓
- eGift liability reverses on redemption/expiry (event-based, not period accrual) ✓
- Marketplace VAT scoped to commission (disclosed agent) ✓
- Allocation number (מספר הקצאה) required on any B2B invoice ≥ ₪5,000 (tax-360 §1) ✓

## Not covered here (need real inputs when they exist)
- Depreciation on K9000 stations (`/je fixed-assets`) — needs the asset register + method/useful-life.
- Prepaid amortisation (insurance/software) — needs the invoice + term.
- Payroll accruals — when there's payroll.

These become real `/je` entries once the numbers/books exist.
