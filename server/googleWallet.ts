/**
 * Google Wallet API Integration
 * 
 * Generates Google Wallet passes for Android users:
 * - VIP Loyalty Cards
 * - E-Vouchers
 * - Digital Business Cards
 * 
 * Docs: https://developers.google.com/wallet
 */

import { logger } from './lib/logger';
import { db } from './lib/firebase-admin';

interface GoogleWalletVIPData {
  userId: string;
  userName: string;
  userEmail: string;
  tier: 'new' | 'silver' | 'gold' | 'platinum' | 'diamond';
  points: number;
  discountPercent: number;
  memberSince: Date;
}

interface GoogleWalletVoucherData {
  voucherId: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  expiryDate: Date;
  qrCode: string;
  description: string;
}

interface GoogleWalletBookingData {
  requestId: string;
  userId: string;
  userName: string;
  serviceLabel: string;
  providerName?: string | null;
  providerAddress?: string | null;
  scheduledAt?: Date | null;
  dateLabel: string;
  timeLabel: string;
  totalCents?: number | null;
  subtotalCents?: number | null;
  feeCents?: number | null;
  currency?: string;
}

interface GoogleWalletBusinessCardData {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  mobile?: string;
  website: string;
  socialMedia: {
    tiktok?: string;
    instagram?: string;
    facebook?: string;
  };
  photoUrl?: string;
}

export class GoogleWalletService {
  /**
   * Check if Google Wallet credentials are configured
   */
  static hasValidCredentials(): boolean {
    return !!(
      process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT
    );
  }

  /**
   * Generate JWT for Google Wallet VIP Loyalty Card
   */
  static async generateVIPCardJWT(data: GoogleWalletVIPData): Promise<string> {
    try {
      const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
      const classId = `${issuerId}.petwash_vip_loyalty`;
      const objectId = `${issuerId}.${data.userId}_${Date.now()}`;

      // Tier colors (7-TIER LUXURY SYSTEM: Bronze→Royal)
      const tierColors = {
        new: { hex: '#94a3b8', rgb: 'rgb(148, 163, 184)' },        // Slate
        silver: { hex: '#cbd5e1', rgb: 'rgb(203, 213, 225)' },     // Silver
        gold: { hex: '#fbbf24', rgb: 'rgb(251, 191, 36)' },        // Amber/Gold
        platinum: { hex: '#e5e7eb', rgb: 'rgb(229, 231, 235)' },   // Platinum
        diamond: { hex: '#3b82f6', rgb: 'rgb(59, 130, 246)' }      // Diamond Blue
      };

      const colors = tierColors[data.tier];

      // Create loyalty object
      const loyaltyObject = {
        id: objectId,
        classId: classId,
        state: 'ACTIVE',
        accountId: data.userId,
        accountName: data.userName,
        
        // Barcode for station scanning (Nayax DOT scanner compatible)
        barcode: {
          type: 'QR_CODE',
          value: `PETWASH_VIP_${data.userId}_${Date.now()}`,
          alternateText: data.userId
        },

        // Loyalty points
        loyaltyPoints: {
          label: 'נקודות / Points',
          balance: {
            int: data.points
          }
        },

        // Card details
        textModulesData: [
          {
            header: 'Tier / דרגה',
            body: data.tier.toUpperCase(),
            id: 'tier'
          },
          {
            header: 'Discount / הנחה',
            body: `${data.discountPercent}%`,
            id: 'discount'
          },
          {
            header: 'Member Since / חבר מאז',
            body: data.memberSince.toLocaleDateString('he-IL'),
            id: 'memberSince'
          }
        ],

        // REAL K9000 stations ONLY — both in Kfar Saba (Isaac Wald Park + Green Kfar
        // Saba/Park 80). The old Tel Aviv & Jerusalem points were FAKE (no station
        // there) and must not fire proximity alerts. Source: stationRegistry.ts.
        locations: [
          {
            latitude: 32.179964,
            longitude: 34.925016,
            kind: 'walletobjects#latLongPoint'
          },
          {
            latitude: 32.1982242,
            longitude: 34.892436,
            kind: 'walletobjects#latLongPoint'
          }
        ],

        // Messages
        messages: [
          {
            header: 'Welcome to Pet Wash VIP!',
            body: 'Enjoy exclusive discounts and rewards',
            id: 'welcome'
          }
        ]
      };

      // Create loyalty class (template)
      const loyaltyClass = {
        id: classId,
        issuerName: '⁦PetWash™⁩',
        programName: 'VIP Loyalty Program',
        programLogo: {
          sourceUri: {
            uri: 'https://petwash.co.il/brand/petwash-logo-official.png'
          }
        },
        reviewStatus: 'UNDER_REVIEW',
        hexBackgroundColor: colors.hex,
        localizedIssuerName: {
          defaultValue: {
            language: 'en',
            value: '⁦PetWash™⁩'
          },
          translatedValues: [
            {
              language: 'he',
              value: 'פט ווש™'
            }
          ]
        },
        localizedProgramName: {
          defaultValue: {
            language: 'en',
            value: 'VIP Loyalty Program'
          },
          translatedValues: [
            {
              language: 'he',
              value: 'תוכנית נאמנות VIP'
            }
          ]
        }
      };

      // Create unsigned JWT (Google Wallet will sign it)
      const claims = {
        iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        origins: ['https://petwash.co.il'],
        typ: 'savetowallet',
        payload: {
          loyaltyObjects: [loyaltyObject]
        }
      };

      // Store pass metadata in Firestore
      await this.storePassMetadata({
        userId: data.userId,
        passId: objectId,
        classId: classId,
        type: 'google_vip_card',
        tier: data.tier,
        points: data.points,
        platform: 'google_wallet',
        createdAt: new Date()
      });

      // Return unsigned JWT for client-side Google Wallet button
      return Buffer.from(JSON.stringify(claims)).toString('base64url');

    } catch (error) {
      logger.error('[Google Wallet] Error generating VIP card JWT:', error);
      throw new Error('Failed to generate Google Wallet VIP card');
    }
  }

