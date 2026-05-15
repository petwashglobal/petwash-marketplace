import { useState, useRef, useMemo, useEffect } from 'react';
import { useEgiftHeroSuppressFloating } from '@/hooks/useEgiftHeroSuppressFloating';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Gift, Check, ShieldCheck, Heart, Star, PartyPopper, Sparkles, Globe, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentMethods from '@/components/PaymentMethods';
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';

import pinkCard from '@assets/IMG_3094_1770832584882.png';
import greenCard from '@assets/IMG_3091_1770832584882.png';
import blackCard from '@assets/IMG_3090_1770824592770.png';
import goldCard from '@assets/IMG_3089_1770824592770.png';

const cardImages: Record<string, string> = {
  CLASSIC: pinkCard,
  PLUS: greenCard,
  PREMIUM: blackCard,
  ELITE: goldCard,
};

interface CardOccasion {
  id: string;
  icon: typeof Heart;
  gradient: string;
  borderColor: string;
  labels: Record<string, string>;
  messageSuggestions: Record<string, string[]>;
}

const cardOccasions: CardOccasion[] = [
  {
    id: 'birthday',
    icon: PartyPopper,
    gradient: 'from-[#fdf2f8] via-[#fce7f3] to-[#fbcfe8]',
    borderColor: '#ec4899',
    labels: {
      en: 'Birthday', he: 'יום הולדת', ar: 'عيد ميلاد', ru: 'День рождения', fr: 'Anniversaire', es: 'Cumpleaños',
    },
    messageSuggestions: {
      en: ['Happy Birthday! Treat your furry friend to something special!', 'Wishing you and your pet a wonderful birthday!'],
      he: ['יום הולדת שמח! פנק את החבר הפרוותי שלך!', 'מאחלים לך ולחיית המחמד שלך יום הולדת נפלא!'],
      ar: ['عيد ميلاد سعيد! دلل صديقك الفروي!', 'أتمنى لك ولحيوانك الأليف عيد ميلاد رائع!'],
      ru: ['С днём рождения! Побалуйте своего пушистого друга!', 'Желаем вам и вашему питомцу чудесного дня рождения!'],
      fr: ['Joyeux anniversaire! Gâtez votre ami à fourrure!', 'Nous vous souhaitons un merveilleux anniversaire!'],
      es: ['¡Feliz cumpleaños! ¡Consiente a tu amigo peludo!', '¡Les deseamos un maravilloso cumpleaños!'],
    },
  },
  {
    id: 'thankyou',
    icon: Heart,
    gradient: 'from-[#fef3c7] via-[#fde68a] to-[#fcd34d]',
    borderColor: '#d97706',
    labels: {
      en: 'Thank You', he: 'תודה', ar: 'شكراً', ru: 'Спасибо', fr: 'Merci', es: 'Gracias',
    },
    messageSuggestions: {
      en: ['Thank you for everything! Your pet deserves the best care.', 'A small token of appreciation for you and your furry companion.'],
      he: ['תודה על הכל! חיית המחמד שלך ראויה לטיפוח הטוב ביותר.', 'מתנה קטנה של הערכה לך ולחבר הפרוותי שלך.'],
      ar: ['شكراً لك على كل شيء! حيوانك الأليف يستحق أفضل رعاية.', 'رمز تقدير صغير لك ولصديقك الفروي.'],
      ru: ['Спасибо за всё! Ваш питомец заслуживает лучшего ухода.', 'Небольшой знак благодарности вам и вашему пушистому другу.'],
      fr: ['Merci pour tout! Votre animal mérite les meilleurs soins.', 'Un petit geste de reconnaissance pour vous et votre compagnon.'],
      es: ['¡Gracias por todo! Tu mascota merece el mejor cuidado.', 'Un pequeño detalle de agradecimiento para ti y tu compañero peludo.'],
    },
  },
  {
    id: 'holiday',
    icon: Sparkles,
    gradient: 'from-[#ecfdf5] via-[#d1fae5] to-[#a7f3d0]',
    borderColor: '#059669',
    labels: {
      en: 'Holiday', he: 'חג שמח', ar: 'عطلة سعيدة', ru: 'Праздник', fr: 'Fêtes', es: 'Fiesta',
    },
    messageSuggestions: {
      en: ['Happy Holidays! Give your pet the gift of luxury care!', 'Celebrate the season with premium pet pampering!'],
      he: ['חג שמח! תנו לחיית המחמד שלכם את מתנת הפינוק!', 'חגגו את העונה עם טיפוח פרימיום לחיות מחמד!'],
      ar: ['عطلة سعيدة! امنح حيوانك الأليف هدية الرعاية الفاخرة!', 'احتفل بالموسم مع تدليل الحيوانات الأليفة المميز!'],
      ru: ['С праздником! Подарите питомцу роскошный уход!', 'Отпразднуйте с премиальным уходом за питомцем!'],
      fr: ['Bonnes fêtes! Offrez à votre animal le luxe du soin!', 'Célébrez la saison avec des soins premium!'],
      es: ['¡Felices fiestas! ¡Regala cuidado de lujo a tu mascota!', '¡Celebra la temporada con cuidado premium!'],
    },
  },
  {
    id: 'love',
    icon: Heart,
    gradient: 'from-[#fef2f2] via-[#fee2e2] to-[#fecaca]',
    borderColor: '#ef4444',
    labels: {
      en: 'With Love', he: 'באהבה', ar: 'بحب', ru: 'С любовью', fr: 'Avec amour', es: 'Con amor',
    },
    messageSuggestions: {
      en: ['Sending love to you and your adorable pet!', 'Because you and your pet deserve the very best!'],
      he: ['שולחים אהבה לך ולחיית המחמד המקסימה שלך!', 'כי אתם וחיית המחמד שלכם ראויים לטוב ביותר!'],
      ar: ['نرسل الحب لك ولحيوانك الأليف الرائع!', 'لأنك وحيوانك الأليف تستحقان الأفضل!'],
      ru: ['С любовью к вам и вашему питомцу!', 'Потому что вы и ваш питомец заслуживаете лучшего!'],
      fr: ['Avec tout notre amour pour vous et votre animal!', 'Parce que vous et votre animal méritez le meilleur!'],
      es: ['¡Enviando amor a ti y a tu adorable mascota!', '¡Porque tú y tu mascota merecen lo mejor!'],
    },
  },
  {
    id: 'congrats',
    icon: Star,
    gradient: 'from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]',
    borderColor: '#3b82f6',
    labels: {
      en: 'Congrats', he: 'מזל טוב', ar: 'مبروك', ru: 'Поздравляю', fr: 'Félicitations', es: 'Felicitaciones',
    },
    messageSuggestions: {
      en: ['Congratulations! Celebrate with premium pet care!', 'Here\'s to new beginnings – treat your pet to the best!'],
      he: ['מזל טוב! חגגו עם טיפוח פרימיום לחיות מחמד!', 'לתחילה חדשה – פנקו את חיית המחמד שלכם בטוב ביותר!'],
      ar: ['مبروك! احتفل مع رعاية الحيوانات الأليفة المميزة!', 'لبدايات جديدة – دلل حيوانك الأليف بالأفضل!'],
      ru: ['Поздравляем! Отпразднуйте с премиальным уходом!', 'За новые начинания – побалуйте питомца лучшим!'],
      fr: ['Félicitations! Célébrez avec des soins premium!', 'Pour un nouveau départ – gâtez votre animal!'],
      es: ['¡Felicitaciones! ¡Celebra con cuidado premium!', '¡Por nuevos comienzos – consiente a tu mascota!'],
    },
  },
  {
    id: 'justbecause',
    icon: Gift,
    gradient: 'from-[#f5f3ff] via-[#ede9fe] to-[#ddd6fe]',
    borderColor: '#8b5cf6',
    labels: {
      en: 'Just Because', he: 'סתם ככה', ar: 'بدون سبب', ru: 'Просто так', fr: 'Juste comme ça', es: 'Solo porque sí',
    },
    messageSuggestions: {
      en: ['No special occasion needed – just because you\'re amazing!', 'A surprise for the best pet parent ever!'],
      he: ['לא צריך סיבה מיוחדת – פשוט כי מגיע לך!', 'הפתעה להורה הכי טוב לחיית מחמד!'],
      ar: ['لا حاجة لمناسبة خاصة – فقط لأنك رائع!', 'مفاجأة لأفضل والد حيوان أليف!'],
      ru: ['Не нужен повод – просто потому что вы замечательны!', 'Сюрприз лучшему хозяину питомца!'],
      fr: ['Pas besoin d\'occasion – juste parce que vous êtes génial!', 'Une surprise pour le meilleur parent d\'animal!'],
      es: ['No se necesita ocasión – ¡solo porque eres increíble!', '¡Una sorpresa para el mejor padre de mascota!'],
    },
  },
];

