# 🛡️ K9000 Station IP Allowlist Configuration
## Pet Wash™ - Production Security Lockdown

This guide explains how to configure the K9000 IP allowlist for production security.

---

## 🚨 **Current Status: DEVELOPMENT MODE**

**Security Warning**: All IPs currently allowed (dev mode)

```
[WARN] [K9000 Security] No IP whitelist configured - ALL IPs allowed (DEV MODE)
```

**Risk**: Any IP address can send commands to K9000 stations, including malicious actors.

---

## 🎯 **Purpose**

The IP allowlist restricts K9000 IoT API access to authorized sources only:
- **Franchise Management Offices**
- **Mobile Service Technicians** (dynamic IPs via VPN)
- **Replit Production Server** (for automated monitoring)
- **Pet Wash HQ** (Israel operations center)

---

## 📋 **Required Information**

Before configuring, collect:
1. **Franchise Office Static IPs** (from ISP)
2. **Mobile Technician VPN Range** (from VPN provider)
3. **Replit Server IPs** (from Replit dashboard)
4. **Pet Wash HQ IP** (Israel office)

---

## 🔧 **Configuration Methods**

### **Option A: Environment Variable (Recommended)**

#### **Step 1: Create IP List**
Create `.env` file with allowed IPs:
```env
# K9000 Station Security - Production IP Allowlist
K9000_ALLOWED_IPS=203.0.113.0/24,198.51.100.50,192.0.2.100,192.168.1.0/24

# Format: Comma-separated list
# Supports CIDR notation for ranges
# Example breakdown:
# - 203.0.113.0/24 = Franchise network (256 IPs)
# - 198.51.100.50 = Pet Wash HQ Israel
# - 192.0.2.100 = Replit production server
# - 192.168.1.0/24 = Mobile technician VPN range
```

#### **Step 2: Add to Replit Secrets**
```bash
# Via Replit Secrets panel (recommended)
# Key: K9000_ALLOWED_IPS
# Value: 203.0.113.0/24,198.51.100.50,192.0.2.100,192.168.1.0/24
```

#### **Step 3: Restart Application**
```bash
npm run dev
# Or use restart workflow button in Replit

# Verify in logs:
# [INFO] [K9000 Security] IP whitelist active: 4 entries loaded
```

---

### **Option B: Code Configuration (Advanced)**

Edit `server/middleware/k9000Security.ts`:

```typescript
// Production IP allowlist
const PRODUCTION_ALLOWED_IPS = [
  '203.0.113.0/24',      // Franchise network
  '198.51.100.50',       // Pet Wash HQ Israel
  '192.0.2.100',         // Replit production server
  '192.168.1.0/24',      // Mobile technician VPN
];

// Load from environment or use default
const allowedIPs = process.env.K9000_ALLOWED_IPS 
  ? process.env.K9000_ALLOWED_IPS.split(',').map(ip => ip.trim())
  : (process.env.NODE_ENV === 'production' ? PRODUCTION_ALLOWED_IPS : null);
```

---

## 🌐 **How to Find Your IPs**

### **1. Replit Production Server IP**
```bash
# Check Replit's outbound IP
curl -s https://api.ipify.org
# Example output: 192.0.2.100
```

### **2. Pet Wash HQ Office IP (Israel)**
```bash
# From HQ network, run:
curl -s https://ipinfo.io/ip
# Example output: 198.51.100.50

# Or visit: https://www.whatismyip.com
```

### **3. Franchise Office Static IP**
Contact franchise ISP for:
- Static IP address (if single office)
- IP range/CIDR (if multiple locations)
- Example: Business internet typically provides static IP

### **4. Mobile Technician VPN Range**
If using VPN for field technicians:
- Contact VPN provider for IP range
- Common VPN ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- Example (NordVPN): Contact support for dedicated IP

---

## 🧪 **Testing IP Allowlist**

### **Test 1: Verify Allowed IP**
```bash
# From allowed IP (e.g., HQ office):
curl -X POST https://petwash.co.il/api/k9000/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"stationId": "test", "command": "status"}'

# Expected: 200 OK
```

### **Test 2: Verify Blocked IP**
```bash
# From random public IP (not in allowlist):
curl -X POST https://petwash.co.il/api/k9000/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"stationId": "test", "command": "status"}'

# Expected: 403 Forbidden
# Response: {"error": "Access denied - IP not whitelisted"}
```

