# Provider Invite Codes - Setup Instructions

## Current Status
The provider onboarding system requires invite codes for sign-up. Due to database migration requirements, the automated script needs manual database setup.

## Option 1: Create Invite Codes via Admin API (Recommended)

Use the admin API endpoint with proper authentication:

```bash
curl -X POST http://localhost:5000/api/provider-onboarding/admin/invite-codes/generate \
  -H "Authorization: Bearer YOUR_ADMIN_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "sitter",
    "maxUses": 100,
    "expiresAt": null,
    "campaignName": "Test - Sitter Suite",
    "notes": "Development testing"
  }'
```

Provider types: `sitter`, `walker`, `station_operator`

## Option 2: Manual SQL Insert

Run this SQL directly in the Postgres database:

```sql
INSERT INTO provider_invite_codes (
  invite_code,
  provider_type,
  created_by_admin_id,
  max_uses,
  current_uses,
  expires_at,
  campaign_name,
  notes,
  is_active,
  created_at,
  updated_at
) VALUES (
  'SITTER-TEST2025',
  'sitter',
  'system',
  100,
  0,
  NULL,
  'Test - Sitter Suite',
  'Development testing',
  TRUE,
  NOW(),
  NOW()
);
```

## Option 3: Run Database Migrations

If database schema isn't set up yet:

```bash
npm run db:push
```

Then run the invite code generator:

```bash
npx tsx server/scripts/generateInviteCodes.ts
```

## Testing the Onboarding Flow

1. Visit `/provider-onboarding?type=sitter`
2. Enter invite code (e.g., `SITTER-TEST2025`)
3. Complete the registration form
4. Upload required documents (selfie, government ID)
5. Submit application

Note: Applications go to "pending" status and require admin approval via:
```
POST /api/provider-onboarding/admin/applications/approve
```

## Admin Email
Only admin account (nirhadad1@gmail.com) can approve applications and generate invite codes.
