# Pet Wash™ Admin Quick Start Guide
**Last Updated:** October 20, 2025

---

## 1. Admin Login Instructions

### Admin Login Page
**URL:** https://petwash.co.il/admin/login

### Admin Credentials (Nir Hadad)
- **Email:** `nirhadad1@gmail.com`
- **Password:** `PetWash2025!`
- **Role:** Admin (Full System Access)

### How to Login with Password

**Step 1:** Navigate to the admin login page
- Open your browser and go to: `https://petwash.co.il/admin/login`

**Step 2:** Enter your credentials
- **Email field:** Type `nirhadad1@gmail.com` (exact spelling, no spaces)
- **Password field:** Type `PetWash2025!` (case-sensitive: capital P, capital W, exclamation mark at end)

**Step 3:** Sign in
- Click the blue "Sign In" button
- Wait for the authentication process (usually 1-2 seconds)

**Step 4:** Verification
- The system will verify you have admin access
- You'll be redirected to `/admin/users` (Employee Management page)
- You should see the session cookie `pw_session` created

### Session Cookie Verification

**How to check if you're logged in:**
1. Open browser Developer Tools (F12 or Right-click → Inspect)
2. Go to "Application" tab (Chrome/Edge) or "Storage" tab (Firefox)
3. Look under "Cookies" → `https://petwash.co.il`
4. Find cookie named: `pw_session`
5. It should have:
   - **Domain:** `.petwash.co.il`
   - **Expires:** 5 days from login
   - **HttpOnly:** Yes
   - **Secure:** Yes
   - **SameSite:** None

### Password Reset

**If you forgot your password:**
1. **Option A - Firebase Console** (for developers):
   - Go to Firebase Console → Authentication
   - Find user: `nirhadad1@gmail.com`
   - Click three dots → "Reset password"
   - Check your email for reset link

2. **Option B - Contact Support**:
   - Email: `Support@PetWash.co.il`
   - Subject: "Admin Password Reset Request"
   - Include your email address

### Troubleshooting Login Issues

**Issue: "Invalid email or password"**
- Double-check spelling: `nirhadad1@gmail.com`
- Verify password: `PetWash2025!` (case-sensitive)
- Try copying and pasting from this guide
- Clear browser cache and cookies, then retry

**Issue: "This account does not have admin access"**
- Your Firestore employee profile may be missing
- Contact technical support to verify your role in: `employees/{uid}`
- Should have `role: "admin"` and `status: "active"`

**Issue: "Verifying admin access..." stuck**
- Check browser console (F12) for errors
- Look for network errors in Network tab
- Verify you have stable internet connection
- Try refreshing the page

**Issue: "Too many failed attempts"**
- Firebase blocks login after multiple failures
- Wait 15 minutes before retrying
- Or reset your password (see above)

---

## 2. Employee Management

### Accessing Employee Management

After logging in successfully, you'll automatically be redirected to:
**URL:** https://petwash.co.il/admin/users

This is the main Employee Management dashboard where you can:
- View all registered employees
- Add new employees
- Manage employee roles and permissions
- Suspend or reactivate accounts
- Send password reset emails
- Generate mobile login links

### How to Add a New Employee

**Step 1:** Click the "+ Add Employee" button
- Located in the **top-right corner** of the page
- Blue button with a plus icon
- Button text: "+ Add Employee" (English) or "הוסף עובד" (Hebrew)

**Step 2:** Fill out the employee registration form

**Required Fields:**

1. **Full Name** ✅
   - Example: "Sarah Cohen"
   - Used for display throughout the system

2. **Email** ✅
   - Example: "sarah@petwash.co.il"
   - Must be a valid email address
   - This will be their login username
   - Must be unique (no duplicates)

3. **Role** ✅ (Select one)
   - **Admin** - Full system access, can manage all employees and settings
   - **Ops Manager** - Operations management, reporting, station oversight
   - **Station Manager** - Manage specific stations, inventory, schedules
   - **Maintenance Tech** - Field technician, maintenance work, mobile PWA access
   - **Support/CRM** - Customer support, CRM access, inbox management

