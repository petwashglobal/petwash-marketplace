# 🔐 Add Twilio Secrets to Replit

## Quick Setup (2 Minutes)

### Step 1: Open Secrets Panel
1. Click the **🔒 Lock icon** in the left sidebar (Replit)
2. Or click **Tools** → **Secrets**

### Step 2: Add These 3 Secrets

Copy and paste each of these exactly:

#### Secret 1:
```
Key: TWILIO_ACCOUNT_SID
Value: <YOUR_ACCOUNT_SID_FROM_TWILIO_CONSOLE>
```
📍 Find in: Twilio Console → Account Info → Account SID

#### Secret 2:
```
Key: TWILIO_AUTH_TOKEN
Value: <YOUR_AUTH_TOKEN_FROM_TWILIO_CONSOLE>
```
📍 Find in: Twilio Console → Account Info → Auth Token (click "Show" to reveal)

#### Secret 3:
```
Key: TWILIO_PHONE_NUMBER
Value: +972549833355
```
📍 Your company's Israeli WhatsApp business number

### Step 3: Restart Application
After adding all 3 secrets, the server will automatically restart and you should see:

✅ `Twilio SMS configured successfully`

---

## What This Enables

**Phone Authentication:**
- Israeli users can sign in with +972-XX-XXX-XXXX
- 6-digit OTP codes sent via SMS
- Your company number: +972-54-983-3355

**SMS Alerts:**
- Station offline notifications
- Critical system alerts
- Appointment reminders
- VIP member notifications

**Multi-Language SMS:**
- Automatic translation to user's language
- Hebrew for Israeli customers
- English for international

---

## Test It Works

After adding secrets, test phone authentication:

1. Go to `/signin`
2. Click "Sign in with Phone"
3. Enter: +972-50-XXX-XXXX (test number)
4. You should receive SMS with 6-digit code
5. Enter code → Sign in!

---

**Ready for Friday Launch! 🚀**
