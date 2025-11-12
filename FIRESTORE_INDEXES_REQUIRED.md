# Firestore Indexes Required

**CRITICAL**: These indexes must be created in Firebase Console to fix background job errors.

## 🔴 URGENT - Currently Failing

### 1. wallet_telemetry (FAILING NOW)
Collection: `wallet_telemetry`
- Field: `status` (Ascending)
- Field: `createdAt` (Ascending)
- Field: `__name__` (Ascending)

**Current Error**: `Error: 9 FAILED_PRECONDITION: The query requires an index`
**Impact**: Background job crashing every 2 minutes
**Direct Fix URL**: 
```
https://console.firebase.google.com/v1/r/project/signinpetwash/firestore/indexes?create_composite=ClZwcm9qZWN0cy9zaWduaW5wZXR3YXNoL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy93YWxsZXRfdGVsZW1ldHJ5L2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

## 🟡 Required for Full Functionality

### 2. escrow_payments
Collection: `escrow_payments`
- Field: `status` (Ascending) 
- Field: `holdUntil` (Ascending)

**Purpose**: Auto-release expired escrow holds

### 3. notifications
Collection: `notifications`
- Field: `userId` (Ascending)
- Field: `createdAt` (Descending)

**Purpose**: Fetch user notifications efficiently

### 4. conversations
Collection: `conversations`
- Field: `participantIds` (Array)
- Field: `updatedAt` (Descending)

**Purpose**: List user conversations

### 5. bookings (all platforms)
Collection: `bookings`
- Field: `customerId` (Ascending)
- Field: `createdAt` (Descending)

Collection: `bookings`
- Field: `providerId` (Ascending)
- Field: `createdAt` (Descending)

**Purpose**: Efficient booking queries

## How to Create

1. Go to Firebase Console: https://console.firebase.google.com/project/signinpetwash/firestore/indexes
2. Click "Create Index"
3. Select collection name
4. Add fields in order listed
5. Click "Create Index"
6. Wait 5-10 minutes for build

**Status**: Required before background jobs work correctly