**Optional Fields:**

4. **Phone**
   - Example: "050-123-4567"
   - Used for SMS notifications (if enabled)
   - Displayed in employee profile

5. **Assigned Stations**
   - Select which stations this employee manages
   - Relevant for: Station Managers, Maintenance Techs
   - Leave empty for Admins and Ops Managers

6. **Employee ID**
   - Internal employee number
   - Example: "EMP-001"
   - For your own tracking purposes

7. **Notes**
   - Any additional information
   - Example: "Works Monday-Friday, 9 AM - 5 PM"
   - Visible only to admins

**Step 3:** Submit the form
- Click the "Add Employee" button at bottom of dialog
- The system will automatically:
  - ✅ Create a Firebase Authentication account
  - ✅ Generate a secure temporary password
  - ✅ Store employee profile in Firestore (`employees/{uid}`)
  - ✅ Send password setup email to the employee
  - ✅ Set initial status to "active"

**Step 4:** Employee receives email
- The new employee gets an automated email
- Email subject: "Welcome to Pet Wash™ Team"
- Contains:
  - Their login email address
  - Link to set their password
  - Instructions for first login
  - Expires in 24 hours

### Employee List Table

After adding employees, you'll see them in the table with columns:

| Column | Description |
|--------|-------------|
| **Name** | Employee full name |
| **Email** | Login email address |
| **Role** | Badge showing role (Admin, Ops, Manager, etc.) |
| **Status** | Badge showing status (Active, Suspended, Inactive) |
| **Last Login** | Date of most recent login, or "Never" |
| **Actions** | Quick action buttons (see below) |

### Employee Actions

For each employee in the table, you can perform these actions:

#### 📧 Send Invite Email
- **Icon:** Mail envelope
- **Purpose:** Resend the password setup email
- **Use case:** 
  - Employee didn't receive original email
  - Password reset link expired
  - New email after account reactivation
- **How to use:** Click the mail icon in the Actions column

#### 🔗 Generate Mobile Login Link
- **Icon:** Link/Chain
- **Purpose:** Create a one-tap login link for mobile devices
- **Use case:**
  - Field technicians need quick access to mobile PWA
  - No need to remember password
  - Link expires after use or 5 minutes
- **How to use:** 
  1. Click the link icon in the Actions column
  2. Link is automatically copied to clipboard
  3. Send link via WhatsApp, SMS, or Email
  4. Employee taps link on mobile → instant login
- **Note:** Only works for "active" employees

#### 🚫 Suspend Employee
- **Icon:** Ban/Prohibition symbol
- **Purpose:** Temporarily disable access without deleting account
- **Use case:**
  - Employee on leave
  - Security concern
  - Contract ended (temporarily)
- **How to use:** Click the ban icon → Confirm suspension
- **Effect:**
  - Status changes to "Suspended"
  - Cannot login (even with correct password)
  - All active sessions invalidated immediately
  - Can be reactivated later

#### ✅ Activate Employee
- **Icon:** Check circle
- **Purpose:** Re-enable a suspended account
- **Use case:** Employee returns from leave or issue resolved
- **How to use:** Click the check icon → Account immediately active
- **Effect:**
  - Status changes to "Active"
  - Can login normally
  - Receives reactivation email

### Role Permissions Overview

| Role | Access Level | Capabilities |
|------|-------------|--------------|
| **Admin** | Full System | • Manage all employees<br>• Access all admin pages<br>• Configure system settings<br>• View all reports<br>• Manage stations and inventory |
| **Ops Manager** | Operations | • View all stations<br>• Generate reports<br>• Monitor performance<br>• Manage customer issues<br>• Cannot add/remove employees |
| **Station Manager** | Station-specific | • Manage assigned stations only<br>• Track inventory<br>• View station reports<br>• Handle maintenance requests |
| **Maintenance Tech** | Field Work | • Mobile PWA access<br>• Station maintenance logs<br>• Inventory updates<br>• QR code station access |
| **Support/CRM** | Customer Service | • Customer inbox<br>• Pet profiles<br>• Appointment management<br>• Basic reporting |

