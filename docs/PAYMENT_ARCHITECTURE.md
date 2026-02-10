# Payment Architecture - Pet Wash™

**Last Updated:** November 2, 2025  
**Status:** ⚠️ PAYMENT PROCESSING PAUSED - Awaiting Nayax Israel Contract

---

## 🏦 Single Payment Gateway Architecture

### Payment Processor (Gateway)
**ONLY Nayax Israel** - Exclusive payment processing partner

- **Company:** Nayax Israel (חברה בורסאית יציבה)
- **Legal Compliance:** Israeli law (תהליך סליקה חוקי ולפי חוקי המדינה)
- **Contract Status:** Pending signature with PetWash Ltd
- **Integration:** Nayax Spark/Lynx API

---

## 💳 Accepted Payment Methods (via Nayax)

All payment methods flow **THROUGH Nayax Israel**:

1. **Credit/Debit Cards** ✅
   - Visa, Mastercard, American Express
   - Israeli cards (Isracard, Max, Leumi Card)
   
2. **Apple Pay** ✅
   - Processed by Nayax Israel
   - Tokenized secure payments
   
3. **Google Pay** ✅
   - Processed by Nayax Israel
   - Tokenized secure payments

---

## 🚫 FORBIDDEN Payment Providers

The following payment processors are **NOT ALLOWED**:

- ❌ **Stripe** (user explicitly rejected 4+ times)
- ❌ **PayPal** (not integrated)
- ❌ **Square** (not integrated)
- ❌ Any other third-party payment processor

**Reason:** Single payment provider required for:
- Legal compliance with Israeli regulations
- Nayax contract requirements (expected)
- Unified financial reporting
- Israeli Tax Authority compliance

---

## 📱 Digital Wallet Integration (NON-PAYMENT)

**Apple Wallet & Google Wallet** are integrated for **NON-PAYMENT** purposes:

### ✅ Allowed Uses:
- **Loyalty Cards** - Pet Wash Club™ membership cards
- **E-Gift Cards** - Vouchers and promotional codes
- **Event Passes** - Franchise events, VIP access
- **Digital Business Cards** - Networking and contact sharing

### ❌ NOT Used For:
- Payment processing (handled by Nayax)
- Credit card storage (handled by Nayax)
- Transaction clearing (handled by Nayax)

---

## 🔄 Payment Flow Architecture

```
Customer Payment Journey:
┌─────────────────────────────────────────────────────────────┐
│ 1. Customer initiates payment                               │
│    - Walk My Pet™ booking                                   │
│    - K9000 wash station                                     │
│    - Sitter Suite™ service                                  │
│    - PetTrek™ transport                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Customer selects payment method                          │
│    ✓ Credit Card                                            │
│    ✓ Apple Pay                                              │
│    ✓ Google Pay                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ALL METHODS → NAYAX ISRAEL GATEWAY                       │
│    - Tokenization & security                                │
│    - Israeli VAT calculation (18%)                          │
│    - Currency: ILS (Israeli Shekel)                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Nayax processes payment                                  │
│    - Authorization                                           │
│    - Settlement                                              │
│    - Israeli Tax Authority reporting                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. PetWash™ receives confirmation                           │
│    - Transaction complete                                    │
│    - Service activated                                       │
│    - Receipt issued                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Compliance

### PCI-DSS Compliance
- Nayax Israel handles all card data
- No card numbers stored on PetWash servers
- Tokenization for recurring payments

### Israeli Regulatory Compliance
- VAT: 18% (Israeli standard rate)
- Currency: ILS only for Israeli operations
- Israeli Tax Authority automatic reporting
- Banking settlement via Mizrahi-Tefahot Bank

---

## 💼 Commission Structure (via Nayax)

All services process payments through Nayax with platform commissions:

| Service | Commission Split |
|---------|-----------------|
| **Walk My Pet™** | 15% platform / 85% walker |
| **PetTrek™** | 15% platform / 85% driver |
| **The Sitter Suite™** | 15% platform / 85% sitter |
| **K9000 Stations** | Full payment to PetWash Ltd |

---

## ⏸️ Current Status: PAYMENT PAUSED

**Reason:** Awaiting Nayax Israel contract signature

**Actions Required:**
1. ✅ Remove all Stripe references from codebase
2. ✅ Update legal documentation (Privacy Policy, Terms)
3. ✅ Configure Nayax API credentials
4. ⏳ Sign contract with Nayax Israel
5. ⏳ Test Nayax integration (sandbox)
6. ⏳ Enable live payment processing

**Estimated Go-Live:** Upon contract signature + integration testing

---

## 📞 Support Contact

**Nayax Israel:**
- Website: https://nayax.com
- Support: [Pending - add after contract]

**PetWash Ltd Payment Issues:**
- Email: payments@petwash.co.il
- Phone: [Add contact number]

---

## 🔄 Future Considerations

**Potential Future Payment Methods (via Nayax):**
- Bit (Israeli mobile payment)
- PayBox (Israeli payment app)
- Bank transfer integration
- Cryptocurrency (if Nayax supports)

**All future methods MUST go through Nayax Israel gateway.**

---

**Document Owner:** PetWash Ltd  
**Approved By:** CEO Nir Hadad  
**Last Review:** November 2, 2025
