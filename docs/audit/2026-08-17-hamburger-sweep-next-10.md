# Hamburger + Button Functional Sweep — Next 10 Controls

**Lane:** D (read-only audit + up to 2 focused PRs)
**Branch:** `claude/lane-d-hamburger-audit` (off `origin/main`)
**Date:** 2026-08-17
**Scope:** 10 drawer/nav entries — full CLICK → PAGE → CTA → API → AUTH → BACKEND → SAVED-STATE chain.

> Municipal + Locations dead-submit fixes already landed on branch
> `claude/pr-company-cta` (commit `9a2914a37`). Both are flagged here as
> **ALREADY-FIXED-ON-BRANCH-`claude/pr-company-cta`** and were not
> re-fixed by this lane.

Drawer source of truth: `client/src/components/PetWashHeader.tsx`
(USER_MENU_ITEMS lines 199-208, PARTNER_MENU_ITEMS 210-215,
COMPANY_MENU_ITEMS 217-225).

---

## 1. Smart Booking (drawer → `/booking`)

- **CLICK → ROUTE:** registered — `client/src/App.tsx:1279` wraps
  `BookingUnified` in `<RequireAuth>`.
- **PAGE STATE:** signed-in → renders; anonymous → redirect to `/sign-in`.
- **CTA(s):** 5 service cards + 5 "Book Now" buttons in
  `client/src/pages/BookingUnified.tsx:74-107`. Each `onClick`
  `setLocation(service.href)`:
  - `/k9000` — registered (App.tsx:2206) ✓
  - `/sitter-suite/browse` — registered (2104) ✓
  - `/walk-my-pet/explore` — registered (1855) ✓
  - `/pettrek` — registered (1988) ✓
  - `/academy` — registered (1703) ✓
  - PetTrek button correctly disabled via `comingSoon` flag.
- **API:** none direct — this is a routing hub.
- **AUTH:** requires session (`RequireAuth` at App.tsx:1281).
- **BACKEND EFFECT:** none — pure navigation.
- **VERDICT:** **FUNCTIONAL-E2E**.
- **FIX:** none required.

---

## 2. Prestige (drawer → `/loyalty`)

- **CLICK → ROUTE:** registered — `App.tsx:1171` (public) renders
  `Loyalty`.
- **PAGE STATE:** renders for signed-out & signed-in.
- **CTA(s):** `client/src/pages/Loyalty.tsx`:
  - "Activate Membership" hero button — `setLocation('/privilege')`
    (369, 708). `/privilege` registered at App.tsx:1159 → `PrivilegeSignup`. ✓
  - "Explore Tiers" → smooth-scroll to `#membership-tiers` (376-378). ✓
  - "View Rewards" → `setLocation('/packages')` (1091). Route registered.
    Emits `trackEvent('view_rewards_click')` (1084). ✓
  - Bottom CTA — `<Link href="/privilege">` (1169) and
    `<Link href="/loyalty/dashboard">` (1175). Both registered
    (`/loyalty/dashboard` at App.tsx:1176 is `<RequireAuth>`). ✓
  - "Explore your membership" grid — 3 `<Link>` to `/loyalty/tiers`,
    `/loyalty/benefits`, `/loyalty/birthday` (1197). All registered
    (1185-1193). ✓
- **API:** loyalty summary reads from `/api/loyalty/profile` (invalidation
  list App.tsx:743). Public landing has no writes.
- **AUTH:** public page, signed-in-only sections gated via query.
- **BACKEND EFFECT:** none from public landing.
- **VERDICT:** **FUNCTIONAL-E2E**.
- **FIX:** none.

---

## 3. Refer a Friend (drawer → `/loyalty/refer`)

- **CLICK → ROUTE:** registered — `App.tsx:1194` (public — NO
  `RequireAuth`).
- **PAGE STATE:** renders for signed-out & signed-in.
- **CTA(s):** `client/src/pages/LoyaltyRefer.tsx`:
  - Copy-code button `onClick={handleCopy}` (197) — copies real code /
    empty string; toast fires either way.
  - 4 share links: WhatsApp/Facebook/Email/SMS (204-217) — all real
    URLs (`wa.me`, `facebook.com/sharer`, `mailto:`, `sms:`).
  - Back link `<Link href="/loyalty">` (152) — ✓.
- **API:** `GET /api/referral/link` (LoyaltyRefer.tsx:35). Handler
  `server/routes/referral.ts:95` gated by `requireAuth`. Response shape
  `{ referralCode: string|null, stats: {...} }` matches client type
  `SummaryData` (LoyaltyRefer.tsx:17-20). ✓
