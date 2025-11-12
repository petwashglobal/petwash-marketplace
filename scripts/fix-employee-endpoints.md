# Fixing Employee Endpoints - Path Migration

## Problem
All employee management endpoints are using the old Firestore path:
- **OLD:** `users/{uid}/employee/profile`
- **NEW:** `employees/{uid}`

Also need to change:
- **OLD:** `status: 'active' | 'suspended' | 'inactive'`
- **NEW:** `isActive: true | false`

## Endpoints to Fix
1. ✅ POST /api/employees - Create employee (FIXED)
2. ❌ GET /api/employees/:uid - Get employee
3. ❌ PUT /api/employees/:uid - Update employee
4. ❌ POST /api/employees/:uid/suspend - Suspend employee
5. ❌ POST /api/employees/:uid/activate - Activate employee
6. ❌ POST /api/employees/:uid/send-invite - Send password email
7. ❌ POST /api/employees/:uid/generate-mobile-link - Generate one-tap link
8. ❌ DELETE /api/employees/:uid - Delete employee

## Changes Needed
- Change all `db.collection('users').doc(uid).collection('employee').doc('profile')` 
  to `db.collection('employees').doc(uid)`
- Change `status: 'active'` to `isActive: true`
- Change `status: 'suspended'` to `isActive: false`
- Change `status: 'inactive'` to `isActive: false`