### **Test 3: Check Logs**
```bash
# Should see in logs:
# [INFO] [K9000 Security] Access granted: 198.51.100.50
# [WARN] [K9000 Security] Blocked unauthorized IP: 203.0.113.99
```

---

## 🔄 **IP Allowlist Management Workflow**

### **Adding New IPs (Standard Process)**

1. **Request Approval**
   - Requester: Submit IP addition request with business justification
   - Approver: Operations Director (Ido Shakarzi)
   - Timeline: 24-48 hours for security review

2. **Update Configuration**
   ```bash
   # Add to existing K9000_ALLOWED_IPS in Replit Secrets
   # Old: 203.0.113.0/24,198.51.100.50
   # New: 203.0.113.0/24,198.51.100.50,192.0.2.150
   ```

3. **Deploy & Verify**
   - Restart application
   - Test from new IP
   - Monitor logs for 24 hours
   - Document change in security log

### **Emergency IP Addition (24/7 Support)**

**Scenario**: Field technician needs urgent K9000 access

**Process**:
1. Technician reports incident with station ID
2. On-call engineer verifies identity
3. Add temporary IP with 7-day expiration
4. Log emergency access in audit trail
5. Review and remove after incident resolution

---

## 📊 **Security Monitoring**

### **Daily Review**
```bash
# Check blocked IPs
grep "K9000 Security.*Blocked" /tmp/logs/Start_application_*.log | tail -20

# Alert on suspicious patterns:
# - Multiple blocks from same IP (potential attack)
# - Blocks from unexpected countries
# - Blocks during off-hours
```

### **Weekly Audit**
- Review all IP additions/removals
- Verify current allowlist is minimal
- Remove expired temporary IPs
- Check for VPN range changes

### **Monthly Security Report**
- Total blocked attempts
- Geographic distribution of blocks
- Allowlist change history
- Recommendations for tightening

---

## 🚨 **Troubleshooting**

### **Problem**: "Access denied - IP not whitelisted" from authorized location

**Solutions**:
1. **Verify current IP**: `curl -s https://ipinfo.io/ip`
2. **Check if IP changed**: ISPs may rotate even "static" IPs
3. **Verify CIDR range**: Ensure IP falls within configured range
4. **Check VPN**: If using VPN, verify VPN IP is in allowlist

### **Problem**: Technician can't access K9000 from field

**Solutions**:
1. **Use VPN**: Ensure technician connects via company VPN first
2. **Emergency access**: Request temporary IP addition (see workflow above)
3. **Alternative**: Use mobile app with proper authentication (bypasses IP check)

### **Problem**: "All IPs allowed" warning persists

**Solutions**:
1. **Verify env variable**: `echo $K9000_ALLOWED_IPS`
2. **Check Replit Secrets**: Ensure `K9000_ALLOWED_IPS` exists
3. **Restart workflow**: Changes require application restart
4. **Check logs**: Look for "IP whitelist active" message

---

## ✅ **Production Deployment Checklist**

- [ ] Static IPs obtained from all franchise locations
- [ ] VPN range configured for mobile technicians
- [ ] Replit production server IP identified
- [ ] Pet Wash HQ Israel IP confirmed
- [ ] `K9000_ALLOWED_IPS` environment variable set
- [ ] Application restarted with new configuration
- [ ] Test from authorized IP (200 OK)
- [ ] Test from unauthorized IP (403 Forbidden)
- [ ] Logs show "IP whitelist active" message
- [ ] IP management workflow documented
- [ ] Security team trained on emergency access
- [ ] Monthly audit schedule configured

---

## 📅 **IP Allowlist Update Schedule**

### **Quarterly Reviews** (Every 3 months)
- Audit all IPs in allowlist
- Remove decommissioned locations
- Update VPN ranges if changed
- Verify franchise office IPs

### **Annual Security Audit** (Yearly)
- Full review of IP allowlist security
- Update IP management procedures
- Test emergency access workflow
- Document lessons learned

---

## 🎯 **Next Steps**

1. **Immediate (Day 1)**
   - Gather all required static IPs
   - Set `K9000_ALLOWED_IPS` environment variable
   - Test from all authorized locations

2. **Short-term (Week 1)**
   - Document emergency access procedure
   - Train operations team on IP management
   - Set up monitoring alerts

3. **Long-term (Month 1)**
   - Implement quarterly review process
   - Create security incident response plan
   - Integrate with centralized security monitoring

**Once configured, K9000 stations will only accept commands from authorized IPs!** 🛡️
