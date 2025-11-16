# 🚀 Deployment Instructions - November 16, 2025
**Purpose**: Deploy fixed version to petwash.co.il to resolve production errors

---

## 🎯 **What We Fixed Today**

### **Critical Bugs Resolved:**

1. **API Routing Bug** ✅
   - Problem: `/api/packages` returned HTML instead of JSON
   - Fix: Added `await registerRoutes(app)` in `server/index.ts`
   - Result: All API endpoints now return proper JSON

2. **Canonical Redirect** ✅
   - Problem: www.petwash.co.il and petwash.co.il both live (SEO duplicate content)
   - Fix: Added 301 redirect (www → non-www)
   - Result: Single canonical domain for search engines

3. **Missing Favicons** ✅
   - Problem: Icon paths incorrect in HTML
   - Fix: Updated paths in `client/index.html`
   - Result: All favicons load correctly

4. **Error Handling** ✅
   - Added `try/catch` with `process.exit(1)` on startup failure
   - Result: Clean failure handling with proper logging

---

## 📦 **Production Build Status**

```bash
✅ Build completed successfully (35.82s)
✅ Total bundle size: 1,106.84 kB (357.07 kB gzipped)
✅ All assets generated in dist/public/
✅ No critical errors or warnings
```

**Build Output:**
- Main bundle: `dist/public/assets/App-DxEyKd7U.js` (357 KB gzipped)
- Firebase: `dist/public/assets/firebase-C0xieU_B.js` (124 KB gzipped)
- Charts: `dist/public/assets/generateCategoricalChart-w1V8XoKz.js` (98 KB gzipped)
- 100+ code-split chunks for fast loading

---

## 🚀 **How to Deploy to www.petwash.co.il**

### **Option 1: Replit Publish Button (Recommended)**

1. **Click "Publish" button** at top-right of Replit
2. **Verify deployment target**: Google Cloud Run
3. **Wait for deployment** (usually 2-5 minutes)
4. **Test production URL**: https://www.petwash.co.il

**Expected Result:**
- ✅ Homepage loads without errors
- ✅ Wash packages display correctly
- ✅ No "Error Loading Packages" message
- ✅ All favicons visible

---

### **Option 2: Manual Cloud Run Deployment**

If using Google Cloud Run directly:

```bash
# 1. Build the production bundle (already done)
npm run build

# 2. Deploy to Cloud Run
gcloud run deploy petwash \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production

# 3. Map custom domain
gcloud run services update petwash \
  --region us-central1 \
  --add-domain-mapping petwash.co.il
```

---

### **Option 3: Replit Deployments Tab**

1. Go to **Deployments** tab in Replit
2. Click **"Deploy"** button
3. Select **"Production"** environment
4. Wait for build and deployment to complete
5. Verify deployment status shows "Active"

---

## ✅ **Post-Deployment Verification**

After deployment, test these endpoints:

### **1. Test Homepage**
```bash
curl -I https://www.petwash.co.il/
# Expected: HTTP/2 200 OK
```

### **2. Test API Endpoint**
```bash
curl https://www.petwash.co.il/api/packages
# Expected: JSON array with 3 wash packages
```

### **3. Test Canonical Redirect**
```bash
curl -I https://www.petwash.co.il/
# Expected: HTTP/2 301 → https://petwash.co.il/
```

### **4. Test in Browser**

**Open**: https://www.petwash.co.il

**Verify:**
- [ ] Homepage loads without white screen
- [ ] Wash packages section displays (no "Error Loading Packages")
- [ ] Favicons appear in browser tab
- [ ] No JavaScript console errors
- [ ] Login/signup buttons work
- [ ] Menu opens correctly

**Expected Packages:**
1. Single Wash - ₪55
2. 3 Washes - ₪150 (10% discount)
3. 5 Washes - ₪220 (20% discount)

---

## 🔧 **If Deployment Shows Errors**

### **Error 1: "Build Failed"**

**Check:**
- `npm run build` completes locally (it did ✅)
- All dependencies installed
- TypeScript errors resolved

**Fix:**
```bash
# Rebuild locally
npm run build

# Check for errors
cat dist/public/index.html
```

### **Error 2: "Server Not Starting"**

**Check logs for:**
- Missing environment variables
- Database connection errors
- Firebase initialization errors

**Fix:**
- Verify all secrets are set in deployment environment
- Check DATABASE_URL, FIREBASE_PROJECT_ID, etc.

### **Error 3: "502 Bad Gateway"**

**Possible causes:**
- Server not listening on correct port
- Health check failing
- Startup timeout

**Fix:**
```javascript
// Verify server/index.ts has:
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, '0.0.0.0', () => { ... });
```

### **Error 4: Still Shows Old Version**

**Fix:**
- Clear browser cache (Ctrl+Shift+R)
- Wait 2-5 minutes for CDN propagation
- Verify deployment timestamp in Replit Deployments tab

---

## 📊 **Monitoring After Deployment**

