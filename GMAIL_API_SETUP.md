# Gmail API Enhanced Email Integration Setup Guide

## 🔐 Security-First Gmail OAuth Integration

Pet Wash™ uses **banking-grade AES-256-GCM encryption** to protect Gmail OAuth tokens, ensuring customer email data remains secure.

---

## ✅ Current Status

**Credentials Configured:**
- ✅ `GMAIL_CLIENT_ID` - Google Cloud OAuth 2.0 Client ID
- ✅ `GMAIL_CLIENT_SECRET` - Google Cloud OAuth 2.0 Client Secret  
- ✅ `GMAIL_TOKEN_ENCRYPTION_KEY` - 256-bit AES encryption key (hex format)

**API Endpoints Ready:**
- `POST /api/gmail/connect` - Connect user's Gmail account
- `GET /api/gmail/status` - Check Gmail connection status
- `DELETE /api/gmail/disconnect` - Disconnect Gmail (GDPR-compliant)

---

## 📋 Google Cloud Console Setup

### Step 1: Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Library**
4. Search for "Gmail API"
5. Click **Enable**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Fill in application details:
   - **App name**: Pet Wash™ - Premium Pet Care Platform
   - **User support email**: Your support email
   - **App logo**: Upload Pet Wash™ logo
   - **Application home page**: `https://www.petwash.co.il`
   - **Privacy policy**: `https://www.petwash.co.il/privacy-policy`
   - **Terms of service**: `https://www.petwash.co.il/terms`
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.modify`
5. Add test users (during development)

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Select **Web application**
4. Configure:
   - **Name**: Pet Wash Gmail Integration
   - **Authorized JavaScript origins**:
     - `http://localhost:5000` (development)
     - `https://www.petwash.co.il` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/gmail/callback` (development)
     - `https://www.petwash.co.il/api/gmail/callback` (production)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

---

## 🔑 Environment Variables

The following environment variables are already configured in Replit Secrets:

```bash
# Gmail OAuth Credentials (from Google Cloud Console)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-your-secret

# Token Encryption Key (256-bit AES key in hex format)
# Generated using: openssl rand -hex 32
GMAIL_TOKEN_ENCRYPTION_KEY=your-64-character-hex-key
```

---

## 🚀 Frontend Integration

### Gmail Connect Flow

```typescript
// Example: Connect Gmail from frontend
const connectGmail = async (accessToken: string) => {
  const response = await fetch('/api/gmail/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firebaseToken}`,
    },
    body: JSON.stringify({
      accessToken: accessToken,
      email: userEmail,
    }),
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('Gmail connected successfully!');
  }
};
```

### Check Gmail Status

```typescript
const checkGmailStatus = async () => {
  const response = await fetch('/api/gmail/status', {
    headers: {
      'Authorization': `Bearer ${firebaseToken}`,
    },
  });
  
  const data = await response.json();
  return data.connected; // true/false
};
```

### Disconnect Gmail (GDPR Compliance)

```typescript
const disconnectGmail = async () => {
  const response = await fetch('/api/gmail/disconnect', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${firebaseToken}`,
    },
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('Gmail disconnected successfully');
  }
};
```

---

## 🔒 Security Features

### 1. AES-256-GCM Encryption
All Gmail OAuth tokens are encrypted using **AES-256-GCM** before storage:
- **256-bit encryption key** (NIST-approved)
- **Unique IV** (Initialization Vector) per token
- **Authentication tag** for tamper detection

### 2. Firebase Authentication
All Gmail endpoints require valid Firebase authentication:
- Session cookie verification
- ID token verification
- Email verification checks

### 3. Email Verification
System verifies that the Gmail email matches the authenticated user's email to prevent account hijacking.

### 4. GDPR Compliance
Disconnect endpoint securely deletes all token artifacts:
- Encrypted token
- Initialization vector
- Authentication tag

---

## 📊 Gmail OAuth Scopes

The integration requests the following Gmail API scopes:

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read email messages and metadata |
| `gmail.send` | Send emails on behalf of user |
| `gmail.compose` | Create and modify draft emails |
| `gmail.modify` | Mark emails as read/unread, archive, etc. |

---

## 🧪 Testing

### Test Gmail Connection

1. Sign in to Pet Wash™ with Firebase
2. Navigate to Gmail integration settings
3. Click "Connect Gmail"
4. Authorize Gmail access in Google OAuth popup
5. Verify connection shows in `/api/gmail/status`

### Verify Encryption

```bash
# Check that tokens are encrypted in Firestore
# Tokens should appear as hex strings, not readable text
```

---

## 🎯 Use Cases

### Customer Communication
- Send booking confirmations via Gmail
- Email appointment reminders
- Share loyalty program updates

### Staff Management
- Team inbox for customer inquiries
- Automated workflow notifications
- Order status updates

### Marketing Integration
- Newsletter campaigns
- Promotional offers
- Event announcements

---

## 📝 Implementation Checklist

- [x] Gmail API enabled in Google Cloud
- [x] OAuth consent screen configured
- [x] OAuth 2.0 credentials created
- [x] Environment variables set in Replit Secrets
- [x] Encryption key generated (256-bit hex)
- [x] Backend routes implemented
- [x] Firebase authentication integrated
- [x] Token encryption enabled
- [ ] Frontend OAuth flow implemented
- [ ] User settings page for Gmail connection
- [ ] Email sending functionality
- [ ] Email reading/parsing features

---

## 🔧 Troubleshooting

### Error: "Encryption key not configured"
- Verify `GMAIL_TOKEN_ENCRYPTION_KEY` is set in Replit Secrets
- Key must be 64 hex characters (32 bytes)
- Restart the application after adding the key

### Error: "Email does not match authenticated user"
- Ensure the Gmail email matches the Firebase user's email
- Check Firebase user email verification status

### Error: "Gmail OAuth temporarily unavailable"
- Verify `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` are set
- Check Google Cloud Console for API quotas
- Verify OAuth consent screen is published

---

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [AES-GCM Encryption](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

---

**Pet Wash™ - Premium Organic Pet Care Platform**  
*Banking-Level Security • GDPR Compliant • Israeli Privacy Law 2025*
