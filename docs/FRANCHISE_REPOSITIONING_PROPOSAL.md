# Franchise Page → Premium Smart Hub Partnership — Audit & Repositioning

**Status:** Audit + drafted repositioning. **NO code changes. NO implementation.**
**Trigger:** CEO live-tested `/franchise` and concluded the page reads as Replit-startup investor pitch rather than premium 2026 infrastructure partnership for the PetWash™ dual-bay smart hub ecosystem.
**Direction:** Full replacement, not cleanup. Apple partnership confidence, Tesla infrastructure rollout, LV / Cartier brand control, McDonald's operational seriousness — never startup investor pitch.

---

## Important warnings — read first

1. **No implementation by this PR.** It is the audit + drafted positioning. Implementation only starts after CEO sign-off on naming (Decision A in §13) plus written legal counsel review of the consent fields and any retained Israeli numbers / claims.
2. **I am not an Israeli franchise / consumer-protection / commercial attorney.** The drafted copy and legal-consent fields in §9 and §10 are template content that must be reviewed by qualified Israeli counsel before going live. Where the lawyer revises wording, the lawyer wins.
3. **No revenue, ROI, profit, or "earn X" promises will appear in the new page.** Per CEO mandate. The drafted text below contains zero numerical projections. Operational facts (number of platforms in the ecosystem, support tier categories) are not the same as revenue projections — they are descriptive, not promissory.
4. **Three reaffirmations before we start:**
   - Card artwork is out of scope (consistent with all prior PRs).
   - Payment processor, schema, backend logic untouched.
   - The brand-system rule (Phase B2 / luxury direction correction) applies — no gold gradients, no cream, no decorative furniture, no Playfair serif, pure stage-white + ink-900 + Inter sans typography.

---

## 0. TL;DR

The current `/franchise` page has **10 P0 legal-risk items**, **3 broken CTAs that do nothing**, **two empty data arrays** (`successStories: []`, `locations: []`) that nonetheless render heading sections claiming a network exists, and **45+ uses of the word "franchise"** without any of the Israeli franchise law disclosures that should accompany a franchise sales pitch. The visual design uses 50+ emoji, 5+ conflicting gradient color schemes, glassmorphism on 100% of cards, and reads as fintech-startup not luxury infrastructure brand.

The proposed direction is a **full page replacement**, not a cleanup. The repositioning is from "Franchise Sales Pitch" to "Smart Hub Partnership" — selective, operationally mature, premium, with ecosystem-level confidence (K9000 hub + software + consumables + parts + training + brand standards + smart-city infrastructure).

**The biggest single strategic question is whether the word "franchise" should remain at all.** Israeli franchise law treats the word with weight — every appearance of "franchise" or "franchisee" implies a legal relationship that requires specific pre-contract disclosures (a question that needs Israeli legal counsel). Alternative naming options (Smart Hub Partnership, Location Partner, etc.) avoid that legal trigger and align better with the premium ecosystem positioning. Decision A in §13.

After CEO + legal sign-off on naming, the implementation is one PR replacing `Franchise.tsx` + removing `FranchiseROICalculator.tsx` + updating i18n + rewriting the form route. Roughly 600-900 lines of net change across about 6 files.

---

## 1. Current state audit (verified, not inferred)

Source: an Explore-agent deep audit of `client/src/pages/Franchise.tsx`, `client/src/pages/partners/Franchise.tsx`, `client/src/components/FranchiseROICalculator.tsx`, and the supporting i18n keys at `client/src/lib/i18n.ts:353-465`.

### 1.1 Page sections in order (current `/franchise`)

| Section | What it shows | Status |
|---|---|---|
| Hero badge | "✨ Global Premium Opportunity" + "Avg ROI 220% • 5+ Years Proven Success • 50+ Active Global Locations" | **P0 legal exposure** |
| Hero buttons | "Request Investment Package" + "Schedule Tour" | Investment language P0; Schedule Tour CTA does nothing |
| Gamification onboarding | Steps 1–6 with progress bars | Friction-inducing fluff |
| Franchisee Success Stories | Heading + empty array (`successStories: []`) | Renders heading claiming success stories exist; none actually do |
| Global Franchise Network | Heading + empty array (`locations: []`) | Same issue — claims a network when none populated |
| AI Advisor section | "Get instant answers about ROI, locations, support" + button | Button does nothing; mentions ROI |
| Virtual Reality Tour | "Experience the K9000 station in 3D before you invest" + button | Button does nothing; mentions "invest" |
| Predictive Success Score | "92% success probability" big number + "Based on analysis of 500+ franchisees" footnote | **P0 — unverified statistic, no methodology, no disclaimer** |
| ROI Calculator | Sliders for investment / customers / ticket; live revenue + ROI + payback calculation | **P0 — every output an unguarded projection** |
| Investment Package Summary | "Contact us for complete investment details and a personalized quote" | Investment language P0 |
| JV / Enrique Platform | Sub-section for JV partnerships | Reasonable B2B copy; CTA broken |
| What's Included grid | 8 feature tiles (equipment, training, inventory, marketing, exclusive territory, support 24/7, etc.) | **"Exclusive Territory" without legal backing — P1** |
| Final CTA | "Ready to Join? Talk to Advisor Now" | Button does nothing (gamification marker only) |
| Form modal | Name / email / phone / country / city / message | **No consent checkbox, no privacy policy link — Israeli Privacy Law gap** |

