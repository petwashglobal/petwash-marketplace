/**
 * Smart Environment Service
 * Luxury environmental monitoring combining Air Quality, Pollen, and Weather data
 * Powered by Gemini AI for actionable pet care recommendations
 * 
 * Integrates:
 * - Google Air Quality API (70+ AQI indexes, PM2.5, PM10, NO₂, CO, SO₂, O₃)
 * - Google Pollen API (5-day forecasts, 15+ plant species, allergen warnings)
 * - Weather data (temperature, humidity, UV index, precipitation)
 * - Gemini 2.5 Flash AI for comprehensive health insights
 */

import { logger } from '../lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

interface AirQualityData {
  aqi: number;
  category: string;
  dominantPollutant: string;
  pollutants: {
    pm25?: number;
    pm10?: number;
    no2?: number;
    co?: number;
    so2?: number;
    o3?: number;
  };
  healthRecommendations: {
    generalPopulation: string;
    vulnerableGroups: string;
  };
  color: string;
  timestamp: string;
}

interface PollenData {
  forecast: Array<{
    date: string;
    pollenTypes: Array<{
      type: 'GRASS' | 'TREE' | 'WEED';
      index: number;
      category: string;
      inSeason: boolean;
    }>;
    plants: Array<{
      name: string;
      type: string;
      family: string;
      season: string;
      crossReaction?: string;
    }>;
    healthRecommendations: string;
  }>;
  maxIndex: number;
  dominantAllergen?: string;
}

interface EnvironmentalInsights {
  airQuality: AirQualityData | null;
  pollen: PollenData | null;
  weather: {
    temperature: number;
    humidity: number;
    uvIndex: number;
    condition: string;
  };
  geminiRecommendations: {
    petCareAdvice: string[];
    warnings: string[];
    activities: {
      outdoor: 'safe' | 'moderate' | 'avoid';
      washing: 'ideal' | 'acceptable' | 'postpone';
      exercise: 'recommended' | 'limited' | 'indoor_only';
    };
    vulnerablePets: string[];
  };
  overallScore: number; // 0-100, higher is better
  timestamp: string;
}

