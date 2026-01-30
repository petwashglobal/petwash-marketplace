/**
 * Global Special Days Promotions API
 *
 * Automatic discounts for international holidays
 * Pet Awareness Days Calendar with multi-language campaigns
 */
import express from 'express';
import { getTodaysPromotion, getUpcomingPromotions, applyPromotionDiscount, hasPromotionOnDate, SPECIAL_DAYS_2025 } from '../services/globalPromotions';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { db } from '../db';
import { petAwarenessDays, promotionalCampaigns } from '../../shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { contentModerationService } from '../services/ContentModerationService';
const router = express.Router();
/**
 * GET /api/promotions/today
 * Get today's active promotion
 */
router.get('/today', async (req, res) => {
    try {
        const { country } = req.query;
        const promotion = getTodaysPromotion(country);
        if (!promotion) {
            return res.json({
                success: true,
                hasPromotion: false,
                message: 'No special promotion today',
            });
        }
        res.json({
            success: true,
            hasPromotion: true,
            promotion,
        });
    }
    catch (error) {
        logger.error('[Promotions API] Error getting today\'s promotion:', error);
        res.status(500).json({ error: 'Failed to get promotion' });
    }
});
/**
 * GET /api/promotions/upcoming
 * Get upcoming promotions (next 30 days)
 */
router.get('/upcoming', async (req, res) => {
    try {
        const { country, days } = req.query;
        const daysAhead = days ? parseInt(days) : 30;
        const promotions = getUpcomingPromotions(daysAhead, country);
        res.json({
            success: true,
            count: promotions.length,
            promotions,
        });
    }
    catch (error) {
        logger.error('[Promotions API] Error getting upcoming promotions:', error);
        res.status(500).json({ error: 'Failed to get promotions' });
    }
});
/**
 * GET /api/promotions/all
 * Get all 2025 special days
 */
router.get('/all', async (req, res) => {
    try {
        res.json({
            success: true,
            count: SPECIAL_DAYS_2025.length,
            promotions: SPECIAL_DAYS_2025,
        });
    }
    catch (error) {
        logger.error('[Promotions API] Error getting all promotions:', error);
        res.status(500).json({ error: 'Failed to get promotions' });
    }
});
/**
 * POST /api/promotions/calculate
 * Calculate final price with promotion discount
 */
router.post('/calculate', async (req, res) => {
    try {
        const schema = z.object({
            basePrice: z.number().positive(),
            promotionId: z.string().optional(),
            existingDiscount: z.number().min(0).max(100).default(0),
        });
        const validation = schema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.errors
            });
        }
        const { basePrice, promotionId, existingDiscount } = validation.data;
        // Find promotion
        let promotion;
        if (promotionId) {
            promotion = SPECIAL_DAYS_2025.find(p => p.id === promotionId);
        }
        else {
            promotion = getTodaysPromotion();
        }
        if (!promotion) {
            return res.json({
                success: true,
                hasPromotion: false,
                finalPrice: basePrice,
                discountAmount: 0,
                discountPercent: 0,
            });
        }
        const result = applyPromotionDiscount(basePrice, promotion, existingDiscount);
        res.json({
            success: true,
            hasPromotion: true,
            promotion,
            ...result,
        });
    }
    catch (error) {
        logger.error('[Promotions API] Error calculating discount:', error);
        res.status(500).json({ error: 'Failed to calculate discount' });
    }
});
/**
 * GET /api/promotions/check/:date
 * Check if a specific date has a promotion
 */
