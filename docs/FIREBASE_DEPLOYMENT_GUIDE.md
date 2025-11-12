# Firebase Security Rules Deployment Guide

**Status:** Rules Ready - Manual Deployment Required  
**Updated:** November 8, 2025  
**Entity:** Pet Wash Ltd (פט וואש בע״מ)

---

## Overview

Your comprehensive Firebase security rules are ready and saved in `firestore.rules`. This guide shows you how to deploy them to production.

---

## Rules Summary

Your Firestore security rules cover:

✅ **User Management**
- Personal profiles with owner-only access
- Employee profiles with role-based access (admin, ops, regular)
- Active vs suspended employee status checks

✅ **Enterprise Features**
- Franchise isolation (owners only see their franchise)
- Department-based project access
- Inventory management per franchise

✅ **Financial Controls**
- KYC documents (user + admin only)
- Invoices and bank transactions (admin + finance roles)
- Expenses tracking by franchise

✅ **Compliance & Security**
- DPO appointments tracking
- Penetration test records
- Security incident logging
- System backups (admin read-only)

---

## Deployment Methods

### Method 1: Firebase Console (Easiest - 5 minutes)

**Step 1:** Open Firebase Console
1. Go to https://console.firebase.google.com
2. Select your project (Pet Wash Ltd)
3. Click **Firestore Database** in left sidebar

**Step 2:** Navigate to Rules Tab
1. Click **Rules** tab at the top
2. You'll see the current rules editor

**Step 3:** Copy Rules from File
1. Open `firestore.rules` in your project
2. Copy ALL contents (lines 1-290)
3. Paste into Firebase Console rules editor

**Step 4:** Publish
1. Click **Publish** button
2. Confirm deployment
3. Rules are live in ~30 seconds

**Step 5:** Verify
```bash
# Test that rules are active
curl -X GET "https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users/test_user"
```

Should return permission denied for unauthorized access ✅

---

### Method 2: Firebase CLI (Recommended for Teams)

**Step 1:** Install Firebase CLI

```bash
npm install -g firebase-tools
```

**Step 2:** Login to Firebase

```bash
firebase login
```

Opens browser for Google authentication.

**Step 3:** Initialize Firebase (if not done)

```bash
firebase init
```

Select:
- [x] Firestore
- Select your existing project
- Keep default paths:
  - Rules: `firestore.rules`
  - Indexes: `firestore.indexes.json`

**Step 4:** Deploy Rules Only

```bash
firebase deploy --only firestore:rules
```

Output:
```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project/overview
Firestore Rules: https://console.firebase.google.com/project/your-project/firestore/rules
```

**Step 5:** Deploy Indexes (Optional)

```bash
firebase deploy --only firestore:indexes
```

---

### Method 3: Automated CI/CD (For Production)

Add to your deployment pipeline:

**GitHub Actions Example:**

```yaml
name: Deploy Firebase Rules

on:
  push:
    branches: [main]
    paths:
      - 'firestore.rules'
      - 'firestore.indexes.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: w9jds/firebase-action@master
        with:
          args: deploy --only firestore:rules
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

---

## Verification Steps

### Test 1: Anonymous Access Denied

```javascript
// Should FAIL (no authentication)
const doc = await firebase.firestore()
  .collection('users')
  .doc('some_user')
  .get();

// Expected: Permission denied ✅
```

### Test 2: Owner Can Read Own Data

```javascript
// Should SUCCEED (authenticated user reads own profile)
const user = firebase.auth().currentUser;
const doc = await firebase.firestore()
  .collection('users')
  .doc(user.uid)
  .get();

// Expected: Success ✅
```

### Test 3: Admin Can Read All Users

```javascript
// Should SUCCEED (nirhadad1@gmail.com is admin)
const users = await firebase.firestore()
  .collection('users')
  .get();

// Expected: Success for admin ✅
```

### Test 4: Franchise Isolation

```javascript
// Owner can ONLY read their franchise
const franchise = await firebase.firestore()
  .collection('franchises')
  .doc('franchise_123')
  .get();

// Expected: Success only if token.franchise_id == 'franchise_123' ✅
```

---

## Troubleshooting

### Issue: "Permission denied" for valid user

**Solution:**
1. Check user is authenticated: `firebase.auth().currentUser`
2. Verify custom claims set: `user.getIdTokenResult().claims`
3. User may need to re-login to get fresh token

### Issue: App Check errors

**Solution:**
1. App Check is gracefully degraded (not strictly enforced)
2. For production, configure App Check in Firebase Console
3. Add recaptcha site key to your app

### Issue: Rules not updating

**Solution:**
1. Hard refresh Firebase Console (Ctrl+Shift+R)
2. Wait 60 seconds for propagation
3. Check deployment logs: `firebase deploy --only firestore:rules --debug`

---

## Custom Claims Setup

Your rules rely on custom claims for role-based access. Ensure these are set:

**Admin Employee:**
```javascript
await admin.auth().setCustomUserClaims(userId, {
  role: 'admin',
  status: 'active',
  franchise_id: 'hq_israel'
});
```

**Franchise Owner:**
```javascript
await admin.auth().setCustomUserClaims(userId, {
  role: 'owner',
  franchise_id: 'franchise_tlv_001'
});
```

**Regular Employee:**
```javascript
await admin.auth().setCustomUserClaims(userId, {
  role: 'employee',
  status: 'active',
  departments: ['operations', 'customer_service']
});
```

---

## Rule Updates

When you need to update rules:

1. Edit `firestore.rules` file
2. Test locally:
   ```bash
   firebase emulators:start --only firestore
   ```
3. Deploy:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## Security Best Practices

✅ **Never disable rules in production**  
❌ DON'T use `allow read, write: if true;`

✅ **Test rules before deploying**  
Use Firebase Emulator Suite

✅ **Monitor unauthorized access attempts**  
Check Firebase Console → Firestore → Usage tab

✅ **Review rules quarterly**  
As business requirements change

✅ **Document rule changes**  
Add comments explaining complex logic

---

## Firebase Emulator (Local Testing)

Test rules locally before deploying:

**Start Emulator:**
```bash
firebase emulators:start --only firestore
```

**Connect Your App:**
```javascript
if (location.hostname === 'localhost') {
  firebase.firestore().useEmulator('localhost', 8080);
}
```

**Run Tests:**
```bash
npm run test:firestore-rules
```

---

## Support

**Firebase Documentation:**  
https://firebase.google.com/docs/firestore/security/get-started

**Rules Playground:**  
https://firebase.google.com/docs/rules/simulator

**Pet Wash Technical Support:**  
📧 CTO Email  
📱 DevOps On-Call

---

## Deployment Checklist

Before deploying rules to production:

- [ ] Rules file reviewed and tested
- [ ] All custom claims documented
- [ ] Emulator testing passed
- [ ] Backup current rules from console
- [ ] Deploy to staging first (if available)
- [ ] Monitor error rates after deployment
- [ ] Verify critical flows still work

---

## Next Steps

1. **Deploy Now:** Use Method 1 (Firebase Console) - Takes 5 minutes
2. **Set Up CLI:** Install Firebase tools for future updates
3. **Configure App Check:** For production security (optional)
4. **Monitor Usage:** Check Firebase Console daily

---

**Your rules are enterprise-grade and ready for production! 🚀**
