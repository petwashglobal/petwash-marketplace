# Email Authentication Setup Guide (SPF, DKIM, DMARC)

**Enterprise-Grade Email Security for Pet Wash™**

Make your emails look professional, trustworthy, and never land in spam.

---

## 🎯 Why This Matters

Without proper email authentication:
- ❌ Emails land in spam/junk
- ❌ Users don't trust your messages
- ❌ Gmail/Outlook flags you as suspicious
- ❌ Your domain gets blacklisted

With proper authentication:
- ✅ Emails land in inbox
- ✅ Professional "Verified" badge
- ✅ Higher open rates
- ✅ Build customer trust

---

## 📧 A. Google Workspace Setup

### A-1. Why Google Workspace?

**Free alternatives** (Gmail, SendGrid free tier):
- Limited features
- Shared IP addresses (poor reputation)
- No custom domain emails

**Google Workspace** ($6-12/user/month):
- Professional email addresses (`Support@PetWash.co.il`)
- Enterprise-grade deliverability
- 99.9% uptime guarantee
- Advanced security features

### A-2. Setup Steps

1. **Sign up** at [workspace.google.com](https://workspace.google.com)
2. **Verify domain ownership**: Add TXT record to DNS
3. **Create email addresses**:
   - `Support@PetWash.co.il` (customer support)
   - `no-reply@petwash.co.il` (automated emails)
   - `admin@petwash.co.il` (admin notifications)
   - `dmarc@petwash.co.il` (DMARC reports)

---

## 🔐 B. SPF (Sender Policy Framework)

### B-1. What is SPF?

SPF tells email servers **which IP addresses** can send email from your domain.

Without SPF: Anyone can spoof `@petwash.co.il` emails (phishing risk!)

### B-2. Add SPF Record

**DNS Provider**: Cloudflare (or your registrar)

**Record Type**: `TXT`  
**Name**: `@` (or `petwash.co.il`)  
**Value**:
```
v=spf1 include:_spf.google.com ~all
```

**Explanation**:
- `v=spf1` = SPF version 1
- `include:_spf.google.com` = Allow Google Workspace to send
- `~all` = Softfail for others (recommended for testing)

### B-3. Verify SPF

Test at: [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx)

Enter: `petwash.co.il`

**Expected result**: ✅ SPF record found

---

## 🔑 C. DKIM (DomainKeys Identified Mail)

### C-1. What is DKIM?

DKIM adds a **digital signature** to your emails proving they're from you.

Like a wax seal on a letter - can't be forged!

### C-2. Generate DKIM Key

**Google Admin Console**:
1. Go to **Apps → Google Workspace → Gmail → Authenticate email**
2. Select **Generate new record**
3. Choose **2048-bit key** (most secure)
4. Copy the TXT record

### C-3. Add DKIM Record to DNS

**Record Type**: `TXT`  
**Name**: `google._domainkey` (or as provided by Google)  
**Value**: (Long string from Google Admin)

Example:
```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
```

### C-4. Activate DKIM

**Google Admin Console**:
1. Return to **Authenticate email**
2. Click **Start authentication**

### C-5. Verify DKIM

Test at: [mxtoolbox.com/dkim.aspx](https://mxtoolbox.com/dkim.aspx)

**Selector**: `google`  
**Domain**: `petwash.co.il`

**Expected result**: ✅ DKIM signature valid

---

## 📊 D. DMARC (Domain-based Message Authentication)

### D-1. What is DMARC?

DMARC tells email servers **what to do** if SPF or DKIM fails.

Also sends you **daily reports** on who's sending emails from your domain.

### D-2. DMARC Policy Levels

**Start with monitoring** (recommended):
```
p=none
```
Monitors only, doesn't block anything. Sends you reports.

**Move to quarantine** (after 1-2 weeks):
```
p=quarantine
```
Suspicious emails go to spam folder.

**Final: strict rejection** (production):
```
p=reject
```
Failed emails are completely blocked.

### D-3. Add DMARC Record

**Record Type**: `TXT`  
**Name**: `_dmarc`  
**Value** (monitoring mode):
```
v=DMARC1; p=none; rua=mailto:dmarc@petwash.co.il; fo=1
```

**Explanation**:
- `v=DMARC1` = DMARC version 1
- `p=none` = Monitoring mode (don't block anything yet)
- `rua=mailto:dmarc@petwash.co.il` = Send aggregate reports here
- `fo=1` = Send forensic reports on SPF/DKIM failures

### D-4. Production DMARC (After Testing)

After 2-4 weeks of monitoring, upgrade to:
```
v=DMARC1; p=reject; rua=mailto:dmarc@petwash.co.il; pct=100; fo=1
```

Changes:
- `p=reject` = Block failed emails
- `pct=100` = Apply to 100% of emails

### D-5. Verify DMARC

Test at: [mxtoolbox.com/dmarc.aspx](https://mxtoolbox.com/dmarc.aspx)

Enter: `petwash.co.il`

**Expected result**: ✅ DMARC record found

---

## 🎨 E. Gmail Brand Indicators (BIMI)

### E-1. What is BIMI?

Displays your **logo next to emails** in Gmail/Yahoo/Apple Mail.

Requires:
- ✅ SPF + DKIM + DMARC configured
- ✅ Registered trademark
- ✅ Logo in SVG format

**Cost**: $1,500-2,000/year for VMC (Verified Mark Certificate)

**Recommended**: Set up later after core authentication working

---

## 🧪 F. Testing Your Email Authentication

### F-1. Complete Test Checklist

**Test #1: SPF**
- Go to [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx)
- Enter `petwash.co.il`
- ✅ Result: "SPF record published"

**Test #2: DKIM**
- Go to [mxtoolbox.com/dkim.aspx](https://mxtoolbox.com/dkim.aspx)
- Selector: `google`, Domain: `petwash.co.il`
- ✅ Result: "DKIM signature valid"

**Test #3: DMARC**
- Go to [mxtoolbox.com/dmarc.aspx](https://mxtoolbox.com/dmarc.aspx)
- Enter `petwash.co.il`
- ✅ Result: "DMARC record found"

**Test #4: Full Email Test**
- Send test email to: [mail-tester.com](https://www.mail-tester.com/)
- Check score: **10/10** ✅

### F-2. Real-World Testing

Send test emails to:
1. ✅ Gmail account
2. ✅ Outlook/Hotmail account
3. ✅ Yahoo account
4. ✅ ProtonMail account

Check:
- Landed in **Inbox** (not spam)
- **From** address shows `Pet Wash™ Ltd <Support@PetWash.co.il>`
- No "suspicious" warnings

---

## 📋 G. DNS Records Summary

### G-1. Complete DNS Configuration

Add these records to your DNS provider:

```
# SPF Record
Type: TXT
Name: @
Value: v=spf1 include:_spf.google.com ~all

# DKIM Record (get from Google Admin)
Type: TXT
Name: google._domainkey
Value: v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w... (long string)

# DMARC Record (monitoring mode)
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@petwash.co.il; fo=1

# DMARC Record (production mode - use after testing)
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=reject; rua=mailto:dmarc@petwash.co.il; pct=100; fo=1
```

### G-2. Propagation Time

DNS changes take **24-48 hours** to fully propagate worldwide.

Test after 24 hours for best results.

---

## 🚀 H. SendGrid Integration

### H-1. Why SendGrid?

Pet Wash™ uses **SendGrid** (already configured) for:
- Transactional emails (receipts, confirmations)
- Marketing emails (promotions, newsletters)
- High deliverability (99%+ inbox rate)

### H-2. SendGrid DNS Setup

**Already configured**, but verify these records exist:

```
# SendGrid domain authentication
Type: CNAME
Name: em1234.petwash.co.il
Value: u1234567.wl.sendgrid.net

# SendGrid DKIM keys
Type: CNAME
Name: s1._domainkey.petwash.co.il
Value: s1.domainkey.u1234567.wl.sendgrid.net

Type: CNAME
Name: s2._domainkey.petwash.co.il
Value: s2.domainkey.u1234567.wl.sendgrid.net
```

**Note**: Exact values provided by SendGrid dashboard.

---

## 📱 I. Professional Email Signatures

### I-1. Example Signature

```
Best regards,
Pet Wash™ Customer Success Team

📧 Support@PetWash.co.il
🌐 www.petwash.co.il
📍 Tel Aviv, Israel

🐾 Premium Organic Pet Care Since 2025
```

### I-2. Google Workspace Settings

**Gmail → Settings → Signature**

Add HTML signature with:
- Company name and logo
- Contact information
- Social media links
- Legal disclaimer (if needed)

---

## ✅ J. Production Checklist

### Before Launch:

**Google Workspace**:
- [ ] Domain verified
- [ ] Email addresses created
- [ ] MX records configured

**SPF**:
- [ ] TXT record added to DNS
- [ ] Verified at mxtoolbox.com
- [ ] Test email sent successfully

**DKIM**:
- [ ] Generated 2048-bit key
- [ ] TXT record added to DNS
- [ ] Authentication started in Google Admin
- [ ] Verified at mxtoolbox.com

**DMARC**:
- [ ] TXT record added (monitoring mode)
- [ ] Verified at mxtoolbox.com
- [ ] Report email (`dmarc@petwash.co.il`) created

**Testing**:
- [ ] 10/10 score on mail-tester.com
- [ ] Emails land in inbox (Gmail, Outlook, Yahoo)
- [ ] No spam warnings
- [ ] From address shows correct brand name

**After 2-4 Weeks**:
- [ ] Review DMARC reports
- [ ] Upgrade to `p=reject` if all passing
- [ ] Consider BIMI for brand logo

---

## 🆘 K. Troubleshooting

### Issue: Emails still going to spam

**Solutions**:
1. Check SPF/DKIM/DMARC all passing
2. Verify "From" address uses authenticated domain
3. Avoid spam trigger words (FREE, URGENT, LIMITED TIME)
4. Include unsubscribe link
5. Warm up IP address (send gradually increasing volumes)

### Issue: DMARC reports show failures

**Solutions**:
1. Check SPF record includes all sending services
2. Verify DKIM keys match between DNS and Google Admin
3. Ensure forwarded emails don't break SPF alignment

### Issue: DNS records not propagating

**Solutions**:
1. Wait 24-48 hours
2. Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
3. Check records at multiple DNS checkers

---

## 📚 L. Additional Resources

- [Google Workspace Email Authentication](https://support.google.com/a/answer/81126)
- [SPF Record Checker](https://mxtoolbox.com/spf.aspx)
- [DKIM Validator](https://mxtoolbox.com/dkim.aspx)
- [DMARC Analyzer](https://mxtoolbox.com/dmarc.aspx)
- [Email Deliverability Tester](https://www.mail-tester.com/)

---

**Last Updated**: November 2025  
**Maintained By**: Pet Wash™ Engineering Team
