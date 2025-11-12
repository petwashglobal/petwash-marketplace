# PetWash™ Enterprise Backend Deployment Guide

## 🌍 Domain & Infrastructure Setup

This guide covers the complete deployment of the PetWash™ Enterprise platform on Replit with custom domain configuration.

### Deployment Overview

**Active Domains (Israel - Live Now):**
- `api.petwash.co.il` - REST API & WebSocket server
- `hub.petwash.co.il` - Enterprise dashboards (HQ / Franchise / Technician)
- `status.petwash.co.il` - Public uptime & health monitoring

**Future Domains (Global - Preconfigured, Inactive):**
- `api.petwash.app` - Global API endpoint (mirror)
- `hub.petwash.app` - Global enterprise dashboard
- `app.petwash.app` - Customer web app (Firebase Hosting)

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ Replit account with access to this workspace
2. ✅ Domain registrar access for `petwash.co.il` and `petwash.app`
3. ✅ All required environment variables configured in Replit Secrets
4. ✅ Database provisioned and migrations applied
5. ✅ Firebase project configured for authentication

---

## 🚀 Step 1: Publish to Replit Deployment

### 1.1 Prepare for Deployment

```bash
# Ensure all dependencies are installed
npm install

# Run build to verify everything compiles
npm run build

# Test locally first
npm run dev
```

### 1.2 Publish Your Application

1. Click the **"Publish"** button in Replit (or find "Publishing" in Tools/Search)
2. Choose **"Autoscale Deployment"** (recommended for APIs and web apps)
3. Configure machine power:
   - **vCPU**: 1-2 cores (start with 1, scale up if needed)
   - **RAM**: 2-4 GB (start with 2 GB)
   - **Max Machines**: 3-5 (for high availability)
4. Click **"Set up your published app"**
5. Wait for deployment to complete

Your Replit deployment URL will be: `https://pet-wash-nl-nirhadad1.replit.app`

---

## 🌐 Step 2: Configure Custom Domains (petwash.co.il)

### 2.1 DNS Configuration

**Important:** Replit uses **A records**, NOT CNAME records, for custom domains.

Go to your domain registrar's DNS management panel and add these records:

#### For api.petwash.co.il:
```
Type: A
Host: api
Value: <IP from Replit>
TTL: 3600 (or Auto)
```

#### For hub.petwash.co.il:
```
Type: A
Host: hub
Value: <IP from Replit>
TTL: 3600 (or Auto)
```

#### For status.petwash.co.il:
```
Type: A
Host: status
Value: <IP from Replit>
TTL: 3600 (or Auto)
```

### 2.2 Add Domains in Replit

1. Go to **Deployments** tab in your published app
2. Click **Settings** → **Link a domain**
3. For each subdomain:
   - Enter the domain (e.g., `api.petwash.co.il`)
   - Replit will provide the **A record IP** and **TXT record** for verification
   - Copy these values to your DNS panel
   - Add both the **A record** and **TXT record** to your DNS
4. Wait for DNS propagation (can take 5 minutes to 48 hours)
5. Status will show **"Verified"** once propagation is complete

### 2.3 SSL/TLS Certificates

Replit automatically provisions SSL/TLS certificates for verified custom domains. No additional configuration needed!

---

## 🔐 Step 3: Configure Environment Variables

Add these secrets in Replit's **Secrets** tool (key-value pairs):

### Production Environment
```bash
PETWASH_ENV=production
NODE_ENV=production
REPLIT_DEPLOYMENT=1  # Auto-set by Replit
```

