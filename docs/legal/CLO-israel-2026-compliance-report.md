# CLO / General Counsel Report to CEO — Israel 2026 Legal Compliance

| | |
|---|---|
| **To** | Nir Hadad, CEO, Pet Wash Ltd |
| **From** | General Counsel (legal-engineering function) |
| **Date** | 2026-05-31 |
| **Entity** | Pet Wash Ltd — ח.פ. / VAT 517145033 — עוסק מורשה |
| **Scope** | Every legal surface in the platform — contracts (both ends), website content, marketing, data, tax |
| **Status** | Audit + prioritised remediation plan. NOT legal sign-off. |

---

## 0. Read this first — what this report is and is not

This is a **General Counsel's audit and work plan**, written by an in-house legal-engineering function that reads every contract and page in the platform and maps it against current Israeli law. It is the document you hand to a licensed Israeli עורך דין so they spend their expensive hours on **judgment**, not on discovery.

**It is not a legal opinion and does not create attorney-client privilege.** Five items in this report change binding liability and must carry a licensed עו"ד countersignature before they go live: (1) the franchise/partner agreement, (2) the customer Terms of Service, (3) the Privacy Policy, (4) provider/contractor classification, (5) any consumer-cancellation or auto-renewal terms. Every such item is tagged **[עו"ד SIGN-OFF]** below.

The good news up front: **Pet Wash is far ahead of a typical startup.** You already have a 988-line privacy doctrine, a complete Israeli tax-document architecture, ~20 legal pages, and 12 contract templates. This report is mostly *"close the gaps and update for 2025–2026 law,"* not *"start from zero."*

---

## 1. Executive summary — the five things that can actually cost you money

Ranked by realistic Israeli exposure (class action + regulator), highest first.

| # | Risk | Israeli legal basis | Exposure | Status today |
|---|---|---|---|---|
| **1** | **Marketing without provable opt-in** (SMS / email / WhatsApp / push) | Spam Law — §30א חוק התקשורת (Amendment 40) | **₪1,000 per message, no proof of harm**, courts start at the *maximum*. A single campaign to 5,000 people = ₪5M theoretical class exposure. | Consent infra exists in code; **the legal discipline of "never send without a logged opt-in" is the live risk** |
| **2** | **Privacy law is now enforced with teeth** | חוק הגנת הפרטיות + **Amendment 13, effective 14 Aug 2025** | Admin fines into the **millions of ₪**; statutory damages **up to ₪100,000 without proof of harm**; criminal liability up to 3 yrs; possible **mandatory DPO**. PPA is actively fining. | Your privacy doctrine is built on the **pre-amendment (2017) law** — it predates the biggest change in 40 years |
| **3** | **Surprise pricing at checkout** | חוק הגנת הצרכן §17a; *Wolt* class action (₪3.75M settlement) | Class action; the plaintiff's-bar template already exists and won. | Rule is documented in the platform skill; needs a **page-by-page audit** to prove every price is total-inclusive |
| **4** | **Subscription you can't cancel online** (Prestige Club / loyalty) | חוק הגנת הצרכן — easy-cancellation + auto-renewal notice rules | Statutory damages + regulator. Classic Israeli class-action target. | Prestige Club exists; **online self-cancellation path must be verified** |
| **5** | **Website not accessible** | חוק שוויון זכויות + תקנות נגישות השירות / ת"י 5568 (≈ WCAG 2.0 AA) | **Up to ₪50,000 per claim without proof of damage**; serial plaintiffs target IL sites. | You have accessibility components + statement page; needs a **conformance audit against IS 5568** |

**The one-sentence version for you:** *the platform's legal scaffolding is strong, but four of these five are "operational discipline + verification" problems, not "we don't have it" problems — and #2 (Amendment 13) is a genuine content gap we need counsel on.*

---

## 2. Legal surface inventory (what exists today)