const messageLanguages = [
  { code: 'he', label: 'עברית', flag: '🇮🇱', dir: 'rtl' as const, inputLang: 'he' },
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' as const, inputLang: 'en' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' as const, inputLang: 'ar' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', dir: 'ltr' as const, inputLang: 'ru' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' as const, inputLang: 'fr' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr' as const, inputLang: 'es' },
];

const translations: Record<string, Record<string, string>> = {
  platformCredit: {
    en: 'Platform-Wide Credit',
    he: 'קרדיט לכל הפלטפורמות',
    ar: 'رصيد لجميع المنصات',
    ru: 'Кредит для всех платформ',
    fr: 'Crédit multi-plateforme',
    es: 'Crédito para todas las plataformas',
  },
  title: {
    en: 'Gift Card Credit',
    he: 'תווי שי דיגיטליים',
    ar: 'قسائم رقمية',
    ru: 'Электронные ваучеры',
    fr: 'Bons cadeaux numériques',
    es: 'Vales regalo digitales',
  },
  description: {
    en: 'Give the gift of premium pet care credit. Use anywhere across \u2066Pet Wash™\u2069 platforms - from self-service washes to pet sitting, dog walking, adventures, and more!',
    he: 'תנו את מתנת הטיפוח המושלמת לחיות מחמד. ניתן לשימוש בכל פלטפורמות \u2066Pet Wash™\u2069 - משטיפה בשירות עצמי ועד שמרטפות, טיולי כלבים, הרפתקאות ועוד!',
    ar: 'قدم هدية رعاية الحيوانات الأليفة المميزة. استخدمها في جميع منصات \u2066Pet Wash™\u2069 - من الغسيل الذاتي إلى رعاية الحيوانات والمشي والمغامرات والمزيد!',
    ru: 'Подарите кредит на премиальный уход за питомцами. Используйте на всех платформах \u2066Pet Wash™\u2069 - от мойки самообслуживания до присмотра, выгула и приключений!',
    fr: 'Offrez le cadeau des soins premium pour animaux. Utilisable sur toutes les plateformes \u2066Pet Wash™\u2069 - du lavage libre-service au pet sitting, promenades et aventures!',
    es: 'Regala crédito de cuidado premium para mascotas. Úsalo en todas las plataformas \u2066Pet Wash™\u2069 - desde lavado autoservicio hasta cuidadores, paseos, aventuras y más!',
  },
  usableAt: {
    en: 'Gift can be used at:',
    he: 'ניתן לממש ב:',
    ar: 'يمكن استخدامها في:',
    ru: 'Можно использовать в:',
    fr: 'Utilisable chez:',
    es: 'Se puede usar en:',
  },
  bestValue: {
    en: 'BEST VALUE',
    he: 'הכי משתלם',
    ar: 'أفضل قيمة',
    ru: 'ЛУЧШАЯ ЦЕНА',
    fr: 'MEILLEUR PRIX',
    es: 'MEJOR VALOR',
  },
  continueCheckout: {
    en: 'Continue to Checkout',
    he: 'המשך לתשלום',
    ar: 'متابعة الدفع',
    ru: 'Перейти к оплате',
    fr: 'Passer à la caisse',
    es: 'Continuar al pago',
  },
  instantDelivery: {
    en: 'Instant Delivery',
    he: 'משלוח מיידי',
    ar: 'توصيل فوري',
    ru: 'Мгновенная доставка',
    fr: 'Livraison instantanée',
    es: 'Entrega instantánea',
  },
  noAccountRequired: {
    en: 'No Account Required',
    he: 'ללא צורך בחשבון',
    ar: 'لا يتطلب حساب',
    ru: 'Без регистрации',
    fr: 'Sans compte requis',
    es: 'Sin cuenta necesaria',
  },
  valid12Months: {
    en: 'Valid 24 Months',
    he: 'בתוקף 24 חודשים',
    ar: 'صالحة لمدة 24 شهراً',
    ru: 'Действует 24 месяца',
    fr: 'Valable 24 mois',
    es: 'Válido 24 meses',
  },
  allServices: {
    en: 'All Services',
    he: 'כל השירותים',
    ar: 'جميع الخدمات',
    ru: 'Все услуги',
    fr: 'Tous les services',
    es: 'Todos los servicios',
  },
  selectCard: {
    en: 'Please select a gift card value',
    he: 'נא לבחור סכום לתו שי',
    ar: 'يرجى اختيار قيمة القسيمة',
    ru: 'Выберите номинал ваучера',
    fr: 'Veuillez sélectionner une valeur de bon',
    es: 'Seleccione un valor de vale',
  },
  back: {
    en: 'Back',
    he: 'חזרה',
    ar: 'رجوع',
    ru: 'Назад',
    fr: 'Retour',
    es: 'Volver',
  },
  expressCheckout: {
    en: 'Express Checkout',
    he: 'תשלום מהיר',
    ar: 'الدفع السريع',
    ru: 'Быстрая оплата',
    fr: 'Paiement express',
    es: 'Pago rápido',
  },
  recipientName: {
    en: 'Recipient Name',
    he: 'שם המקבל',
    ar: 'اسم المستلم',
    ru: 'Имя получателя',
    fr: 'Nom du destinataire',
    es: 'Nombre del destinatario',
  },
  recipientNamePlaceholder: {
    en: 'Who is this for?',
    he: 'למי המתנה?',
    ar: 'لمن هذه الهدية؟',
    ru: 'Кому подарок?',
    fr: 'Pour qui est-ce?',
    es: '¿Para quién es?',
  },
  recipientEmail: {
    en: 'Recipient Email',
    he: 'אימייל המקבל',
    ar: 'بريد المستلم',
    ru: 'Email получателя',
    fr: 'Email du destinataire',
    es: 'Email del destinatario',
  },
  recipientEmailPlaceholder: {
    en: 'Their email',
    he: 'האימייל שלהם',
    ar: 'بريدهم الإلكتروني',
    ru: 'Их email',
    fr: 'Leur email',
    es: 'Su email',
  },
  yourName: {
    en: 'Your Name',
    he: 'השם שלך',
    ar: 'اسمك',
    ru: 'Ваше имя',
    fr: 'Votre nom',
    es: 'Tu nombre',
  },
  yourNamePlaceholder: {
    en: 'Your name',
    he: 'השם שלך',
    ar: 'اسمك',
    ru: 'Ваше имя',
    fr: 'Votre nom',
    es: 'Tu nombre',
  },
  yourEmail: {
    en: 'Your Email',
    he: 'האימייל שלך',
    ar: 'بريدك الإلكتروني',
    ru: 'Ваш email',
    fr: 'Votre email',
    es: 'Tu email',
  },
  yourEmailPlaceholder: {
    en: 'Your email',
    he: 'האימייל שלך',
    ar: 'بريدك الإلكتروني',
    ru: 'Ваш email',
    fr: 'Votre email',
    es: 'Tu email',
  },
  personalMessage: {
    en: 'Personal Message',
    he: 'הודעה אישית',
    ar: 'رسالة شخصية',
    ru: 'Личное сообщение',
    fr: 'Message personnel',
    es: 'Mensaje personal',
  },
  messagePlaceholder: {
    en: 'Write your personal message here...',
    he: 'כתבו את ההודעה האישית שלכם כאן...',
    ar: 'اكتب رسالتك الشخصية هنا...',
    ru: 'Напишите ваше личное сообщение здесь...',
    fr: 'Écrivez votre message personnel ici...',
    es: 'Escribe tu mensaje personal aquí...',
  },
  redeemableAt: {
    en: 'Redeemable at:',
    he: 'ניתן למימוש ב:',
    ar: 'قابلة للاسترداد في:',
    ru: 'Можно использовать в:',
    fr: 'Échangeable chez:',
    es: 'Canjeable en:',
  },
  payAndSend: {
    en: 'Pay & Send Gift',
    he: 'תשלום ושליחת מתנה',
    ar: 'ادفع وأرسل الهدية',
    ru: 'Оплатить и отправить',
    fr: 'Payer et envoyer',
    es: 'Pagar y enviar regalo',
  },
  secureCheckout: {
    en: 'Secure checkout · No account required',
    he: 'תשלום מאובטח · ללא צורך בחשבון',
    ar: 'دفع آمن · لا يتطلب حساب',
    ru: 'Безопасная оплата · Без регистрации',
    fr: 'Paiement sécurisé · Sans compte requis',
    es: 'Pago seguro · Sin cuenta necesaria',
  },
  worksAtAll: {
    en: 'Works at all \u2066Pet Wash™\u2069 services',
    he: 'תקף בכל שירותי \u2066Pet Wash™\u2069',
    ar: 'يعمل في جميع خدمات \u2066Pet Wash™\u2069',
    ru: 'Действует во всех сервисах \u2066Pet Wash™\u2069',
    fr: 'Valable dans tous les services \u2066Pet Wash™\u2069',
    es: 'Válido en todos los servicios \u2066Pet Wash™\u2069',
  },
  required: {
    en: 'Required',
    he: 'שדה חובה',
    ar: 'مطلوب',
    ru: 'Обязательно',
    fr: 'Requis',
    es: 'Obligatorio',
  },
  invalidEmail: {
    en: 'Invalid email',
    he: 'אימייל לא תקין',
    ar: 'بريد إلكتروني غير صالح',
    ru: 'Неверный email',
    fr: 'Email invalide',
    es: 'Email inválido',
  },
  fillRequired: {
    en: 'Please fill in all required fields',
    he: 'נא למלא את כל השדות הנדרשים',
    ar: 'يرجى ملء جميع الحقول المطلوبة',
    ru: 'Заполните все обязательные поля',
    fr: 'Veuillez remplir tous les champs requis',
    es: 'Complete todos los campos obligatorios',
  },
  giftCreated: {
    en: 'Gift Card Created!',
    he: 'תו השי נוצר בהצלחה!',
    ar: 'تم إنشاء القسيمة!',
    ru: 'Ваучер создан!',
    fr: 'Bon cadeau créé!',
    es: '¡Vale regalo creado!',
  },
  giftCode: {
    en: 'Gift card code:',
    he: 'קוד תו שי:',
    ar: 'رمز القسيمة:',
    ru: 'Код ваучера:',
    fr: 'Code du bon:',
    es: 'Código del vale:',
  },
  errorCreating: {
    en: 'Error creating gift card',
    he: 'שגיאה ביצירת תו השי',
    ar: 'خطأ في إنشاء القسيمة',
    ru: 'Ошибка при создании ваучера',
    fr: 'Erreur lors de la création',
    es: 'Error al crear el vale',
  },
  tryAgain: {
    en: 'Please try again',
    he: 'נא לנסות שנית',
    ar: 'يرجى المحاولة مرة أخرى',
    ru: 'Попробуйте снова',
    fr: 'Veuillez réessayer',
    es: 'Inténtelo de nuevo',
  },
  errorProcessing: {
    en: 'Error processing gift',
    he: 'שגיאה בעיבוד תו השי',
    ar: 'خطأ في معالجة القسيمة',
    ru: 'Ошибка обработки ваучера',
    fr: 'Erreur de traitement du bon',
    es: 'Error al procesar el vale',
  },
  tryAgainLater: {
    en: 'Please try again later',
    he: 'נא לנסות שנית מאוחר יותר',
    ar: 'يرجى المحاولة لاحقاً',
    ru: 'Попробуйте позже',
    fr: 'Veuillez réessayer plus tard',
    es: 'Inténtelo más tarde',
  },
  eGiftCard: {
    en: 'E-Gift Card',
    he: 'תו שי דיגיטלי',
    ar: 'قسيمة رقمية',
    ru: 'Электронный ваучер',
    fr: 'Bon cadeau',
    es: 'Vale regalo',
  },
  eGiftCredit: {
    en: 'E-Gift Credit',
    he: 'קרדיט תו שי',
    ar: 'رصيد قسيمة',
    ru: 'Подарочный кредит',
    fr: 'Crédit cadeau',
    es: 'Crédito regalo',
  },
  sendGift: {
    en: 'Send Gift',
    he: 'שלח מתנה',
    ar: 'إرسال هدية',
    ru: 'Отправить подарок',
    fr: 'Envoyer cadeau',
    es: 'Enviar regalo',
  },
  chooseOccasion: {
    en: 'Choose Occasion',
    he: 'בחרו אירוע',
    ar: 'اختر المناسبة',
    ru: 'Выберите повод',
    fr: 'Choisir l\'occasion',
    es: 'Elegir ocasión',
  },
  chooseValue: {
    en: 'Choose Value',
    he: 'בחרו סכום',
    ar: 'اختر القيمة',
    ru: 'Выберите сумму',
    fr: 'Choisir la valeur',
    es: 'Elegir valor',
  },
  messageLanguage: {
    en: 'Message Language',
    he: 'שפת ההודעה',
    ar: 'لغة الرسالة',
    ru: 'Язык сообщения',
    fr: 'Langue du message',
    es: 'Idioma del mensaje',
  },
  suggestedMessages: {
    en: 'Suggested Messages',
    he: 'הודעות מוצעות',
    ar: 'رسائل مقترحة',
    ru: 'Предложенные сообщения',
    fr: 'Messages suggérés',
    es: 'Mensajes sugeridos',
  },
  tapToUse: {
    en: 'Tap to use',
    he: 'לחצו לשימוש',
    ar: 'انقر للاستخدام',
    ru: 'Нажмите для использования',
    fr: 'Appuyez pour utiliser',
    es: 'Toque para usar',
  },
  customAmount: {
    en: 'Custom Amount',
    he: 'סכום מותאם אישית',
    ar: 'مبلغ مخصص',
    ru: 'Произвольная сумма',
    fr: 'Montant personnalisé',
    es: 'Monto personalizado',
  },
  enterAmount: {
    en: 'Enter amount (₪50-₪5,000)',
    he: 'הזינו סכום (₪50-₪5,000)',
    ar: 'أدخل المبلغ (₪50-₪5,000)',
    ru: 'Введите сумму (₪50-₪5,000)',
    fr: 'Entrez le montant (₪50-₪5,000)',
    es: 'Ingrese monto (₪50-₪5,000)',
  },
  occasionSelected: {
    en: 'Card occasion set!',
    he: 'סוג הכרטיס נבחר!',
    ar: 'تم تحديد المناسبة!',
    ru: 'Повод выбран!',
    fr: 'Occasion sélectionnée!',
    es: '¡Ocasión seleccionada!',
  },
};

