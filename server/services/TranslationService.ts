import { v2 } from '@google-cloud/translate';
import { redis } from './redis';
import { logger } from '../lib/logger';

const { Translate } = v2;

export class TranslationService {
  private translate: any;
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 86400 * 30; // 30 days in seconds

  constructor() {
    // Initialize Google Cloud Translation client
    // Using API key from environment variable (more secure than service account file)
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    
    if (!apiKey) {
      logger.warn('[Translation] ⚠️ GOOGLE_TRANSLATE_API_KEY not configured - translation disabled');
      this.translate = null;
    } else {
      this.translate = new Translate({ key: apiKey });
      logger.info('[Translation] ✅ Google Cloud Translation initialized');
    }
  }

  /**
   * Translate text with Redis caching for performance and cost optimization
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    if (!this.translate) {
      logger.warn('[Translation] Translation API not configured, returning original text');
      return text;
    }

    // Normalize inputs
    const normalizedText = text.trim();
    const normalizedLang = targetLanguage.toLowerCase();

    // Skip translation for English (source language)
    if (normalizedLang === 'en') {
      return normalizedText;
    }

    // Create cache key
    const cacheKey = `translate:${normalizedLang}:${Buffer.from(normalizedText).toString('base64').slice(0, 100)}`;

    try {
      // Check Redis cache first
      if (this.cacheEnabled && redis) {
        const cachedTranslation = await redis.get(cacheKey);
        if (cachedTranslation) {
          logger.info(`[Translation] ✅ Cache hit for ${normalizedLang}`);
          return cachedTranslation;
        }
      }

      // Call Google Cloud Translation API
      logger.info(`[Translation] 🌐 Translating to ${normalizedLang}`);
      const [translation] = await this.translate.translate(normalizedText, normalizedLang);

      // Store in cache with long TTL (translations don't change)
      if (this.cacheEnabled && redis) {
        await redis.setex(cacheKey, this.cacheTTL, translation);
        logger.info(`[Translation] 💾 Cached translation for ${normalizedLang}`);
      }

      return translation;
    } catch (error: any) {
      logger.error('[Translation] Translation failed', { 
        error: error.message || String(error),
        stack: error.stack,
        text: normalizedText.slice(0, 50), 
        targetLanguage: normalizedLang 
      });
      
      // Fallback: return original text if translation fails
      return normalizedText;
    }
  }

  /**
   * Batch translate multiple texts (more efficient for bulk operations)
   */
  async translateBatch(texts: string[], targetLanguage: string): Promise<string[]> {
    if (!this.translate) {
      return texts;
    }

    const normalizedLang = targetLanguage.toLowerCase();
    
    if (normalizedLang === 'en') {
      return texts;
    }

    try {
      // Check cache for all texts
      const results: string[] = [];
      const textsToTranslate: { text: string; index: number }[] = [];

      for (let i = 0; i < texts.length; i++) {
        const text = texts[i].trim();
        const cacheKey = `translate:${normalizedLang}:${Buffer.from(text).toString('base64').slice(0, 100)}`;

        if (this.cacheEnabled && redis) {
          const cached = await redis.get(cacheKey);
          if (cached) {
            results[i] = cached;
            continue;
          }
        }

        textsToTranslate.push({ text, index: i });
      }

      // Translate uncached texts in batch
      if (textsToTranslate.length > 0) {
        logger.info(`[Translation] 🌐 Batch translating ${textsToTranslate.length} texts to ${normalizedLang}`);
        
        const [translations] = await this.translate.translate(
          textsToTranslate.map(t => t.text),
          normalizedLang
        );

        // Store in cache and results
        for (let i = 0; i < textsToTranslate.length; i++) {
          const { text, index } = textsToTranslate[i];
          const translation = Array.isArray(translations) ? translations[i] : translations;
          results[index] = translation;

          // Cache it
          if (this.cacheEnabled && redis) {
            const cacheKey = `translate:${normalizedLang}:${Buffer.from(text).toString('base64').slice(0, 100)}`;
            await redis.setex(cacheKey, this.cacheTTL, translation);
          }
        }
      }

      return results;
    } catch (error: any) {
      logger.error('[Translation] Batch translation failed', { 
        error: error.message || String(error),
        stack: error.stack,
        count: texts.length, 
        targetLanguage: normalizedLang 
      });
      return texts; // Fallback to original
    }
  }

  /**
   * Clear cache for specific language (for manual invalidation if needed)
   */
  async clearCache(targetLanguage?: string) {
    if (!redis) return;

    try {
      if (targetLanguage) {
        const pattern = `translate:${targetLanguage.toLowerCase()}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info(`[Translation] 🗑️ Cleared ${keys.length} cached translations for ${targetLanguage}`);
        }
      } else {
        const pattern = 'translate:*';
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info(`[Translation] 🗑️ Cleared ALL ${keys.length} cached translations`);
        }
      }
    } catch (error) {
      logger.error('[Translation] Failed to clear cache', { error });
    }
  }
}

// Export singleton instance
export const translationService = new TranslationService();
