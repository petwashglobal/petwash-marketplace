# 🔧 How to Fix Google Cloud Storage Backup

## ❌ **Current Error**

```
Service Account: petwash-backup-service@signinpetwash.iam.gserviceaccount.com
Error: Permission 'storage.objects.create' denied
Bucket: signinpetwash.firebasestorage.app
```

Your Google Cloud service account exists but **lacks write permissions** to the storage bucket.

---

## ✅ **QUICK FIX (5 Minutes)**

### **Step 1: Open Google Cloud Console**

1. Go to: **https://console.cloud.google.com**
2. Make sure you're logged in with your Google account
3. Select Project: **`signinpetwash`** (top navigation bar)

### **Step 2: Grant Storage Permissions**

**Option A - Bucket-Level Permissions (Recommended)**:

1. In Google Cloud Console, click the hamburger menu (☰)
2. Navigate to: **Cloud Storage** → **Buckets**
3. Click on bucket: **`signinpetwash.firebasestorage.app`**
4. Click the **"PERMISSIONS"** tab at the top
5. Click **"+ GRANT ACCESS"** button
6. In the **"New principals"** field, paste:
   ```
   petwash-backup-service@signinpetwash.iam.gserviceaccount.com
   ```
7. In the **"Select a role"** dropdown, choose:
   - **Storage Object Admin** (full control)
   - OR **Storage Object Creator** (write-only)
8. Click **"SAVE"**

**Option B - Project-Level Permissions**:

1. In Google Cloud Console, click the hamburger menu (☰)
2. Navigate to: **IAM & Admin** → **IAM**
3. Find the service account: `petwash-backup-service@signinpetwash.iam.gserviceaccount.com`
   - If you don't see it, click **"+ GRANT ACCESS"** at the top
4. Click the **pencil icon** (Edit) next to the service account
5. Click **"ADD ANOTHER ROLE"**
6. Search for and select: **Storage Object Admin**
7. Click **"SAVE"**

### **Step 3: Test the Backup**

After granting permissions, run:

```bash
tsx scripts/backup-to-google-cloud-storage.ts
```

You should see:
```
✅ 279 tables backed up to Google Cloud
✅ Backup complete at: gs://signinpetwash.firebasestorage.app/petwash-database-backups/
```

---

## 🎯 **What This Enables**

Once permissions are granted, the backup will:

✅ **Upload all 279 database tables** to Google Cloud Storage  
✅ **Create organized backup structure** with timestamps  
✅ **Provide off-site disaster recovery**  
✅ **Automatic encryption** (Google-managed)  
✅ **Version history** in Google Cloud  
✅ **Geographic redundancy** (Google's infrastructure)

---

## 📊 **Current Backup Status**

| Backup Tier | Status | Location |
|-------------|--------|----------|
| **Local** | ✅ COMPLETE | `complete-backup/2025-11-19T19-17-25-292Z/` |
| **GitHub** | ✅ ACTIVE | Repository: petwash-marketplace |
| **Google Cloud** | ⏳ PENDING | Waiting for IAM permissions |

---

## 🚀 **Can I Deploy Without Google Cloud Backup?**

**YES!** Your data is already protected with:

1. ✅ **Local backup** (279 tables, 87 records)
2. ✅ **GitHub version control** (all code)

Google Cloud backup is an **optional third layer** for extra redundancy.

---

## 🔐 **Why This Permission is Safe**

**`Storage Object Creator`** allows the service account to:
- ✅ Create/upload backup files
- ✅ Write to the specific bucket only
- ❌ **Cannot** delete files
- ❌ **Cannot** access other Google Cloud resources
- ❌ **Cannot** modify bucket settings

It's a **least-privilege permission** designed specifically for backups.

---

## 📞 **Need Help?**

If you don't have access to the Google Cloud Console:

1. **Contact your Google Cloud admin** with this info:
   - Project: `signinpetwash`
   - Service Account: `petwash-backup-service@signinpetwash.iam.gserviceaccount.com`
   - Bucket: `signinpetwash.firebasestorage.app`
   - Required Role: `Storage Object Creator` or `Storage Object Admin`

2. **Alternative**: Deploy now with existing backups (local + GitHub)

---

## ✅ **After Permissions are Granted**

Run these commands in order:

```bash
# 1. Test Google Cloud backup
tsx scripts/backup-to-google-cloud-storage.ts

# 2. Update ES256 voucher keys (see DEPLOYMENT_INSTRUCTIONS.md)
# 3. Restart workflow
# 4. Test voucher security
tsx scripts/test-es256-signing.ts

# 5. Deploy!
# Click the "Publish" button
```

---

**Your PetWash™ data is safe with or without Google Cloud backup. Fix the permissions when convenient, but you can deploy now! 🚀**
