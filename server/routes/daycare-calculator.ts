import { getVertexAIConfig } from '../lib/gemini-client';
/**
 * Daycare Smart Price Calculator — Gemini AI powered
 * Calculates daycare cost for dogs/cats with:
 * - Multi-pet math (2 dogs + 1 cat for a week, etc.)
 * - Flash deal application
 * - VAT (18% Israel)
 * - AI explanation of the breakdown in Hebrew/English
 */

import express, { type Router } from 'express';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

const router: Router = express.Router();

// ── Pricing tiers (ILS per day) ───────────────────────────────────────────────
const BASE_RATES: Record<string, Record<string, number>> = {
  dog: { small: 85, medium: 110, large: 140, giant: 175 },
  cat: { small: 70, medium: 85, large: 100, giant: 120 },
};

const MULTI_PET_DISCOUNTS: Record<number, number> = {
  1: 0,
  2: 0.08,   // 8% for 2 pets
  3: 0.14,   // 14% for 3 pets
  4: 0.18,   // 18% for 4+
};

const VAT_RATE = ISRAEL_VAT_RATE; // PR-W13: shared/israel-compliance-config.ts
const WEEKLY_DISCOUNT = 0.12; // 12% for booking 7+ days

const petSchema = z.object({
  type: z.enum(['dog', 'cat']),
  size: z.enum(['small', 'medium', 'large', 'giant']),
  name: z.string().optional(),
});

const calcSchema = z.object({
  pets: z.array(petSchema).min(1).max(6),
  days: z.number().int().min(1).max(90),
  flashDealId: z.string().optional(),
  flashDiscountPercent: z.number().min(0).max(40).optional(),
  currency: z.enum(['ILS', 'USD', 'EUR']).default('ILS'),
  language: z.enum(['he', 'en']).default('he'),
});

// ── POST /api/daycare-calculator/calculate ────────────────────────────────────
router.post('/calculate', async (req, res) => {
  const parsed = calcSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
  }

  const { pets, days, flashDiscountPercent = 0, language } = parsed.data;

  // 1. Base per-pet daily costs
  const petBreakdowns = pets.map(pet => {
    const dailyRate = BASE_RATES[pet.type]?.[pet.size] ?? BASE_RATES['dog']['medium'];
    const subtotalBeforeDiscount = dailyRate * days;
    return {
      name: pet.name || `${pet.type} (${pet.size})`,
      type: pet.type,
      size: pet.size,
      dailyRate,
      days,
      subtotal: subtotalBeforeDiscount,
    };
  });

  const baseTotal = petBreakdowns.reduce((s, p) => s + p.subtotal, 0);

  // 2. Multi-pet discount
  const numPets = pets.length;
  const multiPetDiscountRate = MULTI_PET_DISCOUNTS[Math.min(numPets, 4)] ?? 0.18;
  const multiPetSaving = Math.round(baseTotal * multiPetDiscountRate);

  // 3. Weekly discount
  const weeklyDiscountRate = days >= 7 ? WEEKLY_DISCOUNT : 0;
  const weeklyDiscountAmount = Math.round((baseTotal - multiPetSaving) * weeklyDiscountRate);

  // 4. Flash deal discount
  const afterBaseDiscounts = baseTotal - multiPetSaving - weeklyDiscountAmount;
  const flashSaving = flashDiscountPercent > 0
    ? Math.round(afterBaseDiscounts * (flashDiscountPercent / 100))
    : 0;

  // 5. Subtotal before VAT
  const subtotalBeforeVat = afterBaseDiscounts - flashSaving;

  // 6. VAT
  const vatAmount = Math.round(subtotalBeforeVat * VAT_RATE);
  const grandTotal = subtotalBeforeVat + vatAmount;
  const totalSavings = baseTotal - subtotalBeforeVat;

  const breakdown = {
    petBreakdowns,
    baseTotal,
    multiPetDiscount: { rate: multiPetDiscountRate, saving: multiPetSaving },
    weeklyDiscount: { rate: weeklyDiscountRate, saving: weeklyDiscountAmount },
    flashDiscount: { rate: flashDiscountPercent / 100, saving: flashSaving },
    subtotalBeforeVat,
    vatAmount,
    vatRate: VAT_RATE,
    grandTotal,
    totalSavings,
    pricePerDayPerPet: Math.round(grandTotal / days / numPets),
  };

  // 7. Gemini AI explanation
  let aiExplanation = null;
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI(getVertexAIConfig());

    const petList = pets.map(p => `${p.name || p.type} (${p.size} ${p.type})`).join(', ');
    const prompt = language === 'he'
      ? `אתה מחשבון מחירים חכם של PetWash™ לבית יום לחיות מחמד בישראל.
         חשב עבור: ${petList}
         מספר ימים: ${days}
         סה"כ לפני הנחות: ₪${baseTotal}
         הנחת כמה חיות: ₪${multiPetSaving} (${Math.round(multiPetDiscountRate * 100)}%)
         הנחת שבוע: ₪${weeklyDiscountAmount}
         הנחת פלאש: ₪${flashSaving}
         מע"מ 18%: ₪${vatAmount}
         סה"כ לתשלום: ₪${grandTotal}
         
         כתוב הסבר קצר (3-4 משפטים) בעברית שמסביר את המחיר בצורה ידידותית ומרגיעה. הדגש את החיסכון הכולל.`
      : `You are PetWash™'s smart daycare price calculator for Israel.
         Pets: ${petList}
         Days: ${days}
         Base total: ₪${baseTotal}
         Multi-pet discount: ₪${multiPetSaving} (${Math.round(multiPetDiscountRate * 100)}%)
         Weekly discount: ₪${weeklyDiscountAmount}
         Flash deal discount: ₪${flashSaving}
         VAT 18%: ₪${vatAmount}
         Grand total: ₪${grandTotal}
         
         Write a brief, friendly 2-3 sentence explanation in English summarizing this price breakdown and highlighting the total savings.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    aiExplanation = result.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    logger.warn('[DaycareCalc] Gemini AI explanation failed (non-blocking)', err);
  }

  res.json({
    success: true,
    breakdown,
    aiExplanation,
    summary: {
      totalPets: numPets,
      totalDays: days,
      grandTotalILS: grandTotal,
      totalSavingsILS: totalSavings,
      savingsPercent: Math.round((totalSavings / baseTotal) * 100),
    },
  });
});

// ── GET /api/daycare-calculator/rates — public rate card ─────────────────────
router.get('/rates', (req, res) => {
  res.json({
    success: true,
    currency: 'ILS',
    vatRate: VAT_RATE,
    ratesPerDay: BASE_RATES,
    discounts: {
      multiPet: MULTI_PET_DISCOUNTS,
      weekly: { minDays: 7, rate: WEEKLY_DISCOUNT },
    },
    note: 'Prices include all services. VAT added at checkout.',
  });
});

export default router;
