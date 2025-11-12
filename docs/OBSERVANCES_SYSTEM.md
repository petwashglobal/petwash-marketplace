# Pet Observances & Holidays System

## Overview
The Pet Observances system automatically celebrates pet-related holidays by sending personalized inbox messages with promotional vouchers to users. The system supports configurable observances with flexible date rules, locale-specific content, and automatic voucher generation.

## Features

### ✨ **Core Capabilities**
- **Automated Daily Evaluation**: Runs daily at 10 AM Israel time
- **Intelligent Date Matching**: Supports fixed dates and dynamic rules (e.g., "last Wednesday of April")
- **Locale-Specific Content**: Bilingual support (Hebrew/English) with regional configurations
- **Automatic Voucher Generation**: Creates unique promo codes with configurable discounts
- **Idempotent Delivery**: Prevents duplicate messages using year-based idempotency keys
- **Luxury Inbox Integration**: Messages appear in user's inbox with rich formatting

### 🎉 **Supported Observances**

#### Fixed Date Events
- **International Dog Day** (August 26) - 10% discount, 30-day validity
- **National Puppy Day** (March 23) - 10% discount, 14-day validity
- **International Cat Day** (August 8) - Informational only

#### Dynamic Date Events
- **International Guide Dog Day** (Last Wednesday of April) - 5% donation campaign, 7-day validity
- **World Veterinary Day** (Last Saturday of April) - 10% discount, 14-day validity

## System Architecture

### Data Structure

**Firestore Collection:** `observances`  
**Documents:** `en-AU`, `he-IL` (expandable to other locales)

```typescript
{
  locale: "he-IL",
  tz: "Asia/Jerusalem",
  evaluate_at: "09:00",
  currency: "ILS",
  events: [
    {
      key: "international_dog_day",
      active: true,
      titles: { en: "...", he: "..." },
      bodies: { en: "...", he: "..." },
      rule: { type: "fixed_date", month: 8, day: 26 },
      promo: {
        discount_percent: 10,
        code_template: "DOGDAY-{YYYY}-{RND6}",
        valid_days: 30
      },
      appearance: {
        icon: "Paw",
        accent: "gold",
        card_style: "luxury"
      },
      idempotency_key_template: "observance:{UID}:international_dog_day:{YYYY}"
    }
  ]
}
```

### Date Rule Types

#### 1. Fixed Date
```typescript
{
  type: "fixed_date",
  month: 8,  // August
  day: 26    // 26th
}
```
Matches: August 26th every year

#### 2. Last Weekday in Month
```typescript
{
  type: "last_weekday_in_month",
  weekday: "WEDNESDAY",  // MONDAY, TUESDAY, etc.
  month: 4               // April
}
```
Matches: Last Wednesday of April every year

### Voucher Code Templates

**Template Variables:**
- `{YYYY}` - Current year (e.g., 2025)
- `{RND6}` - Random 6-character alphanumeric string
- `{UID}` - First 6 characters of user UID (uppercase)

**Examples:**
- `DOGDAY-{YYYY}-{RND6}` → `DOGDAY-2025-A3B9X2`
- `PUPPY-{YYYY}-{RND6}` → `PUPPY-2025-K7M1P9`

## API Endpoints

### 1. Populate Observances (Setup)
```bash
POST /api/observances/populate
```
**Purpose:** Initialize observance data in Firestore  
**Response:**
```json
{
  "success": true,
  "message": "Observances data populated successfully",
  "locales": ["en-AU", "he-IL"],
  "eventsPerLocale": 5
}
```

### 2. Get Observances by Locale
```bash
GET /api/observances/:locale
```
**Example:** `GET /api/observances/he-IL`  
**Response:**
```json
{
  "success": true,
  "data": { /* ObservanceConfig */ }
}
```

### 3. Manual Trigger (Testing/Admin)
```bash
POST /api/admin/trigger-observances
```
**Purpose:** Manually trigger observance evaluation for testing  
**Response:**
```json
{
  "success": true,
  "message": "Observances processing triggered",
  "result": {
    "totalSent": 15,
    "totalErrors": 0,
    "totalSkipped": 3
  }
}
```

## Processing Flow

```
┌─────────────────────────┐
│  Daily Cron (10 AM IST) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────┐
│ Load Observance Configs     │
│ (en-AU, he-IL)              │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ Match Today's Date          │
│ Against All Rules           │
└───────────┬─────────────────┘
            │
            ▼
    ┌───────┴────────┐
    │ Matches Found? │
    └───────┬────────┘
            │ Yes
            ▼
┌─────────────────────────────┐
│ Get All Users               │
│ Filter by Locale            │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ For Each User:              │
│  - Check Idempotency        │
│  - Generate Voucher Code    │
│  - Create Voucher Document  │
│  - Send Inbox Message       │
│  - Mark as Sent             │
└─────────────────────────────┘
```

