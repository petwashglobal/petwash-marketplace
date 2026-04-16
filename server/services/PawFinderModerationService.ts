/**
 * Paw Finder Moderation Service
 * Three-stage: keyword rules (fast) → Gemini image scan (vision) → Gemini text AI (contextual)
 * Backend is always the authority — Gemini is advisory only.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { getVertexAIConfig } from '../lib/gemini-client';
import { logger } from '../lib/logger';

export interface ModerationInput {
  title?: string | null;
  description: string;
  rewardAmount?: number | null;
  city: string;
  area?: string | null;
  postType: 'lost' | 'found';
  petType: 'dog' | 'cat' | 'bird' | 'other';
  mediaPaths: string[];
}

export interface ModerationResult {
  verdict: 'approved' | 'flagged' | 'blocked';
  confidence: number;
  flags: string[];
  moderationReason: string;
  safeToPublish: boolean;
}

const BLOCKED_FLAGS = [
  'sexual_content', 'drug_content', 'political_content', 'hate_content', 'violent_content',
  'gore_content', 'abuse_content', 'weapons_content', 'illegal_sale',
];

const BANNED: Record<string, string[]> = {
  sexual_content:   ['sex', 'sexual', 'escort', 'nude', 'porn', 'naked', 'erotic'],
  drug_content:     ['cocaine', 'heroin', 'weed', 'drug', 'סם', 'סמים', 'קנאביס', 'cannabis'],
  political_content:['vote', 'election', 'politic', 'party', 'בחירות', 'פוליטי', 'מפלגה'],
  hate_content:     ['kill jews', 'kill arabs', 'hate', 'racist', 'racism', 'antisemit', 'להרוג ערבים', 'להרוג יהודים'],
  violent_content:  ['shoot', 'stab', 'murder', 'beat him', 'violence', 'kill', 'לירות', 'לדקור'],
  gore_content:     ['gore', 'blood', 'corpse', 'dead animal', 'mutilat', 'decapitat', 'חיה מתה', 'גופה'],
  abuse_content:    ['abuse', 'abusing', 'torture', 'cruelty', 'animal cruelty', 'hit the dog', 'beat the cat', 'עינוי', 'התעללות'],
  weapons_content:  ['gun', 'pistol', 'rifle', 'knife', 'weapon', 'firearm', 'bullet', 'נשק', 'אקדח', 'סכין'],
  illegal_sale:     ['for sale', 'buy now', 'selling', 'price', 'payment', 'sell my dog', 'sell my cat', 'מכירה', 'למכירה', 'קנייה'],
  spam_content:     ['telegram me', 'crypto', 'investment', 'loan', 'casino', 'betting', 'bitcoin'],
};

const PHONE_RE = /(\+?\d[\d\s\-]{7,})/;

export class PawFinderModerationService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI(getVertexAIConfig());
    }
  }

  private ruleFlags(input: ModerationInput): string[] {
    const text = `${input.title ?? ''}\n${input.description ?? ''}`.toLowerCase();
    const flags: string[] = [];
    for (const [flag, terms] of Object.entries(BANNED)) {
      if (terms.some(t => text.includes(t))) flags.push(flag);
    }
    if (PHONE_RE.test(text)) flags.push('direct_phone_in_text');
    if ((input.rewardAmount ?? 0) > 10_000) flags.push('reward_too_high');
    return [...new Set(flags)];
  }

  private verdictFromFlags(flags: string[]): Pick<ModerationResult, 'verdict' | 'confidence' | 'moderationReason'> {
    if (flags.some(f => BLOCKED_FLAGS.includes(f))) {
      return { verdict: 'blocked', confidence: 96, moderationReason: 'תוכן חסום על ידי כללי הבטיחות' };
    }
    if (flags.length > 0) {
      return { verdict: 'flagged', confidence: 78, moderationReason: 'הפוסט מצריך בדיקה ידנית' };
    }
    return { verdict: 'approved', confidence: 92, moderationReason: 'בטוח לפרסום' };
  }

  /**
   * Scans up to 3 uploaded images with Gemini Vision.
   * Returns any content flags detected in the photos.
   * Non-blocking: if Gemini is unavailable the post is flagged for manual review.
   */
  private async moderateImages(mediaPaths: string[]): Promise<string[]> {
    if (!this.genAI || !mediaPaths.length) return [];

    // Cap at 3 images to bound latency
    const pathsToScan = mediaPaths.slice(0, 3);
    const allImageFlags: string[] = [];

    for (const filePath of pathsToScan) {
      // Validate path is within the expected upload directory
      const resolved = path.resolve(filePath);
      const cwd = process.cwd();
      const uploadsDir = path.resolve(cwd, 'uploads');
      const tempDir = '/tmp';
      if (!resolved.startsWith(uploadsDir + path.sep) && !resolved.startsWith(tempDir + path.sep)) {
        logger.warn('[PawFinderModeration] Skipping image outside upload dir', { filePath });
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(resolved);
        const imageData  = fileBuffer.toString('base64');

        // Detect MIME type from file extension
        const ext = path.extname(resolved).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.png': 'image/png', '.webp': 'image/webp',
          '.heic': 'image/heic', '.heif': 'image/heif',
        };
        const mimeType = mimeMap[ext] ?? 'image/jpeg';

        const prompt =
          `You are a content safety moderator for a family-friendly lost/found pet platform.
Examine this image and respond ONLY with valid JSON:
{
  "safe": true or false,
  "flags": ["list_of_concern_types"]
}

Concern types (only flag what you actually see):
- sexual_content: nudity, sexual acts, sexually suggestive content
- gore_content: visible blood, wounds, dead animals, mutilation
- violent_content: violence against animals or people
- abuse_content: animal cruelty, abuse, or neglect
- weapons_content: visible firearms, knives, or other weapons
- drug_content: drug paraphernalia or substances
- hate_content: hate symbols or imagery
- disturbing_content: disturbing, graphic, or unsafe for family viewing

A photo of a lost or found pet with normal surroundings should always be safe = true.`;

        const response = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: imageData } },
              { text: prompt },
            ],
          }],
          config: { temperature: 0.1, maxOutputTokens: 256 },
        });

        const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.safe && Array.isArray(parsed.flags)) {
            allImageFlags.push(...parsed.flags);
          }
        }
      } catch (err: any) {
        // If we cannot scan an image, flag for manual review rather than auto-publishing
        logger.warn('[PawFinderModeration] Image scan failed — flagging for manual review', {
          filePath, error: err.message,
        });
        allImageFlags.push('image_scan_failed');
      }
    }

    return [...new Set(allImageFlags)];
  }

  async moderateInitial(input: ModerationInput): Promise<ModerationResult> {
    const flags = this.ruleFlags(input);
    const { verdict, confidence, moderationReason } = this.verdictFromFlags(flags);

    // Gemini deep check for borderline content (only when not already blocked)
    if (verdict !== 'blocked' && this.genAI) {
      try {
        const prompt = `You are a content moderator for a lost/found pet platform in Israel.
Review this post and respond ONLY with valid JSON:
{
  "safe": true/false,
  "flags": ["list_of_concern_types"],
  "reason": "brief Hebrew or English explanation"
}

Post type: ${input.postType}
Pet type: ${input.petType}
City: ${input.city}
Description: ${input.description}
${input.rewardAmount ? `Reward: ₪${input.rewardAmount}` : ''}

Concern types: sexual_content, drug_content, political_content, hate_content, violent_content, spam_content, scam_pattern, unsafe_personal_data`;

        const res = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { temperature: 0.1, maxOutputTokens: 256 },
        });

        const raw = res.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.safe) {
            const aiFlags: string[] = parsed.flags ?? [];
            const allFlags = [...new Set([...flags, ...aiFlags])];
            const { verdict: aiVerdict, confidence: aiConf, moderationReason: aiReason } = this.verdictFromFlags(allFlags);
            return { verdict: aiVerdict, confidence: aiConf, flags: allFlags, moderationReason: parsed.reason || aiReason, safeToPublish: aiVerdict === 'approved' };
          }
        }
      } catch (err: any) {
        logger.warn('[PawFinderModeration] Gemini check failed (non-blocking)', { error: err.message });
      }
    }

    return { verdict, confidence, flags, moderationReason, safeToPublish: verdict === 'approved' };
  }

  async moderateFinal(input: ModerationInput): Promise<ModerationResult> {
    const result = await this.moderateInitial(input);

    // Block if image scanning raised hard flags (even if text was clean)
    if (result.verdict !== 'blocked' && input.mediaPaths.length > 0) {
      const imageFlags = await this.moderateImages(input.mediaPaths);
      if (imageFlags.length > 0) {
        const combinedFlags = [...new Set([...result.flags, ...imageFlags])];
        const { verdict, confidence, moderationReason } = this.verdictFromFlags(combinedFlags);
        const updatedReason = imageFlags.includes('image_scan_failed')
          ? 'לא ניתן היה לסרוק את התמונות — הפוסט ממתין לבדיקה ידנית'
          : moderationReason;
        return {
          verdict,
          confidence,
          flags: combinedFlags,
          moderationReason: updatedReason,
          safeToPublish: verdict === 'approved',
        };
      }
    }

    if (result.verdict === 'approved' && input.mediaPaths.length === 0) {
      return {
        verdict: 'flagged',
        confidence: 74,
        flags: ['missing_media'],
        moderationReason: 'חובה לצרף תמונה של החיה',
        safeToPublish: false,
      };
    }

    return result;
  }

  async logModerationEvent(
    pool: any,
    postId: number,
    stage: string,
    result: ModerationResult,
    actorUserId?: string | null,
  ) {
    try {
      await pool.query(
        `INSERT INTO paw_finder_moderation_events
         (post_id, stage, verdict, confidence, flags, raw_summary, actor_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          postId, stage, result.verdict, result.confidence,
          JSON.stringify(result.flags ?? []),
          JSON.stringify({ moderationReason: result.moderationReason, safeToPublish: result.safeToPublish }),
          actorUserId ?? null,
        ],
      );
    } catch (err: any) {
      logger.warn('[PawFinderModeration] Log write failed', { error: err.message });
    }
  }
}

export const pawFinderModeration = new PawFinderModerationService();
