# 🔥 Firestore Composite Indexes Deployment Guide
## Pet Wash™ Enterprise Platform

This guide explains how to deploy Firestore composite indexes to resolve query performance warnings.

---

## 🚨 **Why Indexes Are Critical**

Without proper indexes, these queries will fail or perform poorly:
- **Wallet Telemetry**: Abandonment detection (every 2 minutes)
- **Station Uptime**: Historical uptime calculations  
- **Booking Queries**: User bookings by date
- **Notification Queries**: User-specific notifications

---

## 📋 **Current Index Status**

### ✅ Already Configured (23 indexes)
- Station events (by stationId + timestamp)
- Wallet telemetry (by passId, status, createdAt)
- Fraud detection logs
- Compliance monitoring
- Escrow payments
- Conversations
- Bookings (by customer and provider)

### ⭐ **NEW: Added 3 Indexes for Station Uptime**
- `stations` collection (stationId + timestamp)
- `station_heartbeats` collection (stationId + timestamp)
- `station_heartbeats` collection (stationId + status + timestamp)

---

## 🚀 **Deployment Methods**

### **Option A: Automatic Deployment (Recommended)**

#### Prerequisites
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase (opens browser)
firebase login
```

#### Deploy Indexes
```bash
# Deploy all indexes from firestore.indexes.json
firebase deploy --only firestore:indexes --project signinpetwash

# Wait for deployment (typically 2-5 minutes)
# Firebase will create all missing indexes automatically
```

#### Verify Deployment
```bash
# List all indexes
firebase firestore:indexes --project signinpetwash

# Check specific index status
firebase firestore:indexes:list --project signinpetwash
```

---

### **Option B: Manual Deployment (Firebase Console)**

If you prefer using the Firebase Console:

1. **Open Firebase Console**
   - Visit: https://console.firebase.google.com/project/signinpetwash/firestore/indexes

2. **Create Composite Index**
   - Click "Add Index"
   - For each index in `firestore.indexes.json`:
     - Collection ID: e.g., `station_heartbeats`
     - Fields to index:
       - `stationId` (Ascending)
       - `timestamp` (Descending)
     - Query scope: Collection
     - Click "Create Index"

3. **Wait for Build**
   - Indexes typically build in 2-10 minutes
   - Status changes from "Building" → "Enabled"

---

## 🧪 **Testing Indexes**

After deployment, verify queries no longer produce warnings:

### **Test Station Uptime Query**
```javascript
// Run in Firebase Console > Firestore > Query
db.collection('station_heartbeats')
  .where('stationId', '==', '21kF32TQ0GUILuNCoXgf')
  .orderBy('timestamp', 'desc')
  .limit(100)
  .get()
  .then(snapshot => console.log(`✅ Found ${snapshot.size} heartbeats`))
  .catch(err => console.error('❌ Index missing:', err));
```

### **Test Wallet Telemetry Query**
```javascript
db.collection('wallet_telemetry')
  .where('status', '==', 'abandoned')
  .orderBy('createdAt', 'asc')
  .get()
  .then(snapshot => console.log(`✅ Found ${snapshot.size} abandoned wallets`))
  .catch(err => console.error('❌ Index missing:', err));
```

### **Check Application Logs**
```bash
# Restart your application and check logs
npm run dev

# Look for these SUCCESS messages (not warnings):
# [INFO] [WalletTelemetry] Abandonment detection successful
# [INFO] [Stations] Uptime calculated for all stations
```

---

## 🔍 **Troubleshooting**

### **Warning: "Composite index not configured"**

**Problem**: Log shows `[WARN] [WalletTelemetry] Composite index not configured`

**Solution**:
1. Verify index is "Enabled" in Firebase Console
2. Wait 2-5 minutes after deployment
3. Restart application to clear cache

---

### **Error: "The query requires an index"**

**Problem**: Query fails with Firebase error

**Solution**:
1. Firebase error includes auto-generated index link
2. Click link to create index automatically
3. Or manually create index following error specifications

---

### **Index Build Stuck at "Building"**

**Problem**: Index status shows "Building" for >15 minutes

**Solution**:
1. Check Firebase Status: https://status.firebase.google.com
2. Large collections (>100K docs) may take longer
3. Contact Firebase Support if stuck >1 hour

---

## 📊 **Index Performance Metrics**

After indexes are deployed, you should see:

| Metric | Before Indexes | After Indexes |
|--------|----------------|---------------|
| **Wallet Telemetry Query** | ❌ Fails with error | ✅ <50ms |
| **Station Uptime Query** | ❌ Returns 100% fallback | ✅ Real data in <100ms |
| **Background Job Success Rate** | ~70% (many skipped) | 100% |
| **Log Warnings** | ~10 per minute | 0 |

---

## 🎯 **Next Steps**

After deploying indexes:

1. ✅ **Monitor Logs**: Check for warnings disappearing
2. ✅ **Test Queries**: Run validation queries above
3. ✅ **Update Monitoring**: Verify background jobs succeed
4. ✅ **Document Status**: Update deployment checklist

---

## 📅 **Maintenance Schedule**

### **Weekly**
- Review Firebase Console for index performance
- Check for new index recommendations

### **Monthly**
- Audit unused indexes (may increase costs)
- Optimize complex queries if needed

### **Before Major Releases**
- Test all queries with production-like data
- Deploy new indexes 24-48 hours before launch

---

## 🆘 **Support Resources**

**Firebase Documentation**: https://firebase.google.com/docs/firestore/query-data/indexing  
**Index Best Practices**: https://firebase.google.com/docs/firestore/best-practices  
**Firebase Status**: https://status.firebase.google.com  
**Firebase Support**: https://firebase.google.com/support

---

## ✅ **Deployment Checklist**

- [ ] Firebase CLI installed and authenticated
- [ ] `firestore.indexes.json` reviewed and updated
- [ ] Indexes deployed via `firebase deploy --only firestore:indexes`
- [ ] All indexes show "Enabled" status in console
- [ ] Application logs show no index warnings
- [ ] Wallet telemetry abandonment detection working
- [ ] Station uptime queries returning real data
- [ ] Background jobs completing successfully

**Once all checkboxes are complete, indexes are production-ready!** 🚀