### 1.2 Numbers / figures currently shown on the public page

| Figure | Where | Source in code | Risk |
|---|---|---|---|
| **220% Avg ROI** | Hero stats + investment summary | Hardcoded in `i18n.ts:356` and `i18n.ts:1731` | **P0** |
| **5+ years proven success** | Hero stats | Hardcoded in `i18n.ts:356` | **P0** |
| **50+ active global locations** | Hero stats | Hardcoded in `i18n.ts:356` | **P0** |
| **92% success probability** | Predictive Score Card | Hardcoded in `Franchise.tsx:465` + `i18n.ts:1768` | **P0** |
| **500+ franchisees analyzed** | AI Prediction footnote | Hardcoded in `i18n.ts:1775` | **P0 — no source, no verification** |
| **$70K–$150K investment range** | ROI Calculator slider | Hardcoded in `FranchiseROICalculator.tsx:67-68` | **P1** |
| **200–1,000 monthly customers** | ROI Calculator slider | Hardcoded in `FranchiseROICalculator.tsx:14` | **P1** |
| **$20–$60 average ticket** | ROI Calculator slider | Hardcoded in `FranchiseROICalculator.tsx:15` | **P1** |
| **35% operating cost ratio** | ROI Calculator formula | Hardcoded in `FranchiseROICalculator.tsx:25` | **P1** |
| Calculated monthly revenue | ROI Calculator output | Live calculation: `monthlyCustomers * avgTicket` | **P0 — every output a projection** |
| Calculated annual profit | ROI Calculator output | Live calculation: `(monthlyRevenue * 0.65) * 12` | **P0** |
| Calculated ROI percentage | ROI Calculator output | Live calculation: `(annualProfit / investment) * 100` | **P0** |
| Calculated payback period | ROI Calculator output | Live calculation: `investment / monthlyProfit` | **P0** |

**Disclaimers near these numbers:** none. No asterisks, no footnotes, no "illustrative only" language.

### 1.3 Word "franchise" usage

- 45+ occurrences across `/franchise` and `/partners/franchise` pages.
- "Franchisee" specifically: 4+ times (i18n.ts:354; Franchise.tsx:151; Partners page "Franchisee Success Stories"; etc.).
- "Franchise agreement" / "Franchise fee" / "Franchise disclosure document": **0** occurrences. The page claims a franchise relationship without any of the legal infrastructure that should accompany a franchise sales pitch under Israeli commercial law.

### 1.4 Visual design state (current)

- **Color palette:** warm cream / amber / yellow / gold gradients dominant, plus blue, slate, emerald, purple, orange accents — at least 5 separate color systems active simultaneously.
- **Typography:** uses custom `luxury-heading-*` and `luxury-text-*` classes; no explicit Inter or sans-serif override in the JSX, so falls back to whatever the CSS layer sets.
- **Decorative density:** glassmorphism on essentially every card; gradient backgrounds; metallic shine effects; 50+ emoji badges (✨, 🎮, 📹, 🤖, 🥽, 📊, 💼, 🔧, 📦, 🎯, etc.) used as visual hierarchy.
- **Animation:** fade-in, slide-up, scale-in, bounce, animated progress bars.
- **Verdict:** the visual posture is fintech startup / early-stage SaaS, not premium 2026 infrastructure brand.

### 1.5 CTA flow (current)

| CTA | Action | Status |
|---|---|---|
| "Request Investment Package" | Opens form modal | Works (form submits to /api/franchise/inquiry) |
| "Schedule Tour" | `onClick` sets gamification step to 5 | **BROKEN** — no actual scheduling |
| "Start Chat with AI Advisor" | `onClick` sets gamification step to 4 | **BROKEN** — no AI chat |
| "Start Virtual Tour" | No `onClick` handler | **BROKEN** — button does nothing |
| "Inquire About JV Partnership" | No `onClick` handler | **BROKEN** — button does nothing |
| "Talk to Advisor Now" | Same as "Schedule Tour" | **BROKEN** — gamification only |
| "Request Information" (Partners page) | Submits to /api/franchise/inquiry | Works |

**4 of 7 public CTAs do nothing.** This alone undermines premium positioning before any of the legal-risk content is considered.

### 1.6 Form / lead-capture mechanism

- Backend route: `server/routes/franchise.ts:24-54`.
- Fields collected: `fullName` (required), `email` (required), `phone` (required), `country` (optional), `city` (optional), `message` (optional).
- Destination: Firestore collection `franchise_inquiries`.
- **Missing:**
  - No consent checkbox ("I agree to be contacted by PetWash").
  - No link to Privacy Policy.
  - No data retention notice.
  - No marketing-vs-transactional consent split.
  - No CAPTCHA / spam protection visible.
