/**
 * Weather Planner Translation System
 * 
 * Provides translations for weather conditions, recommendations, and UI text
 * across all 6 languages: English, Hebrew, Arabic, Russian, French, Spanish
 */

export type SupportedLanguage = 'en' | 'he' | 'ar' | 'ru' | 'fr' | 'es';

// Weather Condition Translations
export const weatherConditions: Record<string, Record<SupportedLanguage, string>> = {
  'Clear': {
    en: 'Clear',
    he: 'בהיר',
    ar: 'صافي',
    ru: 'Ясно',
    fr: 'Clair',
    es: 'Despejado'
  },
  'Mainly Clear': {
    en: 'Mainly Clear',
    he: 'בהיר בעיקר',
    ar: 'صافي في الغالب',
    ru: 'В основном ясно',
    fr: 'Principalement clair',
    es: 'Principalmente despejado'
  },
  'Partly Cloudy': {
    en: 'Partly Cloudy',
    he: 'מעונן חלקית',
    ar: 'غائم جزئيًا',
    ru: 'Переменная облачность',
    fr: 'Partiellement nuageux',
    es: 'Parcialmente nublado'
  },
  'Overcast': {
    en: 'Overcast',
    he: 'מעונן',
    ar: 'غائم',
    ru: 'Пасмурно',
    fr: 'Nuageux',
    es: 'Nublado'
  },
  'Foggy': {
    en: 'Foggy',
    he: 'ערפילי',
    ar: 'ضبابي',
    ru: 'Туман',
    fr: 'Brumeux',
    es: 'Neblinoso'
  },
  'Light Drizzle': {
    en: 'Light Drizzle',
    he: 'טפטוף קל',
    ar: 'رذاذ خفيف',
    ru: 'Легкая морось',
    fr: 'Bruine légère',
    es: 'Llovizna ligera'
  },
  'Moderate Drizzle': {
    en: 'Moderate Drizzle',
    he: 'טפטוף בינוני',
    ar: 'رذاذ معتدل',
    ru: 'Умеренная морось',
    fr: 'Bruine modérée',
    es: 'Llovizna moderada'
  },
  'Dense Drizzle': {
    en: 'Dense Drizzle',
    he: 'טפטוף כבד',
    ar: 'رذاذ كثيف',
    ru: 'Сильная морось',
    fr: 'Bruine dense',
    es: 'Llovizna densa'
  },
  'Light Rain': {
    en: 'Light Rain',
    he: 'גשם קל',
    ar: 'مطر خفيف',
    ru: 'Легкий дождь',
    fr: 'Pluie légère',
    es: 'Lluvia ligera'
  },
  'Moderate Rain': {
    en: 'Moderate Rain',
    he: 'גשם בינוני',
    ar: 'مطر معتدل',
    ru: 'Умеренный дождь',
    fr: 'Pluie modérée',
    es: 'Lluvia moderada'
  },
  'Heavy Rain': {
    en: 'Heavy Rain',
    he: 'גשם כבד',
    ar: 'مطر غزير',
    ru: 'Сильный дождь',
    fr: 'Pluie forte',
    es: 'Lluvia intensa'
  },
  'Light Snow': {
    en: 'Light Snow',
    he: 'שלג קל',
    ar: 'ثلج خفيف',
    ru: 'Легкий снег',
    fr: 'Neige légère',
    es: 'Nieve ligera'
  },
  'Moderate Snow': {
    en: 'Moderate Snow',
    he: 'שלג בינוני',
    ar: 'ثلج معتدل',
    ru: 'Умеренный снег',
    fr: 'Neige modérée',
    es: 'Nieve moderada'
  },
  'Heavy Snow': {
    en: 'Heavy Snow',
    he: 'שלג כבד',
    ar: 'ثلج كثيف',
    ru: 'Сильный снег',
    fr: 'Neige forte',
    es: 'Nieve intensa'
  },
  'Light Showers': {
    en: 'Light Showers',
    he: 'ממטרים קלים',
    ar: 'زخات خفيفة',
    ru: 'Легкие ливни',
    fr: 'Averses légères',
    es: 'Chubascos ligeros'
  },
  'Moderate Showers': {
    en: 'Moderate Showers',
    he: 'ממטרים בינוניים',
    ar: 'زخات معتدلة',
    ru: 'Умеренные ливни',
    fr: 'Averses modérées',
    es: 'Chubascos moderados'
  },
  'Violent Showers': {
    en: 'Violent Showers',
    he: 'ממטרים עזים',
    ar: 'زخات عنيفة',
    ru: 'Сильные ливни',
    fr: 'Averses violentes',
    es: 'Chubascos violentos'
  },
  'Thunderstorm': {
    en: 'Thunderstorm',
    he: 'סופת רעמים',
    ar: 'عاصفة رعدية',
    ru: 'Гроза',
    fr: 'Orage',
    es: 'Tormenta eléctrica'
  },
  'Thunderstorm with Hail': {
    en: 'Thunderstorm with Hail',
    he: 'סופת רעמים עם ברד',
    ar: 'عاصفة رعدية مع برد',
    ru: 'Гроза с градом',
    fr: 'Orage avec grêle',
    es: 'Tormenta con granizo'
  },
  'Unknown': {
    en: 'Unknown',
    he: 'לא ידוע',
    ar: 'غير معروف',
    ru: 'Неизвестно',
    fr: 'Inconnu',
    es: 'Desconocido'
  }
};

