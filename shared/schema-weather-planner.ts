import { z } from 'zod';

/**
 * Weather Planner View Models - Role-Based Access
 * 
 * Defines data contracts for 4 user personas:
 * 1. EmployeeExecutive (admin/ops) - Full access
 * 2. EmployeeStation (manager/support) - Limited to assigned stations
 * 3. Client - Appointment-specific
 * 4. Public - General showcase
 */

// ============================================
// SHARED TYPES
// ============================================

export const SupportedLanguage = z.enum(['en', 'he', 'ar', 'ru', 'fr', 'es']);
export type SupportedLanguage = z.infer<typeof SupportedLanguage>;

export const WeatherConditionSchema = z.object({
  temperature: z.number(),
  condition: z.string(),
  humidity: z.number(),
  windSpeed: z.number(),
  precipitation: z.number(),
  uvIndex: z.number(),
  washScore: z.number(),
});
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const DayForecastSchema = z.object({
  date: z.string(),
  dayOfWeek: z.string(),
  temperature: z.object({
    max: z.number(),
    min: z.number(),
  }),
  weatherCode: z.number(),
  condition: z.object({
    condition: z.string(),
    icon: z.string(),
  }),
  precipitationProbability: z.number(),
  uvIndex: z.number(),
  windSpeed: z.number(),
  washScore: z.number(),
  recommendation: z.object({
    rating: z.enum(['excellent', 'good', 'moderate', 'poor']),
    emoji: z.string(),
    title: z.string(),
    message: z.string(),
    color: z.string(),
    action: z.string(),
    priority: z.string(),
  }),
});
export type DayForecast = z.infer<typeof DayForecastSchema>;

export const LocationDataSchema = z.object({
  city: z.string(),
  country: z.string(),
  formattedAddress: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

// ============================================
// PUBLIC SHOWCASE VIEW (External/Unauthenticated)
// ============================================

export const PublicWeatherViewSchema = z.object({
  success: z.boolean(),
  location: LocationDataSchema,
  forecast: z.array(DayForecastSchema),
  bestWashDay: DayForecastSchema.optional(),
  marketingMessage: z.string().optional(),
  locale: z.string(),
  language: SupportedLanguage,
  direction: z.enum(['ltr', 'rtl']),
});
export type PublicWeatherView = z.infer<typeof PublicWeatherViewSchema>;

// ============================================
// CLIENT VIEW (Authenticated Regular Users)
// ============================================

export const AppointmentWeatherSchema = z.object({
  appointmentId: z.string(),
  scheduledTime: z.string(),
  location: LocationDataSchema,
  weather: WeatherConditionSchema,
  recommendation: z.object({
    shouldReschedule: z.boolean(),
    reason: z.string().optional(),
    suggestedAlternatives: z.array(z.string()).optional(),
  }),
});
export type AppointmentWeather = z.infer<typeof AppointmentWeatherSchema>;

export const ClientWeatherViewSchema = z.object({
  success: z.boolean(),
  userId: z.string(),
  upcomingAppointments: z.array(AppointmentWeatherSchema),
  personalRecommendations: z.array(z.string()),
  bestDaysThisWeek: z.array(DayForecastSchema),
  locale: z.string(),
  language: SupportedLanguage,
  direction: z.enum(['ltr', 'rtl']),
});
export type ClientWeatherView = z.infer<typeof ClientWeatherViewSchema>;

// ============================================
// EMPLOYEE STATION VIEW (Manager/Support)
// ============================================

export const StationWeatherSchema = z.object({
  stationId: z.string(),
  stationName: z.string(),
  location: LocationDataSchema,
  forecast: z.array(DayForecastSchema),
  alerts: z.array(z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string(),
    message: z.string(),
    timestamp: z.string(),
  })),
  operationalInsights: z.object({
    expectedBusyDays: z.array(z.string()),
    weatherImpactScore: z.number(),
    recommendations: z.array(z.string()),
  }),
});
export type StationWeather = z.infer<typeof StationWeatherSchema>;