- Israeli Privacy Law compliance gap.

### 1.7 Empty data arrays

`Franchise.tsx:48-56` (or thereabouts) declares `successStories: Array<...>[] = []` and `locations: Array<...>[] = []`. The page still renders the headings "Franchisee Success Stories" and "Global Franchise Network" but with no actual stories / locations underneath. This is a worse UX than hiding the section — it signals "we say we have this but we don't show it."

### 1.8 Imports

`Franchise.tsx` imports `FranchiseROICalculator` (a separate component), `GoogleFormEmbed` (third-party form embed), `Layout`, and 40+ Lucide icons.

---

## 2. Risk-ranked list of items to remove or rewrite

### P0 — Legal exposure (remove before any other change)

1. Hero stats line: "Avg ROI 220% • 5+ Years Proven Success • 50+ Active Global Locations". Unverified financial + scale claims. Remove entirely.
2. Predictive Success Score: "92% success probability" + "Based on analysis of 500+ franchisees". No methodology, no source, no franchisees actually exist in the data. Remove the entire section.
3. CTA label: "Request Investment Package". Investment language triggers Israeli franchise / consumer protection law. Rename or remove.
4. ROI Calculator entire component (`FranchiseROICalculator.tsx`). Every output is an unguarded financial projection. Remove the component file entirely from the public page.
5. Onboarding gamification copy: "Track your progress towards franchise ownership". "Ownership" is a legal-equity term. Rewrite or remove gamification.
6. "Franchisee Success Stories" heading rendering above an empty array. Either populate with real, verified, anonymized partner stories (subject to consent), or remove the section.
7. "Global Franchise Network" heading rendering above an empty array. Same fix — populate or remove.
8. "Contact us for complete investment details and a personalized quote". Investment / quote language. Rewrite.
9. Video testimonial placeholders with emoji flags (🇨🇦, 🇦🇺, 🇬🇧) instead of actual video assets. Either real videos or remove section.
10. Form has no consent checkbox or privacy policy link. Israeli Privacy Law + Amendment 13 (effective 2025) require explicit consent for outbound contact. Add consent fields (§10 of this doc).

### P1 — Risky but lower severity (address in the rewrite)

11. "Exclusive Territory" item in the "What's Included" grid. Territorial-exclusivity claim without a backing legal document. Either remove or footnote "subject to partnership agreement."
12. Broken CTAs (4 of them — Schedule Tour, AI Advisor, Virtual Tour, JV Inquiry, Talk to Advisor). Either implement or remove. Broken CTAs on a B2B partnership page erode trust immediately.
13. "Multiple revenue streams across 8 business platforms". Revenue language. Rewrite as "operational platforms" or "service categories."
14. Aggregate visual claims of "Proven Success" without documentation. Soften to "Established operational standards."

### P2 — Quality / aesthetic (cleanup, not legal)

15. Emoji density (50+ across the page). Remove almost all — the new direction is restrained, not decorative.
16. Gradient palette conflict (amber + yellow + blue + slate + emerald + purple + orange). Replace with the canonical stage-white + ink-900 + restrained ink-400 system from the Phase B2 brand correction.
17. Animation density (fade-in / slide-up / scale-in / bounce). Remove. Match the calm Apple-product-page posture.
18. Glassmorphism / metallic shine. Remove. Premium 2026 is flat-luxury, not glass-luxury.

---

## 3. The word "franchise" — the strategic naming question

### 3.1 The problem

Using "franchise" / "franchisee" / "franchise network" in marketing copy creates two issues:

**Legal exposure.** Israeli commercial law treats a franchise relationship as a specific contractual form requiring pre-contract disclosure of financial information, operational requirements, fees, termination conditions, etc. (the closest international analogue is the FDD — Franchise Disclosure Document — required in many jurisdictions). PetWash currently has none of this infrastructure publicly available. Continuing to use the word "franchise" without it is exposure.

**Brand positioning.** The word "franchise" carries associations from quick-service restaurants and convenience-store chains — operational, transactional, scalable but not premium. For a 2026 luxury infrastructure brand positioning around dual-bay smart hubs and smart-city pet care, "franchise" is the wrong vibe. Premium infrastructure brands (Tesla Supercharger network, Apple authorized service providers, Cartier authorized boutiques) do not call their location partners "franchisees."

### 3.2 Alternative naming options

Listed by premium-positioning fit, with Hebrew equivalents:

| English | Hebrew | Fit |
|---|---|---|
| **Smart Hub Partnership** | **שותפות הב חכם** or **שותפות תחנה חכמה** | Strongest premium fit. "Hub" matches the dual-bay infrastructure language. |
| **Location Partner** | **שותף מיקום** | Operational, restrained, used by Tesla and Starbucks Reserve. |
| **Authorized Operator** | **מפעיל מורשה** | Apple / Cartier vocabulary. Implies selectivity. |
| **Network Partner** | **שותף רשת** | Generic but clean. |
| **Franchise Opportunity** | **זכיינות** | Current term. Carries legal weight + brand baggage. |