// Wash Day Recommendation Translations
export const recommendations = {
  excellent: {
    title: {
      en: 'Perfect Wash Day',
      he: 'יום רחצה מושלם',
      ar: 'يوم غسيل مثالي',
      ru: 'Идеальный день для мытья',
      fr: 'Journée de lavage parfaite',
      es: 'Día de lavado perfecto'
    },
    message: {
      en: 'Ideal conditions for a premium pet wash experience',
      he: 'תנאים אידיאליים לחוויית רחצת חיות מחמד מובילה',
      ar: 'ظروف مثالية لتجربة غسيل حيوانات أليفة ممتازة',
      ru: 'Идеальные условия для премиальной мойки питомцев',
      fr: 'Conditions idéales pour un lavage premium',
      es: 'Condiciones ideales para un lavado premium'
    },
    action: {
      en: 'Book your luxury wash session now',
      he: 'הזמינו עכשיו את מפגש הרחצה המפנק שלכם',
      ar: 'احجز جلسة الغسيل الفاخرة الآن',
      ru: 'Забронируйте роскошную мойку сейчас',
      fr: 'Réservez votre session de lavage luxueuse maintenant',
      es: 'Reserve su sesión de lavado de lujo ahora'
    }
  },
  good: {
    title: {
      en: 'Good Wash Day',
      he: 'יום רחצה טוב',
      ar: 'يوم غسيل جيد',
      ru: 'Хороший день для мытья',
      fr: 'Bonne journée de lavage',
      es: 'Buen día de lavado'
    },
    message: {
      en: 'Favorable conditions for pet washing',
      he: 'תנאים נוחים לרחצת חיות מחמד',
      ar: 'ظروف مواتية لغسيل الحيوانات الأليفة',
      ru: 'Благоприятные условия для мытья питомцев',
      fr: 'Conditions favorables pour le lavage',
      es: 'Condiciones favorables para el lavado'
    },
    action: {
      en: 'Great day for a wash appointment',
      he: 'יום מעולה לתור רחצה',
      ar: 'يوم رائع لموعد الغسيل',
      ru: 'Отличный день для записи на мойку',
      fr: 'Excellent jour pour un rendez-vous de lavage',
      es: 'Excelente día para una cita de lavado'
    }
  },
  moderate: {
    title: {
      en: 'Moderate Conditions',
      he: 'תנאים בינוניים',
      ar: 'ظروف معتدلة',
      ru: 'Умеренные условия',
      fr: 'Conditions modérées',
      es: 'Condiciones moderadas'
    },
    message: {
      en: 'Consider indoor drying or heated facilities',
      he: 'שקלו ייבוש פנימי או מתקנים מחוממים',
      ar: 'فكر في التجفيف الداخلي أو المرافق المدفأة',
      ru: 'Рассмотрите сушку в помещении или отапливаемые помещения',
      fr: 'Envisagez un séchage intérieur ou des installations chauffées',
      es: 'Considere secado interior o instalaciones climatizadas'
    },
    action: {
      en: 'Use heated drying recommended',
      he: 'מומלץ ייבוש מחומם',
      ar: 'يوصى باستخدام التجفيف المدفأ',
      ru: 'Рекомендуется сушка с подогревом',
      fr: 'Séchage chauffé recommandé',
      es: 'Se recomienda secado con calor'
    }
  },
  poor: {
    title: {
      en: 'Not Recommended',
      he: 'לא מומלץ',
      ar: 'غير موصى به',
      ru: 'Не рекомендуется',
      fr: 'Non recommandé',
      es: 'No recomendado'
    },
    messageRain: {
      en: 'Rainy weather - reschedule recommended',
      he: 'מזג אוויר גשום - מומלץ לדחות',
      ar: 'طقس ممطر - يوصى بإعادة الجدولة',
      ru: 'Дождливая погода - рекомендуется перенести',
      fr: 'Temps pluvieux - report recommandé',
      es: 'Clima lluvioso - se recomienda reprogramar'
    },
    messageGeneral: {
      en: 'Unfavorable conditions - consider rescheduling',
      he: 'תנאים לא נוחים - שקלו דחייה',
      ar: 'ظروف غير مواتية - فكر في إعادة الجدولة',
      ru: 'Неблагоприятные условия - рассмотрите перенос',
      fr: 'Conditions défavorables - envisagez de reporter',
      es: 'Condiciones desfavorables - considere reprogramar'
    },
    action: {
      en: 'Reschedule or use indoor facilities only',
      he: 'דחו או השתמשו במתקנים פנימיים בלבד',
      ar: 'أعد الجدولة أو استخدم المرافق الداخلية فقط',
      ru: 'Перенесите или используйте только закрытые помещения',
      fr: 'Reprogrammez ou utilisez uniquement les installations intérieures',
      es: 'Reprograme o use solo instalaciones interiores'
    }
  }
};

