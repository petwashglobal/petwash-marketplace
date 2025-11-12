# Deployment Guide - Pet Wash Application

## Production Deployment on Replit

### Build Path Configuration

The application uses a two-folder build system:
- **Vite builds to:** `dist/public/` (configured in vite.config.ts)
- **Server serves from:** `server/public/` (configured in server/vite.ts)

### Building for Production

**Option 1: Using the build script (Recommended)**
```bash
./build-production.sh
```

This script:
1. Runs `npm run build` (builds frontend to dist/public)
2. Copies dist/public/* to server/public/
3. Ensures server can serve the production build

**Option 2: Manual build**
```bash
npm run build
rm -rf server/public && mkdir -p server/public
cp -R dist/public/* server/public/
```

### Replit Deployment Process

When you deploy on Replit:

1. **Click "Deploy"** button in Replit
2. Replit automatically runs:
   - `npm run build` (builds frontend)
   - The build script should copy files to server/public
3. **Add custom domains** in Deployment Settings
4. **Verify environment variables** are set (see below)

### Required Environment Variables

Ensure these are configured in **Replit Secrets** before deploying:

#### Firebase Configuration
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

#### Session Management
- `SESSION_SECRET` (required for production)

#### Firebase Admin SDK
- `FIREBASE_SERVICE_ACCOUNT_BASE64` (base64 encoded service account JSON)

### Custom Domain Setup

#### DNS Configuration
1. **A Record for root domain:**
   - Name: `@` or `petwash.co.il`
   - Value: IP provided by Replit (check Deployment Settings)
   
2. **A Record for www subdomain:**
   - Name: `www`
   - Value: Same IP as root domain

3. **TXT Records for verification:**
   - Add TXT records shown in Replit Deployment → Domains
   - Format: `replit-verify=<verification-code>`

#### In Replit Dashboard
1. Go to **Deployments** tab
2. Click on your active deployment
3. Navigate to **Settings → Domains**
4. Click **"Add domain"** 
5. Add both:
   - `petwash.co.il`
   - `www.petwash.co.il`
6. Copy TXT records and add to your DNS
7. Wait for **"Verified ✓"** status

### Troubleshooting

#### "Internal Server Error" on Deployment
- Check that `server/public/` contains the built files
- Run `./build-production.sh` locally to verify build works
- Check deployment logs for missing environment variables

#### "Not Found" (404) Error
- Verify `server/public/index.html` exists
- Check that deployment is using production mode (NODE_ENV=production)

#### Domain Shows Wrong Content
- Wait for DNS propagation (5 minutes to 48 hours)
- Verify TXT records are added to DNS
- Check domain status in Replit Deployments → Domains

### Production Checklist

Before deploying:
- [ ] Run `./build-production.sh` to verify build works
- [ ] All environment variables configured in Replit Secrets
- [ ] Firebase service account configured
- [ ] Session secret configured
- [ ] DNS A records pointing to Replit IP
- [ ] DNS TXT records added for domain verification

After deploying:
- [ ] Deployment shows "Active" status
- [ ] Domains show "Verified ✓" status
- [ ] Test authentication (Firebase login)
- [ ] Test session management (login/logout)
- [ ] Verify HTTPS is working
- [ ] Check error monitoring in Sentry

### Support

For deployment issues:
1. Check deployment logs in Replit
2. Review SECURITY_FIX_SUMMARY.md for environment variable requirements
3. Verify DNS propagation using online DNS checkers