### Firebase Configuration
```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=petwash.co.il
FIREBASE_DB_URL=your-firebase-database-url
FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

### Payment & Webhooks
```bash
NAYAX_API_KEY=your-nayax-api-key
NAYAX_WEBHOOK_SECRET=your-nayax-webhook-secret
NAYAX_BASE_URL=https://api.nayax.com
```

### Security & Auth
```bash
JWT_SECRET=your-secure-jwt-secret
FRANCHISE_SECRET_KEY=your-franchise-secret-key
SESSION_SECRET=your-session-secret
```

### Analytics & Monitoring
```bash
GA4_MEASUREMENT_ID=G-XXXXXXXXX
GTM_CONTAINER_ID=GTM-XXXXXXX
SENTRY_DSN=your-sentry-dsn
```

### Email Configuration
```bash
SENDGRID_API_KEY=your-sendgrid-api-key
ALERT_EMAIL_FROM=support@petwash.co.il
ALERT_EMAIL_TO=support@petwash.co.il
```

### WebSocket Security (REQUIRED)
```bash
WEBSOCKET_API_KEY=your-secure-websocket-api-key-here  # REQUIRED - Must be set for WebSocket to function
WS_MAX_CONN_PER_IP=0  # Optional: Max connections per IP (0 = disabled, recommended for production behind proxy/LB)
```

**Important:** 
- `WEBSOCKET_API_KEY` is required - WebSocket will not accept auth requests without it. Use a strong, random key (32+ characters).
- `WS_MAX_CONN_PER_IP` is disabled by default (0) because Replit deployments sit behind load balancers, making per-IP limiting ineffective. Set to a positive number (e.g., 5) only if deploying without a reverse proxy.

### Database
```bash
DATABASE_URL=postgresql://user:pass@host:port/db  # Auto-configured by Replit
```

**Note:** Replit automatically syncs workspace secrets with deployments. You can override individual values in the Deployment settings if needed.

---

## 🧪 Step 4: Verify Deployment

### 4.1 Health Check Endpoints

Test these endpoints after deployment:

```bash
# Primary health check
curl https://api.petwash.co.il/health
# Expected: {"ok": true, "env": "production", ...}

# Database readiness check
curl https://api.petwash.co.il/readiness
# Expected: {"status": "ready", "checks": {...}}

# System uptime and station health
curl https://api.petwash.co.il/status/uptime
# Expected: {"ok": true, "service": "PetWash™ Enterprise Platform", ...}

# Station health monitoring
curl https://api.petwash.co.il/status/stations
# Expected: {"ok": true, "summary": {...}, "stations": [...]}
```

### 4.2 Access Enterprise Dashboards

Visit these URLs in your browser:

- **HQ Dashboard**: `https://hub.petwash.co.il/enterprise/hq`
- **Franchisee Dashboard**: `https://hub.petwash.co.il/enterprise/franchisee/1`
- **Technician View**: `https://hub.petwash.co.il/enterprise/technician/tech-001`
- **Public Status Page**: `https://status.petwash.co.il/status/uptime`

### 4.3 Test WebSocket Connection

```javascript
const ws = new WebSocket('wss://api.petwash.co.il/realtime');

ws.onopen = () => {
  console.log('Connected to PetWash™ IoT telemetry');
  
  // Authenticate first (required for telemetry/alerts)
  ws.send(JSON.stringify({
    type: 'auth',
    payload: { token: 'your-websocket-api-key' }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  if (data.type === 'auth_success') {
    // Now subscribe to specific stations
    ws.send(JSON.stringify({
      type: 'subscribe',
      payload: { stations: [1, 2, 3] }  // Specific station IDs
    }));
    
    // Get telemetry snapshot
    ws.send(JSON.stringify({
      type: 'get_telemetry',
      payload: { stationId: 1, limit: 10 }
    }));
  }
};
```

**Security Features:**
- **Strict origin validation** - Exact host+scheme matching (no prefix attacks), missing Origin rejected in production
- **Mandatory API key** - WEBSOCKET_API_KEY environment variable required (no default fallback)
- **Rate limiting** - 60 messages/minute per client with per-client tracking
- **Connection limits** - 100 total connections (per-IP limiting disabled by default for proxy/LB compatibility)
- **Subscription limits** - Max 50 stations per client, "all" subscriptions blocked
- **Bounded queries** - Max 100 records per snapshot, all-stations queries blocked in production
- **Endpoint protection** - Public: get_stations | Protected (auth): subscribe, get_telemetry, get_alerts

---

## 🎯 Step 5: Production Checklist

### Before Going Live

- [ ] All environment variables configured and verified
- [ ] DNS records added and propagated (check with `nslookup api.petwash.co.il`)
- [ ] SSL certificates issued (HTTPS working)
- [ ] Health check endpoints returning 200 OK
- [ ] Database migrations applied successfully
- [ ] Firebase authentication configured and tested
- [ ] Payment webhooks tested (Nayax integration)
- [ ] Admin login working (nirhadad1@gmail.com)
- [ ] Enterprise dashboards accessible
- [ ] WebSocket server accepting connections
- [ ] Status monitoring page displaying data
- [ ] Monitoring alerts configured (email notifications)
- [ ] Backup strategy in place

### Post-Launch Monitoring

