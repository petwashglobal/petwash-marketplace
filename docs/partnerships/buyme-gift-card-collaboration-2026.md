# BuyMe.co.il (and similar) Gift-Card Collaboration — Plan 2026

CEO goal: let Israeli gift-card marketplaces (BuyMe, and later others) **sell PetWash
gift cards for us and take a cut** — extra distribution with zero ad spend.

## The model (how it works)
1. **BuyMe lists "PetWash Gift Card"** on their marketplace.
2. A buyer purchases on BuyMe → BuyMe **calls our API** to issue a PetWash e-voucher
   (maps to wallet credit). The recipient redeems it on PetWash like any e-gift.
3. **BuyMe keeps a commission** (industry norm ~15–25%); we get the rest, net, on a
   monthly settlement.

## Integration (small, reuses what exists)
- We already have the e-voucher engine (`e_vouchers` + `/api/gift-cards/*`, guest
  checkout, masked codes, redemption). [[fake-data-sweep-2026-06]] / [[payments-upay-sumit-direction]].
- Add a **partner-issue endpoint**: `POST /api/partners/vouchers/issue` (API-key auth per
  partner) → creates an `e_voucher` with `source='buyme'`, returns the redeem code/link.
- Add a **partner reconciliation report** (monthly: issued, redeemed, outstanding, our net).
- Webhook back to BuyMe on redemption if they want real-time status (optional).

## The economics — does it still profit? (the rover.com question)
Worked example, ₪100 gift card, BuyMe cut 20%:
- BuyMe collects ₪100 from the buyer, remits us **₪80** (keeps ₪20 + their own VAT handling).
- Recipient redeems ₪100 of PetWash services. Our cost to deliver ₪100 of service +
  platform margin still applies. **Profit only works if (our margin on ₪100 of service)
  > (the ₪20 BuyMe cut).**
- On **own-network washes / shop** (high margin) → comfortably profitable.
- On **marketplace services** (we only earn ~15% commission = ₪15 on ₪100) → a 20% BuyMe
  cut would be **loss-making**. So: restrict BuyMe-sourced cards to **wash + shop**
  redemption (high margin), OR negotiate BuyMe's cut **below our blended margin**.

**Rule (CEO's "always profit"):** never let `partner_cut% > blended_margin%` on the
services a partner card can redeem. Encode this as a guardrail before going live.

## VAT (Israel 2026)
- The gift card itself stays **face value, VAT at redemption** (multi-purpose voucher) —
  same as our own e-gift. BuyMe selling it doesn't change that.
- **BuyMe's commission** is a service they invoice US for (with VAT) — we reclaim that
  input VAT. Their cut is a marketing/commission expense, not a change to the card's VAT.

## Rollout
1. NDA + commercial terms (cut %, settlement cadence, redemption scope) — CEO/legal.
2. Build partner-issue endpoint + reconciliation (small).
3. Pilot with a capped batch; watch the margin guardrail.
4. Expand to other resellers once the partner API is proven.

Status: **plan only** — build starts on CEO's go + a BuyMe commercial contact.
