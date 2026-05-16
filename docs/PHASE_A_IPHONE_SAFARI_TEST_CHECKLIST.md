# Phase A — iPhone Safari verification checklist

**Scope:** verifies PR #298 (Phase A emergency UX unblock) on iPhone Safari and iPad Safari.
**When to run:** AFTER PR #298 deploys to production (Cloud Run picks it up within ~3 minutes of merge).
**Pre-req:** physical iPhone (iOS 16+ Safari) and iPad (iPadOS 16+ Safari). Private browsing window strongly recommended (no cached service worker).

**This is NOT a substitute for Phase B or Phase C.** It only verifies what shipped in Phase A.

---

## §0 What this checklist does NOT cover

- ✗ Google Places address autocomplete behaviour — broken independently, separate PR coming
- ✗ Phone OTP SMS arrival reliability — Phase B1
- ✗ OAuth consent screen logo + app name — those live in Google Cloud Console, Phase C action by CEO
- ✗ Support email split (`contact@petwash.co.il` vs `support@petwash.co.il`) — Phase C
- ✗ Pet photo upload — PR-D2
- ✗ Customer / loyalty / sitter / walker intent forks — separate architecture audit

---

## §1 Pre-flight (1 minute)

| Step | Expected |
|---|---|
| Wait 5 minutes after PR #298 merges so Cloud Run finishes deploying | — |
| On iPhone, open Settings → Safari → **Clear History and Website Data** (or use a fresh Private window) | — |
| Open `https://petwash.co.il` in Safari | Homepage renders; no console errors visible to user |

---

## §2 Test 1 — Bottom-right overlay suppressed on immersive flows (item 6)

| # | Action | Expected | Screenshot? |
|---|---|---|---|
| 1.1 | Tap "Sign in" / "התחבר" — land on `/sign-in` | No floating "Complete your profile" card bottom-right | ✓ if violated |
| 1.2 | Sign in via Google or phone OTP | After sign-in, redirect to home or dashboard | — |
| 1.3 | Navigate to `petwash.co.il/provider-onboarding` | Form page renders. NO bottom-right floating card. NO bottom notification prompt. NO floating chat / accessibility / promo overlays | **YES — screenshot full page** |
| 1.4 | Scroll the form to the bottom | Continue / Next button is reachable, not obscured by anything | — |
| 1.5 | Repeat 1.3 + 1.4 on iPad Safari | Same expected | — |

**Pass criteria:** zero floating overlays render on `/provider-onboarding`. Form scrolls cleanly. If any overlay appears bottom-right or bottom-center, capture screenshot — gating regression.

---

## §3 Test 2 — Legacy provider routes 302 redirect (item 4)

| # | Action | Expected |
|---|---|---|
| 2.1 | Manually type `https://petwash.co.il/apply-provider` in Safari address bar | URL rewrites to `https://petwash.co.il/provider-onboarding` immediately. Form renders. |
| 2.2 | Manually type `https://petwash.co.il/join-team` | Same — rewrites to `/provider-onboarding`. |
| 2.3 | Query string preservation: `https://petwash.co.il/apply-provider?role=walker` | Rewrites to `/provider-onboarding?role=walker`. |

**Pass criteria:** all three URLs resolve to `/provider-onboarding`. Address bar changes (visible to user) — this is a client-side redirect for the 90-day window.

---

## §4 Test 3 — Country selector + phone input order locked (item 2)

| # | Action | Expected | Screenshot? |
|---|---|---|---|
| 3.1 | On `/provider-onboarding`, switch language to **Hebrew** (top-right language picker, choose "עברית") | Page re-renders RTL. Most text right-aligned. | — |
| 3.2 | Scroll to the "Phone / טלפון" field | **Country selector visible on the LEFT. Phone input on the RIGHT.** "Send Code / שלח קוד" button rightmost. | **YES — screenshot the phone row** |
| 3.3 | Tap the country selector | Dropdown opens. Each row shows ISO-2 code + dial code: `IL +972 Israel`, `US +1 USA / Canada`, etc. **NO flag emojis.** | **YES — screenshot dropdown** |
| 3.4 | Switch language back to **English** | Page re-renders LTR. Phone row order unchanged: country LEFT, phone RIGHT. | — |

**Pass criteria:** country selector is always physically LEFT of the phone input regardless of language. No flag emojis in the dropdown.

---

## §5 Test 4 — Hebrew BiDi marks render brand mark left-to-right (item 3)

| # | Action | Expected | Screenshot? |
|---|---|---|---|
| 4.1 | On `/provider-onboarding` in Hebrew, look at the page **title** at top: should read "הצטרפו לצוות PetWash™" | "PetWash™" renders as a single contiguous brand mark, left-to-right, NOT visually broken or reversed | **YES — screenshot title** |
| 4.2 | Scroll to the declarations section. Look for "...יאומתו ידנית על ידי צוות PetWash™." | Same — "PetWash™" appears as a single LTR brand mark inside the Hebrew sentence | — |

