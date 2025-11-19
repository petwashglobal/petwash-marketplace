# 🛡️ High-Risk Actions - Biometric Re-Authentication Guide

## Overview
For sensitive operations in the Pet Wash™ mobile app, you can require biometric re-authentication **even if the user is already logged in**. This adds an extra layer of security for destructive or financial actions.

---

## 🚨 What Are High-Risk Actions?

High-risk actions are operations that:
- **Delete critical data** (K9000 stations, customer accounts, etc.)
- **Modify financials** (revenue share percentages, partner settlements)
- **Change security settings** (disable biometrics, change password)
- **Approve large payouts** (contractor commissions > $1,000)
- **Modify user permissions** (grant admin access)

---

## 📖 How to Use

### Basic Usage
```typescript
import { useAuth } from "./App";

function DangerousActionScreen() {
  const { requireBiometricAuth } = useAuth();

  const handleDeleteStation = async (stationId: string) => {
    // Require biometric re-authentication
    const confirmed = await requireBiometricAuth("Delete K9000 Station");
    
    if (!confirmed) {
      Alert.alert("Canceled", "You must authenticate to delete a station");
      return;
    }

    // User successfully authenticated - proceed with deletion
    try {
      await api.delete(`/stations/${stationId}`);
      Alert.alert("Success", "Station deleted successfully");
    } catch (err) {
      Alert.alert("Error", "Failed to delete station");
    }
  };

  return (
    <Button title="Delete Station" onPress={() => handleDeleteStation("st_123")} />
  );
}
```

---

## 🎯 Real-World Examples

### Example 1: Delete K9000 Station
```typescript
const handleDeleteStation = async (stationId: string) => {
  const confirmed = await requireBiometricAuth("Delete K9000 Station");
  
  if (confirmed) {
    await api.delete(`/stations/${stationId}`);
    navigation.goBack();
  }
};
```

### Example 2: Change Revenue Share Percentage
```typescript
const handleUpdateRevenueShare = async (partnerId: string, newPercentage: number) => {
  const confirmed = await requireBiometricAuth(
    `Change revenue share to ${newPercentage}%`
  );
  
  if (confirmed) {
    await api.patch(`/partners/${partnerId}`, {
      revenueSharePercentage: newPercentage,
    });
    Alert.alert("Success", "Revenue share updated");
  }
};
```

### Example 3: Approve Large Contractor Payout
```typescript
const handleApprovePayout = async (payoutId: string, amount: number) => {
  if (amount > 1000) {
    // Require biometric for payouts over $1,000
    const confirmed = await requireBiometricAuth(
      `Approve payout of ₪${amount.toFixed(2)}`
    );
    
    if (!confirmed) return;
  }

  await api.post(`/payouts/${payoutId}/approve`);
  Alert.alert("Success", "Payout approved");
};
```

### Example 4: Grant Admin Access
```typescript
const handleGrantAdminAccess = async (userId: string) => {
  const confirmed = await requireBiometricAuth(
    "Grant admin access to user"
  );
  
  if (confirmed) {
    await api.post(`/users/${userId}/roles`, {
      role: "admin",
    });
    Alert.alert("Success", "Admin access granted");
  }
};
```

### Example 5: Disable Biometric Login
```typescript
const handleDisableBiometrics = async () => {
  const confirmed = await requireBiometricAuth(
    "Disable biometric login"
  );
  
  if (confirmed) {
    await SecureStore.deleteItemAsync(SECURE_BIOMETRICS_ENABLED_KEY);
    Alert.alert("Success", "Biometric login disabled");
  }
};
```

---

## 🔧 Advanced: Custom Prompts

You can customize the biometric prompt message:

```typescript
const controller = BiometricsAuthController.getInstance();

const result = await LocalAuthentication.authenticateAsync({
  promptMessage: "Authenticate to delete station",
  cancelLabel: "Cancel",
  fallbackLabel: "Use password instead",
  disableDeviceFallback: false, // Allow password fallback
});

if (result.success) {
  // Proceed with action
}
```

---

## 📋 Best Practices

### 1. Use Descriptive Action Names
✅ **Good:** `"Delete K9000 Station #42"`  
❌ **Bad:** `"Confirm action"`

### 2. Don't Overuse
Only require re-authentication for truly sensitive actions. Don't annoy users.

✅ **Use for:**
- Delete station
- Change revenue share
- Approve payout > $1,000
- Grant admin access

❌ **Don't use for:**
- View station details
- Mark task as complete
- Update task notes
- Filter task list

### 3. Handle Cancellation Gracefully
```typescript
const confirmed = await requireBiometricAuth("Delete Station");

if (!confirmed) {
  // User canceled - show friendly message
  Alert.alert("Canceled", "Station was not deleted");
  return; // Don't proceed
}

// User confirmed - proceed with action
await api.delete(`/stations/${stationId}`);
```

### 4. Combine with Backend Validation
```typescript
// Frontend: Require biometric
const confirmed = await requireBiometricAuth("Delete Station");

if (!confirmed) return;

// Backend: Also check permissions
router.delete("/stations/:id", requireAuth, checkPermission("stations.delete"), async (req, res) => {
  // Delete station
  // Log action in audit trail
});
```

---

## 🛡️ Security Considerations

### What This Protects Against
✅ Accidental taps (user didn't mean to delete)  
✅ Malicious apps reading screen content  
✅ Shoulder surfing (someone watching over your shoulder)  

### What This Does NOT Protect Against
❌ Malware with root/jailbreak access  
❌ Backend vulnerabilities  
❌ Stolen device with biometric data (use device encryption)  

### Defense in Depth
Always combine mobile biometric re-auth with:
1. **Backend permission checks** - Verify user has permission
2. **Audit logging** - Log who did what and when
3. **Rate limiting** - Prevent brute force
4. **Multi-factor auth** - For super-critical actions

---

## 🧪 Testing High-Risk Actions

### Test on Real Device
1. Open app and login
2. Navigate to high-risk action (e.g., Delete Station)
3. Tap action button
4. Face ID / fingerprint prompt should appear
5. Cancel → action should abort
6. Authenticate → action should proceed

### Test Fallback (No Biometrics)
1. Disable biometrics on device (Settings → Face ID)
2. Open app and login
3. Tap high-risk action
4. Should show password prompt or "Cancel" alert

---

## 📊 Analytics & Monitoring

Track high-risk action attempts:

```typescript
const handleDeleteStation = async (stationId: string) => {
  const confirmed = await requireBiometricAuth("Delete K9000 Station");
  
  if (!confirmed) {
    // Log canceled attempt
    analytics.track("high_risk_action_canceled", {
      action: "delete_station",
      stationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Log successful authentication
  analytics.track("high_risk_action_approved", {
    action: "delete_station",
    stationId,
    timestamp: new Date().toISOString(),
  });

  await api.delete(`/stations/${stationId}`);
};
```

---

## 🔗 Integration with Backend Audit Trail

Backend should log high-risk actions:

```typescript
// Backend route
router.delete("/stations/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { user } = req;

  // Log in audit trail
  await db.insert(auditLogs).values({
    userId: user.id,
    action: "DELETE_STATION",
    resourceType: "station",
    resourceId: id,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    metadata: { stationId: id },
  });

  // Delete station
  await db.delete(stations).where(eq(stations.id, id));

  res.json({ success: true });
});
```

---

## 📞 Support

For questions about implementing high-risk actions:
- Review this guide
- Check `App.tsx` for `requireBiometricForHighRiskAction()` implementation
- Test on real device (biometrics don't work in simulators)

---

© 2025 Pet Wash™. All rights reserved.
