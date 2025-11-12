/**
 * Unified Location & Weather Service
 * 
 * Smart integration of ALL Google Cloud APIs under one roof:
 * - Google Maps API (navigation, geocoding, places)
 * - Google Weather data (via Maps API)
 * - Open-Meteo API (free fallback)
 * 
 * Used across all 8 Pet Wash platforms for consistent experience.
 */

import { logger } from '../lib/logger';

interface LocationCoordinates {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  formattedAddress: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  description: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  uvIndex?: number;
  pollenLevel?: number;
  recommendation: string;
  priority?: string;
  actionAdvice?: string;
  provider: 'google' | 'open-meteo';
}

interface NavigationLinks {
  waze: string;
  googleMaps: string;
  appleMaps?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_WEATHER_API_KEY = process.env.GOOGLE_WEATHER_API_KEY;

/**
 * STEP 1: Geocode location using Google Maps Geocoding API
 * Converts city name or address to GPS coordinates
 */
export async function geocodeLocation(locationQuery: string): Promise<LocationCoordinates | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('[UnifiedLocation] Google Maps API key not configured - using fallback');
    return await geocodeLocationFallback(locationQuery);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;
      
      // Extract city and country from address components
      let city = locationQuery;
      let country = 'Israel';
      
      for (const component of result.address_components) {
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('country')) {
          country = component.long_name;
        }
      }

      logger.info(`[UnifiedLocation] ✅ Geocoded via Google Maps: ${city}, ${country}`);

      return {
        latitude: location.lat,
        longitude: location.lng,
        city,
        country,
        formattedAddress: result.formatted_address,
      };
    }

    logger.warn(`[UnifiedLocation] Google Maps geocoding failed: ${data.status}`);
    return await geocodeLocationFallback(locationQuery);

  } catch (error) {
    logger.error('[UnifiedLocation] Google Maps geocoding error:', error);
    return await geocodeLocationFallback(locationQuery);
  }
}

/**
 * Fallback geocoding using Open-Meteo (free, no API key)
 */