**Contracts — `server/templates/contracts/`**
- `franchise_master_agreement.md` (live, being edited) — partner/operator agreement
- `contractor-sitter-agreement.md`, `contractor-walker-agreement.md`, `driver_contractor_agreement.md`, `trainer_contractor_agreement.md`
- `employment-full-time-israel.md`, `employment-part-time-multi-country.md`

**Customer-facing legal pages — `client/src/pages/legal/` + `client/src/pages/`**
- Terms, Privacy Policy, Cookies, Disclaimer, Trademarks, Accessibility Statement, Marketplace Terms
- Consent surfaces: `CookieConsent`, `ConsentManager`, `BiometricConsentDialog`, `DataProcessingConsent`, `WalletConsentDialog`, OAuth consents, `NotificationConsent`

**Compliance docs — `docs/`**
- `design/2026-05-27-privacy-doctrine-il-plus-gdpr.md` (988 lines) — privacy doctrine
- `architecture/04-israeli-compliance.md` — invoice/VAT/SHAAM lifecycle
- `ISRAELI_ESIGN_COMPLIANCE_2025.md`, `NAYAX_ISRAEL_COMPLIANCE_VERIFICATION.md`, `LANGUAGE_COMPLIANCE_*`, `LEGAL_TRADEMARK_PROPOSAL.md`
- `legal/maya-voice-recording-disclosure.md`

**Compliance services (already in code)** — `IsraelComplianceEngine.ts`, `CountryLegalComplianceService.ts`, `IsraeliContractorCompliance.ts`, `TaxComplianceService.ts`, `ConsentService.ts`, `DataRetentionService.ts`, `NotificationConsentManager.ts`.

---

## 3. The compliance register — BOTH ENDS

### 3A. Customer / consumer end (B2C — website, app, booking, wallet)

| Domain | Israeli law (2026) | Requirement | Gap to verify / fix | Priority |
|---|---|---|---|---|
| **Marketing consent** | §30א חוק התקשורת | Opt-in before *any* marketing on email/SMS/WhatsApp/fax/auto-dialer; one-click opt-out in every message; keep the consent record | Confirm **every** outbound (Twilio/SendGrid/WhatsApp/FCM) passes through `NotificationConsentManager.shouldSend()` — no direct sends; confirm every template has an unsubscribe | **P0** |
| **Pricing disclosure** | §17a חוק הגנת הצרכן | Total inclusive price (כולל מע״מ + כל תוספת) at first sight of any number | Page audit: eGift, all booking flows, wallet top-up, Prestige sign-up, station signage | **P0** |
| **Subscription cancellation** | חוק הגנת הצרכן (עסקה מתמשכת) | Cancel online as easily as you subscribed; advance renewal notice; clear term disclosure | Verify Prestige Club has a working **online cancel**; add renewal-notice + cancellation terms | **P0** |
| **Distance-selling cancellation** | תקנות הגנת הצרכן (ביטול עסקה) 2010 | 14-day cooling-off on qualifying online purchases; published cancellation/refund policy | Confirm `RefundForm` + Terms state the statutory right correctly | **P1** |
| **Privacy / data** | חוק הגנת הפרטיות + **Amendment 13** | Lawful basis, data-subject rights, breach 72h, possibly DPO, updated database obligations | **Update privacy doctrine + policy for Amendment 13**; confirm DSAR + erasure pipeline wired | **P0** |
| **Accessibility** | ת"י 5568 / תקנות נגישות | WCAG 2.0 AA; published accessibility statement with contact | Conformance audit; verify statement is current and reachable | **P1** |
| **Cookies / tracking** | חוק הגנת הפרטיות (post-Amend 13 guidance) | Opt-in, no pre-ticked boxes, granular | Confirm `CookieConsent` defaults to OFF for non-essential | **P1** |
| **E-sign** | חוק חתימה אלקטרונית | Valid electronic acceptance + evidence trail | Largely covered (`ISRAELI_ESIGN_COMPLIANCE_2025.md`); verify consent evidence hashing | **P2** |
| **Tax documents to consumer** | פקודת מס הכנסה; חוק מסמכי חשבונות 1976; מספר הקצאה (allocation no.) | Sequenced invoices, 7-yr retention, allocation number above threshold (phasing down 2024→2026) | Issuance-side allocation number (OCR read side done); confirm threshold handling | **P1** |

