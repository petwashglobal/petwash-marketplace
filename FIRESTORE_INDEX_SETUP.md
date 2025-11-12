# Firestore Index Setup Guide

## Overview
This guide explains how to create the required Firestore composite indexes for Pet Wash™ station monitoring.

## Why Indexes Are Needed
Firestore requires composite indexes for queries that:
- Filter on multiple fields
- Combine filtering with sorting
- Use inequality operators on multiple fields

## Required Indexes

### 1. Station Events - Status Monitoring
**Collection:** `station_events`  
**Fields:**
- `stationId` (Ascending)
- `timestamp` (Descending)

**Used For:** Fetching recent events for a specific station

---

### 2. Station Events - Uptime Calculation
**Collection:** `station_events`  
**Fields:**
- `stationId` (Ascending)
- `timestamp` (Ascending)

**Used For:** Calculating uptime over time ranges

---

### 3. Station Events - Alert Monitoring
**Collection:** `station_events`  
**Fields:**
- `stationId` (Ascending)
- `type` (Ascending)
- `timestamp` (Ascending)

**Used For:** Filtering events by type (offline, fault, etc.) for specific stations

---

## How to Deploy Indexes

### Method 1: Firebase Console (Manual)

1. **Navigate to Firestore Console:**
   - Open: https://console.firebase.google.com/project/signinpetwash/firestore
   - Click "Indexes" tab

2. **Create Each Index:**
   - Click "Create Index"
   - Collection ID: `station_events`
   - Add fields as specified above
   - Click "Create Index"

3. **Wait for Build:**
   - Indexes take 5-15 minutes to build
   - Status will show "Building..." then "Enabled"

---

### Method 2: Firebase CLI (Automated)

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Project:**
   ```bash
   firebase init firestore
   ```
   - Select: "Use an existing project"
   - Choose: `signinpetwash`
   - Accept default filenames

4. **Deploy Indexes:**
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. **Verify Deployment:**
   - Check Firebase Console > Firestore > Indexes
   - All indexes should show "Enabled" status

---

## Index Links (Auto-Generated)

When Firestore detects a missing index, it logs an error with a direct link to create it:

**Example:**
```
The query requires an index. You can create it here:
https://console.firebase.google.com/project/signinpetwash/firestore/indexes?create_composite=...
```

Simply click the link and confirm to create the index automatically.

---

## Verification

After deploying indexes, verify they're working:

1. **Check Logs:**
   ```bash
   # Should no longer see "Firestore index missing" warnings
   ```

2. **Monitor Station Status:**
   - Navigate to Admin > Stations
   - Uptime percentages should display correctly
   - No "100% default" fallback messages

3. **Test Queries:**
   ```bash
   # Run station monitoring
   curl https://petwash.co.il/api/admin/stations/analytics
   ```

---

## Current Status

### Deployed Indexes
- ✅ `firestore.indexes.json` created
- ⏳ **Action Required:** Deploy indexes using one of the methods above

### Missing Indexes (Pre-Deployment)
- ⚠️ station_events (stationId + timestamp desc)
- ⚠️ station_events (stationId + timestamp asc)
- ⚠️ station_events (stationId + type + timestamp)

---

## Troubleshooting

### Index Build Failed
- Check Firestore quota limits
- Verify project permissions
- Retry deployment after 5 minutes

### Query Still Failing
- Confirm index status is "Enabled" (not "Building")
- Clear application cache
- Restart server

### Performance Issues
- Firestore charges for index reads
- Monitor index usage in Console
- Optimize queries to use existing indexes

---

## Reference

**Firebase Documentation:**
- Composite Indexes: https://firebase.google.com/docs/firestore/query-data/indexing
- Index Management: https://firebase.google.com/docs/firestore/query-data/index-overview

**Pet Wash™ Related Files:**
- Index Definition: `firestore.indexes.json`
- Station Service: `server/stationsService.ts`
- Background Jobs: `server/backgroundJobs.ts`

---

© 2025 Pet Wash™ Ltd. All rights reserved.
