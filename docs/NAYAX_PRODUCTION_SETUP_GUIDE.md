# Nayax Israel - Production API Keys Setup Guide

**Status:** Ready for Production (Waiting for API Keys)  
**Updated:** November 8, 2025  
**Entity:** Pet Wash Ltd (פט וואש בע״מ)

---

## Overview

This guide walks you through setting up Nayax Israel production API credentials for Pet Wash Ltd's 8-platform ecosystem.

---

## Prerequisites

Before getting API keys from Nayax Israel:

✅ **Legal Requirements:**
- Pet Wash Ltd business registration in Israel
- Israeli Tax ID (מס' עוסק מורשה)
- Israeli bank account for settlements
- Business license and permits

✅ **Technical Requirements:**
- Production website live at `petwash.co.il`
- SSL/TLS certificates active
- Webhook endpoint ready: `https://petwash.co.il/api/webhooks/nayax`

---

## Step 1: Contact Nayax Israel

**Nayax Israel Contact Information:**

📧 **Sales Email:** sales.israel@nayax.com  
☎️ **Support Phone:** +972-9-9709595  
🌐 **Website:** https://www.nayax.com/he/israel  
📍 **Office:** Herzliya, Israel

**What to Request:**

1. **Spark API Account** (for K9000 IoT wash stations)
2. **Merchant Account** (for split payments on marketplaces)
3. **Terminal Registrations** (for each physical K9000 station)
4. **Webhook Configuration** (for real-time payment notifications)

---

## Step 2: Obtain Production Credentials

Nayax will provide the following credentials:

### Required Secrets

| Secret Name | Description | Example Value | Where to Get |
|------------|-------------|---------------|--------------|
| `NAYAX_API_KEY` | Spark API authentication key | `sk_live_xxxxxxxx` | Nayax Dashboard |
| `NAYAX_BASE_URL` | Production API endpoint | `https://api.nayax.com/spark/v1` | Nayax Docs |
| `NAYAX_MERCHANT_ID` | Pet Wash Ltd merchant ID | `MERCH_IL_PWASH_001` | Nayax Onboarding |
| `NAYAX_TERMINAL_ID` | Primary terminal/station ID | `TERM_001_TLV` | Nayax Portal |
| `NAYAX_SECRET` | Webhook signature verification | `whsec_xxxxxxxxxx` | Nayax Dashboard |

### Optional Secrets (for multi-location)

| Secret Name | Description |
|------------|-------------|
| `NAYAX_TERMINAL_ID_MAIN` | Main K9000 station (Tel Aviv HQ) |
| `NAYAX_TERMINAL_ID_SECONDARY` | Secondary station (if multiple) |
| `NAYAX_MERCHANT_FEE_RATE` | Custom commission % (default: 2.5%) |

---

## Step 3: Add Secrets to Replit

### Via Replit Secrets Manager (Recommended)

1. Open your Replit project: `pet-wash-platform`
2. Click **Tools** → **Secrets** (lock icon)
3. Add each secret one by one:

```
Name: NAYAX_API_KEY
Value: [paste from Nayax dashboard]
```

```
Name: NAYAX_BASE_URL
Value: https://api.nayax.com/spark/v1
```

```
Name: NAYAX_MERCHANT_ID
Value: [paste from Nayax onboarding email]
```

```
Name: NAYAX_TERMINAL_ID
Value: [paste from Nayax portal]
```

```
Name: NAYAX_SECRET
Value: [paste webhook secret]
```

### Via Environment Variables (Self-Hosted)

If running on your own server, add to `.env` file:

```bash
# Nayax Israel Production Credentials
NAYAX_API_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
NAYAX_BASE_URL=https://api.nayax.com/spark/v1
NAYAX_MERCHANT_ID=MERCH_IL_PWASH_001
NAYAX_TERMINAL_ID=TERM_001_TLV
NAYAX_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxx

# Optional: Demo mode (REMOVE for production)
# NAYAX_DEMO_MODE=false
```

**⚠️ IMPORTANT:** Never commit `.env` file to Git!

---

## Step 4: Verify Integration

### Test API Connection

Run the verification script:

```bash
npm run test:nayax
```

Expected output:
```
✅ Nayax API Key: Configured
✅ Nayax Base URL: https://api.nayax.com/spark/v1
✅ Merchant ID: MERCH_IL_PWASH_001
✅ Terminal ID: TERM_001_TLV
✅ Webhook Secret: Configured
✅ Connection Test: SUCCESS
```

### Test Payment Flow (Sandbox First)

Before going live, test in Nayax sandbox:

1. Set `NAYAX_BASE_URL=https://sandbox.nayax.com/spark/v1`
2. Use sandbox API key from Nayax
3. Run test transaction:

```bash
curl -X POST https://petwash.co.il/api/payments/nayax/initiate-wash \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "washType": "DOGWASH_PREMIUM",
    "customerUid": "test_user_123",
    "customerToken": "tok_sandbox_test",
    "stationId": "station_001"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Wash started successfully!",
  "transactionId": "tx_1699999999_abc123",
  "nayaxTransactionId": "NXC_2025_XYZ789"
}
```

---

## Step 5: Configure Webhooks

Nayax sends real-time payment notifications to your webhook endpoint.

### Webhook URL

```
https://petwash.co.il/api/webhooks/nayax
```

### Webhook Events to Subscribe

In Nayax Dashboard, enable these events:

- [x] `payment.authorized` - Payment approved
- [x] `payment.settled` - Funds captured
- [x] `payment.failed` - Payment declined
- [x] `payment.voided` - Payment refunded
- [x] `vend.success` - Machine started successfully
- [x] `vend.failed` - Machine failed to start

### Webhook Security

The webhook endpoint automatically verifies signatures using `NAYAX_SECRET`:

```typescript
// Handled automatically in server/routes/webhooks/nayax.ts
const isValid = verifyNayaxWebhookSignature(
  req.body,
  req.headers['x-nayax-signature'],
  process.env.NAYAX_SECRET
);
```

---

## Step 6: Go Live!

### Production Checklist

- [ ] All secrets added to Replit/Server
- [ ] Sandbox tests passing
- [ ] Webhooks configured and tested
- [ ] SSL certificate valid
- [ ] Domain pointing to production server
- [ ] Rate limiting configured
- [ ] Backup system active
- [ ] Monitoring alerts set up

### Switch to Production

1. Update `NAYAX_BASE_URL` to production:
   ```
   NAYAX_BASE_URL=https://api.nayax.com/spark/v1
   ```

2. Replace sandbox API key with production key:
   ```
   NAYAX_API_KEY=sk_live_production_key_here
   ```

3. Restart the application:
   ```bash
   npm run dev
   ```

4. Verify logs show production mode:
   ```
   [Nayax] API keys configured - Production mode active
   ✅ Base URL: https://api.nayax.com/spark/v1
   ✅ Merchant: MERCH_IL_PWASH_001
   ```

---

## Step 7: Monitor & Maintain

### Real-Time Monitoring

**Nayax Dashboard:** https://dashboard.nayax.com  
- View all transactions
- Monitor terminal status
- Track settlement reports

**Pet Wash Admin:** https://petwash.co.il/admin/nayax  
- Real-time transaction logs
- Failed payment alerts
- Terminal uptime monitoring

### Daily Checks

✅ **Morning (9 AM Israel Time):**
- Check terminal connectivity (all K9000 stations online)
- Review overnight transaction logs
- Verify webhook delivery (no missed events)

✅ **Evening (6 PM Israel Time):**
- Check daily settlement report from Nayax
- Reconcile transactions with accounting system
- Review any failed payments

### Weekly Tasks

✅ **Every Monday:**
- Review Nayax API health metrics
- Check for any rate limiting issues
- Verify webhook signature validation passing

✅ **Every Friday:**
- Generate weekly revenue report
- Reconcile bank deposits with Nayax settlements
- Backup transaction database

---

## Troubleshooting

### Issue: "Nayax API key not configured"

**Solution:**
1. Check secret exists: `echo $NAYAX_API_KEY`
2. Verify no extra spaces in secret value
3. Restart application after adding secrets

### Issue: Payment authorized but vend failed

**Solution:**
1. Check K9000 station status (online/offline)
2. Verify terminal ID matches physical station
3. Review station logs for hardware errors
4. Payment is automatically voided/refunded

### Issue: Webhook signature verification failed

**Solution:**
1. Verify `NAYAX_SECRET` matches Nayax dashboard
2. Check webhook endpoint is HTTPS (not HTTP)
3. Review request headers in logs

### Issue: Transactions stuck in "pending"

**Solution:**
1. Check Nayax API status: https://status.nayax.com
2. Review webhook delivery (may be delayed)
3. Manually check transaction in Nayax dashboard
4. Background job will auto-reconcile after 1 hour

---

## Support Contacts

### Nayax Israel Support
📧 **Email:** support.israel@nayax.com  
☎️ **Phone:** +972-9-9709595  
🕐 **Hours:** Sun-Thu 9:00-18:00 Israel Time

### Pet Wash Technical Support
📧 **CTO:** [Your CTO Email]  
📧 **DevOps:** [Your DevOps Email]  
📱 **On-Call:** [Emergency Number]

---

## Compliance & Security

### PCI DSS Compliance

✅ **Pet Wash Ltd does NOT store card details**  
- All payments tokenized by Nayax
- No PAN (Primary Account Number) in our database
- Nayax is PCI Level 1 certified

### Data Retention

- **Transaction Logs:** 7 years (Israeli Tax Law)
- **Customer Data:** As per GDPR/Privacy Law
- **Audit Trail:** Immutable blockchain-style ledger

### Security Best Practices

1. **Never expose API keys** in logs or client code
2. **Rotate webhook secrets** every 90 days
3. **Monitor for unusual activity** (fraud detection)
4. **Enable 2FA** on Nayax dashboard account

---

## Next Steps After Setup

Once Nayax is live, you can:

✅ Start processing real customer payments on K9000 stations  
✅ Enable split payments on Sitter Suite marketplace  
✅ Activate GPS-validated payments for Walk My Pet  
✅ Launch PetTrek ride payments  
✅ Issue loyalty points and digital vouchers  

---

## Estimated Timeline

| Task | Duration | Responsible |
|------|----------|-------------|
| Contact Nayax | 1 day | Business Owner |
| Nayax Account Setup | 3-5 days | Nayax Sales Team |
| Receive API Credentials | 1-2 days | Nayax Support |
| Add Secrets to Replit | 10 minutes | Developer |
| Test Sandbox | 1 hour | Developer |
| Configure Webhooks | 30 minutes | Developer |
| Production Testing | 2 hours | QA Team |
| Go Live! | Instant | Business Owner |

**Total: ~7-10 business days from first contact to production**

---

## Document Updates

- **v1.0** (Nov 8, 2025) - Initial guide created
- **Next Review:** After Nayax keys received

---

**Questions?** Contact your CTO or refer to:  
📖 `docs/NAYAX_ISRAEL_COMPLIANCE_VERIFICATION.md`  
📖 `docs/API_SECURITY_MAP_2025.md`  
📖 `NAYAX_SPARK_API_INTEGRATION.md`
