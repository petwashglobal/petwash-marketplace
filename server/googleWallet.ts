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

      // Tier colors (NEW 5-TIER SYSTEM)
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

        // Locations (Tel Aviv & Jerusalem stations)
        locations: [
          {
            latitude: 32.0853,
            longitude: 34.7818,
            kind: 'walletobjects#latLongPoint'
          },
          {
            latitude: 31.7683,
            longitude: 35.2137,
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
        issuerName: 'Pet Wash™',
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
            value: 'Pet Wash™'
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

      // Create generic object (voucher type)
      const genericObject = {
        id: objectId,
        classId: classId,
        state: 'ACTIVE',
        
        // Barcode for redemption
        barcode: {
          type: 'QR_CODE',
          value: data.qrCode,
          alternateText: data.voucherId
        },

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