  /**
   * Generate JWT for Google Wallet E-Voucher
   */
  static async generateEVoucherJWT(data: GoogleWalletVoucherData): Promise<string> {
    try {
      const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
      const classId = `${issuerId}.petwash_voucher`;
      const objectId = `${issuerId}.${data.voucherId}_${Date.now()}`;

      // TOTP secret for this pass — per-voucher, stored in env or derived from issuer key
      const totpSecret = process.env.GOOGLE_WALLET_TOTP_SECRET || process.env.PASS_TOKEN_SECRET || '';

      // Create generic object (voucher type)
      const genericObject = {
        id: objectId,
        classId: classId,
        state: 'ACTIVE',

        // Static fallback barcode (used on older Android / low-signal situations)
        barcode: {
          type: 'QR_CODE',
          value: data.qrCode,
          alternateText: data.voucherId,
        },

        // 2026 Rotating barcode — prevents screenshot abuse.
        // Rotates every 60 seconds using TOTP_SHA1.
        // K9000 scanner calls /api/k9000/verify-rotating-qr to validate.
        ...(totpSecret ? {
          rotatingBarcode: {
            type: 'QR_CODE',
            totpDetails: {
              algorithm: 'TOTP_SHA1',
              periodMillis: '60000',
              parameters: [{
                key: totpSecret,
                valueLength: '8',
              }],
            },
            renderEncoding: 'UTF_8',
            initialRotatingBarcodeValues: {
              startDateTime: new Date().toISOString(),
              values: [],
              periodMillis: '60000',
            },
          },
        } : {}),

        // Card details
        cardTitle: {
          defaultValue: {
            language: 'en',
            value: 'Pet Wash Voucher'
          },
          translatedValues: [
            {
              language: 'he',
              value: 'שובר פט ווש'
            }
          ]
        },

        header: {
          defaultValue: {
            language: 'en',
            value: `${data.currency === 'ILS' ? '₪' : '$'}${data.amount}`
          }
        },

        textModulesData: [
          {
            header: 'Expires / תוקף עד',
            body: data.expiryDate.toLocaleDateString('he-IL'),
            id: 'expiry'
          },
          {
            header: 'Description / תיאור',
            body: data.description,
            id: 'description'
          }
        ],

        validTimeInterval: {
          start: {
            date: new Date().toISOString()
          },
          end: {
            date: data.expiryDate.toISOString()
          }
        }
      };

      const claims = {
        iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        origins: ['https://petwash.co.il'],
        typ: 'savetowallet',
        payload: {
          genericObjects: [genericObject]
        }
      };

      // Store metadata
      await this.storePassMetadata({
        userId: data.userId,
        passId: objectId,
        classId: classId,
        type: 'google_voucher',
        voucherId: data.voucherId,
        amount: data.amount,
        platform: 'google_wallet',
        createdAt: new Date()
      });

      return Buffer.from(JSON.stringify(claims)).toString('base64url');

    } catch (error) {
      logger.error('[Google Wallet] Error generating voucher JWT:', error);
      throw new Error('Failed to generate Google Wallet voucher');
    }
  }

