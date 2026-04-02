import { getVertexAIConfig } from '../lib/gemini-client';
/**
 * Weather API Routes
 * Google Weather API integration for Pet Wash Day Planner
 */

import express, { type Router, type Request, type Response } from 'express';
import { geocodeLocation, getWeatherForecast, getUnifiedLocationData } from '../services/unifiedLocationWeather';
import { smartWeatherAdvisor } from '../services/smartWeatherAdvisor';
import { logger } from '../lib/logger';
import { 
  type SupportedLanguage,
  getWeatherConditionTranslation,
  getRecommendationTranslation,
  getUIText 
} from '../lib/weatherTranslations';
import {
  type WeatherPlannerRequest,
  type PublicWeatherView,
  type ClientWeatherView,
  type EmployeeStationView,
  type EmployeeExecutiveView,
  getUserType,
  getLocalizedMetadata,
} from '@shared/schema-weather-planner';
import { optionalFirebaseToken } from '../middleware/firebase-auth';
import { optionalEmployeeProfile } from '../middleware/roleAuth';
import { pool } from '../db';
import { db as firestoreDb } from '../lib/firebase-admin';

const router: Router = express.Router();

// Supported languages
const SUPPORTED_LANGS: SupportedLanguage[] = ['en', 'he', 'ar', 'ru', 'fr', 'es'];

// Language to locale mapping for date formatting
const LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: 'en-US',
  he: 'he-IL',
  ar: 'ar-SA',
  ru: 'ru-RU',
  fr: 'fr-FR',
  es: 'es-ES'
};

// RTL languages
const RTL_LANGUAGES: SupportedLanguage[] = ['he', 'ar'];

/**
 * Validate and normalize language parameter
 */
function validateLanguage(lang: any): SupportedLanguage {
  const normalizedLang = (lang as string)?.toLowerCase();
  if (SUPPORTED_LANGS.includes(normalizedLang as SupportedLanguage)) {
    return normalizedLang as SupportedLanguage;
  }
  return 'en'; // Default to English
}

/**
 * GET /api/weather/forecast
 * Get weather forecast for a location
 * Query params: location (city name or coordinates), days (optional, default 7)
 */
