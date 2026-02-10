import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Gift, Check, Leaf, ShieldCheck } from 'lucide-react';
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
    en: 'Secure checkout · No account required',
    he: 'תשלום מאובטח · ללא צורך בחשבון',
    ar: 'دفع آمن · لا يتطلب حساب',
    ru: 'Безопасная оплата · Без регистрации',
    fr: 'Paiement sécurisé · Sans compte requis',
    es: 'Pago seguro · Sin cuenta necesaria',
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
  sendGift: {
    en: 'Send Gift',
    he: 'שלח מתנה',
    ar: 'إرسال هدية',
    ru: 'Отправить подарок',
    fr: 'Envoyer cadeau',
    es: 'Enviar regalo',
  },
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
  { value: 100, tier: 'CLASSIC' as const },
  { value: 250, tier: 'PLUS' as const },
  { value: 500, tier: 'PREMIUM' as const },
  { value: 1000, tier: 'ELITE' as const }
];

const tierLabels: Record<string, Record<string, string>> = {
  CLASSIC: { en: 'Classic', he: 'קלאסי' },
  PLUS: { en: 'Plus', he: 'פלוס' },
  PREMIUM: { en: 'Premium', he: 'פרימיום' },
  ELITE: { en: 'Maison', he: 'מזון' },
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
  lang
}: { 
  option: typeof giftOptions[0];
  onClick: () => void;
  selected?: boolean;
  lang: string;
}) {
  const formattedValue = option.value >= 1000 
    ? `${(option.value / 1000).toFixed(0)},000` 
    : `${option.value}`;

  const isElite = option.tier === 'ELITE';
  const isPremium = option.tier === 'PREMIUM';
  const tierLabel = tierLabels[option.tier]?.[lang] || tierLabels[option.tier]?.en || option.tier;
  
  return (
    <button 
      type="button"
      className="relative w-full text-left transition-all duration-300 group"
      onClick={onClick}
      data-testid={`egift-card-${option.value}`}
    >
      <div className={`relative overflow-hidden transition-all duration-500 ${
        isElite ? 'bg-[#1a1a1a]' : 'bg-white'
      }`}
        style={{
          borderRadius: '2px',
          border: selected 
            ? '2px solid #1a1a1a' 
            : isPremium 
              ? '1.5px solid #c9a96e' 
              : isElite 
                ? '1.5px solid #333' 
                : '1px solid #eee',
        }}
      >
        {isPremium && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c9a96e] via-[#e8d5b0] to-[#c9a96e]" />
        )}

        <div className="px-4 sm:px-5 pt-5 sm:pt-6 pb-5">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
              isElite || isPremium ? 'text-[#c9a96e]' : 'text-[#999]'
            }`}>
              {tierLabel}
            </span>
            {isElite && (
              <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 bg-[#c9a96e] text-white font-medium" style={{ borderRadius: '1px' }}>
                {tx('bestValue', lang)}
              </span>
            )}
          </div>

          <div className="mb-5 sm:mb-6">
            <div className="flex items-baseline gap-1">
              <span className={`text-[11px] sm:text-xs ${isElite ? 'text-[#888]' : 'text-[#999]'}`}>₪</span>
              <span className={`text-4xl sm:text-5xl lg:text-[3.4rem] font-light ${
                isElite ? 'text-white' : 'text-[#1a1a1a]'
              }`}
                style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
                {formattedValue}
              </span>
            </div>
            <p className={`text-[10px] sm:text-[11px] mt-2 tracking-[0.1em] uppercase ${isElite ? 'text-[#777]' : 'text-[#aaa]'}`}>
              {tx('eGiftCredit', lang)}
            </p>
          </div>

          <div className={`border-t ${isElite ? 'border-[#333]' : 'border-[#eee]'} pt-4`}>
            <div className={`space-y-2 ${isElite ? 'text-[#999]' : 'text-[#888]'}`}>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                <span className="text-[10px] sm:text-[11px]">
                  {tx('allServices', lang)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                <span className="text-[10px] sm:text-[11px]">
                  {tx('valid12Months', lang)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <div className="absolute top-3 end-3 z-10">
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[#1a1a1a]">
              <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
            </div>
          </div>
        )}
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

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedValue = urlParams.get('value');
  const preselectedOption = preselectedValue 
    ? giftOptions.find(o => o.value === parseInt(preselectedValue)) || null
    : null;

  const [selectedOption, setSelectedOption] = useState<typeof giftOptions[0] | null>(preselectedOption);
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
    const finalPrice = selectedOption.value;
    const formattedValue = finalPrice >= 1000 
      ? `₪${(finalPrice / 1000).toFixed(0)},000` 
      : `₪${finalPrice}`;
    const tierLabel = tierLabels[selectedOption.tier]?.[lang] || tierLabels[selectedOption.tier]?.en;

    return (
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
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none ${errors.recipientName ? 'border-red-400' : ''}`}
                      data-testid="input-recipient-name"
                      dir={dir}
                    />
                  </div>

                  <div>
                    <Label htmlFor="recipientEmail" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('recipientEmail', lang)} *</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      placeholder={tx('recipientEmailPlaceholder', lang)}
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none ${errors.recipientEmail ? 'border-red-400' : ''}`}
                      data-testid="input-recipient-email"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <Label htmlFor="senderName" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('yourName', lang)} *</Label>
                    <Input
                      id="senderName"
                      placeholder={tx('yourNamePlaceholder', lang)}
                      value={formData.senderName}
                      onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none ${errors.senderName ? 'border-red-400' : ''}`}
                      data-testid="input-sender-name"
                      dir={dir}
                    />
                  </div>

                  <div>
                    <Label htmlFor="senderEmail" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('yourEmail', lang)} *</Label>
                    <Input
                      id="senderEmail"
                      type="email"
                      placeholder={tx('yourEmailPlaceholder', lang)}
                      value={formData.senderEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                      className={`mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none ${errors.senderEmail ? 'border-red-400' : ''}`}
                      data-testid="input-sender-email"
                      dir="ltr"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="message" className="text-[11px] tracking-[0.08em] uppercase text-[#888] font-medium">{tx('personalMessage', lang)}</Label>
                    <Input
                      id="message"
                      placeholder={tx('messagePlaceholder', lang)}
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="mt-1.5 border-[#ddd] bg-[#FAFAF8] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none"
                      data-testid="input-message"
                      dir={dir}
                    />
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
                  className="w-full py-4 mt-5 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 flex items-center justify-center gap-2"
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
              <div className="w-full max-w-xs sm:max-w-sm mx-auto lg:sticky lg:top-8">
                <div className="bg-[#1a1a1a] p-6 sm:p-8" style={{ borderRadius: '2px' }}>
                  <div className="flex items-center justify-between mb-8">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-[#c9a96e] font-medium">
                      {tx('eGiftCard', lang)}
                    </p>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-[#666]">
                      {tierLabel}
                    </p>
                  </div>

                  <div className="text-center py-6">
                    <p className="text-5xl sm:text-6xl font-light text-white mb-2"
                      style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em' }}>
                      {formattedValue}
                    </p>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#888]">
                      {tx('eGiftCredit', lang)}
                    </p>
                  </div>

                  <div className="border-t border-[#333] pt-5 mt-4">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#666] text-center">
                      Pet Wash™ · Premium Organic Pet Care
                    </p>
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
    );
  }

  return (
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
                  className={`px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] tracking-[0.08em] font-medium transition-all duration-200 ${
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-7">
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
            <div className="mt-10 sm:mt-12 text-center">
              <button
                className="px-10 sm:px-14 py-4 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 inline-flex items-center gap-2.5"
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
  );
}
