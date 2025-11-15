# 🔑 API Credentials Setup Guide
## Pet Wash™ Enterprise Platform - Production Deployment Checklist

This guide provides step-by-step instructions for obtaining and configuring all required API credentials for the Pet Wash™ platform.

---

## 📋 **Quick Overview - Required API Keys**

| Service | Environment Variables | Status | Priority |
|---------|----------------------|--------|----------|
| **Nayax Payments** | `NAYAX_API_KEY`, `NAYAX_MERCHANT_ID`, `NAYAX_SECRET_KEY` | ❌ Required | 🔴 **CRITICAL** |
| **DocuSeal E-Signature** | `DOCUSEAL_API_KEY`, `DOCUSEAL_BASE_URL` | ❌ Required | 🟠 **HIGH** |
| **Israeli Tax Authority** | `ITA_CLIENT_ID`, `ITA_CLIENT_SECRET` | ❌ Required | 🟠 **HIGH** |
| **Meta WhatsApp** | `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` | ❌ Required | 🟡 **MEDIUM** |
| **Firebase** | `FIREBASE_SERVICE_ACCOUNT_KEY` | ✅ Configured | ✅ Active |
| **Google Cloud Services** | Service Account via Firebase | ✅ Configured | ✅ Active |

---

## 🔴 **CRITICAL: Nayax Payment Gateway**

**Status**: Platform's exclusive payment processor (mandatory)  
**Impact**: Without Nayax keys, NO payments can be processed

### **Step 1: Contact Nayax Israel**
1. Visit: https://www.nayax.com/contact/
2. Contact Nayax Israel office: +972-9-958-9000
3. Request: **API Integration for Pet Wash Ltd**
4. Mention: Enterprise IoT K9000 station integration

### **Step 2: Merchant Onboarding**
Nayax will provide:
- Merchant Dashboard credentials
- Merchant ID
- API documentation portal access

### **Step 3: Generate API Keys**
1. Log in to Nayax Merchant Dashboard
2. Navigate to: **Settings → API Credentials**
3. Generate new API key (select "Production" environment)
4. Note these values:
   - `NAYAX_API_KEY`: Your API key
   - `NAYAX_MERCHANT_ID`: Your merchant ID
   - `NAYAX_SECRET_KEY`: Webhook signing secret

### **Step 4: Configure Webhooks**
Set up webhook endpoint in Nayax dashboard:
- **Webhook URL**: `https://petwash.co.il/api/webhooks/nayax`
- **Events to subscribe**: 
  - `payment.completed`
  - `payment.failed`
  - `payment.refunded`
  - `transaction.authorized`

### **Step 5: Add to Replit Secrets**
```bash
# Add these secrets via Replit Secrets panel or environment:
NAYAX_API_KEY=your_production_api_key_here
NAYAX_MERCHANT_ID=your_merchant_id_here
NAYAX_SECRET_KEY=your_webhook_secret_here
```

### **Step 6: Test Payment Flow**
```bash
# Restart the application after adding secrets
# Test with small transaction (₪5-10):
curl -X POST https://petwash.co.il/api/payments/nayax/create \
  -H "Content-Type: application/json" \
  -d '{"amount": "5.00", "currency": "ILS", "description": "Test wash"}'
```

---

## 🟠 **HIGH PRIORITY: DocuSeal E-Signature**

**Status**: E-signature platform for contracts, HR documents, compliance  
**Impact**: Cannot send contracts, employee onboarding blocked, compliance forms unavailable

### **Option A: DocuSeal Cloud (Recommended)**

#### **Step 1: Sign Up**
1. Visit: https://www.docuseal.com
2. Create account (Business plan recommended)
3. Verify email and complete onboarding

#### **Step 2: Generate API Key**
1. Log in to DocuSeal dashboard
2. Navigate to: **Settings → API Keys**
3. Click "Create New API Key"
4. Name: "Pet Wash Production"
5. Copy the API key (shown once only!)

#### **Step 3: Configure Environment**
```bash
DOCUSEAL_API_KEY=your_api_key_here
DOCUSEAL_BASE_URL=https://api.docuseal.com
```