router.get('/forecast', async (req, res) => {
  try {
    const { location, days = 7 } = req.query;

    if (!location) {
      return res.status(400).json({ 
        error: 'Location parameter is required',
        example: '/api/weather/forecast?location=Tel Aviv'
      });
    }

    logger.info(`[Weather API] Fetching forecast for: ${location}`);

    // Get unified location + weather data
    const data = await getUnifiedLocationData(location as string);

    if (!data || !data.weather) {
      return res.status(404).json({ 
        error: 'Weather data not available for this location',
        location 
      });
    }

    res.json({
      success: true,
      location: data.location,
      weather: data.weather,
      navigation: data.navigation,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Weather API] Error fetching forecast:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/weather/wash-recommendation
 * Get pet wash day recommendation based on weather
 */
router.get('/wash-recommendation', async (req, res) => {
  try {
    const { location, latitude, longitude } = req.query;

    let lat: number;
    let lon: number;

    // Use provided coordinates or geocode location
    if (latitude && longitude) {
      lat = parseFloat(latitude as string);
      lon = parseFloat(longitude as string);
    } else if (location) {
      const geocoded = await geocodeLocation(location as string);
      if (!geocoded) {
        return res.status(404).json({ error: 'Location not found' });
      }
      lat = geocoded.latitude;
      lon = geocoded.longitude;
    } else {
      return res.status(400).json({ error: 'Location or coordinates required' });
    }

    const weather = await getWeatherForecast(lat, lon);

    if (!weather) {
      return res.status(404).json({ error: 'Weather data not available' });
    }

    // Calculate wash day score (0-100)
    const washScore = calculateWashDayScore(weather);

    res.json({
      success: true,
      weather,
      washScore,
      recommendation: getWashDayRecommendation(washScore, weather),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Weather API] Error getting wash recommendation:', error);
    res.status(500).json({ error: 'Failed to get wash recommendation' });
  }
});

/**
 * GET /api/weather/7-day-planner
 * Get 7-day pet wash planner with luxury visual data
 * Query params: location (required), lang (optional, default 'en')
 */
router.get('/7-day-planner', async (req, res) => {
  try {
    const { location, lang } = req.query;

    if (!location) {
      return res.status(400).json({ error: 'Location parameter required' });
    }

    // Validate and normalize language
    const language = validateLanguage(lang);
    const locale = LOCALE_MAP[language];
    const direction = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';

    const geocoded = await geocodeLocation(location as string);
    if (!geocoded) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Fetch 7-day forecast from Open-Meteo (supports multi-day)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geocoded.latitude}&longitude=${geocoded.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max,wind_speed_10m_max&timezone=auto&forecast_days=7`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.daily) {
      return res.status(404).json({ error: 'Forecast data not available' });
    }

    // Transform to luxury 7-day planner format with translations
    const sevenDayPlanner = data.daily.time.map((date: string, index: number) => {
      const temp = data.daily.temperature_2m_max[index];
      const weatherCode = data.daily.weather_code[index];
      const precipProb = data.daily.precipitation_probability_max[index];
      const uvIndex = data.daily.uv_index_max[index];
      const windSpeed = data.daily.wind_speed_10m_max[index];

      const washScore = calculateDayWashScore(temp, weatherCode, precipProb, uvIndex, windSpeed);
      const weatherCondition = getWeatherConditionFromCode(weatherCode);

      return {
        date,
        dayOfWeek: new Date(date).toLocaleDateString(locale, { weekday: 'long' }),
        temperature: {
          max: data.daily.temperature_2m_max[index],
          min: data.daily.temperature_2m_min[index],
        },
        weatherCode,
        condition: {
          condition: getWeatherConditionTranslation(weatherCondition.condition, language),
          icon: weatherCondition.icon
        },
        precipitationProbability: precipProb,
        uvIndex,
        windSpeed,
        washScore,
        recommendation: getWashDayRecommendation(washScore, {
          temperature: temp,
          condition: weatherCondition.condition,
          precipitation: precipProb,
          uvIndex,
          windSpeed,
        }, language),
      };
    });

    res.json({
      success: true,
      location: geocoded,
      forecast: sevenDayPlanner,
      provider: 'open-meteo',
      timestamp: new Date().toISOString(),
      locale,
      language,
      direction,
    });

  } catch (error) {
    logger.error('[Weather API] Error fetching 7-day planner:', error);
    res.status(500).json({ error: 'Failed to fetch 7-day planner' });
  }
});

// ===== HELPER FUNCTIONS =====

function calculateWashDayScore(weather: any): number {
  let score = 100;

  // Temperature penalties
  if (weather.temperature < 15) score -= 20; // Too cold
  if (weather.temperature > 32) score -= 15; // Too hot

  // Weather condition penalties
  if (weather.condition?.toLowerCase().includes('rain')) score -= 40;
  if (weather.condition?.toLowerCase().includes('snow')) score -= 50;
  if (weather.condition?.toLowerCase().includes('storm')) score -= 60;
  if (weather.condition?.toLowerCase().includes('fog')) score -= 10;

  // Wind penalties
  if (weather.windSpeed && weather.windSpeed > 20) score -= 15;

  // UV benefits (moderate UV is good for drying)
  if (weather.uvIndex && weather.uvIndex >= 3 && weather.uvIndex <= 7) score += 10;

  // Humidity penalties
  if (weather.humidity && weather.humidity > 80) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function calculateDayWashScore(temp: number, weatherCode: number, precipProb: number, uvIndex: number, windSpeed: number): number {
  let score = 100;

  // Temperature
  if (temp < 15) score -= 20;
  if (temp > 32) score -= 15;

  // Precipitation probability
  score -= precipProb * 0.5; // -50 points at 100% precipitation

  // Weather code (WMO)
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) score -= 40; // Rain
  if ([71, 73, 75, 85, 86].includes(weatherCode)) score -= 50; // Snow
  if ([95, 96, 99].includes(weatherCode)) score -= 60; // Thunderstorm

  // Wind
  if (windSpeed > 20) score -= 15;

  // UV benefits
  if (uvIndex >= 3 && uvIndex <= 7) score += 10;

  return Math.max(0, Math.min(100, score));
}

function getWashDayRecommendation(score: number, weather: any, lang: SupportedLanguage = 'en'): any {
  const isRain = weather.condition?.toLowerCase().includes('rain');
  
  if (score >= 80) {
    return {
      rating: 'excellent' as const,
      emoji: '⭐',
      title: getRecommendationTranslation('excellent', 'title', lang),
      message: getRecommendationTranslation('excellent', 'message', lang),
      color: '#10b981', // Emerald green
      action: getRecommendationTranslation('excellent', 'action', lang),
      priority: 'high',
    };
  } else if (score >= 60) {
    return {
      rating: 'good' as const,
      emoji: '✨',
      title: getRecommendationTranslation('good', 'title', lang),
      message: getRecommendationTranslation('good', 'message', lang),
      color: '#3b82f6', // Blue
      action: getRecommendationTranslation('good', 'action', lang),
      priority: 'medium',
    };
  } else if (score >= 40) {
    return {
      rating: 'moderate' as const,
      emoji: '⚠️',
      title: getRecommendationTranslation('moderate', 'title', lang),
      message: getRecommendationTranslation('moderate', 'message', lang),
      color: '#f59e0b', // Amber
      action: getRecommendationTranslation('moderate', 'action', lang),
      priority: 'medium',
    };
  } else {
    return {
      rating: 'poor' as const,
      emoji: '❌',
      title: getRecommendationTranslation('poor', 'title', lang),
      message: getRecommendationTranslation('poor', 'message', lang, isRain),
      color: '#ef4444', // Red
      action: getRecommendationTranslation('poor', 'action', lang),
      priority: 'low',
    };
  }
}

function getWeatherConditionFromCode(code: number): { condition: string; icon: string } {
  const weatherCodes: Record<number, { condition: string; icon: string }> = {
    0: { condition: 'Clear', icon: '☀️' },
    1: { condition: 'Mainly Clear', icon: '🌤️' },
    2: { condition: 'Partly Cloudy', icon: '⛅' },
    3: { condition: 'Overcast', icon: '☁️' },
    45: { condition: 'Foggy', icon: '🌫️' },
    48: { condition: 'Foggy', icon: '🌫️' },
    51: { condition: 'Light Drizzle', icon: '🌦️' },
    53: { condition: 'Moderate Drizzle', icon: '🌦️' },
    55: { condition: 'Dense Drizzle', icon: '🌦️' },
    61: { condition: 'Light Rain', icon: '🌧️' },
    63: { condition: 'Moderate Rain', icon: '🌧️' },
    65: { condition: 'Heavy Rain', icon: '🌧️' },
    71: { condition: 'Light Snow', icon: '❄️' },
    73: { condition: 'Moderate Snow', icon: '❄️' },
    75: { condition: 'Heavy Snow', icon: '❄️' },
    80: { condition: 'Light Showers', icon: '🌦️' },
    81: { condition: 'Moderate Showers', icon: '🌧️' },
    82: { condition: 'Violent Showers', icon: '⛈️' },
    95: { condition: 'Thunderstorm', icon: '⛈️' },
    96: { condition: 'Thunderstorm with Hail', icon: '⛈️' },
    99: { condition: 'Thunderstorm with Hail', icon: '⛈️' },
  };

  return weatherCodes[code] || { condition: 'Unknown', icon: '❓' };
}

/**
 * POST /api/weather/smart-advice
 * Get smart, AI-powered pet-focused weather advice using Gemini
 * 
 * Analyzes weather + operator schedule to provide actionable recommendations
 * Example: "⚠️ Severe Weather Alert (1 PM Wash): Reschedule outdoor appointment"
 * 
 * Body params: location (required), operatorName (optional), appointments (optional), lang (optional)
 */
router.post('/smart-advice', async (req, res) => {
  try {
    const { location, operatorName, appointments = [], lang } = req.body;

    if (!location) {
      return res.status(400).json({ 
        error: 'Location parameter required',
        example: { location: 'Tel Aviv', operatorName: 'John', appointments: [], lang: 'en' }
      });
    }

    // Validate and normalize language
    const language = validateLanguage(lang);
    const locale = LOCALE_MAP[language];
    const direction = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';

    logger.info(`[Smart Weather Advisor] Generating advice for: ${operatorName || 'operator'} at ${location} (lang: ${language})`);

    // Get weather data
    const geocoded = await geocodeLocation(location);
    if (!geocoded) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const weather = await getWeatherForecast(geocoded.latitude, geocoded.longitude);
    if (!weather) {
      return res.status(404).json({ error: 'Weather data not available' });
    }

    // Calculate wash score
    const washScore = calculateWashDayScore(weather);

    // Prepare weather data for Gemini
    const weatherData = {
      temperature: weather.temperature,
      condition: weather.condition || 'Unknown',
      humidity: weather.humidity || 0,
      windSpeed: weather.windSpeed || 0,
      precipitation: weather.precipitation || 0,
      uvIndex: weather.uvIndex || 0,
      washScore,
    };

    // Generate smart AI advice in target language
    const smartAdvice = await smartWeatherAdvisor.generateSmartAdvice(
      operatorName || 'Operator',
      weatherData,
      appointments,
      language
    );

    res.json({
      success: true,
      location: geocoded,
      weather: weatherData,
      smartAdvice,
      timestamp: new Date().toISOString(),
      locale,
      language,
      direction,
    });

  } catch (error) {
    logger.error('[Smart Weather Advisor] Error generating advice:', error);
    res.status(500).json({ 
      error: 'Failed to generate smart weather advice',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/weather/planner
 * Role-aware weather planner with multi-language support
 * 
 * Automatically detects user type from authentication context and returns appropriate view:
 * - Public (unauthenticated): General weather showcase
 * - Client (authenticated user): Personal appointment weather
 * - Employee Station (manager/support): Assigned stations weather
 * - Employee Executive (admin/ops): Multi-location analytics
 * 
 * SECURITY: User type is derived ONLY from Firebase auth token and Firestore employee profile.
 * Client-supplied parameters cannot override role detection.
 * 
 * Query params: 
 * - location: City name (required for public, optional for authenticated)
 * - lang: Language code (en, he, ar, ru, fr, es)
 */
router.get('/planner', optionalFirebaseToken, optionalEmployeeProfile, async (req: Request, res: Response) => {
  try {
    const { location, lang } = req.query;
    const language = validateLanguage(lang);
    const { locale, direction } = getLocalizedMetadata(language);
    
    // SECURITY: Determine user type from authentication context ONLY
    // Never trust client-supplied scope parameter
    const isAuthenticated = !!req.firebaseUser;
    const isEmployee = !!req.employee;  // Real Firestore employee profile check
    const userRole = req.employee?.role;  // Real employee role from Firestore
    
    const userType = getUserType({
      isAuthenticated,
      isEmployee,
      role: userRole,
    });
    
    logger.info(`[Weather Planner] User type: ${userType} (auth: ${isAuthenticated}, employee: ${isEmployee}, role: ${userRole || 'none'}), Language: ${language}, Location: ${location || 'auto'}`);
    
    // PUBLIC VIEW (External/Unauthenticated)
    if (userType === 'public') {
      if (!location) {
        return res.status(400).json({ 
          error: 'Location parameter is required for public access',
          example: '/api/weather/planner?location=Tel Aviv&lang=en'
        });
      }
      
      // Fetch REAL 7-day forecast using helper
      const weatherData = await fetch7DayForecast(location as string, language);
      
      const publicView: PublicWeatherView = {
        success: true,
        location: weatherData.location,
        forecast: weatherData.forecast,
        bestWashDay: weatherData.bestWashDay,
        marketingMessage: getUIText('marketingMessage', language),
        locale,
        language,
        direction,
      };
      
      return res.json(publicView);
    }
    
    // CLIENT VIEW (Authenticated Regular User)
    if (userType === 'client') {
      // Default to Tel Aviv for MVP (TODO: use user's preferred location from profile)
      const userLocation = (location as string) || 'Tel Aviv';
      
      // Fetch REAL 7-day forecast for client's location
      const weatherData = await fetch7DayForecast(userLocation, language);
      
      // Fetch upcoming appointments from DB for this user
      let upcomingAppointments: Array<{ type: string; title: string; date: string; location?: string }> = [];
      const uid = req.firebaseUser?.uid;
      if (uid) {
        try {
          const apptResult = await pool.query(`
            SELECT 'sitter' AS type,
                   'Sitter Booking' AS title,
                   start_date::text AS date,
                   NULL AS location
            FROM sitter_bookings
            WHERE owner_id = $1 AND start_date >= NOW() AND status NOT IN ('cancelled','completed')
            UNION ALL
            SELECT 'walk' AS type,
                   'Dog Walk' AS title,
                   scheduled_date::text AS date,
                   pickup_address AS location
            FROM walk_bookings
            WHERE owner_id = $1 AND scheduled_date >= CURRENT_DATE AND status NOT IN ('cancelled','completed')
            ORDER BY date ASC
            LIMIT 5
          `, [uid]);
          upcomingAppointments = apptResult.rows.map((r: any) => ({
            type: r.type,
            title: r.title,
            date: r.date,
            location: r.location ?? undefined,
          }));
        } catch (apptErr: any) {
          logger.warn('[Weather] Could not fetch upcoming appointments', { error: apptErr.message });
        }
      }

      const clientView: ClientWeatherView = {
        success: true,
        userId: uid || 'unknown',
        upcomingAppointments,
        personalRecommendations: [
          getUIText('clientRecommendation1', language),
          getUIText('clientRecommendation2', language),
        ],
        bestDaysThisWeek: weatherData.forecast.slice(0, 7),  // REAL weather data
        locale,
        language,
        direction,
      };
      
      return res.json(clientView);
    }
    
    // EMPLOYEE STATION VIEW (Manager/Support)
    if (userType === 'employee_station') {
      // Resolve station location: prefer explicit query param, then pull from Firestore employee doc
      let stationLocation = (location as string) || '';
      let assignedStationId = 'station_default';
      let assignedStationName = '';

      const uid = req.firebaseUser?.uid;
      if (!stationLocation && uid) {
        try {
          const empDoc = await firestoreDb.collection('employees').doc(uid).get();
          const stationIds: string[] = empDoc.data()?.stations || [];
          if (stationIds.length > 0) {
            // Resolve the first assigned station's city from the DB
            const stationRow = await pool.query<{ id: string; name: string; city: string | null }>(
              `SELECT s.id, s.name, l.city
               FROM stations s
               LEFT JOIN locations l ON l.id = s.location_id
               WHERE s.id = $1
               LIMIT 1`,
              [stationIds[0]]
            );
            if (stationRow.rows.length > 0) {
              assignedStationId = stationRow.rows[0].id;
              assignedStationName = stationRow.rows[0].name;
              stationLocation = stationRow.rows[0].city || '';
            }
          }
        } catch (empErr: any) {
          logger.warn('[Weather] Could not resolve employee station', { uid, error: empErr.message });
        }
      }
      if (!stationLocation) stationLocation = 'Tel Aviv';

      // Fetch REAL weather for assigned station
      const weatherData = await fetch7DayForecast(stationLocation, language);

      const stationView: EmployeeStationView = {
        success: true,
        employeeId: uid || 'unknown',
        employeeName: req.employee?.fullName || req.firebaseUser?.email || 'Employee',
        role: userRole || 'manager',
        assignedStations: [
          {
            stationId: assignedStationId,
            stationName: assignedStationName || weatherData.location.city,
            location: weatherData.location,
            forecast: weatherData.forecast,
            bestWashDay: weatherData.bestWashDay,
            alerts: weatherData.forecast
              .filter(day => day.washScore < 40)
              .map(day => ({
                type: 'weather_alert' as const,
                severity: 'medium' as const,
                message: `${day.dayOfWeek}: ${day.condition.condition} - ${getUIText('weatherAlert', language)}`,
                date: day.date,
              })),
          }
        ],
        dailySummary: getUIText('dailySummary', language),
        locale,
        language,
        direction,
      };
      
      return res.json(stationView);
    }
    
    // EMPLOYEE EXECUTIVE VIEW (Admin/Ops)
    if (userType === 'employee_executive') {
      // Fetch franchise cities from DB (distinct cities in the locations table linked to stations)
      let mainLocations: string[] = [];
      try {
        const citiesResult = await pool.query<{ city: string }>(
          `SELECT DISTINCT l.city
           FROM locations l
           INNER JOIN stations s ON s.location_id = l.id
           WHERE l.city IS NOT NULL AND l.city <> '' AND s.is_active = true
           ORDER BY l.city
           LIMIT 10`
        );
        mainLocations = citiesResult.rows.map(r => r.city);
      } catch (cityErr: any) {
        logger.warn('[Weather] Could not fetch franchise cities from DB, using defaults', { error: cityErr.message });
      }
      if (mainLocations.length === 0) mainLocations = ['Tel Aviv', 'Jerusalem', 'Haifa'];

      // Fetch REAL weather for all locations in parallel
      const locationWeatherData = await Promise.all(
        mainLocations.map(loc => fetch7DayForecast(loc, language))
      );
      
      // Calculate cross-location analytics
      const allForecasts = locationWeatherData.flatMap(data => data.forecast);
      const totalDays = allForecasts.length;
      const averageWashScore = allForecasts.reduce((sum, day) => sum + day.washScore, 0) / totalDays;
      const averageTemperature = allForecasts.reduce((sum, day) => sum + day.temperature.max, 0) / totalDays;
      const totalPrecipitation = allForecasts.reduce((sum, day) => sum + day.precipitationProbability, 0);
      const optimalWashDays = allForecasts.filter(day => day.washScore >= 60).length;
      
      const executiveView: EmployeeExecutiveView = {
        success: true,
        employeeId: req.firebaseUser?.uid || 'unknown',
        employeeName: req.employee?.fullName || req.firebaseUser?.email || 'Admin',
        role: userRole || 'admin',
        allFranchiseLocations: locationWeatherData.map((data, index) => ({
          franchiseId: `franchise_${index}`,
          franchiseName: mainLocations[index],
          location: data.location,
          forecast: data.forecast,
          bestWashDay: data.bestWashDay,
          alerts: data.forecast
            .filter(day => day.washScore < 40)
            .map(day => ({
              type: 'weather_alert' as const,
              severity: 'high' as const,
              message: `${day.dayOfWeek}: ${day.condition.condition}`,
              date: day.date,
            })),
        })),  // REAL weather data for all franchise locations
        analytics: {
          totalLocations: mainLocations.length,
          averageWashScore: Math.round(averageWashScore),
          weatherAlerts: allForecasts
            .filter(day => day.washScore < 30)
            .map(day => `${day.dayOfWeek}: ${day.condition.condition}`),
          weeklyTrends: {
            averageTemperature: Math.round(averageTemperature * 10) / 10,
            totalPrecipitation: Math.round(totalPrecipitation),
            optimalWashDays,
          },
        },
        globalRecommendations: [
          getUIText('executiveRecommendation1', language),
          `${optimalWashDays} ${getUIText('optimalDaysFound', language)}`,
        ],
        locale,
        language,
        direction,
      };
      
      return res.json(executiveView);
    }
    
    // Fallback (should never reach here)
    return res.status(400).json({ error: 'Invalid user type' });
    
  } catch (error) {
    logger.error('[Weather Planner] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate weather planner',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper: Fetch and assemble 7-day forecast for a location
 * Returns real Open-Meteo forecast data with translations
 */
async function fetch7DayForecast(
  location: string,
  language: SupportedLanguage
): Promise<{
  location: { city: string; country: string; formattedAddress: string; latitude: number; longitude: number };
  forecast: any[];
  bestWashDay: any;
}> {
  const locale = LOCALE_MAP[language];
  
  // Geocode location
  const geocoded = await geocodeLocation(location);
  if (!geocoded) {
    throw new Error('Location not found');
  }
  
  // Fetch from Open-Meteo
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geocoded.latitude}&longitude=${geocoded.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max,wind_speed_10m_max&timezone=auto&forecast_days=7`;
  
  const response = await fetch(url);
  const forecastData = await response.json();

  if (!forecastData.daily) {
    throw new Error('Forecast data not available');
  }
  
  // Assemble forecast days
  const forecastDays = forecastData.daily.time.map((date: string, index: number) => {
    const temp = forecastData.daily.temperature_2m_max[index];
    const weatherCode = forecastData.daily.weather_code[index];
    const precipProb = forecastData.daily.precipitation_probability_max[index];
    const uvIndex = forecastData.daily.uv_index_max[index];
    const windSpeed = forecastData.daily.wind_speed_10m_max[index];

    const washScore = calculateDayWashScore(temp, weatherCode, precipProb, uvIndex, windSpeed);
    const weatherCondition = getWeatherConditionFromCode(weatherCode);
    const dayOfWeek = new Date(date).toLocaleDateString(locale, { weekday: 'long' });
    
    return {
      date,
      dayOfWeek,
      temperature: {
        max: forecastData.daily.temperature_2m_max[index],
        min: forecastData.daily.temperature_2m_min[index],
      },
      weatherCode,
      condition: {
        condition: getWeatherConditionTranslation(weatherCondition.condition, language),
        icon: getWeatherIconEmoji(weatherCode),
      },
      precipitationProbability: precipProb,
      uvIndex,
      windSpeed,
      washScore,
      recommendation: getWashDayRecommendation(washScore, {
        temperature: temp,
        condition: weatherCondition.condition,
        precipitation: precipProb,
        uvIndex,
        windSpeed,
      }, language),
    };
  });
  
  const bestWashDay = forecastDays.reduce((best, day) => 
    day.washScore > best.washScore ? day : best
  , forecastDays[0]);
  
  return {
    location: {
      city: geocoded.city,
      country: geocoded.country,
      formattedAddress: geocoded.formattedAddress,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    },
    forecast: forecastDays,
    bestWashDay,
  };
}

/**
 * Helper: Get weather icon emoji
 */
function getWeatherIconEmoji(code: number): string {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2 || code === 3) return '☁️';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 85, 86].includes(code)) return '❄️';
  if (code >= 95) return '⛈️';
  return '🌤️';
}

/**
 * GET /api/weather/comprehensive
 * Get comprehensive weather from multiple sources with alerts and extended forecasts
 * Uses multi-source aggregation for maximum reliability
 * 
 * Query params:
 * - location: city name (required)
 * - language: en, he, ar, ru, fr, es (optional, default: en)
 */
router.get('/comprehensive', async (req, res) => {
  try {
    const { location, language: langParam } = req.query;
    const language = validateLanguage(langParam);

    if (!location) {
      return res.status(400).json({
        error: 'Location parameter is required',
        example: '/api/weather/comprehensive?location=Tel Aviv&language=en'
      });
    }

    logger.info(`[Weather API] Fetching comprehensive weather for: ${location}`);

    const geocoded = await geocodeLocation(location as string);
    if (!geocoded) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const { multiSourceWeather } = await import('../services/MultiSourceWeatherService');
    const weather = await multiSourceWeather.getComprehensiveWeather(
      geocoded.latitude,
      geocoded.longitude
    );

    if (!weather) {
      return res.status(503).json({
        error: 'Weather data temporarily unavailable',
        message: 'All weather sources are currently unavailable. Please try again later.'
      });
    }

    const uiText = getUIText(language);

    res.json({
      success: true,
      location: {
        city: geocoded.city,
        country: geocoded.country,
        formattedAddress: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      },
      current: {
        temperature: weather.temperature,
        condition: getWeatherConditionTranslation(weather.condition, language),
        description: weather.description,
        humidity: weather.humidity,
        windSpeed: weather.windSpeed,
        precipitation: weather.precipitation,
        uvIndex: weather.uvIndex,
        feelsLike: weather.feelsLike,
        visibility: weather.visibility,
        pressure: weather.pressure,
        cloudCover: weather.cloudCover,
        dewPoint: weather.dewPoint,
      },
      alerts: weather.alerts || [],
      hourlyForecast: weather.hourlyForecast?.slice(0, 24) || [],
      dailyForecast: weather.dailyForecast?.slice(0, 7) || [],
      metadata: {
        primarySource: weather.primarySource,
        dataSources: weather.dataSources,
        reliability: weather.reliability,
        fallbackUsed: weather.fallbackUsed,
        timestamp: weather.timestamp,
        language,
        labels: uiText,
      }
    });

    logger.info(`[Weather API] ✅ Comprehensive weather delivered from ${weather.dataSources.join(', ')}`);

  } catch (error: any) {
    logger.error('[Weather API] Comprehensive weather error:', error);
    res.status(500).json({
      error: 'Failed to fetch comprehensive weather',
      message: error.message
    });
  }
});

/**
 * GET /api/weather/booking-check
 * Lightweight weather advisory for the customer booking flow.
 * Checks whether outdoor pet activity is safe for the requested date/location.
 * Query params: lat, lng, date (YYYY-MM-DD, optional — defaults to today), lang (optional)
 */
router.get('/booking-check', async (req, res) => {
  try {
    const { lat, lng, date, lang } = req.query;
    const language = validateLanguage(lang);

    // Default to Tel Aviv if no coordinates given
    const latitude  = lat  ? parseFloat(lat  as string) : 32.0853;
    const longitude = lng  ? parseFloat(lng  as string) : 34.7818;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid lat/lng' });
    }

    // Resolve the target date index (0 = today … 6)
    const today = new Date();
    let dayIndex = 0;
    if (date && typeof date === 'string') {
      const target = new Date(date);
      const diffMs  = target.getTime() - today.getTime();
      dayIndex = Math.max(0, Math.min(6, Math.round(diffMs / 86_400_000)));
    }

    // Fetch 7-day daily forecast from Open-Meteo (free, no key)
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max,uv_index_max` +
      `&timezone=auto&forecast_days=7`;

    const forecastRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(8_000) });
    if (!forecastRes.ok) {
      return res.status(502).json({ error: 'Weather data unavailable' });
    }
    const forecastData = await forecastRes.json();
    const daily = forecastData.daily;

    const tempMax      = daily.temperature_2m_max[dayIndex]              ?? 25;
    const tempMin      = daily.temperature_2m_min[dayIndex]              ?? 15;
    const weatherCode  = daily.weather_code[dayIndex]                    ?? 0;
    const precipProb   = daily.precipitation_probability_max[dayIndex]   ?? 0;
    const windSpeed    = daily.wind_speed_10m_max[dayIndex]              ?? 0;
    const uvIndex      = daily.uv_index_max[dayIndex]                    ?? 3;

    // Classify conditions for outdoor pet safety
    const isThunderstorm = weatherCode >= 95;
    const isHeavyRain    = [65, 67, 82].includes(weatherCode) || (precipProb > 70 && [63, 64].includes(weatherCode));
    const isRain         = weatherCode >= 51 && !isHeavyRain && !isThunderstorm;
    const isExtremeHeat  = tempMax >= 35;
    const isVeryHot      = tempMax >= 31 && tempMax < 35;
    const isStrongWind   = windSpeed > 40;
    const isHighUV       = uvIndex >= 8;

    let level: 'safe' | 'caution' | 'warning';
    let defaultMessage: string;
    let icon: string;

    if (isThunderstorm || isHeavyRain || isExtremeHeat || (isStrongWind && isRain)) {
      level          = 'warning';
      icon           = isThunderstorm ? '⛈️' : isHeavyRain ? '🌧️' : isExtremeHeat ? '🌡️' : '🌪️';
      defaultMessage = isThunderstorm
        ? 'Thunderstorm expected — outdoor walking is unsafe. Providers may cancel.'
        : isHeavyRain
        ? 'Heavy rain expected — outdoor walking not recommended.'
        : `Extreme heat (${tempMax}°C) — dangerous for dogs outdoors.`;
    } else if (isVeryHot || isRain || isStrongWind || isHighUV) {
      level          = 'caution';
      icon           = isVeryHot ? '☀️' : isRain ? '🌦️' : isHighUV ? '🕶️' : '💨';
      defaultMessage = isVeryHot
        ? `It'll be hot (${tempMax}°C) — book early morning or evening walks.`
        : isRain
        ? 'Light rain possible — bring a raincoat for your pet.'
        : `High UV index (${uvIndex}) — keep walks short and shaded.`;
    } else {
      level          = 'safe';
      icon           = '✅';
      defaultMessage = `Great conditions for an outdoor walk (${tempMax}°C, ${getWeatherConditionFromCode(weatherCode).condition}).`;
    }

    // Generate Gemini advisory if AI is available
    const GEMINI_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    let aiMessage = defaultMessage;

    if (GEMINI_KEY && level !== 'safe') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const genAI = new GoogleGenAI(getVertexAIConfig());

        const langNames: Record<string, string> = {
          he: 'Hebrew (עברית)', ar: 'Arabic (العربية)', ru: 'Russian', en: 'English', fr: 'French', es: 'Spanish'
        };
        const targetLang = langNames[language] || 'English';

        const prompt = `You are a pet safety advisor for PetWash™ — a premium Israeli pet care platform.
A customer is about to book an outdoor dog walking session. Tell them in 1-2 sentences whether it is safe, and any specific precaution.
Respond ONLY in ${targetLang}. Be warm, concise, and direct. Do NOT use markdown.

Weather for the booking day:
- Max temperature: ${tempMax}°C
- Weather: ${getWeatherConditionFromCode(weatherCode)}
- Precipitation probability: ${precipProb}%
- Wind speed: ${windSpeed} km/h
- UV index: ${uvIndex}
- Alert level: ${level}`;

        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        const text = (result.text || '').trim();
        if (text.length > 10) aiMessage = text;
      } catch (err: any) {
        logger.warn('[Weather/booking-check] Gemini advisory failed, using fallback:', err?.message);
      }
    }

    return res.json({
      level,
      icon,
      temperature: tempMax,
      temperatureMin: tempMin,
      conditionCode: weatherCode,
      condition: getWeatherConditionFromCode(weatherCode).condition,
      precipitationProbability: precipProb,
      windSpeed,
      uvIndex,
      message: aiMessage,
      canProceed: true,
    });

  } catch (error: any) {
    logger.error('[Weather/booking-check] Error:', error);
    return res.status(500).json({ error: 'Failed to check weather', message: error.message });
  }
});

export default router;