const platformServices = [
  { id: 'wash', name: '\u2066K9000 Wash Hub™\u2069' },
  { id: 'sitter', name: '\u2066Sitter Suite™\u2069' },
  { id: 'walk', name: '\u2066Walk My Pet™\u2069' },
  { id: 'trek', name: '\u2066PetTrek™\u2069' },
  { id: 'academy', name: '\u2066Pet Wash Academy™\u2069' },
  { id: 'nayax', name: '\u2066Nayax Pet Wash™\u2069' }
];

const giftOptions = [
  { value: 100, tier: 'CLASSIC' as const },
  { value: 250, tier: 'PLUS' as const },
  { value: 500, tier: 'PREMIUM' as const },
  { value: 1000, tier: 'ELITE' as const }
];

const tierLabels: Record<string, Record<string, string>> = {
  CLASSIC: { en: 'Classic', he: 'קלאסי', ar: 'كلاسيك', ru: 'Классик', fr: 'Classique', es: 'Clásico' },
  PLUS: { en: 'Plus', he: 'פלוס', ar: 'بلس', ru: 'Плюс', fr: 'Plus', es: 'Plus' },
  PREMIUM: { en: 'Premium', he: 'פרימיום', ar: 'بريميوم', ru: 'Премиум', fr: 'Premium', es: 'Premium' },
  ELITE: { en: 'Maison', he: 'מזון', ar: 'ميزون', ru: 'Мезон', fr: 'Maison', es: 'Maison' },
};

