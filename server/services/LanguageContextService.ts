/**
 * Language Context Service
 * 
 * Centralized language detection and management for multi-language Pet Wash platform.
 * Integrates IP-based geolocation with explicit user preferences.
 * 
 * Used by:
 * - Gemini AI Chat Assistant (Kenzo)
 * - Weather Planner/Advisor
 * - Loyalty Program
 * - Email Services
 * - Admin Dashboard
 * - All staff dashboards
 * 
 * Language Detection Priority:
 * 1. Explicit user preference (stored in user profile)
 * 2. Session language (temporary choice)
 * 3. IP-based geolocation (country → language mapping)
 * 4. Browser Accept-Language header
 * 5. Default fallback (en)
 */

import { GeolocationService } from './GeolocationService';
import { type LanguageCode, COUNTRY_TO_LANGUAGE } from '../../shared/languages';
import { logger } from '../lib/logger';
import type { Request } from 'express';

export interface LanguageContext {
  language: LanguageCode;
  source: 'user_preference' | 'session' | 'ip_geolocation' | 'browser' | 'default';
  confidence: 'high' | 'medium' | 'low';
  detectedCountry?: string;
  userId?: string;
}

export class LanguageContextService {
  private geoService: GeolocationService;
  
  constructor() {
    this.geoService = new GeolocationService();
  }

  /**
   * Detect user's language from multiple sources (backend middleware-friendly)
   */
  async detectLanguage(req: Request, userId?: string): Promise<LanguageContext> {
    // Priority 1: Explicit user preference from database
    if (userId) {
      const userLanguage = await this.getUserPreferredLanguage(userId);
      if (userLanguage) {
        logger.info(`[LanguageContext] Using user preference: ${userLanguage}`, { userId });
        return {
          language: userLanguage,
          source: 'user_preference',
          confidence: 'high',
          userId,
        };
      }
    }

    // Priority 2: Session language (temporary choice)
    const sessionLanguage = req.session?.language as LanguageCode;
    if (sessionLanguage && this.isValidLanguage(sessionLanguage)) {
      logger.info(`[LanguageContext] Using session language: ${sessionLanguage}`);
      return {
        language: sessionLanguage,
        source: 'session',
        confidence: 'high',
      };
    }

    // Priority 3: IP-based geolocation
    const clientIp = this.getClientIP(req);
    if (clientIp) {
      try {
        const geoData = await this.geoService.detectCountryFromIP(clientIp);
        if (geoData && geoData.language) {
          logger.info(`[LanguageContext] Using IP geolocation: ${geoData.language}`, {
            country: geoData.countryName,
            ip: clientIp,
          });
          return {
            language: geoData.language,
            source: 'ip_geolocation',
            confidence: 'medium',
            detectedCountry: geoData.countryName,
          };
        }
      } catch (error) {
        logger.warn(`[LanguageContext] IP geolocation failed`, { error, ip: clientIp });
      }
    }

    // Priority 4: Browser Accept-Language header
    const browserLanguage = this.getBrowserLanguage(req);
    if (browserLanguage) {
      logger.info(`[LanguageContext] Using browser language: ${browserLanguage}`);
      return {
        language: browserLanguage,
        source: 'browser',
        confidence: 'low',
      };
    }

    // Priority 5: Default fallback
    logger.info(`[LanguageContext] Using default language: en`);
    return {
      language: 'en',
      source: 'default',
      confidence: 'low',
    };
  }

  /**
   * Get user's stored language preference from database
   */
  private async getUserPreferredLanguage(userId: string): Promise<LanguageCode | null> {
    try {
      // Import db only when needed to avoid circular dependencies
      const { db } = await import('../db');
      const { users } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const user = await db.select({
        language: users.language,
      }).from(users).where(eq(users.id, userId)).limit(1);

      if (user[0]?.language && this.isValidLanguage(user[0].language)) {
        return user[0].language as LanguageCode;
      }

      return null;
    } catch (error) {
      logger.error(`[LanguageContext] Failed to fetch user language`, { error, userId });
      return null;
    }
  }

  /**
   * Save user's language preference to database
   */
  async saveUserLanguagePreference(userId: string, language: LanguageCode): Promise<boolean> {
    try {
      const { db } = await import('../db');
      const { users } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      await db.update(users)
        .set({ language, updatedAt: new Date() })
        .where(eq(users.id, userId));

      logger.info(`[LanguageContext] ✅ Saved user language preference`, { userId, language });
      return true;
    } catch (error) {
      logger.error(`[LanguageContext] Failed to save user language`, { error, userId, language });
      return false;
    }
  }

  /**
   * Get client IP address from request (handles proxies and load balancers)
   */
  private getClientIP(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }
    return req.ip || req.socket?.remoteAddress || null;
  }

  /**
   * Parse browser Accept-Language header
   */
  private getBrowserLanguage(req: Request): LanguageCode | null {
    const acceptLanguage = req.headers['accept-language'];
    if (!acceptLanguage) return null;

    const languages = acceptLanguage.split(',').map(lang => {
      const [code, quality = '1.0'] = lang.trim().split(';q=');
      return { code: code.split('-')[0].toLowerCase(), quality: parseFloat(quality) };
    }).sort((a, b) => b.quality - a.quality);

    for (const { code } of languages) {
      const mapped = this.mapBrowserLanguageToSupported(code);
      if (mapped) return mapped;
    }

    return null;
  }

  /**
   * Map browser language code to supported language
   */
  private mapBrowserLanguageToSupported(browserCode: string): LanguageCode | null {
    const mapping: Record<string, LanguageCode> = {
      'en': 'en',
      'he': 'he',
      'ar': 'ar',
      'ru': 'ru',
      'fr': 'fr',
      'es': 'es',
      'iw': 'he', // Hebrew (old code)
    };

    return mapping[browserCode] || null;
  }

  /**
   * Validate if language code is supported
   */
  private isValidLanguage(lang: string): lang is LanguageCode {
    return ['en', 'he', 'ar', 'ru', 'fr', 'es'].includes(lang);
  }

  /**
   * Get language context for Gemini AI (with automatic detection)
   */
  async getLanguageForGemini(req: Request, userId?: string): Promise<LanguageCode> {
    const context = await this.detectLanguage(req, userId);
    logger.debug(`[LanguageContext] Gemini AI using language: ${context.language}`, {
      source: context.source,
      confidence: context.confidence,
    });
    return context.language;
  }
}

export const languageContextService = new LanguageContextService();
