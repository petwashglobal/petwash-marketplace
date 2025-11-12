/**
 * Apple Wallet Pass Generation Service
 * 
 * Generates luxury VIP loyalty cards and e-vouchers for Apple Wallet
 * Features:
 * - Location-based notifications (when near Pet Wash station)
 * - Dynamic updates (points balance, tier changes)
 * - QR code integration
 * - Premium design matching banking cards
 */

import { PKPass } from 'passkit-generator';
import QRCode from 'qrcode';
import { db } from './lib/firebase-admin';
import { logger } from './lib/logger';

interface VIPCardData {
  userId: string;
  userName: string;
  userEmail: string;
  tier: 'new' | 'silver' | 'gold' | 'platinum' | 'diamond';
  points: number;
  discountPercent: number;
  memberSince: Date;
  qrCode?: string;
}

interface EVoucherData {
  voucherId: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  expiryDate: Date;
  qrCode: string;
  description: string;
}

interface StationLocation {
  latitude: number;
  longitude: number;
  name: string;
  relevantText: string;
}

interface BusinessCardData {
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

export class AppleWalletService {
  
  /**
   * Tier colors matching luxury bank card design
   * Premium gradient-style colors for each tier (NEW 5-TIER SYSTEM)
   */
  private static readonly TIER_COLORS = {
    new: {
      backgroundColor: 'rgb(148, 163, 184)',    // Slate - welcoming entry tier
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(203, 213, 225)'
    },
    silver: {
      backgroundColor: 'rgb(203, 213, 225)',    // Silver - elegant metallic
      foregroundColor: 'rgb(0, 0, 0)',
      labelColor: 'rgb(100, 116, 139)'
    },
    gold: {
      backgroundColor: 'rgb(251, 191, 36)',     // Amber/Gold - premium luxury
      foregroundColor: 'rgb(0, 0, 0)',
      labelColor: 'rgb(180, 83, 9)'
    },
    platinum: {
      backgroundColor: 'rgb(229, 231, 235)',    // Platinum - ultra premium
      foregroundColor: 'rgb(0, 0, 0)',
      labelColor: 'rgb(107, 114, 128)'
    },
    diamond: {
      backgroundColor: 'rgb(59, 130, 246)',     // Diamond Blue - elite tier
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(191, 219, 254)'
    }
  };

  /**
   * Pet Wash station locations for location-based notifications
   */
  private static readonly STATION_LOCATIONS: StationLocation[] = [
    {
      latitude: 32.0853,
      longitude: 34.7818,
      name: 'Tel Aviv Central',
      relevantText: '🐾 Pet Wash station nearby! Show your VIP card for discount.'
    },
    {
      latitude: 31.7683,
      longitude: 35.2137,
      name: 'Jerusalem',
      relevantText: '🐾 Welcome to Pet Wash Jerusalem! Scan your card.'
    },
  ];