### 3.3 Recommendation

Recommend **Smart Hub Partnership** / **שותפות הב חכם** as the primary brand-facing language with **Authorized Operator** / **מפעיל מורשה** as a secondary technical term used in operational documents. Move the URL from `/franchise` to `/partnership` (with a permanent redirect from `/franchise` and `/franchise-opportunities` to preserve any inbound links and search rankings). Update the hamburger menu label accordingly.

If the CEO prefers to keep "Franchise Opportunity" / "זכיינות" for any strategic or pre-existing-contract reason, then the legal infrastructure (franchise disclosure document, pre-contract disclosure timeline, franchise registration if Israeli law requires) becomes a parallel prerequisite workstream and must precede the new page going live.

Decision A in §13.

---

## 4. New positioning brief (the ecosystem direction)

Per CEO directive, the new page should present PetWash™ as a premium 2026 smart infrastructure ecosystem around dual-bay wash hubs. Not a franchise sales pitch.

The ecosystem the page should communicate:

- **The Hub:** K9000 dual-bay smart wash stations — the physical infrastructure unit.
- **The Software:** the PetWash app + platform that connects customers to stations, manages bookings, processes payments via Nayax, runs the loyalty program, drives marketing.
- **The Customer Experience:** the consistent premium service standard at every station — operational playbook, brand standards, staff training, voice and tone.
- **The Consumables:** shampoo, conditioner, tea tree oil and other branded products — supplied to partners, ensuring consistency across the network and operational margin for both sides.
- **The Parts and Maintenance:** support layer for the K9000 hardware — uptime guarantees, replacement parts, service intervals.
- **The Onboarding and Training:** structured partner onboarding, operational training, periodic recertification.
- **The Location Strategy:** support for site selection — works with municipalities, commercial property owners, retail partners, fuel-station operators, etc.
- **The Smart-City Layer:** PetWash as part of broader smart-city infrastructure for pet care — data, anonymized usage analytics, integration potential with municipal services.
- **The Brand Standards:** trademark protection (PetWash™ Israeli Trade Mark No. 381713 in Class 44, per `docs/LEGAL_TRADEMARK_PROPOSAL.md`), visual identity, customer-facing tone.
- **End-to-End Partner Support:** unified support layer covering hardware, software, training, marketing, supply.

The page should make clear that this is a **selective partnership**, not a mass franchise sale. Premium infrastructure brands choose partners; they do not advertise to fill quotas.

---

## 5. New page architecture (proposed)

Replace the current single-page sprawl with a tighter, structured page — premium 2026 layout discipline. Roughly 7 sections, each focused, no scroll-to-fill decoration.

### Section 1 — Hero

- One sentence: "PetWash™ partners with selected operators, property owners, and municipalities to deploy dual-bay smart wash hubs across Israel."
- Single CTA: "Express Interest" / "הרשמת עניין".
- No numbers. No badges. No emoji. No "Avg ROI 220%". Just the proposition and the action.
- Visual: stage-white background, ink-900 type, optional single product photograph of a K9000 hub at premium scale, no decoration.

### Section 2 — The Network We're Building

- Short paragraph: PetWash™ is building Israel's premium dual-bay smart wash hub network. Selective deployment. Premium customer experience. Smart-city pet-care infrastructure.
- Three product-photography moments (if assets available) showing the K9000 hub in different settings: standalone urban, retail-adjacent, fuel-station-adjacent. No staged consumer photos with stock-photo families — that reads cheap.

### Section 3 — The Hub

- The K9000 dual-bay smart wash station itself.
- Technical credibility: dual bays, IoT-connected, Nayax payment integration, customer app integration, remote diagnostics.
- One image or 3D render at premium scale.
- No specifications presented as marketing numbers ("X cars per hour"). Operational facts only, restrained.

### Section 4 — The Ecosystem (the differentiator)

The single most important section. A clean 6-card or 6-row block, each card one ecosystem element. Each card: an icon-quality mark (not an emoji), a 2-3 word heading, a 1-2 sentence description. No metrics. No "earn X by adopting Y."

The six (suggested):
1. **Software & App Platform** — booking, payments, loyalty, customer relationships, all native.
2. **Consumables & Supplies** — premium shampoo, conditioner, tea tree oil products supplied through the network.
3. **Parts & Maintenance** — hardware uptime support, scheduled service, rapid parts replacement.
4. **Onboarding & Training** — structured operator training, certification, ongoing skills development.
5. **Brand & Marketing** — PetWash™ trademark protection, branded customer-facing assets, regional marketing support.
6. **Smart-City Integration** — alignment with municipal pet-care strategies, data partnerships, civic infrastructure positioning.

### Section 5 — Who We Partner With

Selectivity language. Three or four partner archetypes, restrained copy:

