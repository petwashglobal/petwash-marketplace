# 🔐 Secure One-Tap Mobile Ops Login

## Overview
The one-tap mobile ops login system allows admins to generate secure, time-limited login links for field technicians and operations staff. Recipients can click the link to instantly access the mobile ops hub without entering credentials.

## Security Features
- **HMAC-SHA256 signed tokens** - Tamper-proof cryptographic signatures
- **10-minute expiry** - Short time window reduces attack surface
- **UID-only payload** - No personally identifiable information in tokens
- **Admin-only generation** - Only authenticated admins can create links
- **Firebase custom token flow** - Leverages Firebase Auth security best practices

## How It Works

### 1. Generate a Secure Login Link (Admin Only)

**Endpoint:** `POST /api/ops/one-tap/create`

**Authentication:** Requires admin authentication

**Request Body:**
```json
{
  "email": "technician@petwash.co.il",  // OR "uid": "firebase_user_id"
  "redirect": "/m"                       // Optional: default is "/m" (mobile ops hub)
}
```

**Response:**
```json
{
  "url": "https://petwash.co.il/ops/one-tap?token=eyJraW5kIjoib3BzX29uZV...",
  "ttlSec": 600
}
```

### 2. Send the Link
Copy the URL from the response and send it to the ops staff via:
- SMS (using Twilio integration)
- Email (using SendGrid)
- WhatsApp
- Any messaging platform

### 3. Technician Clicks the Link
When the recipient clicks the link:
1. Server verifies the HMAC signature and expiry
2. Server mints a Firebase custom token for the user
3. Lightweight HTML page auto-signs in with Firebase
4. Session cookie (`pw_session`) is created via `/api/auth/session`
5. User is redirected to the mobile ops hub (`/m`)

**Total time:** < 2 seconds from click to logged in

## Example Usage

### cURL Example (from admin terminal):
```bash
curl -X POST https://petwash.co.il/api/ops/one-tap/create \
  -H "Content-Type: application/json" \
  -H "Cookie: pw_session=YOUR_ADMIN_SESSION_COOKIE" \
  -d '{"email":"tech@petwash.co.il"}'
```

### JavaScript Example (from admin dashboard):
```javascript
const response = await fetch('/api/ops/one-tap/create', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'tech@petwash.co.il' })
});

const { url } = await response.json();
console.log('Send this link to the technician:', url);
```

## Use Cases

### Field Technician Onboarding
Send new technicians a one-tap link via SMS when they arrive at their first station. No need to remember passwords or deal with password resets.

### Emergency Access
Operations manager needs a technician to check a station ASAP. Generate and send a link instantly - technician is logged in within seconds.

### Shared Devices
Technicians using shared tablets at station sites. No need to log out/in repeatedly - just send a fresh link for each shift.

### Training Sessions
Training coordinator can generate links for multiple trainees and distribute via group message.

## Security Considerations

### ✅ Safe Practices
- Links expire after 10 minutes
- One link per user (not transferable to other accounts)
- Requires BASE_URL and MOBILE_LINK_SECRET environment variables
- Admin authentication required to generate links
- HTTPS enforced in production

### ⚠️ Important Notes
- **Don't share links publicly** - Each link grants instant access to a specific user account
- **Don't reuse old links** - Generate fresh links for each login session
- **Verify recipient identity** - Ensure you're sending to the correct phone/email
- **Monitor usage** - Check admin logs for suspicious link generation patterns

## Production Configuration

Required environment variables (already configured):
```
BASE_URL=https://petwash.co.il
MOBILE_LINK_SECRET=<96-character-hex-secret>
```

## Troubleshooting

### Link doesn't work
- Check if 10 minutes have passed (token expired)
- Verify BASE_URL is set correctly
- Ensure MOBILE_LINK_SECRET matches on server

### "User not found" error
- Verify the email/uid exists in Firebase Authentication
- Check for typos in the email address

### Session cookie not created
- Verify `/api/auth/session` endpoint is working
- Check browser console for errors
- Ensure cookies are enabled (especially on mobile)

## Implementation Details

**File:** `server/security/productionHardeningAndOneTap.ts`

**Token Format:** `base64url(payload).base64url(hmac_signature)`

**Payload Structure:**
```json
{
  "uid": "firebase_user_id",
  "kind": "ops_one_tap",
  "iat": 1634567890,
  "exp": 1634568490,
  "v": 1
}
```

**Auto-Login Flow:**
1. `GET /ops/one-tap?token=...`
2. Verify HMAC signature and expiry
3. Mint Firebase custom token via Admin SDK
4. Return lightweight HTML with Firebase SDK
5. `signInWithCustomToken(customToken)`
6. `POST /api/auth/session` with ID token
7. Redirect to `/m` (or custom redirect path)

---

**Questions?** Contact the development team or check the server logs for detailed debugging information.
