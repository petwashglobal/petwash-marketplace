import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Gift, Check, ShieldCheck, Heart, Star, PartyPopper, Sparkles, Globe, Lock } from 'lucide-react';
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
      <div className="relative overflow-hidden transition-all duration-500 bg-white hover:shadow-xl hover:shadow-black/[0.06]"
        style={{
          borderRadius: '2px',
          border: selected 
            ? '2.5px solid #1a1a1a' 
            : '1px solid #eee',
        }}
      >
        {selected && (
          <div className="absolute top-3 end-3 z-10">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#1a1a1a] shadow-lg">
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
          </div>
        )}

        {isElite && (
          <div className="absolute top-3 start-3 z-10">
            <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 bg-[#c9a96e] text-white font-medium" style={{ borderRadius: '2px' }}>
              {tx('bestValue', lang)}
            </span>
          </div>
        )}

        <div className="relative overflow-hidden bg-[#f5f5f3]" style={{ aspectRatio: '1120 / 928' }}>
          {occasion && (
            <div className="absolute top-2 start-2 z-[5]">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm">
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
            <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
              isElite || isPremium ? 'text-[#c9a96e]' : 'text-[#999]'
            }`}>
              {tierLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-[11px] sm:text-xs text-[#999]">₪</span>
            <span className="text-2xl sm:text-3xl lg:text-[2.2rem] font-light text-[#1a1a1a]"
              style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
              {formattedValue}
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-[#aaa]">
            {tx('eGiftCredit', lang)}
          </p>

          <div className="border-t border-[#eee] pt-2 mt-2">
            <div className="space-y-1 text-[#888]">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                <span className="text-[9px] sm:text-[10px]">{tx('allServices', lang)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
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
  const [step, setStep] = useState<'select' | 'checkout'>('select');
  const [selectedOccasion, setSelectedOccasion] = useState<CardOccasion | null>(null);
  const [messageLang, setMessageLang] = useState(messageLanguages.find(ml => ml.code === lang) || messageLanguages[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    senderEmail: '',
    message: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

    if (!selectedOption) return;

    const finalPrice = selectedOption.value;

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

      if (response.ok && data.success) {
        toast({ 
          title: tx('giftCreated', lang), 
          description: `${tx('giftCode', lang)} ${data.publicCode}` 
        });
        setFormData({ recipientName: '', recipientEmail: '', senderName: '', senderEmail: '', message: '' });
        setSelectedOption(null);
        setSelectedOccasion(null);
        setIsCustom(false);
        setCustomAmount('');
        setStep('select');
      } else {
        toast({ 
          title: tx('errorCreating', lang), 
          description: data.message || tx('tryAgain', lang),
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: tx('errorProcessing', lang), 
        description: tx('tryAgainLater', lang),
        variant: "destructive" 
      });
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
      <div className="min-h-screen bg-white" dir={dir}>
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          <Button 
            variant="ghost" 
            onClick={() => setStep('select')}
            className="mb-4 sm:mb-6 text-[#555] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]"
            data-testid="button-back"
          >
            <BackIcon className="w-4 h-4" />
            <span className={isRtl ? 'mr-1' : 'ml-1'}>{tx('back', lang)}</span>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="order-2 lg:order-1">
              <div className="border border-[#eee] p-5 sm:p-7" style={{ borderRadius: '2px' }}>
                <h2 className="text-lg sm:text-xl font-light mb-6 text-[#1a1a1a]"
                  style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif" }}>
                  {tx('expressCheckout', lang)}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recipientName" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('recipientName', lang)} *</Label>
                    <Input
                      id="recipientName"
                      placeholder={tx('recipientNamePlaceholder', lang)}
                      value={formData.recipientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] ${errors.recipientName ? 'border-red-400' : ''}`}
                      data-testid="input-recipient-name"
                      dir={dir}
                      autoComplete="given-name"
                      autoCapitalize="words"
                      spellCheck={false}
                      enterKeyHint="next"
                      lang={lang}
                    />
                    {errors.recipientName && <p className="text-[10px] text-red-500 mt-1">{errors.recipientName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="recipientEmail" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('recipientEmail', lang)} *</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      inputMode="email"
                      placeholder={tx('recipientEmailPlaceholder', lang)}
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] ${errors.recipientEmail ? 'border-red-400' : ''}`}
                      data-testid="input-recipient-email"
                      dir="ltr"
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="next"
                    />
                    {errors.recipientEmail && <p className="text-[10px] text-red-500 mt-1">{errors.recipientEmail}</p>}
                  </div>

                  <div>
                    <Label htmlFor="senderName" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('yourName', lang)} *</Label>
                    <Input
                      id="senderName"
                      placeholder={tx('yourNamePlaceholder', lang)}
                      value={formData.senderName}
                      onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] ${errors.senderName ? 'border-red-400' : ''}`}
                      data-testid="input-sender-name"
                      dir={dir}
                      autoComplete="name"
                      autoCapitalize="words"
                      spellCheck={false}
                      enterKeyHint="next"
                      lang={lang}
                    />
                    {errors.senderName && <p className="text-[10px] text-red-500 mt-1">{errors.senderName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="senderEmail" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('yourEmail', lang)} *</Label>
                    <Input
                      id="senderEmail"
                      type="email"
                      inputMode="email"
                      placeholder={tx('yourEmailPlaceholder', lang)}
                      value={formData.senderEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] ${errors.senderEmail ? 'border-red-400' : ''}`}
                      data-testid="input-sender-email"
                      dir="ltr"
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="next"
                    />
                    {errors.senderEmail && <p className="text-[10px] text-red-500 mt-1">{errors.senderEmail}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="message" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">
                        {tx('personalMessage', lang)}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-[#aaa]" />
                        <div className="flex gap-0.5">
                          {messageLanguages.map((ml) => (
                            <button
                              key={ml.code}
                              type="button"
                              onClick={() => setMessageLang(ml)}
                              className={`px-1.5 py-0.5 text-[10px] rounded transition-all duration-200 touch-manipulation ${
                                messageLang.code === ml.code
                                  ? 'bg-[#1a1a1a] text-white shadow-sm'
                                  : 'text-[#999] hover:text-[#555] hover:bg-[#f5f5f5]'
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
                        <p className="text-[9px] tracking-[0.1em] uppercase text-[#bbb] mb-1.5">{tx('suggestedMessages', lang)}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.map((msg, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => applySuggestedMessage(msg)}
                              className="px-3 py-1.5 text-[10px] sm:text-[11px] bg-[#FAFAF8] border border-[#eee] text-[#666] hover:border-[#c9a96e] hover:text-[#1a1a1a] transition-all duration-200 rounded-full touch-manipulation leading-relaxed"
                              style={{ maxWidth: '100%' }}
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
                      className="mt-0 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] min-h-[100px] resize-none leading-relaxed"
                      data-testid="input-message"
                      dir={messageLang.dir}
                      lang={messageLang.inputLang}
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      spellCheck={true}
                      enterKeyHint="done"
                    />
                    <p className="text-[9px] text-[#ccc] mt-1 text-end">
                      {messageLang.flag} {messageLang.label}
                    </p>
                  </div>
                </div>

                <div className="mt-5 p-4 bg-[#FAFAF8] border border-[#eee]" style={{ borderRadius: '2px' }}>
                  <p className="text-[10px] tracking-[0.1em] uppercase font-medium text-[#999] mb-2">{tx('redeemableAt', lang)}</p>
                  <div className="flex flex-wrap gap-2">
                    {platformServices.filter(s => selectedServices.includes(s.id)).map(service => (
                      <span key={service.id} className="px-2.5 py-1 text-[10px] sm:text-[11px] tracking-wide text-[#555] border border-[#ddd] bg-white">
                        {service.name}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  className="w-full py-4 mt-5 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 flex items-center justify-center gap-2 touch-manipulation"
                  onClick={handleCheckout}
                  data-testid="button-checkout"
                  style={{ borderRadius: '2px' }}
                >
                  {tx('payAndSend', lang)} {formattedValue}
                  <ForwardIcon className="w-3.5 h-3.5" />
                </button>

                <p className="text-[10px] text-[#aaa] text-center mt-3 tracking-wide">
                  {tx('secureCheckout', lang)}
                </p>
                
                <div className="mt-5 pt-5 border-t border-[#eee]">
                  <PaymentMethods language={lang} size="sm" />
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full mx-auto lg:sticky lg:top-8">
                <div className={`p-4 sm:p-5 lg:p-6 ${selectedOccasion ? `bg-gradient-to-b ${selectedOccasion.gradient}` : 'bg-gradient-to-b from-[#f8f8f6] to-[#f0eeea]'}`} style={{ borderRadius: '8px', border: selectedOccasion ? `1.5px solid ${selectedOccasion.borderColor}30` : '1px solid #eee' }}>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {selectedOccasion && (
                      <selectedOccasion.icon className="w-4 h-4" style={{ color: selectedOccasion.borderColor }} strokeWidth={1.5} />
                    )}
                    <p className="text-[10px] tracking-[0.25em] uppercase text-[#c9a96e] font-medium text-center">
                      {tx('eGiftCard', lang)} · {tierLabel}
                    </p>
                  </div>
                  {occasionLabel && (
                    <p className="text-[11px] text-center mb-3 font-medium" style={{ color: selectedOccasion?.borderColor }}>
                      {occasionLabel}
                    </p>
                  )}
                  <div className="relative rounded-lg shadow-xl overflow-hidden" style={{ filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.15))' }}>
                    <div className="relative" style={{ aspectRatio: '1120 / 928' }}>
                      <img
                        src={cardImages[selectedOption.tier] || cardImages.CLASSIC}
                        alt={`\u2066PetWash™\u2069 ${tierLabel} E-Gift Card`}
                        className="w-full h-full object-cover"
                      />
                      {formData.recipientName.trim() && (
                        <p className="absolute bottom-4 end-5 text-white font-semibold text-sm sm:text-base tracking-wide truncate drop-shadow-md max-w-[60%] text-end"
                          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
                          {formData.recipientName.toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-center mt-5">
                    <p className="text-3xl sm:text-4xl font-light text-[#1a1a1a] mb-1"
                      style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em' }}>
                      {formattedValue}
                    </p>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#aaa]">
                      {tx('eGiftCredit', lang)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[9px] text-[#bbb] tracking-wide">
                      <span>SN: {previewSerial}</span>
                      <span>{lang === 'he' ? 'תוקף: 24 חודשים' : 'Valid: 24 months'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-[11px] text-[#c9a96e]">{tx('worksAtAll', lang)}</p>
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
    <div className="min-h-screen bg-white" dir={dir}>
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-12 sm:mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#c9a96e]" />
            <Gift className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#c9a96e]" />
          </div>

          <p className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase mb-5 font-medium"
            style={{ color: '#c9a96e' }}>
            {tx('platformCredit', lang)}
          </p>

          <h1 className="text-3xl sm:text-4xl lg:text-[3.2rem] text-[#1a1a1a] mb-6 px-4 font-light leading-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif", letterSpacing: '-0.03em' }}>
            {tx('title', lang)}
          </h1>
          <p className="text-sm sm:text-[15px] text-[#888] max-w-lg mx-auto leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            {tx('description', lang)}
          </p>
        </div>

        <div className="max-w-[1040px] mx-auto">
          <div className="mb-10 sm:mb-14">
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[#c9a96e] mb-4 text-center">
              {tx('chooseOccasion', lang)}
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
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
                    className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs tracking-[0.05em] font-medium transition-all duration-300 touch-manipulation ${
                      isSelected
                        ? 'text-white shadow-lg scale-[1.02]'
                        : 'text-[#555] bg-white hover:shadow-md hover:scale-[1.01]'
                    }`}
                    style={{
                      borderRadius: '100px',
                      border: isSelected ? `2px solid ${occasion.borderColor}` : '1.5px solid #eee',
                      background: isSelected ? occasion.borderColor : undefined,
                    }}
                    data-testid={`occasion-${occasion.id}`}
                  >
                    <OccIcon className="w-4 h-4" strokeWidth={isSelected ? 2.5 : 1.5} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-8 sm:mb-10">
            <p className="text-[10px] tracking-[0.15em] uppercase font-medium text-[#999] mb-3 text-center">
              {tx('usableAt', lang)}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {platformServices.map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] tracking-[0.08em] font-medium transition-all duration-200 touch-manipulation ${
                    selectedServices.includes(service.id)
                      ? 'text-[#1a1a1a] border-[#1a1a1a] bg-[#FAFAF8]'
                      : 'text-[#aaa] border-[#eee] bg-white hover:text-[#555] hover:border-[#ccc]'
                  }`}
                  style={{ borderRadius: '2px', border: selectedServices.includes(service.id) ? '1px solid #1a1a1a' : '1px solid #eee' }}
                  data-testid={`service-toggle-${service.id}`}
                >
                  {service.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 text-center">
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[#c9a96e] mb-4">
              {tx('chooseValue', lang)}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-7">
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

          <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3 h-3 text-[#c9a96e]" strokeWidth={1.5} />
              <span className="text-[9px] sm:text-[10px] tracking-[0.12em] uppercase text-[#999] font-medium">
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
            <button
              type="button"
              onClick={() => {
                setIsCustom(!isCustom);
                if (!isCustom) {
                  setSelectedOption(null);
                }
              }}
              className={`w-full py-3 text-[11px] tracking-[0.12em] uppercase font-medium transition-all duration-200 touch-manipulation flex items-center justify-center gap-2 ${
                isCustom 
                  ? 'bg-[#1a1a1a] text-white' 
                  : 'bg-white text-[#888] border border-[#ddd] hover:border-[#999] hover:text-[#555]'
              }`}
              style={{ borderRadius: '2px' }}
              data-testid="button-custom-amount"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tx('customAmount', lang)}
            </button>
            
            {isCustom && (
              <div className="mt-3 relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[#999] text-sm pointer-events-none">₪</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={tx('enterAmount', lang)}
                  value={customAmount}
                  onChange={(e) => handleCustomAmount(e.target.value)}
                  className="ps-8 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] text-center"
                  dir="ltr"
                  autoFocus
                  enterKeyHint="done"
                  data-testid="input-custom-amount"
                />
                {customAmount && (parseInt(customAmount) < 50 || parseInt(customAmount) > 5000) && (
                  <p className="text-[10px] text-red-400 mt-1 text-center">₪50 - ₪5,000</p>
                )}
              </div>
            )}
          </div>

          {selectedOption && (
            <div className="mt-10 sm:mt-12 text-center">
              <button
                className="px-10 sm:px-14 py-4 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 inline-flex items-center gap-2.5 touch-manipulation"
                onClick={proceedToCheckout}
                data-testid="button-proceed-checkout"
                style={{ borderRadius: '2px' }}
              >
                {tx('continueCheckout', lang)}
                <ForwardIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mt-14 sm:mt-20">
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-[#ddd]" />
              <ShieldCheck className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
              <div className="flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-[#ddd]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10 max-w-xl mx-auto">
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {tx('allServices', lang)}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {tx('valid12Months', lang)}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {tx('noAccountRequired', lang)}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {tx('instantDelivery', lang)}
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