// UI Text Translations
export const uiText = {
  washScore: {
    en: 'Wash Score',
    he: 'ציון רחצה',
    ar: 'نقاط الغسيل',
    ru: 'Оценка мойки',
    fr: 'Score de lavage',
    es: 'Puntuación de lavado'
  },
  uvIndex: {
    en: 'UV Index',
    he: 'מדד UV',
    ar: 'مؤشر الأشعة فوق البنفسجية',
    ru: 'УФ-индекс',
    fr: 'Indice UV',
    es: 'Índice UV'
  },
  rainChance: {
    en: 'Rain Chance',
    he: 'סיכוי לגשם',
    ar: 'فرصة المطر',
    ru: 'Вероятность дождя',
    fr: 'Risque de pluie',
    es: 'Probabilidad de lluvia'
  },
  bestWashDay: {
    en: 'BEST WASH DAY',
    he: 'יום הרחצה הטוב ביותר',
    ar: 'أفضل يوم للغسيل',
    ru: 'ЛУЧШИЙ ДЕНЬ ДЛЯ МОЙКИ',
    fr: 'MEILLEUR JOUR DE LAVAGE',
    es: 'MEJOR DÍA DE LAVADO'
  },
  sevenDayForecast: {
    en: '7-Day Forecast',
    he: 'תחזית ל-7 ימים',
    ar: 'توقعات لمدة 7 أيام',
    ru: 'Прогноз на 7 дней',
    fr: 'Prévisions sur 7 jours',
    es: 'Pronóstico de 7 días'
  },
  bookThisDay: {
    en: 'Book This Premium Wash Day',
    he: 'הזמינו את יום הרחצה המובחר הזה',
    ar: 'احجز يوم الغسيل الممتاز هذا',
    ru: 'Забронировать этот премиальный день',
    fr: 'Réserver ce jour de lavage premium',
    es: 'Reserve este día de lavado premium'
  },
  poweredBy: {
    en: 'Powered by Google Weather API™',
    he: 'מופעל על ידי Google Weather API™',
    ar: 'مدعوم من Google Weather API™',
    ru: 'Работает на Google Weather API™',
    fr: 'Propulsé par Google Weather API™',
    es: 'Impulsado por Google Weather API™'
  },
  searchPlaceholder: {
    en: 'Enter city name (e.g., Tel Aviv, New York)',
    he: 'הזינו שם עיר (לדוגמה, תל אביב, ניו יורק)',
    ar: 'أدخل اسم المدينة (مثل تل أبيب، نيويورك)',
    ru: 'Введите название города (напр., Тель-Авив, Нью-Йорк)',
    fr: 'Entrez le nom de la ville (par ex., Tel Aviv, New York)',
    es: 'Ingrese el nombre de la ciudad (ej., Tel Aviv, Nueva York)'
  },
  search: {
    en: 'Search',
    he: 'חיפוש',
    ar: 'بحث',
    ru: 'Поиск',
    fr: 'Rechercher',
    es: 'Buscar'
  },
  unableToFetch: {
    en: 'Unable to Fetch Weather',
    he: 'לא ניתן לטעון נתוני מזג אוויר',
    ar: 'غير قادر على جلب الطقس',
    ru: 'Не удалось загрузить погоду',
    fr: 'Impossible de récupérer la météo',
    es: 'No se puede obtener el clima'
  },
  checkLocation: {
    en: 'Please check the location and try again',
    he: 'אנא בדקו את המיקום ונסו שוב',
    ar: 'يرجى التحقق من الموقع والمحاولة مرة أخرى',
    ru: 'Пожалуйста, проверьте местоположение и попробуйте снова',
    fr: 'Veuillez vérifier l\'emplacement et réessayer',
    es: 'Por favor verifique la ubicación e intente nuevamente'
  },
  marketingMessage: {
    en: 'Book your premium pet wash today!',
    he: 'הזמינו את רחצת חיות המחמד המובילה שלכם היום!',
    ar: 'احجز غسيل حيوانك الأليف المميز اليوم!',
    ru: 'Забронируйте премиальную мойку вашего питомца сегодня!',
    fr: 'Réservez votre lavage premium pour animaux aujourd\'hui!',
    es: '¡Reserva hoy tu lavado premium para mascotas!'
  },
  clientRecommendation1: {
    en: 'Check your upcoming appointments for optimal wash days',
    he: 'בדקו את התורים הקרובים שלכם לימי רחצה אופטימליים',
    ar: 'تحقق من مواعيدك القادمة لأيام الغسيل المثالية',
    ru: 'Проверьте свои предстоящие записи для оптимальных дней мойки',
    fr: 'Vérifiez vos rendez-vous à venir pour les jours de lavage optimaux',
    es: 'Consulte sus citas próximas para días de lavado óptimos'
  },
  clientRecommendation2: {
    en: 'Book early for the best wash day slots',
    he: 'הזמינו מראש לקבלת השעות הטובות ביותר',
    ar: 'احجز مبكرًا للحصول على أفضل فترات الغسيل',
    ru: 'Бронируйте заранее для лучших временных слотов',
    fr: 'Réservez tôt pour les meilleurs créneaux de lavage',
    es: 'Reserve temprano para obtener los mejores horarios de lavado'
  },
  dailySummary: {
    en: 'Weather forecast for your assigned station',
    he: 'תחזית מזג אוויר לתחנה שלכם',
    ar: 'توقعات الطقس للمحطة المخصصة لك',
    ru: 'Прогноз погоды для вашей станции',
    fr: 'Prévisions météo pour votre station',
    es: 'Pronóstico del tiempo para su estación asignada'
  },
  executiveRecommendation1: {
    en: 'Monitor all franchise locations for optimal operations',
    he: 'עקבו אחר כל מיקומי הזכיינות לתפעול אופטימלי',
    ar: 'راقب جميع مواقع الامتياز للعمليات المثلى',
    ru: 'Отслеживайте все франшизы для оптимальных операций',
    fr: 'Surveillez tous les emplacements de franchise pour des opérations optimales',
    es: 'Monitoree todas las ubicaciones de franquicia para operaciones óptimas'
  },
  weatherAlert: {
    en: 'Poor weather conditions - plan accordingly',
    he: 'תנאי מזג אוויר לא נוחים - תכננו בהתאם',
    ar: 'ظروف جوية سيئة - خطط وفقًا لذلك',
    ru: 'Неблагоприятные погодные условия - планируйте соответственно',
    fr: 'Mauvaises conditions météorologiques - planifiez en conséquence',
    es: 'Condiciones climáticas desfavorables - planifica en consecuencia'
  },
  optimalDaysFound: {
    en: 'optimal wash days this week',
    he: 'ימי רחצה אופטימליים השבוע',
    ar: 'أيام غسيل مثالية هذا الأسبوع',
    ru: 'оптимальных дней для мойки на этой неделе',
    fr: 'jours de lavage optimaux cette semaine',
    es: 'días óptimos de lavado esta semana'
  }
};

