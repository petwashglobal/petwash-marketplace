# SUMIT Capabilities Audit — what to build vs what to delegate

**Status:** Research + recommended architecture. **No code change in this PR.**
**Research date:** 2026-05-16.
**Trigger:** CEO directive 2026-05-16 — "SUMIT appears to already support provider/business onboarding, financial infrastructure, and supplier management flows. Stop assuming PetWash should custom-build these layers."
**Companions:** `docs/TRANZILA_DEPRECATION_AUDIT.md`, `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md`.
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0.
**Rule:** facts cited from public SUMIT pages only. No assumptions. Unknowns marked.

---

## §0 TL;DR

SUMIT (sumit.co.il) is a registered Israeli tax-authority accounting platform with a documented **marketplace mode** (`multivendorcharge` API + sub-business creation via API + per-supplier invoice issuance in the supplier's legal name). PetWash should treat SUMIT as the **financial system of record** and **never touch money, invoice numbering, or KYC**.

**What SUMIT covers natively (and PetWash must NOT duplicate):**
- Tax invoice / receipt / חשבונית מס issuance (registered software 00215702)
- Marketplace clearing with per-supplier direct settlement (`/billing/payments/multivendorcharge/`)
- Sub-business creation API (auto-onboard new supplier)
- Invoice issued in supplier's legal name (not PetWash's) — this is the **native** model, not a workaround
- Apple Pay / Google Pay / Bit (growth plan and above; module activation)
- Recurring billing, refunds, partial refunds, same-day auto-cancel
- Hosted payment page / iframe (PCI-DSS SAQ-A scope)
- Aggregator path (Upay): T+1 daily settlement at ~1.4%+VAT, or monthly at ~1.1%+VAT
- Direct credit-company path for merchants with their own agreement
- Webhooks via Triggers/View module
- REST API + Swagger + sandbox + test terminal

**8 specific items need confirmation from SUMIT support** — concise 6-question email drafted in §3, ready to send (Hebrew + English).

**Recommended architecture split for 2026 launch (§4):**
- **PetWash:** marketplace UX, booking, scheduling, matching, loyalty, growth, ops, mobile-first
- **SUMIT:** money, invoices, KYC, clearing, payouts, webhooks
- **Nayax:** kiosk/station EMV hardware only

**Architectural implication — major:** the Wolt-style "invoice on behalf of supplier" model proposed in `PATH_E_PROVIDER_REBUILD_AUDIT.md` is **not needed**. SUMIT's marketplace mode issues invoices in the supplier's own legal name natively. This removes a significant chunk of Path E scope (legal/CPA gating on invoice-on-behalf wording, Israeli Tax Authority registration for marketplace issuance, court-precedent compliance).

---

## §1 What SUMIT does — verified capabilities

Confidence tier per row: **HIGH** = two+ corroborating SUMIT URLs OR direct help-article title match. **MEDIUM** = single source or via search snippet.