export const EmployeeStationViewSchema = z.object({
  success: z.boolean(),
  employeeId: z.string(),
  employeeName: z.string(),
  role: z.string(),
  assignedStations: z.array(StationWeatherSchema),
  dailySummary: z.string(),
  locale: z.string(),
  language: SupportedLanguage,
  direction: z.enum(['ltr', 'rtl']),
});
export type EmployeeStationView = z.infer<typeof EmployeeStationViewSchema>;

// ============================================
// EMPLOYEE EXECUTIVE VIEW (Admin/Ops)
// ============================================

export const FranchiseLocationSchema = z.object({
  franchiseId: z.string(),
  franchiseName: z.string(),
  city: z.string(),
  country: z.string(),
  stationCount: z.number(),
  weather: WeatherConditionSchema,
  washScore: z.number(),
});
export type FranchiseLocation = z.infer<typeof FranchiseLocationSchema>;

export const CrossLocationAnalyticsSchema = z.object({
  totalLocations: z.number(),
  averageWashScore: z.number(),
  bestPerformingLocation: z.object({
    franchiseId: z.string(),
    name: z.string(),
    washScore: z.number(),
  }).optional(),
  weatherAlerts: z.array(z.object({
    franchiseId: z.string(),
    franchiseName: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    message: z.string(),
  })),
  weeklyTrends: z.object({
    averageTemperature: z.number(),
    totalPrecipitation: z.number(),
    optimalWashDays: z.number(),
  }),
});
export type CrossLocationAnalytics = z.infer<typeof CrossLocationAnalyticsSchema>;

export const EmployeeExecutiveViewSchema = z.object({
  success: z.boolean(),
  employeeId: z.string(),
  employeeName: z.string(),
  role: z.string(),
  allFranchiseLocations: z.array(FranchiseLocationSchema),
  analytics: CrossLocationAnalyticsSchema,
  globalRecommendations: z.array(z.string()),
  exportData: z.object({
    availableFormats: z.array(z.enum(['pdf', 'csv', 'excel'])),
    generateUrl: z.string(),
  }).optional(),
  locale: z.string(),
  language: SupportedLanguage,
  direction: z.enum(['ltr', 'rtl']),
});
export type EmployeeExecutiveView = z.infer<typeof EmployeeExecutiveViewSchema>;

// ============================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================

export const WeatherPlannerRequestSchema = z.object({
  scope: z.enum(['public', 'client', 'employee_station', 'employee_executive']).optional(),
  location: z.string().optional(), // For public/manual location search
  lang: SupportedLanguage.optional(),
  // Client-specific
  appointmentIds: z.array(z.string()).optional(),
  // Employee-specific
  stationIds: z.array(z.string()).optional(),
  franchiseIds: z.array(z.string()).optional(),
});
export type WeatherPlannerRequest = z.infer<typeof WeatherPlannerRequestSchema>;

export const WeatherPlannerResponseSchema = z.union([
  PublicWeatherViewSchema,
  ClientWeatherViewSchema,
  EmployeeStationViewSchema,
  EmployeeExecutiveViewSchema,
]);
export type WeatherPlannerResponse = z.infer<typeof WeatherPlannerResponseSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine user type from authentication context
 */
export function getUserType(context: {
  isAuthenticated: boolean;
  isEmployee: boolean;
  role?: string;
}): 'public' | 'client' | 'employee_station' | 'employee_executive' {
  if (!context.isAuthenticated) {
    return 'public';
  }
  
  if (context.isEmployee) {
    const executiveRoles = ['admin', 'ops'];
    return executiveRoles.includes(context.role || '') 
      ? 'employee_executive' 
      : 'employee_station';
  }
  
  return 'client';
}

/**
 * Get localized metadata for response
 */
export function getLocalizedMetadata(lang: SupportedLanguage): {
  locale: string;
  direction: 'ltr' | 'rtl';
} {
  const RTL_LANGUAGES: SupportedLanguage[] = ['he', 'ar'];
  const LOCALE_MAP: Record<SupportedLanguage, string> = {
    en: 'en-US',
    he: 'he-IL',
    ar: 'ar-SA',
    ru: 'ru-RU',
    fr: 'fr-FR',
    es: 'es-ES'
  };

  return {
    locale: LOCALE_MAP[lang],
    direction: RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr',
  };
}
