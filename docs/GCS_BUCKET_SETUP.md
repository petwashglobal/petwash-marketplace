# ☁️ Google Cloud Storage Bucket Setup Guide
## Pet Wash™ - Biometric Data Lifecycle Management

This guide explains how to provision and configure GCS buckets for secure biometric data storage and automated lifecycle management.

---

## 🎯 **Purpose**

**Biometric Data Compliance Requirements:**
- **7-year retention** for audit trail
- **30-day automatic deletion** for user biometric templates (privacy)
- **Encrypted storage** (AES-256)
- **Access logging** for compliance

---

## 📋 **Required Buckets**

| Bucket Name | Purpose | Lifecycle Policy | Size Est. |
|-------------|---------|------------------|-----------|
| `petwash-biometric-data` | WebAuthn credentials, biometric templates | 30-day auto-delete | ~100MB |
| `petwash-secure-documents` | Contracts, HR docs, legal files | 7-year retention | ~10GB |
| `petwash-transaction-backups` | K9000 transaction logs | 7-year retention | ~5GB/year |
| `petwash-code-backups` | Weekly code snapshots | 90-day retention | ~500MB |

---

## 🚀 **Quick Setup (CLI)**

### **Prerequisites**
```bash
# Install Google Cloud SDK
# macOS:
brew install google-cloud-sdk

# Linux:
curl https://sdk.cloud.google.com | bash

# Windows:
# Download from: https://cloud.google.com/sdk/docs/install
```

### **Authenticate**
```bash
# Login to Google Cloud
gcloud auth login

# Set project (use your Firebase project ID)
gcloud config set project signinpetwash
```

### **Create All Buckets**
```bash
# Set variables
PROJECT_ID="signinpetwash"
REGION="europe-west1"  # Use region closest to Israel

# 1. Biometric Data Bucket (30-day lifecycle)
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://petwash-biometric-data

# 2. Secure Documents Bucket (7-year retention)
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://petwash-secure-documents

# 3. Transaction Backups Bucket (7-year retention)
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://petwash-transaction-backups

# 4. Code Backups Bucket (90-day retention)
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://petwash-code-backups
```

---

## 🔐 **Configure Lifecycle Policies**

### **1. Biometric Data (30-day auto-delete)**

Create `lifecycle-biometric.json`:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 30,
          "matchesPrefix": ["biometric_templates/"]
        }
      },
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 2555,
          "matchesPrefix": ["audit_trail/"]
        }
      }
    ]
  }
}
```

Apply policy:
```bash
gsutil lifecycle set lifecycle-biometric.json gs://petwash-biometric-data
```

### **2. Secure Documents (7-year retention, no deletion)**

Create `lifecycle-documents.json`:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "NEARLINE"
        },
        "condition": {
          "age": 90,
          "matchesStorageClass": ["STANDARD"]
        }
      },
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "COLDLINE"
        },
        "condition": {
          "age": 365,
          "matchesStorageClass": ["NEARLINE"]
        }
      }
    ]
  }
}
```

Apply policy:
```bash
gsutil lifecycle set lifecycle-documents.json gs://petwash-secure-documents
```

### **3. Transaction Backups (7-year, then archive)**

Create `lifecycle-transactions.json`:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "ARCHIVE"
        },
        "condition": {
          "age": 365,
          "matchesStorageClass": ["STANDARD"]
        }
      },
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 2555
        }
      }
    ]
  }
}
```

Apply policy:
```bash
gsutil lifecycle set lifecycle-transactions.json gs://petwash-transaction-backups
```

### **4. Code Backups (90-day retention)**

Create `lifecycle-code.json`:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 90
        }
      }
    ]
  }
}
```

Apply policy:
```bash
gsutil lifecycle set lifecycle-code.json gs://petwash-code-backups
```

---

## 🔒 **Configure Bucket Security**

### **Enable Uniform Bucket-Level Access**
```bash
# Recommended for enterprise security
gsutil uniformbucketlevelaccess set on gs://petwash-biometric-data
gsutil uniformbucketlevelaccess set on gs://petwash-secure-documents
gsutil uniformbucketlevelaccess set on gs://petwash-transaction-backups
gsutil uniformbucketlevelaccess set on gs://petwash-code-backups
```

### **Enable Versioning (for documents)**
```bash
# Protect against accidental deletion
gsutil versioning set on gs://petwash-secure-documents
gsutil versioning set on gs://petwash-transaction-backups
```

### **Enable Encryption**
```bash
# Use Google-managed encryption (default)
# Or use Customer-Managed Encryption Keys (CMEK) for higher security:
# gsutil encryption set -k projects/signinpetwash/locations/global/keyRings/pet-wash-keys/cryptoKeys/storage-key gs://petwash-biometric-data
```