- **Municipal Partners** — local authorities adopting smart-city pet-care infrastructure.
- **Commercial Property Owners** — premium retail, mixed-use, fuel-station, transport-hub developers.
- **Operational Partners** — experienced operators in adjacent service categories (carwash, pet services, hospitality).
- **Strategic Investors** — capital partners aligned with the long-term network thesis.

The point of this section: signal that we are filtering inbound, not begging for it. Premium brands signal selectivity in their language; mass-franchise brands signal accessibility.

### Section 6 — How It Works

A restrained 3-step or 4-step process — but without gamification, progress bars, or animated checkmarks. Just a clean numbered list:

1. **Express Interest** — submit the form below.
2. **Initial Conversation** — our partnership team reaches out within 5 business days to learn about your context.
3. **Site & Operational Review** — for qualified opportunities, we conduct a joint site and operational fit assessment.
4. **Partnership Agreement** — if both sides see a fit, we move to formal partnership documentation.

No "Track your progress towards franchise ownership." No "92% success probability."

### Section 7 — Express Interest (the form)

A minimal form. New fields proposed in §9 and §10.

### Section 8 — Already a Partner (footer link)

A small link at the bottom: "Already a partner? Sign in to the operator portal." Routes to the existing operator dashboard at `/franchise/dashboard` (the internal portal is separate scope and not part of this rewrite).

---

## 6. Drafted copy — English (subject to legal review)

The literal text for each section. **All numerical / financial claims removed. All "franchise" terminology replaced. No "earn X" or "ROI" language anywhere.**

### 6.1 Hero

> # Smart Hub Partnership
>
> PetWash™ partners with selected operators, property owners, and municipalities to deploy dual-bay smart wash hubs across Israel.
>
> [ Express Interest ]

### 6.2 The Network

> ## A premium smart-city infrastructure for pet care
>
> PetWash™ is building Israel's selective dual-bay smart wash hub network — an end-to-end ecosystem combining the K9000 hardware, our software platform, premium consumables, operational training, and brand standards into a single coherent partnership.
>
> We grow deliberately, with the partners and locations that fit the long-term network thesis.

### 6.3 The Hub

> ## The K9000 dual-bay smart wash hub
>
> The K9000 is a connected dual-bay washing station designed for the next decade of pet-care infrastructure. Integrated payment through Nayax. Customer-facing app integration. Remote diagnostics. Built to operate under premium uptime expectations.

### 6.4 The Ecosystem

> ## An integrated partner ecosystem
>
> Every partnership is supported by the same six pillars.
>
> - **Software & App Platform** — booking, payment, loyalty, and customer relationships are native to the PetWash™ platform from day one.
> - **Consumables & Supplies** — premium shampoo, conditioner, and tea tree oil products supplied through the network so customer experience is consistent at every hub.
> - **Parts & Maintenance** — uptime support for the K9000 hardware, scheduled service, rapid parts replacement.
> - **Onboarding & Training** — structured operator onboarding, certification, ongoing skills development.
> - **Brand & Marketing** — PetWash™ is a registered trademark in Israel (Trade Mark No. 381713). Partners operate under coordinated brand standards and benefit from regional marketing investment.
> - **Smart-City Integration** — alignment with municipal smart-city pet-care strategies, data partnerships where appropriate, civic-infrastructure positioning.

### 6.5 Who We Partner With

> ## Selective by design
>
> Our partnership network is intentionally small. We work with:
>
> - **Municipal partners** — local authorities adopting smart-city pet-care infrastructure.
> - **Commercial property owners** — premium retail, mixed-use, fuel-station, and transport-hub developers.
> - **Operational partners** — experienced operators in adjacent service categories.
> - **Strategic investors** — capital partners aligned with the long-term network thesis.
>
> If your context fits one of the above, we'd like to hear from you.

### 6.6 How It Works

> ## How a partnership progresses
>
> 1. **Express interest** — submit the form below.
> 2. **Initial conversation** — our partnership team reaches out within five business days.
> 3. **Site and operational review** — for qualified opportunities, we conduct a joint site and operational fit assessment.
> 4. **Partnership agreement** — if both sides see a fit, we move to formal documentation.

### 6.7 Express Interest (form heading)

> ## Tell us about your context
>
> All fields confidential. We respond to every serious inquiry within five business days.

---

## 7. Drafted copy — Hebrew (subject to legal review)

Mirror version of §6. **Same review requirement — Israeli counsel and Hebrew copywriter should approve.**

### 7.1 Hero

> # שותפות הב חכם
>
> PetWash™ משתפת פעולה עם מפעילים נבחרים, בעלי נכסים ורשויות מקומיות לפריסת תחנות שטיפה חכמות דו-תאיות ברחבי ישראל.
>
> [ הרשמת עניין ]

### 7.2 The Network

