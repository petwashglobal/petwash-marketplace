# Meta WhatsApp Cloud API Setup Guide
## PetWash Ltd - Israel Support Number: +972549833355

**Last Updated**: October 31, 2025  
**Service Provider**: Meta (Facebook)  
**Integration Type**: Direct Cloud API (No Third-Party Provider)

---

## 📋 Overview

This guide will help you set up **Meta WhatsApp Cloud API** for PetWash Ltd's business messaging system. You'll connect your Israeli business number (+972549833355) to send:

- Employee expense approval notifications
- Launch event invitations
- Team announcements
- Customer support messages

---

## 🚀 Step 1: Create Meta Business Account

### 1.1 Go to Meta Business Suite
Visit: [https://business.facebook.com](https://business.facebook.com)

### 1.2 Create Business Account
1. Click **"Create Account"**
2. Enter business details:
   - **Business Name**: PetWash Ltd (חברת פטוואש בע"מ)
   - **Your Name**: Nir Hadad
   - **Business Email**: nirhadad1@gmail.com
   - **Business Address**: Israel

3. Verify your email and complete the setup

---

## 📱 Step 2: Add WhatsApp Business Account

### 2.1 Navigate to WhatsApp
1. In Meta Business Suite, go to **"Settings"** → **"WhatsApp Accounts"**
2. Click **"Add"** → **"Create a WhatsApp Business Account"**

### 2.2 Connect Your Phone Number
1. Select **"Use existing number"**
2. Enter your business number: **+972549833355**
3. Choose verification method:
   - **SMS** (recommended)
   - **Voice call**
4. Enter the 6-digit code you receive
5. Confirm ownership

### 2.3 Complete Business Profile
- **Business Name**: PetWash™
- **Category**: Pet Services / Pet Care
- **Description**: Premium Organic Pet Care Platform
- **Website**: www.petwash.co.il
- **Address**: 2 HaChoshen St, Kfar Saba, Israel

---

## 🔑 Step 3: Generate Access Token & Phone Number ID

### 3.1 Create a Meta App
1. Go to [Meta Developers Console](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Select **"Business"** as app type
4. Fill in details:
   - **App Name**: PetWash WhatsApp API
   - **Contact Email**: nirhadad1@gmail.com
   - **Business Account**: Select your PetWash business account
5. Click **"Create App"**

### 3.2 Add WhatsApp Product
1. In your app dashboard, find **"WhatsApp"** product
2. Click **"Set Up"**
3. Select your WhatsApp Business Account created earlier

### 3.3 Get Your Credentials

#### **A. Phone Number ID**
1. In WhatsApp → **"API Setup"**
2. Look for **"Phone Number ID"**
3. Copy the ID (format: `123456789012345`)

#### **B. Access Token**
1. In the same **"API Setup"** page
2. Under **"Temporary access token"**, click **"Copy"**
3. **⚠️ IMPORTANT**: This is temporary (24 hours)

#### **C. Generate Permanent Access Token** (Recommended)
1. Go to **"Settings"** → **"System Users"**
2. Click **"Add"** to create a system user:
   - **Name**: PetWash WhatsApp Service
   - **Role**: Admin
3. Click **"Generate New Token"**
4. Select your app: **PetWash WhatsApp API**
5. Select permissions:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
6. Click **"Generate Token"**
7. **🔒 COPY AND SAVE SECURELY** - You won't see it again!

---

## 🔐 Step 4: Add Credentials to Replit Secrets

### 4.1 Open Replit Secrets Manager
1. In your Replit workspace, click **"Tools"** → **"Secrets"**
2. Click **"New Secret"**

### 4.2 Add These Secrets

#### **Secret 1: Access Token**
```
Key: META_WHATSAPP_ACCESS_TOKEN
Value: EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (your permanent token from Step 3.3.C)
```

#### **Secret 2: Phone Number ID**
```
Key: META_WHATSAPP_PHONE_NUMBER_ID
Value: 123456789012345 (your Phone Number ID from Step 3.3.A)
```

#### **Secret 3: Business Phone** (Optional - already has default)
```
Key: META_WHATSAPP_BUSINESS_PHONE
Value: +972549833355
```

### 4.3 Save All Secrets
Click **"Add new secret"** for each entry, then close the panel.

---

## ✅ Step 5: Verify Integration

### 5.1 Restart Your Replit Workspace
1. Stop the current workflow
2. Start it again to load the new secrets

### 5.2 Test Message Send
You can test by calling the launch event API:

```bash
curl -X POST https://www.petwash.co.il/api/launch-event/notify \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+972549833355",
    "language": "he"
  }'
```

### 5.3 Check WhatsApp
You should receive a test message on +972549833355!

---

## 📊 Step 6: Message Template Setup (For Marketing)

### Why Templates?
Meta requires **pre-approved templates** for messages sent outside the 24-hour customer service window.

### 6.1 Create Message Template
1. Go to Meta Business Suite → **WhatsApp Manager**
2. Click **"Message Templates"**
3. Click **"Create Template"**

### 6.2 Example: Launch Event Template
```
Template Name: launch_event_invitation
Category: MARKETING
Language: Hebrew (he)

Body:
🎉 *PetWash™ - אירוע השקה חגיגי!* 🐾

שלום {{1}},

אנו נרגשים להזמין אותך לאירוע ההשקה הראשון בישראל! 🇮🇱

🏛️ *בשיתוף עיריית כפר סבא*

📍 מיקום: רח' החושן 2, כפר סבא
🗓️ תאריך: בקרוב

✨ הצטרף אלינו למהפכה בטיפול בחיות מחמד!

לפרטים: www.petwash.co.il
```

### 6.3 Submit for Approval
1. Click **"Submit"**
2. Wait 15 minutes - 24 hours for Meta review
3. Check status in **Message Templates** dashboard

---

## 💰 Pricing Information

### Meta WhatsApp Pricing (2025)

| **Message Type** | **Cost** | **Notes** |
|------------------|----------|-----------|
| **Service Messages** (within 24h window) | **FREE** | User initiated conversation |
| **Marketing Templates** | ~₪0.15 - ₪0.30 per message | Varies by country (Israel) |
| **Utility Templates** (order confirmations, etc.) | ~₪0.05 - ₪0.15 per message | Transactional messages |
| **Authentication (OTP)** | ~₪0.03 - ₪0.10 per message | One-time passwords |

**Conversation-Based Pricing:**
- Free for first 1,000 service conversations/month
- Charged per 24-hour conversation window opened

**No Monthly Fees** - Pay only for messages sent!

---

## 🛡️ Security Best Practices

### ✅ DO
- Use **permanent system user tokens** (not temporary tokens)
- Store tokens in **Replit Secrets** (never in code)
- Enable **Two-Factor Authentication** on Meta Business Account
- Monitor message delivery rates in Meta dashboard
- Set up **billing alerts** to track costs

### ❌ DON'T
- Share your access token publicly
- Commit tokens to Git/GitHub
- Use temporary tokens in production
- Send spam or unsolicited messages (violates Meta policy)

---

## 📞 Support & Troubleshooting

### Common Issues

#### **Error: "Invalid access token"**
- **Solution**: Regenerate permanent token (Step 3.3.C)
- Ensure token has `whatsapp_business_messaging` permission

#### **Error: "Phone number not registered"**
- **Solution**: Complete phone verification (Step 2.2)
- Ensure number is connected to your WhatsApp Business Account

#### **Error: "Message template not approved"**
- **Solution**: Use only approved templates for marketing messages
- For service messages, ensure within 24-hour window

#### **Messages not sending**
- Check Replit logs for error details
- Verify secrets are correctly added (Step 4)
- Ensure business account is active and not restricted

### Meta Support
- **Help Center**: [https://business.facebook.com/business/help](https://business.facebook.com/business/help)
- **WhatsApp Business API Docs**: [https://developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp)
- **Community Forum**: [https://developers.facebook.com/community](https://developers.facebook.com/community)

### PetWash Internal
- **Technical Issues**: Check server logs in Replit
- **CEO Contact**: nirhadad1@gmail.com
- **Business Phone**: +972549833355

---

## 📚 Additional Resources

- [Meta WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
- [Meta Business Help Center](https://business.facebook.com/business/help)

---

## 🎯 Next Steps

Once setup is complete, you can:

1. ✅ Send expense approval notifications to employees
2. ✅ Send launch event invitations to customers
3. ✅ Broadcast team announcements
4. ✅ Provide customer support via WhatsApp

**All messages will be sent from**: +972549833355 (PetWash Ltd Official Number)

---

**© 2025 PetWash Ltd. Internal Documentation.**  
**Confidential - Do Not Distribute**