async function geocodeLocationFallback(locationQuery: string): Promise<LocationCoordinates | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=1&language=en&format=json`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      logger.info(`[UnifiedLocation] ✅ Geocoded via Open-Meteo fallback: ${result.name}`);

      return {
        latitude: result.latitude,
        longitude: result.longitude,
        city: result.name,
        country: result.country || 'Unknown',
        formattedAddress: `${result.name}, ${result.country}`,
      };
    }

    return null;
  } catch (error) {
    logger.error('[UnifiedLocation] Open-Meteo geocoding error:', error);
    return null;
  }
}

/**
 * STEP 2: Fetch weather data with smart provider selection
 * Priority: Google Weather API → Open-Meteo fallback
 */
export async function getWeatherForecast(
  latitude: number,
  longitude: number,
  targetDate?: string
): Promise<WeatherData | null> {
  // Try Google Weather API first (if API key available)
  if (GOOGLE_WEATHER_API_KEY) {
    const googleWeather = await getGoogleWeather(latitude, longitude, targetDate);
    if (googleWeather) return googleWeather;
  }

  // Fallback to Open-Meteo (free, reliable)
  logger.info('[UnifiedWeather] Using Open-Meteo fallback');
  return await getOpenMeteoWeather(latitude, longitude, targetDate);
}

/**
 * Google Weather API Integration
 * Official Google Weather API for current conditions and forecasts
 * https://weather.googleapis.com/v1/currentConditions:lookup
 */
async function getGoogleWeather(
  latitude: number,
  longitude: number,
  targetDate?: string
): Promise<WeatherData | null> {
  if (!GOOGLE_WEATHER_API_KEY) {
    return null;
  }

  try {
    const endpoint = 'https://weather.googleapis.com/v1/currentConditions:lookup';
    const url = `${endpoint}?key=${GOOGLE_WEATHER_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: {
          latitude,
          longitude,
        },
      }),
    });

    if (!response.ok) {
      logger.warn(`[UnifiedWeather] Google Weather API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const conditions = data.currentConditions;

    if (!conditions) {
      logger.warn('[UnifiedWeather] No current conditions in Google Weather response');
      return null;
    }

    // Extract temperature data
    const tempData = conditions.temperature || {};
    const temperature = tempData.value || 0;
    const unit = tempData.unit || 'celsius';

    // Convert to Celsius if needed
    const tempCelsius = unit === 'fahrenheit' 
      ? (temperature - 32) * 5/9 
      : temperature;

    // Extract condition description
    const conditionsList = conditions.conditions || [];
    const primaryCondition = conditionsList[0] || {};
    const condition = primaryCondition.description || 'Clear';
    const weatherCode = primaryCondition.code || 'clear_day';

    // Extract additional data
    const humidity = conditions.relativeHumidity?.value || undefined;
    const windSpeed = conditions.windSpeed?.value || undefined;
    const uvIndex = conditions.uvIndex?.value || undefined;

    // Generate pet wash recommendation based on weather
    const recommendation = generatePetWashRecommendation(
      tempCelsius,
      condition,
      humidity,
      windSpeed,
      uvIndex
    );

    logger.info(`[UnifiedWeather] ✅ Google Weather API: ${tempCelsius.toFixed(1)}°C, ${condition}`);

    return {
      temperature: parseFloat(tempCelsius.toFixed(1)),
      condition,
      description: condition,
      icon: mapGoogleWeatherCodeToIcon(weatherCode),
      humidity,
      windSpeed,
      uvIndex,
      pollenLevel: conditions.pollenTypeInfo?.[0]?.indexInfo?.value,
      recommendation: recommendation.message,
      priority: recommendation.priority,
      actionAdvice: recommendation.actionAdvice,
      provider: 'google',
    };

  } catch (error) {
    logger.error('[UnifiedWeather] Google Weather API error:', error);
    return null;
  }
}

/**
 * Map Google Weather condition codes to icon names
 */
function mapGoogleWeatherCodeToIcon(code: string): string {
  const iconMap: Record<string, string> = {
    'clear_day': 'sun',
    'clear_night': 'moon',
    'cloudy': 'cloud',
    'partly_cloudy_day': 'cloud-sun',
    'partly_cloudy_night': 'cloud-moon',
    'rain': 'cloud-rain',
    'rain_heavy': 'cloud-showers-heavy',
    'rain_light': 'cloud-drizzle',
    'snow': 'snowflake',
    'fog': 'smog',
    'wind': 'wind',
    'thunderstorm': 'cloud-bolt',
  };

  return iconMap[code] || 'cloud';
}

/**
 * Open-Meteo Weather API (Free, No Key Required)
 * Provides excellent 14-day forecasts with detailed data
 */
async function getOpenMeteoWeather(
  latitude: number,
  longitude: number,
  targetDate?: string
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max&timezone=auto`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.current) {
      return null;
    }

    const weatherCode = data.current.weather_code;
    const condition = getWeatherCondition(weatherCode);
    const recommendation = getWeatherRecommendation(weatherCode, data.current.temperature_2m);

    const weatherData: WeatherData = {
      temperature: Math.round(data.current.temperature_2m),
      condition: condition.condition,
      description: condition.description,
      icon: condition.icon,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      precipitation: data.current.precipitation,
      uvIndex: data.daily?.uv_index_max?.[0],
      recommendation: recommendation.text,
      priority: recommendation.priority,
      actionAdvice: recommendation.action,
      provider: 'open-meteo',
    };

    logger.info(`[UnifiedWeather] ✅ Weather fetched via Open-Meteo: ${weatherData.temperature}°C, ${weatherData.condition}`);

    return weatherData;

  } catch (error) {
    logger.error('[UnifiedWeather] Open-Meteo weather error:', error);
    return null;
  }
}

/**
 * STEP 3: Generate navigation links for all platforms
 * Supports Waze, Google Maps, and Apple Maps
 */
export function generateNavigationLinks(
  latitude: number,
  longitude: number,
  address?: string,
  placeName?: string
): NavigationLinks {
  const label = placeName || address || 'Pet Wash Station';
  
  return {
    // Waze deep-link with GPS coordinates
    waze: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes&zoom=17`,
    
    // Google Maps deep-link
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(label)}`,
    
    // Apple Maps deep-link (for iOS devices)
    appleMaps: `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`,
  };
}

/**
 * Helper: Convert WMO weather code to human-readable condition
 */