> ## תשתית סמארט-סיטי פרימיום לטיפוח חיות מחמד
>
> PetWash™ בונה בישראל רשת סלקטיבית של תחנות שטיפה חכמות דו-תאיות — מערכת אקולוגית מקצה לקצה המשלבת את חומרת K9000, את פלטפורמת התוכנה שלנו, את הצריכים הפרימיומיים, את ההכשרה התפעולית ואת סטנדרטי המותג לשותפות אחת ושלמה.
>
> אנו צומחים בכוונה תחילה, עם השותפים והמיקומים המתאימים לתזת הרשת ארוכת הטווח.

### 7.3 The Hub

> ## תחנת K9000 — שטיפה חכמה דו-תאית
>
> תחנת K9000 היא יחידת שטיפה דו-תאית מחוברת, שעוצבה לעשור הבא של תשתיות טיפוח חיות מחמד. תשלום משולב באמצעות Nayax. אינטגרציה עם אפליקציית הלקוח. אבחון מרחוק. נבנתה לפעול בציפיות זמינות פרימיום.

### 7.4 The Ecosystem

> ## מערכת שותפים משולבת
>
> כל שותפות נתמכת על ידי שישה עמודי תווך זהים.
>
> - **פלטפורמת תוכנה ואפליקציה** — הזמנות, תשלום, נאמנות, וקשרי לקוחות הם חלק טבוע של פלטפורמת PetWash™ מהיום הראשון.
> - **צריכים ואספקה** — שמפו, מרכך ושמן תה ירוק פרימיומיים מסופקים דרך הרשת, כך שחוויית הלקוח עקבית בכל תחנה.
> - **חלקים ותחזוקה** — תמיכת זמינות לחומרת K9000, שירות מתוזמן, החלפת חלקים מהירה.
> - **הכשרה והטמעה** — תהליך קליטה מובנה, הסמכה, ופיתוח מיומנויות מתמשך.
> - **מותג ושיווק** — PetWash™ הוא סימן מסחר רשום בישראל (מס׳ 381713). השותפים פועלים תחת סטנדרטי מותג מתואמים ונהנים מהשקעה שיווקית אזורית.
> - **אינטגרציה לסמארט-סיטי** — התאמה לאסטרטגיות עירוניות לטיפוח חיות מחמד, שיתופי פעולה של נתונים במקומות המתאימים, מיצוב כתשתית אזרחית.

### 7.5 Who We Partner With

> ## סלקטיבי בעיצוב
>
> רשת השותפים שלנו קטנה במכוון. אנחנו עובדים עם:
>
> - **שותפים עירוניים** — רשויות מקומיות המאמצות תשתית סמארט-סיטי לטיפוח חיות מחמד.
> - **בעלי נכסים מסחריים** — מסחר פרימיום, שימוש מעורב, תחנות דלק ויזמי רכזות תחבורה.
> - **שותפים תפעוליים** — מפעילים מנוסים בקטגוריות שירות סמוכות.
> - **משקיעים אסטרטגיים** — שותפי הון המתואמים עם תזת הרשת ארוכת הטווח.
>
> אם ההקשר שלך מתאים לאחת מהקטגוריות לעיל, נשמח לשמוע ממך.

### 7.6 How It Works

> ## איך מתקדמת שותפות
>
> 1. **הרשמת עניין** — מילוי הטופס מטה.
> 2. **שיחה ראשונה** — צוות השותפויות שלנו יחזור אליך בתוך חמישה ימי עסקים.
> 3. **בחינת מיקום ותפעול** — להזדמנויות מתאימות, אנו עורכים הערכת התאמה משותפת.
> 4. **הסכם שותפות** — אם שני הצדדים רואים התאמה, אנו עוברים לתיעוד פורמלי.

### 7.7 Express Interest (form heading)

> ## ספר/י לנו על ההקשר שלך
>
> כל השדות חסויים. אנו מגיבים לכל פנייה רצינית בתוך חמישה ימי עסקים.

---

## 8. New visual direction (consistent with Phase B2 brand correction)

Apply the same Apple / LV / Cartier modern-minimal posture from the egift Phase B2 work (already merged):

- **Background:** `bg-stage-white` everywhere. No cream. No gradient.
- **Typography:** Inter sans-serif. H1 `font-extralight` with tight `letter-spacing: -0.035em`. Body text `text-ink-900`. Section labels `text-ink-900` (no gold).
- **Spacing:** tight rhythm. `py-8 sm:py-10 md:py-12 lg:py-16` for sections. No editorial-magazine whitespace.
- **CTAs:** solid `bg-ink-900` with `text-stage-white`, sharp `rounded-[2px]` corners. No gradient. No shadow.
- **Cards:** if used at all, pure white with thin ink-900/12 hairline border. No glassmorphism. No metallic shine.
- **Icons:** Lucide line-icons only, never emoji. Single weight, ink-900 stroke color.
- **Images:** product photography of the K9000 at premium scale, NOT staged consumer photos with stock-photo families.
- **md: variants:** required throughout. iPad portrait must have its own rhythm (lesson learned from Phase B audit on /egift).
- **Phase A tokens:** consume `ink-900`, `ink-400`, `stage-white`, `editorial-xs` through `editorial-xl`, `shadow-stage-soft`, `shadow-stage-lifted` from `tailwind.config.ts`.