### **Option B: Self-Hosted DocuSeal (Advanced)**

#### **Step 1: Deploy DocuSeal**
```bash
# Docker deployment (recommended):
docker run -d \
  -p 3000:3000 \
  -v docuseal_data:/data \
  --name docuseal \
  docuseal/docuseal:latest
```

#### **Step 2: Configure**
```bash
# Your self-hosted instance URL:
DOCUSEAL_BASE_URL=https://docuseal.yourdomain.com
DOCUSEAL_API_KEY=your_self_hosted_api_key
```

### **Step 4: Test E-Signature**
Test document signing endpoint:
```bash
curl -X GET https://petwash.co.il/api/signatures/templates \
  -H "Authorization: Bearer <firebase_token>"
```

---

## 🟠 **HIGH PRIORITY: Israeli Tax Authority (ITA) Integration**

**Status**: Required for Israeli tax compliance, automated invoicing, VAT reporting  
**Impact**: Cannot generate tax invoices, VAT reclaim blocked, tax compliance manual

### **Step 1: Register with Israeli Tax Authority**
1. Visit: https://taxes.gov.il
2. Navigate to: **שירותי מס → רישום מערכת חיצונית** (Tax Services → External System Registration)
3. Business registration number: Your Israeli business ID (מספר עוסק)
4. Complete API access request form

### **Step 2: API Application Process**
- **Timeline**: 2-4 weeks for approval
- **Requirements**:
  - Valid Israeli business license (עוסק מורשה)
  - Tax compliance certificate (אישור ניכויים)
  - Software developer details
  - Security compliance documentation

### **Step 3: Receive Credentials**
After approval, ITA will provide:
- `CLIENT_ID`: OAuth client ID
- `CLIENT_SECRET`: OAuth client secret
- API documentation portal access

### **Step 4: Configure Environment**
```bash
ITA_CLIENT_ID=your_client_id_here
ITA_CLIENT_SECRET=your_client_secret_here
```

### **Step 5: Test Tax Invoice Generation**
```bash
curl -X POST https://petwash.co.il/api/enterprise/tax/invoice \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test123",
    "amount": "100.00",
    "description": "K9000 wash package"
  }'
```

### **Alternative: Manual Tax Compliance (Temporary)**
While waiting for ITA API approval:
1. Use existing expense management system (`/api/accounting`)
2. Generate invoices manually via Israeli accounting software
3. Upload to document management system (`/api/documents`)
4. Track VAT manually in `tax_rate_history` table

---

## 🟡 **MEDIUM PRIORITY: Meta WhatsApp Business API**

**Status**: Required for supervisor notifications, customer communications  
**Impact**: Email fallback active, but WhatsApp preferred for Israeli market

### **Step 1: Meta Business Account**
1. Visit: https://business.facebook.com
2. Create Meta Business Account (if not exists)
3. Add your business details

### **Step 2: WhatsApp Business API Setup**
1. Navigate to: **Business Settings → WhatsApp Accounts**
2. Click "Add WhatsApp Account"
3. Complete WhatsApp Business verification:
   - Business name: Pet Wash Ltd
   - Phone number: Your business WhatsApp number
   - Business category: Pet Services

### **Step 3: Apply for API Access**
1. Go to: https://developers.facebook.com/apps
2. Create new app → "Business" type
3. Add "WhatsApp" product
4. Complete verification process (1-3 business days)

### **Step 4: Generate Access Token**
1. In Facebook Developers dashboard
2. Navigate to: **WhatsApp → API Setup**
3. Generate permanent access token:
   - Select appropriate permissions
   - Note your Phone Number ID
   - Generate and save token

### **Step 5: Configure Environment**
```bash
META_WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

### **Step 6: Webhook Setup**
Configure WhatsApp webhook:
- **Webhook URL**: `https://petwash.co.il/api/webhooks/whatsapp`
- **Verify Token**: (create a random secure string)
- **Subscribed Fields**:
  - `messages`
  - `message_status`

### **Step 7: Test Notification**
```bash
# Test expense approval notification:
curl -X POST https://petwash.co.il/api/accounting/expenses/employee-submit \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "meals",
    "totalAmount": "50.00",
    "description": "Team lunch"
  }'
# Should trigger WhatsApp notification to supervisor
```

