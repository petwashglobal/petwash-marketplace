/**
 * Smart Weather Notification Service
 * 
 * Sends intelligent weather alerts to platform users:
 * - Dog walkers (Walk My Pet™)
 * - Drivers (PetTrek™)  
 * - Pet wash hub users
 * 
 * Rules: NOT TOO MANY notifications (intelligent timing)
 */

import { logger } from '../lib/logger';
import { getWeatherForecast, geocodeLocation } from './unifiedLocationWeather';
import { sendPushNotification } from './fcmService';
import { db } from '../db';
import { eq, and, gte } from 'drizzle-orm';

interface WeatherAlert {
  type: 'severe_weather' | 'rain_warning' | 'perfect_conditions' | 'temperature_alert';
  severity: 'high' | 'medium' | 'low';
  message: string;
  title: string;
  targetAudience: ('walkers' | 'drivers' | 'wash_users')[];
}

/**
 * SMART NOTIFICATION RULES (Not Too Many!)
 * 
 * 1. Severe Weather: Immediate (thunderstorm, heavy rain, snow)
 * 2. Rain Warning: 2 hours before shift start
 * 3. Perfect Conditions: Once per day (morning only, 8 AM)
 * 4. Temperature Alert: Only if extreme (<5°C or >35°C)
 * 
 * Cooldown Period: Minimum 4 hours between notifications per user
 */

const NOTIFICATION_COOLDOWN_HOURS = 4;

/**
 * Analyze weather and generate smart alert
 */
export async function analyzeWeatherForAlerts(
  location: string,
  targetAudience: ('walkers' | 'drivers' | 'wash_users')[]
): Promise<WeatherAlert | null> {
  try {
    const geocoded = await geocodeLocation(location);
    if (!geocoded) {
      logger.warn(`[WeatherNotifications] Could not geocode location: ${location}`);
      return null;
    }

    const weather = await getWeatherForecast(geocoded.latitude, geocoded.longitude);
    if (!weather) {
      logger.warn(`[WeatherNotifications] No weather data for: ${location}`);
      return null;
    }

    // RULE 1: Severe Weather (Immediate Alert - High Priority)
    if (weather.condition?.toLowerCase().includes('thunderstorm') ||
        weather.condition?.toLowerCase().includes('storm') ||
        weather.condition?.toLowerCase().includes('heavy')) {
      return {
        type: 'severe_weather',
        severity: 'high',
        title: '⚠️ Severe Weather Alert',
        message: `${weather.condition} expected in ${geocoded.city}. Please take precautions and consider rescheduling outdoor activities.`,
        targetAudience,
      };
    }

    // RULE 2: Rain Warning (2 hours before shift - Medium Priority)
    if (weather.condition?.toLowerCase().includes('rain') ||
        weather.condition?.toLowerCase().includes('drizzle') ||
        (weather.precipitation && weather.precipitation > 0)) {
      return {
        type: 'rain_warning',
        severity: 'medium',
        title: '🌧️ Rain Expected',
        message: `Light rain expected in ${geocoded.city}. Bring umbrella and rain gear. Temperature: ${weather.temperature}°C`,
        targetAudience,
      };
    }

    // RULE 3: Perfect Conditions (Once per day, 8 AM - Low Priority)
    if (weather.temperature >= 18 && weather.temperature <= 28 &&
        !weather.condition?.toLowerCase().includes('rain') &&
        !weather.condition?.toLowerCase().includes('storm')) {
      
      const currentHour = new Date().getHours();
      
      // Only send "perfect conditions" at 8 AM
      if (currentHour === 8) {
        return {
          type: 'perfect_conditions',
          severity: 'low',
          title: '☀️ Perfect Weather Day',
          message: `Beautiful ${weather.temperature}°C in ${geocoded.city}! Great day for outdoor pet activities.`,
          targetAudience,
        };
      }
    }

    // RULE 4: Temperature Alert (Only extreme conditions - High Priority)
    if (weather.temperature < 5 || weather.temperature > 35) {
      return {
        type: 'temperature_alert',
        severity: 'high',
        title: weather.temperature < 5 ? '🥶 Cold Weather Alert' : '🥵 Heat Alert',
        message: `Extreme temperature (${weather.temperature}°C) in ${geocoded.city}. ${
          weather.temperature < 5 
            ? 'Bundle up pets and limit outdoor exposure.' 
            : 'Keep pets hydrated and avoid midday activities.'
        }`,
        targetAudience,
      };
    }

    // No alert needed
    return null;

  } catch (error) {
    logger.error('[WeatherNotifications] Error analyzing weather:', error);
    return null;
  }
}

/**
 * Check if user can receive notification (cooldown period)
 */
export async function canSendNotification(userId: string, notificationType: string): Promise<boolean> {
  try {
    // Check last notification time from notification_history table
    const lastNotification = await db.query.notificationHistory.findFirst({
      where: and(
        eq(db.query.notificationHistory.userId as any, userId),
        eq(db.query.notificationHistory.type as any, notificationType),
        gte(db.query.notificationHistory.sentAt as any, new Date(Date.now() - NOTIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000))
      ),
      orderBy: (notificationHistory, { desc }) => [desc(notificationHistory.sentAt as any)],
    });

    // If no recent notification, allow
    if (!lastNotification) {
      return true;
    }

    // Check cooldown period
    const hoursSinceLastNotification = 
      (Date.now() - new Date(lastNotification.sentAt as any).getTime()) / (1000 * 60 * 60);

    return hoursSinceLastNotification >= NOTIFICATION_COOLDOWN_HOURS;

  } catch (error) {
    logger.error('[WeatherNotifications] Error checking notification cooldown:', error);
    // Allow notification if check fails (fail open)
    return true;
  }
}

