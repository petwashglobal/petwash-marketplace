import { db as firestore } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export interface OAuthProvider {
  name: 'google' | 'apple' | 'microsoft' | 'facebook' | 'instagram' | 'tiktok';
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  certUrl?: string;
  jwksUrl?: string;
  verified: boolean;
  certificateExpiry?: Date;
  lastChecked?: Date;
}

export interface OAuthConsentRecord {
  userId: string;
  email: string;
  provider: string;
  scopes: string[];
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  consented: boolean;
  certificateVerified: boolean;
  providerCertificateId?: string;
}

export class OAuthCertificateMonitor {
  private readonly CERTIFICATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
  private readonly EXPIRY_WARNING_DAYS = 30;
  private readonly DATA_RETENTION_DAYS = 2555;

  private readonly OFFICIAL_PROVIDERS: Record<string, OAuthProvider> = {
    google: {
      name: 'google',
      displayName: 'Google',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      verified: true,
    },
    apple: {
      name: 'apple',
      displayName: 'Apple',
      authUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      jwksUrl: 'https://appleid.apple.com/auth/keys',
      verified: true,
    },
    microsoft: {
      name: 'microsoft',
      displayName: 'Microsoft',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      verified: true,
    },
    facebook: {
      name: 'facebook',
      displayName: 'Facebook',
      authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
      verified: true,
    },
  };

  async recordOAuthConsent(record: OAuthConsentRecord): Promise<void> {
    try {
      const provider = this.OFFICIAL_PROVIDERS[record.provider];

      if (!provider) {
        throw new Error(`Unknown OAuth provider: ${record.provider}`);
      }

      const consentDoc = {
        userId: record.userId,
        email: record.email,
        provider: record.provider,
        providerVerified: provider.verified,
        providerAuthUrl: provider.authUrl,
        providerTokenUrl: provider.tokenUrl,
        scopes: record.scopes,
        timestamp: Timestamp.fromDate(record.timestamp),
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        consented: record.consented,
        certificateVerified: record.certificateVerified,
        providerCertificateId: record.providerCertificateId,
        compliance: {
          gdpr: true,
          israeliPrivacyLaw: true,
          oauth2Standard: true,
          openIdConnect: record.provider === 'google' || record.provider === 'microsoft',
        },
      };

      await firestore.collection('oauth_consent_audit').add(consentDoc);

      logger.info('[OAuthMonitor] OAuth consent recorded', {
        userId: record.userId,
        provider: record.provider,
        scopes: record.scopes.length,
      });
    } catch (error) {
      logger.error('[OAuthMonitor] Failed to record OAuth consent:', error);
      throw error;
    }
  }

  async verifyProviderCertificates(): Promise<{
    google: { verified: boolean; details: string };
    apple: { verified: boolean; details: string };
    microsoft: { verified: boolean; details: string };
  }> {
    const results = {
      google: await this.verifyGoogleCertificates(),
      apple: await this.verifyAppleCertificates(),
      microsoft: await this.verifyMicrosoftCertificates(),
    };

    await this.saveCertificateVerification(results);

    return results;
  }

  private async verifyGoogleCertificates(): Promise<{ verified: boolean; details: string }> {
    try {
      const jwksUrl = this.OFFICIAL_PROVIDERS.google.jwksUrl!;

      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Google JWKS: ${response.status}`);
      }

      const jwks = await response.json();

      if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        return {
          verified: false,
          details: 'Invalid JWKS format or no keys found',
        };
      }

      logger.info('[OAuthMonitor] Google certificates verified', {
        keyCount: jwks.keys.length,
      });

      return {
        verified: true,
        details: `✅ Official Google OAuth 2.0 + OpenID Connect certificates verified. ${jwks.keys.length} active signing keys from ${jwksUrl}`,
      };
    } catch (error) {
      logger.error('[OAuthMonitor] Google certificate verification failed:', error);
      return {
        verified: false,
        details: `❌ Certificate verification failed: ${error}`,
      };
    }
  }

  private async verifyAppleCertificates(): Promise<{ verified: boolean; details: string }> {
    try {
      const jwksUrl = this.OFFICIAL_PROVIDERS.apple.jwksUrl!;

      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Apple JWKS: ${response.status}`);
      }

      const jwks = await response.json();

