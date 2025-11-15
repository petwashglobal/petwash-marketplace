# 🚨 Deployment Troubleshooting Guide

## Quick Diagnosis

**Symptom:** Deployment succeeded but website not loading on Chrome/Safari

**Root Causes (in order of likelihood):**

1. ✅ **CORS Blocking** (FIXED)
2. ⚠️ Build files missing
3. ⚠️ Port binding issues
4. ⚠️ Environment variables missing

---

## 1. CORS Blocking (MOST COMMON)

### Problem
Cloud Run deployments use `*.run.app` domains, which get blocked by CORS if not properly configured.

### Symptoms
- Deployment succeeds
- Website shows blank page
- Browser console shows CORS errors:
  ```
  Access to fetch at 'https://your-app.run.app/api/...' from origin 'https://your-app.run.app' has been blocked by CORS policy
  ```

### Solution (APPLIED ✅)

**File:** `server/index.ts` lines 210-233

```typescript
// Secure deployment domain verification
const trustedSuffixes = [
  '.replit.app',  // Replit deployments
  '.repl.co',     // Replit legacy
  '.replit.dev',  // Replit dev
  '.replit.com',  // Replit custom
  '.run.app',     // Cloud Run deployments ✅
];

try {
  const hostname = new URL(origin).hostname;
  const isTrustedDeployment = trustedSuffixes.some(suffix => 
    hostname.endsWith(suffix)
  );
  
  if (isTrustedDeployment) {
    logger.info(`[CORS] Allowing trusted deployment origin: ${origin}`);
    return callback(null, true);
  }
} catch (error) {
  logger.warn(`[CORS] Invalid origin URL: ${origin}`);
  return callback(new Error('Not allowed by CORS'));
}
```

### Security Notes
- ✅ Uses `hostname.endsWith()` to prevent subdomain attacks
- ✅ Prevents malicious domains like `run.app.attacker.com`
- ✅ Properly parses URLs with `new URL()`

### Verification
```bash
# Check if CORS fix is applied
grep ".run.app" server/index.ts && echo "✅ Cloud Run allowed" || echo "❌ Missing"

# Check for secure implementation
grep "hostname.endsWith" server/index.ts && echo "✅ Secure" || echo "⚠️ Insecure"
```

---

## 2. Build Files Missing

### Problem
Production build not created or uploaded to deployment.

### Symptoms
- Server logs show: "Build directory not found: /path/to/dist/public"
- 404 errors for all routes
- Blank page with no content

### Diagnosis
```bash
# Check if build exists
ls dist/public/index.html
# Should show: dist/public/index.html

# Check number of assets
ls dist/public/assets/ | wc -l
# Should show: 277 (or similar)

# Check .deployignore doesn't exclude dist/
grep "^dist/" .deployignore && echo "❌ Excluded!" || echo "✅ Included"
```

### Solution
```bash
# 1. Build the project
npm run build

# 2. Verify build succeeded
ls -lh dist/public/

# 3. Check .deployignore includes dist/
# Should NOT have "dist/" on its own line
# (Subpaths like "dist/cache" are OK)

# 4. Redeploy
# Click "Publish" in Replit
```

---

## 3. Port Binding Issues

### Problem
Server not binding to correct port or host.

### Symptoms
- Deployment succeeds but shows "Service Unavailable"
- Health checks fail
- Cloud Run shows "Container failed to start"

### Diagnosis
```bash
# Check server binds to 0.0.0.0 (not localhost)
grep "host:" server/index.ts
# Should show: host: "0.0.0.0"

# Check PORT environment variable is used
grep "process.env.PORT" server/index.ts
# Should show: const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
```

### Solution (Already Correct ✅)

**File:** `server/index.ts` lines 426-430

```typescript
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
server.listen({
  port,
  host: "0.0.0.0",  // ✅ Correct - not localhost!
  reusePort: true,
}, async () => {
```

---

## 4. Environment Variables Missing

### Problem
Required environment variables not set in production.

### Symptoms
- Server starts but features don't work
- Firebase Auth fails
- Database connections fail

