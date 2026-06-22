# Builds A / B / C — Plan & Decisions Needed

**22 June 2026.** Grounded in a read-only investigation of the actual code. Nothing changed yet.
A is safe to build now; **B and C touch money math / schema and need CEO sign-off on the numbers
before any code.** Confirmed bugs are flagged ⚠️.

---

## A — In-app member pass

**Finding:** The pass already works. `client/src/pages/PrestigePassWallet.tsx` (route
`/prestige-pass`, behind `RequireAuth`) renders the full member pass and a live QR via
`POST /api/prestige-pass/token/generate` (45-sec rotating token, `qrcode.react`). It is
**completely independent of the Apple Wallet certificate** — works in-app today. Already on gold
`#D9B84C`, no teal.

**The one real gap:** logged-in members land on `/home` → `<Landing>` (the marketing page), not
their pass. They must navigate manually. (`App.tsx` home route → `Home.tsx` → `Landing`.)

**Proposed fix (safe, bounded, no money/schema):**
- Add a prominent, always-visible **"My Pass"** entry for signed-in members (top nav / dashboard
  tile) → `/prestige-pass`.
- Optionally: after login, route prestige members to `/prestige-pass` as their home instead of the
  marketing Landing. **This is a product call — confirm:** should a logged-in member's home be
  their Pass, or keep the marketing page? (Recommend: Pass for members, marketing for guests.)

**Decision needed:** member home = Pass, or keep marketing + add a clear "My Pass" button?

---

## B — Unify the three tier ladders

**Finding — three disagreeing ladders:**

| Order | PrivilegeSignup.tsx | Loyalty.tsx | schema-loyalty.ts (CANONICAL) |
|---|---|---|---|
| 1 | Bronze (0) | Member | Bronze (0) |
| 2 | Silver (1K) | Signature | Silver (2.5K) |
| 3 | Gold (5K) | Elite | Gold (7.5K) |
| 4 | Platinum (15K) | Privilege | Platinum (15K) |
| 5 | Diamond (30K) | Black Reserve | Diamond (25K) |
| 6 | Royal Black (50K) | — | Emerald (40K) |
| 7 | Crown (100K) | — | Royal (50K) |

⚠️ **FALSE-INFO BUG:** `Loyalty.tsx` (lines ~92–100) shows **Black Reserve = 25% discount**. No
tier can give 25% — the real applied ladder is 5/6/7/8/9/10/15% and the wash-discount cap is 10%
(`memberDiscount.ts`, `MEMBER_DISCOUNT_MAX_PERCENT=10`, `PRESTIGE_BASIC_PERCENT=5`). This is
exactly the kind of over-promise to remove.

**Proposed unification (needs your sign-off on names + numbers):**
1. **Pick ONE set of 7 tier names.** Recommend the canonical: Bronze → Silver → Gold → Platinum →
   Diamond → Emerald → Royal. *(Or keep your luxury names — Crown/Black Reserve — if you prefer the
   marketing feel. Your call.)*
2. **One threshold set** — recommend canonical: 0 / 2.5K / 7.5K / 15K / 25K / 40K / 50K.
3. **Fix the 25% display** → correct it to the real number for that tier.
4. Re-point `PrivilegeSignup.tsx` and `Loyalty.tsx` at the canonical list (retire their local
   hardcoded arrays at `Loyalty.tsx:30–90` and `PrivilegeSignup.tsx:58–66`).
5. Keep the **K9000-only discount rule** intact (these tier % apply to washes only, never
   marketplace).

**Decisions needed:** (a) final tier names — canonical or your luxury names? (b) confirm the
threshold set. (c) confirm each tier's real discount % (to replace the false 25%).

---

## C — Long-stay / house-hosting rate engine

**Finding:** Boarding pricing is a flat `pricePerDayCents × days`. Lots of the engine schema exists
but **sitter-suite ignores it**, and there's a real undercharge bug.

⚠️ **MONEY BUG:** `BookingLifecycleService.ts:166–168` applies the additional-pet surcharge **once
per booking, not per night.** A 2-pet, 5-night stay charges 1× the surcharge instead of 5×.
`SitterAdvancedBookingEngine` has **no** multi-pet logic at all.