### **Immediate Checks (First 10 Minutes):**

1. **Server Logs:**
   - Check for startup errors
   - Verify "[Server] listening on port 5000" message
   - Look for any red error messages

2. **API Endpoints:**
   - Test `/api/packages` returns JSON
   - Test `/api/wash-plans` works
   - Test `/api/stations` accessible

3. **User Experience:**
   - Load homepage on desktop browser
   - Load homepage on mobile (iPhone/Android)
   - Test sign-in flow
   - Test booking flow

### **First Hour Checks:**

1. **Error Monitoring:**
   - Check Sentry dashboard for new errors
   - Review Firebase logs for auth issues
   - Monitor server logs for crashes

2. **Performance:**
   - Test page load speed (should be < 3s)
   - Check Core Web Vitals in Chrome DevTools
   - Verify no memory leaks

3. **SEO:**
   - Test Google rich results preview
   - Verify OpenGraph tags work (share on WhatsApp)
   - Check robots.txt accessible

---

## 🎯 **Success Criteria**

**Deployment is successful when:**

- ✅ Homepage loads in < 3 seconds
- ✅ Wash packages display correctly (3 packages visible)
- ✅ No "Error Loading Packages" or "Internal server error" messages
- ✅ Favicons appear in browser tab
- ✅ www.petwash.co.il redirects to petwash.co.il (301)
- ✅ Console shows no JavaScript errors
- ✅ Login/signup works
- ✅ Mobile responsive (no horizontal scroll)
- ✅ Hebrew/English language toggle works
- ✅ Sentry shows no new critical errors

---

## 🚨 **Rollback Plan (If Needed)**

If deployment causes major issues:

### **Option 1: Revert in Replit**
1. Go to Deployments tab
2. Find previous working deployment
3. Click "Promote to Production"

### **Option 2: Git Rollback**
```bash
# Find last working commit
git log --oneline

# Rollback to previous version
git reset --hard <commit-hash>

# Rebuild
npm run build

# Redeploy
# (Use publish button or Cloud Run command)
```

### **Option 3: Emergency Fix**
If you just need to restore the old `server/index.ts`:
```bash
git checkout HEAD~1 server/index.ts
npm run build
# Redeploy
```

---

## 📞 **Support Checklist**

**Before contacting support, verify:**

- [ ] Build completed successfully locally
- [ ] `dist/public/` folder contains all files
- [ ] All environment variables set in production
- [ ] Database connection works (check DATABASE_URL)
- [ ] Firebase credentials valid (check FIREBASE_PROJECT_ID)
- [ ] Domain DNS points to correct server
- [ ] SSL certificate valid for petwash.co.il

**If all above are ✅ and still having issues:**
- Check Cloud Run logs (if using GCP)
- Check Replit deployment logs
- Verify server is listening on $PORT (not hardcoded 5000)

---

## 🎉 **Expected Outcome**

After successful deployment:

**User visits www.petwash.co.il:**
1. Automatically redirects to petwash.co.il (301)
2. Homepage loads with full content (not blank)
3. Wash packages section displays 3 cards:
   - "Single Wash" - ₪55
   - "3 Washes" - ₪150
   - "5 Washes" - ₪220
4. All images and icons load
5. No error messages visible
6. User can click "Sign In" or explore site

**Technical metrics:**
- Page load: < 3 seconds (4G connection)
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- No console errors
- All API endpoints return proper JSON

---

## 📝 **Deployment Log Template**

After deployment, document:

```
Deployment Date: November 16, 2025
Deployed By: [Your Name]
Deployment Method: [Replit Publish / Cloud Run / Other]
Deployment Time: [HH:MM UTC]
Build Version: [Git commit hash]

Changes Deployed:
- Fixed API routing bug (await registerRoutes)
- Added canonical redirect (www → non-www)
- Fixed favicon paths
- Added error handling

Verification Results:
- [ ] Homepage loads: YES/NO
- [ ] API returns JSON: YES/NO
- [ ] Packages display: YES/NO
- [ ] No errors: YES/NO
- [ ] Mobile works: YES/NO

Issues Encountered: [None / List any issues]

Rollback Required: YES/NO

Notes: [Any additional observations]
```

---

## ✅ **Final Checklist Before Deploy**

- [x] Code changes tested locally
- [x] Build completed successfully (`npm run build`)
- [x] All critical bugs fixed (API routing, redirects, favicons)
- [x] Architect reviewed and approved changes
- [x] Documentation updated (AUDIT_RESPONSE, Safari checklist)
- [x] Environment variables documented
- [ ] Deployment method chosen (Replit Publish / Cloud Run)
- [ ] Rollback plan understood
- [ ] Monitoring tools ready (Sentry, Firebase, logs)

**🚀 Ready to deploy!**

---

**Last Updated**: November 16, 2025  
**Status**: ✅ Ready for production deployment  
**Estimated Deployment Time**: 2-5 minutes  
**Risk Level**: Low (all changes tested and reviewed)
