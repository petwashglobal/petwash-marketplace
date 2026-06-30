# Legal Protection Pack — Israeli-law compliance verification (2026)

**Purpose:** the diligence counsel asked for before proceeding — verify the pack
([[legal-protection-pack-2026-INDEX]]) against current Israeli law, with explicit
attention to the **Wolt** risks. **This is sourced research, NOT a substitute for
the licensed lawyer's formal sign-off.** Do NOT flip `reviewedByCounsel: true` on
the strength of this document alone — that is the lawyer's signature.
Labels: ✅ aligned-with-law (verified) · ⚠️ judgment-call (lawyer must confirm) · 🔴 live-risk.

## ✅ OFFICIAL GOV-SOURCE VERIFICATION (counsel's condition: "if gov website confirms the facts, go ahead")
Verified 2026-06-30 against official Israeli government / authority sources:
- **VAT = 18%** — raised from 17% effective **1 Jan 2025** (Israeli Tax Authority, confirmed 5 Dec 2024). **2026 stays 18%** (the proposed 19% Jan-2026 rise was avoided). ✅ **PetWash code already uses 18%** — correct. ⚠️ keep VAT a CONFIG value (not hardcoded) — 19% could return.
- **§17a total/all-inclusive price** — gov.il **Consumer Protection & Fair Trade Authority**: total price must be shown **before** the transaction; Amendment 39 → administrative sanctions **₪7,000–45,000 per violation**. (This is the Wolt-1 trap — gov-confirmed.)
- **Amendment 13 (Privacy Protection Law)** — Ministry of Justice / **Privacy Protection Authority**: **in force since 14 Aug 2025**; PPA may impose admin fines (example range up to **₪320,000 per database**). Official unofficial-translation of the law on gov.il.
- **Regulation of Payment Services Law 2023** — Knesset: in force June 2024 (closed-loop / exemption framework).
GOV SOURCES: Israeli Tax Authority gov.il/en/pages/about-israel-taxes-authority + Knesset VAT order press release; gov.il Consumer Protection & Fair Trade Authority (Smart Consumerism guide, Amendment 39); gov.il Privacy Protection Authority + Ministry of Justice legislation page; main.knesset.gov.il (Payment Services Law). VAT rate also corroborated by Israeli Tax Authority announcements + Herzog/Sovos.

## The TWO Wolt traps (the lawyer's warning) — both apply to a marketplace