function tx(key: string, lang: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['en'] || key;
}

function LuxuryGiftCard({ 
  option,
  onClick,
  selected,
  lang,
  occasion
}: { 
  option: typeof giftOptions[0];
  onClick: () => void;
  selected?: boolean;
  lang: string;
  occasion?: CardOccasion;
}) {
  const formattedValue = option.value >= 1000 
    ? `${(option.value / 1000).toFixed(0)},000` 
    : `${option.value}`;

  const isElite = option.tier === 'ELITE';
  const isPremium = option.tier === 'PREMIUM';
  const tierLabel = tierLabels[option.tier]?.[lang] || tierLabels[option.tier]?.en || option.tier;
  const cardImg = cardImages[option.tier] || cardImages.CLASSIC;
  const occasionLabel = occasion ? (occasion.labels[lang] || occasion.labels.en) : null;

  return (
    <button 
      type="button"
      className="relative w-full text-left transition-all duration-300 group"
      onClick={onClick}
      data-testid={`egift-card-${option.value}`}
    >
      <div className="relative overflow-hidden transition-all duration-500"
        style={{
          borderRadius: '3px',
          background: '#FFFFFF',
          border: selected 
            ? '2px solid #c9a96e'
            : '1px solid #E8E3D9',
          boxShadow: selected ? '0 0 20px rgba(201,169,110,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        {selected && (
          <div className="absolute top-3 end-3 z-10">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #c9a96e, #d4af37)' }}>
              <Check className="w-3.5 h-3.5 text-[#0f0d08]" strokeWidth={2.5} />
            </div>
          </div>
        )}

        {isElite && (
          <div className="absolute top-3 start-3 z-10">
            <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 font-semibold text-[#0f0d08]"
              style={{ borderRadius: '2px', background: 'linear-gradient(90deg, #c9a96e, #d4af37)' }}>
              {tx('bestValue', lang)}
            </span>
          </div>
        )}

        <div className="relative overflow-hidden bg-white" style={{ aspectRatio: '1120 / 928' }}>
          {occasion && (
            <div className="absolute top-2 start-2 z-[5]">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm"
                style={{ background: 'rgba(255,255,255,0.85)', border: `1px solid ${occasion.borderColor}50` }}>
                <occasion.icon className="w-3 h-3" style={{ color: occasion.borderColor }} strokeWidth={2} />
                <span className="text-[8px] font-medium tracking-wide" style={{ color: occasion.borderColor }}>
                  {occasionLabel}
                </span>
              </div>
            </div>
          )}
          <img
            src={cardImg}
            alt={`\u2066PetWash™\u2069 ${tierLabel} E-Gift Card - ₪${option.value}`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>

        <div className="px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium text-[#c9a96e]">
              {tierLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-[11px] sm:text-xs text-[#6a5f42]">₪</span>
            <span className="text-2xl sm:text-3xl lg:text-[2.2rem] font-light text-[#F0EBE0]"
              style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
              {formattedValue}
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-[#5a5040]">
            {tx('eGiftCredit', lang)}
          </p>

          <div className="border-t pt-2 mt-2" style={{ borderColor: '#E8E3D9' }}>
            <div className="space-y-1 text-[#7a6e55]">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 shrink-0 text-[#c9a96e]" strokeWidth={1.5} />
                <span className="text-[9px] sm:text-[10px]">{tx('allServices', lang)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 shrink-0 text-[#c9a96e]" strokeWidth={1.5} />
                <span className="text-[9px] sm:text-[10px]">{tx('valid12Months', lang)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function EGift() {
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const lang = language;
  const isRtl = dir === 'rtl';

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedValue = urlParams.get('value');
  const preselectedOption = preselectedValue 
    ? giftOptions.find(o => o.value === parseInt(preselectedValue)) || null
    : null;

  const [selectedOption, setSelectedOption] = useState<typeof giftOptions[0] | null>(preselectedOption);
  const [selectedServices, setSelectedServices] = useState<string[]>(['wash', 'sitter', 'walk', 'trek', 'academy', 'nayax']);
  const [step, setStep] = useState<'select' | 'checkout' | 'shared'>('select');
  const [purchasedGift, setPurchasedGift] = useState<{
    giftCardId: string;
    publicCode: string;
    recipientName: string;
    amountILS: number;
  } | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<CardOccasion | null>(null);
  const [messageLang, setMessageLang] = useState(messageLanguages.find(ml => ml.code === lang) || messageLanguages[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Phase E — quiet the FloatingStack (WhatsApp / Accessibility / AI
  // buttons) while the egift hero is in view. Sets a body data
  // attribute that floating-stack.css fades on. Scope: /egift only.
  // No effect on any other route.
  const heroRef = useRef<HTMLDivElement>(null);
  useEgiftHeroSuppressFloating(heroRef);

  const [formData, setFormData] = useState({
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    senderEmail: '',
    message: ''
  });

  // Pre-fill sender details from profile (best-effort — works if logged in)
  const { data: userProfile } = useQuery<{
    displayName?: string; email?: string; firstName?: string; lastName?: string;
  }>({
    queryKey: ['/api/user/profile'],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (userProfile) {
      const name = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
        || userProfile.displayName || '';
      setFormData(prev => ({
        ...prev,
        senderName: prev.senderName || name,
        senderEmail: prev.senderEmail || userProfile.email || '',
      }));
    }
  }, [userProfile]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.recipientName.trim()) {
      newErrors.recipientName = tx('required', lang);
    }
    if (!formData.recipientEmail.trim()) {
      newErrors.recipientEmail = tx('required', lang);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail)) {
      newErrors.recipientEmail = tx('invalidEmail', lang);
    }
    if (!formData.senderName.trim()) {
      newErrors.senderName = tx('required', lang);
    }
    if (!formData.senderEmail.trim()) {
      newErrors.senderEmail = tx('required', lang);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.senderEmail)) {
      newErrors.senderEmail = tx('invalidEmail', lang);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCardClick = (option: typeof giftOptions[0]) => {
    setSelectedOption(option);
    setIsCustom(false);
    setCustomAmount('');
  };

  const handleCustomAmount = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    setCustomAmount(num);
    const parsed = parseInt(num);
    if (parsed >= 50 && parsed <= 5000) {
      setSelectedOption({ value: parsed, tier: parsed >= 750 ? 'ELITE' : parsed >= 400 ? 'PREMIUM' : parsed >= 200 ? 'PLUS' : 'CLASSIC' });
    } else {
      setSelectedOption(null);
    }
  };

  const proceedToCheckout = () => {
    if (!selectedOption) {
      toast({ title: tx('selectCard', lang), variant: "destructive" });
      return;
    }
    setStep('checkout');
  };

  const handleCheckout = async () => {
    if (!validateForm()) {
      toast({ title: tx('fillRequired', lang), variant: "destructive" });
      return;
    }

    if (!selectedOption || isProcessing) return;

    const finalPrice = selectedOption.value;
    setIsProcessing(true);

    try {
      const response = await fetch(getApiUrl('/api/multi-service-gift'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: finalPrice,
          currency: 'ILS',
          recipientName: formData.recipientName,
          recipientEmail: formData.recipientEmail,
          senderName: formData.senderName,
          senderEmail: formData.senderEmail,
          message: formData.message,
          occasion: selectedOccasion?.id || 'justbecause',
          messageLanguage: messageLang.code,
          eligibleServices: selectedServices
        })
      });

      const data = await response.json();

      // Payment gateway offline — surface a clear bilingual message instead of a generic error
      if (response.status === 503) {
        toast({
          title: lang === 'he' ? 'מערכת התשלום אינה זמינה כרגע' : 'Payment gateway temporarily unavailable',
          description: lang === 'he'
            ? 'אנא צרו קשר עם התמיכה לרכישת כרטיס מתנה.'
            : 'Please contact support to purchase a gift card.',
          variant: 'destructive',
        });
        return;
      }

      if (response.ok && data.success) {
        setPurchasedGift({
          giftCardId: data.giftCardId,
          publicCode: data.publicCode,
          recipientName: formData.recipientName,
          amountILS: finalPrice,
        });
        setStep('shared');
      } else {
        toast({ 
          title: tx('errorCreating', lang), 
          description: data.message || data.error || tx('tryAgain', lang),
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: tx('errorProcessing', lang), 
        description: tx('tryAgainLater', lang),
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(s => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  const applySuggestedMessage = (msg: string) => {
    setFormData(prev => ({ ...prev, message: msg }));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  const previewSerial = useMemo(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = 'PWL';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }, [step]);

  // ── T001: Gift sent → share panel (viral loop) ──────────────────────────
  if (step === 'shared' && purchasedGift) {
    const activationUrl = `${window.location.origin}/gift/activate/${purchasedGift.giftCardId}`;
    const whatsappText = isRtl
      ? `היי ${purchasedGift.recipientName}! 🐾 שלחתי לך מתנה של ₪${purchasedGift.amountILS} לשירותי PetWash! לחץ/י כאן כדי לפתוח את המתנה:\n${activationUrl}`
      : `Hey ${purchasedGift.recipientName}! 🐾 I sent you a ₪${purchasedGift.amountILS} PetWash gift! Tap to activate:\n${activationUrl}`;
    const smsText = whatsappText;

    const handleCopy = async () => {
      await navigator.clipboard.writeText(activationUrl);
      toast({ title: isRtl ? 'הקישור הועתק!' : 'Link copied!' });
    };

    const handleNativeShare = () => {
      if (navigator.share) {
        navigator.share({
          title: isRtl ? 'מתנה מ-PetWash! 🐾' : 'A PetWash gift for you! 🐾',
          text: whatsappText,
          url: activationUrl,
        }).catch(() => {});
      } else {
        handleCopy();
      }
    };

    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#FFFFFF' }}>
          <div className="max-w-md w-full text-center">
            {/* Celebration graphic */}
            <div className="text-7xl mb-6">🎁</div>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
              {isRtl ? 'המתנה נשלחה!' : 'Gift Sent!'}
            </h1>
            <p className="text-gray-500 mb-1 text-sm">
              {isRtl
                ? `שלחנו אימייל ל-${purchasedGift.recipientName}`
                : `We emailed ${purchasedGift.recipientName}`}
            </p>
            <p className="text-gray-400 text-xs mb-8">
              {isRtl ? 'שתף/י את הקישור הזה ישירות לקבלה מהירה יותר' : 'Share this link directly for instant delivery'}
            </p>

            {/* Activation link box */}
            <div className="flex items-center gap-2 mb-6 p-3 rounded-xl" style={{ background: '#F5F0E8', border: '1px solid #E8E3D9' }}>
              <span className="flex-1 text-xs text-gray-600 truncate text-left">{activationUrl}</span>
              <button
                onClick={handleCopy}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                style={{ background: '#C5A55A' }}
              >
                {isRtl ? 'העתק' : 'Copy'}
              </button>
            </div>

            {/* Share buttons */}
            <div className="space-y-3 mb-8">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-95"
                style={{ background: '#25D366' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                {isRtl ? 'שתף בוואטסאפ' : 'Share on WhatsApp'}
              </a>

              {/* SMS (native share or sms:) */}
              <a
                href={`sms:?body=${encodeURIComponent(smsText)}`}
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: '#F5F0E8', color: '#1A1A1A', border: '1px solid #E8E3D9' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {isRtl ? 'שלח כ-SMS' : 'Send via SMS'}
              </a>

              {/* Native share (mobile) */}
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: '#F5F0E8', color: '#1A1A1A', border: '1px solid #E8E3D9' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {isRtl ? 'שיתוף נוסף...' : 'More sharing options...'}
              </button>
            </div>

            {/* Code display */}
            <p className="text-xs text-gray-400 mb-1">
              {isRtl ? 'קוד המתנה' : 'Gift Code'}
            </p>
            <p className="font-mono font-bold text-lg text-gray-700 mb-8 tracking-widest">
              {purchasedGift.publicCode}
            </p>

            {/* Send another */}
            <button
              onClick={() => {
                setStep('select');
                setSelectedOption(null);
                setSelectedOccasion(null);
                setIsCustom(false);
                setCustomAmount('');
                setFormData({ recipientName: '', recipientEmail: '', senderName: '', senderEmail: '', message: '' });
                setPurchasedGift(null);
              }}
              className="text-sm font-medium underline"
              style={{ color: '#C5A55A' }}
            >
              {isRtl ? 'שלח מתנה נוספת' : 'Send another gift'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (step === 'checkout' && selectedOption) {
    const finalPrice = selectedOption.value;
    const formattedValue = finalPrice >= 1000 
      ? `₪${(finalPrice / 1000).toFixed(0)},000` 
      : `₪${finalPrice}`;
    const tierLabel = tierLabels[selectedOption.tier]?.[lang] || tierLabels[selectedOption.tier]?.en;
    const occasionLabel = selectedOccasion ? (selectedOccasion.labels[lang] || selectedOccasion.labels.en) : null;
    const suggestions = selectedOccasion?.messageSuggestions[messageLang.code] || selectedOccasion?.messageSuggestions.en || [];

    return (
      <Layout>
      <div className="min-h-screen bg-stage-white" dir={dir}>
        <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12 lg:py-16 max-w-5xl">
          {/* Checkout form view — Phase B: back button uses ink-400; container
              border softens from warm beige #E8E3D9 to a thin ink hairline.
              H2 weight aligns with hero (font-extralight) and uses ink-900. */}
          <Button
            variant="ghost"
            onClick={() => setStep('select')}
            className="mb-4 sm:mb-6 md:mb-8 text-ink-400 hover:bg-stage-50 hover:text-ink-800"
            data-testid="button-back"
          >
            <BackIcon className="w-4 h-4" />
            <span className={isRtl ? 'mr-1' : 'ml-1'}>{tx('back', lang)}</span>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
            <div className="order-2 lg:order-1">
              <div
                className="p-5 sm:p-7 md:p-8 bg-stage-white"
                style={{ borderRadius: '3px', border: '1px solid rgba(10,10,10,0.10)' }}
              >
                <h2
                  className="text-lg sm:text-xl md:text-2xl font-extralight mb-6 text-ink-900"
                  style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: '-0.02em' }}
                >
                  {tx('expressCheckout', lang)}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recipientName" className="text-[11px] md:text-[12px] tracking-[0.08em] uppercase font-medium text-ink-800">{tx('recipientName', lang)} *</Label>
                    <Input
                      id="recipientName"
                      placeholder={tx('recipientNamePlaceholder', lang)}
                      value={formData.recipientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                      className={`mt-1.5 rounded-none text-[16px] focus:ring-0 ${errors.recipientName ? '!border-red-500' : ''}`}
                      style={{ background: '#FFFFFF', border: `1px solid ${errors.recipientName ? '#ef4444' : 'rgba(10,10,10,0.12)'}`, color: '#0A0A0A' }}
                      data-testid="input-recipient-name"
                      dir={dir}
                      autoComplete="given-name"
                      autoCapitalize="words"
                      spellCheck={false}
                      enterKeyHint="next"
                      lang={lang}
                    />
                    {errors.recipientName && <p className="text-[10px] text-red-400 mt-1">{errors.recipientName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="recipientEmail" className="text-[11px] md:text-[12px] tracking-[0.08em] uppercase font-medium text-ink-800">{tx('recipientEmail', lang)} *</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      inputMode="email"
                      placeholder={tx('recipientEmailPlaceholder', lang)}
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                      className={`mt-1.5 rounded-none text-[16px] focus:ring-0`}
                      style={{ background: '#FFFFFF', border: `1px solid ${errors.recipientEmail ? '#ef4444' : 'rgba(10,10,10,0.12)'}`, color: '#0A0A0A' }}
                      data-testid="input-recipient-email"
                      dir="ltr"
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="next"
                    />
                    {errors.recipientEmail && <p className="text-[10px] text-red-400 mt-1">{errors.recipientEmail}</p>}
                  </div>

                  <div>
                    <Label htmlFor="senderName" className="text-[11px] md:text-[12px] tracking-[0.08em] uppercase font-medium text-ink-800">{tx('yourName', lang)} *</Label>
                    <Input
                      id="senderName"
                      placeholder={tx('yourNamePlaceholder', lang)}
                      value={formData.senderName}
                      onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                      className={`mt-1.5 rounded-none text-[16px] focus:ring-0`}
                      style={{ background: '#FFFFFF', border: `1px solid ${errors.senderName ? '#ef4444' : 'rgba(10,10,10,0.12)'}`, color: '#0A0A0A' }}
                      data-testid="input-sender-name"
                      dir={dir}
                      autoComplete="name"
                      autoCapitalize="words"
                      spellCheck={false}
                      enterKeyHint="next"
                      lang={lang}
                    />
                    {errors.senderName && <p className="text-[10px] text-red-400 mt-1">{errors.senderName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="senderEmail" className="text-[11px] md:text-[12px] tracking-[0.08em] uppercase font-medium text-ink-800">{tx('yourEmail', lang)} *</Label>
                    <Input
                      id="senderEmail"
                      type="email"
                      inputMode="email"
                      placeholder={tx('yourEmailPlaceholder', lang)}
                      value={formData.senderEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                      className={`mt-1.5 rounded-none text-[16px] focus:ring-0`}
                      style={{ background: '#FFFFFF', border: `1px solid ${errors.senderEmail ? '#ef4444' : 'rgba(10,10,10,0.12)'}`, color: '#0A0A0A' }}
                      data-testid="input-sender-email"
                      dir="ltr"
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="next"
                    />
                    {errors.senderEmail && <p className="text-[10px] text-red-400 mt-1">{errors.senderEmail}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      {/* Message label + language picker — Phase B: label uses ink-800;
                          inactive flag buttons use ink-400; active flag uses ink-900 fill. */}
                      <Label htmlFor="message" className="text-[11px] md:text-[12px] tracking-[0.08em] uppercase font-medium text-ink-800">
                        {tx('personalMessage', lang)}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-ink-400" />
                        <div className="flex gap-0.5">
                          {messageLanguages.map((ml) => (
                            <button
                              key={ml.code}
                              type="button"
                              onClick={() => setMessageLang(ml)}
                              className={`px-1.5 py-0.5 text-[10px] rounded transition-all duration-200 touch-manipulation ${
                                messageLang.code === ml.code
                                  ? 'bg-ink-900 text-white shadow-sm'
                                  : 'bg-transparent text-ink-400 hover:text-ink-800 hover:bg-stage-50'
                              }`}
                              title={ml.label}
                              data-testid={`msg-lang-${ml.code}`}
                            >
                              {ml.flag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {suggestions.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[9px] md:text-[10px] tracking-[0.1em] uppercase mb-1.5 text-ink-800">{tx('suggestedMessages', lang)}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.map((msg, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => applySuggestedMessage(msg)}
                              className="px-3 py-1.5 text-[10px] sm:text-[11px] md:text-[12px] transition-all duration-200 rounded-full touch-manipulation leading-relaxed"
                              style={{ maxWidth: '100%', background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.10)', color: '#0F0F0F' }}
                              dir={messageLang.dir}
                            >
                              {msg.length > 50 ? msg.substring(0, 50) + '...' : msg}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Textarea
                      ref={textareaRef}
                      id="message"
                      placeholder={tx('messagePlaceholder', messageLang.code)}
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="mt-0 rounded-none text-[16px] min-h-[100px] resize-none leading-relaxed focus:ring-0"
                      style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.12)', color: '#0A0A0A' }}
                      data-testid="input-message"
                      dir={messageLang.dir}
                      lang={messageLang.inputLang}
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      spellCheck={true}
                      enterKeyHint="done"
                    />
                    <p className="text-[9px] md:text-[10px] mt-1 text-end text-ink-400">
                      {messageLang.flag} {messageLang.label}
                    </p>
                  </div>
                </div>

                {/* Redeemable-at chip strip — Phase B2: ink-900 label, ink hairline,
                    ink-900 chips. ZERO gold. */}
                <div className="mt-5 p-4 bg-stage-white" style={{ borderRadius: '2px', border: '1px solid rgba(10,10,10,0.10)' }}>
                  <p className="text-[10px] md:text-[11px] tracking-[0.1em] uppercase font-semibold mb-2 text-ink-900">{tx('redeemableAt', lang)}</p>
                  <div className="flex flex-wrap gap-2">
                    {platformServices.filter(s => selectedServices.includes(s.id)).map(service => (
                      <span
                        key={service.id}
                        className="px-2.5 py-1 text-[10px] sm:text-[11px] md:text-[12px] tracking-wide text-ink-900 bg-stage-white"
                        style={{ border: '1px solid rgba(10,10,10,0.15)' }}
                      >
                        {service.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pay & Send CTA — Phase B2: solid ink-900 rectangle. */}
                <Button
                  className="w-full py-4 md:py-[18px] mt-5 text-[11px] md:text-[12px] tracking-[0.18em] uppercase font-semibold transition-all duration-300 flex items-center justify-center gap-2 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed bg-ink-900 text-stage-white hover:bg-black"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  data-testid="button-checkout"
                  style={{ borderRadius: '2px' }}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {tx('payAndSend', lang)} {formattedValue}
                      <ForwardIcon className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>

                <p className="text-[10px] md:text-[11px] text-center mt-3 tracking-wide text-ink-400">
                  {tx('secureCheckout', lang)}
                </p>

                <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(10,10,10,0.10)' }}>
                  <PaymentMethods language={lang} size="sm" />
                </div>
              </div>
            </div>

            {/* Sidebar preview card — Phase B: stage-white surface, ink hairline
                border (or occasion-color hairline when occasion selected), gold-luxe
                label, ink-900 price. md: padding rhythm. */}
            <div className="order-1 lg:order-2">
              <div className="w-full mx-auto lg:sticky lg:top-8">
                <div
                  className="p-4 sm:p-5 md:p-6 lg:p-6 bg-stage-white shadow-stage-lifted"
                  style={{
                    borderRadius: '8px',
                    background: selectedOccasion ? 'rgba(255,255,255,0.96)' : '#FFFFFF',
                    border: selectedOccasion ? `1.5px solid ${selectedOccasion.borderColor}40` : '1px solid rgba(10,10,10,0.10)',
                  }}
                >
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {selectedOccasion && (
                      <selectedOccasion.icon className="w-4 h-4" style={{ color: selectedOccasion.borderColor }} strokeWidth={1.5} />
                    )}
                    <p className="text-[10px] md:text-[11px] tracking-[0.25em] uppercase text-ink-900 font-semibold text-center">
                      {tx('eGiftCard', lang)} · {tierLabel}
                    </p>
                  </div>
                  {occasionLabel && (
                    <p className="text-[11px] text-center mb-3 font-medium" style={{ color: selectedOccasion?.borderColor }}>
                      {occasionLabel}
                    </p>
                  )}
                  <div className="relative rounded-lg overflow-hidden" style={{ filter: 'drop-shadow(0 16px 36px rgba(0,0,0,0.15))' }}>
                    <div className="relative" style={{ aspectRatio: '1120 / 928' }}>
                      <img
                        src={cardImages[selectedOption.tier] || cardImages.CLASSIC}
                        alt={`\u2066PetWash™\u2069 ${tierLabel} E-Gift Card`}
                        className="w-full h-full object-cover"
                      />
                      {formData.recipientName.trim() && (
                        <p className="absolute bottom-4 end-5 text-white font-semibold text-sm sm:text-base tracking-wide truncate drop-shadow-md max-w-[60%] text-end"
                          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                          {formData.recipientName.toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-center mt-5">
                    <p
                      className="text-3xl sm:text-4xl md:text-[2.4rem] font-extralight mb-1 text-ink-900"
                      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: '-0.04em' }}
                    >
                      {formattedValue}
                    </p>
                    <p className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-ink-900">
                      {tx('eGiftCredit', lang)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[9px] md:text-[10px] tracking-wide text-ink-400">
                      <span>SN: {previewSerial}</span>
                      <span>{lang === 'he' ? 'תוקף: 24 חודשים' : 'Valid: 24 months'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-[11px] md:text-[12px] text-ink-900">{tx('worksAtAll', lang)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="min-h-screen bg-stage-white" dir={dir}>
      <div className="container mx-auto px-4 py-8 sm:py-10 md:py-12 lg:py-16">

        {/* ── Hero — Phase B2 direction correction (Cartier/LV/Apple posture):
             SVG ribbon decorations REMOVED entirely. Card tier label boxes
             monochrome (PREMIUM white, ELITE solid black). One moment of brand
             gold preserved on the "PetWash Premium" callout. H1 in Cormorant
             Garamond (Cartier-Didot precision, replacing Playfair Display
             editorial mood). Vertical rhythm tightened ~30%.

             Phase E — heroRef is observed by useEgiftHeroSuppressFloating
             so the FloatingStack (WhatsApp / Accessibility / AI) fades out
             while this hero is in view. */}
        <div ref={heroRef} className="relative w-full bg-stage-white mb-10 sm:mb-12 md:mb-14">
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 md:gap-10 px-6 py-8 md:px-10 md:py-10 lg:px-12 lg:py-12">
            <div className="flex-shrink-0 flex gap-3 md:gap-4">
              {['PREMIUM', 'ELITE'].map(tier => {
                const isElite = tier === 'ELITE';
                return (
                  <div
                    key={tier}
                    className={`w-28 h-16 sm:w-36 sm:h-20 md:w-40 md:h-[88px] rounded-sm flex items-center justify-center shadow-stage-soft ${
                      isElite ? 'bg-ink-900' : 'bg-stage-white border border-ink-900/12'
                    }`}
                  >
                    <span
                      className={`text-[10px] md:text-[11px] tracking-[0.2em] uppercase font-semibold ${
                        isElite ? 'text-stage-white' : 'text-ink-900'
                      }`}
                      style={{ fontFamily: 'serif' }}
                    >
                      PetWash
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[10px] md:text-[12px] tracking-[0.4em] uppercase mb-3 font-semibold text-ink-900">
                PetWash™ Premium
              </p>
              <h2
                className="text-2xl sm:text-3xl md:text-[2.1rem] lg:text-[2.4rem] font-extralight mb-2 text-ink-900"
                style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: '-0.03em' }}
              >
                {lang === 'he' ? 'כרטיסי מתנה דיגיטליים' : 'eGIFT CARDS'}
              </h2>
              <p className="text-sm md:text-[15px] lg:text-base max-w-sm md:max-w-md leading-relaxed text-ink-900">
                {lang === 'he'
                  ? 'שלח את מתנת הבחירה שלך עם כרטיס מתנה של PetWash'
                  : 'Send the gift of choice with a PetWash eGift Card'}
              </p>
              <p className="text-xs md:text-[13px] mt-2 leading-relaxed text-ink-400">
                {lang === 'he'
                  ? 'ניתן לפדות בתחנת שטיפה או באפליקציה. נשלח למייל בתאריך שתבחר.'
                  : 'Redeemable at any wash station or online. Delivered to email on your chosen date.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── 3-Step Flow — Phase B2: numerals + connector flat ink (no gold).
             H1 font swap propagates: numerals use Cormorant Garamond. Tighter
             vertical rhythm. */}
        <div className="mb-10 sm:mb-12 md:mb-14">
          <div className="grid grid-cols-3 gap-0 max-w-2xl mx-auto relative">
            {/* Connector — restrained ink hairline */}
            <div className="absolute top-7 left-[33%] right-[33%] h-px bg-ink-900/12" />
            {[
              { num: '1', label: lang === 'he' ? 'בחר כרטיס' : 'Choose Your Card', sub: lang === 'he' ? 'בחר עיצוב מועדף' : 'Select your preferred design' },
              { num: '2', label: lang === 'he' ? 'התאמה אישית' : 'Personalise', sub: lang === 'he' ? 'הוסף הודעה ואת שם הנמען' : 'Add a message & recipient details' },
              { num: '3', label: lang === 'he' ? 'שלח' : 'Schedule & Send', sub: lang === 'he' ? 'בחר מועד שליחה' : 'Deliver today or schedule later' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center text-center px-2">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-3 relative z-10 bg-stage-white"
                  style={{ border: '1px solid rgba(10,10,10,0.12)' }}
                >
                  <span className="text-base font-light text-ink-900">{s.num}</span>
                </div>
                <p className="text-xs md:text-[13px] font-semibold mb-1 text-ink-900">{s.label}</p>
                <p className="text-[10px] md:text-[11px] leading-snug text-ink-900">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Page title block — Phase B2 direction correction:
             - Removed the gold-hairline+gift-icon decoration (pure ornament).
             - Section label "PLATFORM CREDIT" moved from text-gold-luxe to
               text-ink-900 (Apple/LV editorial caps, no gold).
             - H1 font swapped from Playfair Display to Cormorant Garamond.
             - Description body promoted from text-ink-800 to text-ink-900. */}
        <div className="text-center mb-10 sm:mb-12 md:mb-14">
          <p className="text-[10px] sm:text-[11px] md:text-[12px] tracking-[0.4em] uppercase mb-5 font-semibold text-ink-900">
            {tx('platformCredit', lang)}
          </p>

          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.2rem] mb-6 px-4 font-extralight leading-tight text-ink-900"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: '-0.035em' }}
          >
            {tx('title', lang)}
          </h1>
          <p
            className="text-sm sm:text-[15px] md:text-base lg:text-[17px] max-w-lg md:max-w-xl mx-auto leading-relaxed text-ink-900"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {tx('description', lang)}
          </p>
        </div>

        <div className="max-w-[1040px] mx-auto">
          {/* Occasion chips — Phase B2: section label moved to text-ink-900
              (Cartier/LV editorial caps). Selected chips keep their occasion
              color — that is the emotional accent. */}
          <div className="mb-8 sm:mb-10 md:mb-12">
            <p className="text-[10px] md:text-[12px] tracking-[0.4em] uppercase font-semibold text-ink-900 mb-4 text-center">
              {tx('chooseOccasion', lang)}
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-3.5">
              {cardOccasions.map((occasion) => {
                const OccIcon = occasion.icon;
                const isSelected = selectedOccasion?.id === occasion.id;
                const label = occasion.labels[lang] || occasion.labels.en;
                return (
                  <button
                    key={occasion.id}
                    type="button"
                    onClick={() => {
                      setSelectedOccasion(isSelected ? null : occasion);
                      if (!isSelected) {
                        toast({ title: tx('occasionSelected', lang), description: label });
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 md:px-6 md:py-3.5 text-[11px] sm:text-xs md:text-[13px] tracking-[0.05em] font-medium transition-all duration-300 touch-manipulation ${
                      isSelected
                        ? 'text-white shadow-stage-lifted scale-[1.02]'
                        : 'hover:shadow-stage-soft hover:scale-[1.01]'
                    }`}
                    style={{
                      borderRadius: '100px',
                      border: isSelected ? `2px solid ${occasion.borderColor}` : '1.5px solid rgba(10,10,10,0.10)',
                      background: isSelected ? occasion.borderColor : '#FFFFFF',
                      color: isSelected ? '#fff' : '#0F0F0F',
                    }}
                    data-testid={`occasion-${occasion.id}`}
                  >
                    <OccIcon className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={isSelected ? 2.5 : 1.5} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service toggles — Phase B2: ZERO gold, ZERO cream. Unselected pills
              are pure white with thin ink hairline + ink-900 text. Selected pills
              fill solid ink-900 with white text. Apple/LV chip discipline. */}
          <div className="mb-8 sm:mb-10 md:mb-12">
            <p className="text-[10px] md:text-[12px] tracking-[0.4em] uppercase font-semibold text-ink-900 mb-3 text-center">
              {tx('usableAt', lang)}
            </p>
            <div className="flex flex-wrap justify-center gap-2 md:gap-2.5">
              {platformServices.map(service => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`px-3 sm:px-4 md:px-5 py-2 md:py-2.5 text-[10px] sm:text-[11px] md:text-[12px] tracking-[0.08em] font-medium transition-all duration-200 touch-manipulation ${
                      isSelected ? 'bg-ink-900 text-stage-white border border-ink-900' : 'bg-stage-white text-ink-900 border border-ink-900/15'
                    }`}
                    style={{ borderRadius: '2px' }}
                    data-testid={`service-toggle-${service.id}`}
                  >
                    {service.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Choose Value section label — Phase B2: ink-900 (no gold). */}
          <div className="mb-3 text-center">
            <p className="text-[10px] md:text-[12px] tracking-[0.4em] uppercase font-semibold text-ink-900 mb-4">
              {tx('chooseValue', lang)}
            </p>
          </div>

          {/* Gift options grid — Phase B Decision B: 2-up mobile, 3-up iPad
              portrait (md:grid-cols-3), 4-up desktop (lg:grid-cols-4). Cards
              keep their internal artwork and typography (out of scope). iPhone
              base stays at 2-up so cards stay readable and not squeezed. */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-7">
            {giftOptions.map((option) => (
              <LuxuryGiftCard
                key={option.value}
                option={option}
                onClick={() => handleCardClick(option)}
                selected={!isCustom && selectedOption?.value === option.value}
                lang={lang}
                occasion={selectedOccasion || undefined}
              />
            ))}
          </div>

          {/* Security footer — Phase B2: ink-900 (no gold). */}
          <div className="mt-6 sm:mt-8 md:mt-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3 h-3 text-ink-900" strokeWidth={1.5} />
              <span className="text-[9px] sm:text-[10px] md:text-[11px] tracking-[0.12em] uppercase text-ink-900 font-medium">
                {lang === 'he' ? 'אמצעי תשלום מאובטחים' : 'Secure Payment Methods'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
              <img className="h-[20px] sm:h-[24px] w-auto object-contain" src="/pay/payment-methods.jpg" alt="Visa, Mastercard, American Express, Apple Pay, Google Pay" loading="lazy" />
              <img className="h-[14px] sm:h-[16px] w-auto object-contain" src="/pay/diners.jpg" alt="Diners Club" loading="lazy" />
            </div>
            <div className="flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[8px] sm:text-[9px] font-bold text-white">
                Powered by <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Nayax</span> Israel
              </span>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 max-w-md mx-auto">
            <Button
              type="button"
              onClick={() => {
                setIsCustom(!isCustom);
                if (!isCustom) {
                  setSelectedOption(null);
                }
              }}
              className={`w-full py-3 md:py-3.5 text-[11px] md:text-[12px] tracking-[0.12em] uppercase font-medium transition-all duration-200 touch-manipulation flex items-center justify-center gap-2 ${
                isCustom ? 'bg-ink-900 text-stage-white border border-ink-900' : 'bg-stage-white text-ink-900 border border-ink-900/15'
              }`}
              style={{ borderRadius: '2px' }}
              data-testid="button-custom-amount"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tx('customAmount', lang)}
            </Button>

            {isCustom && (
              <div className="mt-3 relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-900 text-sm pointer-events-none">₪</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={tx('enterAmount', lang)}
                  value={customAmount}
                  onChange={(e) => handleCustomAmount(e.target.value)}
                  className="ps-8 rounded-none text-[16px] text-center focus:ring-0"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.12)', color: '#0A0A0A' }}
                  dir="ltr"
                  autoFocus
                  enterKeyHint="done"
                  data-testid="input-custom-amount"
                />
                {customAmount && (parseInt(customAmount) < 50 || parseInt(customAmount) > 5000) && (
                  <p className="text-[10px] text-amber-600 mt-1 text-center">₪50 - ₪5,000</p>
                )}
              </div>
            )}
          </div>

          {selectedOption && (
            <div className="mt-8 sm:mt-10 md:mt-12 text-center">
              {/* Proceed CTA — Phase B2: solid ink-900 rectangle with white text.
                  Apple/LV/Cartier confidence. Sharp rounded-[2px] corners, no
                  shadow, no gradient. */}
              <Button
                className="px-10 sm:px-14 md:px-16 py-4 md:py-[18px] text-[11px] md:text-[12px] tracking-[0.18em] uppercase font-semibold transition-all duration-300 inline-flex items-center gap-2.5 touch-manipulation bg-ink-900 text-stage-white hover:bg-black"
                onClick={proceedToCheckout}
                data-testid="button-proceed-checkout"
                style={{ borderRadius: '2px' }}
              >
                {tx('continueCheckout', lang)}
                <ForwardIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Trust badge row — Phase B2: hairlines + check icons + labels all
              ink-900. ZERO gold tint on check circles (was rgba(168,139,76,0.06)).
              Tighter top margin. */}
          <div className="mt-10 sm:mt-14 md:mt-16">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10 md:gap-12 max-w-xl md:max-w-2xl mx-auto">
              {[tx('allServices', lang), tx('valid12Months', lang), tx('noAccountRequired', lang), tx('instantDelivery', lang)].map((label) => (
                <div key={label} className="text-center">
                  <div
                    className="w-9 h-9 md:w-10 md:h-10 mx-auto mb-2.5 rounded-full flex items-center justify-center bg-stage-white"
                    style={{ border: '1px solid rgba(10,10,10,0.12)' }}
                  >
                    <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-ink-900" strokeWidth={1.5} />
                  </div>
                  <p className="text-[10px] md:text-[11px] tracking-[0.08em] font-medium uppercase text-ink-900">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