---

## 3. Troubleshooting Section

### Common Login Errors

#### Error: "Invalid email or password"
**Cause:** Incorrect credentials  
**Solution:**
1. Verify email: `nirhadad1@gmail.com` (no typos)
2. Verify password: `PetWash2025!` (case-sensitive)
3. Copy-paste from this guide to avoid typos
4. Try typing in Notepad first, then copy

#### Error: "This account does not have admin access"
**Cause:** Employee profile missing or wrong role  
**Solution:**
1. Check Firestore: `employees/{your-uid}`
2. Verify `role: "admin"` exists
3. Verify `status: "active"`
4. Contact technical support if missing

#### Error: "Too many failed attempts"
**Cause:** Firebase rate limiting after 5+ failed logins  
**Solution:**
1. Wait 15 minutes
2. OR reset your password
3. OR try passkey login (Face ID/Touch ID)

#### Error: "Network request failed"
**Cause:** Internet connectivity or CORS issue  
**Solution:**
1. Check your internet connection
2. Try different network (WiFi vs mobile data)
3. Disable VPN if active
4. Check browser console for specific error

### Browser Console Checks

**How to check browser console for errors:**

1. **Open Developer Tools:**
   - **Chrome/Edge:** Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox:** Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - **Safari:** Enable Developer menu first, then `Cmd+Option+C`

2. **Go to Console Tab:**
   - Look for red error messages
   - Look for messages starting with `[AdminLogin]`

3. **Common error messages:**
   - `auth/wrong-password` → Check password spelling
   - `auth/user-not-found` → Check email spelling
   - `auth/network-request-failed` → Check internet connection
   - `Failed to create session` → Server issue, contact support

### Clear Browser Cache and Cookies

**Chrome/Edge:**
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "All time" time range
3. Check "Cookies" and "Cached images and files"
4. Click "Clear data"
5. Restart browser

**Safari (Mac):**
1. Safari menu → Preferences → Privacy
2. Click "Manage Website Data"
3. Search for "petwash.co.il"
4. Click "Remove"
5. Restart Safari

**Safari (iPhone/iPad):**
1. Settings → Safari
2. Scroll down → "Clear History and Website Data"
3. Confirm
4. Reopen Safari

**Chrome (Android):**
1. Chrome menu (⋮) → Settings
2. Privacy and Security → Clear browsing data
3. Select "All time"
4. Check "Cookies" and "Cached images"
5. Tap "Clear data"

### Verify pw_session Cookie

**Chrome/Edge/Firefox:**
1. Open Developer Tools (F12)
2. Go to "Application" tab (Chrome/Edge) or "Storage" tab (Firefox)
3. Expand "Cookies" in left sidebar
4. Click on `https://petwash.co.il`
5. Look for cookie: `pw_session`
6. Check values:
   - Domain: `.petwash.co.il` ✅
   - Path: `/` ✅
   - Expires: (date 5 days in future) ✅
   - HttpOnly: ✅ (checkmark)
   - Secure: ✅ (checkmark)
   - SameSite: None ✅

**If cookie is missing or incorrect:**
- Try logging out and logging in again
- Clear all cookies for petwash.co.il
- Check browser console for session creation errors

### Mobile Login Behavior

**iPhone (Safari):**
- Face ID prompt appears automatically
- Touch ID if no Face ID available
- Session cookie saved properly
- Redirects to dashboard after success

**Android (Chrome):**
- Fingerprint prompt appears
- Face unlock if supported
- Session cookie saved properly
- May need to allow cookies in settings

**Mobile-Specific Issues:**
- Private/Incognito mode blocks cookies → Use normal mode
- "Block all cookies" setting → Change to "Allow from visited sites"
- Low storage → Clear cache to make room for cookies

