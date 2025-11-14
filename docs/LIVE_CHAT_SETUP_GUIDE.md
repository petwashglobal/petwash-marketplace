# 🔴 Live Chat Setup Guide - Tawk.to Integration

**Status:** ✅ Widget installed, ⚠️ Credentials needed

---

## ✅ What's Already Done

1. ✅ LiveChatWidget component created (`client/src/components/LiveChatWidget.tsx`)
2. ✅ Multi-language support (Hebrew, English, Arabic, Russian, French, Spanish)
3. ✅ Mobile responsive design
4. ✅ Auto-detects user language
5. ✅ Widget added to Layout (appears on all pages)

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Free Tawk.to Account

1. Go to https://www.tawk.to
2. Click "Sign Up Free"
3. Enter your details:
   - **Business Name:** Pet Wash™
   - **Email:** nirhadad1@gmail.com (or your email)
   - **Password:** Create strong password
4. Verify your email

### Step 2: Get Widget Credentials

1. After login, you'll see your dashboard
2. Click "Administration" in top menu
3. Click "Channels" → "Chat Widget"
4. You'll see two important codes:

```
Property ID: (6 characters, like "abc123")
Widget ID: (13 characters with dashes, like "abc123xyz4567")
```

### Step 3: Add to Replit Secrets

Go to Replit → Tools → Secrets, and add:

```
Key: VITE_TAWK_PROPERTY_ID
Value: [PASTE YOUR PROPERTY ID HERE]

Key: VITE_TAWK_WIDGET_ID
Value: [PASTE YOUR WIDGET ID HERE]
```

### Step 4: Restart Server

The server will auto-restart. You'll see a green chat bubble in the bottom-right corner of your site!

---

## 🎨 Customization (Optional)

### Change Widget Color

1. Tawk.to Dashboard → Administration → Channels
2. Click "Widget Appearance"
3. Change colors to match Pet Wash™ brand:
   - **Primary Color:** `#3B82F6` (Pet Wash blue)
   - **Secondary Color:** `#06B6D4` (Pet Wash cyan)
4. Click "Save"

### Set Operating Hours

1. Dashboard → Administration → Channels
2. Click "Operating Hours"
3. Set your availability:
   - **Sunday-Thursday:** 8:00 AM - 8:00 PM (Israel Time)
   - **Friday:** 8:00 AM - 2:00 PM
   - **Saturday:** Closed
4. Widget will show "We're offline" outside these hours

### Add Agent Photo

1. Dashboard → Administration → Agents
2. Click your profile
3. Upload professional photo
4. Add name: "Pet Wash Support Team"

---

## 📱 Mobile Apps

Tawk.to provides free mobile apps for agents:

- **iOS:** https://apps.apple.com/app/tawk-to/id601094166
- **Android:** https://play.google.com/store/apps/details?id=com.tawk.live

Install to respond to chats on the go!

---

## ✅ Testing Checklist

After setup, test the following:

- [ ] Chat bubble appears in bottom-right corner
- [ ] Click bubble → chat window opens
- [ ] Send test message → agent receives it
- [ ] Agent replies → message appears in chat
- [ ] Test in Hebrew (widget should auto-switch to Hebrew)
- [ ] Test on mobile device
- [ ] Test on desktop
- [ ] Check widget appears on all pages

---

## 🌟 Features You Get (FREE Forever)

✅ Unlimited agents
✅ Unlimited chats  
✅ Mobile apps (iOS + Android)
✅ Visitor monitoring (see who's browsing)
✅ Chat history
✅ File sharing
✅ Pre-chat form
✅ Offline messaging
✅ Multi-language support
✅ Chat ratings
✅ Shortcuts (canned responses)
✅ Knowledge base integration

---

## 📊 Analytics & Reporting

Tawk.to Dashboard shows:
- Total chats per day/week/month
- Average response time
- Customer satisfaction ratings
- Busiest hours
- Most common questions

Use this data to improve customer service!

---

## 🔒 Security & Privacy

- ✅ GDPR compliant
- ✅ End-to-end encryption
- ✅ Data stored in secure EU servers
- ✅ No credit card required (forever free)
- ✅ Israeli Privacy Law 2025 compliant

---

## 💡 Pro Tips

### Quick Replies

Create shortcuts for common questions:
- `/hours` → "We're open Sunday-Thursday 8 AM - 8 PM Israel Time"
- `/pricing` → "Wash prices: Single ₪30, 3-pack ₪80, 5-pack ₪120"
- `/location` → "Find stations at petwash.co.il/k9000/overview"

### Auto-Triggers

Set automatic messages:
- "Need help? Our team is here!" (after 30 seconds on page)
- "Still have questions?" (when user tries to leave)

---

## 🆘 Troubleshooting

**Widget not appearing?**
- Check Replit Secrets are set correctly
- Restart server (server auto-restarts after adding secrets)
- Clear browser cache (Ctrl+Shift+R)
- Check browser console for errors

**Widget shows wrong language?**
- Language is auto-detected from `localStorage.getItem('language')`
- Change language in Pet Wash™ header → chat updates automatically

**Can't receive messages?**
- Install Tawk.to mobile app
- Enable notifications in app settings
- Check email notifications in Tawk.to dashboard

---

## 📞 Tawk.to Support

If you need help with Tawk.to:
- **Live Chat:** chat.tawk.to
- **Email:** support@tawk.to
- **Help Center:** help.tawk.to
- **Status:** status.tawk.to

---

**Setup Time:** 5 minutes  
**Cost:** FREE Forever  
**Next Step:** Add secrets to Replit and start chatting with customers! 🎉
