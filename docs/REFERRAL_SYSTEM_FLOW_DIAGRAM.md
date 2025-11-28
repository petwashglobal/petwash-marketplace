# PetWash™ Referral System - Developer Flow Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PETWASH REFERRAL SYSTEM 2025                          │
│                                                                              │
│  ₪25 Credit per successful referral (both sides)                            │
│  4 Levels: Bronze → Silver (5) → Gold (10) → Diamond (25)                   │
│  Anti-fraud: Daily ₪200 cap, Lifetime ₪1,000 cap                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Main Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  REFERRER (Existing User)              REFEREE (New User)                    │
│  ═══════════════════════              ═════════════════════                  │
│                                                                              │
│  ┌─────────────────┐                                                         │
│  │ 1. GET /api/    │                                                         │
│  │    referral/link│                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ Generate Code   │  Code: "ABC12XYZ"                                       │
│  │ (if not exists) │  Link: petwash.co.il/ref?code=ABC12XYZ                  │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐         Share Link          ┌─────────────────┐         │
│  │ Share via       │ ─────────────────────────▶  │ User clicks     │         │
│  │ WhatsApp/SMS/   │                             │ referral link   │         │
│  │ Email/Copy      │                             └────────┬────────┘         │
│  └─────────────────┘                                      │                  │
│                                                           ▼                  │
│                                              ┌─────────────────┐             │
│                                              │ 2. POST /api/   │             │
│                                              │ referral/       │             │
│                                              │ register-click  │             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ Create Referral │             │
│                                              │ status:         │             │
│                                              │ PENDING_SIGNUP  │             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ User Signs Up   │             │
│                                              │ (Firebase Auth) │             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ 3. POST /api/   │             │
│                                              │ referral/       │             │
│                                              │ link-signup     │             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ Update Referral │             │
│                                              │ status:         │             │
│                                              │ WAITING_FIRST_  │             │
│                                              │ PAYMENT         │             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ User Makes      │             │
│                                              │ First Payment   │             │
│                                              │ (₪20+ via Nayax)│             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ 4. POST /api/   │             │
│                                              │ payments/       │             │
│                                              │ webhook         │             │
│                                              │ (from Nayax)    │             │
│                                              └────────┬────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│  ┌─────────────────┐                         ┌─────────────────┐             │
│  │ +₪25 Credit     │ ◀─────────────────────  │ Update Referral │             │
│  │ Referrer        │                         │ status:         │             │
│  │ Balance Updated │                         │ COMPLETED       │ ──────────▶ │
│  └─────────────────┘                         └─────────────────┘             │
│                                                       │                      │
│                                                       ▼                      │
│                                              ┌─────────────────┐             │
│                                              │ +₪25 Credit     │             │
│                                              │ Referee         │             │
│                                              │ Balance Updated │             │
│                                              └─────────────────┘             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Firestore Collections Schema

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  FIRESTORE DATA MODEL                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  users/{userId}                                                              │
│  ├── id: string                                                              │
│  ├── email: string                                                           │
│  ├── phone: string                                                           │
│  ├── displayName: string                                                     │
│  ├── referralCode: string (unique, 8 chars)                                  │
│  ├── creditsBalanceILS: number                                               │
│  └── referralStats: {                                                        │
│        totalInvites: number                                                  │
│        successfulInvites: number                                             │
│        pendingInvites: number                                                │
│        totalCreditsGrantedILS: number                                        │
│        lastCreditAt: timestamp                                               │
│        levelId: "BRONZE" | "SILVER" | "GOLD" | "DIAMOND"                     │
│      }                                                                       │
│                                                                              │
│  referrals/{referralId}                                                      │
│  ├── id: string                                                              │
│  ├── fromUserId: string (referrer)                                           │
│  ├── fromReferralCode: string                                                │
│  ├── toUserId: string (referee)                                              │
│  ├── toEmail: string                                                         │
│  ├── toPhone: string                                                         │
│  ├── status: "PENDING_SIGNUP" | "SIGNED_UP" | "WAITING_FIRST_PAYMENT"        │
│  │           | "COMPLETED" | "REJECTED"                                      │
│  ├── createdAt: timestamp                                                    │
│  ├── signedUpAt: timestamp                                                   │
│  ├── firstPaymentAt: timestamp                                               │
│  ├── firstPaymentTransactionId: string                                       │
│  ├── firstPaymentAmountILS: number                                           │
│  ├── creditsGrantedAt: timestamp                                             │
│  ├── referrerCreditILS: number (25)                                          │
│  ├── refereeCreditILS: number (25)                                           │
│  └── reasonRejected: string                                                  │
│                                                                              │
│  referralCredits/{creditId}                                                  │
│  ├── id: string                                                              │
│  ├── userId: string                                                          │
│  ├── referralId: string                                                      │
│  ├── amountILS: number                                                       │
│  ├── source: "REFERRAL_REFERRER" | "REFERRAL_REFEREE"                        │
│  └── createdAt: timestamp                                                    │
│                                                                              │
│  transactions/{transactionId}                                                │
│  ├── id: string                                                              │
│  ├── userId: string                                                          │
│  ├── amountILS: number                                                       │
│  ├── source: "NAYAX" | "APP" | "WEB"                                         │
│  ├── createdAt: timestamp                                                    │
│  └── rawPayload: object                                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Level Progression System

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  REFERRAL LEVELS                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  🥉 BRONZE (0 referrals)                                                     │
│     │                                                                        │
│     │  +5 successful referrals                                               │
│     ▼                                                                        │
│  🥈 SILVER (5+ referrals)                                                    │
│     │                                                                        │
│     │  +5 successful referrals                                               │
│     ▼                                                                        │
│  🥇 GOLD (10+ referrals)                                                     │
│     │                                                                        │
│     │  +15 successful referrals                                              │
│     ▼                                                                        │
│  💎 DIAMOND (25+ referrals)                                                  │
│     │                                                                        │
│     └── Maximum level reached!                                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Anti-Fraud Protections

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ANTI-FRAUD MEASURES                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. SELF-REFERRAL BLOCK                                                      │
│     ├── Same email/phone check                                               │
│     ├── Same userId check                                                    │
│     └── Device fingerprint check                                             │
│                                                                              │
│  2. CREDIT LIMITS                                                            │
│     ├── Daily cap: ₪200/day                                                  │
│     ├── Lifetime cap: ₪1,000 total                                           │
│     └── Per-referral: ₪25 fixed                                              │
│                                                                              │
│  3. PAYMENT VALIDATION                                                       │
│     ├── Minimum payment: ₪20                                                 │
│     ├── Must be real Nayax transaction                                       │
│     └── Idempotent webhook (no double credits)                               │
│                                                                              │
│  4. RATE LIMITING                                                            │
│     ├── Click registration: 10/hour per IP                                   │
│     ├── Invite sending: 50/day per user                                      │
│     └── API calls: standard rate limits                                      │
│                                                                              │
│  5. FRAUD SIGNALS (logged for review)                                        │
│     ├── Multiple signups from same IP                                        │
│     ├── Suspicious device patterns                                           │
│     ├── Rapid successive payments                                            │
│     └── Geographic anomalies                                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  API ENDPOINTS                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC ENDPOINTS                                                            │
│  ───────────────                                                             │
│  POST /api/referral/register-click                                           │
│       Body: { referralCode, toEmail?, toPhone?, deviceId? }                  │
│       → Creates PENDING_SIGNUP referral                                      │
│                                                                              │
│  AUTHENTICATED ENDPOINTS (requires x-user-id header)                         │
│  ─────────────────────────────────────────────────────                       │
│  GET  /api/referral/link                                                     │
│       → Returns { referralCode, referralLink, stats }                        │
│                                                                              │
│  POST /api/referral/link-signup                                              │
│       Body: { referralCode, newUserId }                                      │
│       → Links signup to referral, status → WAITING_FIRST_PAYMENT             │
│                                                                              │
│  WEBHOOK ENDPOINTS                                                           │
│  ─────────────────                                                           │
│  POST /api/payments/webhook                                                  │
│       Body: { transactionId, userId, amountILS, source }                     │
│       → Completes referral, grants credits to both sides                     │
│                                                                              │
│  ADMIN ENDPOINTS (requires x-admin-secret header)                            │
│  ────────────────────────────────────────────────                            │
│  GET  /api/referral/admin/overview                                           │
│       → Returns { totalRefs, completed, pending, rejected, totalCreditsILS } │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  INTEGRATION WITH OTHER PETWASH SYSTEMS                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                     │
│  │   Firebase  │     │   Nayax     │     │   Loyalty   │                     │
│  │    Auth     │────▶│  Payments   │────▶│   System    │                     │
│  └─────────────┘     └─────────────┘     └─────────────┘                     │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌─────────────────────────────────────────────────────┐                     │
│  │              REFERRAL SYSTEM                        │                     │
│  │  • User registration triggers                       │                     │
│  │  • Payment webhook triggers credit                  │                     │
│  │  • Credits integrate with loyalty balance           │                     │
│  └─────────────────────────────────────────────────────┘                     │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                     │
│  │  SendGrid   │     │   WhatsApp  │     │   Apple/    │                     │
│  │   Email     │     │   Business  │     │   Google    │                     │
│  │             │     │   API       │     │   Wallet    │                     │
│  └─────────────┘     └─────────────┘     └─────────────┘                     │
│                                                                              │
│  NOTIFICATIONS TRIGGERED:                                                    │
│  • Referral link shared → (optional) notification to referrer                │
│  • Referee signs up → Email/push to referrer "Someone used your code!"       │
│  • First payment made → Email/push to both "₪25 credit added!"               │
│  • Level up → Email/push to referrer "Congratulations on Gold!"              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Checklist

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT CHECKLIST                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  □ 1. Deploy Firestore security rules                                        │
│  □ 2. Create Firestore indexes:                                              │
│       - referrals: (fromUserId, status, createdAt DESC)                      │
│       - referrals: (toUserId, status, createdAt ASC)                         │
│       - referralCredits: (userId, createdAt DESC)                            │
│  □ 3. Set environment variables:                                             │
│       - PETWASH_ADMIN_SECRET                                                 │
│       - REFERRAL_BASE_URL                                                    │
│  □ 4. Configure Nayax webhook to call /api/payments/webhook                  │
│  □ 5. Add referral route to App.tsx                                          │
│  □ 6. Test full flow: click → signup → payment → credits                     │
│  □ 7. Enable notifications for referral events                               │
│  □ 8. Set up admin dashboard monitoring                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

**File:** `docs/REFERRAL_SYSTEM_FLOW_DIAGRAM.md`  
**Version:** 2025.1  
**Last Updated:** November 2025
