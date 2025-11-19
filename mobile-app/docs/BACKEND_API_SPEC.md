# Pet Wash™ Mobile App - Backend API Specification

## Overview
This document specifies the exact contract that the backend API must implement for the mobile app authentication system to work correctly.

---

## 🔐 Authentication Endpoints

### 1. **POST /auth/login**
Initial login with email and password.

**Request:**
```json
{
  "email": "staff@petwash.co.il",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_123456",
    "email": "staff@petwash.co.il",
    "firstName": "David",
    "lastName": "Cohen",
    "roles": ["staff", "technician"],
    "permissions": ["stations.view", "stations.service", "tasks.complete"]
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}
```

**Token Requirements:**
- **accessToken**: JWT, short-lived (15-30 minutes recommended)
- **refreshToken**: JWT, long-lived (7-30 days recommended)
- Both tokens must be signed with the same secret or public/private key pair

---

### 2. **POST /auth/refresh**
Refresh access token using refresh token (silent or biometric unlock).

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_123456",
    "email": "staff@petwash.co.il",
    "firstName": "David",
    "lastName": "Cohen",
    "roles": ["staff", "technician"],
    "permissions": ["stations.view", "stations.service", "tasks.complete"]
  }
}
```

**Notes:**
- **MUST** return a new `refreshToken` (token rotation for security)
- **MUST** invalidate the old `refreshToken` on backend
- If refresh token is expired or invalid, return 401

**Error Response (401 Unauthorized):**
```json
{
  "error": "INVALID_REFRESH_TOKEN",
  "message": "Refresh token expired or invalid"
}
```

---

### 3. **POST /auth/logout**
Invalidate refresh token on backend.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Notes:**
- Backend should invalidate/blacklist the refresh token
- Even if token is already invalid, return 200 OK

---

## 🔒 Protected API Endpoints

All protected endpoints must accept `Authorization: Bearer <accessToken>` header.

### Example: **GET /staff/me**
Get current authenticated user info.

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "id": "usr_123456",
  "email": "staff@petwash.co.il",
  "firstName": "David",
  "lastName": "Cohen",
  "roles": ["staff", "technician"],
  "permissions": ["stations.view", "stations.service", "tasks.complete"],
  "department": "Logistics & Fleet"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired access token"
}
```

---

## 📋 Data Types

### User Object
```typescript
{
  id: string;                // Unique user ID
  email: string;             // User email
  firstName?: string;        // Optional first name
  lastName?: string;         // Optional last name
  roles: string[];           // Array of role names (e.g., ["admin", "staff"])
  permissions: string[];     // Array of permission strings (e.g., ["stations.delete"])
}
```

### JWT Access Token Payload (Example)
```json
{
  "sub": "usr_123456",
  "email": "staff@petwash.co.il",
  "roles": ["staff", "technician"],
  "permissions": ["stations.view", "stations.service"],
  "iat": 1700000000,
  "exp": 1700001800
}
```

### JWT Refresh Token Payload (Example)
```json
{
  "sub": "usr_123456",
  "type": "refresh",
  "iat": 1700000000,
  "exp": 1702592000
}
```

---

## 🛡️ Security Best Practices

### Token Security
1. **Access Token**:
   - Short lifetime (15-30 minutes)
   - Contains user claims (roles, permissions)
   - Stateless (JWT)

2. **Refresh Token**:
   - Long lifetime (7-30 days)
   - Must be stored in database for revocation
   - Rotate on every use
   - Invalidate on logout

3. **Token Storage on Mobile**:
   - ✅ Access token: In-memory only (never persisted)
   - ✅ Refresh token: iOS Keychain / Android Keystore (via expo-secure-store)
   - ❌ Never store in AsyncStorage or unencrypted storage

### Rate Limiting
```
POST /auth/login: 5 requests per 15 minutes per IP
POST /auth/refresh: 60 requests per 15 minutes per user
POST /auth/logout: 10 requests per 15 minutes per user
```

### High-Risk Actions
For sensitive operations (delete station, change revenue share, etc.):
1. Mobile app triggers biometric re-authentication
2. Mobile app sends request with valid access token
3. Backend verifies token AND checks user permissions
4. Backend logs action in audit trail

---

## 📦 Example Backend Implementation (Express.js)

```typescript
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Validate credentials (check database)
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );

  const refreshToken = jwt.sign(
    { sub: user.id, type: "refresh" },
    JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );

  // Store refresh token in database
  await storeRefreshToken(user.id, refreshToken);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      permissions: user.permissions,
    },
  });
});

// POST /auth/refresh
router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

    // Check if refresh token is valid in database
    const isValid = await isRefreshTokenValid(decoded.sub, refreshToken);
    if (!isValid) {
      return res.status(401).json({
        error: "INVALID_REFRESH_TOKEN",
        message: "Refresh token expired or invalid",
      });
    }

    // Get user
    const user = await findUserById(decoded.sub);

    // Generate new tokens
    const newAccessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    const newRefreshToken = jwt.sign(
      { sub: user.id, type: "refresh" },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    // Invalidate old refresh token and store new one
    await rotateRefreshToken(user.id, refreshToken, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    res.status(401).json({
      error: "INVALID_REFRESH_TOKEN",
      message: "Refresh token expired or invalid",
    });
  }
});

// POST /auth/logout
router.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    await invalidateRefreshToken(decoded.sub, refreshToken);
  } catch (err) {
    // Even if token is invalid, return success
  }

  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
```

---

## ✅ Integration Checklist

- [ ] `/auth/login` returns `accessToken`, `refreshToken`, and `user` object
- [ ] `/auth/refresh` rotates refresh token and returns new tokens
- [ ] `/auth/logout` invalidates refresh token on backend
- [ ] All protected endpoints verify `Authorization: Bearer <token>` header
- [ ] Access tokens expire in 15-30 minutes
- [ ] Refresh tokens expire in 7-30 days
- [ ] Refresh tokens are stored in database for revocation
- [ ] Rate limiting is implemented on auth endpoints
- [ ] Audit logs capture high-risk actions

---

## 🚀 Testing with Mobile App

1. Start your backend server
2. Update `API_BASE` in `App.tsx` to point to your backend
3. Run mobile app: `npm start` or `expo start`
4. Test login, biometric unlock, and API calls

---

## 📞 Support

For questions about the mobile app integration, contact the Pet Wash™ development team.
