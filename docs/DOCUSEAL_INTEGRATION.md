# DocuSeal E-Signature Integration 🎯

## Overview
Pet Wash™ uses **DocuSeal** - a FREE, open-source e-signature platform that fully supports Hebrew (עברית), Arabic, and 14 languages. This replaces paid solutions like DocuSign with zero cost.

## ✅ Why DocuSeal?

- **100% FREE** - Open source (MIT license), no subscription fees
- **Hebrew RTL Support** - Full right-to-left language support (עברית, العربية)
- **14 Languages** - EN, ES, IT, DE, FR, NL, PL, UK, CS, PT, HE, AR, KR, JA
- **Mobile-First** - Works perfectly in iOS and Android browsers
- **Self-Hosted** - Complete data control and privacy
- **USA-Based** - Leading open-source project from 2025

## 🏗️ Architecture

### Backend Service
- **File**: `server/services/DocuSealService.ts`
- **API Client**: `@docuseal/api` (official npm package)
- **Database**: `signingSessions` table tracks all document signing

### API Endpoints
- `POST /api/esign/create-session` - Create new signing session
- `GET /api/esign/session/:id` - Get session status
- `GET /api/esign/sessions` - Get user's sessions
- `POST /api/esign/webhook` - DocuSeal webhook for status updates

### Database Schema
```typescript
signingSessions {
  id: serial
  userId: varchar // Firebase UID
  submissionId: varchar // DocuSeal submission ID
  templateSlug: varchar // Document template
  documentType: varchar // 'waiver', 'agreement', 'consent'
  language: varchar // 'en', 'he', 'ar', 'es', 'fr', 'ru'
  status: varchar // 'pending', 'sent', 'opened', 'completed'
  signingUrl: varchar // Direct mobile link
  signedDocumentUrl: varchar // Completed PDF
  // ... timestamps, audit trail
}
```

---

## 📱 Mobile Integration Guide

### Option 1: Mobile Browser (Easiest)
Open the signing URL directly in a mobile browser:

```javascript
// iOS (Swift)
import SafariServices

let signingUrl = URL(string: session.signingUrl)!
let safari = SFSafariViewController(url: signingUrl)
present(safari, animated: true)
```

```kotlin
// Android (Kotlin)
val signingUrl = session.signingUrl
val intent = Intent(Intent.ACTION_VIEW, Uri.parse(signingUrl))
startActivity(intent)
```

### Option 2: WebView Embed

```javascript
// React Native WebView
import { WebView } from 'react-native-webview';

<WebView 
  source={{ uri: session.signingUrl }}
  style={{ flex: 1 }}
  onNavigationStateChange={(navState) => {
    if (navState.url.includes('completed')) {
      // Signature completed!
      navigation.goBack();
    }
  }}
/>
```

### Option 3: Embedded Form (Web App)

```html
<!-- Add DocuSeal script -->
<script src="https://cdn.docuseal.com/js/form.js"></script>

<!-- Embed signing form -->
<docuseal-form 
  data-src="https://app.docuseal.com/s/abc123"
  data-email="customer@example.com"
  data-language="he"
  style="width:100%; height:600px; border:none;">
</docuseal-form>
```

---

## 🔧 Setup Instructions

### Self-Hosted (100% Free)

1. **Deploy DocuSeal Server**
   ```bash
   # Using Docker
   docker run -d \
     -p 3000:3000 \
     -v docuseal-data:/data \
     --name docuseal \
     docuseal/docuseal
   ```

2. **Get API Key**
   - Navigate to http://localhost:3000
   - Create admin account
   - Go to Settings → API
   - Generate API key

3. **Configure Pet Wash™**
   ```env
   DOCUSEAL_API_KEY=your_api_key_here
   DOCUSEAL_BASE_URL=http://localhost:3000/api
   ```

### Cloud Hosted (Free Tier Available)

1. **Sign up at** https://www.docuseal.com
2. **Create API Key** in dashboard
3. **Configure Environment**
   ```env
   DOCUSEAL_API_KEY=your_api_key_here
   DOCUSEAL_BASE_URL=https://api.docuseal.com
   ```

---

## 📝 Creating Document Templates

### 1. Log into DocuSeal Dashboard
- Self-hosted: http://localhost:3000
- Cloud: https://app.docuseal.com

### 2. Create Template
1. Click "New Template"
2. Upload PDF or create HTML document
3. Add signature/initial fields
4. Set field positions
5. Note the **Template Slug** (e.g., `pet-wash-waiver-2025`)

### 3. Supported Field Types
- ✍️ Signature
- 📝 Initials  
- 📅 Date
- ✅ Checkbox
- 📄 Text
- 📧 Email
- 📱 Phone

