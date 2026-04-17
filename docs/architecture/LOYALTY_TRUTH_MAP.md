# LOYALTY_TRUTH_MAP.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit

---

## Route Mounts (server/routes.ts)

| Mount Point | Route File | Auth | Purpose |
|---|---|---|---|
| `POST /api/prestige/join` | prestige-join.ts | Firebase token | **CANONICAL JOIN** — atomic enrollment |
| `GET/POST /api/prestige-pass/*` | prestige-pass.ts | API limiter | Pass generation, wallet, QR codes |
| `GET/POST /api/privilege/*` | privilege-loyalty.ts | None | Admin prestige registration + email check |
| `GET/POST /api/vito/*` | privilege-loyalty.ts | None | **ALIAS** — identical handler to `/api/privilege` |
| `GET/POST /api/loyalty/*` | loyalty.ts | Firebase token + onboarding | Points, badges, challenges, rewards, profile |
| `GET/POST /api/loyalty-credits/*` | loyalty-credits.ts | API limiter | Credit wallet management |
| `GET/POST /api/admin/loyalty/*` | admin-loyalty.ts | Admin limiter | Rules engine, stats, winback, ledger |

**Key finding:** `/api/vito` is a direct alias to `/api/privilege` (routes.ts:9233). Not a separate system.

---

## Canonical Loyalty Join Flow

```
PrivilegeSignup.tsx (client/src/pages/PrivilegeSignup.tsx)
  ↓ POST /api/prestige/join (prestige-join.ts:60)
  ↓ Atomic 5-step transaction:
    1. INSERT loyalty_profiles (tier=bronze, 100 welcome points)
    2. INSERT privilege_members (status=pending_verification)
    3. CREATE Firestore prestige_passes/{memberId} with tier + cardNumber + freeWashesRemaining
    4. Ensure wallet account via authService
    5. Send welcome email with card details (HTML template)
  ↓ Response: { ok, memberId, cardNumber, tier, tierDisplay, loyaltyProfile, emailSent }
```

**Free washes by tier** (prestige-join.ts:58):
- Pearl: 1 wash
- Black: 5 washes
- Platinum: 3 washes

---

## Database Tables

| Table | Location | Purpose | Status |
|---|---|---|---|
| `loyalty_profiles` | schema-loyalty.ts:71 | Core: tier, points, xp, level, washes, streaks | **CANONICAL** |
| `points_transactions` | schema-loyalty.ts:123 | Immutable points ledger | **CANONICAL** |
| `badges` | schema-loyalty.ts:153 | Badge definitions | **CANONICAL** |
| `user_badges` | schema-loyalty.ts:191 | User badge unlocks | **CANONICAL** |
| `daily_challenges` | schema-loyalty.ts:216 | Challenge definitions | **CANONICAL** |
| `user_challenges` | schema-loyalty.ts:255 | User challenge progress | **CANONICAL** |
| `rewards_marketplace` | schema-loyalty.ts:283 | Rewards catalog | **CANONICAL** |
| `user_redemptions` | schema-loyalty.ts:333 | Reward redemptions | **CANONICAL** |
| `referrals` | schema-loyalty.ts:368 | Referral tracking | **CANONICAL** |
| `loyaltyLedger` | schema.ts:13197 | Admin-managed transaction log | **CANONICAL** |
| `loyaltyRules` | schema.ts | Rules engine for auto-rewards | **CANONICAL** |
| `winbackQueue` | schema.ts | Winback campaign queue | **CANONICAL** |
| `privilege_members` | privilege-loyalty.ts:41 (dynamic) | Prestige membership | **CANONICAL** |
| `petwashPassAccounts` | schema.ts:12880 | Wallet pass accounts | **CANONICAL** |
| `petwashPassTransactions` | schema.ts:12926 | Pass transaction log | **CANONICAL** |

---

## Frontend Pages

| Page | File | API Consumed | Status |
|---|---|---|---|
| Loyalty Dashboard | pages/Loyalty.tsx | `/api/loyalty/*` | ✓ WIRED |
| Prestige Club (marketing) | pages/PrestigeClub.tsx | Static content | ✓ INFORMATIONAL |
| Prestige Join Form | pages/PrivilegeSignup.tsx | `POST /api/prestige/join` | ✓ CANONICAL |
| Prestige Pass Wallet | pages/PrestigePassWallet.tsx | `/api/prestige-pass/*` | ✓ WIRED |
| Wallet Download | pages/WalletDownload.tsx:95 | Links to `/loyalty/dashboard` | ✓ CORRECT |
| Subscriptions | pages/Subscriptions.tsx | `POST /api/subscriptions` | ✓ SEPARATE (box subscription, not loyalty) |

---

## Pricing Truth

**Prestige enrollment is FREE.** No credit card required. Source: PrivilegeSignup.tsx:330

There is no "wrong price" bug. Tiers are differentiated by free washes, not by membership cost.

---

## Google Auth Truth

**Single Google auth flow.** Source: PrivilegeSignup.tsx:117 → `/signin?redirect=/privilege&authMethod=google`

`OAuthConsentDialog` (components/OAuthConsentDialog.tsx:35-51) handles consent scopes. No conflicting consent popups found.

---

## Known Clean Points

- ✓ No loyalty route routes into provider onboarding
- ✓ `/join/*` pages (JoinAsSitter, JoinAsWalker, JoinAsTrainer) are provider flows — NOT loyalty
- ✓ Provider CTAs do not route into loyalty flows
- ✓ Atomic `prestige-join.ts` prevents partial enrollment across 3 systems
- ✓ `/api/vito` alias correctly maintained for backward compatibility

---

## Cleanup Recommendations (Separate PR, After Telemetry)

1. Remove dead components: `LoyaltyWelcomeModal.tsx`, `VIPLoyaltyPopup.tsx`, `TierUpgradeModal.tsx` (see POPUP_CONSENT_MAP.md)
2. Consider if `/api/privilege/register` (admin path) should require auth — currently open
3. Monitor `winbackQueue` to confirm winback campaigns are firing as expected
