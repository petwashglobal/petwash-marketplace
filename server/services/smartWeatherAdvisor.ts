import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../lib/logger';
import type { SupportedLanguage } from '../lib/weatherTranslations';
import { 
  getFallbackAdviceText, 
  getBasicRecommendationText,
  getLabelText,
  getWeatherConditionTranslation 
} from '../lib/weatherTranslations';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  logger.warn('[SmartWeatherAdvisor] GEMINI_API_KEY not configured - smart advice disabled');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Language name mapping for Gemini prompts
const LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  en: 'English',
  he: 'Hebrew (עברית)',
  ar: 'Arabic (العربية)',
  ru: 'Russian (Русский)',
  fr: 'French (Français)',
  es: 'Spanish (Español)'
};

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  uvIndex: number;
  washScore: number;
}

interface Appointment {
  time: string;
  location: 'indoor' | 'outdoor';
  petType?: string;
  petBreed?: string;
  serviceType?: string;
}

interface SmartAdvice {
  priority: 'critical' | 'high' | 'medium' | 'low';
  icon: string;
  title: string;
  message: string;
  action: string;
  petSafetyScore: number;
  recommendations: string[];
}

export class SmartWeatherAdvisorService {
  /**
   * Generate smart, actionable pet-focused weather advice using Gemini AI
   * Supports multi-language responses (English, Hebrew, Arabic, Russian, French, Spanish)
   */
  async generateSmartAdvice(
    operatorName: string,
    weather: WeatherData,
    appointments: Appointment[] = [],
    lang: SupportedLanguage = 'en'
  ): Promise<SmartAdvice> {
    try {
      if (!genAI) {
        logger.warn('[SmartWeatherAdvisor] Gemini AI not configured - returning basic advice');
        return this.getFallbackAdvice(weather, lang);
      }

      const prompt = this.buildSmartPrompt(operatorName, weather, appointments, lang);
      
      // Get the Gemini model (correct API per architect review)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      // Call Gemini AI
      const result = await model.generateContent(prompt);
      const response = result.response;
      const advice = this.parseGeminiResponse(response.text(), weather, lang);

      logger.info('[SmartWeatherAdvisor] ✅ Generated smart advice', {
        operatorName,
        priority: advice.priority,
        temperature: weather.temperature,
        condition: weather.condition,
        language: lang
      });

      return advice;

    } catch (error: any) {
      // Enhanced error logging per architect recommendation
      console.error('[SmartWeatherAdvisor] RAW ERROR:', error);
      console.error('[SmartWeatherAdvisor] ERROR DETAILS:', {
        message: error?.message,
        name: error?.name,
        status: error?.status,
        code: error?.code,
        geminiApiKeySet: !!genAI,
        language: lang
      });
      
      logger.error('[SmartWeatherAdvisor] Failed to generate smart advice', {
        errorMessage: error?.message || 'Unknown error',
        errorName: error?.name,
        geminiApiKeySet: !!genAI,
        language: lang
      });
      
      return this.getFallbackAdvice(weather, lang);
    }
  }

