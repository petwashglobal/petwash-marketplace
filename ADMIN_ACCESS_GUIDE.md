# 🔐 Admin Access Guide - Pet Wash™

**Date:** October 28, 2025  
**Status:** Role-Based Access Control (RBAC) Implemented

---

## 👥 USER ROLES

### 1. **Full Admin** (Can Create, Edit, Delete)

**Users:**
- ✅ **nirhadad1@gmail.com** - CEO (Gmail)
- ✅ **nir.h@petwash.co.il** - CEO (Official)
- ✅ **admin@petwash.co.il** - General Admin
- ✅ **support@petwash.co.il** - Support Admin

**Permissions:**
- ✅ View all data and analytics
- ✅ Create campaigns, broadcasts, assets
- ✅ Edit user data, vouchers, KYC
- ✅ Delete records
- ✅ Manage team members
- ✅ Send broadcast messages
- ✅ Access all admin routes

---

### 2. **Viewer** (Read-Only Access)

**Users:**
- 👀 **ido.s@petwash.co.il** - Technical Lead (Viewer)
- 👀 **avner9000@gmail.com** - Team Member (Viewer)
- 👀 **shiri.shakarzi1@gmail.com** - Team Member (Viewer)

**Permissions:**
- ✅ View dashboard statistics
- ✅ View analytics and reports
- ✅ View revenue data
- ✅ View station performance
- ✅ View user lists
- ✅ View system logs
- ❌ **CANNOT** create, edit, or delete anything
- ❌ **CANNOT** send broadcasts
- ❌ **CANNOT** modify campaigns
- ❌ **CANNOT** manage users

---

## 🚪 HOW TO ACCESS ADMIN DASHBOARD

### Step 1: Navigate to Admin Login
```
https://petwash.co.il/admin/login
```

### Step 2: Sign In with Your Email
- Use your Pet Wash™ email address
- Sign in via Firebase Authentication

### Step 3: Access Dashboard
```
https://petwash.co.il/admin
```

**Full Admins See:**
- Premium analytics dashboard
- Full control panel
- Create/Edit buttons enabled

**Viewers See:**
- Same dashboard (read-only)
- View-only analytics
- Create/Edit buttons disabled or hidden

---

## 📊 AVAILABLE ADMIN PAGES

| Page | URL | Full Admin | Viewer |
|------|-----|------------|--------|
| Dashboard | `/admin` | ✅ Full Access | 👀 Read-Only |
| Analytics | `/admin` (analytics tab) | ✅ Full Access | 👀 Read-Only |
| Stations | `/admin/stations` | ✅ Full Access | 👀 Read-Only |
| Users | `/admin/users` | ✅ Full Access | 👀 View List |
| Vouchers | `/admin/vouchers` | ✅ Full Access | 👀 View List |
| Financial | `/admin/financial` | ✅ Full Access | 👀 Read-Only |
| KYC | `/admin/kyc` | ✅ Full Access | 👀 View List |
| System Logs | `/admin/logs` | ✅ Full Access | 👀 Read-Only |
| Inbox | `/admin/inbox` | ✅ Full Access | 👀 Read Messages |
| Security | `/admin/security` | ✅ Full Access | 👀 Read-Only |
| Team | `/admin/team` | ✅ Manage Team | 👀 View Team |

---

## 🔒 API ENDPOINTS ACCESS

### Viewer-Accessible (GET only):

```typescript
GET /api/admin/dashboard/stats        // Dashboard statistics
GET /api/admin/analytics/overview     // Analytics overview
GET /api/admin/analytics/revenue      // Revenue time series
GET /api/admin/analytics/stations     // Station performance
GET /api/admin/user-info              // Current user info & permissions
GET /api/admin/campaigns              // View campaigns
GET /api/admin/marketing/assets       // View marketing assets
GET /api/admin/logs                   // View system logs
```

**Response for Viewers:** ✅ 200 OK (data returned)

---

### Admin-Only (POST/PATCH/DELETE):

```typescript
POST   /api/admin/broadcast/users          // Send user broadcasts
POST   /api/admin/broadcast/franchises     // Send franchise broadcasts
POST   /api/admin/campaigns                // Create campaigns
POST   /api/admin/campaigns/:id/start      // Start campaigns
POST   /api/admin/campaigns/:id/stop       // Stop campaigns
PATCH  /api/admin/campaigns/:id/metrics    // Update campaign metrics
POST   /api/admin/marketing/assets         // Upload marketing assets
DELETE /api/admin/users/:id                // Delete users
POST   /api/admin/vouchers/create          // Create vouchers
```

