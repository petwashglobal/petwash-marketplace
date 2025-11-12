# Firebase Email Template Setup Instructions

## ✅ Code Changes - COMPLETED
The code has been updated to automatically use the correct language for Firebase Auth emails:

1. **Auto Device Language Detection** (`client/src/lib/firebase.ts`)
   - Firebase Auth now automatically detects Hebrew on Hebrew devices
   - Uses `auth.useDeviceLanguage()` by default

2. **Dynamic Language Override** (`client/src/pages/SignIn.tsx`)
   - Password reset emails use the user's current UI language
   - Sets `auth.languageCode = 'he'` for Hebrew users
   - Sets `auth.languageCode = 'en'` for English users

## 📧 Firebase Console Setup - DO THIS MANUALLY

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com)
2. Select project: **signinpetwash**
3. Navigate to: **Authentication** → **Templates**

### Step 2: Configure Email Templates

#### Option A: Separate Templates (Recommended)
Set up separate templates for Hebrew and English users:

**For English Template:**
1. Click on **Password reset** template
2. Select language: **English**
3. Subject: `Reset your Pet Wash™ password`
4. Reply-To: `support@petwash.co.il`
5. Copy content from: `firebase-email-templates/password-reset-english.html`
6. **Important:** Replace these Firebase variables in the template:
   - `{{displayName}}` → `%DISPLAY_NAME%` (if used)
   - `{{email}}` → `%EMAIL%`
   - `{{url}}` → `%LINK%`
7. Click **Save**

**For Hebrew Template (עברית):**
1. Click on **Password reset** template
2. Select language: **עברית (Hebrew)**
3. Subject: `איפוס הסיסמה שלך ב-Pet Wash™`
4. Reply-To: `support@petwash.co.il`
5. Copy content from: `firebase-email-templates/password-reset-hebrew.html`
6. **Important:** Replace these Firebase variables:
   - `{{email}}` → `%EMAIL%`
   - `{{url}}` → `%LINK%`
7. Click **Save**

#### Option B: Single Bilingual Template (Simpler)
Use one template that shows both Hebrew and English:

1. Click on **Password reset** template
2. Select default language
3. Subject: `Reset your Pet Wash™ password | איפוס הסיסמה שלך`
4. Reply-To: `support@petwash.co.il`
5. Copy content from: `firebase-email-templates/password-reset-bilingual.html`
6. Replace Firebase variables as shown above
7. Click **Save**

### Step 3: Test the Email Templates

1. **Test in Development:**
   - Go to `/signin` page
   - Toggle language to Hebrew (עברית)
   - Click "Forgot Password?"
   - Enter an email and request reset
   - Check email - should be in Hebrew

2. **Test in English:**
   - Toggle language to English
   - Request password reset
   - Check email - should be in English

### Step 4: Verify Email Sending Domain

**Current Setup:**
- Emails send from: `no-reply@signinpetwash.firebaseapp.com`
- Reply-To: `support@petwash.co.il`

**To Use Custom Domain (Optional):**
If you want emails to come from `support@petwash.co.il`:
1. Upgrade to **Firebase Identity Platform**
2. Configure custom SMTP relay
3. Or use SendGrid/Twilio for transactional emails

## 📝 Firebase Template Variables

When pasting HTML into Firebase Console, use these variable names:

| What You Want | Firebase Variable |
|---------------|-------------------|
| User's email | `%EMAIL%` |
| User's display name | `%DISPLAY_NAME%` |
| Reset link | `%LINK%` |
| App name | `%APP_NAME%` |

**Note:** Do NOT use `{{email}}` or `{{url}}` - Firebase uses `%EMAIL%` and `%LINK%` syntax.

## 🎨 Template Features

All templates include:
- ✅ Pet Wash™ official logo
- ✅ Brand colors (#0fb36c green)
- ✅ Responsive design (mobile-friendly)
- ✅ RTL support for Hebrew
- ✅ Security messaging
- ✅ Support contact link
- ✅ Professional appearance

## 🔒 Security Notes

- Password reset links expire automatically
- Links are single-use only
- Users can safely ignore unwanted reset emails
- All links use HTTPS

## ✅ Checklist

- [x] Code updated to detect device language
- [x] Code updated to use UI language for password reset
- [ ] English template configured in Firebase Console
- [ ] Hebrew template configured in Firebase Console
- [ ] Tested password reset in English
- [ ] Tested password reset in Hebrew
- [ ] Verified logo appears correctly
- [ ] Verified links work correctly

## 🚀 Next Steps

After setting up templates:
1. Test password reset flow in both languages
2. Check spam folder if emails don't arrive
3. Verify logo loads correctly
4. Confirm Reply-To address works
5. Test on mobile devices (iOS/Android)

---

**Support:** If you need help, contact support@petwash.co.il