**Exists but unused by sitter-suite:** `sitterProfiles.discountTiers` (weekly/biweekly/monthly),
`pricingPackages`, `extraServices`; `providerRateCards` (per-night, multi-pet surcharge,
weekly/monthly discount, weekend/holiday surcharge, pet-type pricing, add-ons).

**Missing entirely:** tiered nightly rates (night 1 vs 2–7 vs 8–30 vs 31+), cleaning fee, deposit/
security hold for long stays, per-day (not flat) holiday/weekend surcharge, peak-season date ranges,
stored quote breakdown.

**Proposed engine (needs your sign-off on the numbers + which features to ship):**
1. **Fix the multi-pet bug** → surcharge × additional pets × nights. *(This is a correctness fix —
   approve and I'll do it first.)*
2. **One pricing pipeline** reading `sitterProfiles`: per-night loop applying nightly-rate tier,
   weekend/holiday/peak surcharge per day, multi-pet/night, add-ons/night, then length-of-stay
   discount, then cleaning fee + deposit. (Keep 15% commission + 18% VAT + K9000-discounts-excluded.)
3. **Schema additions** (migration, needs approval): `nightlyRateProgression`, `cleaningFeeCents`,
   `depositPercentage`, `peakDateRanges`, and a `sitterQuoteDetails` table to store the breakdown.

**Decisions needed:** (a) which features for launch vs later? Recommend launch = fix multi-pet bug +
length-of-stay discount + cleaning fee + deposit; defer demand-surge/rebooking/pet-type. (b) the
actual numbers (cleaning fee ₪?, deposit %?, nightly-rate tiers?). (c) approve the migration.

---

## Recommended order

1. **A** — safe, build now once you pick "member home = Pass or button."
2. **C's multi-pet bug** — pure correctness fix, approve and it's quick.
3. **B** — after you pick names + numbers (mechanical once decided).
4. **C full engine** — after you approve features + numbers + migration.

*Reply with the decisions and I build each exactly to them — no guessing on your money.*

---

## DECISIONS CONFIRMED (CEO, 22 Jun 2026) + what shipped

- **A — member home:** keep marketing home, add a "My Pass" button. ✅ SHIPPED — `PetWashHeader.tsx`
  now shows a "My Pass" entry (header icon next to the bell + mobile drawer) → `/prestige-pass`,
  bilingual. No layout change.
- **C — multi-pet bug:** fix per-night. ✅ SHIPPED — `BookingLifecycleService.ts` now multiplies the
  additional-pet surcharge by nights for per-night bookings. Quote tests pass.
- **B — tier names:** unified 7-tier ladder = **Member · Signature · Elite · Privilege · Diamond ·
  Black Reserve · Crown**.
- **B — the +25% row:** it's a discount → **cap at 15%**. ✅ SHIPPED — `Loyalty.tsx`
  `compareBonusCredit` top column +25% → +15% (removes the impossible claim).

### B — remaining work (NOT yet built; needs a careful, mockup-first session)

The 5 current tiers (`Loyalty.tsx` PRESTIGE_TIERS) must grow to the 7 confirmed names by inserting
**Diamond** (between Privilege and Black Reserve) and **Crown** (top). This requires:
1. **Mockup-first** the two NEW cards (Diamond = icy platinum/silver; Crown = brand gold sheen) and
   get CEO approval before coding — per the brand rule (never build a visual unapproved).
2. New i18n keys: `privilege.tierDiamond(/Desc/Benefit1/2)`, `privilege.tierCrown(...)` across all
   6 languages, plus 2 extra values in every `COMPARISON_ROWS` array.
3. Re-point `PrivilegeSignup.tsx` (its 7 ids bronze→crown) to the confirmed luxury names.
4. Decide whether the canonical `schema-loyalty.ts` enum (Bronze→Royal) is renamed too — that's a
   DB enum/migration with backend blast radius; recommend keeping the schema keys stable and mapping
   display names in the UI layer (no migration) unless CEO wants the DB values renamed.
5. Confirm the real per-tier discount % for all 7 (must respect: member 5%, ≤10% standard, 15% only
   via Black code) before any number reaches the UI.

Recommendation: build B's visual expansion in a dedicated mockup→approve→implement pass, not at the
tail of a long session.
