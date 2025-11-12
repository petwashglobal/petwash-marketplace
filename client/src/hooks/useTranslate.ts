import { useState, useCallback, useEffect } from 'react';
import type { Language } from '@/lib/i18n';
import { apiRequest } from '@/lib/queryClient';

// In-memory cache for translations (persists during app session)
const translationCache = new Map<string, string>();

/**
 * Real-time AI translation hook using Google Cloud Translation API
 * 
 * Usage:
 * const { translate, isTranslating } = useTranslate('en');
 * const translatedText = await translate('Hello world');
 */
export function useTranslate(targetLanguage: Language) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Translate a single text string
   */
  const translate = useCallback(async (text: string): Promise<string> => {
    // Skip translation for English (source language)
    if (targetLanguage === 'en' || !text || text.trim() === '') {
      return text;
    }

    // Check in-memory cache first
    const cacheKey = `${targetLanguage}:${text}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await apiRequest('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text, targetLanguage }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      const translation = data.translation || text;

      // Store in cache
      translationCache.set(cacheKey, translation);

      return translation;
    } catch (err) {
      console.error('[useTranslate] Translation error:', err);
      setError('Translation failed');
      // Return original text on error
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [targetLanguage]);

  /**
   * Translate multiple texts in a single batch request (more efficient)
   */
  const translateBatch = useCallback(async (texts: string[]): Promise<string[]> => {
    if (targetLanguage === 'en' || texts.length === 0) {
      return texts;
    }

    setIsTranslating(true);
    setError(null);

    try {
      // Check cache for all texts
      const results: string[] = [];
      const textsToTranslate: { text: string; index: number }[] = [];

      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        const cacheKey = `${targetLanguage}:${text}`;
        const cached = translationCache.get(cacheKey);
        
        if (cached) {
          results[i] = cached;
        } else {
          textsToTranslate.push({ text, index: i });
        }
      }

      // Translate uncached texts
      if (textsToTranslate.length > 0) {
        const response = await apiRequest('/api/translate', {
          method: 'POST',
          body: JSON.stringify({ 
            text: textsToTranslate.map(t => t.text),
            targetLanguage,
          }),
        });

        if (!response.ok) {
          throw new Error('Batch translation failed');
        }

        const data = await response.json();
        const translations = data.translations || textsToTranslate.map(t => t.text);

        // Store in cache and results
        for (let i = 0; i < textsToTranslate.length; i++) {
          const { text, index } = textsToTranslate[i];
          const translation = translations[i];
          results[index] = translation;
          
          const cacheKey = `${targetLanguage}:${text}`;
          translationCache.set(cacheKey, translation);
        }
      }

      return results;
    } catch (err) {
      console.error('[useTranslate] Batch translation error:', err);
      setError('Batch translation failed');
      // Return original texts on error
      return texts;
    } finally {
      setIsTranslating(false);
    }
  }, [targetLanguage]);

  /**
   * Clear translation cache (useful for language switching)
   */
  const clearCache = useCallback(() => {
    translationCache.clear();
  }, []);

  return {
    translate,
    translateBatch,
    isTranslating,
    error,
    clearCache,
  };
}

/**
 * Helper hook for translating static UI text (replaces old t() function)
 * 
 * Usage:
 * const t = useT('he');
 * return <div>{t('Welcome to Pet Wash')}</div>;
 */
export function useT(language: Language) {
  const { translate } = useTranslate(language);

  return useCallback((text: string) => {
    // For now, return the text immediately (non-blocking)
    // Real translation happens on first render via useEffect
    
    if (language === 'en') {
      return text;
    }

    // TODO: Implement async translation with Suspense or loading state
    return text;
  }, [language, translate]);
}