  /**
   * Generate JWT for Digital Business Card (vCard)
   */
  static async generateBusinessCardJWT(data: GoogleWalletBusinessCardData): Promise<string> {
    try {
      const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
      const classId = `${issuerId}.petwash_business_card`;
      const objectId = `${issuerId}.${data.email.replace('@', '_at_')}_${Date.now()}`;

      // Create vCard format QR code
      const vCardData = `BEGIN:VCARD
VERSION:3.0
FN:${data.name}
TITLE:${data.title}
ORG:${data.company}
TEL;TYPE=WORK:${data.phone}
${data.mobile ? `TEL;TYPE=CELL:${data.mobile}` : ''}
EMAIL:${data.email}
URL:${data.website}
${data.socialMedia.tiktok ? `X-SOCIALPROFILE;TYPE=tiktok:${data.socialMedia.tiktok}` : ''}
${data.socialMedia.instagram ? `X-SOCIALPROFILE;TYPE=instagram:${data.socialMedia.instagram}` : ''}
${data.socialMedia.facebook ? `X-SOCIALPROFILE;TYPE=facebook:${data.socialMedia.facebook}` : ''}
END:VCARD`;

      const genericObject = {
        id: objectId,
        classId: classId,
        state: 'ACTIVE',
        
        // QR code with vCard data
        barcode: {
          type: 'QR_CODE',
          value: vCardData,
          alternateText: data.name
        },

        cardTitle: {
          defaultValue: {
            language: 'en',
            value: data.name
          }
        },

        header: {
          defaultValue: {
            language: 'en',
            value: data.title
          }
        },

        subheader: {
          defaultValue: {
            language: 'en',
            value: data.company
          }
        },

        textModulesData: [
          {
            header: 'Email',
            body: data.email,
            id: 'email'
          },
          {
            header: 'Phone',
            body: data.phone,
            id: 'phone'
          },
          {
            header: 'Website',
            body: data.website,
            id: 'website'
          }
        ],

        linksModuleData: {
          uris: [
            {
              uri: `mailto:${data.email}`,
              description: 'Email',
              id: 'email_link'
            },
            {
              uri: `tel:${data.phone}`,
              description: 'Call',
              id: 'call_link'
            },
            {
              uri: data.website,
              description: 'Website',
              id: 'website_link'
            }
          ]
        }
      };

      const claims = {
        iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        origins: ['https://petwash.co.il'],
        typ: 'savetowallet',
        payload: {
          genericObjects: [genericObject]
        }
      };

      logger.info('[Google Wallet] Business card JWT generated', { name: data.name });

      return Buffer.from(JSON.stringify(claims)).toString('base64url');

    } catch (error) {
      logger.error('[Google Wallet] Error generating business card JWT:', error);
      throw new Error('Failed to generate Google Wallet business card');
    }
  }