---

## 💻 API Usage Examples

### Create Signing Session (Backend)

```typescript
import { docuSealService } from './services/DocuSealService';

const submission = await docuSealService.createSubmission({
  templateSlug: 'pet-wash-waiver-2025',
  signerEmail: 'customer@example.com',
  signerName: 'ישראל ישראלי',
  language: 'he', // Hebrew
  sendEmail: true,
  expiresIn: 30 // days
});

console.log('Signing URL:', submission.submitters[0].embedSrc);
```

### Frontend API Call

```typescript
const response = await fetch('/api/esign/create-session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    documentType: 'waiver',
    templateSlug: 'pet-wash-waiver-2025',
    signerEmail: user.email,
    signerName: user.displayName,
    language: 'he',
    sendEmail: true
  })
});

const { signingUrl, sessionId } = await response.json();

// Open in mobile browser or WebView
window.open(signingUrl, '_blank');
```

### Check Status

```typescript
const response = await fetch(`/api/esign/session/${sessionId}`, {
  headers: {
    'Authorization': `Bearer ${firebaseToken}`
  }
});

const { session } = await response.json();

if (session.status === 'completed') {
  console.log('Document signed!');
  console.log('PDF URL:', session.signedDocumentUrl);
}
```

---

## 🌍 Language Support

### Supported Languages
Pet Wash™ + DocuSeal support:

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `he` | עברית (Hebrew) | **RTL** |
| `ar` | العربية (Arabic) | **RTL** |
| `es` | Español | LTR |
| `fr` | Français | LTR |
| `ru` | Русский | LTR |
| `de` | Deutsch | LTR |
| `it` | Italiano | LTR |
| `pt` | Português | LTR |
| `nl` | Nederlands | LTR |
| `pl` | Polski | LTR |
| `cs` | Čeština | LTR |
| `kr` | 한국어 | LTR |
| `ja` | 日本語 | LTR |

### Setting Language

```javascript
// Explicit language
language: 'he'

// Auto-detect from user's browser
language: 'auto'

// Default to Hebrew for Israeli users
language: user.country === 'IL' ? 'he' : 'en'
```

---

## 🔒 Security & Compliance

### Features
- ✅ **Legally Binding** - Compliant signatures
- ✅ **Audit Trail** - Complete signing history
- ✅ **Encryption** - SSL/TLS for all transmissions
- ✅ **IP Tracking** - Records signer IP address
- ✅ **Device Fingerprinting** - Tracks signing device
- ✅ **Certificate of Completion** - Automatic generation

### Webhook Security
Configure webhook secret in DocuSeal dashboard for signature verification.

---

## 📊 Workflow Example

1. **User books Pet Wash service** → System creates signing session
2. **Email sent** → User receives email with link (in Hebrew)
3. **User opens link** → DocuSeal signing interface (RTL for Hebrew)
4. **User signs** → Signature captured on mobile device
5. **Webhook triggered** → Pet Wash™ receives completion event
6. **PDF generated** → Signed document stored
7. **Service activated** → User can now use K9000 wash station

---

## 🎯 Benefits Over DocuSign

| Feature | DocuSign | DocuSeal |
|---------|----------|----------|
| **Cost** | $20-$60/month | **FREE** |
| **Hebrew Support** | ✅ Yes | ✅ Yes |
| **Self-Hosted** | ❌ No | ✅ Yes |
| **Open Source** | ❌ No | ✅ Yes |
| **Data Privacy** | External | **Your Server** |
| **API Access** | Paid only | **FREE** |

---

## 🚀 Next Steps

1. ✅ **Install DocuSeal** (self-hosted or cloud)
2. ✅ **Create Templates** for waivers/agreements
3. ✅ **Get API Key** from dashboard
4. ✅ **Set Environment Variables** (DOCUSEAL_API_KEY, DOCUSEAL_BASE_URL)
5. ✅ **Test Integration** with sample document
6. ✅ **Deploy to Production**

---

## 📚 Resources

- **Official Docs**: https://www.docuseal.com/docs
- **API Reference**: https://www.docuseal.com/docs/api
- **GitHub**: https://github.com/docusealco/docuseal
- **Language Support**: https://www.docuseal.com/resources/languages-support
- **Demo**: https://demo.docuseal.com

---

## 🆘 Support

### Issues?
1. Check logs: `[DocuSeal]` prefix
2. Verify API key is set
3. Confirm template slug exists
4. Test with English first, then Hebrew

### Questions?
- DocuSeal GitHub Issues
- Pet Wash™ development team

---

**Built with ❤️ for Pet Wash™ - Premium Organic Pet Care**
