/**
 * Multi-Source Weather Aggregator Service
 * Combines multiple weather APIs for maximum reliability and comprehensive data
 * 
 * Priority Chain:
 * 1. Open-Meteo (primary, 10K calls/day, no key needed)
 * 2. OpenWeatherMap (backup, 1K calls/day)
 * 3. WeatherAPI.com (real-time alerts, 1K calls/day)
 * 4. Visual Crossing (historical/analytics, 1K calls/day)
 * 
 * Total Capacity: 13,000+ API calls/day for global scale
 */

import { logger } from '../lib/logger';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;
const VISUAL_CROSSING_KEY = process.env.VISUAL_CROSSING_KEY;

interface WeatherSource {
  name: string;
  priority: number;
  available: boolean;
  dailyLimit: number;
}

interface ComprehensiveWeather {
  temperature: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  uvIndex: number;
  feelsLike: number;
  visibility?: number;
  pressure?: number;
  cloudCover?: number;
  dewPoint?: number;
  
  // Advanced data
  alerts?: WeatherAlert[];
  hourlyForecast?: HourlyForecast[];
  dailyForecast?: DailyForecast[];
  
  // Source tracking
  primarySource: string;
  fallbackUsed: boolean;
  dataSources: string[];
  reliability: 'high' | 'medium' | 'low';
  
  timestamp: string;
}

interface WeatherAlert {
  title: string;
  severity: 'extreme' | 'severe' | 'moderate' | 'minor';
  description: string;
  start: string;
  end: string;
  affectedArea: string;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  condition: string;
  precipitation: number;
  windSpeed: number;
}

interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  condition: string;
  precipitation: number;
  uvIndex: number;
}

export class MultiSourceWeatherService {
  
