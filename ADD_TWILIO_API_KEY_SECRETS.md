# 🔐 Add Twilio API Key Secrets to Replit

## Secure API Key Authentication (Recommended ✅)

You created a Twilio API Key - this is **more secure** than using Auth Token because:
- ✅ API keys can be revoked without affecting your account
- ✅ You can create separate keys for different services
- ✅ Recommended by Twilio for production apps

---

## Step 1: Open Replit Secrets

1. Click the **🔒 Lock icon** in Replit's left sidebar
2. Or click **Tools** → **Secrets**

---

## Step 2: Add These 4 Secrets

Copy and paste each one exactly:

### Secret 1: Account SID
```
Key: TWILIO_ACCOUNT_SID
Value: <YOUR_TWILIO_ACCOUNT_SID>
```
📍 **Find this:** Twilio Console → Account Info → Account SID (starts with "AC...")

### Secret 2: API Key SID
```
Key: TWILIO_API_KEY
Value: <YOUR_TWILIO_API_KEY_SID>
```
📍 **Find this:** Twilio Console → API Keys & Tokens → Your API Key SID (starts with "SK...")

### Secret 3: API Secret
```
Key: TWILIO_API_SECRET
Value: <YOUR_TWILIO_API_SECRET>
```
📍 **Find this:** Shown ONLY ONCE when you create the API key - copy from creation screen

### Secret 4: Phone Number
```
Key: TWILIO_PHONE_NUMBER
Value: +972549833355
```
📍 **Your Israeli WhatsApp Business Number** (already known)

---

## Step 3: Verify It Works

After adding all 4 secrets, the server will auto-restart.

Look for this message in the logs:
✅ **`Twilio SMS configured successfully (API Key authentication)`**

---

## What This Enables

**Phone Authentication:**
- Israeli users: +972-XX-XXX-XXXX
- International users: +1-XXX-XXX-XXXX, etc.
- 6-digit OTP codes via SMS

**SMS Alerts:**
- Station offline notifications
- Critical system alerts
- Appointment reminders
- VIP notifications

**Multi-Language SMS:**
- Automatic translation (6 languages)
- Hebrew for Israeli customers
- Your business number: +972-54-983-3355

---

## Security Benefits of API Keys

✅ **Revocable** - Can be deleted without changing Auth Token  
✅ **Specific Access** - Can limit permissions per key  
✅ **Auditable** - Track which key sent which SMS  
✅ **Production Ready** - Twilio's recommended approach  

---

**Ready for Friday Launch! 🚀**

*Add these 4 secrets and you're done!*