- [ ] Monitor `/metrics` endpoint for performance
- [ ] Check `/status/uptime` regularly for system health
- [ ] Review Sentry for errors and exceptions
- [ ] Monitor WebSocket connection count
- [ ] Track API response times
- [ ] Verify daily database backups

---

## 🌍 Step 6: Future Global Activation (petwash.app)

### Preparation (Do NOT activate yet)

Reserve these domains in your DNS panel with placeholder records:

```dns
# api.petwash.app
Type: A
Host: api
Value: 127.0.0.1  # Placeholder - update when activating
TTL: 3600

# hub.petwash.app
Type: A
Host: hub
Value: 127.0.0.1  # Placeholder - update when activating
TTL: 3600

# app.petwash.app (Firebase Hosting)
Type: CNAME
Host: app
Value: petwash-app.web.app  # Update when Firebase app is deployed
TTL: 3600
```

### Activation Steps (When approved)

1. **Update DNS records** with actual Replit IPs (same as .co.il domains)
2. **Add domains in Replit** deployment settings
3. **Verify TXT records** for domain ownership
4. **Wait for SSL certificates** to auto-provision
5. **Uncomment .app domains** in CORS configuration (`server/index.ts`)
6. **Redeploy** the application
7. **Test** all endpoints with .app domains
8. **Monitor** for issues and traffic distribution

---

## 🔧 Troubleshooting

### DNS Not Resolving

```bash
# Check DNS propagation
nslookup api.petwash.co.il

# Or use online tool
https://dnschecker.org
```

### SSL Certificate Issues

- Verify both A and TXT records are present
- Wait 24-48 hours for full propagation
- Check Replit domain status shows "Verified"
- Contact Replit support if issues persist

### CORS Errors

Ensure origins are whitelisted in `server/index.ts`:
```typescript
const allowedOrigins = [
  'https://api.petwash.co.il',
  'https://hub.petwash.co.il',
  'https://status.petwash.co.il',
  // ... more origins
];
```

### WebSocket Connection Failures

- Verify WebSocket route is registered: `/realtime`
- Check firewall allows WebSocket (WSS) connections
- Ensure proper upgrade headers in requests
- Test with: `wscat -c wss://api.petwash.co.il/realtime`

### Database Connection Issues

- Check `DATABASE_URL` environment variable
- Verify database is accessible from deployment
- Review connection pool settings
- Check Replit deployment logs for errors

---

## 📊 Monitoring & Alerts

### Health Probes

Replit automatically monitors these endpoints:
- `/health` - Every 1 minute
- `/status/uptime` - Every 5 minutes

### Alert Configuration

Alerts trigger when:
- Service offline > 5 minutes → Email to `support@petwash.co.il`
- Station offline > 30 minutes (no heartbeat) → Dashboard notification
- Critical errors (500) → Sentry alert
- Database connection failure → Immediate email alert

### Log Aggregation

View logs in:
1. **Replit Console**: Real-time deployment logs
2. **Sentry Dashboard**: Error tracking and performance
3. **Custom Logs**: `server/logs/` directory (if configured)

---

## 🔒 Security Best Practices

1. **Never commit secrets** to the repository
2. **Use Replit Secrets** for all sensitive data
3. **Enable CORS** only for trusted domains
4. **Rotate secrets** quarterly
5. **Monitor access logs** for suspicious activity
6. **Keep dependencies updated** (`npm audit`)
7. **Use HTTPS** for all production endpoints
8. **Implement rate limiting** for public APIs

---

## 📞 Support & Resources

- **Replit Docs**: https://docs.replit.com/deployments
- **Custom Domains**: https://docs.replit.com/deployments/custom-domains
- **Enterprise Support**: nirhadad1@gmail.com
- **Status Page**: https://status.petwash.co.il/status/uptime

---

## 🎉 Deployment Complete!

Your PetWash™ Enterprise platform is now live and accessible at:

- **API**: https://api.petwash.co.il
- **HQ Dashboard**: https://hub.petwash.co.il/enterprise/hq
- **Status Monitor**: https://status.petwash.co.il/status/uptime
- **WebSocket**: wss://api.petwash.co.il/realtime

**Next Steps:**
1. Monitor the status page for system health
2. Test all enterprise dashboards with real data
3. Verify payment webhooks are processing correctly
4. Set up automated database backups
5. Configure alerting for critical incidents

---

**Last Updated**: October 21, 2025  
**Version**: 2.0.0  
**Platform**: Replit Autoscale Deployment