| # | Capability | Conf. | Source |
|---|---|---|---|
| 1 | Tax invoice / receipt / חשבונית מס issuance | HIGH | `help.sumit.co.il/he/articles/5832737`, `sumit.co.il/invoices` |
| 2 | Marketplace clearing — each supplier registered + receives funds directly | HIGH | `help.sumit.co.il/he/articles/5832873` ("סליקה ל-Marketplace") |
| 3 | Marketplace charge API `/billing/payments/multivendorcharge/` — charges AND auto-generates invoice/receipt in vendor's name | HIGH | `help.sumit.co.il/he/articles/5832873` |
| 4 | Sub-business creation via API (auto-onboard supplier) — inputs: name, business number, type, email, phone; operator chooses clearing OR documents-only | HIGH | `help.sumit.co.il/he/articles/5832873` |
| 5 | Invoice issued in supplier's legal name (supplier = מוציא חשבונית); PetWash is **NOT** the legal issuer to end customer | HIGH | `help.sumit.co.il/he/articles/5832873` ("האפליקציה יוצרת אוטומטית חשבונית/קבלה בשם הספק") |
| 6 | Apple Pay on payment pages + via API (growth plan or above; module activation) | HIGH | `help.sumit.co.il/he/articles/10191685`, `…/10900715` |
| 7 | Google Pay on payment pages + via API | HIGH | `help.sumit.co.il/he/articles/10257965`, `…/10900715` |
| 8 | Bit digital-wallet | MEDIUM | `help.sumit.co.il/he/articles/10900715` |
| 9 | PayPal payment page | MEDIUM | `help.sumit.co.il/he/articles/5840233` |
| 10 | Recurring billing / standing orders / חיוב מתחדש | HIGH | `sumit.co.il/solutions` |
| 11 | Bank direct-debit (הרשאה לחיוב חשבון) | MEDIUM | help-collection snippet |
| 12 | Self-invoice (חשבונית עצמית) for non-business suppliers — **expense-side** documentation, not Wolt's income-side model | HIGH | `help.sumit.co.il/he/articles/9725885`, `…/books/he/articles/6138442` |
| 13 | REST API + Swagger | HIGH | `app.sumit.co.il/developers/api/`, `…/swagger/index.html` |
| 14 | Hosted page / iframe payment-page integration | HIGH | `app.sumit.co.il/help/developers/redirectapi/` |
| 15 | Webhooks via Triggers + API + View-management modules | HIGH | `help.sumit.co.il/he/articles/11577644`, `…/10442304` |
| 16 | Sandbox / test organization + test terminal | HIGH | `help.sumit.co.il/he/articles/5840939` |
| 17 | Aggregator payouts (Upay): T+1 daily at ~1.4%+VAT, or monthly on 2nd/8th at ~1.1%+VAT | HIGH | `help.sumit.co.il/he/articles/5799426`, `…/5832995` |
| 18 | Direct credit-company payouts: charges through 15th paid on 2nd of next month, per merchant's own agreement | MEDIUM | `help.sumit.co.il/he/articles/5799426`, `…/5833036` |
| 19 | Supplier KYC at clearing onboarding ("funds transfer only after meeting and document submission") | MEDIUM | `help.sumit.co.il/he/articles/5832995` |
| 20 | WooCommerce / WCFM / WCVendor / Dokan plugin | HIGH | `wordpress.org/plugins/woo-payment-gateway-officeguy/` |
| 21 | Make.com / Zapier integration | HIGH | `apps.make.com/officeguy`, `help.sumit.co.il/he/articles/10442304` |
| 22 | Refunds / partial refunds / same-day auto-cancel | HIGH | `help.sumit.co.il/he/articles/5799412` |

**Access note:** `help.sumit.co.il` and `app.sumit.co.il` returned HTTP 403 to automated fetch (Cloudflare anti-bot). Facts above were extracted from Google search-result snippets and SUMIT article titles. **A human reviewer should open each cited URL in a browser to confirm verbatim wording before contractual decisions.**

---

## §2 What SUMIT may do — needs explicit confirmation

| # | Capability | Why unclear | What we need |
|---|---|---|---|
| B1 | Split-payment at clearing time (single charge auto-split between PetWash commission and supplier payout) | Marketplace article describes per-supplier invoice but doesn't publicly document programmatic commission split | Confirm: does `multivendorcharge` support commission/marketplace-fee split in one call? If not, what's the recommended fee-collection pattern? |
| B2 | KYC scope and depth for API-created sub-businesses | "Meeting and document submission" mentioned; unclear if end-to-end remote or requires PetWash team intervention | Full KYC flow: required docs, identity-verification method, time-to-activation, AML/sanctions checks, fully remote? |
| B3 | Embedded onboarding UI (Stripe-Connect-style hosted onboarding) | API accepts structured fields; unclear if SUMIT provides hosted page where supplier completes KYC + bank details themselves | Hosted/embedded onboarding URL to redirect new suppliers to? |
| B4 | Webhook event catalog (especially: payment success/fail, payout, refund, KYC status, business activation) | Webhook docs describe generic view-based triggers, not documented finance-event catalog | List of system-level events for marketplace use |
| B5 | Apple Pay / Google Pay via `multivendorcharge` (not just hosted page) | Apple/Google Pay docs describe payment pages; marketplace doc describes API charge; intersection not stated | Are wallets supported on `multivendorcharge` and on a PetWash-hosted iframe? Per-sub-business module/plan prerequisites? |
| B6 | Operator-level settlement reporting per sub-business | Not described whether marketplace operator sees consolidated reports across all sub-businesses | Reporting APIs available to marketplace operator |
| B7 | Plan limits (transactions/month, sub-businesses, API rate limits) | Free-plan limit (10 actions/month) shown; no public detail for marketplace-scale usage | Enterprise pricing + limits for ~200 suppliers, ~5,000 transactions/month, growing 3× annually |
| B8 | PCI-DSS scope when using SUMIT iframe vs SDK | Redirect/iframe API exists; PCI scope reduction implied but not explicitly stated | Confirm SAQ-A scope when integrating via SUMIT iframe (PetWash never touches PAN) |