---

## ✅ **Already Configured Services**

### **Firebase Authentication & Services**
- ✅ Firebase Admin SDK initialized
- ✅ Firestore database active
- ✅ Cloud Storage configured
- ✅ Authentication enabled

### **Google Cloud Services**
- ✅ Google Vision API (OCR for receipts & passports)
- ✅ Google Gemini AI (chatbot, content moderation)
- ✅ Google Maps API (geolocation, places)
- ✅ Google Calendar API
- ✅ Google Sheets API
- ✅ Gmail API

All Google services use the Firebase service account credentials (`FIREBASE_SERVICE_ACCOUNT_KEY`).

---

## 🔐 **Security Best Practices**

### **Managing Secrets in Replit**
1. **Never commit secrets to Git**
2. Use Replit Secrets panel (padlock icon)
3. Access via `process.env.SECRET_NAME`
4. Rotate keys every 90 days

### **API Key Rotation Schedule**
- **Nayax**: Rotate every 90 days
- **DocuSeal**: Rotate every 90 days
- **ITA**: Rotate every 180 days (government requirement)
- **WhatsApp**: Rotate every 90 days
- **Firebase**: Rotate service account key annually

### **Testing Credentials**
Always test new credentials in **staging/development** before production:
```bash
# Test mode check:
NODE_ENV=development npm run dev
# Verify all services initialize without errors
```

---

## 📊 **Verification Checklist**

After configuring all credentials, verify:

- [ ] **Nayax Payment**: Test transaction completes successfully
- [ ] **DocuSeal**: Template list loads, document can be signed
- [ ] **ITA Tax**: Tax invoice generates with valid format
- [ ] **WhatsApp**: Test notification delivers to phone
- [ ] **No errors in logs**: Check `/tmp/logs/Start_application_*.log`

Run verification script:
```bash
curl -s https://petwash.co.il/api/health | jq
# Should show all services as "active"
```

---

## 🆘 **Support & Troubleshooting**

### **Common Issues**

**Problem**: "Nayax API key invalid"
- **Solution**: Verify key is for production environment (not sandbox)
- **Check**: Merchant account status is "Active"

**Problem**: "DocuSeal 401 Unauthorized"
- **Solution**: Regenerate API key, ensure no extra spaces
- **Check**: `DOCUSEAL_BASE_URL` matches your plan (cloud vs self-hosted)

**Problem**: "ITA OAuth failed"
- **Solution**: Verify `CLIENT_ID` and `CLIENT_SECRET` are correct
- **Check**: Business is registered with Israeli Tax Authority

**Problem**: "WhatsApp message not delivered"
- **Solution**: Verify phone number is WhatsApp Business verified
- **Check**: Access token permissions include `messages` scope

### **Contact Information**

**Nayax Support**: support@nayax.com | +972-9-958-9000  
**DocuSeal Support**: support@docuseal.com  
**ITA Support**: https://taxes.gov.il → Contact Form  
**Meta Business Support**: https://business.facebook.com/support

---

## 📅 **Deployment Timeline**

### **Immediate (Week 1)**
1. ✅ Set up Nayax account and obtain API keys
2. ✅ Configure DocuSeal (cloud or self-hosted)
3. ✅ Test payment and e-signature flows

### **Short-term (Weeks 2-3)**
4. ⏳ Apply for ITA API access (2-4 week approval)
5. ⏳ Set up WhatsApp Business API
6. ⏳ Complete all webhook configurations

### **Production Ready (Week 4)**
7. ✅ All API keys configured and tested
8. ✅ Graceful fallbacks verified
9. ✅ Monitoring and alerts active
10. ✅ Deploy to production

---

## 🎯 **Next Steps**

1. **Prioritize Nayax** - Critical for revenue
2. **Set up DocuSeal** - Needed for contracts
3. **Apply for ITA access** - Long approval time
4. **Configure WhatsApp** - Improves user experience
5. **Test everything** - Run end-to-end verification
6. **Monitor logs** - Watch for credential errors

**Once all credentials are configured, the platform will be 100% operational!** 🚀