- **AUTH:** endpoint requires session; client only fires query when
  `!!user` (LoyaltyRefer.tsx:40). Signed-out users see empty code / zero
  stats.
- **BACKEND EFFECT:** on GET, `getOrCreateReferralCode` writes
  `users.referral_code` if missing (mint-on-read, per file docstring
  §referral.ts:1-30).
- **VERDICT:** **MISLEADING-LABEL** for signed-out visitors — the page
  loads, but the share code is a blank string and the share payload
  omits the code (LoyaltyRefer.tsx:49). Not a dead button, but a
  stranger who arrives from the drawer never gets attribution.
- **FIX RECOMMENDATION:**
  - `client/src/App.tsx:1194` — wrap `<LoyaltyRefer />` in
    `<RequireAuth>` (same treatment as `/loyalty/dashboard` at 1176-1181).
    Not shipped by this lane: touching auth wrappers is off-limits per
    the CEO fire order. Alternative one-line UI fix: render a
    "Sign in to get your code" CTA when `!user`
    (`LoyaltyRefer.tsx:194` — replace the empty-string branch of
    `displayCode` with a sign-in prompt).

---

## 4. e-Gift (drawer → `/egift`)

- **CLICK → ROUTE:** registered — `App.tsx:1228, 1231, 1234, 1253`
  (`/egift`, `/e-gift`, `/gift-cards`, `/e-gifts` all → `EGift`).
- **PAGE STATE:** public. Renders for guest & member.
- **CTA(s):** `client/src/pages/EGift.tsx`:
  - Card selector (1645), occasion buttons, message language toggle
    (1267), suggested-message buttons (1291) — all wired to local state.
  - "Continue" (`proceedToCheckout`, 1717) sets step. ✓
  - "Pay" (`handleCheckout`, 1345) — 899-979:
    - Guest path → `startGuestEgiftCheckout` (public SUMIT begin).
    - Signed-in path → `startSkuCheckout` with SKU mapped from tier
      (940-943), metadata carries recipient + occasion.
    - Custom-amount tier honestly toasts "coming soon" instead of a fake
      submit (944-952).
- **API:** `POST /api/payments/sumit/begin` (money code — out of scope
  for this lane). Post-payment fulfilment via SUMIT webhook +
  `GiftOrchestrationService` (per handler docstring 935-937).
- **AUTH:** public (guest checkout available).
- **BACKEND EFFECT:** SUMIT charge → gift voucher issued
  post-verification. Return URLs `/payment-success` (App.tsx:1241) and
  `/payment-failed` (1244) both registered.
- **VERDICT:** **FUNCTIONAL-E2E** — money rail; not touched by this lane.
- **FIX:** none.

---

## 5. Find Station (drawer → `/map`)

- **CLICK → ROUTE:** registered — `App.tsx:1303-1305` renders
  `<Layout><StationMap /></Layout>`.
- **PAGE STATE:** public.
- **CTA(s):** `client/src/pages/StationMap.tsx`:
  - "View Station List" button (51) — `onClick={() => setLocation('/locations')}`.
    `/locations` renders `Locations`; the redirect for `/stations` also
    points there (App.tsx:1268).
  - Previous dead search/filter controls were already REMOVED (see
    inline comment StationMap.tsx:31-37) — page is honest about its
    "coming soon" map placeholder.
- **API:** none from this page.
- **AUTH:** public.
- **BACKEND EFFECT:** navigation only.
- **VERDICT:** **FUNCTIONAL-E2E** (deliberately minimal until real map
  ships).
- **FIX:** none.

---

## 6. Franchise (drawer → `/franchise`, NOT `/partners/franchise`)

- **CLICK → ROUTE:** drawer's Partner-menu "franchise" entry sends the
  user to `/franchise` — `client/src/components/PetWashHeader.tsx:211`
  reads `href: "/franchise"`. **The task brief expected
  `/partners/franchise`; the actual drawer link differs.**
  Route `/franchise` registered at `App.tsx:2937` (renders `Franchise`
  from `@/pages/Franchise.tsx`). Separate page
  `FranchisePartners` (from `@/pages/partners/Franchise.tsx`) lives at
  `/partners/franchise` (App.tsx:1353) and is only reachable via direct
  URL or SEO — the drawer does NOT link there. Two "franchise" pages
  co-exist.
