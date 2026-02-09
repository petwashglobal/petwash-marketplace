import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Wallet, Gift, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentMethods from '@/components/PaymentMethods';
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from '@/lib/languageStore';

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
    he: 'כרטיס מתנה דיגיטלי',
    ar: 'بطاقة هدايا رقمية',
    ru: 'Подарочная карта',
    fr: 'Carte cadeau numérique',
    es: 'Tarjeta de regalo digital',
  },
  description: {
    en: 'Give the gift of premium pet care credit. Use anywhere across Pet Wash™ platforms - from self-service washes to pet sitting, dog walking, adventures, and more!',
    he: 'תנו את מתנת הטיפוח המושלמת לחיות מחמד. ניתן לשימוש בכל פלטפורמות Pet Wash™ - משטיפה בשירות עצמי ועד שמרטפות, טיולי כלבים, הרפתקאות ועוד!',
    ar: 'قدم هدية رعاية الحيوانات الأليفة المميزة. استخدمها في جميع منصات Pet Wash™ - من الغسيل الذاتي إلى رعاية الحيوانات والمشي والمغامرات والمزيد!',
    ru: 'Подарите кредит на премиальный уход за питомцами. Используйте на всех платформах Pet Wash™ - от мойки самообслуживания до присмотра, выгула и приключений!',
    fr: 'Offrez le cadeau des soins premium pour animaux. Utilisable sur toutes les plateformes Pet Wash™ - du lavage libre-service au pet sitting, promenades et aventures!',
    es: 'Regala crédito de cuidado premium para mascotas. Úsalo en todas las plataformas Pet Wash™ - desde lavado autoservicio hasta cuidadores, paseos, aventuras y más!',
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
    en: 'Valid 12 Months',
    he: 'בתוקף 12 חודשים',
    ar: 'صالحة لمدة 12 شهراً',
    ru: 'Действует 12 месяцев',
    fr: 'Valable 12 mois',
    es: 'Válido 12 meses',
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
    he: 'נא לבחור סכום לכרטיס מתנה',
    ar: 'يرجى اختيار قيمة بطاقة الهدايا',
    ru: 'Выберите номинал подарочной карты',
    fr: 'Veuillez sélectionner une valeur de carte cadeau',
    es: 'Seleccione un valor de tarjeta de regalo',
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
    en: 'Add a personal touch...',
    he: 'הוסיפו מגע אישי...',
    ar: 'أضف لمسة شخصية...',
    ru: 'Добавьте личное сообщение...',
    fr: 'Ajoutez une touche personnelle...',
    es: 'Agrega un toque personal...',
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
    en: 'Secure checkout • No account required',
    he: 'תשלום מאובטח • ללא צורך בחשבון',
    ar: 'دفع آمن • لا يتطلب حساب',
    ru: 'Безопасная оплата • Без регистрации',
    fr: 'Paiement sécurisé • Sans compte requis',
    es: 'Pago seguro • Sin cuenta necesaria',
  },
  worksAtAll: {
    en: 'Works at all Pet Wash™ services',
    he: 'תקף בכל שירותי Pet Wash™',
    ar: 'يعمل في جميع خدمات Pet Wash™',
    ru: 'Действует во всех сервисах Pet Wash™',
    fr: 'Valable dans tous les services Pet Wash™',
    es: 'Válido en todos los servicios Pet Wash™',
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
    he: 'כרטיס המתנה נוצר!',
    ar: 'تم إنشاء بطاقة الهدايا!',
    ru: 'Подарочная карта создана!',
    fr: 'Carte cadeau créée!',
    es: '¡Tarjeta de regalo creada!',
  },
  giftCode: {
    en: 'Gift card code:',
    he: 'קוד כרטיס מתנה:',
    ar: 'رمز بطاقة الهدايا:',
    ru: 'Код подарочной карты:',
    fr: 'Code carte cadeau:',
    es: 'Código de tarjeta:',
  },
  errorCreating: {
    en: 'Error creating gift card',
    he: 'שגיאה ביצירת כרטיס המתנה',
    ar: 'خطأ في إنشاء بطاقة الهدايا',
    ru: 'Ошибка при создании карты',
    fr: 'Erreur lors de la création',
    es: 'Error al crear la tarjeta',
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
    he: 'שגיאה בעיבוד המתנה',
    ar: 'خطأ في معالجة الهدية',
    ru: 'Ошибка обработки подарка',
    fr: 'Erreur de traitement',
    es: 'Error al procesar el regalo',
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
    he: 'כרטיס מתנה',
    ar: 'بطاقة هدايا',
    ru: 'Подарочная карта',
    fr: 'Carte cadeau',
    es: 'Tarjeta regalo',
  },
  eGiftCredit: {
    en: 'E-Gift Credit',
    he: 'קרדיט מתנה',
    ar: 'رصيد هدية',
    ru: 'Подарочный кредит',
    fr: 'Crédit cadeau',
    es: 'Crédito regalo',
  },
};

