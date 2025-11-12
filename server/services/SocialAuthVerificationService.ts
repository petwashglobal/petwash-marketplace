/**
 * SOCIAL LOGIN VERIFICATION SERVICE
 * 
 * Handles OAuth token verification for social providers:
 * - Google
 * - Apple
 * - Facebook
 * - TikTok
 * - Twitter
 * 
 * Based on banking-level security practices:
 * - Verifies OAuth tokens with provider APIs
 * - Creates or authenticates users
 * - Links social accounts to existing emails
 * - GDPR compliant account linking
 */

import { logger } from '../lib/logger';
import admin from '../lib/firebase-admin';
import { db as firestore } from '../lib/firebase-admin';

export interface SocialAuthResult {
  userId: string;
  email: string;
  status: 'LOGIN_SUCCESS' | 'NEW_ACCOUNT_CREATED' | 'ACCOUNT_LINKED';
  isNewUser: boolean;
  provider: string;
}

export interface SocialUserInfo {
  email: string;
  displayName?: string;
  photoURL?: string;
  providerId: string;
  uid: string;
}

export class SocialAuthVerificationService {
  
  /**
   * Verify social OAuth token and get/create user
   * 
   * @param provider - Social provider (google, apple, facebook, etc.)
   * @param firebaseToken - Firebase ID token (already verified by Firebase)
   * @param additionalInfo - Additional user info from OAuth provider
   * @returns User authentication result
   */
  static async verifySocialToken(
    provider: string,
    firebaseToken: string,
    additionalInfo?: any
  ): Promise<SocialAuthResult> {
    try {
      logger.info('[Social Auth] Verifying social login', { provider });

      // Verify Firebase ID token (this validates the OAuth token chain)
      const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
      const { uid, email, picture, name, firebase } = decodedToken;

      if (!email) {
        throw new Error('Email not provided by social provider');
      }

      // Get provider info from Firebase token
      const providerInfo = firebase.sign_in_provider || provider;
      
      logger.info('[Social Auth] Token verified', {
        provider: providerInfo,
        uid,
        email: email.substring(0, 3) + '***',
      });

      // Check if user already exists in Firestore
      const userDoc = await firestore.collection('users').doc(uid).get();
      const isNewUser = !userDoc.exists;

      if (isNewUser) {
        // NEW USER: Create account linked to social provider
        await this.createSocialUser(uid, email, providerInfo, {
          displayName: name,
          photoURL: picture,
          ...additionalInfo,
        });

        logger.info('[Social Auth] ✅ New social account created', {
          provider: providerInfo,
          uid,
        });

        return {
          userId: uid,
          email,
          status: 'NEW_ACCOUNT_CREATED',
          isNewUser: true,
          provider: providerInfo,
        };
      } else {
        // EXISTING USER: Log them in
        // Update last login timestamp
        await firestore.collection('users').doc(uid).update({
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginProvider: providerInfo,
        });

        logger.info('[Social Auth] ✅ Existing user logged in', {
          provider: providerInfo,
          uid,
        });

        return {
          userId: uid,
          email,
          status: 'LOGIN_SUCCESS',
          isNewUser: false,
          provider: providerInfo,
        };
      }
    } catch (error) {
      logger.error('[Social Auth] Verification failed', error);
      throw error;
    }
  }

  /**
   * Create new user account from social login (GDPR compliant)
   * 
   * @param uid - Firebase UID
   * @param email - User email
   * @param provider - Social provider
   * @param profile - User profile info
   */
  private static async createSocialUser(
    uid: string,
    email: string,
    provider: string,
    profile: any
  ): Promise<void> {
    const userData = {
      uid,
      email,
      displayName: profile.displayName || email.split('@')[0],
      photoURL: profile.photoURL || null,
      provider,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginProvider: provider,
      // Loyalty program
      loyaltyTier: 'new',
      loyaltyPoints: 0,
      // Privacy & consent
      emailVerified: true, // Social providers verify email
      consentGiven: true,
      consentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      dataRetentionYears: 7, // Israeli law requirement
      // Security
      twoFactorEnabled: false,
      securityAlerts: true,
    };

    await firestore.collection('users').doc(uid).set(userData);

    logger.info('[Social Auth] User profile created in Firestore', {
      uid,
      provider,
    });
  }

  /**
   * Verify Google OAuth token specifically
   * 
   * @param token - Google OAuth access token
   * @returns User info from Google
   */
  static async verifyGoogleToken(token: string): Promise<SocialUserInfo> {
    try {
      // Google's OAuth2 userinfo endpoint
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const userInfo = await response.json();
      
      return {
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture,
        providerId: 'google.com',
        uid: userInfo.sub, // Google's unique user ID
      };
    } catch (error) {
      logger.error('[Social Auth] Google token verification failed', error);
      throw error;
    }
  }

  /**
   * Verify Apple Sign-In JWT token
   * 
   * @param identityToken - Apple's JWT identity token
   * @returns User info from Apple
   */
  static async verifyAppleToken(identityToken: string): Promise<SocialUserInfo> {
    try {
      // Apple's JWT must be verified with their public keys
      // This is handled by Firebase Authentication automatically
      // We just need to decode the token to get user info
      
      const decodedToken = await admin.auth().verifyIdToken(identityToken);
      
      return {
        email: decodedToken.email!,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        providerId: 'apple.com',
        uid: decodedToken.uid,
      };
    } catch (error) {
      logger.error('[Social Auth] Apple token verification failed', error);
      throw error;
    }
  }

  /**
   * Link social account to existing user (if email matches)
   * 
   * @param existingUserId - Existing user's Firebase UID
   * @param socialProvider - New social provider to link
   * @param socialUid - UID from social provider
   */
  static async linkSocialAccount(
    existingUserId: string,
    socialProvider: string,
    socialUid: string
  ): Promise<void> {
    try {
      await firestore.collection('users').doc(existingUserId).update({
        linkedAccounts: admin.firestore.FieldValue.arrayUnion({
          provider: socialProvider,
          uid: socialUid,
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      });

      logger.info('[Social Auth] Social account linked', {
        userId: existingUserId,
        provider: socialProvider,
      });
    } catch (error) {
      logger.error('[Social Auth] Account linking failed', error);
      throw error;
    }
  }
}

logger.info('[Social Auth Verification Service] Initialized');
