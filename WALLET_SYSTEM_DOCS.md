# Pet Wash™ Digital Wallet System

## Overview
Complete digital wallet integration featuring VIP loyalty cards, e-vouchers, and personal business cards for Apple Wallet and Google Wallet with Nayax QR scanner integration and AI fraud detection.

## Features

### 1. VIP Loyalty Cards
- **Premium Bank-Card Design**: Luxury card styling matching Amex/Visa aesthetics
- **4-Tier System**: Bronze, Silver, Gold, Platinum with tier-specific colors
- **Real-Time Updates**: Points balance and discount updates automatically
- **QR Code Integration**: Nayax-compatible QR codes with loyalty data
- **Location-Based Notifications**: Alerts when near Pet Wash stations
- **AI Fraud Protection**: Multi-signal fraud detection on all downloads

### 2. Personal Business Cards
- **vCard Format**: Industry-standard digital contact cards
- **NFC Sharing**: Tap iPhones together (NameDrop/AirDrop)
- **QR Code**: Easy scanning for contacts
- **Customizable**: Title and phone number fields
- **Professional**: Company branding and social media links

### 3. E-Vouchers
- **QR Code Redemption**: Scannable at Pet Wash stations
- **Expiry Tracking**: Automatic expiration dates
- **Dynamic Updates**: Real-time balance updates

## User Access

### Public Pages
- `/wallet` - Public wallet download page (everyone)
- `/my-wallet` - Personal download page (authenticated users)
- `/team-cards` - Team business cards (everyone)

### Download Your Cards
**For Nir Hadad (nirhadad1@gmail.com):**
1. Visit: `https://petwash.co.il/my-wallet`
2. Sign in with nirhadad1@gmail.com
3. Download VIP Loyalty Card
4. Download Personal Business Card

Both cards will be ready to add to your iPhone's Apple Wallet!

## Nayax Terminal Integration

### QR Code Format
Loyalty cards contain JSON data readable by Nayax QR scanners:

```json
{
  "type": "PETWASH_VIP_LOYALTY",
  "userId": "user_unique_id",
  "userEmail": "user@example.com",
  "tier": "platinum",
  "discountPercent": 15,
  "points": 2500,
  "timestamp": 1729785600000,
  "version": "1.0"
}
```

### Terminal Endpoints

#### Redeem Loyalty Card
**POST** `/api/wallet/nayax/redeem-loyalty`

Headers:
```
X-Terminal-Secret: <NAYAX_TERMINAL_SECRET>
```

Request Body:
```json
{
  "qrData": "{\"type\":\"PETWASH_VIP_LOYALTY\",...}",
  "terminalId": "TERMINAL_001",
  "stationId": "STATION_TEL_AVIV"
}
```

Response:
```json
{
  "success": true,
  "loyalty": {
    "tier": "platinum",
    "discountPercent": 15,
    "points": 2500,
    "userName": "Nir Hadad"
  },
  "message": "15% VIP discount applied"
}
```

#### Verify Loyalty Card
**GET** `/api/wallet/nayax/verify-loyalty/:userId`

Headers:
```
X-Terminal-Secret: <NAYAX_TERMINAL_SECRET>
```

Response:
```json
{
  "userId": "abc123",
  "tier": "platinum",
  "discountPercent": 15,
  "points": 2500,
  "active": true
}
```

## AI Fraud Detection

### Protection Features
1. **Rapid Download Detection**: Flags >5 downloads in 1 hour
2. **IP Anomaly Detection**: Identifies new/suspicious IP addresses
3. **Device Fingerprinting**: Tracks device changes
4. **Account Age Verification**: Higher scrutiny for new accounts
5. **Email Verification Check**: Requires verified email
6. **VPN/Proxy Detection**: Flags suspicious network usage
7. **Time Pattern Analysis**: Detects unusual activity hours

### Risk Scoring
- **0-39**: Low Risk → Allow
- **40-69**: Medium Risk → Challenge (2FA recommended)
- **70-100**: High Risk → Block

### Fraud Logs
All wallet requests are logged to Firestore:
- Collection: `fraud_logs`
- Collection: `wallet_downloads`
- Collection: `loyalty_redemptions`

## API Endpoints

### Authenticated Endpoints