const cardStyles = {
  rose: {
    gradient: 'linear-gradient(145deg, #F8E8EC 0%, #E8D0D8 15%, #D4B8C4 35%, #C8A8B8 55%, #BC98AC 75%, #B088A0 100%)',
    textColor: '#1A1A1A',
    chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
    shadowColor: 'rgba(180,120,140,0.35)',
    accentColor: '#C6A664',
    holographicGlow: 'rgba(255, 200, 220, 0.4)',
  },
  emerald: {
    gradient: 'linear-gradient(145deg, #E8F0E8 0%, #D0E0D0 15%, #B8D0BC 35%, #A0C0A8 55%, #88B094 75%, #70A080 100%)',
    textColor: '#1A1A1A',
    chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
    shadowColor: 'rgba(100,140,100,0.35)',
    accentColor: '#C6A664',
    holographicGlow: 'rgba(180, 255, 200, 0.4)',
  },
  platinum: {
    gradient: 'linear-gradient(145deg, #F0F0F2 0%, #E4E4E8 15%, #D8D8DC 35%, #CCCCCC 55%, #C0C0C0 75%, #B4B4B8 100%)',
    textColor: '#1A1A1A',
    chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
    shadowColor: 'rgba(100,100,110,0.4)',
    accentColor: '#C6A664',
    holographicGlow: 'rgba(200, 200, 255, 0.4)',
  },
  gold: {
    gradient: 'linear-gradient(145deg, #FAF6F0 0%, #F0E8DC 15%, #E8DCC8 35%, #DED0B4 55%, #D4C4A0 75%, #C6A664 100%)',
    textColor: '#1A1A1A',
    chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
    shadowColor: 'rgba(180,150,80,0.4)',
    accentColor: '#8B7355',
    holographicGlow: 'rgba(255, 230, 180, 0.5)',
  }
};

const platformServices = [
  { id: 'wash', name: 'K9000 Wash Hub™' },
  { id: 'sitter', name: 'Sitter Suite™' },
  { id: 'walk', name: 'Walk My Pet™' },
  { id: 'trek', name: 'PetTrek™' },
  { id: 'academy', name: 'Pet Wash Academy™' },
  { id: 'nayax', name: 'Nayax Pet Wash™' }
];

const giftOptions = [
  { value: 100, color: 'rose' as const },
  { value: 250, color: 'emerald' as const },
  { value: 500, color: 'platinum' as const },
  { value: 1000, color: 'gold' as const }
];

function tx(key: string, lang: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['en'] || key;
}

