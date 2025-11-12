/**
 * Global Services API Routes
 * 
 * Endpoints for:
 * - Currency conversion
 * - Geolocation & country detection
 * - Multi-language support
 * - Country legal compliance
 */

import express, { Router, Request, Response } from 'express';
import { currencyService } from '../services/CurrencyService';
import { geolocationService } from '../services/GeolocationService';
import { countryLegalCompliance } from '../services/CountryLegalComplianceService';
import { SUPPORTED_LANGUAGES, getLanguageFromCountry, type LanguageCode } from '../../shared/languages';

const router = Router();

/**
 * GET /api/currency/rates
 * Get all current exchange rates
 */
router.get('/currency/rates', async (req: Request, res: Response) => {
  try {
    const rates = currencyService.getAllRates();
    
    if (!rates) {
      return res.status(503).json({
        error: 'Exchange rates not available',
        message: 'Service is initializing, please try again in a moment'
      });
    }

    res.json({
      base: rates.base,
      timestamp: rates.timestamp,
      lastUpdate: currencyService.getLastUpdateTime(),
      rates: rates.rates,
      availableCurrencies: currencyService.getAvailableCurrencies(),
    });
  } catch (error) {
    console.error('[API] Failed to get exchange rates:', error);
    res.status(500).json({ error: 'Failed to retrieve exchange rates' });
  }
});

/**
 * POST /api/currency/convert
 * Convert amount between currencies
 */
router.post('/currency/convert', async (req: Request, res: Response) => {
  try {
    const { amountCents, fromCurrency, toCurrency } = req.body;

    if (!amountCents || !fromCurrency || !toCurrency) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['amountCents', 'fromCurrency', 'toCurrency']
      });
    }

    const conversion = currencyService.convertCurrency(
      parseInt(amountCents),
      fromCurrency,
      toCurrency
    );

    res.json(conversion);
  } catch (error: any) {
    console.error('[API] Currency conversion failed:', error);
    res.status(400).json({ error: error.message || 'Conversion failed' });
  }
});

/**
 * GET /api/currency/format/:amountCents/:currency/:language
 * Format currency for display
 */
router.get('/currency/format/:amountCents/:currency/:language', async (req: Request, res: Response) => {
  try {
    const { amountCents, currency, language } = req.params;

    const formatted = currencyService.formatCurrency(
      parseInt(amountCents),
      currency,
      language as LanguageCode
    );

    res.json({ formatted });
  } catch (error: any) {
    console.error('[API] Currency formatting failed:', error);
    res.status(400).json({ error: error.message || 'Formatting failed' });
  }
});

/**
 * GET /api/geolocation/detect
 * Detect user's country from IP address
 */
router.get('/geolocation/detect', async (req: Request, res: Response) => {
  try {
    // Get IP from request (handle proxy/load balancer headers)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
               (req.headers['x-real-ip'] as string) ||
               req.socket.remoteAddress ||
               '127.0.0.1';

    // Don't detect localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return res.json({
        countryCode: 'IL', // Default to Israel for development
        countryName: 'Israel',
        countryCode3: 'ISR',
        city: 'Tel Aviv',
        region: 'Tel Aviv District',
        latitude: 32.0853,
        longitude: 34.7818,
        timezone: 'Asia/Jerusalem',
        ip,
        currency: 'ILS',
        language: 'he',
        timestamp: Date.now(),
        source: 'manual',
        confidence: 'low',
      });
    }

    const location = await geolocationService.detectCountryFromIP(ip);
    res.json(location);
  } catch (error: any) {
    console.error('[API] Geolocation detection failed:', error);
    res.status(500).json({ error: error.message || 'Detection failed' });
  }
});

/**
 * POST /api/geolocation/validate-same-country
 * Validate that owner and sitter are in the same country
 * CRITICAL: Pet Wash Stay™ only allows same-country bookings
 */
router.post('/geolocation/validate-same-country', async (req: Request, res: Response) => {
  try {
    const { ownerLocation, sitterLocation } = req.body;

    if (!ownerLocation || !sitterLocation) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['ownerLocation', 'sitterLocation']
      });
    }

    const validation = await geolocationService.validateSameCountry(
      ownerLocation,
      sitterLocation
    );

    res.json(validation);
  } catch (error: any) {
    console.error('[API] Same-country validation failed:', error);
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

/**
 * GET /api/geolocation/restrictions/:countryCode
 * Get country-specific booking restrictions
 */
router.get('/geolocation/restrictions/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const restrictions = geolocationService.getCountryRestrictions(countryCode);
    
    res.json(restrictions);
  } catch (error: any) {
    console.error('[API] Failed to get country restrictions:', error);
    res.status(500).json({ error: error.message || 'Failed to get restrictions' });
  }
});

/**
 * GET /api/legal/compliance/:countryCode
 * Get legal compliance requirements for a country
 */
router.get('/legal/compliance/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const requirements = countryLegalCompliance.getLegalRequirements(countryCode);
    
    res.json(requirements);
  } catch (error: any) {
    console.error('[API] Failed to get legal requirements:', error);
    res.status(500).json({ error: error.message || 'Failed to get requirements' });
  }
});

/**
 * POST /api/legal/validate-sitter
 * Validate sitter meets country-specific requirements
 */
router.post('/legal/validate-sitter', async (req: Request, res: Response) => {
  try {
    const { dateOfBirth, country, backgroundCheckStatus, insuranceCertUrl } = req.body;

    if (!dateOfBirth || !country) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['dateOfBirth', 'country']
      });
    }

    const validation = countryLegalCompliance.validateSitterRequirements({
      dateOfBirth,
      country,
      backgroundCheckStatus,
      insuranceCertUrl,
    });

    res.json(validation);
  } catch (error: any) {
    console.error('[API] Sitter validation failed:', error);
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

/**
 * GET /api/languages/supported
 * Get all supported languages
 */
router.get('/languages/supported', async (req: Request, res: Response) => {
  try {
    res.json({
      languages: SUPPORTED_LANGUAGES,
      default: 'he',
      fallback: 'en',
    });
  } catch (error) {
    console.error('[API] Failed to get languages:', error);
    res.status(500).json({ error: 'Failed to get languages' });
  }
});

/**
 * GET /api/languages/detect/:countryCode
 * Get recommended language for a country
 */
router.get('/languages/detect/:countryCode', async (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const language = getLanguageFromCountry(countryCode);
    
    res.json({ 
      countryCode,
      recommendedLanguage: language,
      config: SUPPORTED_LANGUAGES[language],
    });
  } catch (error) {
    console.error('[API] Language detection failed:', error);
    res.status(500).json({ error: 'Detection failed' });
  }
});

export default router;