/**
 * Get translated weather condition
 */
export function getWeatherConditionTranslation(condition: string, lang: SupportedLanguage = 'en'): string {
  return weatherConditions[condition]?.[lang] || condition;
}

/**
 * Get translated recommendation
 */
export function getRecommendationTranslation(
  rating: 'excellent' | 'good' | 'moderate' | 'poor',
  field: 'title' | 'message' | 'action',
  lang: SupportedLanguage = 'en',
  isRain: boolean = false
): string {
  if (rating === 'poor' && field === 'message') {
    return isRain 
      ? recommendations.poor.messageRain[lang]
      : recommendations.poor.messageGeneral[lang];
  }
  return recommendations[rating][field][lang];
}

/**
 * Get UI text translation
 */
export function getUIText(key: keyof typeof uiText, lang: SupportedLanguage = 'en'): string {
  return uiText[key]?.[lang] || uiText[key]?.en || '';
}

// Fallback Advice Translations (for when Gemini AI is unavailable)
export const fallbackAdvice = {
  goodConditions: {
    title: {
      en: 'Good Wash Conditions',
      he: 'תנאי רחצה טובים',
      ar: 'ظروف غسيل جيدة',
      ru: 'Хорошие условия для мойки',
      fr: 'Bonnes conditions de lavage',
      es: 'Buenas condiciones de lavado'
    },
    message: {
      en: 'Weather is suitable for pet washing today.',
      he: 'מזג האוויר מתאים לרחצת חיות מחמד היום.',
      ar: 'الطقس مناسب لغسيل الحيوانات الأليفة اليوم.',
      ru: 'Погода подходит для мытья питомцев сегодня.',
      fr: 'Le temps convient au lavage des animaux aujourd\'hui.',
      es: 'El clima es adecuado para lavar mascotas hoy.'
    },
    action: {
      en: 'Proceed with scheduled appointments',
      he: 'המשיכו עם התורים המתוכננים',
      ar: 'تابع المواعيد المجدولة',
      ru: 'Продолжайте по расписанию',
      fr: 'Poursuivez avec les rendez-vous prévus',
      es: 'Continúe con las citas programadas'
    }
  },
  extremeHeat: {
    title: {
      en: 'Extreme Heat Warning',
      he: 'אזהרת חום קיצוני',
      ar: 'تحذير من الحرارة الشديدة',
      ru: 'Предупреждение об экстремальной жаре',
      fr: 'Avertissement de chaleur extrême',
      es: 'Advertencia de calor extremo'
    },
    message: {
      en: 'too hot for safe outdoor washing.',
      he: 'חם מדי לרחצה בטוחה בחוץ.',
      ar: 'حار جدًا للغسيل الآمن في الهواء الطلق.',
      ru: 'слишком жарко для безопасной мойки на улице.',
      fr: 'trop chaud pour un lavage en extérieur sûr.',
      es: 'demasiado caliente para lavado seguro al aire libre.'
    },
    action: {
      en: 'Use AC facilities, cool water, and avoid midday appointments',
      he: 'השתמשו במיזוג אוויר, מים קרים, והימנעו מתורים בצהריים',
      ar: 'استخدم مرافق التكييف والماء البارد وتجنب المواعيد في منتصف النهار',
      ru: 'Используйте кондиционер, прохладную воду и избегайте записи в полдень',
      fr: 'Utilisez des installations climatisées, de l\'eau fraîche et évitez les rendez-vous de midi',
      es: 'Use instalaciones con AC, agua fría y evite citas al mediodía'
    }
  },
  coldWeather: {
    title: {
      en: 'Cold Weather Advisory',
      he: 'אזהרת מזג אוויר קר',
      ar: 'تحذير من الطقس البارد',
      ru: 'Предупреждение о холодной погоде',
      fr: 'Avertissement de temps froid',
      es: 'Advertencia de clima frío'
    },
    message: {
      en: 'ensure pets stay warm.',
      he: 'וודאו שחיות המחמד נשארות חמות.',
      ar: 'تأكد من بقاء الحيوانات الأليفة دافئة.',
      ru: 'обеспечьте тепло питомцам.',
      fr: 'assurez-vous que les animaux restent au chaud.',
      es: 'asegúrese de que las mascotas se mantengan calientes.'
    },
    action: {
      en: 'Use warm water and heated dryer, keep pets indoors after wash',
      he: 'השתמשו במים חמים ומייבש מחומם, שמרו על חיות המחמד בפנים לאחר הרחצה',
      ar: 'استخدم الماء الدافئ والمجفف المدفأ، احتفظ بالحيوانات الأليفة في الداخل بعد الغسيل',
      ru: 'Используйте теплую воду и сушку с подогревом, держите питомцев в помещении после мойки',
      fr: 'Utilisez de l\'eau chaude et un séchoir chauffé, gardez les animaux à l\'intérieur après le lavage',
      es: 'Use agua tibia y secador con calor, mantenga las mascotas dentro después del lavado'
    }
  },
  heavyRain: {
    title: {
      en: 'Heavy Rain Alert',
      he: 'אזהרת גשם כבד',
      ar: 'تنبيه مطر غزير',
      ru: 'Предупреждение о сильном дожде',
      fr: 'Alerte pluie forte',
      es: 'Alerta de lluvia intensa'
    },
    message: {
      en: 'rain chance - outdoor washes at risk.',
      he: 'סיכוי לגשם - רחצות חיצוניות בסיכון.',
      ar: 'فرصة مطر - الغسيل الخارجي في خطر.',
      ru: 'вероятность дождя - мойка на улице под угрозой.',
      fr: 'risque de pluie - lavages extérieurs à risque.',
      es: 'probabilidad de lluvia - lavados al aire libre en riesgo.'
    },
    action: {
      en: 'Reschedule outdoor appointments or move to indoor facilities',
      he: 'דחו תורים חיצוניים או עברו למתקנים פנימיים',
      ar: 'أعد جدولة المواعيد الخارجية أو انتقل إلى المرافق الداخلية',
      ru: 'Перенесите записи на улице или переместите в закрытое помещение',
      fr: 'Reprogrammez les rendez-vous extérieurs ou déplacez vers des installations intérieures',
      es: 'Reprograme citas al aire libre o muévase a instalaciones interiores'
    }
  },
  rainyWeather: {
    title: {
      en: 'Rainy Weather Alert',
      he: 'אזהרת מזג אוויר גשום',
      ar: 'تنبيه طقس ممطر',
      ru: 'Предупреждение о дождливой погоде',
      fr: 'Alerte temps pluvieux',
      es: 'Alerta de clima lluvioso'
    },
    message: {
      en: 'expected - outdoor activities affected.',
      he: 'צפוי - פעילויות חיצוניות מושפעות.',
      ar: 'متوقع - الأنشطة الخارجية متأثرة.',
      ru: 'ожидается - занятия на улице под влиянием.',
      fr: 'prévu - activités extérieures affectées.',
      es: 'esperado - actividades al aire libre afectadas.'
    },
    action: {
      en: 'Move to indoor facilities or reschedule outdoor appointments',
      he: 'עברו למתקנים פנימיים או דחו תורים חיצוניים',
      ar: 'انتقل إلى المرافق الداخلية أو أعد جدولة المواعيد الخارجية',
      ru: 'Переместитесь в помещение или перенесите записи на улице',
      fr: 'Déplacez vers des installations intérieures ou reprogrammez les rendez-vous extérieurs',
      es: 'Muévase a instalaciones interiores o reprograme citas al aire libre'
    }
  },
  highUV: {
    title: {
      en: 'High UV Index',
      he: 'מדד UV גבוה',
      ar: 'مؤشر أشعة فوق بنفسجية عالي',
      ru: 'Высокий УФ-индекс',
      fr: 'Indice UV élevé',
      es: 'Índice UV alto'
    },
    message: {
      en: 'protect light-colored pets.',
      he: 'הגנו על חיות מחמד בצבע בהיר.',
      ar: 'احمِ الحيوانات الأليفة ذات الألوان الفاتحة.',
      ru: 'защитите питомцев светлого окраса.',
      fr: 'protégez les animaux de couleur claire.',
      es: 'proteja las mascotas de color claro.'
    },
    action: {
      en: 'Apply pet-safe sunscreen, provide shade during outdoor drying',
      he: 'מרחו קרם הגנה בטוח לחיות מחמד, ספקו צל במהלך ייבוש חיצוני',
      ar: 'ضع واقي شمس آمن للحيوانات الأليفة، وفر الظل أثناء التجفيف في الهواء الطلق',
      ru: 'Нанесите безопасный солнцезащитный крем, обеспечьте тень при сушке на улице',
      fr: 'Appliquez une crème solaire sans danger pour les animaux, fournissez de l\'ombre pendant le séchage extérieur',
      es: 'Aplique protector solar seguro para mascotas, proporcione sombra durante el secado al aire libre'
    }
  },
  highHumidity: {
    title: {
      en: 'High Humidity',
      he: 'לחות גבוהה',
      ar: 'رطوبة عالية',
      ru: 'Высокая влажность',
      fr: 'Humidité élevée',
      es: 'Humedad alta'
    },
    message: {
      en: 'humidity - drying will take longer.',
      he: 'לחות - ייבוש ייקח יותר זמן.',
      ar: 'رطوبة - سيستغرق التجفيف وقتًا أطول.',
      ru: 'влажность - сушка займет больше времени.',
      fr: 'humidité - le séchage prendra plus de temps.',
      es: 'humedad - el secado tomará más tiempo.'
    },
    action: {
      en: 'Use heated dryer, allow extra time for large breeds',
      he: 'השתמשו במייבש מחומם, הקצו זמן נוסף לגזעים גדולים',
      ar: 'استخدم مجففًا مدفأ، امنح وقتًا إضافيًا للسلالات الكبيرة',
      ru: 'Используйте сушку с подогревом, выделите дополнительное время для крупных пород',
      fr: 'Utilisez un séchoir chauffé, prévoyez plus de temps pour les grandes races',
      es: 'Use secador con calor, permita tiempo adicional para razas grandes'
    }
  },
  unfavorable: {
    title: {
      en: 'Unfavorable Conditions',
      he: 'תנאים לא נוחים',
      ar: 'ظروف غير مواتية',
      ru: 'Неблагоприятные условия',
      fr: 'Conditions défavorables',
      es: 'Condiciones desfavorables'
    },
    message: {
      en: 'Weather conditions are not ideal for outdoor washing.',
      he: 'תנאי מזג האוויר אינם אידיאליים לרחצה חיצונית.',
      ar: 'ظروف الطقس ليست مثالية للغسيل في الهواء الطلق.',
      ru: 'Погодные условия не идеальны для мойки на улице.',
      fr: 'Les conditions météorologiques ne sont pas idéales pour le lavage extérieur.',
      es: 'Las condiciones climáticas no son ideales para el lavado al aire libre.'
    },
    action: {
      en: 'Consider indoor facilities or rescheduling',
      he: 'שקלו מתקנים פנימיים או דחייה',
      ar: 'فكر في المرافق الداخلية أو إعادة الجدولة',
      ru: 'Рассмотрите помещение или перенос',
      fr: 'Envisagez des installations intérieures ou un report',
      es: 'Considere instalaciones interiores o reprogramación'
    }
  }
};