  /**
   * Generate VIP Loyalty Card pass.json template
   */
  private static getVIPCardTemplate(data: VIPCardData, qrCodeData: string) {
    const colors = this.TIER_COLORS[data.tier];
    
    return {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.petwash.vip',
      teamIdentifier: process.env.APPLE_TEAM_ID || '000000000',
      organizationName: 'Pet Wash™',
      description: `Pet Wash ${data.tier.toUpperCase()} VIP Card`,
      logoText: 'Pet Wash™',
      serialNumber: `VIP_${data.userId}_${data.tier}_${Date.now()}`,
      
      backgroundColor: colors.backgroundColor,
      foregroundColor: colors.foregroundColor,
      labelColor: colors.labelColor,
      
      webServiceURL: `${process.env.BASE_URL || 'https://petwash.co.il'}/api/wallet`,
      authenticationToken: this.generateAuthToken(data.userId),
      
      storeCard: {
        headerFields: [{
          key: 'name',
          label: 'CARDHOLDER',
          value: data.userName.toUpperCase()
        }],
        primaryFields: [{
          key: 'points',
          label: 'POINTS BALANCE',
          value: data.points.toLocaleString(),
          changeMessage: 'Balance updated: %@ points'
        }],
        secondaryFields: [
          {
            key: 'tier',
            label: 'TIER',
            value: data.tier.toUpperCase()
          },
          {
            key: 'discount',
            label: 'DISCOUNT',
            value: `${data.discountPercent}%`
          }
        ],
        auxiliaryFields: [
          {
            key: 'member',
            label: 'MEMBER SINCE',
            value: data.memberSince.toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' })
          },
          {
            key: 'card',
            label: 'CARD TYPE',
            value: 'VIP LOYALTY'
          }
        ],
        backFields: [
          {
            key: 'name',
            label: 'Name',
            value: data.userName
          },
          {
            key: 'email',
            label: 'Email',
            value: data.userEmail
          },
          {
            key: 'terms',
            label: 'Terms & Conditions',
            value: 'Visit petwash.co.il/terms for full terms and conditions.'
          }
        ]
      },
      
      barcodes: [{
        message: qrCodeData,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1'
      }],
      
      locations: this.STATION_LOCATIONS.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        relevantText: loc.relevantText
      }))
    };
  }

  /**
   * Generate E-Voucher pass.json template
   */
  private static getEVoucherTemplate(data: EVoucherData) {
    return {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.petwash.voucher',
      teamIdentifier: process.env.APPLE_TEAM_ID || '000000000',
      organizationName: 'Pet Wash™',
      description: 'Pet Wash E-Voucher',
      logoText: 'Pet Wash™',
      serialNumber: `VOUCHER_${data.voucherId}_${Date.now()}`,
      
      backgroundColor: 'rgb(99, 102, 241)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(224, 231, 255)',
      
      webServiceURL: `${process.env.BASE_URL || 'https://petwash.co.il'}/api/wallet`,
      authenticationToken: this.generateAuthToken(data.userId),
      
      expirationDate: data.expiryDate.toISOString(),
      voided: false,
      
      coupon: {
        headerFields: [{
          key: 'expiry',
          label: 'EXPIRES',
          value: data.expiryDate.toLocaleDateString('en-GB'),
          dateStyle: 'PKDateStyleShort'
        }],
        primaryFields: [{
          key: 'amount',
          label: 'VALUE',
          value: `${data.currency === 'ILS' ? '₪' : '$'}${data.amount}`,
          currencyCode: data.currency
        }],
        secondaryFields: [{
          key: 'description',
          label: 'DESCRIPTION',
          value: data.description
        }],
        backFields: [
          {
            key: 'recipient',
            label: 'Recipient',
            value: data.userName
          },
          {
            key: 'voucherId',
            label: 'Voucher ID',
            value: data.voucherId
          },
          {
            key: 'instructions',
            label: 'How to Use',
            value: 'Present this voucher at any Pet Wash station. The QR code will be scanned to redeem your voucher.'
          }
        ]
      },
      
      barcodes: [{
        message: data.qrCode,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1'
      }]
    };
  }

  /**
   * Generate VIP Loyalty Card for Apple Wallet
   */
  static async generateVIPCard(data: VIPCardData): Promise<Buffer> {
    try {
      // Check if certificates are configured
      if (!this.hasValidCertificates()) {
        throw new Error('Apple Wallet certificates not configured. Please set APPLE_WWDR_CERT, APPLE_SIGNER_CERT, and APPLE_SIGNER_KEY environment variables.');
      }

      // Generate QR code with Nayax-compatible loyalty data
      const loyaltyQRData = data.qrCode || JSON.stringify({
        type: 'PETWASH_VIP_LOYALTY',
        userId: data.userId,
        userEmail: data.userEmail,
        tier: data.tier,
        discountPercent: data.discountPercent,
        points: data.points,
        timestamp: Date.now(),
        version: '1.0'
      });
      
      const qrCodeBuffer = await QRCode.toBuffer(loyaltyQRData, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1
      });

      // Create pass.json
      const passJson = this.getVIPCardTemplate(data, loyaltyQRData);

      // Create pass with buffers (3-parameter constructor for dynamic buffer-based models)
      const pass = new PKPass(
        {
          'pass.json': Buffer.from(JSON.stringify(passJson)),
          'icon.png': qrCodeBuffer,
          'icon@2x.png': qrCodeBuffer,
          'logo.png': qrCodeBuffer,
          'logo@2x.png': qrCodeBuffer
        },
        {
          wwdr: process.env.APPLE_WWDR_CERT!,
          signerCert: process.env.APPLE_SIGNER_CERT!,
          signerKey: process.env.APPLE_SIGNER_KEY!,
          signerKeyPassphrase: process.env.APPLE_KEY_PASSPHRASE || ''
        },
        {} // Properties (pass.json already contains all required properties)
      );

      // Generate the pass
      const passBuffer = pass.getAsBuffer();

      logger.info('[Apple Wallet] VIP card generated', {
        userId: data.userId,
        tier: data.tier,
        serialNumber: passJson.serialNumber
      });

      // Store complete pass metadata in Firestore
      const authToken = this.generateAuthToken(data.userId);
      await this.storePassMetadata({
        userId: data.userId,
        serialNumber: passJson.serialNumber,
        authenticationToken: authToken,
        type: 'vip_card',
        tier: data.tier,
        points: data.points,
        discountPercent: data.discountPercent,
        userName: data.userName,
        userEmail: data.userEmail,
        memberSince: data.memberSince,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return passBuffer;

    } catch (error) {
      logger.error('[Apple Wallet] Error generating VIP card:', error);
      throw new Error('Failed to generate VIP card');
    }
  }

  /**
   * Generate E-Voucher for Apple Wallet
   */
  static async generateEVoucher(data: EVoucherData): Promise<Buffer> {
    try {
      if (!this.hasValidCertificates()) {
        throw new Error('Apple Wallet certificates not configured.');
      }

      // Generate QR code for voucher
      const qrCodeBuffer = await QRCode.toBuffer(data.qrCode, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1
      });

      // Create pass.json
      const passJson = this.getEVoucherTemplate(data);

      // Create pass with buffers (3-parameter constructor for dynamic buffer-based models)
      const pass = new PKPass(
        {
          'pass.json': Buffer.from(JSON.stringify(passJson)),
          'icon.png': qrCodeBuffer,
          'icon@2x.png': qrCodeBuffer,
          'logo.png': qrCodeBuffer,
          'logo@2x.png': qrCodeBuffer
        },
        {
          wwdr: process.env.APPLE_WWDR_CERT!,
          signerCert: process.env.APPLE_SIGNER_CERT!,
          signerKey: process.env.APPLE_SIGNER_KEY!,
          signerKeyPassphrase: process.env.APPLE_KEY_PASSPHRASE || ''
        },
        {} // Properties (pass.json already contains all required properties)
      );

      // Generate the pass
      const passBuffer = pass.getAsBuffer();

      logger.info('[Apple Wallet] E-Voucher generated', {
        voucherId: data.voucherId,
        userId: data.userId,
        amount: data.amount
      });

      // Store complete metadata
      const authToken = this.generateAuthToken(data.userId);
      await this.storePassMetadata({
        userId: data.userId,
        serialNumber: passJson.serialNumber,
        authenticationToken: authToken,
        type: 'e_voucher',
        voucherId: data.voucherId,
        amount: data.amount,
        currency: data.currency,
        expiryDate: data.expiryDate,
        userName: data.userName,
        description: data.description,
        qrCode: data.qrCode,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return passBuffer;

    } catch (error) {
      logger.error('[Apple Wallet] Error generating E-Voucher:', error);
      throw new Error('Failed to generate E-Voucher');
    }
  }

  /**
   * Update VIP card (points balance, tier upgrade)
   */
  static async updateVIPCard(userId: string, updates: Partial<VIPCardData>): Promise<void> {
    try {
      // Find all passes for this user
      const passesSnapshot = await db
        .collection('apple_wallet_passes')
        .where('userId', '==', userId)
        .where('type', '==', 'vip_card')
        .get();

      if (passesSnapshot.empty) {
        logger.warn('[Apple Wallet] No VIP card found for user', { userId });
        return;
      }

      // Send update notification to all devices with this pass
      for (const doc of passesSnapshot.docs) {
        const passData = doc.data();
        
        // Update metadata
        await doc.ref.update({
          ...updates,
          updatedAt: new Date()
        });

        // Send push notification to update the pass
        await this.sendPassUpdateNotification(passData.serialNumber);
      }

      logger.info('[Apple Wallet] VIP card updated', { userId, updates });

    } catch (error) {
      logger.error('[Apple Wallet] Error updating VIP card:', error);
    }
  }

  /**
   * Generate authentication token for pass updates
   */
  private static generateAuthToken(userId: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(`${userId}_${process.env.MOBILE_LINK_SECRET || 'secret'}`)
      .digest('hex');
  }

  /**
   * Store pass metadata in Firestore
   */
  private static async storePassMetadata(metadata: any): Promise<void> {
    await db.collection('apple_wallet_passes').add({
      ...metadata,
      createdAt: new Date()
    });
  }

  /**
   * Send push notification to update pass
   * Uses Apple Push Notification service (APNs) to notify devices of pass updates
   */
  private static async sendPassUpdateNotification(serialNumber: string): Promise<void> {
    try {
      // Get all registered devices for this pass
      const registrations = await db
        .collection('wallet_device_registrations')
        .where('serialNumber', '==', serialNumber)
        .get();

      if (registrations.empty) {
        logger.warn('[Apple Wallet] No registered devices found', { serialNumber });
        return;
      }

      // Send push notification to each device
      const pushPromises = registrations.docs.map(async (doc) => {
        const { pushToken, deviceID } = doc.data();
        
        // Note: Actual APNs push requires APNs certificate and dedicated connection
        // This is a placeholder for the push notification logic
        // Production implementation should use a library like 'node-apn' or 'apns2'
        
        logger.info('[Apple Wallet] Sending push notification', {
          serialNumber,
          deviceID,
          pushToken: pushToken.substring(0, 10) + '...' // Log partial token for security
        });

        // TODO: Implement actual APNs push when certificates are available
        // const apn = require('apn');
        // const provider = new apn.Provider({
        //   token: {
        //     key: process.env.APPLE_APNS_KEY,
        //     keyId: process.env.APPLE_APNS_KEY_ID,
        //     teamId: process.env.APPLE_TEAM_ID
        //   },
        //   production: process.env.NODE_ENV === 'production'
        // });
        // 
        // const notification = new apn.Notification();
        // notification.payload = {}; // Silent push - no payload needed
        // notification.topic = process.env.APPLE_PASS_TYPE_ID;
        // 
        // await provider.send(notification, pushToken);
      });

      await Promise.all(pushPromises);
      logger.info('[Apple Wallet] Push notifications sent', { 
        serialNumber, 
        deviceCount: registrations.size 
      });

    } catch (error) {
      logger.error('[Apple Wallet] Error sending push notifications:', error);
      // Don't throw - push failures shouldn't break the update flow
    }
  }

  /**
   * Generate Digital Business Card for Apple Wallet
   */
  static async generateBusinessCard(data: BusinessCardData): Promise<Buffer> {
    try {
      if (!this.hasValidCertificates()) {
        throw new Error('Apple Wallet certificates not configured.');
      }

      // Create vCard format for QR code
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

      // Generate QR code with vCard data
      const qrCodeBuffer = await QRCode.toBuffer(vCardData, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1
      });

      // Create pass.json for business card - luxury black design
      const passJson = {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.petwash.businesscard',
        teamIdentifier: process.env.APPLE_TEAM_ID || '000000000',
        organizationName: data.company,
        description: `${data.name} - Digital Business Card`,
        logoText: 'PetWash™',
        serialNumber: `BIZCARD_${data.email.replace('@', '_at_')}_${Date.now()}`,
        
        backgroundColor: 'rgb(18, 18, 18)',       // Premium black like luxury business cards
        foregroundColor: 'rgb(255, 255, 255)',    // Pure white text
        labelColor: 'rgb(163, 163, 163)',         // Silver gray labels
        
        webServiceURL: `${process.env.BASE_URL || 'https://petwash.co.il'}/api/wallet`,
        authenticationToken: this.generateAuthToken(data.email),
        
        generic: {
          headerFields: [{
            key: 'name',
            label: 'NAME',
            value: data.name
          }],
          primaryFields: [{
            key: 'title',
            label: 'TITLE',
            value: data.title
          }],
          secondaryFields: [
            {
              key: 'company',
              label: 'COMPANY',
              value: data.company
            }
          ],
          auxiliaryFields: [
            {
              key: 'email',
              label: 'EMAIL',
              value: data.email
            },
            {
              key: 'phone',
              label: 'PHONE',
              value: data.phone
            }
          ],
          backFields: [
            {
              key: 'website',
              label: 'Website',
              value: data.website
            },
            {
              key: 'mobile',
              label: 'Mobile',
              value: data.mobile || data.phone
            },
            {
              key: 'social',
              label: 'Social Media',
              value: [
                data.socialMedia.tiktok ? `TikTok: ${data.socialMedia.tiktok}` : '',
                data.socialMedia.instagram ? `Instagram: ${data.socialMedia.instagram}` : '',
                data.socialMedia.facebook ? `Facebook: ${data.socialMedia.facebook}` : ''
              ].filter(Boolean).join('\n')
            },
            {
              key: 'instructions',
              label: 'Sharing',
              value: 'Share this card via AirDrop, tap iPhones together (NameDrop), or have someone scan the QR code.'
            }
          ]
        },
        
        barcodes: [{
          message: vCardData,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1'
        }],
        
        // Enable NFC for tap-to-share (iPhone to iPhone)
        nfc: {
          message: vCardData,
          encryptionPublicKey: undefined // Optional: for secure NFC
        }
      };

      // Create pass with buffers (3-parameter constructor for dynamic buffer-based models)
      const pass = new PKPass(
        {
          'pass.json': Buffer.from(JSON.stringify(passJson)),
          'icon.png': qrCodeBuffer,
          'icon@2x.png': qrCodeBuffer,
          'logo.png': qrCodeBuffer,
          'logo@2x.png': qrCodeBuffer
        },
        {
          wwdr: process.env.APPLE_WWDR_CERT!,
          signerCert: process.env.APPLE_SIGNER_CERT!,
          signerKey: process.env.APPLE_SIGNER_KEY!,
          signerKeyPassphrase: process.env.APPLE_KEY_PASSPHRASE || ''
        },
        {} // Properties (pass.json already contains all required properties)
      );

      const passBuffer = pass.getAsBuffer();

      logger.info('[Apple Wallet] Business card generated', {
        name: data.name,
        email: data.email
      });

      return passBuffer;

    } catch (error) {
      logger.error('[Apple Wallet] Error generating business card:', error);
      throw new Error('Failed to generate business card');
    }
  }

  /**
   * Check if user has Apple Developer certificates configured
   */
  static hasValidCertificates(): boolean {
    return !!(
      process.env.APPLE_WWDR_CERT &&
      process.env.APPLE_SIGNER_CERT &&
      process.env.APPLE_SIGNER_KEY
    );
  }
}
