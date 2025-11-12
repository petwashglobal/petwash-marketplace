# Database Migration Instructions - Review System

## Manual Steps Required

The review system is complete but requires database migration to create tables.

### Step 1: Push Schema Changes
```bash
npm run db:push
```

When prompted with:
```
Is booking_consents table created or renamed from another table?
❯ + booking_consents                   create table
  ~ session › booking_consents         rename table
  ~ walk_slot_holds › booking_consents rename table
```

**Select: `+ booking_consents` (create table)**

### Step 2: Confirm All Tables
The migration will create:
- `booking_consents`
- `contractor_reviews` 
- `contractor_trust_scores`
- `review_flagging_rules`

Select **"create table"** for all review system tables.

### Step 3: Seed Flagging Rules
After migration completes:
```bash
npx tsx server/scripts/seedReviewFlaggingRules.ts
```

This loads 17 default moderation rules (abuse, profanity, safety keywords in English + Hebrew).

## Review System Status

✅ **Backend API Complete**:
- Two-sided reviews (owner↔contractor)
- Booking validation & security checks
- Auto-flagging with 17 multilingual rules
- Trust score calculation

✅ **UI Components Complete**:
- ReviewSubmitDialog (star ratings + categories)
- ReviewDisplay (verified badges + responses)
- Integrated into Sitter Suite Owner Dashboard

⏳ **Pending**:
- Database migration (see above)
- Walk My Pet dashboard integration
- PetTrek dashboard integration

## After Migration

Once tables are created, the review system will be fully operational:
1. Owners can review contractors (sitters, walkers, drivers)
2. Contractors can review owners
3. Auto-flagging monitors for inappropriate content
4. Trust scores update automatically