/**
 * Send weather notification to target audience
 */
export async function sendWeatherNotification(
  alert: WeatherAlert,
  location: string
): Promise<void> {
  try {
    logger.info(`[WeatherNotifications] Sending ${alert.type} notification for ${location}`);

    // Get target users based on audience
    const targetUsers: string[] = [];

    // Dog Walkers (Walk My Pet™)
    if (alert.targetAudience.includes('walkers')) {
      // Query active walkers from walk_my_pet_providers table
      // TODO: Add query when table structure is finalized
      logger.info('[WeatherNotifications] Targeting dog walkers');
    }

    // Drivers (PetTrek™)
    if (alert.targetAudience.includes('drivers')) {
      // Query active drivers from pettrek_drivers table
      // TODO: Add query when table structure is finalized
      logger.info('[WeatherNotifications] Targeting drivers');
    }

    // Pet Wash Hub Users
    if (alert.targetAudience.includes('wash_users')) {
      // Query users with upcoming wash appointments
      // TODO: Add query when table structure is finalized
      logger.info('[WeatherNotifications] Targeting wash hub users');
    }

    // Send notifications to users (with cooldown check)
    for (const userId of targetUsers) {
      const canSend = await canSendNotification(userId, alert.type);
      
      if (canSend) {
        await sendPushNotification(userId, {
          title: alert.title,
          body: alert.message,
          data: {
            type: 'weather_alert',
            severity: alert.severity,
            location,
          },
        });

        logger.info(`[WeatherNotifications] Sent notification to user ${userId}`);
      } else {
        logger.debug(`[WeatherNotifications] Skipped notification to user ${userId} (cooldown)`);
      }
    }

  } catch (error) {
    logger.error('[WeatherNotifications] Error sending weather notification:', error);
  }
}

/**
 * Scheduled job: Check weather for all active locations
 * Runs every 2 hours (smart timing, not too many!)
 */
export async function checkWeatherForActiveLocations(): Promise<void> {
  try {
    logger.info('[WeatherNotifications] Running scheduled weather check...');

    // Get unique locations from active sessions
    const activeLocations = new Set<string>();

    // Add locations from active walk sessions
    // TODO: Query walk_sessions table

    // Add locations from active PetTrek trips
    // TODO: Query pettrek_trips table

    // Add locations from wash stations
    // TODO: Query pet_wash_stations table
    
    // For now, check major cities
    const defaultLocations = ['Tel Aviv', 'Jerusalem', 'Haifa', 'Beer Sheva'];
    defaultLocations.forEach(loc => activeLocations.add(loc));

    // Analyze weather for each location
    for (const location of activeLocations) {
      const alert = await analyzeWeatherForAlerts(location, ['walkers', 'drivers', 'wash_users']);
      
      if (alert) {
        await sendWeatherNotification(alert, location);
      }
    }

    logger.info(`[WeatherNotifications] Weather check complete for ${activeLocations.size} locations`);

  } catch (error) {
    logger.error('[WeatherNotifications] Error in scheduled weather check:', error);
  }
}

/**
 * Send weather forecast for upcoming shift (2 hours before)
 */
export async function sendShiftWeatherForecast(
  userId: string,
  shiftStartTime: Date,
  location: string,
  userType: 'walker' | 'driver' | 'wash_user'
): Promise<void> {
  try {
    const hoursUntilShift = (shiftStartTime.getTime() - Date.now()) / (1000 * 60 * 60);

    // Send notification 2 hours before shift
    if (hoursUntilShift > 1.5 && hoursUntilShift < 2.5) {
      const geocoded = await geocodeLocation(location);
      if (!geocoded) return;

      const weather = await getWeatherForecast(geocoded.latitude, geocoded.longitude);
      if (!weather) return;

      const canSend = await canSendNotification(userId, 'shift_weather_forecast');
      if (!canSend) return;

      let message = `Weather for your shift: ${weather.temperature}°C, ${weather.condition}.`;
      
      if (weather.condition?.toLowerCase().includes('rain')) {
        message += ' 🌧️ Bring rain gear!';
      } else if (weather.temperature > 30) {
        message += ' ☀️ Stay hydrated!';
      } else if (weather.temperature < 10) {
        message += ' 🧥 Bundle up!';
      }

      await sendPushNotification(userId, {
        title: '🌤️ Weather Update for Your Shift',
        body: message,
        data: {
          type: 'shift_weather_forecast',
          shiftStartTime: shiftStartTime.toISOString(),
          location,
        },
      });

      logger.info(`[WeatherNotifications] Sent shift weather forecast to user ${userId}`);
    }

  } catch (error) {
    logger.error('[WeatherNotifications] Error sending shift weather forecast:', error);
  }
}

export default {
  analyzeWeatherForAlerts,
  sendWeatherNotification,
  checkWeatherForActiveLocations,
  sendShiftWeatherForecast,
  canSendNotification,
};