- **PAGE STATE:** `/franchise` renders `Layout` + luxury marketing page.
- **CTA(s):** `client/src/pages/Franchise.tsx`:
  - "Request the information pack" → `mailto:franchise@petwash.co.il`
    with subject (188). ✓
  - "Speak with the franchise team" → mailto (191). ✓
  - Contact-section mailto with prefilled body (302). ✓
- **API:** none. Contact happens via email.
- **AUTH:** public.
- **BACKEND EFFECT:** none (email routed to franchise@petwash.co.il).
- **VERDICT:** **FUNCTIONAL-E2E** for the drawer target. Adjacent issue:
  duplicate `/partners/franchise` page (with a real `POST /api/franchise/inquiry`
  form) is orphaned from the drawer — customers reach it only via SEO.
- **FIX RECOMMENDATION:** decide which of the two "franchise" pages is
  canonical. Cheapest: point drawer to the version with the actual
  server-writing form (`PetWashHeader.tsx:211` → `/partners/franchise`)
  so mailto isn't the only channel. Left for design; not shipped.

---

## 7. Locations (drawer → `/partners/locations`)

- **CLICK → ROUTE:** registered — `App.tsx:1356`.
- **PAGE STATE:** renders `LocationPartners`.
- **CTA(s):** "Submit Partnership Enquiry"
  (`client/src/pages/partners/Locations.tsx:73-75` **on `main`**) has
  **NO `onClick`**. Dead button.
- **API:** none reachable from the button on `main`.
- **AUTH:** n/a.
- **BACKEND EFFECT:** none — click is silently swallowed.
- **VERDICT:** **ALREADY-FIXED-ON-BRANCH-`claude/pr-company-cta`**
  (commit `9a2914a37`) — the fix wires the button to a shared
  `PartnershipEnquiryDialog` → `POST /api/contact`.
- **FIX:** land `claude/pr-company-cta`. Not re-fixed by this lane.

---

## 8. Suppliers (drawer → `/partners/suppliers`)

- **CLICK → ROUTE:** registered — `App.tsx:1359`.
- **PAGE STATE:** renders `SuppliersPartners`.
- **CTA(s):** `client/src/pages/partners/Suppliers.tsx`:
  - "Apply as Supplier" (141) opens modal form. ✓
  - Modal submit `handleSubmit` (33) POSTs to
    `/api/franchise/inquiry`, prepending `[SUPPLIER inquiry …]` to
    `message` so the shared endpoint routes to the right inbox (49-53).
- **API:** `POST /api/franchise/inquiry` (server/routes.ts:11686). Public
  endpoint, rate-limited (`apiLimiter`, CSRF-exempt at index.ts:855).
  Server accepts `{ fullName, email, phone, country?, city?, message? }`
  — matches client payload exactly. Requires `fullName`, `email`,
  `phone` (server line 11689) — client validates the same three (36-42).
- **AUTH:** public.
- **BACKEND EFFECT:** writes doc to Firestore collection
  `franchise_inquiries` (server line 11704), falls back to structured
  logger if Firestore write fails.
- **VERDICT:** **FUNCTIONAL-E2E**.
- **FIX:** none.

---

## 9. Municipal (drawer → `/partners/municipal`)

- **CLICK → ROUTE:** registered — `App.tsx:1362`.
- **PAGE STATE:** renders `MunicipalPartners`.
- **CTA(s):** "Submit Council Enquiry"
  (`client/src/pages/partners/Municipal.tsx:87-89` **on `main`**) has
  **NO `onClick`**. Dead button.
- **API:** none reachable on `main`.
- **AUTH:** n/a.
- **BACKEND EFFECT:** none — click silently swallowed.
- **VERDICT:** **ALREADY-FIXED-ON-BRANCH-`claude/pr-company-cta`**
  (commit `9a2914a37`) — button now opens `PartnershipEnquiryDialog` →
  `POST /api/contact`.
- **FIX:** land `claude/pr-company-cta`. Not re-fixed by this lane.

---

## 10. Careers (drawer → `/careers`)

- **CLICK → ROUTE:** registered — `App.tsx:1314-1316`.
- **PAGE STATE:** public listing; application flow requires filling
  email (no session, but email-scoped autosave).
- **CTA(s):** `client/src/pages/Careers.tsx`:
  - Hero "See positions" scroll-into-view (442). ✓
  - Per-position "Apply" (565, 663) → `handleApply(position)`. ✓
  - Wizard nav — Next / Previous (961, 1031, 1038, 1140) — local state.
  - "Submit application" (1147) → `handleSubmitApplication` (340). ✓
  - "Upload resume" (1255) → `handleResumeUpload` → multipart POST.