---

## 9. Form / application wiring proposal

### 9.1 New fields

Reduce field count, tighten field meaning. New form (in order):

| Field | Type | Required | Notes |
|---|---|---|---|
| Full name | text | yes | |
| Business name | text | no | Optional for individual inquiries |
| Email | email | yes | |
| Phone | tel | yes | International format accepted |
| Country | dropdown | yes | Default Israel, but allow international inbound |
| City / region | text | yes | |
| Partner category | dropdown | yes | Options: Municipality / Commercial property / Operational partner / Strategic investor / Other |
| Message | textarea | no | Free text, optional |
| Consent: contact | checkbox | yes (required submit) | See §10 |
| Consent: marketing | checkbox | no | See §10 |

### 9.2 Backend route

- Keep existing endpoint `/api/franchise/inquiry` OR migrate to `/api/partnership/inquiry` (cleaner naming, requires the existing route to redirect).
- Firestore collection: rename `franchise_inquiries` to `partnership_inquiries` (or maintain dual write during transition).
- Add fields to the stored document: `partnerCategory`, `consentToContact`, `consentToMarketing`, `consentTimestamp`, `userAgent`, `ipHash` (PII-safe — hashed, not raw).

### 9.3 Confirmation experience

- Immediate inline confirmation: "Thank you. We've received your interest. Our partnership team will reach out within five business days."
- Send a confirmation email to the inquirer (uses existing SendGrid infrastructure). Email content: thank-you note, expected timeline, contact for urgent matters, link to read more about the PetWash™ ecosystem.
- Send internal alert email to a partnership-team distribution list (config-driven, no hardcoded recipient).
- Audit log entry in `auditEvents` table — "partnership_inquiry_received" event with inquiry ID, partner category, consent state. The submitter is not authenticated, so we cannot record their userId, but we can record the inquiry ID for follow-up traceability.

### 9.4 Anti-spam

