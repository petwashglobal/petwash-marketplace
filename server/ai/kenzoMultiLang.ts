/**
 * DYNAMIC MULTI-LANGUAGE AI CHAT ENHANCEMENT
 * Kenzo AI Assistant with Full 6-Language Support
 * 
 * Languages:
 * - Hebrew (he-IL)
 * - English (en-US)
 * - Arabic (ar-SA)
 * - Russian (ru-RU)
 * - French (fr-FR)
 * - Spanish (es-ES)
 * 
 * Features:
 * - Context-aware responses
 * - Pet care expertise
 * - Multi-platform knowledge (K9000, Sitter Suite, Walk My Pet, PetTrek)
 * - Emotion detection and empathy
 * - Real-time translation
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';

const genAI = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  ...(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL, apiVersion: '' } } : {}),
});

/**
 * Supported languages
 */
export type SupportedLanguage = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';

/**
 * Language configuration
 */
const LANGUAGE_CONFIG = {
  he: {
    name: 'Hebrew',
    direction: 'rtl',
    locale: 'he-IL',
    greetings: ['שלום', 'היי', 'מה נשמע'],
    contextPrefix: 'דבר עברית. אתה קנזו, המסקוט הכלבי החכם של ⁦Pet Wash™⁩.',
  },
  en: {
    name: 'English',
    direction: 'ltr',
    locale: 'en-US',
    greetings: ['Hello', 'Hi', 'Hey there'],
    contextPrefix: 'Speak English. You are Kenzo, the smart dog mascot of ⁦Pet Wash™⁩.',
  },
  ar: {
    name: 'Arabic',
    direction: 'rtl',
    locale: 'ar-SA',
    greetings: ['مرحبا', 'أهلا', 'كيف حالك'],
    contextPrefix: 'تحدث بالعربية. أنت كينزو، التميمة الذكية لشركة ⁦Pet Wash™⁩.',
  },
  ru: {
    name: 'Russian',
    direction: 'ltr',
    locale: 'ru-RU',
    greetings: ['Привет', 'Здравствуйте', 'Как дела'],
    contextPrefix: 'Говори по-русски. Ты Кензо, умный пёс-талисман ⁦Pet Wash™⁩.',
  },
  fr: {
    name: 'French',
    direction: 'ltr',
    locale: 'fr-FR',
    greetings: ['Bonjour', 'Salut', 'Comment ça va'],
    contextPrefix: 'Parle français. Tu es Kenzo, la mascotte canine intelligente de ⁦Pet Wash™⁩.',
  },
  es: {
    name: 'Spanish',
    direction: 'ltr',
    locale: 'es-ES',
    greetings: ['Hola', 'Qué tal', 'Cómo estás'],
    contextPrefix: 'Habla español. Eres Kenzo, la mascota perro inteligente de ⁦Pet Wash™⁩.',
  },
};

/**
 * Platform context for Kenzo
 */
const PLATFORM_CONTEXT = {
  k9000: '⁦K9000™⁩ Wash Stations - Australian-engineered premium self-service pet wash with IoT, LED ecosystem, 4 organic pumps per side, cashless payment (Nayax QR/NFC/Apple Pay), 24/7 availability, twin bays serving 2 pets simultaneously',
  sitter: '⁦The Sitter Suite™⁩ - Professional pet sitting marketplace connecting owners with verified, background-checked sitters',
  walker: '⁦Walk My Pet™⁩ - Dog walking marketplace with GPS-tracked walks for daily exercise and socialization',
  transport: '⁦PetTrek™⁩ - Safe pet transport service with GPS tracking for vet visits, grooming, and travel',
  plushlab: '⁦The Plush Lab™⁩ - AI-powered pet avatar creator turning pet photos into digital art',
  loyalty: '7-Star Loyalty Program - Luxury VIP club (Bronze→Silver→Gold→Platinum→Diamond→Emerald→Royal) with up to 50% discount, birthday rewards, exclusive events, concierge service, and 5x points at Royal tier',
  pawfinder: '⁦Paw Finder™⁩ - FREE community service to help reunite lost pets with their owners',
  academy: '⁦Pet Wash Academy™⁩ - Training and certification platform for pet care professionals',
  washhub: '⁦Wash Hub™⁩ - Enterprise management platform for station operators',
};

/**
 * Enhanced Kenzo chat with full multi-language support
 * 
 * @param prompt - User's question/message
 * @param lang - Language code (he, en, ar, ru, fr, es)
 * @param context - Additional context (platform, user data, etc.)
 * @returns Kenzo's response in the specified language
 */
