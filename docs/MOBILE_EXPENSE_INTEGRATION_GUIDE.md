# 📱 Mobile Expense Management Integration Guide
## Connecting React Native App to PetWash™ Octopus Structure

---

## 🚨 **CRITICAL: DON'T CREATE SEPARATE BACKEND!**

**Your standalone Express/PostgreSQL backend should NOT be deployed separately.**  
Instead, integrate with PetWash's existing `/api/expenses` routes to leverage:

- ✅ Google Vision OCR for receipt scanning
- ✅ Auto-approval workflows with Israeli Tax compliance
- ✅ WhatsApp notifications via Meta Business API
- ✅ Cryptographic audit trail for GDPR
- ✅ Comprehensive schema with 20+ fields (vs. your 4 fields)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│          React Native Mobile App (Your Frontend)            │
│                                                               │
│  - Capture receipt photo                                     │
│  - Submit expense form                                        │
│  - View approval status                                       │
└──────────────┬────────────────────────────────────────────────┘
               │
               │ HTTP POST with Firebase ID Token
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│      PetWash™ Backend (server/routes/expenses.ts)           │
│                                                               │
│  ✅ Firebase Auth middleware validates token                 │
│  ✅ Extracts userId from Firebase claims                     │
│  ✅ OCR scans receipt with Google Vision                     │
│  ✅ Auto-approves <200 ILS expenses                          │
│  ✅ Sends WhatsApp notification on approval                  │
│  ✅ Stores in rich PostgreSQL schema                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Integration

### **Step 1: Install Firebase in React Native App**

```bash
npm install @react-native-firebase/app @react-native-firebase/auth
```

### **Step 2: Configure Firebase Authentication**

```javascript
// App.js (React Native)
import auth from '@react-native-firebase/auth';

// Sign in user (you may already have this)
const signIn = async (email, password) => {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  const idToken = await userCredential.user.getIdToken();
  
  // Store token for API calls
  await AsyncStorage.setItem('firebaseToken', idToken);
};
```

### **Step 3: Create Expense Submission Function**

**REPLACE your current `/expenses` POST with this:**

```javascript
// services/expenseService.js (React Native)
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://petwash.co.il'; // Your Replit deployment URL

export async function submitExpense(expenseData) {
  // Get Firebase ID token
  const token = await AsyncStorage.getItem('firebaseToken');
  
  if (!token) {
    throw new Error('User not authenticated');
  }

  // Create FormData for multipart upload (receipt photo)
  const formData = new FormData();
  formData.append('category', expenseData.category);
  formData.append('description', expenseData.description);
  formData.append('amount', expenseData.amount.toString());
  formData.append('currency', 'ILS');
  
  // Attach receipt photo (if available)
  if (expenseData.receiptUri) {
    formData.append('receipt', {
      uri: expenseData.receiptUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    });
  }

  // Call PetWash backend (NOT your standalone server!)
  const response = await fetch(`${API_BASE_URL}/api/expenses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`, // Firebase ID token
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit expense');
  }

  return await response.json();
}
```

### **Step 4: Fetch User's Expenses**

```javascript
// services/expenseService.js (continued)
export async function getMyExpenses() {
  const token = await AsyncStorage.getItem('firebaseToken');
  
  const response = await fetch(`${API_BASE_URL}/api/expenses/my-expenses`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch expenses');
  }

  return await response.json();
}
```

### **Step 5: Update Your React Native UI**

**REPLACE your current expense form:**

```javascript
// screens/NewExpenseScreen.js (React Native)
import React, { useState } from 'react';
import { View, TextInput, Button, Image, Alert } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { submitExpense } from '../services/expenseService';

export default function NewExpenseScreen() {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptUri, setReceiptUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const captureReceipt = () => {
    launchCamera({ mediaType: 'photo' }, (response) => {
      if (response.assets && response.assets[0]) {
        setReceiptUri(response.assets[0].uri);
      }
    });
  };

  const handleSubmit = async () => {
    if (!category || !description || !amount) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await submitExpense({
        category,
        description,
        amount: parseFloat(amount),
        receiptUri,
      });

      Alert.alert('Success', result.message || 'Expense submitted for approval');
      
      // Navigate back or reset form
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="Category (e.g., Meals, Transport)"
        value={category}
        onChangeText={setCategory}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="Amount (ILS)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <Button title="Capture Receipt" onPress={captureReceipt} />
      
      {receiptUri && <Image source={{ uri: receiptUri }} style={{ width: 200, height: 200, marginVertical: 10 }} />}
      
      <Button
        title={loading ? "Submitting..." : "Submit Expense"}
        onPress={handleSubmit}
        disabled={loading}
      />
    </View>
  );
}
```

---

## 🔐 Backend Authentication (Already Implemented)

PetWash backend automatically validates Firebase tokens:

```typescript
// server/customAuth.ts (ALREADY EXISTS - NO CHANGES NEEDED)
export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

## 📊 Data Mapping (Simple → Rich Schema)

**Your Simple Schema:**
```sql
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  category VARCHAR,
  description VARCHAR,
  amount DECIMAL,
  status VARCHAR DEFAULT 'Pending'
);
```

**PetWash Rich Schema (Automatic Mapping):**
```typescript
{
  id: nanoid(),
  userId: req.user.uid,              // From Firebase token
  employeeId: req.user.uid,          // Same as userId for employees
  category: req.body.category,       // Your input
  description: req.body.description, // Your input
  amount: req.body.amount.toString(),// Your input
  currency: 'ILS',                   // Israeli Shekel
  receiptUrl: uploadedFileUrl,       // From uploaded photo
  ocrData: visionApiResults,         // Google Vision OCR
  approvalStatus: autoApproved ? 'approved' : 'pending',
  approvedBy: autoApproved ? 'SYSTEM' : null,
  taxCategory: 'business_expense',
  vatAmount: calculateVAT(amount),
  auditSignature: generateSignature(), // Cryptographic hash
  createdAt: new Date(),
}
```

---

## ✅ What Happens Automatically

1. **OCR Scanning**: Receipt photo → Google Vision API → Extracted amounts/dates
2. **Auto-Approval**: Expenses <200 ILS auto-approved instantly
3. **WhatsApp Notification**: Employee gets notification when approved/rejected
4. **Israeli Tax Compliance**: VAT calculated, tax categories assigned
5. **Audit Trail**: Cryptographic signature for tamper-proof records

---

## 🔄 Migration Checklist

- [ ] Install Firebase in React Native app
- [ ] Replace `/expenses` calls with `/api/expenses` (PetWash backend)
- [ ] Add `Authorization: Bearer <firebaseToken>` header to all requests
- [ ] Remove standalone Express backend code (index.js)
- [ ] Test expense submission with receipt photo upload
- [ ] Test expense listing for authenticated user
- [ ] **DELETE** your standalone PostgreSQL database setup

---

## 🚀 Deployment URL

Once Nayax keys are added, your full app will deploy to:
```
https://petwash.co.il
```

Mobile app should call:
```
POST https://petwash.co.il/api/expenses
GET  https://petwash.co.il/api/expenses/my-expenses
```

---

## 📞 Need Help?

The PetWash backend already has complete expense management:
- **File**: `server/routes/expenses.ts`
- **Schema**: `shared/schema.ts` (search for `expenses` table)
- **Auth**: `server/customAuth.ts` (Firebase verification)

**No need to build a separate backend!** 🎉