## Idempotency Strategy

**Key Format:** `{UID}_{idempotency_key_template}`  
**Example:** `abc123_observance:abc123:international_dog_day:2025`

**Firestore Collection:** `observance_tracking`

**Behavior:**
- Each user receives each observance **once per year**
- Uses idempotency key with year to allow annual recurrence
- Prevents duplicate messages even if cron runs multiple times

## Monitoring & Tracking

### Cron Job Monitoring
The observances job is tracked by the monitoring system:
- **Job Name:** "Observances Processing"
- **Schedule:** Daily at 10 AM IST
- **Metrics Tracked:** Messages sent, errors, skipped
- **Alerts:** Email/Slack on failures

### Health Endpoint
Check observances job status:
```bash
GET /api/health/monitoring
```

## Configuration

### Adding New Observances

1. **Edit Firestore Document:**
   - Collection: `observances`
   - Document: `en-AU` or `he-IL`

2. **Add Event Object:**
```json
{
  "key": "new_event_key",
  "active": true,
  "titles": { 
    "en": "Event Title", 
    "he": "כותרת האירוע" 
  },
  "bodies": {
    "en": "Event description with promotion details.",
    "he": "תיאור האירוע עם פרטי המבצע."
  },
  "rule": { 
    "type": "fixed_date", 
    "month": 12, 
    "day": 25 
  },
  "promo": {
    "discount_percent": 15,
    "code_template": "XMAS-{YYYY}-{RND6}",
    "valid_days": 7
  },
  "appearance": {
    "icon": "Gift",
    "accent": "red",
    "card_style": "luxury"
  },
  "idempotency_key_template": "observance:{UID}:new_event_key:{YYYY}"
}
```

3. **Set Active Flag:**
   - `active: true` - Event will be processed
   - `active: false` - Event will be skipped

### Adding New Locales

1. **Create New Document:**
   - Document ID: ISO locale code (e.g., `fr-FR`, `es-ES`)
   - Copy structure from existing locale

2. **Update Evaluator:**
```typescript
// server/observanceEvaluator.ts
const locales = ['en-AU', 'he-IL', 'fr-FR']; // Add new locale
```

## Use Cases

### 1. Promotional Campaigns
**Scenario:** Offer 10% discount on International Dog Day  
**Implementation:**
- Set `discount_percent: 10`
- Configure `valid_days: 30` for month-long campaign
- Auto-generate unique voucher codes

### 2. Donation Campaigns
**Scenario:** Donate 5% of sales on Guide Dog Day  
**Implementation:**
- Set `donation_percent: 5`
- Include donation info in message body
- Track via `campaignId` in voucher metadata

### 3. Informational Messages
**Scenario:** Celebrate Cat Day without promotion  
**Implementation:**
- Set `discount_percent: 0`
- Set `informational_only: true`
- Send awareness message to inbox

## Troubleshooting

### Issue: Messages Not Sending

**Check:**
1. Observance data exists in Firestore (`/observances/{locale}`)
2. Event is set to `active: true`
3. Date rule matches today's date
4. Users have matching locale in profile
5. Check logs for errors: `grep -i "observance" /tmp/logs/Start_application_*.log`

**Manual Test:**
```bash
curl -X POST http://localhost:5000/api/admin/trigger-observances
```

### Issue: Duplicate Messages

**Solution:**
- Idempotency should prevent this
- Check `observance_tracking` collection for existing records
- Verify idempotency key template is unique per event/user/year

### Issue: Wrong Locale

**Check:**
1. User's `language` field in profile (`en` or `he`)
2. Locale prefix matches config (e.g., `en` from `en-AU`)
3. Observance config exists for that locale

## Performance Considerations

- **Firestore Reads:** ~1 read per user per matching observance
- **Firestore Writes:** ~3 writes per user per matching observance
  - 1 for inbox message
  - 1 for voucher document
  - 1 for idempotency tracking
  
- **Optimization:** Batch operations for large user bases
- **Monitoring:** Spike detection alerts if >500 Firestore operations

## Future Enhancements (v2+)

1. **User Preferences:** Allow users to opt-in/out of observance messages
2. **Pet-Specific Events:** Trigger based on pet's breed or species
3. **Regional Observances:** Support country-specific holidays
4. **Dynamic Discounts:** Calculate discounts based on loyalty tier
5. **A/B Testing:** Test different message variations
6. **Analytics Dashboard:** Track observance engagement rates

---

**Last Updated:** October 13, 2025  
**Version:** 1.0  
**Maintained by:** Pet Wash Development Team
