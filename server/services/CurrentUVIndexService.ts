/**
 * CurrentUVIndex.com API Integration
 * FREE UV Index API - No API key required, unlimited usage
 * 
 * Features:
 * - Current UV index
 * - 120-hour forecast (5 days)
 * - 24-hour history
 * - No signup required
 * - Completely free
 */

import { logger } from '../lib/logger';

interface UVDataPoint {
  time: string;
  uvi: number;
}

interface UVIndexData {
  current: {
    time: string;
    uvi: number;
    category: string;
    recommendation: string;
    color: string;
  };
  forecast: UVDataPoint[];
  history: UVDataPoint[];
  metadata: {
    latitude: number;
    longitude: number;
    source: string;
    timestamp: string;
  };
}

export class CurrentUVIndexService {
  private readonly baseUrl = 'https://currentuvindex.com/api/v1';

  /**
   * Get comprehensive UV index data
   */
  async getUVIndex(latitude: number, longitude: number): Promise<UVIndexData | null> {
    try {
      const url = `${this.baseUrl}/uvi?latitude=${latitude}&longitude=${longitude}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`CurrentUVIndex API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error('CurrentUVIndex API returned error');
      }

      const currentUVI = data.now?.uvi || 0;
      
      logger.info('[CurrentUVIndex] ✅ UV data retrieved', {
        latitude,
        longitude,
        currentUVI,
        forecastHours: data.forecast?.length || 0,
        historyHours: data.history?.length || 0
      });

      return {
        current: {
          time: data.now?.time || new Date().toISOString(),
          uvi: currentUVI,
          category: this.getUVCategory(currentUVI),
          recommendation: this.getUVRecommendation(currentUVI),
          color: this.getUVColor(currentUVI)
        },
        forecast: data.forecast || [],
        history: data.history || [],
        metadata: {
          latitude: data.latitude || latitude,
          longitude: data.longitude || longitude,
          source: 'CurrentUVIndex.com',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      logger.error('[CurrentUVIndex] ❌ Failed to fetch UV data:', error);
      return null;
    }
  }

  /**
   * Get UV category based on index
   */
  private getUVCategory(uvi: number): string {
    if (uvi <= 2) return 'Low';
    if (uvi <= 5) return 'Moderate';
    if (uvi <= 7) return 'High';
    if (uvi <= 10) return 'Very High';
    return 'Extreme';
  }

  /**
   * Get UV recommendation for pet owners
   */
  private getUVRecommendation(uvi: number): string {
    if (uvi <= 2) {
      return 'Safe for outdoor activities. No special precautions needed for pets.';
    }
    if (uvi <= 5) {
      return 'Moderate UV levels. Provide shade and water for pets during extended outdoor time.';
    }
    if (uvi <= 7) {
      return 'High UV levels. Limit midday sun exposure. Keep pets in shade during peak hours.';
    }
    if (uvi <= 10) {
      return 'Very high UV. Avoid midday sun. Short outdoor trips only. Protect sensitive pets.';
    }
    return 'Extreme UV levels. Stay indoors during peak hours. Only brief outdoor breaks for pets.';
  }

  /**
   * Get color code for UV index
   */
  private getUVColor(uvi: number): string {
    if (uvi <= 2) return '#289500'; // Green
    if (uvi <= 5) return '#F7E400'; // Yellow
    if (uvi <= 7) return '#F85900'; // Orange
    if (uvi <= 10) return '#D8001D'; // Red
    return '#6B49C8'; // Purple
  }

  /**
   * Get peak UV hours for the day
   */
  async getPeakUVHours(latitude: number, longitude: number): Promise<{ start: string; end: string; maxUVI: number } | null> {
    try {
      const uvData = await this.getUVIndex(latitude, longitude);
      if (!uvData || !uvData.forecast.length) return null;

      // Find hours with UV > 5 (High or above)
      const highUVPeriods = uvData.forecast.filter(point => point.uvi > 5);
      
      if (!highUVPeriods.length) return null;

      const maxUVI = Math.max(...highUVPeriods.map(p => p.uvi));
      
      return {
        start: highUVPeriods[0].time,
        end: highUVPeriods[highUVPeriods.length - 1].time,
        maxUVI
      };

    } catch (error) {
      logger.error('[CurrentUVIndex] Failed to get peak UV hours:', error);
      return null;
    }
  }
}

export const currentUVIndex = new CurrentUVIndexService();
