/**
 * Gemini AI Translation Service
 * 
 * Perfect translations with context understanding (NOT Google Translate!)
 * Uses Google Gemini 2.5 Flash for natural, native-speaker quality translations
 * 
 * Supports: Hebrew, English, Arabic, Russian, French, Spanish
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from '../lib/logger';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// API Monitoring metrics
interface TranslationMetrics {
  totalRequests: number;
  successfulTranslations: number;
  failedTranslations: number;
  averageResponseTime: number;
  languagePairCounts: Record<string, number>;
  lastUpdated: Date;
}

const metrics: TranslationMetrics = {
  totalRequests: 0,
  successfulTranslations: 0,
  failedTranslations: 0,
  averageResponseTime: 0,
  languagePairCounts: {},
  lastUpdated: new Date(),
};

type SupportedLanguage = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  he: 'Hebrew (עברית)',
  en: 'English',
  ar: 'Arabic (العربية)',
  ru: 'Russian (Русский)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
};

/**
 * Translate text using Gemini AI (context-aware, perfect translations)
 */
interface TranslationResult {
  success: boolean;
  translatedText: string;
  error?: string;
}

export async function translateWithGemini(
  text: string,
  targetLanguage: SupportedLanguage,
  sourceLanguage?: SupportedLanguage,
  context?: string
): Promise<TranslationResult> {
  const startTime = Date.now();
  
  try {
    // Track API usage
    metrics.totalRequests++;
    const languagePair = `${sourceLanguage || 'auto'}_to_${targetLanguage}`;
    metrics.languagePairCounts[languagePair] = (metrics.languagePairCounts[languagePair] || 0) + 1;

    // If text is already in target language, return as-is
    if (sourceLanguage === targetLanguage) {
      logger.debug(`[GeminiTranslation] Text already in target language: ${targetLanguage}`);
      return { success: true, translatedText: text };
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      logger.error('[GeminiTranslation] GEMINI_API_KEY not configured');
      metrics.failedTranslations++;
      return { success: false, translatedText: text, error: 'GEMINI_API_KEY not configured' };
    }

    // Build context-aware prompt
    const systemPrompt = buildTranslationPrompt(targetLanguage, sourceLanguage, context);

    // Call Gemini AI (use gemini-2.5-flash for best results)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: [{
        role: 'user',
        parts: [{ text }],
      }],
    });

    // Extract translated text from response
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No translation candidates returned');
    }

    const candidate = response.candidates[0];
    if (!candidate.content?.parts || candidate.content.parts.length === 0) {
      throw new Error('No content parts in response');
    }

    const textPart = candidate.content.parts.find(part => part.text);
    if (!textPart || !textPart.text) {
      throw new Error('No text found in response');
    }

    const translatedText = textPart.text.trim();

    // Track success
    metrics.successfulTranslations++;
    const responseTime = Date.now() - startTime;
    updateAverageResponseTime(responseTime);
    metrics.lastUpdated = new Date();

    logger.info(`[GeminiTranslation] ✅ Translated to ${targetLanguage} in ${responseTime}ms`);

    return { success: true, translatedText };

  } catch (error) {
    // Track failure
    metrics.failedTranslations++;
    metrics.lastUpdated = new Date();

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[GeminiTranslation] Translation error:', errorMessage);
    
    // Return error (DON'T silently return original text)
    return { 
      success: false, 
      translatedText: text, 
      error: errorMessage 
    };
  }
}

/**
 * Build context-aware translation prompt
 */
