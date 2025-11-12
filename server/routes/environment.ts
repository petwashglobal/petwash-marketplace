/**
 * Environment Routes
 * Luxury environmental monitoring API - Air Quality, Pollen, Weather
 * Powered by Google Air Quality API, Google Pollen API, and Gemini AI
 */

import express from 'express';
import { logger } from '../lib/logger';
import smartEnvironmentService from '../services/SmartEnvironmentService';

const router = express.Router();

/**
 * GET /api/environment/air-quality
 * Get current air quality data for a location
 * 
 * Query params:
 * - lat: Latitude (required)
 * - lng: Longitude (required)
 */
router.get('/air-quality', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lng'
      });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates: lat and lng must be numbers'
      });
    }

    logger.info('[Environment API] Fetching air quality', { latitude, longitude });

    const airQuality = await SmartEnvironmentService.getAirQuality(latitude, longitude);

    if (!airQuality) {
      return res.status(404).json({
        error: 'Air quality data not available for this location'
      });
    }

    res.json({
      success: true,
      data: airQuality
    });

  } catch (error: any) {
    logger.error('[Environment API] Air quality request failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch air quality data',
      message: error.message
    });
  }
});

/**
 * GET /api/environment/pollen
 * Get pollen forecast for a location (up to 5 days)
 * 
 * Query params:
 * - lat: Latitude (required)
 * - lng: Longitude (required)
 * - days: Number of forecast days (optional, default: 5, max: 5)
 */
router.get('/pollen', async (req, res) => {
  try {
    const { lat, lng, days } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lng'
      });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const forecastDays = days ? Math.min(parseInt(days as string), 5) : 5;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates: lat and lng must be numbers'
      });
    }

    logger.info('[Environment API] Fetching pollen forecast', { 
      latitude, 
      longitude, 
      days: forecastDays 
    });

    const pollen = await SmartEnvironmentService.getPollenForecast(latitude, longitude, forecastDays);

    if (!pollen) {
      return res.status(404).json({
        error: 'Pollen data not available for this location'
      });
    }

    res.json({
      success: true,
      data: pollen
    });

  } catch (error: any) {
    logger.error('[Environment API] Pollen request failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch pollen data',
      message: error.message
    });
  }
});

/**
 * GET /api/environment/insights
 * Get comprehensive environmental insights (Air Quality + Pollen + Weather + Gemini AI)
 * 
 * Query params:
 * - lat: Latitude (required)
 * - lng: Longitude (required)
 */
router.get('/insights', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lng'
      });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates: lat and lng must be numbers'
      });
    }

    logger.info('[Environment API] Fetching comprehensive insights', { latitude, longitude });

    // Get weather data from weather service if available
    let weatherData;
    try {
      const weatherModule = await import('../services/WeatherService');
      const weatherService = weatherModule.default;
      const weather = await weatherService.getWeather(latitude, longitude);
      
      weatherData = {
        temperature: weather.current?.temperature || 22,
        humidity: weather.current?.humidity || 60,
        uvIndex: weather.current?.uvIndex || 5,
        condition: weather.current?.condition || 'Partly Cloudy'
      };
    } catch (error) {
      logger.warn('[Environment API] Weather service unavailable, using defaults');
      weatherData = {
        temperature: 22,
        humidity: 60,
        uvIndex: 5,
        condition: 'Unknown'
      };
    }

    const insights = await SmartEnvironmentService.getEnvironmentalInsights(
      latitude,
      longitude,
      weatherData
    );

    res.json({
      success: true,
      data: insights
    });

  } catch (error: any) {
    logger.error('[Environment API] Insights request failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch environmental insights',
      message: error.message
    });
  }
});

/**
 * GET /api/environment/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Pet Wash™ Environment API',
    features: [
      'Air Quality (Google Air Quality API)',
      'Pollen Forecast (Google Pollen API)',
      'Gemini AI Recommendations'
    ],
    timestamp: new Date().toISOString()
  });
});

export default router;

/**
 * GET /api/environment/uv
 * Get comprehensive UV index data (no API key required)
 * Query params: latitude, longitude
 */