### FAQ: "Verifying admin access..." Stuck

**Symptoms:**
- Login screen shows loading spinner
- Message: "Verifying admin access..."
- Never completes

**Solution:**
1. **Check network:** Open Network tab in Dev Tools, look for failed requests to `/api/auth/me`
2. **Check console:** Look for JavaScript errors
3. **Check Firestore:**
   - Does `employees/{uid}` document exist?
   - Does it have `role: "admin"` or `role: "ops"`?
4. **Hard refresh:** Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
5. **Clear cookies and retry**

### FAQ: Password Rejected

**Why it happens:**
- Typo in password (common: lowercase 'p' or missing '!')
- Caps Lock is on
- Password was changed but you're using old password
- Account doesn't exist in Firebase

**How to fix:**
1. Type password in Notepad/Notes app first to see it clearly
2. Verify each character: `P-e-t-W-a-s-h-2-0-2-5-!`
3. Copy-paste from this guide
4. If still fails, reset password via Firebase Console
5. If reset fails, contact support

### FAQ: Employee Not Appearing in Table

**Why it happens:**
- Page not refreshed after adding
- Employee created in wrong Firestore location
- Browser cache showing old data
- Filter is active (if filters exist)

**How to fix:**
1. **Refresh the page:** Press F5 or click browser refresh button
2. **Hard refresh:** Press `Ctrl+Shift+R` (clears cache)
3. **Check Firestore directly:**
   - Firebase Console → Firestore Database
   - Collection: `employees`
   - Look for document with employee's email
4. **Check browser console for errors** when loading employee list
5. If employee exists in Firestore but not showing, contact support

---

## 4. Passkey Integration (Biometric Login)

### What is Passkey Login?

Passkeys allow you to login using:
- **Face ID** (iPhone, iPad, MacBook with Face ID)
- **Touch ID** (iPhone, iPad, MacBook with Touch Bar)
- **Windows Hello** (Windows laptops with fingerprint or face recognition)
- **Android Fingerprint/Face Unlock**

**Benefits:**
- ✅ No password to remember
- ✅ Faster login (1-2 seconds)
- ✅ More secure (biometric verification)
- ✅ Works offline (after initial setup)

### How to Enable Biometric Login

**Step 1: Login with password first**
- Go to `https://petwash.co.il/admin/login`
- Login with email and password (see section 1)

**Step 2: Register a passkey**
- After logging in, go to: `https://petwash.co.il/my-devices`
- OR click your profile → "My Devices" (if available)
- Click "Register New Passkey" button
- Your device will prompt:
  - **iPhone/iPad:** "Use Face ID / Touch ID for Pet Wash™?"
  - **Mac:** "Touch ID prompt"
  - **Windows:** "Windows Hello prompt"
  - **Android:** "Use fingerprint?"
- Authenticate with your biometric
- Passkey is now saved!

**Step 3: Test passkey login**
- Logout completely
- Go back to `/admin/login`
- Click "Use Passkey" button (blue button with fingerprint icon)
- Your device prompts for biometric
- Authenticate → Instant login! ✅

### How to Use "Sign in with Passkey" Button

**Location:** Admin login page (`/admin/login`)

**Button appearance:**
- Blue button with fingerprint icon 🔐
- Text: "Use Passkey" or shows biometric method name
  - "Sign in with Face ID" (iPhone with Face ID)
  - "Sign in with Touch ID" (Mac with Touch Bar)
  - "Sign in with Windows Hello" (Windows PC)

**How to use:**
1. Click the "Use Passkey" button
2. Browser shows: "Choose a passkey to sign in to Pet Wash™"
3. Select your saved passkey (usually only one option)
4. Device prompts for biometric authentication
5. Authenticate (Face ID, Touch ID, etc.)
6. Instant redirect to `/admin/users` ✅