### **Configure Access Logging**
```bash
# Create logging bucket
gsutil mb -p signinpetwash -c STANDARD -l europe-west1 gs://petwash-access-logs

# Enable logging for all buckets
gsutil logging set on -b gs://petwash-access-logs -o AccessLog gs://petwash-biometric-data
gsutil logging set on -b gs://petwash-access-logs -o AccessLog gs://petwash-secure-documents
```

---

## 🔑 **Grant Service Account Access**

### **Get Service Account Email**
Your Firebase service account should already have access. To verify:
```bash
# Extract service account email from FIREBASE_SERVICE_ACCOUNT_KEY
echo $FIREBASE_SERVICE_ACCOUNT_KEY | jq -r '.client_email'
# Example: firebase-adminsdk-xyz@signinpetwash.iam.gserviceaccount.com
```

### **Grant Storage Permissions**
```bash
SERVICE_ACCOUNT="firebase-adminsdk-xyz@signinpetwash.iam.gserviceaccount.com"

# Grant Storage Object Admin role (create, read, update, delete)
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:roles/storage.objectAdmin gs://petwash-biometric-data
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:roles/storage.objectAdmin gs://petwash-secure-documents
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:roles/storage.objectAdmin gs://petwash-transaction-backups
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:roles/storage.objectAdmin gs://petwash-code-backups
```

---

## 🧪 **Test Bucket Configuration**

### **Test Upload/Download**
```bash
# Create test file
echo "Test biometric data" > test-biometric.txt

# Upload to bucket
gsutil cp test-biometric.txt gs://petwash-biometric-data/test/

# Verify upload
gsutil ls gs://petwash-biometric-data/test/

# Download to verify
gsutil cp gs://petwash-biometric-data/test/test-biometric.txt downloaded-test.txt

# Verify lifecycle policy
gsutil lifecycle get gs://petwash-biometric-data

# Cleanup
gsutil rm gs://petwash-biometric-data/test/test-biometric.txt
rm test-biometric.txt downloaded-test.txt
```

### **Test from Application**
```bash
# Restart application
npm run dev

# Check logs for GCS initialization
# Look for: "[K9000] Google Cloud Storage initialized for transaction backup"
# Should NOT see: "The specified bucket does not exist"
```

---

## 📊 **Monitor Bucket Usage**

### **Check Storage Metrics**
```bash
# Get bucket size
gsutil du -sh gs://petwash-biometric-data
gsutil du -sh gs://petwash-secure-documents
gsutil du -sh gs://petwash-transaction-backups
gsutil du -sh gs://petwash-code-backups
```

### **List Objects by Age**
```bash
# Show objects older than 25 days (approaching 30-day lifecycle)
gsutil ls -l -r gs://petwash-biometric-data | grep $(date -d '25 days ago' +%Y-%m-%d)
```

### **Cost Estimation**
```bash
# Rough monthly cost estimate:
# STANDARD: $0.020 per GB/month
# NEARLINE: $0.010 per GB/month
# COLDLINE: $0.004 per GB/month
# ARCHIVE: $0.0012 per GB/month

# Expected costs for Pet Wash:
# Biometric: ~100MB = $0.002/month (STANDARD)
# Documents: ~10GB = $0.04/month (COLDLINE after 1 year)
# Transactions: ~5GB/year = $0.006/month (ARCHIVE after 1 year)
# Code: ~500MB = $0.01/month (STANDARD, 90-day rotation)
# Total: < $1/month
```

---

## 🚨 **Troubleshooting**

### **Error: "The specified bucket does not exist"**

**Solution**:
```bash
# Verify bucket exists
gsutil ls gs://petwash-biometric-data

# If not, create it
gsutil mb -p signinpetwash -c STANDARD -l europe-west1 gs://petwash-biometric-data
```

---

### **Error: "Access denied" when uploading**

**Solution**:
```bash
# Check service account permissions
gsutil iam get gs://petwash-biometric-data

# Grant permissions if missing
gsutil iam ch serviceAccount:YOUR_SERVICE_ACCOUNT:roles/storage.objectAdmin gs://petwash-biometric-data
```

---

### **Lifecycle policy not deleting old files**

**Solution**:
1. Lifecycle policies run daily (not immediate)
2. Verify policy is set: `gsutil lifecycle get gs://petwash-biometric-data`
3. Check object age: `gsutil ls -l gs://petwash-biometric-data/path/`
4. Wait 24-48 hours for policy to take effect

---

## ✅ **Deployment Checklist**

- [ ] Google Cloud SDK installed and authenticated
- [ ] All 4 buckets created
- [ ] Lifecycle policies configured
- [ ] Uniform bucket-level access enabled
- [ ] Versioning enabled for documents and transactions
- [ ] Service account permissions granted
- [ ] Access logging configured
- [ ] Test upload/download successful
- [ ] Application logs show no "bucket does not exist" errors
- [ ] Monitoring dashboard created (optional)

**Once all checkboxes are complete, GCS buckets are production-ready!** ☁️
