# Petah Tikva Municipality — K9000 pilot contract (2026)

**Source:** `petah-tikva-k9000-pilot-contract-2026.pdf` (Hebrew original, found on the CEO's Desktop as `contract_response_clean.pdf`, not previously in the repo). This is a real municipal contract, not a template — Petah Tikva's tender committee approved a sole-supplier exemption on **1.3.2026**. Preserved here so it's versioned instead of living only on one laptop. This summary is for engineering/ops orientation — it does not replace reading the actual Hebrew contract for anything binding.

## Deal shape
- 2× **PetWash™ K9000 R Twin** units on municipal land, self-service (no PetWash staff contact), card-only payment.
- Pilot term: **6 months**, extendable up to another 6 months by written agreement (30 days' notice).
- Term clock starts only once the city confirms in writing that installation + utility hookups are complete and PetWash confirms all required tests passed.
- Municipality can terminate anytime with 30 days' notice, no compensation owed beyond amounts already due.

## Money terms — real, binding
| Term | Value |
|---|---|
| Municipality's cut | **8.5% of all machine revenue** |
| Max customer price | **₪55/wash incl. VAT**, CPI-linked, adjusted annually or by mutual agreement |
| Required discount — seniors (65+) / disabled | **10%**, must be registered in the municipality's dog database + present an eligibility certificate |
| Required discount — PetWash club members | **5%**, applied automatically via the payment system |
| Per-machine utility connection cost | **₪20,000 + VAT**, paid by PetWash to the municipality, subject to a detailed quote and PetWash's prior approval |
| Payment collection | Card-only, via a "licensed Israeli clearing company (e.g. Nayax)" — named explicitly in the contract |
| Reconciliation | Monthly official clearing report from PetWash → municipal veterinary service manager (verifies it) → treasury (הגזברות) |
| Late-fix penalty | ₪250/day if a broken machine isn't fixed within 24h of notice |
| Late-removal penalty | ₪1,000/day if machines aren't removed within 21 days of contract end |
| Insurance deductible cap | ₪100,000 per incident/series from one cause; 60 days' notice before any policy cancellation/downgrade |

## Hardware / install spec (Appendix A) — confirms the real numbers
Matches [[live-bay-wash-prices-confirmed]] and prior K9000 spec docs: single-phase 240V 25A (or 415V 40A three-phase if using the built-in water heater), 40-72psi water pressure, RPZ backflow preventer required, ~40-50L water per wash, ~0.76kWh energy per wash, noise ~66dBA at 4m, footprint 3.7m × 1.85m × 0.68m, ~350kg. Digital screen required showing remaining time + wash stage.

## Safety spec (Appendix B, referenced)
1.2m perimeter fencing per unit, 92cm self-closing gate, and either 50cm rear technician clearance or a full rear service room/cover.

## Data/privacy annex (Appendix E) — worth knowing
- The system must be **fully stand-alone / air-gapped from the municipal network** — no connection to city systems or data stores in either direction.
- PetWash is fully and solely liable for the system: security, privacy, PCI-DSS, uptime, backup, recovery — the municipality bears **zero liability**.
- TLS 1.2+, MFA, ≥24 months of logs, 24-hour breach notification to the municipality's security officer, full data erasure on contract end.
- No raw card data may be stored locally — clearing company only. (Consistent with existing governance doctrine: "no raw card data handled by PetWash DOM or backend.")

## 🔴 Real gaps found while cross-checking this against the live codebase (2026-07-01)

1. **Municipality revenue-share: infrastructure exists, not yet configured.** `shared/schema.ts` already has `partners` (with `type: 'municipality'`, `revenueSharePercent`) and `partnerAgreements` (per-station %, min/max monthly amount) tables, and they're genuinely wired into `FinanceSettlementService.ts` / `server/routes/finance/settlements.ts` — not dead schema. **This is a configuration gap, not a code gap**: once the 2 stations are commissioned, someone needs to create a `partners` row for Petah Tikva (8.5%) and a `partnerAgreements` row per station. No new code required.

2. **Senior/disabled discount tied to a municipal dog registry — not built.** The existing discount system (`KioskCouponService` etc.) supports the 10%/5% *caps* correctly, but there's no mechanism to check eligibility against "registered in the municipality's dog database + presented an eligibility certificate." Today this would have to be a manual/offline verification (e.g., a coupon code issued by the city), since no code path checks a municipal registry.

3. **Security cameras — not addressed anywhere found.** §6.2 requires PetWash to install internal + external 24/7-recording security cameras at each unit, at its own cost, with the *capability* to connect to the municipal control center on request. No hardware/vendor decision or software integration for this exists yet in any doc reviewed this session.

4. **CPI-linked price adjustment — no mechanism found.** The ₪55 cap is explicitly CPI-linked with annual/negotiated adjustment. No automated CPI-tracking or price-ceiling-enforcement logic was found; today this would be a manual annual price review.

5. **Monthly municipal reconciliation report — generic reconciliation exists, this specific report format does not.** The existing `FinanceSettlementService` reconciliation is not confirmed to produce the specific "official clearing report" format this contract requires for the municipal veterinary service.

None of these are urgent until the 2 units are actually installed (they're in storage per prior session notes) — but they're real, concrete pre-launch items for whichever city goes live first.
