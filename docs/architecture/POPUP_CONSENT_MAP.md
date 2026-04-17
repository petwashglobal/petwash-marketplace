# POPUP_CONSENT_MAP.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit

---

## All Popup/Modal/Consent Components

| Component | File | Mount Point | Trigger | Status |
|---|---|---|---|---|
| `PromoAdPopup` | components/PromoAdPopup.tsx | App.tsx:3048 | Auto 500ms after mount | **CORRECT** (suppression list updated) |
| `CookieConsent` | components/CookieConsent.tsx | App.tsx:3037 | Auto 1000ms if no preferences | **CORRECT** (GDPR required on all routes) |
| `ConsentManager` | components/ConsentManager.tsx | App.tsx:3041 | User-triggered via CookieConsent | **CORRECT** (modal only, no auto-show) |
| `KenzoWelcomePopup` | components/KenzoWelcomePopup.tsx | NOWHERE | Auto 1500ms if mounted | **DEAD** — never imported, never mounted |
| `LoyaltyWelcomeModal` | components/LoyaltyWelcomeModal.tsx | NOWHERE | Auto 3000ms if not logged in | **DEAD** — never imported, never mounted |
| `VIPLoyaltyPopup` | components/VIPLoyaltyPopup.tsx | NOWHERE | Manual `isOpen={true}` | **DEAD** — never imported, never mounted |
| `TierUpgradeModal` | components/TierUpgradeModal.tsx | NOWHERE | Manual `open={true}` | **DEAD** — never imported, never mounted |
| `WelcomeConsent` | pages/WelcomeConsent.tsx | App.tsx:644 | Direct navigation to `/welcome-consent` | **CORRECT** |
| `ConsentOnboarding` | pages/ConsentOnboarding.tsx | App.tsx:645 | Direct navigation to `/consent-onboarding` | **FIXED** (suppression added) |
| `NotificationConsent` | pages/NotificationConsent | App.tsx:646 | Direct navigation to `/notification-consent` | **FIXED** (suppression added) |

---

## PromoAdPopup Suppression List (Updated)

**File:** `client/src/components/PromoAdPopup.tsx` lines 6-13

```typescript
const SUPPRESSED_PATH_PREFIXES = [
  '/sign-in', '/signin', '/login', '/signup', '/sign-up', '/register',
  '/become-provider', '/provider-onboarding', '/provider/pending', '/provider/rejected',
  '/privilege', '/loyalty/join', '/vito', '/choose-role', '/complete-profile',
  '/welcome-consent', '/verify-email', '/activate-account', '/blocked',
  // FIXED 2026-04-17: consent chain was missing — popup was interrupting onboarding
  '/consent-onboarding', '/notification-consent',
];
```

**Before fix:** PromoAdPopup could appear on `/consent-onboarding` and `/notification-consent`, interrupting the consent chain users must complete after sign-up.

---

## Consent Chain Flow

```
New user sign-up
  ↓
/choose-role  (PromoAdPopup suppressed ✓)
  ↓
/welcome-consent  (PromoAdPopup suppressed ✓)
  ↓
/consent-onboarding  (PromoAdPopup suppressed ✓ FIXED)
  ↓
/notification-consent  (PromoAdPopup suppressed ✓ FIXED)
  ↓
/dashboard
```

---

## Dead Components — Safe to Delete

These components are defined but NEVER imported or mounted anywhere in the application:

1. `client/src/components/KenzoWelcomePopup.tsx`
2. `client/src/components/LoyaltyWelcomeModal.tsx`
3. `client/src/components/VIPLoyaltyPopup.tsx`
4. `client/src/components/TierUpgradeModal.tsx`

**Decision gate:** Before deleting, verify with `git log --follow` that these were not recently unmounted (may be re-added soon). Safe to delete in a separate cleanup PR only after 30-day confirmation they are not needed.

---

## Popup Policy (Canonical)

| Route Pattern | PromoAdPopup | CookieConsent | Other Auto-Popups |
|---|---|---|---|
| `/` (home, public) | ✓ ALLOWED | ✓ ALLOWED | None |
| `/dashboard` | ✓ ALLOWED | ✓ ALLOWED | None |
| `/sign*`, `/login`, `/register` | ❌ SUPPRESSED | ✓ ALLOWED | None |
| `/become-provider`, `/provider-onboarding` | ❌ SUPPRESSED | ✓ ALLOWED | None |
| `/privilege`, `/loyalty/join`, `/vito` | ❌ SUPPRESSED | ✓ ALLOWED | None |
| `/welcome-consent` | ❌ SUPPRESSED | ✓ ALLOWED | None |
| `/consent-onboarding` | ❌ SUPPRESSED **FIXED** | ✓ ALLOWED | None |
| `/notification-consent` | ❌ SUPPRESSED **FIXED** | ✓ ALLOWED | None |
| `/verify-email`, `/activate-account`, `/blocked` | ❌ SUPPRESSED | ✓ ALLOWED | None |