  /**
   * Build comprehensive prompt for Gemini AI with multi-language support
   */
  private buildSmartPrompt(
    operatorName: string,
    weather: WeatherData,
    appointments: Appointment[],
    lang: SupportedLanguage = 'en'
  ): string {
    const appointmentDetails = appointments.length > 0
      ? appointments.map((apt, idx) => 
          `${idx + 1}. ${apt.time} - ${apt.location} wash (${apt.petType || 'pet'} - ${apt.serviceType || 'full wash'})`
        ).join('\n')
      : 'No appointments scheduled';

    const targetLanguage = LANGUAGE_MAP[lang];

    return `You are an expert pet care weather advisor for Pet Wash™ - a premium organic pet washing service.

**IMPORTANT: Respond in ${targetLanguage} language. ALL text fields (title, message, action, recommendations) must be in ${targetLanguage}.**

**Operator:** ${operatorName}
**Current Weather:**
- Temperature: ${weather.temperature}°C
- Condition: ${weather.condition}
- Humidity: ${weather.humidity}%
- Wind Speed: ${weather.windSpeed} km/h
- Precipitation Chance: ${weather.precipitation}%
- UV Index: ${weather.uvIndex}
- Pet Wash Score: ${weather.washScore}/100

**Today's Appointments:**
${appointmentDetails}

**Your Task:**
Analyze this weather data and provide SMART, ACTIONABLE advice in ${targetLanguage} focused on:
1. Pet comfort and safety (top priority)
2. Wash quality and drying efficiency
3. Proactive risk mitigation
4. Specific recommendations for each appointment

**Guidelines:**
- If severe weather (thunderstorm, heavy rain, extreme temp): Mark as CRITICAL priority
- If outdoor appointments during rain/storms: Suggest specific rescheduling times or indoor alternative
- If high UV (>8): Recommend sunscreen for light-colored pets, shade breaks
- If high humidity (>80%): Warn about longer drying times, suggest heated dryer
- If very cold (<5°C): Recommend warm water, heated facilities, keep pets warm after wash
- If very hot (>35°C): Recommend cool water, AC facilities, avoid midday washes
- If windy (>30 km/h): Warn about outdoor drying difficulty, suggest indoor drying

**Response Format (JSON):**
{
  "priority": "critical|high|medium|low",
  "icon": "emoji for the main alert",
  "title": "Short impactful title in ${targetLanguage} (max 6 words)",
  "message": "Clear, concise explanation in ${targetLanguage} (1-2 sentences)",
  "action": "Specific actionable step in ${targetLanguage} to take NOW",
  "petSafetyScore": 0-100,
  "recommendations": ["Rec 1 in ${targetLanguage}", "Rec 2 in ${targetLanguage}", "Rec 3 in ${targetLanguage}"]
}

**Example for severe weather in ${targetLanguage}:**
{
  "priority": "critical",
  "icon": "⚠️",
  "title": "Severe Weather Alert (translated to ${targetLanguage})",
  "message": "Heavy rain expected 12:45-2:15 PM. Outdoor 1 PM appointment at high risk. (translated to ${targetLanguage})",
  "action": "Reschedule 1 PM outdoor wash to 3 PM or move indoors immediately (translated to ${targetLanguage})",
  "petSafetyScore": 25,
  "recommendations": [
    "Contact client for 1 PM appointment - offer indoor alternative (in ${targetLanguage})",
    "Prepare heated dryer for all washes due to humidity (in ${targetLanguage})",
    "Keep pets dry and warm during transport (in ${targetLanguage})"
  ]
}

**CRITICAL: Provide your response as valid JSON only with ALL text in ${targetLanguage}, no additional text.**`;
  }