### 3B. Partner / provider / franchise end (B2B — the contracts you asked me to learn)

| Domain | Israeli law (2026) | Requirement | Gap to fix | Priority |
|---|---|---|---|---|
| **Franchise / partner agreement** | General contract law (no IL franchise statute); חוק התחרות הכלכלית | Israel has **no FDD regime** — US "Franchise Disclosure Document" concept doesn't apply | The template is **US-shaped** (FDD Item 19, AAA/ICC arbitration, notary). Must be **Israeli-ified**: governing law = Israel, jurisdiction = Israeli courts/arbitration, drop FDD framing | **P0 [עו"ד SIGN-OFF]** |
| **Non-compete / non-solicit** | Israeli labour + contract case law (*Checkpoint* line) | Post-termination non-competes enforced **narrowly** — must protect a legitimate proprietary interest; broad radius/term often struck down | §11 uses open `{{radius}}km / {{months}}` — needs IL-reasonable bounds + a legitimate-interest recital | **P1 [עו"ד SIGN-OFF]** |
| **Provider/contractor classification** | Labour law — מבחן ההשתלבות (integration test) | Misclassified "contractor" who is really an employee → retroactive social benefits, severance, ביטוח לאומי | Audit sitter/walker/driver/trainer agreements for employee-like control; add genuine-independence terms | **P0 [עו"ד SIGN-OFF]** |
| **Self-billing on behalf of providers** | מס הכנסה / מע״מ | Platform issuing invoices "on behalf of" a provider needs explicit written authorisation | `architecture/04-israeli-compliance.md` flags this as an **open counsel question** — add the authorisation clause to the Provider Master Agreement | **P0 [עו"ד SIGN-OFF]** |
| **Supplier / consumables** | Commercial + VAT (osek status) | Correct VAT treatment per supplier osek classification (already built: patur/murshe/chevra) | Contract terms should reference the classification + invoicing duties | **P2** |
| **Data processing (provider sees customer PII)** | Amendment 13 | Provider is a processor of customer data during a booking; bind them | Add a **DPA / data-protection clause** to every provider agreement | **P1 [עו"ד SIGN-OFF]** |
| **Insurance** | Commercial best practice | GL, cyber/data-breach, property, workers' comp where staff | §8 exists but amounts are `{{variables}}` — set IL-market minimums with broker | **P2** |

---

## 4. Franchise master agreement — specific findings

The current `franchise_master_agreement.md` is a competent **multi-jurisdiction US-style** template (marked, correctly, *"DRAFT — NOT APPROVED"*). For an Israeli company signing Israeli partners, these are the concrete red flags:

1. **FDD framing is wrong jurisdiction.** §13.2, Item 19, the "Franchise Disclosure Document" references, the 14-day FDD review — these are **US FTC franchise-rule** concepts. Israel has no FDD requirement. Keep voluntary disclosure as good practice, but stop presenting it as a legal regime that doesn't exist here.
2. **Governing law / dispute resolution are blank variables** (`{{governing_law_jurisdiction}}`, AAA/ICC, `{{arbitration_location}}`). For Pet Wash Ltd these should default to **Israeli law and an Israeli forum** (court or Israeli arbitration, Hebrew), not AAA/ICC.
3. **Notary / "Commission Expiry"** signature block is a US notary construct — not how Israeli execution works.
4. **Non-compete (§11)** is open-ended. Israeli courts routinely narrow these. Needs a legitimate-proprietary-interest recital and reasonable, defensible radius/duration.
5. **"Non-Refundable" franchise fee (§2.1)** — Israeli consumer/contract law and good-faith doctrine (תום לב) can limit absolute non-refundability; soften to "non-refundable except as required by Israeli law."
6. **Personal data / GDPR clause (§6.2)** says "GDPR/privacy law compliant" generically — must name **חוק הגנת הפרטיות + Amendment 13** and impose processor obligations on the partner.
7. **VAT** — fees should state VAT treatment (plus מע״מ) explicitly, B2B.

**Housekeeping:** there's a stray editor swap file `server/templates/contracts/.franchise_master_agreement.md.swp` (vim left it open). It should be deleted and added to `.gitignore` so it never gets committed.

---

## 5. Remediation roadmap (sequenced, repo-native PRs)

Following the platform's one-purpose-per-PR discipline. None of these touch wallet/finance runtime, K9000/Nayax, or schema unless flagged.

| Seq | PR | What | Needs עו"ד? |
|---|---|---|---|
| **1** | `PR-LEGAL-1` | **Marketing-send guardrail audit** — prove every outbound channel routes through consent gate; fix any direct send; ensure unsubscribe in every template | No (eng); counsel reviews policy |
| **2** | `PR-LEGAL-2` | **Pricing-disclosure page audit** — produce `docs/legal/pricing-display-audit-2026.md`; fix any surface that shows a sub-total before total | No |
| **3** | `PR-LEGAL-3` | **Privacy doctrine + policy → Amendment 13 update** — DPO question, updated obligations, breach, data-subject rights | **Yes** |
| **4** | `PR-LEGAL-4` | **Prestige Club cancellation + auto-renewal terms** — verify online cancel works; add notice terms | **Yes** |
| **5** | `PR-LEGAL-5` | **Franchise agreement Israeli-ification** — items in §4 | **Yes** |
| **6** | `PR-LEGAL-6` | **Provider agreements** — classification review + DPA clause + self-billing authorisation | **Yes** |
| **7** | `PR-LEGAL-7` | **Accessibility conformance audit** vs IS 5568 + refresh statement | No (eng) |
| **8** | `PR-LEGAL-8` | **Terms / Cookies / Refund** consumer-law refresh (14-day, cooling-off) | **Yes** (light) |

---

## 6. What I can finalise vs what needs a licensed עו"ד

**I can do now, no external counsel:** the marketing-send technical audit (#1), the pricing-page audit (#2), the accessibility conformance audit (#7), and *first drafts* of every contract/policy change.

**Must carry a licensed Israeli עו"ד countersignature before going live:** franchise agreement, customer Terms, Privacy Policy, provider classification + DPA, subscription/auto-renewal terms. I'll prepare each as a clean redline so counsel reviews in minutes, not hours.

---

## 7. Recommended first move

Start with **`PR-LEGAL-1` (marketing-send guardrail)** and **`PR-LEGAL-2` (pricing audit)** in parallel. Reason: they are the two highest-exposure risks (#1 and #3 in the executive summary), they need **no external lawyer**, and they're pure verification-and-fix work I can execute and prove. That buys down the biggest class-action surface immediately while counsel engagement is arranged for the contract items.

---

### Sources (2026 Israeli law)
- Amendment 13, Privacy Protection Law — effective 14 Aug 2025, fines, criminal liability, DPO: [ai-law.co.il](https://www.ai-law.co.il/en/post/israel-s-privacy-protection-authority-steps-up-enforcement-first-fines-under-amendment-13), [BigID](https://bigid.com/blog/what-israel-amendment-13-means-for-businesses-in-2025/), [Pearl Cohen](https://www.pearlcohen.com/israel-significant-amendment-to-the-privacy-law-takes-effect/), [INPLP — DPO](https://inplp.com/latest-news/article/new-amendment-to-israeli-privacy-protection-law-and-mandatory-dpo-appointment/)
- Spam Law §30א (Amendment 40), ₪1,000/message statutory damages: [Hunton](https://www.hunton.com/privacy-and-information-security-law/new-anti-spam-law-takes-effect-in-israel), [IAPP — do-not-call registry](https://iapp.org/news/a/israel-tightens-marketing-rules-with-a-do-not-call-registry)
- Consumer Protection §17a pricing — *Wolt* class action 53918-06-23 (per platform skill, ₪3.75M settlement)