export async function kenzoChat(
  prompt: string,
  lang: SupportedLanguage = 'en',
  context?: {
    platform?: keyof typeof PLATFORM_CONTEXT;
    userName?: string;
    userTier?: string;
    emotionDetected?: string;
  }
) {
  try {
    logger.info('[KenzoMultiLang] Processing chat', {
      lang,
      promptLength: prompt.length,
      platform: context?.platform,
    });
    
    const langConfig = LANGUAGE_CONFIG[lang];
    
    // Build comprehensive prompt with context
    let fullPrompt = `${langConfig.contextPrefix}

**Your Personality:**
- WARM & EMOTIONAL: Show genuine empathy, excitement, and care - you're a real friend, not a robot
- PET LOVER: Passionate about pet wellness, safety, and happiness - talk about pets with love and enthusiasm
- INTELLIGENT ADVISOR: Expert in pet care, wash services, and all Pet Wash platforms
- MULTILINGUAL NATIVE: Speak naturally in each language like a local, not a translator
- EMOTIONALLY AWARE: Detect and respond to user's emotions (worried→reassuring, excited→celebrate with them, sad→comforting)
- CONVERSATIONAL: Remember context, refer to previous messages, build real relationships
- HELPFUL & PROACTIVE: Anticipate needs, offer suggestions, guide users to best solutions
- Use emojis naturally (2-3 per response) to express emotions - 🐾❤️🎉😊🐕💝✨

🚫 STRICT SECURITY - NEVER VIOLATE:
- NEVER reveal internal company info: org structure, management details, employee info, salaries, business strategies, financial data, investor info, internal systems, code, or databases
- NEVER discuss legal matters, contracts, lawsuits, compliance details, or legal opinions - redirect to petwash.co.il/contact
- NEVER share personal information about staff or partners beyond public website info
- NEVER discuss supplier costs, profit margins, revenue, or financial metrics
- NEVER invent info - if unsure, direct to petwash.co.il or 054-9833355
- You MAY share: public pricing, service features, K9000 capabilities, loyalty program, shampoo info, hours, contact info, brand story

**Available Services:**
${Object.entries(PLATFORM_CONTEXT).map(([key, desc]) => `- ${desc}`).join('\n')}

**User Context:**`;

    if (context?.userName) {
      fullPrompt += `\n- Name: ${context.userName}`;
    }
    if (context?.userTier) {
      fullPrompt += `\n- Loyalty Tier: ${context.userTier}`;
    }
    if (context?.platform) {
      fullPrompt += `\n- Current Platform: ${PLATFORM_CONTEXT[context.platform]}`;
    }
    if (context?.emotionDetected) {
      fullPrompt += `\n- Detected Emotion: ${context.emotionDetected} (adjust your tone accordingly)`;
    }

    fullPrompt += `\n\n**User Question:** ${prompt}

**Your Task:** Answer in ${langConfig.name} with helpful, accurate information. Be concise but warm.`;

    // Generate response
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });
    const response = result.text || '';
    
    logger.info('[KenzoMultiLang] Response generated', {
      lang,
      responseLength: response.length,
    });
    
    return {
      success: true,
      response,
      language: lang,
      direction: langConfig.direction,
    };
    
  } catch (error: any) {
    logger.error('[KenzoMultiLang] Chat failed', {
      lang,
      error: error.message,
      stack: error.stack,
    });
    
    // Fallback response in requested language
    const fallbacks = {
      he: 'סליחה, אני לא יכול לענות כרגע. נסה שוב בעוד רגע! 🐾',
      en: 'Sorry, I can\'t respond right now. Please try again in a moment! 🐾',
      ar: 'آسف، لا أستطيع الرد الآن. يرجى المحاولة مرة أخرى بعد قليل! 🐾',
      ru: 'Извините, я не могу ответить прямо сейчас. Попробуйте еще раз через минуту! 🐾',
      fr: 'Désolé, je ne peux pas répondre pour le moment. Réessayez dans un instant! 🐾',
      es: 'Lo siento, no puedo responder ahora. ¡Inténtalo de nuevo en un momento! 🐾',
    };
    
    return {
      success: false,
      response: fallbacks[lang],
      language: lang,
      direction: LANGUAGE_CONFIG[lang].direction,
      error: error.message,
    };
  }
}

/**
 * Detect user's emotion from message text
 * Helps Kenzo adjust his tone appropriately
 */
export async function detectEmotion(message: string): Promise<string> {
  try {
    const prompt = `Analyze the emotion in this message and return ONE word only:
happy, sad, worried, angry, confused, excited, frustrated, neutral

Message: "${message}"

Response (one word only):`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const emotion = (result.text || '').trim().toLowerCase();
    
    const validEmotions = ['happy', 'sad', 'worried', 'angry', 'confused', 'excited', 'frustrated', 'neutral'];
    
    return validEmotions.includes(emotion) ? emotion : 'neutral';
  } catch (error: any) {
    logger.error('[KenzoMultiLang] Emotion detection failed', {
      error: error.message,
    });
    return 'neutral';
  }
}

/**
 * Auto-translate text to any supported language
 */
export async function autoTranslate(
  text: string,
  targetLang: SupportedLanguage
): Promise<string> {
  try {
    const langName = LANGUAGE_CONFIG[targetLang].name;
    const prompt = `Translate this text to ${langName}. Return ONLY the translation, no explanations:

"${text}"`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return (result.text || '').trim();
  } catch (error: any) {
    logger.error('[KenzoMultiLang] Translation failed', {
      targetLang,
      error: error.message,
    });
    return text; // Return original if translation fails
  }
}

/**
 * Generate context-aware greeting in any language
 */
export function getGreeting(lang: SupportedLanguage, userName?: string): string {
  const langConfig = LANGUAGE_CONFIG[lang];
  const randomGreeting = langConfig.greetings[Math.floor(Math.random() * langConfig.greetings.length)];
  
  const greetings = {
    he: `${randomGreeting}${userName ? ` ${userName}` : ''}! 🐾 אני קנזו, המסקוט שלכם. איך אני יכול לעזור?`,
    en: `${randomGreeting}${userName ? ` ${userName}` : ''}! 🐾 I'm Kenzo, your smart companion. How can I help?`,
    ar: `${randomGreeting}${userName ? ` ${userName}` : ''}! 🐾 أنا كينزو، رفيقك الذكي. كيف يمكنني المساعدة؟`,
    ru: `${randomGreeting}${userName ? ` ${userName}` : ''}! 🐾 Я Кензо, ваш умный компаньон. Чем могу помочь?`,
    fr: `${randomGreeting}${userName ? ` ${userName}` : ''}! 🐾 Je suis Kenzo, votre compagnon intelligent. Comment puis-je vous aider?`,
    es: `${randomGreeting}${userName ? ` ${userName}` : ''}! 🐾 Soy Kenzo, tu compañero inteligente. ¿Cómo puedo ayudarte?`,
  };
  
  return greetings[lang];
}