  /**
   * Parse Gemini AI response into structured advice with multi-language fallback
   */
  private parseGeminiResponse(rawResponse: string, weather: WeatherData, lang: SupportedLanguage = 'en'): SmartAdvice {
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        priority: parsed.priority || this.calculatePriority(weather),
        icon: parsed.icon || this.getWeatherIcon(weather.condition),
        title: parsed.title || 'Weather Advisory',
        message: parsed.message || 'Check conditions before washing',
        action: parsed.action || 'Monitor weather and adjust schedule as needed',
        petSafetyScore: parsed.petSafetyScore || weather.washScore,
        recommendations: Array.isArray(parsed.recommendations) 
          ? parsed.recommendations 
          : this.getBasicRecommendations(weather, lang)
      };
    } catch (error) {
      logger.error('[SmartWeatherAdvisor] Failed to parse Gemini response', { error });
      return this.getFallbackAdvice(weather, lang);
    }
  }

  /**
   * Fallback advice when Gemini AI is unavailable (supports multi-language)
   */
  private getFallbackAdvice(weather: WeatherData, lang: SupportedLanguage = 'en'): SmartAdvice {
    let priority = this.calculatePriority(weather);
    const recommendations = this.getBasicRecommendations(weather, lang);

    let title = getFallbackAdviceText('goodConditions', 'title', lang);
    let message = getFallbackAdviceText('goodConditions', 'message', lang);
    let action = getFallbackAdviceText('goodConditions', 'action', lang);
    let icon = '✅';

    // Priority-based logic (critical conditions first) with translations
    if (weather.temperature > 35) {
      priority = 'critical';
      icon = '🌡️';
      title = getFallbackAdviceText('extremeHeat', 'title', lang);
      message = `${weather.temperature}°C - ${getFallbackAdviceText('extremeHeat', 'message', lang)}`;
      action = getFallbackAdviceText('extremeHeat', 'action', lang);
    } else if (weather.temperature < 5) {
      priority = 'high';
      icon = '❄️';
      title = getFallbackAdviceText('coldWeather', 'title', lang);
      message = `${weather.temperature}°C - ${getFallbackAdviceText('coldWeather', 'message', lang)}`;
      action = getFallbackAdviceText('coldWeather', 'action', lang);
    } else if (weather.precipitation > 70) {
      priority = 'critical';
      icon = '🌧️';
      title = getFallbackAdviceText('heavyRain', 'title', lang);
      message = `${weather.precipitation}% ${getFallbackAdviceText('heavyRain', 'message', lang)}`;
      action = getFallbackAdviceText('heavyRain', 'action', lang);
    } else if (weather.condition.toLowerCase().includes('rain') || weather.condition.toLowerCase().includes('storm')) {
      priority = 'high';
      icon = '🌧️';
      title = getFallbackAdviceText('rainyWeather', 'title', lang);
      const translatedCondition = getWeatherConditionTranslation(weather.condition, lang);
      message = `${translatedCondition} ${getFallbackAdviceText('rainyWeather', 'message', lang)}`;
      action = getFallbackAdviceText('rainyWeather', 'action', lang);
    } else if (weather.uvIndex > 8) {
      priority = 'medium';
      icon = '☀️';
      title = getFallbackAdviceText('highUV', 'title', lang);
      message = `${getLabelText('uvIndex', lang)} ${weather.uvIndex} - ${getFallbackAdviceText('highUV', 'message', lang)}`;
      action = getFallbackAdviceText('highUV', 'action', lang);
    } else if (weather.humidity > 85) {
      priority = 'medium';
      icon = '💧';
      title = getFallbackAdviceText('highHumidity', 'title', lang);
      message = `${weather.humidity}% ${getFallbackAdviceText('highHumidity', 'message', lang)}`;
      action = getFallbackAdviceText('highHumidity', 'action', lang);
    } else if (weather.washScore < 40) {
      priority = 'medium';
      icon = '⚠️';
      title = getFallbackAdviceText('unfavorable', 'title', lang);
      message = getFallbackAdviceText('unfavorable', 'message', lang);
      action = getFallbackAdviceText('unfavorable', 'action', lang);
    }

    return {
      priority: priority as 'critical' | 'high' | 'medium' | 'low',
      icon,
      title,
      message,
      action,
      petSafetyScore: weather.washScore,
      recommendations
    };
  }

  /**
   * Calculate priority based on weather conditions
   */
  private calculatePriority(weather: WeatherData): string {
    if (
      weather.temperature > 35 || 
      weather.temperature < 0 || 
      weather.precipitation > 80 ||
      weather.condition.toLowerCase().includes('thunder')
    ) {
      return 'critical';
    }

    if (
      weather.temperature < 5 ||
      weather.temperature > 32 ||
      weather.precipitation > 60 ||
      weather.windSpeed > 35
    ) {
      return 'high';
    }

    if (
      weather.uvIndex > 8 ||
      weather.humidity > 85 ||
      weather.precipitation > 30
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get weather condition icon
   */
  private getWeatherIcon(condition: string): string {
    const lower = condition.toLowerCase();
    if (lower.includes('thunder')) return '⛈️';
    if (lower.includes('rain')) return '🌧️';
    if (lower.includes('snow')) return '❄️';
    if (lower.includes('cloud')) return '☁️';
    if (lower.includes('sun') || lower.includes('clear')) return '☀️';
    if (lower.includes('fog')) return '🌫️';
    if (lower.includes('wind')) return '💨';
    return '🌤️';
  }

  /**
   * Get basic pet-focused recommendations with full multi-language support
   */
  private getBasicRecommendations(weather: WeatherData, lang: SupportedLanguage = 'en'): string[] {
    const recommendations: string[] = [];

    if (weather.temperature > 30) {
      recommendations.push(getBasicRecommendationText('coolWater', lang));
      recommendations.push(getBasicRecommendationText('avoidPeakHeat', lang));
    } else if (weather.temperature < 10) {
      recommendations.push(getBasicRecommendationText('warmWater', lang));
      recommendations.push(getBasicRecommendationText('keepIndoors', lang));
    }

    if (weather.uvIndex > 7) {
      recommendations.push(getBasicRecommendationText('sunscreen', lang));
      recommendations.push(getBasicRecommendationText('provideShade', lang));
    }

    if (weather.humidity > 80) {
      recommendations.push(getBasicRecommendationText('longerDrying', lang));
      recommendations.push(getBasicRecommendationText('heatedDryer', lang));
    }

    if (weather.precipitation > 50) {
      recommendations.push(getBasicRecommendationText('indoorFacilities', lang));
    }

    if (weather.windSpeed > 25) {
      recommendations.push(getBasicRecommendationText('heatedDryer', lang));
    }

    if (recommendations.length === 0) {
      recommendations.push(getBasicRecommendationText('monitorPets', lang));
    }

    return recommendations.slice(0, 5);
  }
}

export const smartWeatherAdvisor = new SmartWeatherAdvisorService();