**Pass criteria:** "PetWash™" never appears as `™hsaWteP` (reversed) or with the trademark symbol mis-placed. iPhone Safari is the historical offender here.

---

## §6 Test 5 — Emoji audit on professional onboarding (item 1)

Walk through every section of `/provider-onboarding` (top to bottom). Also `/apply-provider` (which now redirects, so won't hit). Also `/join/walker`, `/join/sitter`, `/join/trainer`.

| # | Surface | Expected |
|---|---|---|
| 5.1 | Provider type selection cards (Walker, Sitter, PetTrek Driver, Trainer, Station Operator) | Each card shows a **Lucide icon** (line drawing, monochrome) above the label. NO emoji. |
| 5.2 | Phone verified badge after OTP success | "Verified / מאומת" with a small `<CheckCircle2>` icon. NO ✅. |
| 5.3 | Phone OTP error banner | Red text with a small `<AlertTriangle>` icon. NO ⚠️. |
| 5.4 | Toast notifications ("SMS code sent", "Phone verified") | Plain text titles. NO emoji glyph. |
| 5.5 | Declaration section headers (Driver, Trainer, Sitter/Walker, General, Self-declaration) | Each header has a small Lucide icon prefix. NO 🚗, 🎓, 🐕, ✅, 🛡️. |
| 5.6 | "Legal Notice" paragraph at the bottom of declarations | Starts with bold "Legal Notice:" / "הערה משפטית:". NO ⚖️. |
| 5.7 | `/join/sitter` step 3 ("What You Offer") | Step indicator shows a Lucide checkmark. NO 🐾. |
| 5.8 | `/join/trainer` page — specialty cards (Obedience, Puppy, etc) | Cards render label only (no emoji). Same for service type cards. |
| 5.9 | `/join/trainer` "Certification Bonus" callout | Plain "Certification Bonus" headline. NO 💡. |
| 5.10 | `/join/walker` equipment checklist (First Aid Kit, Body Camera, Car Transport) | Plain text rows. NO 🩺, 📷, 🚗. |

**Pass criteria:** zero emoji glyphs anywhere on the professional onboarding surface. If a glyph appears, screenshot + note the URL + scroll position.

---

## §7 Test 6 — OAuth consent screen brand string (item 5, partial)

| # | Action | Expected | Screenshot? |
|---|---|---|---|
| 6.1 | From a signed-out state, on `/provider-onboarding`, tap "Sign in with Google" (if presented) | Google's OAuth consent screen renders | **YES — screenshot full consent screen** |
| 6.2 | Look at the app-name label on the consent screen | Should say **"PetWash™"** — NOT "Pet Wash™ Ltd" or "Pet Wash Ltd" | — |
| 6.3 | If the screen still shows "Pet Wash Ltd" + old/missing logo | That's a **Google Cloud Console** config that CEO has not yet updated (Phase C action). Repo string is correct; console upload pending. | — |

**Note:** the consent screen's **logo** and **support email** are owned by Google Cloud Console (Phase C action by CEO). Phase A only fixes the repo-side "Pet Wash™ Ltd" string that appears in some auth UI inside the app.

---

## §8 Screenshot bundle needed (send to engineering after the run)

The mandatory minimum set:

1. `/provider-onboarding` full page on iPhone Safari (English) — proves no overlay leak
2. `/provider-onboarding` full page on iPhone Safari (Hebrew) — proves no overlay leak + brand mark
3. Phone-field close-up on Hebrew RTL — proves country LEFT / phone RIGHT
4. Country dropdown open on Hebrew RTL — proves no flag emojis
5. Hebrew page title close-up showing "PetWash™" rendered left-to-right
6. Google OAuth consent screen — current state (we expect "Pet Wash Ltd" + old logo until CEO completes Phase C)
7. **If you see ANY emoji on the page**: screenshot + URL + Hebrew/English mode

Optional (only if a test fails):
8. Browser DevTools console error log (Safari → Develop menu → enable on iPhone via Settings → Safari → Advanced → Web Inspector)
9. Network tab snapshot if a request fails

---

## §9 What happens if a test fails?

- Take the screenshot listed for that test.
- Note: URL, language (en/he), iOS version, device model.
- Reply in the PR #298 thread with the screenshot + which test number failed.
- Engineering will diagnose against the audit doc (`docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md`) and the Phase A commits in this PR.

---

## §10 Sign-off

When all six tests pass, comment on PR #298 with:
> Phase A verified on iPhone <model> iOS <version> and iPad <model> iPadOS <version>. Approving merge to main.

CEO retains final merge authority.