- **API:**
  - `GET /api/careers/positions` (client 127) — server
    `routes/careers.ts:53` (public). ✓
  - `POST /api/careers/start-application` (client 133) — server
    `routes/careers.ts:619`. ✓
  - `POST /api/careers/apply` (client 230) — server
    `routes/careers.ts:289`. ✓
  - `POST /api/careers/applications/:id/autosave` (client 154) — server
    `routes/careers.ts:707`. ✓
  - `POST /api/careers/applications/:id/documents` (client 374) — server
    `routes/careers.ts:545` (multer `upload.single('document')`). ✓
  - `GET /api/careers/applications/:id/progress` (client 172) — server
    `routes/careers.ts:826`. ✓
  - Mount point `server/routes.ts:12536` — `apiLimiter`, no auth
    middleware (public application flow; admin routes live under
    `/admin/*` inside the same router, gated per-route — see comment
    `routes/careers.ts:23-28`).
- **AUTH:** public. Fraud/duplicate/velocity checks live in the handler
  (`apply` at 339-401).
- **BACKEND EFFECT:** writes to careers-applications tables + documents
  storage. Confirmation dialog shown via `handleCloseSuccessDialog`
  (1248).
- **VERDICT:** **FUNCTIONAL-E2E**.
- **FIX:** none.

---

## Summary

| # | Control | Verdict |
|---|---|---|
| 1 | Smart Booking → `/booking` | FUNCTIONAL-E2E |
| 2 | Prestige → `/loyalty` | FUNCTIONAL-E2E |
| 3 | Refer a Friend → `/loyalty/refer` | MISLEADING-LABEL (unauth) |
| 4 | e-Gift → `/egift` | FUNCTIONAL-E2E |
| 5 | Find Station → `/map` | FUNCTIONAL-E2E |
| 6 | Franchise → `/franchise` (drawer target) | FUNCTIONAL-E2E (adjacent duplicate page issue) |
| 7 | Locations → `/partners/locations` | ALREADY-FIXED-ON-BRANCH-`claude/pr-company-cta` |
| 8 | Suppliers → `/partners/suppliers` | FUNCTIONAL-E2E |
| 9 | Municipal → `/partners/municipal` | ALREADY-FIXED-ON-BRANCH-`claude/pr-company-cta` |
| 10 | Careers → `/careers` | FUNCTIONAL-E2E |

**Counts (10 audited):**
- FUNCTIONAL-E2E: **7** (Smart Booking, Prestige, e-Gift, Find Station, Franchise, Suppliers, Careers)
- ALREADY-FIXED-ON-BRANCH: **2** (Locations, Municipal)
- MISLEADING-LABEL: **1** (Refer a Friend for unauth)
- DEAD-BUTTON (still on main, unfixed): **0**
- CONTRACT-MISMATCH: **0**
- BROKEN-ROUTE: **0**
- AUTH-MISMATCH: **0**

## Highest-severity single finding

**Duplicate Franchise pages, drawer points at the mailto-only version.**
The drawer link "Franchise" opens `/franchise`
(`pages/Franchise.tsx`) whose only CTAs are `mailto:franchise@petwash.co.il`.
Meanwhile a parallel page at `/partners/franchise`
(`pages/partners/Franchise.tsx`) has a fully-wired
`POST /api/franchise/inquiry` form (writes to Firestore, matches Suppliers
& audited endpoint) — but is not linked from the drawer. Result: the
"Franchise" entry point captures zero structured leads unless the visitor
happens to arrive via SEO. **This is a lead-capture leak on a
partnership channel Nir explicitly cited in the sweep brief.**

Recommendation (one-line, out-of-scope for this lane): change
`PetWashHeader.tsx:211` from `href: "/franchise"` to
`href: "/partners/franchise"`, then delete the orphaned
`pages/Franchise.tsx` in a follow-up PR (or vice-versa if the mailto
page is preferred).

## Quick-fix PRs shipped

**None.** Every dead button in this 10-control set is already handled
by `claude/pr-company-cta`. The remaining single actionable finding
(drawer's `/franchise` → `/partners/franchise` re-point) touches the
one file already modified by other lanes' PRs and duplicates the
adjacent-page cleanup — deferring to a design-owner review rather than
racing another lane on `PetWashHeader.tsx`.