  /**
   * Generate JWT for Google Wallet Booking Pass (Generic Object).
   *
   * NOT a redemption credential — encodes the plain requestId (same value
   * shown on the confirmation page). Ownership is enforced upstream in
   * the route handler (must match the caller's uid). Companion to the
   * Apple `generateBookingPass` on the BookingConfirmedHero.
   *
   * Returns a base64url-encoded, unsigned save-to-wallet JWT that the
   * client pastes into `https://pay.google.com/gp/v/save/{jwt}`.
   */
  static async generateBookingPassJWT(data: GoogleWalletBookingData): Promise<string> {
    try {
      const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
      if (!issuerId) throw new Error('GOOGLE_WALLET_ISSUER_ID not set');

      const classId = `${issuerId}.petwash_booking`;
      // Deterministic per-booking objectId — safe to re-issue for the same
      // booking without piling up phantom passes in Google Wallet.
      const objectId = `${issuerId}.booking_${data.requestId}`;

      const currency = data.currency || 'ILS';
      const ils = (cents?: number | null) =>
        typeof cents === 'number' ? `₪${(cents / 100).toFixed(2)}` : '';

      // Compose the primary "hero" text lines shown on the pass front.
      const heroLines: Array<{ header: string; body: string }> = [
        { header: 'DATE', body: `${data.dateLabel} · ${data.timeLabel}` },
      ];
      if (data.providerName)   heroLines.push({ header: 'PROVIDER', body: data.providerName });
      if (data.providerAddress) heroLines.push({ header: 'LOCATION', body: data.providerAddress });
      if (typeof data.totalCents === 'number') {
        heroLines.push({ header: 'TOTAL', body: ils(data.totalCents) });
      }

      const textModulesData = heroLines.slice(0, 4).map((line, idx) => ({
        id: `line_${idx}`,
        header: line.header,
        body: line.body,
      }));

      // Generic object — Google's canonical "event ticket / booking" shape.
      // Uses the same black+gold palette the Apple pass and the client
      // ticket hero already carry.
      const genericObject: Record<string, unknown> = {
        id: objectId,
        classId,
        state: 'ACTIVE',
        cardTitle: {
          defaultValue: { language: 'en', value: 'Pet Wash™ Booking' },
        },
        subheader: {
          defaultValue: { language: 'en', value: data.serviceLabel },
        },
        header: {
          defaultValue: { language: 'en', value: `Order ${data.requestId}` },
        },
        // Booking QR — plain requestId, same as the client hero + Apple pass.
        barcode: {
          type: 'QR_CODE',
          value: data.requestId,
          alternateText: `Booking ${data.requestId}`,
        },
        hexBackgroundColor: '#0C0C0C',
        textModulesData,
      };

      const claims = {
        iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        origins: ['https://petwash.co.il'],
        typ: 'savetowallet',
        payload: {
          genericObjects: [genericObject],
        },
      };

      // Store metadata for later push / analytics.
      await this.storePassMetadata({
        userId: data.userId,
        passId: objectId,
        classId,
        type: 'google_booking_pass',
        requestId: data.requestId,
        serviceLabel: data.serviceLabel,
        providerName: data.providerName || null,
        scheduledAt: data.scheduledAt || null,
        totalCents: typeof data.totalCents === 'number' ? data.totalCents : null,
        currency,
        platform: 'google_wallet',
        createdAt: new Date(),
      });

      logger.info('[Google Wallet] Booking pass JWT generated', {
        requestId: data.requestId,
        userId: data.userId,
      });

      return Buffer.from(JSON.stringify(claims)).toString('base64url');
    } catch (error) {
      logger.error('[Google Wallet] Error generating booking pass JWT:', error);
      throw new Error('Failed to generate Google Wallet booking pass');
    }
  }

  /**
   * Store pass metadata in Firestore
   */
  private static async storePassMetadata(metadata: any) {
    try {
      await db.collection('google_wallet_passes').add({
        ...metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      logger.error('[Google Wallet] Error storing pass metadata:', error);
    }
  }
}