**Troubleshooting passkey:**
- **Button doesn't appear:** Browser doesn't support WebAuthn (upgrade browser)
- **"No passkeys available":** You haven't registered a passkey yet (see Step 2 above)
- **Authentication fails:** Try registering a new passkey
- **Want to remove passkey:** Go to `/my-devices` and click "Revoke" button

### Managing Your Passkeys

**View registered passkeys:**
- Go to: `https://petwash.co.il/my-devices`
- You'll see a list of all devices where you've registered passkeys

**Each passkey shows:**
- Device type: "Cloud-synced passkey" or "This device only"
- Created date
- Last used date
- Browser/platform information

**Revoke a passkey:**
- Click the "Revoke" button next to any passkey
- Confirm revocation
- That device can no longer use passkey login
- Can register a new passkey anytime

---

## 5. Security & Support

### Session Security

**Session Cookie (`pw_session`):**
- **Lifetime:** 5 days (432,000,000 milliseconds)
- **Auto-renewal:** Session renews on each request
- **Expiration:** After 5 days of inactivity, you'll need to login again
- **Security:** HttpOnly, Secure, SameSite=None, domain=.petwash.co.il

**Session Revocation:**
- Admins can suspend employee accounts → all sessions invalidated immediately
- Employee status changes to "suspended" → kicks out of all devices
- Password change → all sessions remain active (for convenience)
- Manual logout → session cookie deleted

**Best Practices:**
- ✅ Always logout on shared computers
- ✅ Use passkey on personal devices for faster login
- ✅ Don't share your password with anyone
- ✅ Check `/my-devices` regularly to revoke unknown devices

### Access Control

**Admin can:**
- ✅ Suspend any employee's access instantly
- ✅ View audit logs in Firestore (`admin_logs` collection)
- ✅ Revoke mobile login links
- ✅ Force password reset for any employee

**All actions are logged:**
- Every employee creation logged with `createdBy` UID
- Every suspension/reactivation logged with timestamp
- Every mobile link generation logged
- Logs stored in Firestore for audit trail

### Audit Logs

**Location:** Firestore → `admin_logs` collection

**Logged actions:**
- Employee created/updated/suspended
- Mobile login link generated
- Password reset sent
- Role changes
- Station assignments

**Log fields:**
- `action` - What was done
- `performedBy` - Admin UID who performed action
- `targetEmployee` - Employee UID affected
- `timestamp` - When it happened
- `details` - Additional metadata

### Support Contact

**Technical Support:**
- **Email:** `Support@PetWash.co.il`
- **Subject line:** "Admin Portal Support - [Your Issue]"
- **Response time:** Within 24 hours (weekdays)

**Include in support request:**
1. Your email: `nirhadad1@gmail.com`
2. Issue description
3. Browser and device (e.g., "Chrome on Windows 11")
4. Screenshots (if applicable)
5. Browser console errors (copy from Dev Tools)

**Emergency Contact:**
- For urgent issues (system down, security breach)
- WhatsApp: [Contact Nir directly]
- Response time: Within 2 hours

---

## Quick Reference Card

| Task | URL | Action |
|------|-----|--------|
| **Login** | `/admin/login` | Enter: `nirhadad1@gmail.com` + `PetWash2025!` |
| **Add Employee** | `/admin/users` | Click "+ Add Employee" (top-right) |
| **View Employees** | `/admin/users` | Automatic after login |
| **Suspend Employee** | `/admin/users` | Click ban icon in Actions column |
| **Generate Mobile Link** | `/admin/users` | Click link icon in Actions column |
| **Register Passkey** | `/my-devices` | Click "Register New Passkey" button |
| **View Passkeys** | `/my-devices` | See all registered devices |
| **Logout** | Any admin page | Click profile → "Logout" |

---

## Document Version

- **Version:** 1.0
- **Last Updated:** October 20, 2025
- **Maintained by:** Pet Wash™ Technical Team
- **Next Review:** January 2026

---

**Need help?** Contact us at `Support@PetWash.co.il`
