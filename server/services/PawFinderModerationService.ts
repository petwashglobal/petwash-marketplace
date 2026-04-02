/**
 * Paw Finder Moderation Service
 * Two-stage: keyword rules (fast) → Gemini AI (contextual)
 * Backend is always the authority — Gemini is advisory only.
 */

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

const BLOCKED_FLAGS = ['sexual_content', 'drug_content', 'political_content', 'hate_content', 'violent_content'];

const BANNED: Record<string, string[]> = {
  sexual_content:   ['sex', 'sexual', 'escort', 'nude', 'porn', 'naked', 'erotic'],
  drug_content:     ['cocaine', 'heroin', 'weed', 'drug', 'סם', 'סמים', 'קנאביס', 'cannabis'],
  political_content:['vote', 'election', 'politic', 'party', 'בחירות', 'פוליטי', 'מפלגה'],
  hate_content:     ['kill jews', 'kill arabs', 'hate', 'racist', 'racism', 'antisemit', 'להרוג ערבים', 'להרוג יהודים'],
  violent_content:  ['shoot', 'stab', 'murder', 'beat him', 'violence', 'kill', 'לירות', 'לדקור'],
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