- Add reCAPTCHA Enterprise (already used elsewhere on the platform — `@google-cloud/recaptcha-enterprise` is already a dependency).
- Rate-limit submissions per IP (existing rate-limit middleware).
- Bot-pattern detection (e.g., honeypot field that humans don't see).

---

## 10. Legal consent fields proposal

**Important: drafted copy below requires Israeli legal counsel review before going live.** The Israeli Privacy Protection Law 5741-1981 + the Privacy Protection (Data Security) Regulations 5777-2017 + Amendment 13 (in force from 2025) collectively require explicit, informed, freely-given consent for outbound contact for B2B marketing/partnership inquiries.

### 10.1 Drafted consent text — English

**Required consent (required for form submission):**

> ☐ I agree to be contacted by PetWash™ regarding this partnership inquiry by email and phone, and I confirm that I have read the [Privacy Policy](/legal/privacy).

**Optional consent (separate checkbox, not required):**

> ☐ I would like to receive occasional updates from PetWash™ about the partnership program, network expansion, and related opportunities. I can unsubscribe at any time.

### 10.2 Drafted consent text — Hebrew

**חובה (תנאי להגשת הטופס):**

> ☐ אני מסכים/ה ש-PetWash™ ייצור איתי קשר בנוגע לפניה זו באימייל ובטלפון, ומאשר/ת שקראתי את [מדיניות הפרטיות](/legal/privacy).

**אופציונלי (תיבת סימון נפרדת, לא חובה):**

> ☐ אני מעוניין/ת לקבל עדכונים מ-PetWash™ על תוכנית השותפויות, הרחבת הרשת והזדמנויות נלוות. ניתן לבטל את ההסכמה בכל עת.

### 10.3 What gets stored

For every submission, store:
- The exact consent text that was shown (so we can prove what they agreed to).
- A boolean for each consent checkbox.
- Timestamp.
- Privacy Policy version at time of submission (date-stamped).

This is the same pattern used elsewhere in the platform's audit infrastructure (`auditEvents`, `userNotificationConsents`).

### 10.4 Honest gaps for legal review

- **Pre-contract franchise disclosure** — if the CEO chooses to keep the word "franchise" (Decision A), Israeli commercial law may require pre-contract disclosure of financial information, fees, etc. before any partnership document is signed. Out of scope for this PR, but flagged.
- **Cross-border inquiry handling** — if a non-Israeli buyer / partner inquires, GDPR rules may apply on the EU side. Out of scope, flagged.
- **Marketing consent withdrawal mechanism** — needs to exist. The platform already has `userNotificationConsents` infrastructure; the partnership form's marketing consent should flow into the same withdrawal mechanism.

---

## 11. Phased PR plan

The full replacement is too big for one PR. Three phases:

### Phase 1 — Decisions + structural greenlight (this PR + CEO review)

- This doc is reviewed by CEO and Israeli legal counsel.
- CEO answers Decisions A through G in §13.
- Counsel signs off on the drafted copy in §6 and §7 and the consent fields in §10.
- No code change.

### Phase 2 — Full page replacement (small implementation PR)

- Replace `client/src/pages/Franchise.tsx` content entirely with the new architecture from §5 and §6 / §7 copy.
- Remove `client/src/components/FranchiseROICalculator.tsx` entirely (the file no longer used).
- Update i18n keys: remove all "franchise.heroStats", "franchise.avgROI", "franchise.successProbability", "franchise.calculator" keys. Add new "partnership.*" keys with the new copy.
- Update hamburger menu in `client/src/components/PetWashHeader.tsx`: change "franchise.label" to "partnership.label" or whatever naming Decision A produces. Update the 6-language i18n strings accordingly.
- Add `/partnership` route in App.tsx (or keep `/franchise` based on Decision A) + 301 redirect from `/franchise-opportunities` and any prior URLs.
- No backend changes yet — the form continues to POST to the existing `/api/franchise/inquiry` endpoint with the existing field set. New consent fields are wired in Phase 3.
- Estimated diff: ~600-800 lines net change (mostly deletions; the new page is structurally smaller than the current one).

### Phase 3 — Form fields + consent + backend wiring (separate small PR)

- Add the new form fields (partner category, consent checkboxes) per §9 and §10.
- Update `/api/franchise/inquiry` (or create `/api/partnership/inquiry` with deprecation of the old) to accept and validate the new fields.
- Add Firestore document fields: `partnerCategory`, `consentToContact`, `consentToMarketing`, `consentTimestamp`, etc.
- Add `recaptcha-enterprise` validation on submit.
- Send confirmation email to inquirer (uses existing SendGrid infra).
- Send internal notification to partnership team email distribution.
- Add `auditEvents` entry for each inquiry receipt.
- Estimated diff: ~200-300 lines net change.

### Phase 4 — Cleanup of partners page + URL handling (small PR, optional)

- `client/src/pages/partners/Franchise.tsx` and route `/partners/franchise` — consolidate with the main partnership page or redirect.
- Hamburger menu cleanup: the existing item is "Franchise & city partners" (EN) / "זכיינות ושותפויות עירוניות" (HE). After repositioning, simplify to "Smart Hub Partnership" / "שותפות הב חכם" or whatever Decision A produces.
- Estimated diff: ~50-100 lines.

**Total: 3-4 small PRs, ~900-1200 net line changes across the entire repositioning. Each phase is independently revertable.**

---

## 12. Out of scope for this proposal

- The operator-facing dashboards under `client/src/pages/franchise/*` (FranchiseOwnerDashboard, FranchiseInbox, FranchiseReports, FranchiseSupport, FranchiseMarketing, FranchiseStationSettlements). These are internal partner tools, not public marketing. Different audit, different timeline.
- The `FranchiseManagementDashboard` and `JvPartnersDashboard` admin pages.
- The `useFranchiseId` hook and its consumers (internal franchise/partner data flow).
- The K9000 hardware product page (if a separate one exists) — would be a parallel workstream.
- The "smart-city" partnership program as a distinct product (if it ever needs its own page).
- International / cross-border partnership inquiries beyond the form's "Country" dropdown — a separate strategic question.
- Investor relations content (separate workstream — should NOT live on a public partnership page).

---

## 13. Decisions awaiting CEO + Israeli legal counsel

A. **Naming.** Smart Hub Partnership / שותפות הב חכם (default recommendation) vs Franchise Opportunity / זכיינות (current term) vs another option from §3.2. **This decision triggers cascading changes** — URL, hamburger menu, page title, i18n keys, all copy.

B. **URL path.** `/partnership` (recommended if naming changes) vs `/franchise` (keeps current URL, redirect added from prior aliases). 301 redirects either way.

C. **Approve the drafted English copy** in §6, subject to Israeli legal counsel review.

D. **Approve the drafted Hebrew copy** in §7, subject to Israeli legal counsel + Hebrew copywriter review.

E. **Approve the new visual direction** in §8 (consistent with Phase B2 brand correction).

F. **Approve the form field changes + consent text** in §9 and §10, subject to legal counsel review.

G. **Confirm scope of Phases 2-4** in §11. Phases can be re-ordered or merged at CEO discretion. Phase 2 alone (front-end replacement only, no backend changes) is the minimum to fix the legal-risk exposure quickly; Phases 3-4 polish the operational layer.

---

## 14. What this PR does NOT do

- Does not modify `Franchise.tsx`, `FranchiseROICalculator.tsx`, `partners/Franchise.tsx`, the form endpoint, or any code.
- Does not commit any text to a user-facing page.
- Does not constitute legal advice.
- Does not replace Israeli legal counsel's review of the drafted copy and consent language.
- Does not pick a name — that is the CEO's decision (Decision A).
- Does not promise a deploy date.

---

**End of audit and repositioning proposal. No code, no infrastructure changed. Awaiting CEO + Israeli legal counsel review of Decisions A through G.**
