/**
 * Open-Meteo Air Quality API Integration
 * FREE Air Quality & Pollen API - No API key required
 * 
 * Features:
 * - Air quality (PM2.5, PM10, NO2, O3, SO2, CO)
 * - Pollen data (Alder, Birch, Grass, Olive, Ragweed)
 * - 5-day forecast
 * - Completely free for non-commercial use
 */

import { logger } from '../lib/logger';

interface AirQualityData {
  current: {
    aqi: number;
    category: string;
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    so2: number;
    co: number;
    dominantPollutant: string;
    color: string;
  };
  pollen: {
    alder: number;
    birch: number;
    grass: number;
    olive: number;
    ragweed: number;
    total: number;
  } | null;
  forecast: Array<{
    time: string;
    aqi: number;
    pm25: number;
    pm10: number;
  }>;
  metadata: {
    latitude: number;
    longitude: number;
    source: string;
    timestamp: string;
  };
}

export class OpenMeteoAirQualityService {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/air-quality';

  /**
   * Get comprehensive air quality and pollen data
   */
  async getAirQuality(latitude: number, longitude: number): Promise<AirQualityData | null> {
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        current: [
          'pm10',
          'pm2_5',
          'carbon_monoxide',
          'nitrogen_dioxide',
          'sulphur_dioxide',
          'ozone',
          'us_aqi',
          'european_aqi'
        ].join(','),
        hourly: 'pm10,pm2_5,us_aqi',
        forecast_days: '5'
      });

      // Try to add pollen data (may not be available in all regions)
      const pollenParams = new URLSearchParams(params);
      pollenParams.append('current', 'alder_pollen,birch_pollen,grass_pollen,olive_pollen,ragweed_pollen');

      const url = `${this.baseUrl}?${pollenParams.toString()}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Open-Meteo Air Quality API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const current = data.current;
      const pm25 = current['pm2_5'] || 0;
      const pm10 = current.pm10 || 0;
      const no2 = current.nitrogen_dioxide || 0;
      const o3 = current.ozone || 0;
      const so2 = current.sulphur_dioxide || 0;
      const co = current.carbon_monoxide || 0;
      
      // Use US AQI if available, otherwise European
      const aqi = current.us_aqi || current.european_aqi || this.calculateAQI(pm25, pm10);
      
      logger.info('[OpenMeteo Air] ✅ Air quality data retrieved', {
        latitude,
        longitude,
        aqi,
        pm25,
        pm10
      });

      // Extract pollen data if available
      let pollenData = null;
      if (current['alder_pollen'] !== undefined) {
        const alder = current['alder_pollen'] || 0;
        const birch = current['birch_pollen'] || 0;
        const grass = current['grass_pollen'] || 0;
        const olive = current['olive_pollen'] || 0;
        const ragweed = current['ragweed_pollen'] || 0;
        
        pollenData = {
          alder,
          birch,
          grass,
          olive,
          ragweed,
          total: alder + birch + grass + olive + ragweed
        };
      }

      return {
        current: {
          aqi,
          category: this.getAQICategory(aqi),
          pm25,
          pm10,
          no2,
          o3,
          so2,
          co,
          dominantPollutant: this.getDominantPollutant({ pm25, pm10, no2, o3, so2, co }),
          color: this.getAQIColor(aqi)
        },
        pollen: pollenData,
        forecast: this.parseForecast(data.hourly),
        metadata: {
          latitude,
          longitude,
          source: 'Open-Meteo',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      logger.error('[OpenMeteo Air] ❌ Failed to fetch air quality:', error);
      return null;
    }
  }

  /**
   * Parse hourly forecast data
   */
  private parseForecast(hourly: any): Array<{ time: string; aqi: number; pm25: number; pm10: number }> {
    if (!hourly || !hourly.time) return [];

    return hourly.time.slice(0, 24).map((time: string, index: number) => ({
      time,
      aqi: hourly['us_aqi']?.[index] || 0,
      pm25: hourly['pm2_5']?.[index] || 0,
      pm10: hourly.pm10?.[index] || 0
    }));
  }

  /**
   * Calculate AQI from PM2.5 and PM10 (simplified US EPA formula)
   */
  private calculateAQI(pm25: number, pm10: number): number {
    // Simplified AQI calculation based on PM2.5 (most common pollutant)
    if (pm25 <= 12) return Math.round((50 / 12) * pm25);
    if (pm25 <= 35.4) return Math.round(50 + ((100 - 50) / (35.4 - 12.1)) * (pm25 - 12.1));
    if (pm25 <= 55.4) return Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (pm25 - 35.5));
    if (pm25 <= 150.4) return Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (pm25 - 55.5));
    if (pm25 <= 250.4) return Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (pm25 - 150.5));
    return Math.round(300 + ((500 - 300) / (500.4 - 250.5)) * (pm25 - 250.5));
  }

  /**
   * Get AQI category
   */
  private getAQICategory(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  /**
   * Get AQI color code
   */
  private getAQIColor(aqi: number): string {
    if (aqi <= 50) return '#00E400'; // Green
    if (aqi <= 100) return '#FFFF00'; // Yellow
    if (aqi <= 150) return '#FF7E00'; // Orange
    if (aqi <= 200) return '#FF0000'; // Red
    if (aqi <= 300) return '#8F3F97'; // Purple
    return '#7E0023'; // Maroon
  }

  /**
   * Determine dominant pollutant
   */
  private getDominantPollutant(pollutants: { pm25: number; pm10: number; no2: number; o3: number; so2: number; co: number }): string {
    const { pm25, pm10, no2, o3, so2, co } = pollutants;
    
    // Normalize to AQI-like scale
    const normalized = {
      'PM2.5': pm25 / 12,
      'PM10': pm10 / 54,
      'NO2': no2 / 100,
      'O3': o3 / 70,
      'SO2': so2 / 75,
      'CO': co / 4400
    };

    let maxPollutant = 'PM2.5';
    let maxValue = normalized['PM2.5'];

    for (const [pollutant, value] of Object.entries(normalized)) {
      if (value > maxValue) {
        maxValue = value;
        maxPollutant = pollutant;
      }
    }

    return maxPollutant;
  }
}

export const openMeteoAirQuality = new OpenMeteoAirQualityService();