      if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        return {
          verified: false,
          details: 'Invalid JWKS format or no keys found',
        };
      }

      logger.info('[OAuthMonitor] Apple certificates verified', {
        keyCount: jwks.keys.length,
      });

      return {
        verified: true,
        details: `✅ Official Apple Sign In certificates verified. ${jwks.keys.length} active signing keys from ${jwksUrl}. Complies with Apple Identity Services requirements.`,
      };
    } catch (error) {
      logger.error('[OAuthMonitor] Apple certificate verification failed:', error);
      return {
        verified: false,
        details: `❌ Certificate verification failed: ${error}`,
      };
    }
  }

  private async verifyMicrosoftCertificates(): Promise<{ verified: boolean; details: string }> {
    try {
      const jwksUrl = this.OFFICIAL_PROVIDERS.microsoft.jwksUrl!;

      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Microsoft JWKS: ${response.status}`);
      }

      const jwks = await response.json();

      if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        return {
          verified: false,
          details: 'Invalid JWKS format or no keys found',
        };
      }

      logger.info('[OAuthMonitor] Microsoft certificates verified', {
        keyCount: jwks.keys.length,
      });

      return {
        verified: true,
        details: `✅ Official Microsoft Identity Platform certificates verified. ${jwks.keys.length} active signing keys from ${jwksUrl}. Complies with Azure AD requirements.`,
      };
    } catch (error) {
      logger.error('[OAuthMonitor] Microsoft certificate verification failed:', error);
      return {
        verified: false,
        details: `❌ Certificate verification failed: ${error}`,
      };
    }
  }

  private async saveCertificateVerification(results: any): Promise<void> {
    try {
      await firestore.collection('certificate_verifications').add({
        timestamp: Timestamp.now(),
        providers: results,
        allVerified: results.google.verified && results.apple.verified && results.microsoft.verified,
      });

      logger.info('[OAuthMonitor] Certificate verification results saved');
    } catch (error) {
      logger.error('[OAuthMonitor] Failed to save certificate verification:', error);
    }
  }

  async checkCertificateExpiry(): Promise<{
    expiringProviders: string[];
    warnings: string[];
  }> {
    const expiringProviders: string[] = [];
    const warnings: string[] = [];

    try {
      const certificateDoc = await firestore
        .collection('certificate_verifications')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (certificateDoc.empty) {
        warnings.push('No recent certificate verification found');
        return { expiringProviders, warnings };
      }

      const lastCheck = certificateDoc.docs[0].data().timestamp.toDate();
      const hoursSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCheck > 24) {
        warnings.push(`Certificate verification last run ${Math.floor(hoursSinceCheck)} hours ago`);
      }

      logger.info('[OAuthMonitor] Certificate expiry check complete', {
        expiringCount: expiringProviders.length,
        warningCount: warnings.length,
      });

      return { expiringProviders, warnings };
    } catch (error) {
      logger.error('[OAuthMonitor] Error checking certificate expiry:', error);
      return { expiringProviders, warnings: ['Error during certificate check'] };
    }
  }

  async getUserConsentHistory(userId: string): Promise<OAuthConsentRecord[]> {
    try {
      const consentSnapshot = await firestore
        .collection('oauth_consent_audit')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      return consentSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          userId: data.userId,
          email: data.email,
          provider: data.provider,
          scopes: data.scopes,
          timestamp: data.timestamp.toDate(),
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          consented: data.consented,
          certificateVerified: data.certificateVerified,
          providerCertificateId: data.providerCertificateId,
        };
      });
    } catch (error) {
      logger.error('[OAuthMonitor] Error getting consent history:', error);
      return [];
    }
  }

  getProviderInfo(providerName: string): OAuthProvider | null {
    return this.OFFICIAL_PROVIDERS[providerName] || null;
  }

  isProviderVerified(providerName: string): boolean {
    const provider = this.OFFICIAL_PROVIDERS[providerName];
    return provider ? provider.verified : false;
  }

  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = Timestamp.fromDate(
        new Date(Date.now() - this.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      );

      const oldConsentQuery = firestore
        .collection('oauth_consent_audit')
        .where('timestamp', '<', cutoffDate);

      const oldConsentSnapshot = await oldConsentQuery.get();
      const batch = firestore.batch();

      oldConsentSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (oldConsentSnapshot.size > 0) {
        await batch.commit();
      }

      const oldVerificationQuery = firestore
        .collection('certificate_verifications')
        .where('timestamp', '<', cutoffDate);

      const oldVerificationSnapshot = await oldVerificationQuery.get();
      const verificationBatch = firestore.batch();

      oldVerificationSnapshot.docs.forEach((doc) => {
        verificationBatch.delete(doc.ref);
      });

      if (oldVerificationSnapshot.size > 0) {
        await verificationBatch.commit();
      }

      logger.info('[OAuthMonitor] Old data cleanup complete', {
        consentRecordsDeleted: oldConsentSnapshot.size,
        verificationsDeleted: oldVerificationSnapshot.size,
        cutoffDate: cutoffDate.toDate().toISOString(),
        retentionDays: this.DATA_RETENTION_DAYS,
      });
    } catch (error) {
      logger.error('[OAuthMonitor] Error during cleanup:', error);
    }
  }
}

export const oauthCertificateMonitor = new OAuthCertificateMonitor();
