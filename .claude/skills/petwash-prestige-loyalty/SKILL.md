---
name: petwash-prestige-loyalty
description: Design or review PetWash Prestige customer loyalty — member signup, pet profiles, wallet, eGift, rewards, referrals, and consent-safe marketing. Use before changing member onboarding, wallet/reward/eGift balances, tier logic, or loyalty Tower Control actions. Never change a balance without verified payment or an audited admin adjustment; never invent discount or reward rules.
---

# PetWash Prestige Loyalty Skill

Prestige is a **customer loyalty workflow** — light onboarding, wallet, pet profile, rewards. It is completely **separate** from provider onboarding (see `petwash-provider-onboarding`): separate status, permissions, and Tower Control tab. A member abusing rewards is not auto-banned as a provider; a suspended provider keeps their member/loyalty account.

## 0. What already exists — extend, don't rebuild
- **Loyalty engine + tier ladder:** `server/services/loyalty.ts` — the 7-tier ladder (Member → … → Black Reserve, #1177). Do NOT invent new tiers; launch stays simple (Prestige Member; Plus / Founder-Council later).
- **Wallet is ledger-is-truth:** `WalletService` / `WalletLedger` — append-only double-entry, `SELECT FOR UPDATE`, atomic floor guard, hash chain, layered idempotency (real unique keys). eGift via `giftOrchestrationService`; the pay-first webhook-mint rail (gift-cards) is the safe path.
- **Fiscal:** wallet top-up / eGift purchase = stored value → SUMIT `Receipt`, **no VAT at purchase** (tax at redemption). Already wired (per-class mapping + verified doc #30000). Don't re-derive.

## 1. The hard rules (never violate)
1. **No wallet/reward/eGift balance change without either (a) a verified payment (SUMIT/webhook success + idempotency) or (b) an audited admin adjustment.** Never on a frontend success screen. This matches the wallet rules already in the repo.
2. **Every balance movement is audit-logged** with its source (`purchase | admin_adjustment | loyalty | refund | referral`), source id, and who/when. Money events are never deleted — void/reverse only.
3. **No duplicate signup/referral reward.** Guard on card / device / phone / household. eGift issued exactly once; QR redemption only via backend authorization (signed rotating token, anti-replay).
4. **Never invent discount or reward rules.** The wash is **₪55 (VAT-incl)**; discounts are K9000-only, capped ~10% (member 5%, Black 15%). No secret/personalized pricing without management + legal sign-off. Public copy passes `petwash-marketing-legal`.
5. **Consent is stored separately.** Marketing consent (§30א) is its own record — a member existing ≠ consent to market. Terms/privacy acceptance persisted with version + timestamp + source, not a visual tick.

## 2. Member onboarding (light — single door)
Signup is one door (choose-role gate is dead): first/last name, mobile, email, DOB (18+), city, language, optional pet profile (encouraged not forced), terms + separate marketing consent. Writes the backend member record + HubSpot contact (`prestige_member_pending`) + audit log; hands off to payment only if the membership actually requires it; never quotes a price not on the live sheet; gated by `ff.maya.prestige_signup.enabled`. Pet profile (name/type/size/DOB) feeds birthday rewards + Pet Passport.

## 3. Rewards (simple, fair, transparent)
Wash credits · eGift balance · birthday pet reward · municipal-discount eligibility · referral reward · repeat-wash / booking / shop reward · Paw Finder member feature. Keep points/eligibility rules **clear and published** — personalization of offers is fine, personalization of *price* is not (without sign-off).

## 4. Reward-abuse checks (Tower Control → Prestige Loyalty)
same card → many accounts · same phone/device → repeated signup bonus · fake referral loops · eGift self-abuse · refund-after-reward-redemption · wallet credit mismatch. AI flags → human resolves; never auto-punish.

## Definition of done
No balance change without verified payment or audited admin adjustment · every movement audit-logged with source · no duplicate reward · QR/eGift redemption backend-authorized · no invented discount/pricing · consent stored separately · member flow kept separate from provider onboarding.