class SmartEnvironmentService {
  /**
   * Get current air quality data for a location
   */
  async getAirQuality(latitude: number, longitude: number): Promise<AirQualityData | null> {
    try {
      if (!GOOGLE_MAPS_API_KEY) {
        logger.warn('[Environment] Google Maps API key not configured - skipping air quality');
        return null;
      }

      const url = 'https://airquality.googleapis.com/v1/currentConditions:lookup';
      
      const response = await fetch(`${url}?key=${GOOGLE_MAPS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universalAqi: true,
          location: { latitude, longitude },
          extraComputations: [
            'HEALTH_RECOMMENDATIONS',
            'DOMINANT_POLLUTANT_CONCENTRATION',
            'POLLUTANT_CONCENTRATION',
            'LOCAL_AQI',
            'POLLUTANT_ADDITIONAL_INFO'
          ],
          languageCode: 'en'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[Environment] Air Quality API error', { 
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        return null;
      }

      const data = await response.json();

      // Extract Universal AQI
      const universalAqi = data.indexes?.find((idx: any) => idx.code === 'uaqi');
      
      if (!universalAqi) {
        logger.warn('[Environment] No Universal AQI data available');
        return null;
      }

      // Extract pollutant concentrations
      const pollutants: AirQualityData['pollutants'] = {};
      if (data.pollutants) {
        data.pollutants.forEach((p: any) => {
          if (p.code === 'pm25') pollutants.pm25 = p.concentration?.value;
          if (p.code === 'pm10') pollutants.pm10 = p.concentration?.value;
          if (p.code === 'no2') pollutants.no2 = p.concentration?.value;
          if (p.code === 'co') pollutants.co = p.concentration?.value;
          if (p.code === 'so2') pollutants.so2 = p.concentration?.value;
          if (p.code === 'o3') pollutants.o3 = p.concentration?.value;
        });
      }

      // Extract health recommendations
      const healthRecs = data.healthRecommendations || {};

      const airQualityData: AirQualityData = {
        aqi: universalAqi.aqi,
        category: universalAqi.category || 'Unknown',
        dominantPollutant: universalAqi.dominantPollutant || 'N/A',
        pollutants,
        healthRecommendations: {
          generalPopulation: healthRecs.generalPopulation || 'No specific recommendations',
          vulnerableGroups: healthRecs.athletes || healthRecs.elderly || 'Take precautions'
        },
        color: this.getAQIColor(universalAqi.aqi),
        timestamp: data.dateTime || new Date().toISOString()
      };

      logger.info('[Environment] Air quality retrieved', { 
        aqi: airQualityData.aqi,
        category: airQualityData.category 
      });

      return airQualityData;

    } catch (error: any) {
      logger.error('[Environment] Failed to fetch air quality', { error: error.message });
      return null;
    }
  }

  /**
   * Get pollen forecast for a location (up to 5 days)
   */
  async getPollenForecast(latitude: number, longitude: number, days: number = 5): Promise<PollenData | null> {
    try {
      if (!GOOGLE_MAPS_API_KEY) {
        logger.warn('[Environment] Google Maps API key not configured - skipping pollen');
        return null;
      }

      const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${GOOGLE_MAPS_API_KEY}`;
      
      // Pollen API requires POST with JSON body (not GET with query params)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: {
            latitude,
            longitude
          },
          days,
          languageCode: 'en'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[Environment] Pollen API error', { 
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        return null;
      }

      const data = await response.json();

      if (!data.dailyInfo || data.dailyInfo.length === 0) {
        logger.warn('[Environment] No pollen forecast data available');
        return null;
      }

      const forecast = data.dailyInfo.map((day: any) => {
        const pollenTypes = (day.pollenTypeInfo || []).map((pt: any) => ({
          type: pt.code as 'GRASS' | 'TREE' | 'WEED',
          index: pt.indexInfo?.value || 0,
          category: pt.indexInfo?.category || 'None',
          inSeason: pt.inSeason || false
        }));

        const plants = (day.plantInfo || []).map((pl: any) => ({
          name: pl.displayName,
          type: pl.plantDescription?.type || 'Unknown',
          family: pl.plantDescription?.family || 'Unknown',
          season: pl.plantDescription?.season || 'N/A',
          crossReaction: pl.plantDescription?.crossReaction
        }));

        return {
          date: `${day.date.year}-${String(day.date.month).padStart(2, '0')}-${String(day.date.day).padStart(2, '0')}`,
          pollenTypes,
          plants,
          healthRecommendations: day.pollenTypeInfo?.[0]?.healthRecommendations || 'No specific recommendations'
        };
      });

      // Find max pollen index and dominant allergen
      let maxIndex = 0;
      let dominantAllergen: string | undefined;

      forecast.forEach(day => {
        day.pollenTypes.forEach(pt => {
          if (pt.index > maxIndex) {
            maxIndex = pt.index;
            dominantAllergen = pt.type;
          }
        });
      });

      const pollenData: PollenData = {
        forecast,
        maxIndex,
        dominantAllergen
      };

      logger.info('[Environment] Pollen forecast retrieved', { 
        days: forecast.length,
        maxIndex,
        dominantAllergen 
      });

      return pollenData;

    } catch (error: any) {
      logger.error('[Environment] Failed to fetch pollen forecast', { error: error.message });
      return null;
    }
  }

  /**
   * Get comprehensive environmental insights with Gemini AI analysis
   */
  async getEnvironmentalInsights(
    latitude: number,
    longitude: number,
    weatherData?: any
  ): Promise<EnvironmentalInsights> {
    try {
      logger.info('[Environment] Fetching comprehensive environmental data', { latitude, longitude });

      // Fetch all environmental data in parallel
      const [airQuality, pollen] = await Promise.all([
        this.getAirQuality(latitude, longitude),
        this.getPollenForecast(latitude, longitude, 5)
      ]);

      // Use provided weather data or placeholder
      const weather = weatherData || {
        temperature: 22,
        humidity: 60,
        uvIndex: 5,
        condition: 'Partly Cloudy'
      };

      // Calculate overall environmental score (0-100, higher is better)
      let overallScore = 100;

      // Deduct points for poor air quality
      if (airQuality) {
        if (airQuality.aqi > 100) overallScore -= 30;
        else if (airQuality.aqi > 50) overallScore -= 15;
      }

      // Deduct points for high pollen
      if (pollen && pollen.maxIndex > 3) {
        overallScore -= (pollen.maxIndex - 2) * 10;
      }

      // Deduct points for extreme weather
      if (weather.temperature > 35) overallScore -= 20;
      if (weather.temperature < 5) overallScore -= 15;
      if (weather.uvIndex > 8) overallScore -= 10;

      overallScore = Math.max(0, Math.min(100, overallScore));

      // Generate Gemini AI recommendations
      const geminiRecommendations = await this.generateGeminiRecommendations(
        airQuality,
        pollen,
        weather,
        overallScore
      );

      const insights: EnvironmentalInsights = {
        airQuality,
        pollen,
        weather,
        geminiRecommendations,
        overallScore,
        timestamp: new Date().toISOString()
      };

      logger.info('[Environment] Environmental insights generated', { 
        overallScore,
        hasAirQuality: !!airQuality,
        hasPollen: !!pollen 
      });

      return insights;

    } catch (error: any) {
      logger.error('[Environment] Failed to generate insights', { error: error.message });
      
      // Return minimal insights on error
      return {
        airQuality: null,
        pollen: null,
        weather: weatherData || { temperature: 22, humidity: 60, uvIndex: 5, condition: 'Unknown' },
        geminiRecommendations: {
          petCareAdvice: ['Environmental data temporarily unavailable'],
          warnings: [],
          activities: {
            outdoor: 'moderate',
            washing: 'acceptable',
            exercise: 'recommended'
          },
          vulnerablePets: []
        },
        overallScore: 70,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate luxury pet care recommendations using Gemini AI
   */
  private async generateGeminiRecommendations(
    airQuality: AirQualityData | null,
    pollen: PollenData | null,
    weather: any,
    overallScore: number
  ): Promise<EnvironmentalInsights['geminiRecommendations']> {
    try {
      if (!genAI) {
        logger.warn('[Environment] Gemini AI not configured - using basic recommendations');
        return this.getFallbackRecommendations(airQuality, pollen, weather, overallScore);
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `You are a luxury pet care environmental expert. Analyze this environmental data and provide actionable recommendations for pet owners.

**Air Quality:**
${airQuality ? `
- AQI: ${airQuality.aqi} (${airQuality.category})
- Dominant Pollutant: ${airQuality.dominantPollutant}
- PM2.5: ${airQuality.pollutants.pm25 || 'N/A'} µg/m³
- Health Advice: ${airQuality.healthRecommendations.generalPopulation}
` : 'Air quality data not available'}

**Pollen Forecast:**
${pollen ? `
- Max Pollen Index: ${pollen.maxIndex}/5
- Dominant Allergen: ${pollen.dominantAllergen || 'None'}
- Today's Pollen: ${pollen.forecast[0]?.pollenTypes.map(pt => `${pt.type} (${pt.category})`).join(', ')}
` : 'Pollen data not available'}

**Weather:**
- Temperature: ${weather.temperature}°C
- Humidity: ${weather.humidity}%
- UV Index: ${weather.uvIndex}
- Condition: ${weather.condition}

**Overall Environmental Score:** ${overallScore}/100

Provide recommendations in this exact JSON format:
{
  "petCareAdvice": ["Luxury tip 1", "Luxury tip 2", "Luxury tip 3"],
  "warnings": ["Warning 1 (if needed)", "Warning 2"],
  "activities": {
    "outdoor": "safe|moderate|avoid",
    "washing": "ideal|acceptable|postpone",
    "exercise": "recommended|limited|indoor_only"
  },
  "vulnerablePets": ["Brachycephalic breeds (Bulldogs, Pugs)", "Elderly dogs", "Puppies"]
}

Make recommendations luxurious, specific, and actionable. Focus on pet health and comfort.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON in Gemini response');
      }

      const recommendations = JSON.parse(jsonMatch[0]);

      logger.info('[Environment] Gemini recommendations generated');
      return recommendations;

    } catch (error: any) {
      logger.error('[Environment] Gemini recommendation failed', { error: error.message });
      return this.getFallbackRecommendations(airQuality, pollen, weather, overallScore);
    }
  }

  /**
   * Fallback recommendations when Gemini AI is unavailable
   */
  private getFallbackRecommendations(
    airQuality: AirQualityData | null,
    pollen: PollenData | null,
    weather: any,
    overallScore: number
  ): EnvironmentalInsights['geminiRecommendations'] {
    const advice: string[] = [];
    const warnings: string[] = [];
    const vulnerablePets: string[] = [];

    // Air quality recommendations
    if (airQuality && airQuality.aqi > 100) {
      warnings.push(`Poor air quality (AQI ${airQuality.aqi}) - limit outdoor activities`);
      vulnerablePets.push('Brachycephalic breeds (Bulldogs, Pugs, French Bulldogs)');
    }

    // Pollen recommendations
    if (pollen && pollen.maxIndex >= 4) {
      warnings.push(`High pollen levels (${pollen.dominantAllergen}) - wipe paws after walks`);
      advice.push('Consider indoor playtime to reduce allergen exposure');
    }

    // Weather recommendations
    if (weather.temperature > 30) {
      warnings.push('High temperature - ensure fresh water and shade available');
      vulnerablePets.push('Elderly dogs and puppies');
    }

    if (weather.uvIndex > 7) {
      advice.push('Apply pet-safe sunscreen to light-colored dogs, especially ears and nose');
    }

    // Activity recommendations
    const activities = {
      outdoor: overallScore >= 70 ? 'safe' : overallScore >= 40 ? 'moderate' : 'avoid',
      washing: overallScore >= 60 ? 'ideal' : overallScore >= 30 ? 'acceptable' : 'postpone',
      exercise: overallScore >= 70 ? 'recommended' : overallScore >= 40 ? 'limited' : 'indoor_only'
    } as const;

    if (advice.length === 0) {
      advice.push('Excellent environmental conditions for outdoor pet activities');
    }

    return { petCareAdvice: advice, warnings, activities, vulnerablePets };
  }

  /**
   * Get AQI color based on index value
   */
  private getAQIColor(aqi: number): string {
    if (aqi <= 50) return '#00E400'; // Good - Green
    if (aqi <= 100) return '#FFFF00'; // Moderate - Yellow
    if (aqi <= 150) return '#FF7E00'; // Unhealthy for Sensitive - Orange
    if (aqi <= 200) return '#FF0000'; // Unhealthy - Red
    if (aqi <= 300) return '#8F3F97'; // Very Unhealthy - Purple
    return '#7E0023'; // Hazardous - Maroon
  }
}

export default new SmartEnvironmentService();
