/**
 * Content Moderation Service - Dual-Stage AI Moderation
 * 2025 Enterprise Build Mandate: Zero-tolerance policy enforcement
 * 
 * Stage 1: Keyword blocklist filtering (fast, deterministic)
 * Stage 2: LLM sentiment analysis (contextual, adaptive)
 * Stage 3: Image moderation via Gemini Vision (provider photos, uploads)
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

interface ImageModerationResult {
  isApproved: boolean;
  flags: string[];
  safetyScore: number;
  explanation: string;
  category?: string;
}

class ContentModerationService {
  private genAI: GoogleGenAI | null = null;
  private blocklist: Map<string, string[]>; // language -> blocked terms

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({
        apiKey,
        ...(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL, apiVersion: '' } } : {}),
      });
      logger.info('[ContentModeration] ✅ Gemini AI initialized');
    } else {
      logger.warn('[ContentModeration] ⚠️ Gemini API key not found - AI moderation disabled');
    }

    // Multi-language blocklist (Hebrew + English + Arabic + Russian + French + Spanish)
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
      ['fr', [
        // French profanity
        'merde', 'putain', 'salope', 'connard', 'connasse', 'enculé',
        'nique', 'bordel', 'foutre', 'pute', 'batard', 'fils de pute',
        'ta gueule', 'casse-toi', 'va te faire',
      ]],
      ['es', [
        // Spanish profanity
        'mierda', 'puta', 'puto', 'cabrón', 'pendejo', 'chingar',
        'joder', 'coño', 'verga', 'culo', 'maricón', 'hijo de puta',
        'vete a la mierda', 'pinche', 'culero',
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

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const response = result.text || '';

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
   * Image moderation using Gemini Vision
   * Checks uploaded images for inappropriate content:
   * - Sexual/pornographic content
   * - Drug paraphernalia or usage
   * - Excessive alcohol display
   * - Violence or weapons
   * - Hate symbols
   * 
   * NOTE: This is intentionally NOT harsh - casual lifestyle photos,
   * pets near food/drinks, normal beach photos etc. are all fine.
   * Only truly inappropriate content gets flagged.
   */
  async moderateImage(
    imageBuffer: Buffer,
    mimeType: string,
    context: {
      userId: string;
      uploadType: 'profile_photo' | 'gallery_photo' | 'document' | 'message_attachment' | 'avatar' | 'health_report';
      platform?: string;
    }
  ): Promise<ImageModerationResult> {
    logger.info('[ContentModeration] 🖼️ Analyzing image', {
      userId: context.userId,
      uploadType: context.uploadType,
      sizeKB: Math.round(imageBuffer.length / 1024),
    });

    if (!this.genAI) {
      logger.warn('[ContentModeration] Gemini unavailable - allowing image (no AI check)');
      return {
        isApproved: true,
        flags: [],
        safetyScore: 70,
        explanation: 'AI moderation unavailable - image allowed by default',
      };
    }

    try {
      const base64Image = imageBuffer.toString('base64');

      const prompt = `You are a content moderation AI for ⁦Pet Wash™⁩, a family-friendly luxury pet care platform.

Analyze this uploaded image and check ONLY for clearly inappropriate content:

REJECT (score 0-30):
- Explicit sexual/pornographic content or nudity
- Hard drug use or drug paraphernalia (syringes, pipes, etc.)
- Graphic violence, gore, or weapons being used threateningly
- Hate symbols (swastikas, KKK imagery, etc.)
- Child exploitation or endangerment

ALLOW (score 60-100) - these are perfectly fine:
- Normal selfies, profile photos, family photos
- Photos with pets, animals, nature
- Casual lifestyle photos (beach, pool, outdoor activities)
- Photos showing food or beverages (including wine/beer in normal social settings)
- Photos with mild/tasteful humor
- Professional photos, certificates, documents
- Home environment photos (for pet sitter profiles)
- Photos with slight imperfections (blurry, poor lighting, etc.)

Be RELAXED and reasonable - this is a pet care platform, not a children's app.
Normal adult content is fine. Only flag truly harmful or explicit material.

Upload type: ${context.uploadType}
Platform: ${context.platform || 'general'}

Respond in JSON:
{
  "isApproved": boolean,
  "flags": ["flag1"],
  "safetyScore": number (0-100, higher is safer),
  "explanation": "brief friendly reason",
  "category": "safe" | "borderline" | "inappropriate" | "explicit"
}`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              }
            }
          ]
        }],
      });

      const responseText = result.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const aiResult = JSON.parse(jsonMatch[0]);
        const moderationResult: ImageModerationResult = {
          isApproved: aiResult.isApproved !== false,
          flags: Array.isArray(aiResult.flags) ? aiResult.flags : [],
          safetyScore: typeof aiResult.safetyScore === 'number' ? aiResult.safetyScore : 70,
          explanation: aiResult.explanation || 'Image reviewed by AI',
          category: aiResult.category || 'safe',
        };

        try {
          await db.insert(contentModerationLogs).values({
            contentType: 'image',
            contentId: 0,
            userId: context.userId,
            originalContent: `[IMAGE:${context.uploadType}] ${mimeType} ${Math.round(imageBuffer.length / 1024)}KB`,
            moderationResult: moderationResult.isApproved ? 'approved' : 'rejected',
            flags: moderationResult.flags,
            safetyScore: moderationResult.safetyScore,
            aiModel: 'gemini-2.0-flash',
            notes: `${moderationResult.explanation} | category: ${moderationResult.category}`,
          });
        } catch (logErr) {
          logger.warn('[ContentModeration] Failed to log image moderation', logErr);
        }

        if (moderationResult.isApproved) {
          logger.info('[ContentModeration] ✅ Image approved', {
            safetyScore: moderationResult.safetyScore,
            category: moderationResult.category,
          });
        } else {
          logger.warn('[ContentModeration] ❌ Image rejected', {
            flags: moderationResult.flags,
            category: moderationResult.category,
            explanation: moderationResult.explanation,
          });
        }

        return moderationResult;
      }

      logger.warn('[ContentModeration] Could not parse AI image response - allowing by default');
      return {
        isApproved: true,
        flags: [],
        safetyScore: 65,
        explanation: 'AI response parsing issue - image allowed',
      };

    } catch (error: any) {
      logger.error('[ContentModeration] Image moderation error (allowing by default)', error);
      return {
        isApproved: true,
        flags: [],
        safetyScore: 60,
        explanation: 'Moderation service temporarily unavailable - image allowed',
      };
    }
  }

  /**
   * Moderate image from a URL (for images already uploaded to storage)
   * Downloads the image and runs moderation
   */
  async moderateImageFromUrl(
    imageUrl: string,
    context: {
      userId: string;
      uploadType: 'profile_photo' | 'gallery_photo' | 'document' | 'message_attachment' | 'avatar' | 'health_report';
      platform?: string;
    }
  ): Promise<ImageModerationResult> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        logger.warn('[ContentModeration] Failed to fetch image for moderation', { url: imageUrl.substring(0, 50) });
        return { isApproved: true, flags: [], safetyScore: 60, explanation: 'Could not fetch image for review' };
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return this.moderateImage(buffer, contentType, context);
    } catch (err) {
      logger.error('[ContentModeration] Image URL moderation error', err);
      return { isApproved: true, flags: [], safetyScore: 60, explanation: 'Image URL moderation failed - allowed by default' };
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
