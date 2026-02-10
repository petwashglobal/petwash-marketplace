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
    gradient: 'linear-gradient(165deg, #2C1A22 0%, #1A0F14 40%, #12080C 100%)',
    textColor: '#FFFFFF',
    chipColor: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 50%, #D4B87A 100%)',
    shadowColor: 'rgba(0,0,0,0.5)',
    accentColor: '#E8A0B8',
    holographicGlow: 'rgba(232, 160, 184, 0.15)',
  },
  emerald: {
    gradient: 'linear-gradient(165deg, #1A2E1C 0%, #0F1E10 40%, #081208 100%)',
    textColor: '#FFFFFF',
    chipColor: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 50%, #D4B87A 100%)',
    shadowColor: 'rgba(0,0,0,0.5)',
    accentColor: '#7FD4A0',
    holographicGlow: 'rgba(127, 212, 160, 0.15)',
  },
  platinum: {
    gradient: 'linear-gradient(165deg, #2A2A35 0%, #1C1C28 40%, #14141E 100%)',
    textColor: '#FFFFFF',
    chipColor: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 50%, #D4B87A 100%)',
    shadowColor: 'rgba(0,0,0,0.5)',
    accentColor: '#B8C5D6',
    holographicGlow: 'rgba(184, 197, 214, 0.15)',
  },
  gold: {
    gradient: 'linear-gradient(165deg, #3A2D1A 0%, #2A1F0F 40%, #1A1408 100%)',
    textColor: '#FFFFFF',
    chipColor: 'linear-gradient(135deg, #E8C964 0%, #C9A96E 50%, #F0D888 100%)',
    shadowColor: 'rgba(0,0,0,0.5)',
    accentColor: '#E8C964',
    holographicGlow: 'rgba(232, 201, 100, 0.2)',
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
          borderRadius: '20px',
          boxShadow: selected 
            ? `0 25px 50px -12px ${style.shadowColor}, 0 0 0 2px ${style.accentColor}80, 0 0 30px ${style.holographicGlow}`
            : `0 15px 35px -10px ${style.shadowColor}, 0 0 0 1px rgba(255,255,255,0.08)`,
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
        
        <div className="absolute top-5 sm:top-6 left-5 sm:left-6 right-5 sm:right-6">
          <div className="flex items-start justify-between">
            <p className="text-base sm:text-lg font-light tracking-wide" style={{ color: style.textColor, fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif" }}>
              Pet Wash<span className="text-[8px] align-super">™</span>
            </p>
            <p className="text-[10px] sm:text-[11px] tracking-[0.15em] uppercase opacity-50" style={{ color: style.textColor }}>
              {tx('eGiftCard', lang)}
            </p>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p 
              className="text-3xl sm:text-4xl font-light tracking-tight"
              style={{ color: style.textColor, fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif" }}
            >
              {formattedValue}
            </p>
            <p 
              className="text-[11px] sm:text-xs opacity-40 mt-1.5 tracking-[0.15em] uppercase"
              style={{ color: style.textColor }}
            >
              {tx('eGiftCredit', lang)}
            </p>
          </div>
        </div>

        <div className="absolute bottom-5 sm:bottom-6 left-5 sm:left-6 right-5 sm:right-6">
          <div className="w-full h-[1px] opacity-10 mb-3" style={{ background: style.textColor }} />
          <p className="text-[10px] tracking-[0.2em] uppercase opacity-30 text-center" style={{ color: style.textColor }}>
            Premium Organic Pet Care
          </p>
        </div>

        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${style.accentColor}40, transparent)`,
        }} />

        {selected && (
          <div className="absolute top-3 left-3 z-10">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg" style={{
              background: style.accentColor,
            }}>
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4">
          <div 
            className="px-2 py-0.5 rounded-full"
            style={{ 
              background: 'rgba(255,255,255,0.08)', 
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <span className="text-[8px] sm:text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.7)' }}>
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
      <div className="min-h-screen bg-[#0A0A0F]" dir={dir}>
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          <Button 
            variant="ghost" 
            onClick={() => setStep('select')}
            className="mb-4 sm:mb-6 text-gray-400 hover:text-white hover:bg-white/5"
            data-testid="button-back"
          >
            <BackIcon className="w-4 h-4" />
            <span className={isRtl ? 'mr-1' : 'ml-1'}>{tx('back', lang)}</span>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="order-2 lg:order-1">
              <Card className="border-0 shadow-xl" style={{ background: '#16161E', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-white">
                    {tx('expressCheckout', lang)}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="recipientName" className="text-sm text-gray-300">{tx('recipientName', lang)} *</Label>
                      <Input
                        id="recipientName"
                        placeholder={tx('recipientNamePlaceholder', lang)}
                        value={formData.recipientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                        className={`mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#C9A96E]/50 ${errors.recipientName ? 'border-red-500' : ''}`}
                        data-testid="input-recipient-name"
                        dir={dir}
                      />
                    </div>

                    <div>
                      <Label htmlFor="recipientEmail" className="text-sm text-gray-300">{tx('recipientEmail', lang)} *</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder={tx('recipientEmailPlaceholder', lang)}
                        value={formData.recipientEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                        className={`mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#C9A96E]/50 ${errors.recipientEmail ? 'border-red-500' : ''}`}
                        data-testid="input-recipient-email"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <Label htmlFor="senderName" className="text-sm text-gray-300">{tx('yourName', lang)} *</Label>
                      <Input
                        id="senderName"
                        placeholder={tx('yourNamePlaceholder', lang)}
                        value={formData.senderName}
                        onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                        className={`mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#C9A96E]/50 ${errors.senderName ? 'border-red-500' : ''}`}
                        data-testid="input-sender-name"
                        dir={dir}
                      />
                    </div>

                    <div>
                      <Label htmlFor="senderEmail" className="text-sm text-gray-300">{tx('yourEmail', lang)} *</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        placeholder={tx('yourEmailPlaceholder', lang)}
                        value={formData.senderEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                        className={`mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#C9A96E]/50 ${errors.senderEmail ? 'border-red-500' : ''}`}
                        data-testid="input-sender-email"
                        dir="ltr"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="message" className="text-sm text-gray-300">{tx('personalMessage', lang)}</Label>
                      <Input
                        id="message"
                        placeholder={tx('messagePlaceholder', lang)}
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#C9A96E]/50"
                        data-testid="input-message"
                        dir={dir}
                      />
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-medium text-gray-400 mb-2">{tx('redeemableAt', lang)}</p>
                    <div className="flex flex-wrap gap-2">
                      {platformServices.filter(s => selectedServices.includes(s.id)).map(service => (
                        <span key={service.id} className="px-2 py-1 rounded-full text-xs text-white" style={{ background: 'rgba(201,169,110,0.2)', border: '1px solid rgba(201,169,110,0.3)' }}>
                          {service.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full py-5 sm:py-6 text-base sm:text-lg mt-4 sm:mt-6 text-white border-0"
                    style={{ background: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 100%)' }}
                    onClick={handleCheckout}
                    data-testid="button-checkout"
                  >
                    {tx('payAndSend', lang)} ₪{finalPrice}
                    <ForwardIcon className={`w-5 h-5 ${isRtl ? 'mr-2' : 'ml-2'}`} />
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-3">
                    {tx('secureCheckout', lang)}
                  </p>
                  
                  <div className="mt-4 sm:mt-6 pt-4 border-t border-white/10">
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
                    borderRadius: '20px',
                    boxShadow: `0 20px 50px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08), 0 0 30px ${style.holographicGlow}`
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
                      <Gift className="w-4 h-4 text-white" />
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
    <div className="min-h-screen bg-[#0A0A0F]" dir={dir}>
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-5" style={{
            background: 'linear-gradient(135deg, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 100%)',
            border: '1px solid rgba(201,169,110,0.3)',
          }}>
            <Wallet className="w-4 h-4" style={{ color: '#C9A96E' }} />
            <span className="text-sm font-medium" style={{ color: '#C9A96E' }}>{tx('platformCredit', lang)}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif" }}>
            {tx('title', lang)}
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            {tx('description', lang)}
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <p className="text-sm font-medium text-gray-400 mb-3 text-center">
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
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  style={selectedServices.includes(service.id) ? {
                    background: 'linear-gradient(135deg, rgba(201,169,110,0.2) 0%, rgba(201,169,110,0.1) 100%)',
                    border: '1px solid rgba(201,169,110,0.4)',
                  } : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  data-testid={`service-toggle-${service.id}`}
                >
                  {service.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
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
                className="px-8 sm:px-12 py-5 sm:py-6 text-base sm:text-lg font-semibold rounded-xl"
                onClick={proceedToCheckout}
                data-testid="button-proceed-checkout"
                style={{
                  background: 'linear-gradient(135deg, #C9A96E, #E8C964)',
                  color: '#1A1A1A',
                }}
              >
                {tx('continueCheckout', lang)}
                <ForwardIcon className={`w-5 h-5 ${isRtl ? 'mr-2' : 'ml-2'}`} />
              </Button>
            </div>
          )}

          <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" style={{ color: '#C9A96E' }} />
              {tx('allServices', lang)}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" style={{ color: '#C9A96E' }} />
              {tx('valid12Months', lang)}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" style={{ color: '#C9A96E' }} />
              {tx('noAccountRequired', lang)}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4" style={{ color: '#C9A96E' }} />
              {tx('instantDelivery', lang)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