router.get('/uv', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
        example: '/api/environment/uv?latitude=32.0853&longitude=34.7818'
      });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    logger.info('[Environment API] Fetching UV index', { lat, lon });

    const { currentUVIndex } = await import('../services/CurrentUVIndexService');
    const uvData = await currentUVIndex.getUVIndex(lat, lon);

    if (!uvData) {
      return res.status(503).json({
        error: 'UV data temporarily unavailable',
        message: 'Unable to fetch UV index. Please try again later.'
      });
    }

    res.json({
      success: true,
      data: uvData
    });

  } catch (error: any) {
    logger.error('[Environment API] UV index error:', error);
    res.status(500).json({
      error: 'Failed to fetch UV index',
      message: error.message
    });
  }
});

/**
 * GET /api/environment/air-quality-extended
 * Get air quality and pollen from Open-Meteo (no API key required)
 * Query params: latitude, longitude
 */
router.get('/air-quality-extended', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
        example: '/api/environment/air-quality-extended?latitude=52.52&longitude=13.41'
      });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    logger.info('[Environment API] Fetching extended air quality', { lat, lon });

    const { openMeteoAirQuality } = await import('../services/OpenMeteoAirQualityService');
    const airQualityData = await openMeteoAirQuality.getAirQuality(lat, lon);

    if (!airQualityData) {
      return res.status(503).json({
        error: 'Air quality data temporarily unavailable',
        message: 'Unable to fetch air quality information. Please try again later.'
      });
    }

    res.json({
      success: true,
      data: airQualityData
    });

  } catch (error: any) {
    logger.error('[Environment API] Extended air quality error:', error);
    res.status(500).json({
      error: 'Failed to fetch air quality data',
      message: error.message
    });
  }
});

/**
 * GET /api/environment/complete
 * Get ALL environmental data: Google Air Quality + Google Pollen + UV + Open-Meteo Air
 * Query params: latitude, longitude
 */
router.get('/complete', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
        example: '/api/environment/complete?latitude=32.0853&longitude=34.7818'
      });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    logger.info('[Environment API] Fetching complete environmental data', { lat, lon });

    // Fetch all data sources in parallel
    const [googleAir, googlePollen, uvIndex, openMeteoAir] = await Promise.allSettled([
      smartEnvironmentService.getAirQuality(lat, lon),
      smartEnvironmentService.getPollenForecast(lat, lon),
      (async () => {
        const { currentUVIndex } = await import('../services/CurrentUVIndexService');
        return currentUVIndex.getUVIndex(lat, lon);
      })(),
      (async () => {
        const { openMeteoAirQuality } = await import('../services/OpenMeteoAirQualityService');
        return openMeteoAirQuality.getAirQuality(lat, lon);
      })()
    ]);

    res.json({
      success: true,
      data: {
        airQuality: {
          google: googleAir.status === 'fulfilled' ? googleAir.value : null,
          openMeteo: openMeteoAir.status === 'fulfilled' ? openMeteoAir.value : null
        },
        pollen: {
          google: googlePollen.status === 'fulfilled' ? googlePollen.value : null,
          openMeteo: openMeteoAir.status === 'fulfilled' ? openMeteoAir.value?.pollen : null
        },
        uv: uvIndex.status === 'fulfilled' ? uvIndex.value : null,
        metadata: {
          latitude: lat,
          longitude: lon,
          sources: {
            googleAirQuality: googleAir.status === 'fulfilled' && googleAir.value !== null,
            googlePollen: googlePollen.status === 'fulfilled' && googlePollen.value !== null,
            uvIndex: uvIndex.status === 'fulfilled' && uvIndex.value !== null,
            openMeteoAir: openMeteoAir.status === 'fulfilled' && openMeteoAir.value !== null
          },
          timestamp: new Date().toISOString()
        }
      }
    });

    logger.info('[Environment API] ✅ Complete environmental data delivered');

  } catch (error: any) {
    logger.error('[Environment API] Complete data error:', error);
    res.status(500).json({
      error: 'Failed to fetch environmental data',
      message: error.message
    });
  }
});
