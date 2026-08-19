/**
 * PetIdentificationService — Gemini Vision "identify this pet from a photo".
 *
 * Ships against the WhatIDog competitive gap (2026-08-19 CEO approval): they
 * copied our PawFinder concept, but they can't ask Gemini to name the species,
 * guess the breed, and pull the primary coat colour off a lost-pet photo. We
 * can. The output auto-fills the PawFinder post form so a distraught owner or
 * finder taps once, snaps a photo, and gets a pre-filled report they only need
 * to review — not compose.
 *
 * Uses the SAME Gemini stack ContentModerationService already runs on
 * (`@google/genai` + `getVertexAIConfig()`), so no new dependency, no new
 * secret. Fail-quiet when the key is missing — the route still returns the
 * upload URL and the client falls back to manual fill-in.
 */

import { GoogleGenAI } from '@google/genai';
import { getVertexAIConfig } from '../lib/gemini-client';
import { logger } from '../lib/logger';

export type PetSpecies =
  | 'dog'
  | 'cat'
  | 'bird'
  | 'rabbit'
  | 'guinea_pig'
  | 'hamster'
  | 'reptile'
  | 'fish'
  | 'other';

export interface PetIdentificationResult {
  ok: boolean;
  species?: PetSpecies;
  breedGuess?: string | null;
  primaryColor?: string | null;
  distinctiveFeatures?: string | null;
  /** Confidence 0..1 — capped at 0.9 to keep the UI honest (never present as "certain"). */
  confidence?: number;
  /** True when Gemini is offline / not configured — the caller falls back to manual fill. */
  degraded?: boolean;
  /** Machine-readable failure code so the UI can decide whether to retry silently. */
  errorCode?: 'no_gemini' | 'no_json' | 'gemini_error' | 'not_a_pet';
}

const CANONICAL_SPECIES: PetSpecies[] = [
  'dog', 'cat', 'bird', 'rabbit', 'guinea_pig', 'hamster', 'reptile', 'fish', 'other',
];

function coerceSpecies(raw: unknown): PetSpecies | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if ((CANONICAL_SPECIES as string[]).includes(t)) return t as PetSpecies;
  // Common synonyms the model likes to return.
  if (['puppy', 'canine'].includes(t)) return 'dog';
  if (['kitten', 'feline'].includes(t)) return 'cat';
  if (['parrot', 'parakeet', 'cockatiel', 'canary', 'budgie'].includes(t)) return 'bird';
  if (['bunny'].includes(t)) return 'rabbit';
  if (['lizard', 'snake', 'turtle', 'tortoise', 'gecko', 'iguana'].includes(t)) return 'reptile';
  if (['goldfish', 'koi', 'betta'].includes(t)) return 'fish';
  return 'other';
}

class PetIdentificationService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.genAI = new GoogleGenAI(getVertexAIConfig());
        logger.info('[PetIdentification] Gemini initialized');
      } catch (err: any) {
        logger.warn('[PetIdentification] Gemini init failed', { err: err?.message });
        this.genAI = null;
      }
    } else {
      logger.info('[PetIdentification] Gemini key missing — service degraded, no auto-identify');
    }
  }

  /**
   * Identify the pet in an uploaded image.
   * Never throws — always returns a result object.
   * Fail-quiet: if Gemini is offline, returns { ok:true, degraded:true, errorCode:'no_gemini' }.
   */
  async identifyFromBuffer(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<PetIdentificationResult> {
    if (!this.genAI) {
      return { ok: true, degraded: true, errorCode: 'no_gemini' };
    }
    try {
      const base64Image = imageBuffer.toString('base64');
      const prompt = `You are the PetWash™ pet-identifier. This photo may be a lost or found pet.
Look at the animal and reply ONLY with a compact JSON object (no prose, no markdown).

Schema:
{
  "species": one of "dog" | "cat" | "bird" | "rabbit" | "guinea_pig" | "hamster" | "reptile" | "fish" | "other",
  "breed_guess": short breed or breed-mix name (English), or null if unsure,
  "primary_color": one short colour phrase like "black and white" | "ginger tabby" | "chocolate brown", or null,
  "distinctive_features": short comma-separated list (e.g. "green collar, one blue eye"), or null,
  "confidence": number between 0 and 1
}

If the photo does NOT show an animal, return {"species":"other","breed_guess":null,"primary_color":null,"distinctive_features":null,"confidence":0}.
Do NOT include any keys beyond the schema. Do NOT wrap in \`\`\`.`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Image } },
          ],
        }],
      });

      const responseText = (result as any).text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ok: true, degraded: true, errorCode: 'no_json' };
      }

      let parsed: any;
      try { parsed = JSON.parse(jsonMatch[0]); } catch {
        return { ok: true, degraded: true, errorCode: 'no_json' };
      }

      const species = coerceSpecies(parsed.species);
      const rawConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
      const confidence = Math.max(0, Math.min(0.9, rawConfidence));

      // "Not a pet" signal: model responded with confidence 0 and other=species.
      if (species === 'other' && confidence <= 0.05) {
        return { ok: true, degraded: true, errorCode: 'not_a_pet', species: 'other', confidence: 0 };
      }

      return {
        ok: true,
        species,
        breedGuess: typeof parsed.breed_guess === 'string' && parsed.breed_guess.trim()
          ? parsed.breed_guess.trim().slice(0, 100)
          : null,
        primaryColor: typeof parsed.primary_color === 'string' && parsed.primary_color.trim()
          ? parsed.primary_color.trim().slice(0, 60)
          : null,
        distinctiveFeatures: typeof parsed.distinctive_features === 'string' && parsed.distinctive_features.trim()
          ? parsed.distinctive_features.trim().slice(0, 200)
          : null,
        confidence,
      };
    } catch (err: any) {
      logger.warn('[PetIdentification] Gemini call failed', { err: err?.message });
      return { ok: true, degraded: true, errorCode: 'gemini_error' };
    }
  }
}

export const petIdentificationService = new PetIdentificationService();