function buildTranslationPrompt(
  targetLanguage: SupportedLanguage,
  sourceLanguage?: SupportedLanguage,
  context?: string
): string {
  const targetLangName = LANGUAGE_NAMES[targetLanguage];
  const sourceLangName = sourceLanguage ? LANGUAGE_NAMES[sourceLanguage] : 'the source language';

  let prompt = `You are a professional translator with native-level fluency in ${targetLangName}.

CRITICAL TRANSLATION RULES:
1. Translate from ${sourceLangName} to ${targetLangName}
2. Preserve the EXACT meaning and tone
3. Use NATURAL phrasing (like a native speaker would say it)
4. Maintain formality level (casual/professional)
5. Keep proper nouns, brand names, and technical terms unchanged
6. Preserve formatting, line breaks, and punctuation style
7. Do NOT add explanations or notes - ONLY return the translated text
8. For slang or idioms, find the equivalent expression in ${targetLangName}

`;

  // Add context if provided
  if (context) {
    prompt += `\nCONTEXT: ${context}\n`;
  }

  // Language-specific instructions
  switch (targetLanguage) {
    case 'he':
      prompt += `\nHEBREW-SPECIFIC RULES:
- Use modern Israeli Hebrew (not biblical)
- Preserve English brand names (Pet Wash™, K9000™, etc.)
- Use correct gender agreement
- Natural word order for spoken Hebrew
- Keep numbers and currency symbols as-is (₪, $, etc.)
`;
      break;

    case 'ar':
      prompt += `\nARABIC-SPECIFIC RULES:
- Use Modern Standard Arabic (MSA) or Levantine dialect as appropriate
- Preserve English brand names (Pet Wash™, K9000™, etc.)
- Correct gender and number agreement
- Right-to-left text direction
- Keep currency symbols as-is (₪, $, etc.)
`;
      break;

    case 'ru':
      prompt += `\nRUSSIAN-SPECIFIC RULES:
- Use contemporary Russian (not formal Soviet-era)
- Preserve English brand names (Pet Wash™, K9000™, etc.)
- Correct case declensions
- Natural colloquial phrasing
`;
      break;

    case 'fr':
      prompt += `\nFRENCH-SPECIFIC RULES:
- Use International French (not Canadian)
- Preserve English brand names (Pet Wash™, K9000™, etc.)
- Correct gender agreement
- Formal "vous" for business context, "tu" for casual
`;
      break;

    case 'es':
      prompt += `\nSPANISH-SPECIFIC RULES:
- Use International Spanish (neutral Latin American)
- Preserve English brand names (Pet Wash™, K9000™, etc.)
- Formal "usted" for business, "tú" for casual
- Natural phrasing (avoid literal translations)
`;
      break;
  }

  return prompt;
}

/**
 * Update average response time (rolling average)
 */
function updateAverageResponseTime(newTime: number): void {
  const totalTranslations = metrics.successfulTranslations;
  
  if (totalTranslations === 1) {
    metrics.averageResponseTime = newTime;
  } else {
    // Rolling average
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (totalTranslations - 1) + newTime) / totalTranslations;
  }
}

/**
 * Batch translate multiple texts (more efficient)
 */
export async function batchTranslate(
  texts: string[],
  targetLanguage: SupportedLanguage,
  sourceLanguage?: SupportedLanguage,
  context?: string
): Promise<TranslationResult[]> {
  try {
    logger.info(`[GeminiTranslation] Batch translating ${texts.length} texts to ${targetLanguage}`);

    // Translate all texts in parallel for speed
    const translationPromises = texts.map(text => 
      translateWithGemini(text, targetLanguage, sourceLanguage, context)
    );

    const results = await Promise.all(translationPromises);

    logger.info(`[GeminiTranslation] ✅ Batch translation complete`);
    return results;

  } catch (error) {
    logger.error('[GeminiTranslation] Batch translation error:', error);
    // Return failures for all texts
    return texts.map(text => ({ 
      success: false, 
      translatedText: text, 
      error: 'Batch translation failed' 
    }));
  }
}

/**
 * Get API monitoring metrics
 */
export function getTranslationMetrics(): TranslationMetrics {
  return {
    ...metrics,
    lastUpdated: new Date(metrics.lastUpdated),
  };
}

/**
 * Reset metrics (for testing or monthly reports)
 */
export function resetMetrics(): void {
  metrics.totalRequests = 0;
  metrics.successfulTranslations = 0;
  metrics.failedTranslations = 0;
  metrics.averageResponseTime = 0;
  metrics.languagePairCounts = {};
  metrics.lastUpdated = new Date();
  
  logger.info('[GeminiTranslation] Metrics reset');
}

/**
 * Get translation quality score (based on success rate)
 */
export function getQualityScore(): number {
  if (metrics.totalRequests === 0) return 100;
  
  const successRate = (metrics.successfulTranslations / metrics.totalRequests) * 100;
  return Math.round(successRate);
}

/**
 * Health check for Gemini AI translation service
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Test translation
    const testResult = await translateWithGemini(
      'Hello world',
      'es',
      'en',
      'Test translation for health check'
    );

    const responseTime = Date.now() - startTime;

    return {
      healthy: testResult.length > 0,
      responseTime,
    };

  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default {
  translateWithGemini,
  batchTranslate,
  getTranslationMetrics,
  resetMetrics,
  getQualityScore,
  healthCheck,
};
