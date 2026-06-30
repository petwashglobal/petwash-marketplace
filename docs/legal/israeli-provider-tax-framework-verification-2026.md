# Israeli provider tax framework — gov-sourced verification (2026)

Counsel/CEO asked: make sure the PROVIDER side fits **Israeli** tax law (not US/AU), verified
against trusted Israeli government sources, with the right contract signed per provider ID.
Verified 2026-06-30 against **gov.il (Israel Tax Authority + Bituach Leumi)** and **kolzchut**.

## ✅ The facts (gov-confirmed) — and the code already matches

| Israeli 2026 rule | Official source | In our code |
|---|---|---|
| **VAT = 18%** (raised from 17% on 1.1.2025; 2026 stays 18%) | Israel Tax Authority | `ISRAEL_VAT_RATE = 0.18`; stale 17%s killed (PR #1221) |
| **Osek Patur** turnover ceiling **₪122,833 (2026)** → VAT-EXEMPT | gov.il small-business / kolzchut | `taxStatus = osek_patur` |
| **Osek Murshe** → charges **18% VAT**, remits, deducts input VAT | Israel Tax Authority | `taxStatus = osek_murshe` + `vatNumber`/`osekNumber` |
| **Osek Zair** (≤₪122,833): **30%** auto expense deduction (since 2024), Form 137 | Israel Tax Authority | provider's own filing (off-platform) |
| **Invoice allocation numbers** (חשבוניות ישראל / Economic Efficiency Law 2023): B2B tax-invoice needs an ITA allocation number above the threshold — **₪10,000 from 1.1.2026**, **₪5,000 from 1.6.2026** (ex-VAT) | Israel Tax Authority | `SHAAM_THRESHOLD_PHASE1_ILS=10_000` (2026-01-01), `PHASE2=5_000` (2026-06-01); `israeliTax.ts` → RASA `api.taxes.gov.il/shaam` |
| **Bituach Leumi** self-employed registration (income ≥50% avg wage ₪6,885, or ≥12h/wk + ≥15% ₪2,065) | Bituach Leumi (btl.gov.il) | provider's own responsibility (declared) |

## How a provider is handled, per ID
1. **Onboarding captures** `taxStatus` (osek_patur | osek_murshe | company | not_registered) + `osekNumber`/`vatNumber` + Israeli ID (`provider-onboarding.ts`).
2. **The provider signs** the agreement (#02) + **tax/business-status declaration (#09)** via DocuSeal, bound to their ID — attesting their Osek status and that THEY handle their own VAT, Bituach Leumi, and income tax (independent contractor).
3. **Allocation numbers** are obtained automatically above the SHAAM threshold (`israeliTax.ts` → RASA). **PetWash's own commission VAT** (the 15% platform fee) is computed at a flat 18% on every payout receipt (`ProviderPayoutService.ts`, back-calc 18/118) — correct, and provider-status-independent.

## ⚠️ The ONE thing to confirm → CODE CHECK DONE: gap is real
**Verified 2026-06-30 by reading the code.** The provider's captured `taxStatus`/`osekNumber` do **NOT** flow into any VAT computation today. They are consumed only as a *gate/risk input*: onboarding capture (`provider-onboarding.ts`) → admin review display (`admin-applications.ts`) → risk-engine flag (`applicationRiskEngine.ts`: `wantsPayout && !taxStatus`) → onboarding blocker (`PROVIDER_TAX_CHECK_REQUIRED`). Every VAT figure in the payout/invoice path (`ProviderPayoutService`, `IsraeliInvoiceGenerator`, `LuxuryInvoiceService`, `israeliTax.ts`) is a **flat 18% on PetWash's own commission** — there is **no branch on provider Osek status**. So an Osek-Murshe provider's receipt does **not** yet differ from an Osek-Patur provider's.

Whether it *should* — i.e. modelling the provider's own-service VAT under a disclosed-agent treatment — is the BIGGEST open tax-policy call ([[platform-tax-360-findings]], [[money-tax-integrity-sweep-2026-06-29]]). It needs the CPA, not a guess; do **not** build a VAT-by-status branch without sign-off. The captured fields are ready for it. Everything else above is built + gov-verified.

## NOT US / NOT Australia
No 1099, no SSN, no Stripe-Connect, no AU ABN. This is the Israeli עוסק framework: Osek Patur/Murshe/Company, 18% VAT, חשבוניות-ישראל allocation numbers, Bituach Leumi, ITA via SUMIT/RASA.

GOV SOURCES: gov.il/en/departments/topics/income-tax-small-business-owner-24 (Osek/small business); gov.il/en/service/request-assignment-number-for-tax-invoice (allocation numbers, ₪10k/₪5k 2026); btl.gov.il (Bituach Leumi rates); gov.il Israel Tax Authority (VAT 18%). Corroborated by kolzchut + CWS Israel 2026 guide.