function LuxuryGiftCard({ 
  option,
  onClick,
  selected,
  lang
}: { 
  option: typeof giftOptions[0];
  onClick: () => void;
  selected?: boolean;
  lang: string;
}) {
  const style = cardStyles[option.color] as typeof cardStyles.rose;
  const formattedValue = option.value >= 1000 
    ? `₪${(option.value / 1000).toFixed(0)},000` 
    : `₪${option.value}`;
  
  return (
    <button 
      type="button"
      className={`relative w-full text-left transition-all duration-500 group perspective-1000 ${
        selected 
          ? 'scale-[1.03]' 
          : 'hover:scale-[1.02] hover:-translate-y-1'
      }`}
      onClick={onClick}
      data-testid={`egift-card-${option.value}`}
      style={{ perspective: '1000px' }}
    >
      {option.value === 1000 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <span className="px-4 py-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black text-[10px] sm:text-xs font-bold rounded-full shadow-lg whitespace-nowrap tracking-wide">
            {tx('bestValue', lang)}
          </span>
        </div>
      )}
      
      <div 
        className="relative w-full aspect-[1.586/1] overflow-hidden transition-transform duration-500 group-hover:rotate-y-[2deg] group-hover:rotate-x-[-2deg]"
        style={{ 
          background: style.gradient,
          borderRadius: '16px',
          boxShadow: selected 
            ? `0 25px 50px -12px ${style.shadowColor}, 0 12px 24px -8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)`
            : `0 15px 35px -10px ${style.shadowColor}, 0 8px 16px -6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          }}
        />
        
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none"
          style={{
            background: `linear-gradient(125deg, transparent 0%, ${style.holographicGlow} 25%, transparent 50%, ${style.holographicGlow} 75%, transparent 100%)`,
            backgroundSize: '200% 200%',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />
        
        <div className="absolute inset-0 overflow-hidden rounded-[16px]">
          <div className="absolute -top-1/2 -left-1/4 w-[150%] h-full opacity-20" style={{
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, transparent 60%)',
            transform: 'rotate(-15deg)',
          }} />
        </div>
        
        <div className="absolute top-5 sm:top-6 left-5 sm:left-6">
          <p className="text-lg sm:text-xl font-light tracking-tight" style={{ color: style.textColor, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
            Pet Wash<span className="text-xs align-super">™</span>
          </p>
        </div>
        
        <div className="absolute top-[42%] sm:top-[40%] left-5 sm:left-6 transform -translate-y-1/2">
          <div 
            className="w-12 h-9 sm:w-14 sm:h-10 rounded-md overflow-hidden"
            style={{
              background: style.chipColor,
              boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.15)',
            }}
          >
            <div className="w-full h-full p-1 flex flex-col justify-center">
              <div className="flex gap-0.5">
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(180,160,120,0.6) 0%, rgba(200,180,140,0.8) 50%, rgba(180,160,120,0.6) 100%)' }} />
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(180,160,120,0.6) 0%, rgba(200,180,140,0.8) 50%, rgba(180,160,120,0.6) 100%)' }} />
              </div>
              <div className="h-2 mt-0.5 rounded-sm mx-1" style={{ background: 'linear-gradient(90deg, rgba(180,160,120,0.5) 0%, rgba(200,180,140,0.7) 50%, rgba(180,160,120,0.5) 100%)' }} />
              <div className="flex gap-0.5 mt-0.5">
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(180,160,120,0.6) 0%, rgba(200,180,140,0.8) 50%, rgba(180,160,120,0.6) 100%)' }} />
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(180,160,120,0.6) 0%, rgba(200,180,140,0.8) 50%, rgba(180,160,120,0.6) 100%)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-[42%] sm:top-[40%] left-20 sm:left-24 transform -translate-y-1/2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-50">
            <path d="M12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18" stroke={style.textColor} strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14" stroke={style.textColor} strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22" stroke={style.textColor} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="absolute bottom-16 sm:bottom-20 left-5 sm:left-6">
          <p 
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
            style={{ color: style.textColor, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
          >
            {formattedValue}
          </p>
          <p 
            className="text-xs sm:text-sm opacity-60 mt-0.5 tracking-wide"
            style={{ color: style.textColor }}
          >
            {tx('eGiftCard', lang)}
          </p>
        </div>

        <div className="absolute bottom-5 sm:bottom-6 left-5 sm:left-6 right-5 sm:right-6 flex items-end justify-between">
          <div>
            <p 
              className="text-[11px] sm:text-xs font-medium tracking-[0.2em] opacity-80"
              style={{ color: style.textColor, fontFamily: 'SF Mono, Menlo, monospace' }}
            >
              •••• •••• •••• {String(option.value).padStart(4, '0')}
            </p>
          </div>
          
          <div className="flex -space-x-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" style={{ background: 'rgba(235, 0, 27, 0.85)' }} />
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" style={{ background: 'rgba(255, 95, 0, 0.85)' }} />
          </div>
        </div>

        {selected && (
          <div className="absolute top-4 right-4">
            <div className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/50">
              <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
            </div>
          </div>
        )}

        <div className="absolute top-5 right-5">
          <div 
            className="px-2.5 py-1 rounded-full backdrop-blur-sm"
            style={{ 
              background: 'rgba(255,255,255,0.15)', 
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: style.textColor }}>
              {option.color === 'gold' ? 'ELITE' : option.color === 'platinum' ? 'PREMIUM' : option.color === 'emerald' ? 'PLUS' : 'CLASSIC'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function EGift() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const lang = language;
  const isRtl = dir === 'rtl';
  const [selectedOption, setSelectedOption] = useState<typeof giftOptions[0] | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(['wash', 'sitter', 'walk', 'trek', 'academy', 'nayax']);
  const [step, setStep] = useState<'select' | 'checkout'>('select');
  
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

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  if (step === 'checkout' && selectedOption) {
    const style = cardStyles[selectedOption.color];
    const finalPrice = selectedOption.value;
    const formattedValue = finalPrice >= 1000 
      ? `₪${(finalPrice / 1000).toFixed(0)},000` 
      : `₪${finalPrice}`;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir={dir}>
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          <Button 
            variant="ghost" 
            onClick={() => setStep('select')}
            className="mb-4 sm:mb-6"
            data-testid="button-back"
          >
            <BackIcon className="w-4 h-4" />
            <span className={isRtl ? 'mr-1' : 'ml-1'}>{tx('back', lang)}</span>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="order-2 lg:order-1">
              <Card className="border-0 shadow-xl">
                <CardContent className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">
                    {tx('expressCheckout', lang)}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="recipientName" className="text-sm">{tx('recipientName', lang)} *</Label>
                      <Input
                        id="recipientName"
                        placeholder={tx('recipientNamePlaceholder', lang)}
                        value={formData.recipientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                        className={`mt-1 ${errors.recipientName ? 'border-red-500' : ''}`}
                        data-testid="input-recipient-name"
                        dir={dir}
                      />
                    </div>

                    <div>
                      <Label htmlFor="recipientEmail" className="text-sm">{tx('recipientEmail', lang)} *</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder={tx('recipientEmailPlaceholder', lang)}
                        value={formData.recipientEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                        className={`mt-1 ${errors.recipientEmail ? 'border-red-500' : ''}`}
                        data-testid="input-recipient-email"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <Label htmlFor="senderName" className="text-sm">{tx('yourName', lang)} *</Label>
                      <Input
                        id="senderName"
                        placeholder={tx('yourNamePlaceholder', lang)}
                        value={formData.senderName}
                        onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                        className={`mt-1 ${errors.senderName ? 'border-red-500' : ''}`}
                        data-testid="input-sender-name"
                        dir={dir}
                      />
                    </div>

                    <div>
                      <Label htmlFor="senderEmail" className="text-sm">{tx('yourEmail', lang)} *</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        placeholder={tx('yourEmailPlaceholder', lang)}
                        value={formData.senderEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                        className={`mt-1 ${errors.senderEmail ? 'border-red-500' : ''}`}
                        data-testid="input-sender-email"
                        dir="ltr"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="message" className="text-sm">{tx('personalMessage', lang)}</Label>
                      <Input
                        id="message"
                        placeholder={tx('messagePlaceholder', lang)}
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        className="mt-1"
                        data-testid="input-message"
                        dir={dir}
                      />
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-medium text-gray-700 mb-2">{tx('redeemableAt', lang)}</p>
                    <div className="flex flex-wrap gap-2">
                      {platformServices.filter(s => selectedServices.includes(s.id)).map(service => (
                        <span key={service.id} className="bg-black text-white px-2 py-1 rounded-full text-xs">
                          {service.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-black hover:bg-gray-800 text-white py-5 sm:py-6 text-base sm:text-lg mt-4 sm:mt-6"
                    onClick={handleCheckout}
                    data-testid="button-checkout"
                  >
                    {tx('payAndSend', lang)} ₪{finalPrice}
                    <ForwardIcon className={`w-5 h-5 ${isRtl ? 'mr-2' : 'ml-2'}`} />
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-3">
                    {tx('secureCheckout', lang)}
                  </p>
                  
                  <div className="mt-4 sm:mt-6 pt-4 border-t border-gray-100">
                    <PaymentMethods language={lang} size="sm" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full max-w-xs sm:max-w-sm mx-auto lg:sticky lg:top-8">
                <div 
                  className="relative w-full aspect-[1.586/1] overflow-hidden"
                  style={{ 
                    background: style.gradient,
                    borderRadius: '12px',
                    boxShadow: '0 20px 50px -10px rgba(0,0,0,0.35), 0 8px 20px -4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
                  }}
                >
                  <div className="absolute inset-0 opacity-15">
                    <div className="absolute top-0 left-0 w-full h-full" style={{
                      backgroundImage: 'radial-gradient(circle at 25% 75%, rgba(255,255,255,0.4) 0%, transparent 45%), radial-gradient(circle at 75% 25%, rgba(255,255,255,0.25) 0%, transparent 35%)'
                    }} />
                  </div>
                  
                  <div className="absolute inset-[1px] rounded-[11px] border border-white/10" />
                  
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${style.accentColor}dd` }}>
                      <Gift className="w-4 h-4" style={{ color: selectedOption.color === 'gold' ? '#8B6914' : '#333' }} />
                    </div>
                    <span className="text-sm font-bold tracking-wide" style={{ color: style.textColor }}>
                      Pet Wash™
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-3xl sm:text-4xl font-black tracking-tight mb-0.5" style={{ color: style.textColor, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                      {formattedValue}
                    </p>
                    <p className="text-xs font-medium opacity-75 tracking-wide uppercase" style={{ color: style.textColor }}>
                      {tx('eGiftCredit', lang)}
                    </p>
                  </div>

                  <div className="absolute top-4 right-4">
                    <div className="w-10 h-7" style={{ 
                      background: 'linear-gradient(145deg, #D4AF37 0%, #F5D76E 25%, #D4AF37 50%, #AA8C2C 100%)',
                      borderRadius: '4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
                    }} />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-amber-600 font-medium">{tx('worksAtAll', lang)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir={dir}>
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-full mb-4">
            <Wallet className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">{tx('platformCredit', lang)}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            {tx('title', lang)}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
            {tx('description', lang)}
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <p className="text-sm font-medium text-gray-700 mb-3 text-center">
              {tx('usableAt', lang)}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {platformServices.map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                    selectedServices.includes(service.id)
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`service-toggle-${service.id}`}
                >
                  {service.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {giftOptions.map((option) => (
              <LuxuryGiftCard
                key={option.value}
                option={option}
                onClick={() => handleCardClick(option)}
                selected={selectedOption?.value === option.value}
                lang={lang}
              />
            ))}
          </div>

          {selectedOption && (
            <div className="mt-6 sm:mt-8 text-center">
              <Button 
                className="bg-black hover:bg-gray-800 text-white px-8 sm:px-12 py-5 sm:py-6 text-base sm:text-lg"
                onClick={proceedToCheckout}
                data-testid="button-proceed-checkout"
              >
                {tx('continueCheckout', lang)}
                <ForwardIcon className={`w-5 h-5 ${isRtl ? 'mr-2' : 'ml-2'}`} />
              </Button>
            </div>
          )}

          <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              {tx('allServices', lang)}
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              {tx('valid12Months', lang)}
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              {tx('noAccountRequired', lang)}
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              {tx('instantDelivery', lang)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