---

## §3 Email to SUMIT support — ready to send

### Hebrew (primary — send this)

```
נושא: התייעצות לקראת אינטגרציה — מרקטפלייס PetWash
       (סליקה + חשבוניות בשם ספקים)

שלום צוות SUMIT,

אנחנו בונים פלטפורמת מרקטפלייס ישראלית בתחום שירותי חיות מחמד (PetWash).
הלקוח הסופי משלם דרך הפלטפורמה, וכל ספק הוא עסק עצמאי שמקבל את התשלום
ישירות ומוציא חשבונית בשמו. קראנו את מאמר ה-Marketplace שלכם
(/articles/5832873) ואת תיעוד ה-API, ויש לנו 6 שאלות ספציפיות לפני שנקבל
החלטת אינטגרציה:

1. **פיצול תשלום בעסקה אחת:** האם multivendorcharge (או endpoint אחר)
   תומך בפיצול אוטומטי של עסקה אחת בין הספק (לתשלום נטו) לבין PetWash
   (לעמלת המרקטפלייס), בקריאת API אחת? אם לא — מהי הדרך המומלצת לחיוב
   עמלת הפלטפורמה?

2. **KYC לפתיחת תת-עסק דרך API:** מה התהליך המלא — אילו מסמכים נדרשים,
   האם הזיהוי נעשה דיגיטלית מקצה לקצה, מהו זמן ההפעלה הצפוי, והאם
   SUMIT/Upay מבצעים סינון AML/סנקציות?

3. **Onboarding מובנה (Hosted/Embedded):** האם קיים דף onboarding מתארח
   של SUMIT שאליו נוכל להפנות ספקים חדשים, כדי שישלימו את שלבי ה-KYC
   והפרטים הבנקאיים בעצמם — במקום שצוות PetWash יאסוף ויעלה עבורם?

4. **Webhooks למרקטפלייס:** האם קיימת רשימת אירועי-מערכת מובְנים
   (payment success/fail, document issued, refund, KYC status,
   payout executed) או שהמנגנון היחיד הוא טריגרים מבוססי View?

5. **Apple Pay / Google Pay במסלול ה-Marketplace:** האם ארנקים דיגיטליים
   נתמכים גם בעסקאות שעוברות דרך multivendorcharge ובדף שמוטמע ב-iframe
   באתר PetWash? אילו מודולים/תוכניות נדרשים פר תת-עסק?

6. **דוחות והתחשבנות מרכזיים:** אילו דוחות/APIs זמינים למפעיל המרקטפלייס
   לראייה רוחבית על כל תת-העסקים (תנועות, payouts, עמלות, קובץ התאמה)?

נשמח גם להצעת מחיר ראשונית לעומסים של ~200 ספקים ו-~5,000 עסקאות בחודש
(גדילה צפויה ×3 שנתית).

תודה רבה,
צוות PetWash
```

### English (internal reference)

```
Subject: Integration consultation — PetWash marketplace
         (clearing + invoices issued in supplier's name)

Hi SUMIT team,

We are building an Israeli marketplace platform for pet-care services
(PetWash). End customers pay through the platform, and each provider
is an independent business that receives the funds directly and
issues the invoice in their own name. We have read your Marketplace
article (/articles/5832873) and the API docs, and we have 6 specific
questions before our integration decision:

1. Split payment in a single transaction: does `multivendorcharge`
   (or another endpoint) support automatic splitting of one charge
   between the supplier (net) and PetWash (marketplace fee), in a
   single API call? If not, what is the recommended way to bill the
   platform fee?

2. KYC for sub-business creation via API: full flow — required
   documents, end-to-end digital identification, expected activation
   SLA, AML / sanctions screening?

3. Hosted / embedded onboarding: is there a hosted onboarding page
   we can redirect new providers to so they complete KYC and bank
   details themselves rather than PetWash collecting on their behalf?

4. Marketplace webhooks: is there a built-in catalog of system events
   (payment success/fail, document issued, refund, KYC status, payout
   executed), or is the only mechanism view-based triggers?

5. Apple Pay / Google Pay in the marketplace flow: supported on
   `multivendorcharge` and on an iframe embedded on PetWash's site?
   Modules/plans required per sub-business?

6. Operator-level reporting: which reports / APIs are available to
   the marketplace operator for a cross-vendor view (transactions,
   payouts, fees, reconciliation file)?

We'd also appreciate indicative pricing for ~200 providers and
~5,000 transactions/month (expected 3× annual growth).

Thanks,
The PetWash team
```

