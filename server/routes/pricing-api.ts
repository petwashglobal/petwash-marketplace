import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  calculateQuote, 
  createQuoteRequest, 
  getAvailableAddons,
  getProviderRateCard,
  formatPrice,
  formatPriceSimple
} from "../services/pricing-engine";

const router = Router();

const petInfoSchema = z.object({
  type: z.enum(['dog', 'cat', 'bird', 'rabbit', 'fish', 'reptile', 'other']),
  size: z.enum(['tiny', 'small', 'medium', 'large', 'giant']).optional(),
  name: z.string().optional(),
  breed: z.string().optional()
});

const quoteInputSchema = z.object({
  providerId: z.string().min(1),
  platform: z.string().min(1),
  serviceType: z.string().min(1),
  startDate: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s)),
  pets: z.array(petInfoSchema).min(1),
  requestedAddons: z.array(z.string()).optional(),
  specialRequirements: z.string().optional()
});

router.post("/calculate-quote", async (req: Request, res: Response) => {
  try {
    const parsed = quoteInputSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format()
      });
    }

    const input = parsed.data;
    
    if (input.endDate <= input.startDate) {
      return res.status(400).json({
        error: 'End date must be after start date'
      });
    }

    const quote = await calculateQuote({
      ...input,
      startDate: input.startDate,
      endDate: input.endDate
    });

    if (!quote) {
      return res.status(404).json({
        error: 'No rate card found for this provider and service'
      });
    }

    res.json({
      success: true,
      quote: {
        ...quote,
        formatted: {
          baseAmount: formatPriceSimple(quote.baseAmount),
          additionalPets: formatPriceSimple(quote.additionalPetsAmount),
          addons: formatPriceSimple(quote.addonsAmount),
          surcharges: formatPriceSimple(quote.surchargeAmount),
          discounts: formatPriceSimple(quote.discountAmount),
          subtotal: formatPriceSimple(quote.subtotal),
          commission: formatPriceSimple(quote.commission),
          total: formatPriceSimple(quote.total),
          providerPayout: formatPriceSimple(quote.providerPayout)
        }
      }
    });
  } catch (error) {
    console.error('Quote calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate quote'
    });
  }
});

router.post("/request-quote", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = quoteInputSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format()
      });
    }

    const input = parsed.data;
    
    const { quoteId, quote } = await createQuoteRequest(
      {
        ...input,
        startDate: input.startDate,
        endDate: input.endDate
      },
      user.uid
    );

    res.json({
      success: true,
      quoteId,
      quote: quote ? {
        ...quote,
        formatted: {
          total: formatPriceSimple(quote.total),
          providerPayout: formatPriceSimple(quote.providerPayout)
        }
      } : null
    });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({
      error: 'Failed to create quote request'
    });
  }
});

router.get("/addons/:platform/:serviceType", async (req: Request, res: Response) => {
  try {
    const { platform, serviceType } = req.params;
    const addons = await getAvailableAddons(platform, serviceType);
    
    res.json({
      success: true,
      addons: addons.map(addon => ({
        id: addon.addonId,
        code: addon.code,
        name: {
          en: addon.nameEn,
          he: addon.nameHe
        },
        description: {
          en: addon.descriptionEn,
          he: addon.descriptionHe
        },
        suggestedPrice: formatPriceSimple(addon.suggestedPriceCents || 0),
        suggestedPriceCents: addon.suggestedPriceCents,
        icon: addon.icon
      }))
    });
  } catch (error) {
    console.error('Get addons error:', error);
    res.status(500).json({
      error: 'Failed to get add-ons'
    });
  }
});

router.get("/provider-rates/:providerId/:platform/:serviceType", async (req: Request, res: Response) => {
  try {
    const { providerId, platform, serviceType } = req.params;
    const rateCard = await getProviderRateCard(providerId, platform, serviceType);
    
    if (!rateCard) {
      return res.status(404).json({
        error: 'Rate card not found'
      });
    }

    res.json({
      success: true,
      rateCard: {
        baseRatePerNight: rateCard.baseRatePerNightCents ? formatPriceSimple(rateCard.baseRatePerNightCents) : null,
        baseRatePerHour: rateCard.baseRatePerHourCents ? formatPriceSimple(rateCard.baseRatePerHourCents) : null,
        baseRatePerVisit: rateCard.baseRatePerVisitCents ? formatPriceSimple(rateCard.baseRatePerVisitCents) : null,
        additionalPetSurcharge: formatPriceSimple(rateCard.additionalPetSurchargeCents || 0),
        maxPets: rateCard.maxPets,
        weeklyDiscount: rateCard.weeklyDiscountPercent ? `${rateCard.weeklyDiscountPercent}%` : null,
        monthlyDiscount: rateCard.monthlyDiscountPercent ? `${rateCard.monthlyDiscountPercent}%` : null,
        weekendSurcharge: rateCard.weekendSurchargePercent ? `${rateCard.weekendSurchargePercent}%` : null,
        holidaySurcharge: rateCard.holidaySurchargePercent ? `${rateCard.holidaySurchargePercent}%` : null,
        enabledAddons: rateCard.enabledAddons,
        addonPricing: rateCard.addonPricing
      }
    });
  } catch (error) {
    console.error('Get rate card error:', error);
    res.status(500).json({
      error: 'Failed to get rate card'
    });
  }
});

router.post("/instant-estimate", async (req: Request, res: Response) => {
  try {
    const { serviceType, location, startDate, endDate, petType, petCount = 1 } = req.body;

    if (!serviceType || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required fields: serviceType, startDate, endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const avgRates: Record<string, { base: number; additional: number }> = {
      'pet_sitting': { base: 15000, additional: 5000 },
      'house_sitting': { base: 20000, additional: 5000 },
      'daycare': { base: 10000, additional: 3000 },
      'dog_walking': { base: 5000, additional: 2000 },
      'drop_in_visit': { base: 3000, additional: 1000 },
      'pet_taxi': { base: 8000, additional: 2000 },
      'grooming': { base: 15000, additional: 5000 },
      'training': { base: 20000, additional: 0 },
      'k9000_wash': { base: 5000, additional: 0 }
    };

    const rates = avgRates[serviceType] || { base: 10000, additional: 3000 };
    const additionalPets = Math.max(0, petCount - 1);
    
    const baseEstimate = rates.base * nights;
    const additionalEstimate = rates.additional * nights * additionalPets;
    const subtotal = baseEstimate + additionalEstimate;
    
    const lowEstimate = Math.round(subtotal * 0.8);
    const highEstimate = Math.round(subtotal * 1.3);

    res.json({
      success: true,
      estimate: {
        nights,
        petCount,
        range: {
          low: formatPriceSimple(lowEstimate),
          high: formatPriceSimple(highEstimate),
          lowCents: lowEstimate,
          highCents: highEstimate
        },
        average: formatPriceSimple(subtotal),
        averageCents: subtotal,
        note: 'This is an estimate. Actual prices vary by provider.'
      }
    });
  } catch (error) {
    console.error('Instant estimate error:', error);
    res.status(500).json({
      error: 'Failed to calculate estimate'
    });
  }
});

export default router;