### 🔴 Trap 1 — Consumer pricing (Consumer Protection Law §17a)
- The law requires the **total, all-inclusive price** (product + VAT + all fees +
  any unwaivable accompanying payment such as a **platform/handling fee**) shown
  **before** the transaction concludes. Adding an "operating/service fee" only at
  checkout is the violation. (Sources: gov.il consumer guide; dinolaw "service
  providers must display the full price"; Barnea consumer-protection updates.)
- **Wolt precedent (memory):** class action 53918-06-23 settled ~₪3.75M over split
  platform fees — the template a plaintiff lawyer will reuse against any Israeli
  platform that splits fees.
- **PetWash exposure & rule:** EVERY price on every surface (booking, marketplace,
  shop, eGift, top-up) must show the **all-in total upfront**, with the marketplace
  **commission folded into the displayed price**, never added later. Doc `01`
  (customer ToS) + `07` (cancellation/refund) + `11` (shop terms) must say this and
  the **code must enforce it**. (We already track §17a as done — this requires a
  concrete re-check of the marketplace commission display.)

### 🔴 Trap 2 — Provider classification (employee vs independent contractor)
- Israeli courts use the **Combined/Composite Test** with the **Integration Test at
  its core**, and apply **substance-over-form**: *a contractor agreement gives NO
  protection if the real relationship looks like employment.* (Sources: CWS Israel
  2026 test; IsraelLaw.info; HG.org misclassification.)
- **Wolt labour ruling (2022)** + a **June 2024 Labour Court ruling** → courts are
  increasingly **employee-friendly for gig platforms**. Misclassification = back-pay
  of all statutory rights (pension, severance, vacation, sick, Bituach Leumi) **+
  fines up to ~₪75,000 per worker.**
- **PetWash exposure & rule:** docs `02` (provider agreement), `04`/`05` (premises),
  `09` (tax/insurance) and the `independent_provider` / `no_franchise_no_agency`
  declarations are necessary but **NOT sufficient.** To genuinely be contractors,
  providers must in SUBSTANCE: set/own their pricing or have real freedom, serve
  multiple clients (non-exclusive), be free to **reject** jobs, bear their **own
  commercial risk**, and carry **own insurance**. 🔴 AVOID employee markers:
  mandatory shifts, fixed wage, exclusivity, PetWash-dictated working hours,
  integration into PetWash's core operation. ⚠️ The lawyer must confirm the actual
  operating model passes the Combined Test — paper alone won't.

## Per-document verification

| Doc | Governing 2026 law | Status |
|---|---|---|
| `01` customer ToS / pricing | **§17a total-price** (Wolt trap 1) | 🔴 enforce all-in price in code + ToS |
| `02` provider agreement | **Combined Test / substance-over-form** (Wolt trap 2) | ⚠️ lawyer must confirm model is genuinely independent |
| `03` not-insurance disclaimer | Insurance regulation; consumer-protection (no misleading) | ⚠️ confirm "not insurance" framing + the reimbursement-not-insurance design |
| `04`/`05` premises addenda | Contractor classification + occupier liability | ⚠️ tie to trap-2 substance |
| `06` privacy policy | **Amendment 13 (in force 14 Aug 2025)** | 🔴 see below |
| `07` cancellation/refund | §14ג cancellation + §17a (no surprise fees) | ⚠️ confirm §14ג windows + all-in |
| `08` IP/brand | Standard IP — lower risk | ✅ |
| `09` provider tax/insurance | Contractor status (own risk/insurance supports it) | ⚠️ supports trap-2 defense |
| `10` incident claim form | Consumer-protection + the Guarantee terms | ⚠️ |
| `11` shop terms | §17a + distance-selling/§14ג | 🔴 all-in price |

## 🔴 Amendment 13 (Privacy) — in force, enforcement now (doc `06` + `privacy_data_handling`)
Verified obligations (sources: BigID, Safetica, Pearl Cohen, Ius Laboris):
- **Personal data now includes IP, online identifiers, geolocation;** "especially
  sensitive" = biometric, genetic, criminal, financial. (We collect device/IP in
  signing + biometric/ID in KYC → in scope.)
- **Consent must be informed, voluntary, explicit, GRANULAR** — no bundled consent;
  notices must state purpose, recipients, AND the **consequences of refusing**.
- **Security:** encryption, access control, audits. **DPO** if systematic monitoring
  / sensitive-data processing (grace ended 31 Oct 2025 — ⚠️ lawyer: do we need one?).
- **Cross-border transfer** rules (adequacy + agreements) — relevant (Firebase/Google,
  SUMIT, hosting).
- **Penalties:** PPA fines in the millions; **statutory damages up to ₪100,000
  without proof of harm**; extraterritorial reach. 2026 = active enforcement.

## What "smart, by the book" means for PetWash — action list
1. 🔴 **Pricing (anti-Wolt-1):** code audit — confirm marketplace commission + all fees
   are inside the displayed total on every surface, upfront. (Highest-ROI fix.)
2. 🔴 **Classification (anti-Wolt-2):** lawyer reviews the *operating model* (not just
   the agreement) against the Combined Test; remove any employee markers.
3. 🔴 **Privacy:** lawyer confirms Amendment-13 conformance (DPO?, granular consent,
   refusal-consequences notices, cross-border agreements, security).
4. ⚠️ Lawyer formally approves each declaration → THEN `reviewedByCounsel: true` +
   Hebrew translation + DocuSeal templates + flip `PROVIDER_DECLARATIONS_ENFORCE`.

## Sources
- §17a / full-price: gov.il consumer guide; https://www.dinolaw.co.il/en/all-the-articles/service-providers-are-obligated-to-display-the-full-price/ ; Barnea consumer-protection updates; Arnon Tadmor-Levy (platforms).
- Amendment 13: https://bigid.com/blog/what-israel-amendment-13-means-for-businesses-in-2025/ ; Safetica; Pearl Cohen; Ius Laboris.
- Classification: https://www.cwsisrael.com/independent-contractor-vs-employee-israel/ ; IsraelLaw.info; HG.org. Wolt labour ruling 2022 + June 2024 Labour Court ruling.
- Class actions 2026 (ICLG Israel). Wolt consumer settlement: class action 53918-06-23 (~₪3.75M).