#### Generate VIP Loyalty Card
**POST** `/api/wallet/vip-card`
- Requires: Firebase session authentication
- Returns: `.pkpass` file for Apple Wallet
- Security: AI fraud detection, session validation
- Logging: Automatic download tracking

#### Generate E-Voucher
**POST** `/api/wallet/e-voucher`
- Requires: Firebase session authentication
- Body: `{ "voucherId": "voucher_id" }`
- Returns: `.pkpass` file

#### Generate Personal Business Card
**POST** `/api/wallet/my-business-card`
- Requires: Firebase session authentication
- Body: `{ "title": "CEO", "phone": "+972..." }`
- Returns: `.pkpass` file with vCard data

## Apple Wallet Integration

### Pass Updates
Apple Wallet supports automatic updates via web service protocol:

1. **Device Registration**: Pass registers with server
2. **Update Notifications**: Server pushes update notifications
3. **Pass Retrieval**: Device fetches updated pass

Endpoints:
- `POST /api/wallet/v1/devices/:deviceID/registrations/:passTypeID/:serialNumber`
- `GET /api/wallet/v1/passes/:passTypeID/:serialNumber`
- `DELETE /api/wallet/v1/devices/:deviceID/registrations/:passTypeID/:serialNumber`

### Location-Based Notifications
Passes show notifications when user is near:
- Tel Aviv Central: (32.0853, 34.7818)
- Jerusalem: (31.7683, 35.2137)

Message: "🐾 Pet Wash station nearby! Show your VIP card for discount."

## Google Wallet Integration
Coming soon - similar functionality for Android devices.

## Security Features

### Certificate Management
Required environment variables:
- `APPLE_WWDR_CERT` - Apple WWDR certificate
- `APPLE_SIGNER_CERT` - Pass signing certificate
- `APPLE_SIGNER_KEY` - Private key
- `APPLE_KEY_PASSPHRASE` - Key passphrase
- `APPLE_PASS_TYPE_ID` - Pass type identifier
- `APPLE_TEAM_ID` - Apple Developer Team ID

### Terminal Authentication
Required environment variable:
- `NAYAX_TERMINAL_SECRET` - Secret for terminal API access

### Session Security
- Firebase session cookies (`pw_session`)
- User ID validated server-side
- No client-side trust of userId

## Testing

### Test VIP Card Download
1. Sign in at `/signin` with test account
2. Navigate to `/my-wallet`
3. Click "Download VIP Card"
4. Open `.pkpass` file on iPhone
5. Add to Apple Wallet

### Test Nayax Redemption
```bash
curl -X POST https://petwash.co.il/api/wallet/nayax/redeem-loyalty \
  -H "X-Terminal-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "qrData": "{\"type\":\"PETWASH_VIP_LOYALTY\",\"userId\":\"test\",\"tier\":\"gold\",\"discountPercent\":10}",
    "terminalId": "TEST_001",
    "stationId": "TEST_STATION"
  }'
```

## Monitoring

### Firestore Collections
- `apple_wallet_passes` - All generated passes
- `wallet_device_registrations` - Device registrations
- `fraud_logs` - Security events
- `wallet_downloads` - Download history
- `loyalty_redemptions` - QR scan history

### Logs
All operations logged with Winston:
- `[Wallet API]` - Pass generation
- `[Nayax]` - Terminal operations
- `[Fraud Detection]` - Security events
- `[Wallet Web Service]` - Apple update protocol

## Troubleshooting

### "Apple Wallet is not configured"
Check environment variables for Apple certificates.

### "Invalid terminal authentication"
Verify `NAYAX_TERMINAL_SECRET` matches terminal configuration.

### "Fraud detection blocked request"
Review `fraud_logs` collection for signals. Contact support if legitimate.

### Pass not updating
1. Check device registration in `wallet_device_registrations`
2. Verify user's loyalty data changed in Firestore
3. Check `[Wallet Web Service]` logs

## Future Enhancements
- [ ] Google Wallet implementation
- [ ] Push notification to update passes
- [ ] Batch pass generation for marketing
- [ ] Advanced fraud detection with ML
- [ ] Wallet analytics dashboard
- [ ] Multi-language pass content
- [ ] Custom pass designs per tier

## Support
For issues or questions:
- Technical: Check logs in Firestore and server logs
- Security: Review fraud_logs collection
- Nayax Integration: Contact Nayax terminal support
- Apple Wallet: Verify certificate expiration dates