function getWeatherCondition(code: number): { condition: string; description: string; icon: string } {
  const weatherCodes: Record<number, { condition: string; description: string; icon: string }> = {
    0: { condition: 'Clear', description: 'Clear sky', icon: '☀️' },
    1: { condition: 'Mainly Clear', description: 'Mainly clear', icon: '🌤️' },
    2: { condition: 'Partly Cloudy', description: 'Partly cloudy', icon: '⛅' },
    3: { condition: 'Overcast', description: 'Overcast', icon: '☁️' },
    45: { condition: 'Foggy', description: 'Fog', icon: '🌫️' },
    48: { condition: 'Foggy', description: 'Depositing rime fog', icon: '🌫️' },
    51: { condition: 'Drizzle', description: 'Light drizzle', icon: '🌦️' },
    53: { condition: 'Drizzle', description: 'Moderate drizzle', icon: '🌦️' },
    55: { condition: 'Drizzle', description: 'Dense drizzle', icon: '🌦️' },
    61: { condition: 'Rain', description: 'Slight rain', icon: '🌧️' },
    63: { condition: 'Rain', description: 'Moderate rain', icon: '🌧️' },
    65: { condition: 'Rain', description: 'Heavy rain', icon: '🌧️' },
    71: { condition: 'Snow', description: 'Slight snow', icon: '🌨️' },
    73: { condition: 'Snow', description: 'Moderate snow', icon: '🌨️' },
    75: { condition: 'Snow', description: 'Heavy snow', icon: '🌨️' },
    80: { condition: 'Showers', description: 'Slight rain showers', icon: '🌦️' },
    81: { condition: 'Showers', description: 'Moderate rain showers', icon: '🌦️' },
    82: { condition: 'Showers', description: 'Violent rain showers', icon: '⛈️' },
    95: { condition: 'Thunderstorm', description: 'Thunderstorm', icon: '⛈️' },
    96: { condition: 'Thunderstorm', description: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { condition: 'Thunderstorm', description: 'Thunderstorm with heavy hail', icon: '⛈️' },
  };

  return weatherCodes[code] || { condition: 'Unknown', description: 'Unknown conditions', icon: '❓' };
}

/**
 * Helper: Generate pet wash recommendation based on weather
 */
function getWeatherRecommendation(
  weatherCode: number,
  temperature: number
): { text: string; priority: string; action: string } {
  // Bad weather conditions (rain, snow, storms)
  if ([61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
    return {
      text: 'Not recommended - wet weather. Consider indoor drying or reschedule.',
      priority: 'low',
      action: 'Reschedule for better weather or use heated indoor drying.',
    };
  }

  // Cold weather
  if (temperature < 10) {
    return {
      text: 'Cool weather - ensure warm water and indoor drying.',
      priority: 'medium',
      action: 'Use warm water and heated dryer. Keep pet warm after wash.',
    };
  }

  // Hot weather
  if (temperature > 32) {
    return {
      text: 'Hot day - perfect for washing! Natural air drying recommended.',
      priority: 'high',
      action: 'Excellent drying conditions. Pet will dry quickly outdoors.',
    };
  }

  // Ideal conditions
  if (temperature >= 18 && temperature <= 28 && [0, 1, 2].includes(weatherCode)) {
    return {
      text: 'Perfect weather for pet washing! Optimal temperature and clear skies.',
      priority: 'high',
      action: 'Ideal conditions for washing and natural drying.',
    };
  }

  // Default good weather
  return {
    text: 'Good conditions for pet washing.',
    priority: 'medium',
    action: 'Suitable for washing. Monitor weather during session.',
  };
}

/**
 * Unified function: Get location + weather + navigation in one call
 * Used across all platforms for consistent experience
 */
export async function getUnifiedLocationData(locationQuery: string, targetDate?: string) {
  const location = await geocodeLocation(locationQuery);
  
  if (!location) {
    return null;
  }

  const weather = await getWeatherForecast(location.latitude, location.longitude, targetDate);
  const navigation = generateNavigationLinks(
    location.latitude,
    location.longitude,
    location.formattedAddress,
    location.city
  );

  return {
    location,
    weather,
    navigation,
  };
}

export default {
  geocodeLocation,
  getWeatherForecast,
  generateNavigationLinks,
  getUnifiedLocationData,
};