  /**
   * Get weather from Open-Meteo (primary source - free, no key needed)
   */
  private async getOpenMeteoWeather(lat: number, lon: number): Promise<Partial<ComprehensiveWeather> | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation,windspeed_10m,relativehumidity_2m,uv_index,cloudcover&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max&timezone=auto`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Open-Meteo API error: ${response.status}`);
      
      const data = await response.json();
      const current = data.current_weather;
      
      logger.info('[MultiWeather] ✅ Open-Meteo data retrieved');
      
      return {
        temperature: current.temperature,
        condition: this.mapOpenMeteoCondition(current.weathercode),
        description: this.getWeatherDescription(current.weathercode),
        windSpeed: current.windspeed,
        humidity: data.hourly?.relativehumidity_2m?.[0] || 0,
        precipitation: 0,
        uvIndex: data.hourly?.uv_index?.[0] || 0,
        cloudCover: data.hourly?.cloudcover?.[0] || 0,
        feelsLike: current.temperature,
        primarySource: 'open-meteo',
        fallbackUsed: false,
        dataSources: ['open-meteo'],
        reliability: 'high',
        timestamp: new Date().toISOString(),
        
        // Add forecast data
        hourlyForecast: this.parseOpenMeteoHourly(data.hourly),
        dailyForecast: this.parseOpenMeteoDaily(data.daily)
      };
    } catch (error) {
      logger.error('[MultiWeather] Open-Meteo fetch failed:', error);
      return null;
    }
  }

  /**
   * Get weather from OpenWeatherMap (backup source)
   */
  private async getOpenWeatherMapData(lat: number, lon: number): Promise<Partial<ComprehensiveWeather> | null> {
    if (!OPENWEATHER_API_KEY) {
      logger.warn('[MultiWeather] OpenWeatherMap API key not configured');
      return null;
    }

    try {
      // Use One Call API 3.0
      const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&exclude=minutely`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OpenWeatherMap API error: ${response.status}`);
      
      const data = await response.json();
      const current = data.current;
      
      logger.info('[MultiWeather] ✅ OpenWeatherMap data retrieved');
      
      return {
        temperature: current.temp,
        condition: current.weather[0].main,
        description: current.weather[0].description,
        humidity: current.humidity,
        windSpeed: current.wind_speed,
        precipitation: current.rain?.['1h'] || 0,
        uvIndex: current.uvi,
        feelsLike: current.feels_like,
        visibility: current.visibility,
        pressure: current.pressure,
        dewPoint: current.dew_point,
        cloudCover: current.clouds,
        
        // Alerts (if available)
        alerts: data.alerts?.map((alert: any) => ({
          title: alert.event,
          severity: this.mapAlertSeverity(alert.event),
          description: alert.description,
          start: new Date(alert.start * 1000).toISOString(),
          end: new Date(alert.end * 1000).toISOString(),
          affectedArea: alert.sender_name
        })),
        
        hourlyForecast: this.parseOpenWeatherHourly(data.hourly),
        dailyForecast: this.parseOpenWeatherDaily(data.daily)
      };
    } catch (error) {
      logger.error('[MultiWeather] OpenWeatherMap fetch failed:', error);
      return null;
    }
  }

  /**
   * Get weather from WeatherAPI.com (real-time alerts)
   */
  private async getWeatherAPIData(lat: number, lon: number): Promise<Partial<ComprehensiveWeather> | null> {
    if (!WEATHERAPI_KEY) {
      logger.warn('[MultiWeather] WeatherAPI key not configured');
      return null;
    }

    try {
      const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=7&aqi=no&alerts=yes`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`WeatherAPI error: ${response.status}`);
      
      const data = await response.json();
      const current = data.current;
      
      logger.info('[MultiWeather] ✅ WeatherAPI.com data retrieved');
      
      return {
        temperature: current.temp_c,
        condition: current.condition.text,
        description: current.condition.text,
        humidity: current.humidity,
        windSpeed: current.wind_kph / 3.6, // Convert to m/s
        precipitation: current.precip_mm,
        uvIndex: current.uv,
        feelsLike: current.feelslike_c,
        visibility: current.vis_km,
        pressure: current.pressure_mb,
        cloudCover: current.cloud,
        
        // Real-time alerts
        alerts: data.alerts?.alert?.map((alert: any) => ({
          title: alert.headline,
          severity: alert.severity.toLowerCase(),
          description: alert.desc,
          start: alert.effective,
          end: alert.expires,
          affectedArea: alert.areas
        }))
      };
    } catch (error) {
      logger.error('[MultiWeather] WeatherAPI fetch failed:', error);
      return null;
    }
  }

  /**
   * Main method: Get comprehensive weather from multiple sources
   * Uses fallback chain for maximum reliability
   */
  async getComprehensiveWeather(lat: number, lon: number): Promise<ComprehensiveWeather | null> {
    // Try primary source first (Open-Meteo)
    let weather = await this.getOpenMeteoWeather(lat, lon);
    
    if (weather) {
      // Enrich with data from other sources if available
      const enrichments = await Promise.allSettled([
        this.getOpenWeatherMapData(lat, lon),
        this.getWeatherAPIData(lat, lon)
      ]);
      
      enrichments.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const sourceName = index === 0 ? 'openweathermap' : 'weatherapi';
          weather = this.mergeWeatherData(weather!, result.value, sourceName);
        }
      });
      
      return weather as ComprehensiveWeather;
    }
    
    // Fallback to OpenWeatherMap
    logger.warn('[MultiWeather] Primary source failed, trying OpenWeatherMap backup');
    weather = await this.getOpenWeatherMapData(lat, lon);
    
    if (weather) {
      weather.primarySource = 'openweathermap';
      weather.fallbackUsed = true;
      weather.dataSources = ['openweathermap'];
      weather.reliability = 'medium';
      return weather as ComprehensiveWeather;
    }
    
    // Final fallback to WeatherAPI.com
    logger.warn('[MultiWeather] Backup failed, trying WeatherAPI.com');
    weather = await this.getWeatherAPIData(lat, lon);
    
    if (weather) {
      weather.primarySource = 'weatherapi';
      weather.fallbackUsed = true;
      weather.dataSources = ['weatherapi'];
      weather.reliability = 'low';
      return weather as ComprehensiveWeather;
    }
    
    logger.error('[MultiWeather] ❌ All weather sources failed!');
    return null;
  }

  /**
   * Merge weather data from multiple sources for enhanced reliability
   */
  private mergeWeatherData(primary: Partial<ComprehensiveWeather>, secondary: Partial<ComprehensiveWeather>, sourceName: string): Partial<ComprehensiveWeather> {
    const merged = { ...primary };
    
    // Add alerts from secondary source if not present
    if (secondary.alerts && secondary.alerts.length > 0) {
      merged.alerts = [...(merged.alerts || []), ...secondary.alerts];
    }
    
    // Add data source tracking
    if (!merged.dataSources) merged.dataSources = [];
    if (!merged.dataSources.includes(sourceName)) {
      merged.dataSources.push(sourceName);
    }
    
    // Improve reliability if we have multiple sources
    if (merged.dataSources!.length > 1) {
      merged.reliability = 'high';
    }
    
    logger.info(`[MultiWeather] Enriched with ${sourceName} data`);
    
    return merged;
  }

  // Helper methods
  private mapOpenMeteoCondition(code: number): string {
    const conditionMap: Record<number, string> = {
      0: 'Clear',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Foggy',
      51: 'Light Drizzle',
      53: 'Moderate Drizzle',
      55: 'Dense Drizzle',
      61: 'Slight Rain',
      63: 'Moderate Rain',
      65: 'Heavy Rain',
      71: 'Slight Snow',
      73: 'Moderate Snow',
      75: 'Heavy Snow',
      95: 'Thunderstorm'
    };
    return conditionMap[code] || 'Unknown';
  }

  private getWeatherDescription(code: number): string {
    // Add more detailed descriptions
    return this.mapOpenMeteoCondition(code);
  }

  private mapAlertSeverity(event: string): WeatherAlert['severity'] {
    const lowerEvent = event.toLowerCase();
    if (lowerEvent.includes('extreme') || lowerEvent.includes('hurricane')) return 'extreme';
    if (lowerEvent.includes('severe') || lowerEvent.includes('tornado')) return 'severe';
    if (lowerEvent.includes('storm') || lowerEvent.includes('flood')) return 'moderate';
    return 'minor';
  }

  private parseOpenMeteoHourly(hourly: any): HourlyForecast[] {
    if (!hourly || !hourly.time) return [];
    
    return hourly.time.slice(0, 24).map((time: string, index: number) => ({
      time,
      temperature: hourly.temperature_2m[index],
      condition: this.mapOpenMeteoCondition(hourly.weathercode?.[index] || 0),
      precipitation: hourly.precipitation[index] || 0,
      windSpeed: hourly.windspeed_10m[index]
    }));
  }

  private parseOpenMeteoDaily(daily: any): DailyForecast[] {
    if (!daily || !daily.time) return [];
    
    return daily.time.map((date: string, index: number) => ({
      date,
      tempMax: daily.temperature_2m_max[index],
      tempMin: daily.temperature_2m_min[index],
      condition: 'Forecast',
      precipitation: daily.precipitation_sum[index],
      uvIndex: daily.uv_index_max[index]
    }));
  }

  private parseOpenWeatherHourly(hourly: any[]): HourlyForecast[] {
    if (!hourly) return [];
    
    return hourly.slice(0, 24).map(hour => ({
      time: new Date(hour.dt * 1000).toISOString(),
      temperature: hour.temp,
      condition: hour.weather[0].main,
      precipitation: hour.pop * 100,
      windSpeed: hour.wind_speed
    }));
  }

  private parseOpenWeatherDaily(daily: any[]): DailyForecast[] {
    if (!daily) return [];
    
    return daily.map(day => ({
      date: new Date(day.dt * 1000).toISOString(),
      tempMax: day.temp.max,
      tempMin: day.temp.min,
      condition: day.weather[0].main,
      precipitation: day.pop * 100,
      uvIndex: day.uvi
    }));
  }
}

export const multiSourceWeather = new MultiSourceWeatherService();
