/**
 * Content Moderation Service - Dual-Stage AI Moderation
 * 2025 Enterprise Build Mandate: Zero-tolerance policy enforcement
 * 
 * Stage 1: Keyword blocklist filtering (fast, deterministic)
 * Stage 2: LLM sentiment analysis (contextual, adaptive)
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';
import { db } from '../db';
import { contentModerationLogs } from '../../shared/schema';

interface ModerationResult {
  isApproved: boolean;
  flags: string[];
  safetyScore: number; // 0-100, higher is safer
  explanation?: string;
}

class ContentModerationService {
  private genAI: GoogleGenAI | null = null;
  private blocklist: Map<string, string[]>; // language -> blocked terms

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI(apiKey);
      logger.info('[ContentModeration] ✅ Gemini AI initialized');
    } else {
      logger.warn('[ContentModeration] ⚠️ Gemini API key not found - AI moderation disabled');
    }

    // Multi-language blocklist (Hebrew + English + Arabic + Russian)
    this.blocklist = new Map([
      ['he', [
        // Hebrew profanity and offensive terms
        'זונה', 'שרמוטה', 'כוס', 'מניאק', 'חארה', 'זבל', 'מטומטם', 'אידיוט',
        'מפגר', 'דפוק', 'מזדיין', 'לכסאפו', 'ערס', 'חתיכת', 'מניוק',
        // Political/demographic triggers (zero tolerance)
        'ערבי מזדיין', 'יהודון', 'שמאלן', 'ימנצ׳יק', 'דתי מזדיין',
        'חילוני זבל', 'אשכנזי גזען', 'מזרחי ערס',
      ]],
      ['en', [
        // English profanity
        'fuck', 'shit', 'bitch', 'asshole', 'damn', 'cunt', 'dick', 'pussy',
        'bastard', 'whore', 'slut', 'retard', 'faggot', 'nigger',
        // Hate speech triggers
        'nazi', 'hitler', 'terrorist', 'kill yourself', 'kys',
      ]],
      ['ar', [
        // Arabic profanity (basic set)
        'كس', 'شرموطة', 'حمار', 'كلب', 'خنزير', 'زبالة',
      ]],
      ['ru', [
        // Russian profanity (basic set)
        'блять', 'сука', 'пизда', 'хуй', 'дерьмо', 'мудак',
      ]],
    ]);
  }

  /**
   * Stage 1: Fast keyword blocking
   */
  private checkBlocklist(content: string): { blocked: boolean; matches: string[] } {
    const lowerContent = content.toLowerCase();
    const matches: string[] = [];

    // Check all language blocklists
    for (const [lang, terms] of this.blocklist.entries()) {
      for (const term of terms) {
        if (lowerContent.includes(term.toLowerCase())) {
          matches.push(`${term} (${lang})`);
        }
      }
    }

    return {
      blocked: matches.length > 0,
      matches,
    };
  }

  /**
   * Stage 2: AI sentiment analysis with Gemini
   */
  private async checkWithAI(content: string): Promise<ModerationResult> {
    if (!this.genAI) {
      // Fallback: If AI unavailable, use keyword-only
      logger.warn('[ContentModeration] AI unavailable, using keyword-only moderation');
      const blocklistResult = this.checkBlocklist(content);
      return {
        isApproved: !blocklistResult.blocked,
        flags: blocklistResult.matches,
        safetyScore: blocklistResult.blocked ? 0 : 80,
        explanation: 'Keyword-only moderation (AI unavailable)',
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `You are a content moderation AI for a family-friendly pet care platform.
Analyze this user-generated content for:
1. Profanity or vulgar language
2. Hate speech or discrimination
3. Political or divisive content
4. Threats or violence
5. Spam or inappropriate advertising
6. Sexual or inappropriate content

Content to analyze: "${content}"

Respond in JSON format:
{
  "isApproved": boolean,
  "flags": ["flag1", "flag2"],
  "safetyScore": number (0-100, higher is safer),
  "explanation": "brief reason"
}

Be strict but context-aware. Reject anything offensive, hateful, or inappropriate for a family platform.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiResult = JSON.parse(jsonMatch[0]);
        return {
          isApproved: aiResult.isApproved === true,
          flags: Array.isArray(aiResult.flags) ? aiResult.flags : [],
          safetyScore: typeof aiResult.safetyScore === 'number' ? aiResult.safetyScore : 50,
          explanation: aiResult.explanation || 'AI moderation',
        };
      }

      throw new Error('Failed to parse AI response');

    } catch (error) {
      logger.error('[ContentModeration] AI analysis failed', error);
      // Fallback to keyword-only
      const blocklistResult = this.checkBlocklist(content);
      return {
        isApproved: !blocklistResult.blocked,
        flags: blocklistResult.matches,
        safetyScore: blocklistResult.blocked ? 0 : 60,
        explanation: 'AI error - fallback to keywords',
      };
    }
  }

  /**
   * Dual-stage content moderation
   */
  async moderateContent(
    content: string,
    contentType: 'post' | 'comment' | 'message',
    userId: string,
    contentId: number
  ): Promise<ModerationResult> {
    logger.info('[ContentModeration] Analyzing content', { contentType, userId, length: content.length });

    // Stage 1: Blocklist check (fast)
    const blocklistResult = this.checkBlocklist(content);
    
    if (blocklistResult.blocked) {
      // Immediate rejection - no need for AI
      const result: ModerationResult = {
        isApproved: false,
        flags: ['profanity-detected', ...blocklistResult.matches],
        safetyScore: 0,
        explanation: 'Blocked by keyword filter',
      };

      // Log moderation decision
      await this.logModeration(contentType, contentId, userId, content, result, 'blocklist');

      logger.warn('[ContentModeration] ❌ Content rejected (blocklist)', {
        matches: blocklistResult.matches,
      });

      return result;
    }

    // Stage 2: AI analysis (contextual)
    const aiResult = await this.checkWithAI(content);

    // Log moderation decision
    await this.logModeration(contentType, contentId, userId, content, aiResult, 'gemini-ai');

    if (aiResult.isApproved) {
      logger.info('[ContentModeration] ✅ Content approved', { safetyScore: aiResult.safetyScore });
    } else {
      logger.warn('[ContentModeration] ❌ Content rejected (AI)', { flags: aiResult.flags });
    }

    return aiResult;
  }

  /**
   * Log moderation decision to database
   */
  private async logModeration(
    contentType: string,
    contentId: number,
    userId: string,
    content: string,
    result: ModerationResult,
    method: string
  ): Promise<void> {
    try {
      await db.insert(contentModerationLogs).values({
        contentType,
        contentId,
        userId,
        originalContent: content,
        moderationResult: result.isApproved ? 'approved' : 'rejected',
        flags: result.flags,
        safetyScore: result.safetyScore,
        aiModel: method === 'gemini-ai' ? 'gemini-2.5-flash' : 'blocklist',
        notes: result.explanation,
      });
    } catch (error) {
      logger.error('[ContentModeration] Failed to log moderation', error);
    }
  }

  /**
   * Add term to blocklist (for learning/adaptation)
   */
  async addToBlocklist(term: string, language: string = 'en'): Promise<void> {
    const currentList = this.blocklist.get(language) || [];
    if (!currentList.includes(term.toLowerCase())) {
      currentList.push(term.toLowerCase());
      this.blocklist.set(language, currentList);
      logger.info('[ContentModeration] Term added to blocklist', { term, language });
    }
  }
}

export const contentModerationService = new ContentModerationService();