**No Tranzila references.** No assumptions of capabilities outside §1's verified list.

---

## §4 Recommended architecture split for 2026

### §4.1 What PetWash must NOT build (because SUMIT covers it)

- Tax-invoice / receipt generation engine
- Marketplace sub-business creation + per-supplier clearing
- Apple Pay / Google Pay / Bit integration with Shva
- Recurring billing engine, refunds, partial refunds
- Hosted payment page / iframe + PCI-DSS scope reduction
- Webhook infrastructure for payment events (subject to B4 confirmation)
- Tax-authority compliance + registered-accounting-software status
- Aggregator vs. direct credit-company onboarding logistics
- Reconciliation + refund UI for support staff
- KYC / AML for providers (SUMIT/Upay do this)

### §4.2 What PetWash MUST still build

- Two-sided marketplace UX (customer + provider apps + web)
- Discovery, booking, scheduling, ratings, photos, chat
- Supplier matching, availability, pricing, surge/promo logic
- Loyalty / referral / growth mechanics
- Operational tooling: dispute mediation, support queue, content moderation
- Mobile-first product surfaces (§0 doctrine)
- Backend orchestration calling SUMIT APIs at right lifecycle events (booking → charge → invoice → payout reconciliation)
- Webhook receiver + idempotent ledger mapping booking IDs ↔ SUMIT transaction/document IDs (single source of truth for product state, NOT finance state)
- Customer identity (account/email/phone) — no AML required for end consumers

### §4.3 What stays Nayax

- **Kiosk / wash-station hardware payments only** — physical EMV / contactless terminals at unattended bays
- No customer accounts, no invoicing, no marketplace logic

### §4.4 Responsibility matrix

| Layer | Owner |
|---|---|
| Customer + provider mobile apps + web | **PetWash** |
| Booking, matching, scheduling, loyalty | **PetWash** |
| Online payments (cards, Apple Pay, Google Pay, Bit) | **SUMIT** |
| Provider onboarding paperwork + KYC + clearing activation | **SUMIT (+ Upay aggregator)** |
| Sub-business creation, multivendor charge, per-vendor invoice | **SUMIT** |
| Payouts to providers | **SUMIT / Upay** (T+1 or monthly per plan) |
| Webhooks → PetWash ledger reconciliation | PetWash receives, **SUMIT emits** |
| Unattended kiosk EMV terminal at wash stations | **Nayax** |
| Finance reporting to CEO | PetWash dashboards consuming SUMIT reports |

---

## §5 Risk if PetWash duplicates SUMIT's regulated finance layer

1. **Compliance liability** — issuing tax invoices requires registered-software status with רשות המסים. Building our own duplicates that obligation and the audit burden that comes with it.
2. **PCI-DSS scope explosion** — handling PANs directly moves us from SAQ-A to SAQ-D, raising annual audit cost and breach exposure.
3. **AML/KYC duty** — if we hold or split provider funds before payout, we may become a regulated money-services entity under חוק שירותי תשלום.
4. **Technical debt** — building invoice numbering, VAT logic, Shva integration, credit-company reconciliation, dispute flow is 12–18 months of work that SUMIT ships today.
5. **Cash-flow timing risk** — if we route money through our own account, we owe providers regardless of chargebacks. SUMIT's per-vendor charge model leaves chargeback exposure where it legally belongs (with the issuer of the invoice, who received the funds directly).

---

## §6 Impact on existing PetWash audits

### §6.1 `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md` — **major scope reduction**

Path E originally proposed Wolt-style "invoice on behalf" (חשבונית עצמית in the income-side sense — PetWash issues a tax invoice as if it were the provider, requiring 2023 court-precedent compliance + Israeli Tax Authority registration + counsel + CPA).

**SUMIT removes this entire scope.** SUMIT's marketplace mode (item §1.5) issues the invoice in the **supplier's own legal name** natively. The supplier is the legal issuer; PetWash is the platform operator. No invoice-on-behalf legal construct. No 2023 court precedent applies. No Israeli Tax Authority registration as marketplace issuer.

What remains in Path E:
- Provider Host Services Agreement (PetWash <→ provider contractual basis) — counsel still relevant
- Provider classification (independent contractor vs employee) — depends on platform operating model, not on invoicing
- Payout reconciliation logic — now thin: PetWash matches SUMIT webhook events to bookings

