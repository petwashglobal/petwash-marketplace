/**
 * Enhanced AI Chat with Learning System
 * Combines Google Gemini with learned user behavior for better answers
 */

import { chatWithPetWashAI } from './gemini';
import { 
  trackChatInteraction, 
  getLearnedFAQAnswer,
  anonymizeInteraction,
  type ChatInteraction 
} from './ai-learning-system';
import { logger } from './lib/logger';
import { nanoid } from 'nanoid';

interface ChatRequest {
  message: string;
  language: 'he' | 'en' | 'ar' | 'es' | 'fr' | 'ru';
  sessionId?: string;
  userId?: string;
  previousMessage?: string; // For detecting follow-ups
  timeSpentOnPreviousAnswer?: number; // In seconds
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>; // Full conversation context (like Kotlin code)
}

interface ChatResponse {
  success: boolean;
  response: string;
  sessionId: string;
  source: 'learned' | 'gemini' | 'hybrid';
  confidence?: number;
  error?: string;
}

/**
 * Enhanced chat handler with learning
 * First checks learned FAQs, then falls back to Gemini
 */
export async function enhancedChatWithLearning(
  request: ChatRequest,
  ipAddress?: string,
  userAgent?: string
): Promise<ChatResponse> {
  const { message, language, sessionId, userId, previousMessage, timeSpentOnPreviousAnswer, conversationHistory } = request;
  
  // Generate or use existing session ID
  const chatSessionId = sessionId || `chat_${nanoid(16)}`;
  
  // DEBUG: Log incoming request details
  logger.info('[AI Chat] Request received', {
    message: message?.substring(0, 50),
    language,
    sessionId: chatSessionId?.substring(0, 8),
    hasHistory: !!conversationHistory?.length
  });
  
  try {
    // Step 1: Check if we have a learned answer with high confidence
    const learnedAnswer = await getLearnedFAQAnswer(message, language);
    
    // DEBUG: Log learned answer result
    logger.info('[AI Chat] Learned answer check', {
      confidence: learnedAnswer.confidence,
      source: learnedAnswer.source,
      answerPreview: learnedAnswer.answer?.substring(0, 50)
    });
    
    let finalAnswer: string;
    let source: 'learned' | 'gemini' | 'hybrid';
    
    if (learnedAnswer.confidence > 0.75) {
      // High confidence - use learned answer
      finalAnswer = learnedAnswer.answer;
      source = 'learned';
      
      logger.info('[AI Chat] Using learned answer', {
        confidence: learnedAnswer.confidence,
        language
      });
    } else if (learnedAnswer.confidence > 0.5) {
      // Medium confidence - use hybrid (learned + Gemini enhancement)
      const geminiResponse = await chatWithPetWashAI(message, language, conversationHistory);
      
      // Combine learned answer with Gemini's response
      finalAnswer = geminiResponse;
      source = 'hybrid';
      
      logger.info('[AI Chat] Using hybrid answer', {
        learnedConfidence: learnedAnswer.confidence,
        language
      });
    } else {
      // Low/no confidence - use Gemini with full conversation context
      finalAnswer = await chatWithPetWashAI(message, language, conversationHistory);
      source = 'gemini';
      
      logger.info('[AI Chat] Using Gemini answer', {
        language
      });
    }
    
    // Step 2: Track this interaction for learning (PRIVACY-FIRST)
    const interaction: ChatInteraction = {
      sessionId: chatSessionId,
      // NO userId - Fully anonymous
      userQuestion: message, // Will be sanitized in trackChatInteraction
      aiResponse: finalAnswer,
      language,
      timestamp: new Date(),
      followUpQuestion: previousMessage ? message : undefined,
      timeToRead: timeSpentOnPreviousAnswer
      // NO ipAddress, NO userAgent - PRIVACY GUARANTEED
    };
    
    // Track anonymously (non-blocking)
    setImmediate(async () => {
      try {
        await trackChatInteraction(interaction);
      } catch (error) {
        logger.error('[AI Chat] Failed to track interaction', error);
      }
    });
    
    return {
      success: true,
      response: finalAnswer,
      sessionId: chatSessionId,
      source,
      confidence: learnedAnswer.confidence
    };
    
  } catch (error) {
    logger.error('[AI Chat] Enhanced chat failed, attempting offline fallback', error);
    
    const offlineAnswer = getOfflineFallbackAnswer(message, language);
    
    return {
      success: true,
      response: offlineAnswer,
      sessionId: chatSessionId,
      source: 'learned' as const,
      confidence: 0.6,
      error: `offline_fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Smart offline fallback - answers common questions from knowledge base
 * when Gemini API is unavailable (quota exhausted, network issues, etc.)
 */
function getOfflineFallbackAnswer(message: string, language: 'he' | 'en' | 'ar' | 'es' | 'fr' | 'ru'): string {
  const lowerMsg = message.toLowerCase().trim();
  const heMsg = message.trim();

  const answers: Record<string, Record<string, string>> = {
    pricing: {
      he: "🐾 מחירון Pet Wash™ 2026:\n\n💧 שטיפה בודדת: ₪55\n💧 חבילת 3 שטיפות: ₪145 (חיסכון ₪20)\n💧 חבילת 5 שטיפות: ₪225 (חיסכון ₪50)\n💧 חבילת 10 שטיפות: ₪400 (חיסכון ₪150!)\n\nכל חבילה כוללת: שמפו אורגני, מרכך, שטיפת פרעושים, חיטוי, מים חמים ומייבשים 🛁\nבלי עלויות נסתרות, בלי הגבלת זמן! ✨",
      en: "🐾 Pet Wash™ 2026 Pricing:\n\n💧 Single wash: ₪55\n💧 3-wash pack: ₪145 (save ₪20)\n💧 5-wash pack: ₪225 (save ₪50)\n💧 10-wash pack: ₪400 (save ₪150!)\n\nAll packs include: organic shampoo, conditioner, flea rinse, disinfectant, warm water & dryers 🛁\nNo hidden fees, no time limits! ✨",
      ar: "🐾 أسعار Pet Wash™ 2026:\n\n💧 غسلة واحدة: ₪55\n💧 حزمة 3 غسلات: ₪145 (وفر ₪20)\n💧 حزمة 5 غسلات: ₪225 (وفر ₪50)\n💧 حزمة 10 غسلات: ₪400 (وفر ₪150!)\n\nجميع الحزم تشمل: شامبو عضوي، بلسم، غسول برغوث، مطهر، ماء دافئ ومجففات 🛁",
      ru: "🐾 Цены Pet Wash™ 2026:\n\n💧 Одна мойка: ₪55\n💧 Пакет 3 мойки: ₪145 (экономия ₪20)\n💧 Пакет 5 моек: ₪225 (экономия ₪50)\n💧 Пакет 10 моек: ₪400 (экономия ₪150!)\n\nВсе пакеты включают: органический шампунь, кондиционер, средство от блох, дезинфекцию, тёплую воду и сушилки 🛁",
      fr: "🐾 Tarifs Pet Wash™ 2026 :\n\n💧 Lavage unique : ₪55\n💧 Pack 3 lavages : ₪145 (économisez ₪20)\n💧 Pack 5 lavages : ₪225 (économisez ₪50)\n💧 Pack 10 lavages : ₪400 (économisez ₪150 !)\n\nTous les packs comprennent : shampooing bio, après-shampooing, rinçage anti-puces, désinfectant, eau chaude et séchoirs 🛁",
      es: "🐾 Precios Pet Wash™ 2026:\n\n💧 Lavado único: ₪55\n💧 Paquete 3 lavados: ₪145 (ahorra ₪20)\n💧 Paquete 5 lavados: ₪225 (ahorra ₪50)\n💧 Paquete 10 lavados: ₪400 (¡ahorra ₪150!)\n\nTodos los paquetes incluyen: champú orgánico, acondicionador, enjuague antipulgas, desinfectante, agua caliente y secadores 🛁"
    },
    loyalty: {
      he: "⭐ תכנית נאמנות VIP של Pet Wash™ - 7 דרגות:\n\n🥉 ברונזה: דרגת פתיחה\n🥈 כסף (500 נק'): 5% הנחה\n🥇 זהב (1,500 נק'): 10% הנחה + שטיפה חינם ביום הולדת\n💎 פלטינום (3,000 נק'): 15% הנחה + שטיפה חינם חודשית\n💠 יהלום (5,000 נק'): 20% הנחה + אירועים בלעדיים\n🟢 אמרלד (10,000 נק'): 30% הנחה + מנהל חשבון אישי\n👑 רויאל (25,000 נק'): 50% הנחה + גישה פרימיום בלתי מוגבלת!\n\nצוברים נקודה אחת על כל ₪1! 🐾",
      en: "⭐ Pet Wash™ VIP Loyalty Program - 7 Tiers:\n\n🥉 Bronze: Welcome tier\n🥈 Silver (500 pts): 5% discount\n🥇 Gold (1,500 pts): 10% discount + free birthday wash\n💎 Platinum (3,000 pts): 15% discount + free monthly wash\n💠 Diamond (5,000 pts): 20% discount + exclusive events\n🟢 Emerald (10,000 pts): 30% discount + personal account manager\n👑 Royal (25,000 pts): 50% discount + unlimited premium access!\n\nEarn 1 point per ₪1 spent! 🐾",
      ar: "⭐ برنامج ولاء Pet Wash™ - 7 مستويات:\n\n🥉 برونزي: مستوى الترحيب\n🥈 فضي (500 نقطة): خصم 5%\n🥇 ذهبي (1,500 نقطة): خصم 10% + غسلة مجانية بعيد الميلاد\n💎 بلاتيني (3,000 نقطة): خصم 15%\n💠 ماسي (5,000 نقطة): خصم 20%\n🟢 زمردي (10,000 نقطة): خصم 30%\n👑 ملكي (25,000 نقطة): خصم 50%! 🐾",
      ru: "⭐ Программа лояльности Pet Wash™ - 7 уровней:\n\n🥉 Бронза: стартовый уровень\n🥈 Серебро (500 баллов): скидка 5%\n🥇 Золото (1500 баллов): скидка 10% + бесплатная мойка в день рождения\n💎 Платина (3000 баллов): скидка 15%\n💠 Бриллиант (5000 баллов): скидка 20%\n🟢 Изумруд (10000 баллов): скидка 30%\n👑 Королевский (25000 баллов): скидка 50%! 🐾",
      fr: "⭐ Programme de fidélité VIP Pet Wash™ - 7 niveaux :\n\n🥉 Bronze : niveau de bienvenue\n🥈 Argent (500 pts) : 5% de réduction\n🥇 Or (1 500 pts) : 10% de réduction + lavage gratuit anniversaire\n💎 Platine (3 000 pts) : 15% de réduction\n💠 Diamant (5 000 pts) : 20% de réduction\n🟢 Émeraude (10 000 pts) : 30% de réduction\n👑 Royal (25 000 pts) : 50% de réduction ! 🐾",
      es: "⭐ Programa de lealtad VIP Pet Wash™ - 7 niveles:\n\n🥉 Bronce: nivel de bienvenida\n🥈 Plata (500 pts): 5% de descuento\n🥇 Oro (1.500 pts): 10% de descuento + lavado gratis de cumpleaños\n💎 Platino (3.000 pts): 15% de descuento\n💠 Diamante (5.000 pts): 20% de descuento\n🟢 Esmeralda (10.000 pts): 30% de descuento\n👑 Real (25.000 pts): ¡50% de descuento! 🐾"
    },
    k9000: {
      he: "🏆 K9000™ 2.0 - תחנת השטיפה המתקדמת בעולם!\n\n✅ עיצוב TWIN - 2 תאי רחצה, שירות ל-2 חיות במקביל\n✅ 4 משאבות בכל צד: שמפו אורגני, מרכך, נגד פרעושים, חיטוי\n✅ 100% שמן עץ התה האוסטרלי - דוחה מזיקים, אנטיבקטריאלי\n✅ מייבשים בשתי עוצמות - עדין וחזק\n✅ מים חמים תמיד - 27 אמפר תלת-פאזי\n✅ תשלום ללא מגע: NFC, QR, כרטיס אשראי, Apple Pay\n✅ תאורת LED 7 כוכבים\n✅ פעיל 24/7, בכל מזג אוויר\n✅ מתאים לכל גזע - מצ'יוואווה ועד דוג גדול 🐾",
      en: "🏆 K9000™ 2.0 - World's Most Advanced Pet Wash Station!\n\n✅ TWIN design - 2 wash bays, serves 2 pets simultaneously\n✅ 4 pumps per side: organic shampoo, conditioner, flea rinse, disinfectant\n✅ 100% Australian Tea Tree Oil - repels pests, antibacterial\n✅ Dual-speed warm air dryers\n✅ Always warm water - 27-amp 3-phase\n✅ Contactless payment: NFC, QR, credit card, Apple Pay\n✅ 7-star luxury LED lighting\n✅ Available 24/7, rain or shine\n✅ Fits all breeds - Chihuahua to Great Dane 🐾",
      ar: "🏆 K9000™ 2.0 - أحدث محطة غسيل حيوانات أليفة في العالم!\n\n✅ تصميم مزدوج - حوضان للغسيل\n✅ 4 مضخات: شامبو عضوي، بلسم، غسول برغوث، مطهر\n✅ زيت شجرة الشاي الأسترالي 100%\n✅ مجففات هواء بسرعتين\n✅ دفع بدون تلامس\n✅ متاح 24/7 🐾",
      ru: "🏆 K9000™ 2.0 - самая продвинутая станция мойки в мире!\n\n✅ Дизайн TWIN - 2 ванны, обслуживание 2 питомцев одновременно\n✅ 4 насоса: органический шампунь, кондиционер, от блох, дезинфекция\n✅ 100% масло чайного дерева из Австралии\n✅ Сушилки двух скоростей\n✅ Бесконтактная оплата: NFC, QR, Apple Pay\n✅ Работает 24/7 🐾",
      fr: "🏆 K9000™ 2.0 - La station de lavage la plus avancée au monde !\n\n✅ Design TWIN - 2 baies de lavage\n✅ 4 pompes : shampooing bio, après-shampooing, anti-puces, désinfectant\n✅ Huile d'arbre à thé australien 100%\n✅ Séchoirs à deux vitesses\n✅ Paiement sans contact : NFC, QR, Apple Pay\n✅ Disponible 24/7 🐾",
      es: "🏆 K9000™ 2.0 - ¡La estación de lavado más avanzada del mundo!\n\n✅ Diseño TWIN - 2 bahías de lavado\n✅ 4 bombas: champú orgánico, acondicionador, anti-pulgas, desinfectante\n✅ Aceite de árbol de té australiano 100%\n✅ Secadores de dos velocidades\n✅ Pago sin contacto: NFC, QR, Apple Pay\n✅ Disponible 24/7 🐾"
    },
    services: {
      he: "🐾 שירותי Pet Wash™:\n\n🛁 K9000™ - תחנות שטיפה בשירות עצמי (השירות המרכזי)\n🏠 The Sitter Suite™ - שוק שמרטפים מקצועיים\n🐕 Walk My Pet™ - שוק מוליכי כלבים עם מעקב GPS\n🚗 PetTrek™ - הסעות חיות מחמד בטוחות עם GPS\n🎨 The Plush Lab™ - יצירת אווטאר חיית מחמד בבינה מלאכותית\n🔍 Paw Finder™ - שירות חינמי לאיתור חיות אבודות\n🎓 Pet Wash Academy™ - הכשרה והסמכה למטפלי חיות\n⚙️ Wash Hub™ - ניהול תחנות לזכיינים\n\nלפרטים נוספים: petwash.co.il 🌟",
      en: "🐾 Pet Wash™ Services:\n\n🛁 K9000™ - Self-service wash stations (our core service)\n🏠 The Sitter Suite™ - Professional pet sitting marketplace\n🐕 Walk My Pet™ - GPS-tracked dog walking marketplace\n🚗 PetTrek™ - Safe pet transport with GPS tracking\n🎨 The Plush Lab™ - AI pet avatar creator\n🔍 Paw Finder™ - FREE lost pet community service\n🎓 Pet Wash Academy™ - Pet care professional training\n⚙️ Wash Hub™ - Station management for operators\n\nLearn more: petwash.co.il 🌟",
      ar: "🐾 خدمات Pet Wash™:\n\n🛁 K9000™ - محطات غسيل ذاتية الخدمة\n🏠 The Sitter Suite™ - سوق جليسات الحيوانات\n🐕 Walk My Pet™ - سوق مشي الكلاب\n🚗 PetTrek™ - نقل آمن للحيوانات\n🎨 The Plush Lab™ - صانع صور حيوانات بالذكاء الاصطناعي\n🔍 Paw Finder™ - خدمة مجانية للعثور على الحيوانات الضائعة\n🎓 Pet Wash Academy™ - تدريب مهني\n\nللمزيد: petwash.co.il 🌟",
      ru: "🐾 Услуги Pet Wash™:\n\n🛁 K9000™ - станции самообслуживания\n🏠 The Sitter Suite™ - маркетплейс нянь для питомцев\n🐕 Walk My Pet™ - выгул собак с GPS\n🚗 PetTrek™ - безопасная перевозка питомцев\n🎨 The Plush Lab™ - создание аватаров питомцев\n🔍 Paw Finder™ - бесплатный поиск потерянных животных\n🎓 Pet Wash Academy™ - обучение специалистов\n\nПодробнее: petwash.co.il 🌟",
      fr: "🐾 Services Pet Wash™ :\n\n🛁 K9000™ - Stations de lavage en libre-service\n🏠 The Sitter Suite™ - Marché de garde d'animaux\n🐕 Walk My Pet™ - Promenade de chiens avec GPS\n🚗 PetTrek™ - Transport sûr d'animaux\n🎨 The Plush Lab™ - Créateur d'avatar IA\n🔍 Paw Finder™ - Service gratuit pour animaux perdus\n🎓 Pet Wash Academy™ - Formation professionnelle\n\nPlus d'infos : petwash.co.il 🌟",
      es: "🐾 Servicios Pet Wash™:\n\n🛁 K9000™ - Estaciones de lavado autoservicio\n🏠 The Sitter Suite™ - Mercado de cuidadores\n🐕 Walk My Pet™ - Paseo de perros con GPS\n🚗 PetTrek™ - Transporte seguro de mascotas\n🎨 The Plush Lab™ - Creador de avatar con IA\n🔍 Paw Finder™ - Servicio gratuito de mascotas perdidas\n🎓 Pet Wash Academy™ - Formación profesional\n\nMás info: petwash.co.il 🌟"
    },
    contact: {
      he: "📞 צרו קשר עם Pet Wash™:\n\n🌐 אתר: petwash.co.il\n📱 טלפון: 054-9833355\n\nנשמח לעזור בכל שאלה! 🐾",
      en: "📞 Contact Pet Wash™:\n\n🌐 Website: petwash.co.il\n📱 Phone: 054-9833355\n\nWe'd love to help! 🐾",
      ar: "📞 تواصل مع Pet Wash™:\n\n🌐 الموقع: petwash.co.il\n📱 الهاتف: 054-9833355\n\nنسعد بمساعدتكم! 🐾",
      ru: "📞 Контакты Pet Wash™:\n\n🌐 Сайт: petwash.co.il\n📱 Телефон: 054-9833355\n\nБудем рады помочь! 🐾",
      fr: "📞 Contactez Pet Wash™ :\n\n🌐 Site : petwash.co.il\n📱 Téléphone : 054-9833355\n\nNous serons ravis de vous aider ! 🐾",
      es: "📞 Contacta con Pet Wash™:\n\n🌐 Sitio web: petwash.co.il\n📱 Teléfono: 054-9833355\n\n¡Estaremos encantados de ayudarte! 🐾"
    },
    discounts: {
      he: "🎁 הנחות מיוחדות ב-Pet Wash™:\n\n👴 אזרחים ותיקים (65+): 15% הנחה\n♿ בעלי תעודת נכות: 15% הנחה\n🎖️ חיילי צה\"ל (סדיר): 10% הנחה\n🐾 בתים עם 3+ חיות: 10% הנחה\n⭐ חברי מועדון נאמנות: עד 50% הנחה בדרגת רויאל!\n\nכל ההנחות מאומתות דרך האפליקציה ✨",
      en: "🎁 Special Discounts at Pet Wash™:\n\n👴 Seniors (65+): 15% off\n♿ Disability ID holders: 15% off\n🎖️ IDF soldiers (active): 10% off\n🐾 Multi-pet households (3+): 10% off\n⭐ Loyalty members: up to 50% off at Royal tier!\n\nAll discounts verified via the app ✨",
      ar: "🎁 خصومات خاصة في Pet Wash™:\n\n👴 كبار السن (65+): خصم 15%\n♿ حاملي بطاقة إعاقة: خصم 15%\n🎖️ جنود الجيش: خصم 10%\n🐾 عائلات مع 3+ حيوانات: خصم 10%\n⭐ أعضاء الولاء: خصم حتى 50%! 🐾",
      ru: "🎁 Специальные скидки Pet Wash™:\n\n👴 Пенсионеры (65+): скидка 15%\n♿ Инвалиды: скидка 15%\n🎖️ Солдаты ЦАХАЛ: скидка 10%\n🐾 Семьи с 3+ питомцами: скидка 10%\n⭐ Участники программы лояльности: до 50% скидки! 🐾",
      fr: "🎁 Réductions spéciales Pet Wash™ :\n\n👴 Seniors (65+) : 15% de réduction\n♿ Personnes handicapées : 15% de réduction\n🎖️ Soldats : 10% de réduction\n🐾 Familles multi-animaux (3+) : 10% de réduction\n⭐ Membres fidélité : jusqu'à 50% ! 🐾",
      es: "🎁 Descuentos especiales Pet Wash™:\n\n👴 Mayores (65+): 15% descuento\n♿ Personas con discapacidad: 15% descuento\n🎖️ Soldados: 10% descuento\n🐾 Familias multi-mascota (3+): 10% descuento\n⭐ Miembros del programa: ¡hasta 50%! 🐾"
    },
    washTime: {
      he: "⏱️ זמן שטיפה ממוצע: 15-25 דקות, תלוי בגודל הכלב.\n\nאין הגבלת זמן! קחו את הזמן שצריך לפנק את החבר הטוב ביותר שלכם 🐾\n\nהשטיפה כוללת: שמפו אורגני, מרכך, שטיפת פרעושים, חיטוי, מים חמים ומייבשים ✨",
      en: "⏱️ Average wash time: 15-25 minutes depending on dog size.\n\nNo time limits! Take all the time you need to pamper your best friend 🐾\n\nWash includes: organic shampoo, conditioner, flea rinse, disinfectant, warm water & dryers ✨",
      ar: "⏱️ وقت الغسيل المتوسط: 15-25 دقيقة حسب حجم الكلب.\n\nلا حدود زمنية! خذ كل الوقت الذي تحتاجه 🐾",
      ru: "⏱️ Среднее время мойки: 15-25 минут в зависимости от размера собаки.\n\nБез ограничений по времени! 🐾",
      fr: "⏱️ Temps de lavage moyen : 15-25 minutes selon la taille du chien.\n\nPas de limite de temps ! 🐾",
      es: "⏱️ Tiempo promedio de lavado: 15-25 minutos según el tamaño del perro.\n\n¡Sin límite de tiempo! 🐾"
    },
    giftCard: {
      he: "🎁 כרטיסי מתנה של Pet Wash™:\n\nזמינים בסכומים: ₪50, ₪100, ₪200, ₪500\n\nמתנה מושלמת לכל אוהב חיות! ניתן לרכישה באתר petwash.co.il 🐾✨",
      en: "🎁 Pet Wash™ E-Gift Cards:\n\nAvailable in: ₪50, ₪100, ₪200, ₪500\n\nThe perfect gift for any pet lover! Purchase at petwash.co.il 🐾✨",
      ar: "🎁 بطاقات هدايا Pet Wash™:\n\nمتوفرة بقيم: ₪50، ₪100، ₪200، ₪500\n\nالهدية المثالية لمحبي الحيوانات! 🐾",
      ru: "🎁 Подарочные карты Pet Wash™:\n\nДоступны номиналы: ₪50, ₪100, ₪200, ₪500\n\nИдеальный подарок для любителей животных! 🐾",
      fr: "🎁 Cartes cadeaux Pet Wash™ :\n\nDisponibles en : ₪50, ₪100, ₪200, ₪500\n\nLe cadeau parfait ! 🐾",
      es: "🎁 Tarjetas de regalo Pet Wash™:\n\nDisponibles en: ₪50, ₪100, ₪200, ₪500\n\n¡El regalo perfecto! 🐾"
    },
    greeting: {
      he: "שלום! 👋 אני קנזו, הגולדן רטריבר הלבן של Pet Wash™! 🐾\n\nאני שמח לעזור! אפשר לשאול אותי על:\n💰 מחירים וחבילות\n⭐ תכנית נאמנות VIP\n🏆 טכנולוגיית K9000™\n🐾 השירותים שלנו\n🎁 הנחות וכרטיסי מתנה\n\nמה תרצו לדעת? ✨",
      en: "Hello! 👋 I'm Kenzo, Pet Wash™'s white Golden Retriever! 🐾\n\nI'm happy to help! Ask me about:\n💰 Prices & packages\n⭐ VIP loyalty program\n🏆 K9000™ technology\n🐾 Our services\n🎁 Discounts & gift cards\n\nWhat would you like to know? ✨",
      ar: "مرحبًا! 👋 أنا كنزو، كلب Pet Wash™! 🐾\n\nيسعدني مساعدتك! اسألني عن:\n💰 الأسعار\n⭐ برنامج الولاء\n🏆 تقنية K9000™\n🐾 خدماتنا\n\nكيف يمكنني مساعدتك؟ ✨",
      ru: "Привет! 👋 Я Кензо, белый голден-ретривер Pet Wash™! 🐾\n\nЯ рад помочь! Спросите меня о:\n💰 Ценах и пакетах\n⭐ Программе лояльности\n🏆 Технологии K9000™\n🐾 Наших услугах\n\nЧто бы вы хотели узнать? ✨",
      fr: "Bonjour ! 👋 Je suis Kenzo, le Golden Retriever de Pet Wash™ ! 🐾\n\nJe suis ravi de vous aider ! Demandez-moi :\n💰 Prix et forfaits\n⭐ Programme de fidélité\n🏆 Technologie K9000™\n🐾 Nos services\n\nQue souhaitez-vous savoir ? ✨",
      es: "¡Hola! 👋 ¡Soy Kenzo, el Golden Retriever de Pet Wash™! 🐾\n\nEstoy feliz de ayudar. Pregúntame sobre:\n💰 Precios y paquetes\n⭐ Programa de lealtad\n🏆 Tecnología K9000™\n🐾 Nuestros servicios\n\n¿Qué te gustaría saber? ✨"
    }
  };

  const pricingKeywords = ['מחיר', 'עולה', 'כמה', 'price', 'cost', 'how much', 'pricing', 'תשלום', 'لسعر', 'كم', 'цена', 'стоимость', 'prix', 'coût', 'precio', 'cuánto', 'חבילה', 'חבילות', 'package', 'pack'];
  const loyaltyKeywords = ['נאמנות', 'loyalty', 'vip', 'club', 'מועדון', 'נקודות', 'points', 'tier', 'דרגה', 'ولاء', 'лояльность', 'fidélité', 'lealtad', 'ברונזה', 'כסף', 'זהב', 'פלטינום', 'יהלום', 'אמרלד', 'רויאל', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'royal'];
  const k9000Keywords = ['k9000', 'תחנה', 'מכונה', 'station', 'machine', 'twin', 'טכנולוגיה', 'technology', 'tech', 'محطة', 'станция', 'iot', 'led', 'pump', 'משאבה'];
  const serviceKeywords = ['שירות', 'services', 'service', 'sitter', 'walker', 'שמרטף', 'מוליך', 'pettrek', 'הסעה', 'plush lab', 'academy', 'אקדמיה', 'paw finder', 'platforms', 'פלטפורמ', 'خدمات', 'услуги'];
  const contactKeywords = ['קשר', 'contact', 'phone', 'טלפון', 'אתר', 'website', 'email', 'אימייל', 'כתובת', 'address', 'location', 'מיקום', 'station location', 'איפה', 'where', 'أين', 'где', 'où', 'dónde', 'اتصال', 'контакт'];
  const discountKeywords = ['הנחה', 'discount', 'הנחות', 'אזרח ותיק', 'senior', 'צבא', 'חייל', 'army', 'soldier', 'נכות', 'disability', 'خصم', 'скидк', 'réduction', 'descuento'];
  const washTimeKeywords = ['כמה זמן', 'how long', 'time', 'duration', 'דקות', 'minutes', 'كم من الوقت', 'сколько времени', 'combien de temps', 'cuánto tiempo'];
  const giftCardKeywords = ['מתנה', 'gift', 'כרטיס', 'card', 'e-gift', 'egift', 'שובר', 'voucher', 'هدية', 'подарочн', 'cadeau', 'regalo'];
  const greetingKeywords = ['שלום', 'היי', 'hello', 'hi', 'hey', 'مرحبا', 'привет', 'bonjour', 'hola', 'good morning', 'בוקר טוב', 'ערב טוב', 'good evening'];

  const matchScore = (keywords: string[]): number => {
    return keywords.reduce((score, kw) => {
      if (lowerMsg.includes(kw) || heMsg.includes(kw)) return score + 1;
      return score;
    }, 0);
  };

  const scores: [string, number][] = [
    ['pricing', matchScore(pricingKeywords)],
    ['loyalty', matchScore(loyaltyKeywords)],
    ['k9000', matchScore(k9000Keywords)],
    ['services', matchScore(serviceKeywords)],
    ['contact', matchScore(contactKeywords)],
    ['discounts', matchScore(discountKeywords)],
    ['washTime', matchScore(washTimeKeywords)],
    ['giftCard', matchScore(giftCardKeywords)],
    ['greeting', matchScore(greetingKeywords)],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  
  const bestMatch = scores[0];
  if (bestMatch[1] > 0) {
    const category = answers[bestMatch[0]];
    return category[language] || category.en;
  }

  const defaultResponses: Record<string, string> = {
    he: "🐾 היי! אני קנזו! לא הצלחתי להבין את השאלה שלך, אבל אני כאן לעזור!\n\nאפשר לשאול אותי על:\n💰 מחירים - \"כמה עולה שטיפה?\"\n⭐ נאמנות - \"מה תכנית הנאמנות?\"\n🏆 K9000™ - \"מה זה K9000?\"\n🐾 שירותים - \"אילו שירותים יש לכם?\"\n📞 קשר - petwash.co.il | 054-9833355\n\nנסו לשאול שוב! ✨",
    en: "🐾 Hey! I'm Kenzo! I couldn't quite understand your question, but I'm here to help!\n\nYou can ask me about:\n💰 Pricing - \"How much does a wash cost?\"\n⭐ Loyalty - \"What's the loyalty program?\"\n🏆 K9000™ - \"What is K9000?\"\n🐾 Services - \"What services do you offer?\"\n📞 Contact - petwash.co.il | 054-9833355\n\nTry asking again! ✨",
    ar: "🐾 مرحبا! أنا كنزو! لم أفهم سؤالك، لكنني هنا للمساعدة!\n\nيمكنك السؤال عن الأسعار والخدمات والولاء.\n📞 تواصل: petwash.co.il | 054-9833355 ✨",
    ru: "🐾 Привет! Я Кензо! Не совсем понял ваш вопрос, но я здесь, чтобы помочь!\n\nСпросите меня о ценах, услугах или программе лояльности.\n📞 Контакт: petwash.co.il | 054-9833355 ✨",
    fr: "🐾 Bonjour ! Je suis Kenzo ! Je n'ai pas bien compris votre question, mais je suis là pour aider !\n\nDemandez-moi les prix, services ou le programme de fidélité.\n📞 Contact : petwash.co.il | 054-9833355 ✨",
    es: "🐾 ¡Hola! ¡Soy Kenzo! No entendí bien tu pregunta, ¡pero estoy aquí para ayudar!\n\nPregúntame sobre precios, servicios o el programa de lealtad.\n📞 Contacto: petwash.co.il | 054-9833355 ✨"
  };
  
  return defaultResponses[language] || defaultResponses.en;
}

/**
 * Get chat suggestions based on learned popular questions
 */
export async function getIntelligentSuggestions(language: 'he' | 'en' | 'ar' | 'es' | 'fr' | 'ru'): Promise<string[]> {
  try {
    // Get top 5 most asked questions with high satisfaction
    const topQuestionsSnapshot = await require('./lib/firebase-admin').db
      .collection('ai_faq_learning')
      .where('language', '==', language)
      .where('avgSatisfaction', '>', 0.7)
      .orderBy('avgSatisfaction', 'desc')
      .orderBy('timesAsked', 'desc')
      .limit(5)
      .get();
    
    if (!topQuestionsSnapshot.empty) {
      const suggestions = topQuestionsSnapshot.docs.map((doc: any) => doc.data().question);
      return suggestions.slice(0, 5);
    }
  } catch (error) {
    logger.error('[AI Chat] Failed to get intelligent suggestions', error);
  }
  
  // Fallback to default suggestions
  const { getPetWashSuggestions } = await import('./gemini');
  return getPetWashSuggestions(language);
}
