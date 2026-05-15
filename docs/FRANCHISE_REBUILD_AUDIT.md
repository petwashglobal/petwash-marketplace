# Franchise Surface — Deep Audit + Rebuild Proposal

**Status:** Audit + rebuild proposal. No code, no production change, no
schema migration, no email send, no form modification. Implementation
gated on CEO approval of this proposal.
**Parent doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0
strategic operating pillar — every section in this proposal must satisfy
the five connected truths, the seven-attribute hierarchy, and the
strategic equation. The current franchise surface fails on several of
those tests; the proposal corrects that.
**Date stamped:** 2026-05-15.
**Triggered by:** CEO directive — "Audit the entire franchise flow deeply.
The franchise area is now considered structurally outdated and potentially
misleading. Treat as FULL REBUILD candidate."

---

## §0 TL;DR

The franchise surface fails §0 doctrine in three ways simultaneously:
1. **Active §0.4 violations** — three hardcoded performance claims
   ("Avg ROI 220%", "50+ Active Global Locations", "5+ Years Proven
   Success") render in production while the underlying data arrays are
   empty.
2. **§0.6 positioning failure** — the page sells "a wash station," not
   "an end-to-end deployment system."
3. **§0.7 equation failure** — multiple terms of the strategic equation
   are absent (no infrastructure credibility, no scalable deployment
   system communicated, no luxury brand discipline).

**Verdict: full rebuild candidate confirmed.** But before the full
rebuild, there is a **P0 triage** that must ship within 24 hours
independently: remove the invented numbers. They are actively misleading
investors, municipalities, and prospective franchisees. Letting them sit
while we build the new page is not acceptable per §0 doctrine which is
now active.

The full rebuild is ~12–14 working days across 5 phases. The P0 triage
is ~2 hours. **These are separate PRs with separate approval gates.**

Two genuine challenges to the framing are surfaced in §15 — read those
before committing.

---

## §1 P0 — active doctrine violations (must triage independently)

The CEO merged SKILL.md §0 as active doctrine on 2026-05-15. The
following statements appear in the production franchise page right now
and violate §0.4 ("avoid invented numbers, exaggerated claims"):

| File / line                                     | Statement                                          | Underlying data                                | Verdict          |
|-------------------------------------------------|----------------------------------------------------|------------------------------------------------|------------------|
| `client/src/pages/Franchise.tsx:356`            | "Avg ROI 220%"                                     | No source. ROI calculator default is illustrative only. | **Remove or verify** |
| `client/src/pages/Franchise.tsx:356`            | "50+ Active Global Locations"                      | `franchiseLocations = []` (line 45) — empty.   | **Remove or verify** |
| `client/src/pages/Franchise.tsx:356`            | "5+ Years Proven Success"                          | Unverified — no source.                        | **Remove or verify** |
| `client/src/pages/Franchise.tsx:661`            | "CSA Approved: ✓ Certified"                        | Claim made, no link / certificate number.      | **Add proof or remove** |

**Action options:**

**Option A — Remove the unverified claims (recommended for speed).**
- Time: 1–2 hours.
- PR scope: edit one file, remove specific lines, replace with verified
  facts (current station count from Firestore, current franchisee count
  from real data) or with neutral copy ("Investment-grade urban pet-care
  infrastructure").
- Risk: low.
- §0.4 compliance: restored same day.

**Option B — Verify and source the existing claims.**
- Time: depends on whether the data exists.
- "Avg ROI 220%" — needs an actual financial model + at least 5 real
  franchisee data points to support the average.
- "50+ Active Global Locations" — needs 50+ real, named stations across
  named countries.
- "5+ Years Proven Success" — needs a launch date traceable to 2020
  or earlier with continuous operation.
- "CSA Approved" — needs the certificate number + a link to the public
  CSA registry entry.
- Risk: if any number cannot be sourced, it must be removed regardless.

**Recommendation: Option A as a 2-hour triage PR this week. Option B
as part of the full rebuild content phase (§5.4) when verified numbers
are gathered.**

This is the only part of this proposal that is genuinely urgent.
Everything else can wait for the full rebuild plan to be approved.

---

## §2 Audit findings (14 dimensions + 3 extras)

Concrete findings from the read-only audit. File paths + line numbers
preserved.

### §2.1 Hamburger entry

- `client/src/components/PetWashHeader.tsx:131-132` — "Franchise & city
  partners" link, under "PARTNERS & FRANCHISE" section.
- Hebrew translation: "שותפים וזכיינות" (correctly localized via
  `section.partners` key).
- Route: `/franchise` (line 203).
- **Visual weight:** same as suppliers + municipal links. No icon, no
  badge, no featured treatment. Buried in 3rd-level mobile menu.
- **Verdict:** under-weighted for a flagship growth surface.

### §2.2 Page hierarchy

Three routes, two distinct pages:

| Route                            | File                                  | Lines | Status        |
|----------------------------------|---------------------------------------|-------|---------------|
| `/franchise`                     | `client/src/pages/Franchise.tsx`      | 781   | Active        |
| `/partners/franchise`            | `client/src/pages/partners/Franchise.tsx` | 319 | Active duplicate |
| `/franchise-opportunities`       | redirect to `/franchise`              | -     | Alias         |

Plus authenticated owner routes (out of scope for public audit):
`/franchise/dashboard`, `/franchise/:franchiseId/dashboard`,
`/franchise/inbox`, `/franchise/reports`, `/franchise/support`,
`/franchise/marketing`.

**Verdict:** two public entries doing similar work with different
content depth (781 vs 319 lines). No canonical. Collapse to one.

### §2.3 Mobile UX

- `client/src/pages/Franchise.tsx:63` — uses `min-h-screen`, **not
  `100dvh`** (violates platform skill §5 mobile-first rule).
- `client/src/pages/partners/Franchise.tsx:65` — same issue.
- No `env(safe-area-inset-*)` usage detected on bottom CTAs.
- `client/src/components/GoogleFormEmbed.tsx` — fixed `height={800}`
  iframe; **overflows on iPhone Safari without internal scroll**.
- Touch targets ≥ 44px (acceptable).

### §2.4 RTL typography

- `dir` attribute: not explicitly set on franchise pages; relies on
  document-level `<html dir="rtl">` toggle.
- `text-align: ${isHebrew ? 'right' : 'left'}` ternary in
  `server/email-templates/welcome-franchise-application-2026.ts:55` —
  works but not using logical properties.
- BiDi isolation for `⁦Pet Wash™⁩`: correctly used in header (line 103,
  392) and email template.
- **Hebrew typeface:** none specified. Email template falls back to
  `'Georgia', 'Times New Roman', 'Palatino'` (line 34) — **generic
  serif, not premium Hebrew typeface**.
- Numbers: `toLocaleString()` used correctly for currency display.

### §2.5 Lead capture

- `client/src/pages/Franchise.tsx:762-766` — embeds Google Form
  (external iframe).
- `client/src/pages/partners/Franchise.tsx:159-315` — modal form (6
  fields: fullName, email, phone, country, city, message).
- Server endpoint: `server/routes/franchise.ts:26-54` — POST
  `/api/franchise/inquiry`.
- **No Zod schema validation** at intake.
- Storage: Firestore collection `franchise_inquiries` (line 43). No
  PostgreSQL table.

### §2.6 Contact delivery

- Client toast on success.
- Modal success screen (lines 291–315 in partners/Franchise.tsx).
- **No applicant confirmation email is sent.** Template exists at
  `server/email-templates/welcome-franchise-application-2026.ts` but is
  **never invoked** by `server/routes/franchise.ts`.
- **No internal sales notification email.**
- **No CRM integration.** Leads land in Firestore and die there.

### §2.7 Email flow

- Service: implied SendGrid (used elsewhere in repo) but not wired here.
- One template only: `welcome-franchise-application-2026.ts` (applicant
  confirmation, he + en).
- **No internal notification template.**
- **No trigger** — the template is dead code.

### §2.8 CTA logic

Eight CTAs across 781 lines of `Franchise.tsx`:

1. Line 104-107: "Request Investment Package"
2. Line 110-117: "Schedule Tour"
3. Line 351-357: "Start Chat with AI Advisor"
4. Line 403-411: "Start Virtual Tour"
5. Line 517-522: "Request Investment Package" (repeat)
6. Line 697-704: "Inquire JV/Enrique Platform"
7. Line 748-756: "Talk to Advisor"
8. Line 762-766: Google Form embed (implicit)

**Most have no `onClick` handler wired.** No sticky mobile CTA.

### §2.9 Trust signals

- Line 356: hardcoded performance claims — **see §1 P0 violations**.
- Line 45: `franchiseLocations = []` — empty array (location map renders
  empty).
- Line 48: `successStories = []` — empty array (testimonial section
  renders empty).
- Line 302-306: hardcoded video testimonial array (`James Anderson`,
  `Emily Roberts`, `David Williams`) filtered out via
  `.filter(() => false).map(...)` — **dead test data committed to
  production**.
- K9000 specs (lines 614-665): technical, but unverified.
- Line 661: "CSA Approved: ✓ Certified" — **see §1 P0 violations**.

### §2.10 Municipality / franchise differentiation

- `/franchise` — single page, undifferentiated.
- `/partners/municipal` — separate route (`MunicipalPartners`
  component, App.tsx:991).
- **No decision-tree entry** — a visitor cannot easily self-identify as
  "city" vs "private operator" vs "building owner" on the franchise
  page.

### §2.11 Luxury brand alignment (per §0.2 hierarchy)

| Attribute       | Score | Evidence                                                        |
|-----------------|-------|-----------------------------------------------------------------|
| Easy            | ✓     | Form labels explicit                                            |
| Safe            | ✗     | No certifications shown with proof                              |
| Clean           | ✗     | 8 CTAs across 781 lines = clutter                              |
| Premium         | ✓     | Gradients + glass-morphism present                              |
| Modern          | ✓     | AI advisor, VR tour, success score (concepts)                  |
| Trusted         | ✗     | No real social proof; invented numbers (§1 P0)                  |
| Eco             | ✗     | Not communicated                                                 |

**§0.4 avoid list violations:** invented numbers ("Avg ROI 220%"),
unverified certifications, hidden test testimonial data.

### §2.12 Accessibility for older users

- Body copy ≥ 16px: assumed via `luxury-text-body` Tailwind class.
- Small text (12-14px): used for disclaimers, captions —
  **fails older-user readability**.
- Contrast: `text-gray-500` on light backgrounds fails WCAG AA.
- Tap targets ≥ 44px: ✓
- Form labels with `htmlFor`: ✓
- Keyboard navigation: ✓ for form, partial for buttons.
- `aria-label` on CTA buttons: **missing**.

### §2.13 Emotional clarity (the three franchise pitch questions)

| Question                          | Answer in current page                                                | Verdict       |
|-----------------------------------|------------------------------------------------------------------------|---------------|
| **What does it cost?**            | "Contact us for complete investment details" (line 513-522) — **vague** | Failing       |
| **What's the return?**            | "Avg ROI 220%" (unverified, §1 P0)                                     | Failing       |
| **What's the commitment?**        | Not mentioned anywhere.                                                | Failing       |

**The three questions every franchise prospect asks are unanswered.**

### §2.14 Infrastructure credibility

- K9000 specs present (technical).
- Live franchise data exists in Firestore (queryable via
  `server/routes/franchise.ts:79-150`).
- **But none of that data is surfaced publicly.** No live station
  count, no city map with real markers, no operational photo.
- Reads as concept deck, not live program.

### §2.15 Extra A — Hebrew/English content parity

- Both pages use i18n keys.
- Hebrew translation quality acceptable but some awkward word order
  (e.g. "⁦Pet Wash™⁩ הצטרף לרשת המובילה" should be "הצטרף לרשת ⁦Pet
  Wash™⁩ המובילה" — verb-first in Hebrew is more natural).

### §2.16 Extra B — SEO + discoverability

- No franchise-specific `<title>` or `<meta name="description">` tags.
- No OG tags for social share.
- No `sitemap.xml` found in repo.
- Page indexable but poorly discoverable from outside.

### §2.17 Extra C — Legacy / placeholder content

- Two empty data arrays drive 40% of the page's visible structure
  (testimonials + locations).
- Hidden test testimonial data committed to production.
- "2025/2026 Feature" markers in comments suggest in-progress features
  shipping to production prematurely.

---

## §3 Verdict

**Full rebuild candidate confirmed.** The franchise surface is
structurally misaligned with §0 doctrine in 11 of the 17 audit
dimensions. Patching individually would leave the architecture
duplicated, the data substrate empty, and the email flow broken.

But §1 (the doctrine violations) is independently urgent and must
ship as a separate 2-hour triage PR regardless of the full rebuild
timeline.

---

## §4 Proposed new architecture

### §4.1 Single canonical entry

```
DELETE:
  /partners/franchise                  (collapse content into /franchise)
  /franchise-opportunities             (alias deleted; rely on /franchise)

KEEP + REBUILD:
  /franchise                           (one canonical public marketing page)
  /franchise/dashboard                 (authenticated owner — unchanged)
  /franchise/:franchiseId/dashboard    (authenticated owner — unchanged)
  /franchise/inbox, reports, support, marketing (authenticated — unchanged)

NEW sub-routes (added in Phase 4-5):
  /franchise/apply                     (native application form, audience-aware)
  /franchise/municipal                 (city/council audience landing)
  /franchise/locations                 (live deployment map — only when data exists)
  /franchise/stories                   (real testimonials — only when 3+ exist)
  /franchise/investors                 (gated investor info — decision required, see §15)
```

### §4.2 Page section order on the canonical `/franchise`

Order matters. Reading top-to-bottom must answer the three pitch
questions (cost / return / commitment) within the first 60 seconds.

1. **Hero** — one-sentence positioning. One CTA only.
2. **Who is this for?** — four audience pills (city / private operator
   / building owner / investor). Each pill routes the visitor to the
   right sub-experience.
3. **What you get** — the §0.6 deployment system list (premium dual-bay
   station + software + payments + QR journey + support + consumables +
   organic products + spare parts + maintenance + training +
   operational standards + customer experience + brand trust +
   marketplace ecosystem). 14 components, premium grid.
4. **Smart Hub showcase** — one real station photo, one short looped
   video (when filmed), verified technical specs with cert numbers.
5. **Real numbers (operational proof)** — live deployment count, real
   franchisee count, real city count. **No section if data is empty.**
6. **The process** — four stages from inquiry to operational station,
   with realistic timeline per stage.
7. **Investment ranges** — verified, with ranges (not single numbers),
   sourced.
8. **Real testimonials** — only if 3+ real franchisees consent. Until
   then, section does not render.
9. **Application CTA** — one button to `/franchise/apply` (native form,
   not iframe).

### §4.3 Audience routing

Visitor lands on `/franchise`. Hero asks "Which best describes you?"
Four pills:

| Pill              | Route               | Form variant                                      | Internal notification recipient |
|-------------------|---------------------|--------------------------------------------------|----------------------------------|
| I represent a city / municipality | `/franchise/municipal` | Different copy, cleaner-public-spaces framing per §0.5 | CEO + municipal sales lead       |
| I want to operate stations privately | `/franchise/apply?intent=operator` | Standard franchise form per §0.6 | CEO + franchise sales lead       |
| I own a building / commercial space | `/franchise/apply?intent=host` | Host-only form (no operating responsibilities) | CEO + partnerships lead          |
| I want to invest                  | `/franchise/investors` | Gated info-pack download (see §15 decision) | CEO + finance lead               |

Single backend lead-capture pipeline routes by `intent` field.

---

## §5 Lead capture rebuild

### §5.1 Native form (not Google Forms iframe)

Replace `client/src/components/GoogleFormEmbed.tsx` usage with native
React form built on the existing form primitives. Mobile-first,
RTL-safe, 100dvh respecting `env(safe-area-inset-bottom)`.

Fields:
- Full name (required)
- Email (required, format-validated)
- Phone (required, Israeli + international format)
- Country (required, dropdown)
- City (required, free text or dropdown if country = Israel)
- Audience (required, the four-pill choice — pre-filled from URL)
- Business / role context (required, short text 50-300 chars)
- Capital available range (optional, ranges only — never single number)
- Heard about us (optional, dropdown for attribution)
- Free-text message (optional)

### §5.2 Server-side validation

`server/routes/franchise.ts` rewritten:
- Zod schema validates every field.
- `franchiseApplications` PostgreSQL table (new schema migration — gated
  on CEO approval per platform skill §2).
- Firestore fallback removed (Postgres is the source of truth).
- Inserts atomically with audit log entry per platform skill §2.

### §5.3 Rate limiting

Anonymous public POST endpoint. Vulnerable to spam.
- 5 submissions per IP per 24h (matches existing publicAuthRoutes pattern).
- reCAPTCHA v3 invisible check (the project already uses
  `server/routes/recaptcha.ts`).
- Honey-pot field hidden from real users.

### §5.4 Audit log

Every application creates an entry per platform skill §2:
- actor: anonymous public + IP
- action: `franchise.application.created`
- target: application ID
- before/after: not applicable; new record only

---

## §6 Email flow rebuild

Two new templates, both with premium Hebrew typeface (recommendation:
**Heebo** via Google Fonts — modern luxury Hebrew sans-serif used by
high-end Israeli brands. Decision §15 below.).

### §6.1 Applicant confirmation email

`server/email-templates/franchise-applicant-confirmation.ts`:
- Subject (he): "תודה על הפנייה — צוות ⁦PetWash™⁩ יחזור אליך"
- Subject (en): "Thank you — the PetWash team will be in touch shortly"
- Body: warm, premium, no salesy language. Tells applicant what happens
  next (review within 3-5 business days, possible follow-up call, NDA
  before financial details).
- One image (smart hub or station — verified asset).
- Two links: PetWash homepage, Privacy policy.
- No links to download anything unsolicited.

### §6.2 Internal notification email

`server/email-templates/franchise-internal-notification.ts`:
- Recipients: CEO email + sales lead email (env vars).
- Subject: `[Franchise application] <full name> — <country>/<city>`
- Body: full submission, attribution data, IP, audience pill chosen,
  link to admin record.
- No customer-facing language.
- Always English (internal).

### §6.3 Send wiring

`server/routes/franchise.ts:54` — after Postgres insert, fire-and-forget
two `sendEmail()` calls. Failure to send does NOT block the response
(applicant should always see success); failed sends log a P1 to ops.

---

## §7 Trust signal substrate (real data only)

Per §0.4 — no invented numbers. No placeholder testimonials. No
hardcoded "50+ locations" while the array is empty.

Implementation rule: **a section renders only if its underlying data
is non-empty.**

| Section                          | Renders when                                                |
|----------------------------------|------------------------------------------------------------|
| Live deployment count            | At least 1 real station live in Firestore                  |
| Locations map                    | At least 3 real stations across at least 2 cities          |
| Franchisee testimonials          | At least 3 real testimonials with name + permission        |
| Investment range                 | Verified by CFO; signed off in `docs/FRANCHISE_NUMBERS.md` |
| Cert badges (CSA, ISO, IL)       | Each cert badge clickable to public registry entry         |

Until each gate is met, that section simply does not render. Empty
arrays produce empty sections, not placeholders.

---

## §8 What gets deleted

- `client/src/pages/partners/Franchise.tsx` — duplicate, 319 lines.
- `/franchise-opportunities` route alias (App.tsx:2136).
- `client/src/components/GoogleFormEmbed.tsx` — used only for franchise
  intake; native form replaces.
- Hardcoded `successStories` and `franchiseLocations` empty arrays in
  `Franchise.tsx`.
- Hardcoded `videoTestimonials` array with `.filter(() => false)` dead
  test data.
- The three unverified hero claims (P0 §1 — separate triage PR).
- 6 of 8 current CTAs (consolidate to 1 primary + 1 secondary).
- "Avg ROI 220%" hardcoded copy at `Franchise.tsx:356`.
- Generic Hebrew serif fallback in email templates.

---

## §9 What gets rebuilt

- The single canonical `/franchise` page (Franchise.tsx) — strip and
  rebuild with the §4.2 section order.
- Native application form replacing GoogleFormEmbed.
- Server endpoint `server/routes/franchise.ts` — Zod validation,
  Postgres storage, audit log, email triggers.
- Two new email templates with premium Hebrew typeface.
- Mobile UX (`100dvh`, `env(safe-area-inset-*)`, no fixed iframe heights).
- Hebrew translation copy-edit pass (native-speaker review).
- Accessibility (16px min body, contrast pass, aria-labels on CTAs).
- SEO (per-page `<title>` and `<meta>`, OG tags, sitemap entry).
- Audience routing (4 pills → 4 sub-experiences).

---

## §10 What gets kept

- The `/franchise` URL itself (canonical).
- Hamburger entry in PARTNERS section (re-prioritize, add subtle badge
  later if/when first 5 stations deploy).
- Authenticated owner routes (`/franchise/dashboard`, etc.) —
  out of scope.
- ROI calculator concept — but defaults must be **verified** real
  averages, not illustrative.
- K9000 specs section — if claims are verifiable per §1 Option B.

---

## §11 Phased rollout

Six phases. Each independently revertible.

| Phase | Title                                                      | Days | Risk      | Decisions needed         |
|-------|------------------------------------------------------------|------|-----------|--------------------------|
| 0     | This audit + proposal merged                                | 0    | very low  | All §15 decisions       |
| **1** | **P0 triage** — remove invented numbers (§1 Option A)       | 0.25 | very low  | **A only — ship same day** |
| 2     | Schema migration: new `franchiseApplications` Postgres table | 1    | medium    | Separate schema approval per platform skill §2 |
| 3     | Server: new `franchise.ts` endpoint + Zod + audit log + 2 email templates + send wiring | 3 | low | None new |
| 4     | New `/franchise` page (strip + rebuild with §4.2 sections) | 5    | low       | F (typeface), G (testimonial workflow) |
| 5     | Audience routing: `/franchise/apply`, `/franchise/municipal`, gated `/franchise/investors` | 2 | low | C (investors gating), D (host audience scope) |
| 6     | Delete duplicate: `partners/Franchise.tsx`, GoogleFormEmbed, `/franchise-opportunities` alias | 0.5 | very low | None |

**Total: 12–14 working days for full rebuild.** Phase 1 ships in
hours. Phases 2-5 sequenced; Phase 6 ships last to avoid breaking
links.

---

## §12 Five-filter analysis (per §0.8)

| Filter         | Verdict                                                                                                                          |
|----------------|----------------------------------------------------------------------------------------------------------------------------------|
| Better?        | ✓✓✓ — one canonical entry beats two confused entries; real data beats invented; native form beats iframe; verified claims beat exaggeration. |
| Cheaper?       | ✓✓ — long-term yes (single page maintained vs two); short-term costs ~12-14 days of engineering. P0 triage is ~$0.                |
| Faster?        | ✓ — once rebuilt, lead-to-applicant cycle drops from "die in Firestore" to "two emails fire on submit." Slower to ship.            |
| Easier?        | ✓✓ — one canonical surface = one mental model for the team. Mobile UX simpler with native form vs iframe.                          |
| More luxurious?| ✓✓✓ — every section serves §0 doctrine. Premium Hebrew typeface, verified claims, real testimonials when data exists, no clutter. |

**Honest tradeoff:** ~12-14 days of engineering vs. patching the
current page. Recommend P0 triage (2 hours) ships immediately while
the full rebuild is scoped, planned, and approved phase-by-phase.

---

## §13 Strategic equation check (per §0.7)

```
PetWash™ =
  premium pet-care infrastructure       ← current page partial; rebuild ✓
  + safer everyday washing               ← out of franchise scope
  + cleaner urban living                 ← municipal audience pill ✓
  + eco-conscious operations             ← organic products line ✓ (§0.3 wording)
  + scalable deployment system           ← §0.6 14-component list ✓
  + luxury brand discipline              ← currently failing; rebuild ✓
```

The rebuild makes the franchise page pass the strategic equation. The
current page passes ~2 of 6 terms.

---

## §14 Risks + blockers

- **Schema migration** (Phase 2) requires explicit CEO approval per
  platform skill §2. Cannot proceed without sign-off on the
  `franchiseApplications` table shape.
- **Email send infrastructure** (Phase 3) — SendGrid (or equivalent)
  must be wired with `FRANCHISE_NOTIFY_EMAIL` env var for sales lead.
  Eng lead provisions.
- **Real franchisee testimonials** (§7) — requires legal consent
  workflow. Cannot fabricate; cannot proceed without real franchisees.
- **Investor materials** (§4.3) — gating decision (§15 C) impacts
  Phase 5 scope.
- **The "AI advisor" and "VR tour" sections** in the current page —
  are these features real or vapor? **CEO confirm before rebuild
  scope locks.** If real, port; if vapor, delete.
- **CSA certification** (§1 Option B) — needs verifiable cert number
  and public registry link. **CEO confirm.**

---

## §15 Decisions awaiting CEO

Two genuine challenges first, then locked decisions:

### Challenge 1 — Is "full rebuild" the right scope, or is "P0 triage + minimal cleanup" enough for now?

I am proposing 12-14 days of engineering. Honest alternative:
- **P0 triage only** (~2 hours) — removes the doctrine violations.
- **Plus minimal cleanup** (~2 days) — fix email wiring, delete the
  duplicate `partners/Franchise.tsx`, delete dead `.filter(() => false)`
  test testimonials, switch `min-h-screen` → `100dvh`.

That's ~2.5 days of work that fixes the most embarrassing problems
without committing to the full rebuild. Full rebuild can wait until
real franchisees exist + investor materials are gathered.

**Choose:** Full rebuild (12-14 days) | Triage + cleanup only (~2.5 days) | Triage only (2 hours).

### Challenge 2 — Is hamburger entry the right discoverability play?

The franchise audience (investors, municipalities, building owners) is
B2B and probably does NOT land via a customer-facing website's hamburger
menu. They land via a deck shared by your sales team, or a LinkedIn
post, or a specific URL given over a call.

**Two paths:**
- **A.** Keep hamburger entry, optimize the URL for direct landing.
- **B.** Move franchise off the customer site entirely — `franchise.petwash.co.il`
  as a B2B-focused site with its own design system, no Smart Hub
  customer noise, no eGift CTAs, no consumer marketing. This requires
  new DNS + new Cloud Run service (1-2 days infra) but produces a
  visibly different product surface that signals "we take B2B seriously."

**Choose:** Keep on customer site | Migrate to separate sub-domain.

### Locked decisions (if CEO chooses full rebuild)

- **A. P0 triage approach** — Option A (remove unverified claims) | Option B (verify + source). *Recommendation: Option A this week, Option B during Phase 4 if numbers exist.*
- **B. Schema migration** — `franchiseApplications` Postgres table. *Recommendation: approve schema in Phase 2 PR.*
- **C. Investor sub-route** — public + gated download (NDA required) | public no gating | not built at MVP. *Recommendation: NDA-gated download for investors. Public marketing too loose for financial expectations.*
- **D. Host audience** — separate form variant for building owners | merge into operator form. *Recommendation: separate variant. Different value prop, different conversion path.*
- **E. CRM integration** — Salesforce / HubSpot / internal CRM / none for MVP. *Recommendation: none at MVP. Postgres + email is enough until lead volume justifies CRM.*
- **F. Hebrew typeface** — Heebo (recommended) | Alef | Rubik | other. *Recommendation: Heebo. Modern luxury sans-serif, free via Google Fonts, used by leading Israeli premium brands.*
- **G. Testimonial collection workflow** — manual ad-hoc | structured consent form. *Recommendation: structured. One template, signed consent, GDPR-equivalent compliance.*

---

## §16 What this PR does NOT do

- No code changes.
- No schema migrations.
- No new dependencies.
- No email sent.
- No production change.
- No protected systems touched (wallet, K9000, Nayax, Tranzila, auth
  gates, dependencies, schema all untouched).
- No P0 triage applied (separate PR).
- No deletion of any file (proposal only).

Implementation gated on CEO answer to §15 challenges + decisions.

---

## §17 References

- `.claude/skills/petwash-platform/SKILL.md` §0 strategic operating
  pillar (active doctrine).
- `.claude/skills/petwash-platform/SKILL.md` §2 protected systems
  (schema = approval gate).
- `client/src/pages/Franchise.tsx` — main franchise marketing page (781 LOC).
- `client/src/pages/partners/Franchise.tsx` — duplicate franchise page (319 LOC).
- `client/src/components/PetWashHeader.tsx:131-132` — hamburger entry.
- `client/src/components/PetWashHeader.tsx:203` — hamburger link route.
- `server/routes/franchise.ts:26-54` — current intake endpoint.
- `server/email-templates/welcome-franchise-application-2026.ts` —
  dead-code email template (exists, never invoked).
- `client/src/App.tsx:1981-1995, 2048-2071, 2136, 991` — franchise
  route declarations.

---

**End of audit + rebuild proposal.** No code ships. Implementation gated
on CEO answer to §15 challenges (full rebuild vs triage; hamburger vs
sub-domain) and locked decisions (A–G).