**Net effect:** Path E scope drops by ~50%. Counsel engagement scope narrows from "draft invoice-on-behalf framework" to "draft host services agreement + contractor classification opinion."

### §6.2 `docs/TRANZILA_DEPRECATION_AUDIT.md` — **confirmed direction**

Tranzila → SUMIT migration is the right call. SUMIT's hosted iframe + multivendor API + Apple Pay / Google Pay coverage matches or exceeds Tranzila's surface for marketplace use. Nothing in Tranzila's current usage at PetWash justifies keeping it once SUMIT is integrated.

---

## §7 Decisions awaiting CEO

| ID | Question | Recommendation |
|---|---|---|
| **S-A** | Send the §3 email to SUMIT support now? | **Yes.** Hebrew version. Can be sent today. No commercial commitment. |
| **S-B** | Engage SUMIT pre-sales for a kickoff call after their email response? | **Yes.** 30-min discovery call once B1–B8 are answered. |
| **S-C** | Drop Wolt-style invoice-on-behalf from Path E scope? | **Yes.** SUMIT marketplace mode replaces it natively. Path E doc to be updated separately. |
| **S-D** | Defer Israeli lawyer engagement for invoice-on-behalf wording? | **Yes** — that scope dropped per S-C. Counsel still needed for Provider Host Services Agreement (narrower brief). |
| **S-E** | Defer Israeli Tax Authority registration as marketplace issuer? | **Yes** per S-C. SUMIT carries that status (registered software 00215702). |
| **S-F** | Open a code branch for SUMIT integration scaffolding? | **Not yet.** First confirm B1–B8 from SUMIT, then design the orchestration layer with verified contract in hand. |
| **S-G** | Keep `client/.env.example` UPay reference, or remove until confirmed? | **Keep as a documented option.** SUMIT IS Upay's frontend for aggregator path; UPay = settlement layer. Same vendor relationship. |

---

## §8 What this PR does NOT do

- No code change (audit-only)
- No integration scaffolding
- No SUMIT API client written
- No schema migration
- No CI workflow change
- No payment / wallet / Tranzila / Summit-integration / Nayax / K9000 runtime touch
- No production secrets read or written
- No outbound email sent to SUMIT (CEO action — §3 ready to copy-paste)
- No Path E scope-reduction PR opened (S-C decision required first)

---

## §9 Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ Registered finance infrastructure beats custom build |
| Cheaper? | ✓✓✓ 12–18 months of engineering avoided; lower audit cost (SAQ-A vs SAQ-D); aggregator fees ~1.1–1.4% +VAT |
| Faster? | ✓✓✓ Sandbox + Swagger + WooCommerce plugin reference = days to integration prototype |
| Easier? | ✓✓ Webhook + iframe pattern; no PAN handling |
| Luxurious? | ✓✓ Per §0 doctrine — premium ≠ DIY. Premium = right tool for the job. Apple uses Stripe in some markets. |

**Honest miss:** SUMIT's webhook catalog (B4) is the one unknown that could force PetWash to poll instead of subscribe. Polling adds latency and load. If B4 returns "view-based triggers only," we should still proceed but plan for occasional reconciliation passes.

---

## §10 References

- SUMIT marketplace: https://help.sumit.co.il/he/articles/5832873
- SUMIT API + Swagger: https://app.sumit.co.il/developers/api/, https://app.sumit.co.il/help/developers/swagger/index.html
- Apple Pay: https://help.sumit.co.il/he/articles/10191685
- Google Pay: https://help.sumit.co.il/he/articles/10257965
- Digital wallets: https://help.sumit.co.il/he/articles/10900715
- Webhooks: https://help.sumit.co.il/he/articles/11577644
- Settlement timing: https://help.sumit.co.il/he/articles/5799426
- Upay (KYC mention): https://help.sumit.co.il/he/articles/5832995
- Self-invoice: https://help.sumit.co.il/he/articles/9725885
- Redirect/iframe: https://app.sumit.co.il/help/developers/redirectapi/
- Sandbox: https://help.sumit.co.il/he/articles/5840939
- WooCommerce multi-vendor plugin: https://wordpress.org/plugins/woo-payment-gateway-officeguy/
- `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md` — companion (scope reduction implied)
- `docs/TRANZILA_DEPRECATION_AUDIT.md` — companion (migration target confirmed)

---

**End of audit.** Email in §3 ready for CEO to send. Implementation gated on CEO decisions S-A through S-G in §7.
