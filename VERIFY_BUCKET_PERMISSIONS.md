# 🔍 Verify Bucket Permissions - Step-by-Step Guide

## Current Status
- ✅ Bucket created: `petwash-backups-93383`
- ❌ Permissions not yet working (403 errors after 3 minutes)
- 🔄 Need to verify permissions were granted correctly

---

## Please Verify These Steps in Google Cloud Console

### Step 1: Open Your Bucket
1. Go to: https://console.cloud.google.com/storage/browser?project=signinpetwash
2. Click on bucket: **petwash-backups-93383**

### Step 2: Check Permissions Tab
1. Click the **PERMISSIONS** tab (top of page, next to "OBJECTS")
2. Look for this service account in the list:
   ```
   petwash-backup-service@signinpetwash.iam.gserviceaccount.com
   ```

### Step 3: Verify the Role Assignment

**Question 1: Do you see the service account listed?**
- [ ] YES - I see `petwash-backup-service@signinpetwash.iam.gserviceaccount.com`
- [ ] NO - I don't see it

**If YES, Question 2: What role(s) does it have?**
- [ ] Storage Object Admin (`roles/storage.objectAdmin`)
- [ ] Storage Admin (`roles/storage.admin`)  
- [ ] Something else: _______________

**If NO, you need to add it:**
1. Click **+ GRANT ACCESS** button (blue button, top right)
2. In "New principals" field, paste:
   ```
   petwash-backup-service@signinpetwash.iam.gserviceaccount.com
   ```
3. Click "Select a role" dropdown
4. Type "Storage Object Admin" or navigate to: **Cloud Storage** → **Storage Object Admin**
5. Click **SAVE**
6. Confirm the service account now appears in the permissions list

---

## Common Issues & Solutions

### Issue 1: Service Account Not Appearing
**Symptom**: You clicked SAVE but don't see the service account in the list

**Solutions**:
1. **Refresh the page** - Sometimes the UI doesn't update immediately
2. **Check you're on the right bucket** - Verify bucket name is `petwash-backups-93383`
3. **Check the correct project** - Verify project is `signinpetwash` (top bar)
4. **Try adding again** - Sometimes the first add doesn't stick

### Issue 2: Wrong Role Assigned
**Symptom**: Service account appears but has wrong role (not Storage Object Admin)

**Solution**:
1. Find the service account in the permissions list
2. Click the **pencil icon** (Edit) next to it
3. Change role to **Storage Object Admin**
4. Click **SAVE**

### Issue 3: Principal Email Typo
**Symptom**: Added service account but with typo in email

**Solution**:
1. Find the incorrect entry in permissions list
2. Click **trash icon** (Delete) to remove it
3. Click **+ GRANT ACCESS** again
4. **Copy and paste** (don't type) this email:
   ```
   petwash-backup-service@signinpetwash.iam.gserviceaccount.com
   ```
5. Add Storage Object Admin role
6. Click **SAVE**

---

## Alternative: Grant Permissions via gcloud CLI

If you have `gcloud` CLI installed, you can grant permissions with this command:

```bash
gcloud storage buckets add-iam-policy-binding gs://petwash-backups-93383 \
  --member=serviceAccount:petwash-backup-service@signinpetwash.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
```

Then verify it worked:

```bash
gcloud storage buckets get-iam-policy gs://petwash-backups-93383 \
  --flatten="bindings[].members" \
  --filter="bindings.members:petwash-backup-service"
```

**Expected output:**
```
bindings:
- role: roles/storage.objectAdmin
  members:
  - serviceAccount:petwash-backup-service@signinpetwash.iam.gserviceaccount.com
```

---

## What to Report Back

Please confirm by checking these boxes:

- [ ] I can see `petwash-backups-93383` bucket in Cloud Console
- [ ] I clicked on the bucket and opened the PERMISSIONS tab
- [ ] I can see `petwash-backup-service@signinpetwash.iam.gserviceaccount.com` in the list
- [ ] The role next to it says "Storage Object Admin" or "Storage Admin"
- [ ] No error messages or warnings in the Cloud Console

If all boxes are checked, the issue is IAM propagation delay (can take 5-10 minutes for Firebase Storage buckets).

If any box is NOT checked, please tell me which step failed so I can help troubleshoot.

---

## Screenshot Locations (Optional)

If you want to share screenshots to help troubleshoot:

1. **Bucket list**: `https://console.cloud.google.com/storage/browser`
2. **Bucket permissions**: Click bucket → PERMISSIONS tab
3. **Service account list**: Show the full permissions list with the service account visible

---

## Next Steps After Verification

Once permissions are confirmed:
1. I'll wait another 5 minutes for propagation
2. Re-run diagnostic script
3. Run full backup (279 tables)
4. Continue with EGift.tsx and deployment