**Response for Viewers:** ❌ 403 Forbidden
```json
{
  "error": "Full admin access required",
  "message": "This action requires administrator privileges. Viewers have read-only access."
}
```

---

## 💡 CHECKING YOUR PERMISSIONS

### Frontend Check:
```typescript
// Call this API to see your role
GET /api/admin/user-info

// Response:
{
  "success": true,
  "user": {
    "email": "ido.s@petwash.co.il",
    "role": "viewer",  // or "admin"
    "permissions": {
      "canView": true,
      "canEdit": false,  // true for admins
      "canDelete": false,
      "canCreate": false,
      "canManageUsers": false
    }
  }
}
```

### Backend Middleware:
```typescript
// Two middleware functions:

1. requireAdminOrViewer  // Allows both admins and viewers
2. requireAdmin          // Only allows full admins
```

---

## 🎯 PERMISSION MATRIX

| Action | Full Admin | Viewer |
|--------|-----------|--------|
| **View Dashboard** | ✅ | ✅ |
| **View Analytics** | ✅ | ✅ |
| **View Users** | ✅ | ✅ |
| **Create Users** | ✅ | ❌ |
| **Edit Users** | ✅ | ❌ |
| **Delete Users** | ✅ | ❌ |
| **View Vouchers** | ✅ | ✅ |
| **Create Vouchers** | ✅ | ❌ |
| **View Campaigns** | ✅ | ✅ |
| **Create Campaigns** | ✅ | ❌ |
| **Send Broadcasts** | ✅ | ❌ |
| **View Logs** | ✅ | ✅ |
| **Manage Team** | ✅ | ❌ |

---

## 🚀 QUICK START FOR NEW ADMINS/VIEWERS

### For Nir (CEO - Full Admin):
1. Go to https://petwash.co.il/admin/login
2. Sign in with **nirhadad1@gmail.com** or **nir.h@petwash.co.il**
3. Full access to all features ✅

### For Ido, Avner, Shiri (Viewers):
1. Go to https://petwash.co.il/admin/login
2. Sign in with your petwash.co.il or gmail.com email
3. Dashboard opens in **read-only mode** 👀
4. You can view all data but cannot modify anything

---

## 🔄 UPGRADING VIEWER TO ADMIN

**Current Process (Manual):**

Edit `server/routes/admin.ts`:

```typescript
// Move email from viewer list to fullAdmin list
const ADMIN_ROLES = {
  fullAdmin: [
    'nirhadad1@gmail.com',
    'nir.h@petwash.co.il',
    'ido.s@petwash.co.il',  // ← Move here to upgrade
    // ... rest
  ],
  viewer: [
    // 'ido.s@petwash.co.il',  // ← Remove from here
    'avner9000@gmail.com',
    'shiri.shakarzi1@gmail.com',
  ]
};
```

**Future Enhancement:**
- Admin management UI at `/admin/team-management`
- Firestore-based role storage
- Firebase custom claims for roles

---

## ⚠️ SECURITY NOTES

1. **Viewers cannot escalate privileges** - Backend validation prevents any modifications
2. **All admin routes protected** - Firebase authentication + role check
3. **Audit logging** - All admin actions logged to Firestore
4. **Session-based** - Admin sessions expire after inactivity
5. **Email verification** - Only verified emails can access admin panel

---

## 📞 SUPPORT

**If you can't access the admin dashboard:**

1. Check your email is in the authorized list
2. Make sure you're signed in with the correct email
3. Clear browser cache and try again
4. Contact: nir.h@petwash.co.il (CEO)

**If you need permission changes:**

Only Nir (CEO) can modify admin permissions by updating the code or requesting developer assistance.

---

## 🎉 SUMMARY

**Current Setup:**

✅ **4 Full Admins** - Nir (2 emails), admin@, support@  
👀 **3 Viewers** - Ido, Avner, Shiri  
🔒 **Role-Based Access Control** - Working perfectly  
📊 **All Dashboard Features** - Available to all (read-only for viewers)  
🚀 **Ready for November 7, 2025 launch**  

---

🐾 **Pet Wash™** - Secure Admin Access  
**Enterprise-Grade Permissions System**