router.get('/check/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { country } = req.query;
        const checkDate = new Date(date);
        if (isNaN(checkDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const hasPromo = hasPromotionOnDate(checkDate, country);
        res.json({
            success: true,
            date,
            hasPromotion: hasPromo,
        });
    }
    catch (error) {
        logger.error('[Promotions API] Error checking date:', error);
        res.status(500).json({ error: 'Failed to check date' });
    }
});
// =================== PET AWARENESS DAYS CALENDAR ===================
// Get all pet awareness days from database
router.get('/calendar', async (req, res) => {
    try {
        const { locale } = req.query;
        const days = await db.select()
            .from(petAwarenessDays)
            .where(eq(petAwarenessDays.isActive, true))
            .orderBy(petAwarenessDays.eventDate);
        // Localize content
        const requestedLocale = locale || 'en';
        const localizedDays = days.map(day => {
            const titles = day.titleLocales;
            const descriptions = day.descriptionLocales;
            return {
                ...day,
                title: titles?.[requestedLocale] || titles?.en || day.slug,
                description: descriptions?.[requestedLocale] || descriptions?.en || '',
            };
        });
        res.json({ success: true, data: localizedDays });
    }
    catch (error) {
        logger.error('[Promotions] Failed to fetch awareness days', error);
        res.status(500).json({ error: 'Failed to fetch calendar' });
    }
});
// Get upcoming pet awareness days (next 30 days)
router.get('/calendar/upcoming', async (req, res) => {
    try {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        const days = await db.select()
            .from(petAwarenessDays)
            .where(eq(petAwarenessDays.isActive, true))
            .orderBy(petAwarenessDays.eventDate);
        // Filter by upcoming dates (handling annual recurrence)
        const upcomingDays = days.filter(day => {
            const eventDate = new Date(day.eventDate);
            eventDate.setFullYear(today.getFullYear());
            if (eventDate < today) {
                eventDate.setFullYear(today.getFullYear() + 1);
            }
            return eventDate >= today && eventDate <= thirtyDaysFromNow;
        });
        res.json({ success: true, data: upcomingDays });
    }
    catch (error) {
        logger.error('[Promotions] Failed to fetch upcoming days', error);
        res.status(500).json({ error: 'Failed to fetch upcoming days' });
    }
});
// =================== PROMOTIONAL CAMPAIGNS ===================
// Get all campaigns
router.get('/campaigns', async (req, res) => {
    try {
        const { status, locale } = req.query;
        let campaigns;
        if (status) {
            campaigns = await db.select()
                .from(promotionalCampaigns)
                .where(eq(promotionalCampaigns.status, status))
                .orderBy(desc(promotionalCampaigns.startAt));
        }
        else {
            campaigns = await db.select()
                .from(promotionalCampaigns)
                .orderBy(desc(promotionalCampaigns.startAt));
        }
        // Localize content
        const requestedLocale = locale || 'en';
        const localizedCampaigns = campaigns.map(campaign => {
            const content = campaign.contentLocales;
            return {
                ...campaign,
                localizedContent: content?.[requestedLocale] || content?.en,
            };
        });
        res.json({ success: true, data: localizedCampaigns });
    }
    catch (error) {
        logger.error('[Promotions] Failed to fetch campaigns', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});
// Get live campaigns only
router.get('/campaigns/live', async (req, res) => {
    try {
        const now = new Date();
        const campaigns = await db.select()
            .from(promotionalCampaigns)
            .where(and(eq(promotionalCampaigns.status, 'live'), lte(promotionalCampaigns.startAt, now), gte(promotionalCampaigns.endAt, now)))
            .orderBy(promotionalCampaigns.startAt);
        res.json({ success: true, data: campaigns });
    }
    catch (error) {
        logger.error('[Promotions] Failed to fetch live campaigns', error);
        res.status(500).json({ error: 'Failed to fetch live campaigns' });
    }
});
// Create new campaign (with AI moderation)
router.post('/campaigns', async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { contentLocales, ...rest } = req.body;
        // AI moderate all localized content before creating campaign
        const content = contentLocales;
        for (const [locale, localeContent] of Object.entries(content)) {
            const textToCheck = `${localeContent.title} ${localeContent.description}`;
            const modResult = await contentModerationService.moderateContent(textToCheck, 'post', user.id, 0);
            if (!modResult.isApproved) {
                return res.status(400).json({
                    success: false,
                    error: `Content in ${locale} failed moderation: ${modResult.explanation}`,
                    locale,
                    flags: modResult.flags,
                });
            }
        }
        const data = {
            ...rest,
            contentLocales,
            createdBy: user.id,
            status: 'draft',
        };
        const [newCampaign] = await db.insert(promotionalCampaigns).values(data).returning();
        logger.info('[Promotions] Created campaign', { id: newCampaign.id, name: newCampaign.name });
        res.json({ success: true, data: newCampaign });
    }
    catch (error) {
        logger.error('[Promotions] Failed to create campaign', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});
// Validate promo code
router.post('/validate-code', async (req, res) => {
    try {
        const { promoCode, userId } = req.body;
        if (!promoCode) {
            return res.status(400).json({ error: 'Promo code required' });
        }
        const now = new Date();
        const [campaign] = await db.select()
            .from(promotionalCampaigns)
            .where(and(eq(promotionalCampaigns.promoCode, promoCode.toUpperCase()), eq(promotionalCampaigns.status, 'live'), lte(promotionalCampaigns.startAt, now), gte(promotionalCampaigns.endAt, now)))
            .limit(1);
        if (!campaign) {
            return res.status(404).json({ error: 'Invalid or expired promo code' });
        }
        // Check max redemptions
        if (campaign.maxRedemptions && campaign.currentRedemptions &&
            campaign.currentRedemptions >= campaign.maxRedemptions) {
            return res.status(400).json({ error: 'Promo code usage limit reached' });
        }
        res.json({
            success: true,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                discountType: campaign.discountType,
                discountValue: campaign.discountValue,
                discountCurrency: campaign.discountCurrency,
                minPurchaseAmount: campaign.minPurchaseAmount,
                maxDiscountAmount: campaign.maxDiscountAmount,
            }
        });
    }
    catch (error) {
        logger.error('[Promotions] Failed to validate promo code', error);
        res.status(500).json({ error: 'Failed to validate promo code' });
    }
});
// Seed pet awareness days (dev only)
router.post('/seed-awareness-days', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Not available in production' });
        }
        const awarenessData = [
            {
                slug: 'international-dog-day',
                eventDate: '2026-08-26',
                titleLocales: { en: 'International Dog Day', he: 'יום הכלב הבינלאומי', ar: 'يوم الكلب العالمي', ru: 'Международный день собак', fr: 'Journée Internationale du Chien', es: 'Día Internacional del Perro' },
                descriptionLocales: { en: 'Celebrate all dogs and promote adoption!', he: 'חוגגים את כל הכלבים ומעודדים אימוץ!' },
                petTypes: ['dog'],
                category: 'celebration',
                defaultCampaignType: 'discount',
                suggestedDiscountPercent: 20,
                iconEmoji: '🐕',
                themeColor: '#FFB347',
            },
            {
                slug: 'international-cat-day',
                eventDate: '2026-08-08',
                titleLocales: { en: 'International Cat Day', he: 'יום החתול הבינלאומי', ar: 'يوم القط العالمي', ru: 'Международный день кошек', fr: 'Journée Internationale du Chat', es: 'Día Internacional del Gato' },
                descriptionLocales: { en: 'A day to celebrate our feline friends!', he: 'יום לחגוג את חברינו החתולים!' },
                petTypes: ['cat'],
                category: 'celebration',
                defaultCampaignType: 'discount',
                suggestedDiscountPercent: 15,
                iconEmoji: '🐈',
                themeColor: '#B19CD9',
            },
            {
                slug: 'national-pet-day',
                eventDate: '2026-04-11',
                titleLocales: { en: 'National Pet Day', he: 'יום חיית המחמד הלאומי', ar: 'يوم الحيوان الأليف الوطني', ru: 'Национальный день домашних животных', fr: 'Journée Nationale des Animaux', es: 'Día Nacional de las Mascotas' },
                descriptionLocales: { en: 'Celebrate all pets and raise awareness!', he: 'חוגגים את כל חיות המחמד!' },
                petTypes: ['dog', 'cat', 'bird', 'rabbit'],
                category: 'celebration',
                defaultCampaignType: 'discount',
                suggestedDiscountPercent: 25,
                iconEmoji: '🐾',
                themeColor: '#87CEEB',
            },
            {
                slug: 'world-animal-day',
                eventDate: '2026-10-04',
                titleLocales: { en: 'World Animal Day', he: 'יום החי העולמי', ar: 'يوم الحيوان العالمي', ru: 'Всемирный день животных', fr: 'Journée Mondiale des Animaux', es: 'Día Mundial de los Animales' },
                descriptionLocales: { en: 'Raising awareness for animal rights worldwide', he: 'מעלים מודעות לזכויות בעלי חיים' },
                petTypes: ['dog', 'cat', 'bird', 'rabbit'],
                category: 'awareness',
                defaultCampaignType: 'awareness',
                iconEmoji: '🌍',
                themeColor: '#90EE90',
            },
            {
                slug: 'national-puppy-day',
                eventDate: '2026-03-23',
                titleLocales: { en: 'National Puppy Day', he: 'יום הגור הלאומי', ar: 'يوم الجرو الوطني', ru: 'Национальный день щенков', fr: 'Journée Nationale du Chiot', es: 'Día Nacional del Cachorro' },
                descriptionLocales: { en: 'Celebrating puppies and promoting adoption!', he: 'חוגגים גורים ומעודדים אימוץ!' },
                petTypes: ['dog'],
                category: 'celebration',
                defaultCampaignType: 'discount',
                suggestedDiscountPercent: 30,
                iconEmoji: '🐶',
                themeColor: '#FFD700',
            },
            {
                slug: 'love-your-pet-day',
                eventDate: '2026-02-20',
                titleLocales: { en: 'Love Your Pet Day', he: 'יום אהבת חיית המחמד', ar: 'يوم حب حيوانك الأليف', ru: 'День любви к питомцу', fr: 'Journée d\'Amour pour Votre Animal', es: 'Día de Amar a tu Mascota' },
                descriptionLocales: { en: 'Show extra love to your furry friends!', he: 'הראו אהבה יתרה לחברים הפרוותיים!' },
                petTypes: ['dog', 'cat', 'bird', 'rabbit'],
                category: 'celebration',
                defaultCampaignType: 'bundle',
                suggestedDiscountPercent: 15,
                iconEmoji: '❤️',
                themeColor: '#FF69B4',
            },
            {
                slug: 'adopt-a-shelter-pet-day',
                eventDate: '2026-04-30',
                titleLocales: { en: 'Adopt a Shelter Pet Day', he: 'יום אימוץ חיות מחסה', ar: 'يوم تبني حيوانات المأوى', ru: 'День усыновления питомцев из приюта', fr: 'Journée d\'Adoption d\'Animaux de Refuge', es: 'Día de Adopción de Mascotas de Refugio' },
                descriptionLocales: { en: 'Give a shelter pet a forever home', he: 'תנו לחית מחסה בית לתמיד' },
                petTypes: ['dog', 'cat'],
                category: 'adoption',
                defaultCampaignType: 'referral',
                iconEmoji: '🏠',
                themeColor: '#FF6B6B',
            },
            {
                slug: 'national-cat-day',
                eventDate: '2026-10-29',
                titleLocales: { en: 'National Cat Day', he: 'יום החתול הלאומי', ar: 'يوم القط الوطني', ru: 'Национальный день кошек', fr: 'Journée Nationale du Chat', es: 'Día Nacional del Gato' },
                descriptionLocales: { en: 'Celebrate cats and encourage adoption!', he: 'חוגגים חתולים ומעודדים אימוץ!' },
                petTypes: ['cat'],
                category: 'celebration',
                defaultCampaignType: 'discount',
                suggestedDiscountPercent: 20,
                iconEmoji: '😺',
                themeColor: '#9370DB',
            },
        ];
        for (const day of awarenessData) {
            try {
                await db.insert(petAwarenessDays).values(day).onConflictDoNothing();
            }
            catch (e) {
                // Skip duplicates
            }
        }
        logger.info('[Promotions] Seeded pet awareness days');
        res.json({ success: true, message: `Seeded ${awarenessData.length} pet awareness days` });
    }
    catch (error) {
        logger.error('[Promotions] Failed to seed awareness days', error);
        res.status(500).json({ error: 'Failed to seed awareness days' });
    }
});
export default router;
