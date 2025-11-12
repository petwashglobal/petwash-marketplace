/**
 * Google Weather API Test Endpoint
 * 
 * Provides a simple test interface for validating Google Weather API integration
 * without requiring Python or external scripts
 */

import { Router } from 'express';
import { getUnifiedLocationData } from '../services/unifiedLocationWeather';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Test Google Weather API with coordinates
 * 
 * GET /api/weather-test?lat=-37.8732&lon=145.0210
 */
router.get('/weather-test', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    // Default to Caulfield North, VIC, Australia if no coordinates provided
    const latitude = isNaN(lat) ? -37.8732 : lat;
    const longitude = isNaN(lon) ? 145.0210 : lon;

    logger.info(`[Weather Test] Testing Google Weather API for coordinates: ${latitude}, ${longitude}`);

    const data = await getUnifiedLocationData(`${latitude},${longitude}`);

    // Check if we got data from Google Weather API or fallback
    const provider = data.weather?.source || 'unknown';

    res.json({
      success: true,
      provider: provider,
      location: {
        latitude,
        longitude
      },
      weather: data.weather,
      test: {
        googleWeatherApiKey: process.env.GOOGLE_WEATHER_API_KEY ? '✅ Configured' : '❌ Missing',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[Weather Test] Failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      test: {
        googleWeatherApiKey: process.env.GOOGLE_WEATHER_API_KEY ? '✅ Configured' : '❌ Missing',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test endpoint for multiple locations
 * 
 * POST /api/weather-test/batch
 * Body: { locations: [{ lat, lon, name }] }
 */
router.post('/weather-test/batch', async (req, res) => {
  try {
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Expected array of locations.'
      });
    }

    const results = await Promise.all(
      locations.map(async (loc: { lat: number; lon: number; name?: string }) => {
        try {
          const data = await getUnifiedLocationData(`${loc.lat},${loc.lon}`);
          return {
            location: loc.name || `${loc.lat}, ${loc.lon}`,
            coordinates: { lat: loc.lat, lon: loc.lon },
            success: true,
            weather: data.weather
          };
        } catch (error) {
          return {
            location: loc.name || `${loc.lat}, ${loc.lon}`,
            coordinates: { lat: loc.lat, lon: loc.lon },
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    res.json({
      success: true,
      results,
      test: {
        googleWeatherApiKey: process.env.GOOGLE_WEATHER_API_KEY ? '✅ Configured' : '❌ Missing',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[Weather Test Batch] Failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Weather API health check
 * 
 * GET /api/weather-test/health
 */
router.get('/weather-test/health', async (req, res) => {
  try {
    // Test with Tel Aviv coordinates (Pet Wash™ HQ)
    const telAvivLat = 32.0853;
    const telAvivLon = 34.7818;

    const startTime = Date.now();
    const data = await getUnifiedLocationData(`${telAvivLat},${telAvivLon}`);
    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      provider: data.weather?.source || 'unknown',
      responseTime: `${responseTime}ms`,
      googleWeatherApiKey: process.env.GOOGLE_WEATHER_API_KEY ? '✅ Configured' : '❌ Missing',
      testLocation: 'Tel Aviv, Israel (Pet Wash™ HQ)',
      coordinates: {
        lat: telAvivLat,
        lon: telAvivLon
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Weather Test Health] Failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      googleWeatherApiKey: process.env.GOOGLE_WEATHER_API_KEY ? '✅ Configured' : '❌ Missing',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