/**
 * Get fallback advice translation
 */
export function getFallbackAdviceText(
  key: keyof typeof fallbackAdvice,
  field: 'title' | 'message' | 'action',
  lang: SupportedLanguage = 'en'
): string {
  return fallbackAdvice[key]?.[field]?.[lang] || fallbackAdvice[key]?.[field]?.en || '';
}

// Basic Recommendations Translations
export const basicRecommendations = {
  coolWater: {
    en: 'Use cool water and air-conditioned facilities',
    he: 'השתמשו במים קרים ובמתקנים ממוזגים',
    ar: 'استخدم الماء البارد والمرافق المكيفة',
    ru: 'Используйте прохладную воду и помещения с кондиционером',
    fr: 'Utilisez de l\'eau fraîche et des installations climatisées',
    es: 'Use agua fría e instalaciones con aire acondicionado'
  },
  avoidPeakHeat: {
    en: 'Avoid washing during peak heat (12-4 PM)',
    he: 'הימנעו מרחצה בשעות החום השיא (12-16)',
    ar: 'تجنب الغسيل أثناء ذروة الحرارة (12-4 مساءً)',
    ru: 'Избегайте мойки в пик жары (12-16)',
    fr: 'Évitez de laver pendant les heures de chaleur (12h-16h)',
    es: 'Evite lavar durante el pico de calor (12-16h)'
  },
  warmWater: {
    en: 'Use warm water and heated dryer',
    he: 'השתמשו במים חמים ובמייבש מחומם',
    ar: 'استخدم الماء الدافئ والمجفف المدفأ',
    ru: 'Используйте теплую воду и сушку с подогревом',
    fr: 'Utilisez de l\'eau chaude et un séchoir chauffé',
    es: 'Use agua tibia y secador con calor'
  },
  keepIndoors: {
    en: 'Keep pets indoors until fully dry',
    he: 'שמרו על חיות המחמד בפנים עד שיתייבשו לחלוטין',
    ar: 'احتفظ بالحيوانات الأليفة في الداخل حتى تجف تمامًا',
    ru: 'Держите питомцев в помещении до полного высыхания',
    fr: 'Gardez les animaux à l\'intérieur jusqu\'à séchage complet',
    es: 'Mantenga las mascotas adentro hasta que estén completamente secas'
  },
  sunscreen: {
    en: 'Apply pet-safe sunscreen for light-colored breeds',
    he: 'מרחו קרם הגנה בטוח לחיות מחמד לגזעים בהירים',
    ar: 'ضع واقي شمس آمن للحيوانات الأليفة للسلالات ذات الألوان الفاتحة',
    ru: 'Нанесите безопасный солнцезащитный крем для питомцев светлого окраса',
    fr: 'Appliquez une crème solaire sans danger pour les races de couleur claire',
    es: 'Aplique protector solar seguro para razas de color claro'
  },
  provideShade: {
    en: 'Provide shade breaks during outdoor activities',
    he: 'ספקו הפסקות בצל במהלך פעילויות חיצוניות',
    ar: 'وفر فترات راحة في الظل أثناء الأنشطة الخارجية',
    ru: 'Обеспечьте перерывы в тени во время занятий на улице',
    fr: 'Fournissez des pauses à l\'ombre pendant les activités extérieures',
    es: 'Proporcione descansos a la sombra durante actividades al aire libre'
  },
  heatedDryer: {
    en: 'Use heated dryer for faster, more comfortable drying',
    he: 'השתמשו במייבש מחומם לייבוש מהיר ונוח יותר',
    ar: 'استخدم مجففًا مدفأ لتجفيف أسرع وأكثر راحة',
    ru: 'Используйте сушку с подогревом для более быстрой и комфортной сушки',
    fr: 'Utilisez un séchoir chauffé pour un séchage plus rapide et confortable',
    es: 'Use secador con calor para un secado más rápido y cómodo'
  },
  longerDrying: {
    en: 'Expect longer drying times for long-haired breeds',
    he: 'צפו לזמני ייבוש ארוכים יותר לגזעים ארוכי שיער',
    ar: 'توقع أوقات تجفيف أطول للسلالات ذات الشعر الطويل',
    ru: 'Ожидайте более длительного времени сушки для длинношерстных пород',
    fr: 'Prévoyez des temps de séchage plus longs pour les races à poils longs',
    es: 'Espere tiempos de secado más largos para razas de pelo largo'
  },
  indoorFacilities: {
    en: 'Prefer indoor washing facilities',
    he: 'העדיפו מתקני רחצה פנימיים',
    ar: 'فضّل مرافق الغسيل الداخلية',
    ru: 'Предпочитайте помещения для мойки',
    fr: 'Préférez les installations de lavage intérieures',
    es: 'Prefiera instalaciones de lavado interiores'
  },
  monitorPets: {
    en: 'Monitor pets closely for signs of discomfort',
    he: 'עקבו בקפידה אחר חיות המחמד לאיתור סימני אי נוחות',
    ar: 'راقب الحيوانات الأليفة عن كثب بحثًا عن علامات عدم الراحة',
    ru: 'Внимательно следите за питомцами на предмет признаков дискомфорта',
    fr: 'Surveillez attentivement les animaux pour détecter des signes d\'inconfort',
    es: 'Monitoree de cerca las mascotas en busca de signos de incomodidad'
  }
};

/**
 * Get basic recommendation translation
 */
export function getBasicRecommendationText(
  key: keyof typeof basicRecommendations,
  lang: SupportedLanguage = 'en'
): string {
  return basicRecommendations[key]?.[lang] || basicRecommendations[key]?.en || '';
}

// Label Translations (for dynamic messages)
export const labels = {
  uvIndex: {
    en: 'UV Index',
    he: 'מדד UV',
    ar: 'مؤشر الأشعة فوق البنفسجية',
    ru: 'УФ-индекс',
    fr: 'Indice UV',
    es: 'Índice UV'
  }
};

/**
 * Get label translation
 */
export function getLabelText(
  key: keyof typeof labels,
  lang: SupportedLanguage = 'en'
): string {
  return labels[key]?.[lang] || labels[key]?.en || '';
}