### Critical Variables (Production)
```bash
# Required for basic functionality:
DATABASE_URL          # PostgreSQL connection
NODE_ENV=production   # Triggers production mode

# Required for auth:
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL

# Required for payments:
NAYAX_MERCHANT_ID
NAYAX_API_KEY
NAYAX_SECRET_KEY

# Security:
COOKIE_SECRET
JWT_SECRET
JWT_REFRESH_SECRET
```

### Verification
```bash
# In Replit Deployment > Environment Variables
# Make sure all critical secrets are added
```

---

## 5. Static File Serving

### Problem
Production mode fails to copy build files to server directory.

### Diagnosis
Check server logs for:
```
PRODUCTION MODE: Serving static build
📦 Syncing build files: /path/to/dist/public → /path/to/server/public
✅ Build files synced successfully
```

If you see:
```
❌ Build directory not found: /path/to/dist/public
```

### Solution
Verify Vite build configuration:

**File:** `vite.config.ts`
```typescript
build: {
  outDir: path.resolve(import.meta.dirname, "dist/public"), // ✅ Correct!
  emptyOutDir: true,
}
```

---

## 6. Health Check Endpoints

### Test Health Endpoints

```bash
# Basic health check
curl https://your-app.run.app/health
# Should return: {"ok":true,"env":"production","status":"healthy",...}

# Readiness check
curl https://your-app.run.app/ready
# Should return: {"status":"ready",...}

# Legacy health check
curl https://your-app.run.app/healthz
# Should return: {"status":"healthy",...}
```

---

## 7. DNS & SSL Issues

### Problem
Custom domain (petwash.co.il) not resolving correctly.

### Diagnosis
```bash
# Check DNS
dig petwash.co.il
dig www.petwash.co.il

# Check SSL certificate
curl -I https://petwash.co.il
# Should show: HTTP/2 200 or 301
```

### Solution
1. Verify DNS records in domain registrar
2. Add custom domain in Replit Deployment settings
3. Wait 24-48 hours for DNS propagation

---

## 8. Cloud Run Specific Issues

### Check Cloud Run Logs

1. Go to Google Cloud Console
2. Navigate to Cloud Run > Your Service
3. Click "Logs" tab
4. Look for errors in:
   - Container startup
   - Port binding
   - Health checks

### Common Cloud Run Errors

**"Port already in use"**
- ✅ Fixed by using `reusePort: true`

**"Container failed to start: Failed to start and then listen on the port"**
- Check `PORT` environment variable
- Verify server binds to `0.0.0.0`

**"Memory limit exceeded"**
- Increase Cloud Run memory allocation
- Default: 512MB, Recommended: 1GB+

---

## Quick Fix Checklist

Run these commands to verify everything:

```bash
# 1. CORS Configuration
grep ".run.app" server/index.ts && echo "✅ CORS OK"

# 2. Build Files
ls dist/public/index.html && echo "✅ Build OK"

# 3. Port Binding
grep 'host: "0.0.0.0"' server/index.ts && echo "✅ Port OK"

# 4. .deployignore
grep -v "^dist/" .deployignore && echo "✅ Deploy OK"

# 5. Production Start
npm run start &
sleep 5
curl http://localhost:5000/health && echo "✅ Server OK"
kill %1
```

---

## Still Not Working?

1. **Check deployment logs:**
   - Replit: Deployment tab > View Logs
   - Cloud Run: Google Cloud Console > Logs

2. **Test locally in production mode:**
   ```bash
   NODE_ENV=production npm run start
   # Visit http://localhost:5000
   ```

3. **Compare with working deployment:**
   - Development mode works? → Deployment configuration issue
   - Development mode broken? → Code issue

4. **Common gotchas:**
   - Forgot to run `npm run build`
   - `.deployignore` excludes `dist/`
   - CORS not allowing Cloud Run domains
   - Missing environment variables

---

## Success Criteria

✅ Health endpoint returns 200:
```bash
curl https://your-app.run.app/health
```

✅ Homepage loads:
```bash
curl https://your-app.run.app/ | grep "Pet Wash"
```

✅ No CORS errors in browser console

✅ Static assets load correctly (check Network tab)

---

## Support

If you're still stuck after following this guide:

1. Check the logs for specific error messages
2. Search for the error in Replit docs
3. Verify all environment variables are set
4. Test locally in production mode first

**Last Updated:** November 15, 2025 (Post-CORS Security Fix)
