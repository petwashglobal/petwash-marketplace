import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CreditCard, X, Mail, Shield, User, Lock, ChevronRight, Loader2, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

import type { WashPackage } from '@shared/schema';
import type { Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';
import { logger } from "@/lib/logger";
import { getApiUrl } from '@/lib/apiConfig';

interface CreditPackage {
  id: string;
  name: string;
  nameHe?: string;
  description?: string | null;
  descriptionHe?: string | null;
  price: string;
  washCount?: number;
  isActive: boolean;
  createdAt?: any;
  isCreditGift?: boolean;
}

interface ExpressCheckoutModalProps {
  package: WashPackage | CreditPackage;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  isGiftCard?: boolean;
}

interface ExpressCheckoutData {
  email: string;
  recipientName?: string;
  recipientEmail?: string;
  personalMessage?: string;
  paymentMethod: 'nayax';
}

const tx = (key: string, lang: string): string => {
  const translations: Record<string, Record<string, string>> = {
    yourEmail: { he: 'אימייל שלך', en: 'Your email', ar: 'بريدك الإلكتروني', ru: 'Ваш email', fr: 'Votre email', es: 'Tu email' },
    emailPlaceholder: { he: 'name@example.com', en: 'name@example.com', ar: 'name@example.com', ru: 'name@example.com', fr: 'name@example.com', es: 'name@example.com' },
    recipientName: { he: 'שם המקבל/ת', en: 'Recipient name', ar: 'اسم المستلم', ru: 'Имя получателя', fr: 'Nom du destinataire', es: 'Nombre del destinatario' },
    recipientNamePlaceholder: { he: 'שם מלא', en: 'Full name', ar: 'الاسم الكامل', ru: 'Полное имя', fr: 'Nom complet', es: 'Nombre completo' },
    recipientEmail: { he: 'אימייל המקבל/ת', en: 'Recipient email', ar: 'بريد المستلم', ru: 'Email получателя', fr: 'Email du destinataire', es: 'Email del destinatario' },
    personalMessage: { he: 'הודעה אישית', en: 'Personal message', ar: 'رسالة شخصية', ru: 'Личное сообщение', fr: 'Message personnel', es: 'Mensaje personal' },
    messagePlaceholder: { he: 'כתוב הודעה אישית...', en: 'Write a personal message...', ar: 'اكتب رسالة شخصية...', ru: 'Напишите личное сообщение...', fr: 'Écrivez un message personnel...', es: 'Escribe un mensaje personal...' },
    payNow: { he: 'שלם עכשיו', en: 'Pay now', ar: 'ادفع الآن', ru: 'Оплатить', fr: 'Payer maintenant', es: 'Pagar ahora' },
    processing: { he: 'מעבד תשלום...', en: 'Processing...', ar: 'جارٍ المعالجة...', ru: 'Обработка...', fr: 'Traitement...', es: 'Procesando...' },
    securePayment: { he: 'תשלום מאובטח באמצעות Nayax', en: 'Secure payment via Nayax', ar: 'دفع آمن عبر Nayax', ru: 'Безопасная оплата через Nayax', fr: 'Paiement sécurisé via Nayax', es: 'Pago seguro vía Nayax' },
    termsAccept: { he: 'אני מסכים/ה ל', en: 'I agree to the', ar: 'أوافق على', ru: 'Я согласен с', fr: "J'accepte les", es: 'Acepto los' },
    termsLink: { he: 'תנאי השימוש', en: 'Terms of Service', ar: 'شروط الاستخدام', ru: 'Условия использования', fr: "Conditions d'utilisation", es: 'Términos de Servicio' },
    andPrivacy: { he: 'ו', en: 'and', ar: 'و', ru: 'и', fr: 'et', es: 'y' },
    privacyLink: { he: 'מדיניות פרטיות', en: 'Privacy Policy', ar: 'سياسة الخصوصية', ru: 'Политикой конфиденциальности', fr: 'Politique de confidentialité', es: 'Política de Privacidad' },
    orderSummary: { he: 'סיכום הזמנה', en: 'Order summary', ar: 'ملخص الطلب', ru: 'Сводка заказа', fr: 'Résumé de la commande', es: 'Resumen del pedido' },
    total: { he: 'סה"כ לתשלום', en: 'Total', ar: 'المجموع', ru: 'Итого', fr: 'Total', es: 'Total' },
    digitalGift: { he: 'תו שי דיגיטלי', en: 'Digital gift card', ar: 'قسيمة رقمية', ru: 'Электронный ваучер', fr: 'Bon cadeau numérique', es: 'Vale regalo digital' },
    washes: { he: 'שטיפות', en: 'washes', ar: 'غسلات', ru: 'моек', fr: 'lavages', es: 'lavados' },
    platformCredit: { he: 'קרדיט פלטפורמה', en: 'Platform credit', ar: 'رصيد المنصة', ru: 'Кредит платформы', fr: 'Crédit plateforme', es: 'Crédito plataforma' },
    encryptedData: { he: 'נתונים מוצפנים SSL 256-bit', en: 'SSL 256-bit encrypted', ar: 'تشفير SSL 256-bit', ru: 'SSL 256-bit шифрование', fr: 'Chiffrement SSL 256-bit', es: 'Cifrado SSL 256-bit' },
    expressCheckout: { he: 'תשלום מהיר', en: 'Express checkout', ar: 'الدفع السريع', ru: 'Быстрая оплата', fr: 'Paiement express', es: 'Pago rápido' },
    pleaseAcceptTerms: { he: 'יש לאשר את תנאי השימוש', en: 'Please accept the terms', ar: 'يرجى قبول الشروط', ru: 'Примите условия', fr: 'Veuillez accepter les conditions', es: 'Acepta los términos' },
    checkoutFailed: { he: 'שגיאה בתשלום', en: 'Checkout failed', ar: 'فشل الدفع', ru: 'Ошибка оплаты', fr: 'Échec du paiement', es: 'Error en el pago' },
    tryAgain: { he: 'נסו שנית', en: 'Please try again', ar: 'حاول مرة أخرى', ru: 'Попробуйте снова', fr: 'Réessayez', es: 'Inténtalo de nuevo' },
    orderComplete: { he: 'ההזמנה הושלמה!', en: 'Order complete!', ar: 'تم الطلب!', ru: 'Заказ завершён!', fr: 'Commande terminée !', es: '¡Pedido completado!' },
    checkEmail: { he: 'בדוק את האימייל שלך', en: 'Check your email', ar: 'تحقق من بريدك', ru: 'Проверьте email', fr: 'Vérifiez votre email', es: 'Revisa tu email' },
    poweredBy: { he: 'מופעל על ידי', en: 'Powered by', ar: 'مدعوم من', ru: 'При поддержке', fr: 'Propulsé par', es: 'Desarrollado por' },
  };
  return translations[key]?.[lang] || translations[key]?.en || key;
};

export function ExpressCheckoutModal({ 
  package: pkg, 
  isOpen, 
  onClose, 
  language,
  isGiftCard = false 
}: ExpressCheckoutModalProps) {
  const [formData, setFormData] = useState<ExpressCheckoutData>({
    email: '',
    recipientName: '',
    recipientEmail: '',
    personalMessage: '',
    paymentMethod: 'nayax'
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  const { toast } = useToast();
  const { language: currentLang } = useLanguage();
  const lang = language || currentLang || 'he';
  const isRtl = ['he', 'ar'].includes(lang);
  const dir = isRtl ? 'rtl' : 'ltr';

  const expressCheckoutMutation = useMutation({
    mutationFn: async (data: ExpressCheckoutData) => {
      const endpoint = isGiftCard ? '/api/nayax-checkout' : '/api/express-checkout';
      const body = isGiftCard ? {
        packageId: pkg.id,
        email: data.email,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        personalMessage: data.personalMessage,
        paymentMethod: 'nayax',
        isGiftCard: true,
        useFullPrice: true,
      } : {
        packageId: pkg.id,
        email: data.email,
        paymentMethod: 'nayax',
        applyMemberDiscount: true,
      };

      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.redirectUrl || data.paymentUrl) {
        window.location.href = data.redirectUrl || data.paymentUrl;
      } else {
        toast({
          title: tx('orderComplete', lang),
          description: tx('checkEmail', lang),
        });
        onClose();
      }
    },
    onError: () => {
      toast({
        title: tx('checkoutFailed', lang),
        description: tx('tryAgain', lang),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      toast({
        title: tx('pleaseAcceptTerms', lang),
        variant: "destructive",
      });
      return;
    }

    if (!formData.email.trim()) return;
    
    expressCheckoutMutation.mutate(formData);
  };

  if (!isOpen) {
    logger.debug('ExpressCheckoutModal not opening - isOpen is false');
    return null;
  }

  logger.debug('ExpressCheckoutModal rendering', { packageName: pkg?.name });

  const price = typeof pkg.price === 'string' ? pkg.price : String(pkg.price);
  const displayName = lang === 'he' && pkg.nameHe ? pkg.nameHe : pkg.name;
  const subtitle = isGiftCard 
    ? (pkg.isCreditGift ? tx('platformCredit', lang) : tx('digitalGift', lang))
    : (pkg.washCount ? `${pkg.washCount} ${tx('washes', lang)}` : tx('platformCredit', lang));

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div 
        className="bg-white w-full sm:max-w-[420px] sm:mx-4 overflow-hidden sm:shadow-2xl max-h-[95vh] overflow-y-auto"
        style={{ borderRadius: '2px 2px 0 0', ...(typeof window !== 'undefined' && window.innerWidth >= 640 ? { borderRadius: '2px' } : {}) }}
        onClick={(e) => e.stopPropagation()}
        dir={dir}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[#eee] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="⁦Pet Wash™⁩" 
              className="h-7 w-auto object-contain"
            />
            <span className="text-[10px] tracking-[0.15em] uppercase text-[#999] font-medium">
              {tx('expressCheckout', lang)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <X className="w-4 h-4 text-[#999]" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div className="p-4 bg-white border border-[#eee]" style={{ borderRadius: '2px' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-[#1a1a1a] text-sm" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {displayName}
              </h3>
              <span className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                ₪{price}
              </span>
            </div>
            <p className="text-[11px] text-[#999] tracking-wide">{subtitle}</p>
          </div>

          <div>
            <Label htmlFor="checkout-email" className="text-[10px] tracking-[0.08em] uppercase text-[#888] font-medium">
              {tx('yourEmail', lang)} *
            </Label>
            <div className="relative mt-1">
              <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-[#bbb]`} />
              <Input
                id="checkout-email"
                type="email"
                inputMode="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={tx('emailPlaceholder', lang)}
                required
                className={`${isRtl ? 'pr-9' : 'pl-9'} border-[#ddd] bg-white text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px]`}
                dir="ltr"
                autoComplete="email"
                autoCapitalize="none"
                enterKeyHint="next"
              />
            </div>
          </div>

          {isGiftCard && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="checkout-recipient" className="text-[10px] tracking-[0.08em] uppercase text-[#888] font-medium">
                    {tx('recipientName', lang)}
                  </Label>
                  <div className="relative mt-1">
                    <User className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-[#bbb]`} />
                    <Input
                      id="checkout-recipient"
                      type="text"
                      value={formData.recipientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                      placeholder={tx('recipientNamePlaceholder', lang)}
                      className={`${isRtl ? 'pr-9' : 'pl-9'} border-[#ddd] bg-white text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px]`}
                      dir={dir}
                      autoComplete="name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="checkout-recipient-email" className="text-[10px] tracking-[0.08em] uppercase text-[#888] font-medium">
                    {tx('recipientEmail', lang)}
                  </Label>
                  <div className="relative mt-1">
                    <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-[#bbb]`} />
                    <Input
                      id="checkout-recipient-email"
                      type="email"
                      inputMode="email"
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                      placeholder={tx('emailPlaceholder', lang)}
                      className={`${isRtl ? 'pr-9' : 'pl-9'} border-[#ddd] bg-white text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px]`}
                      dir="ltr"
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="next"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="checkout-message" className="text-[10px] tracking-[0.08em] uppercase text-[#888] font-medium">
                  {tx('personalMessage', lang)}
                </Label>
                <Textarea
                  id="checkout-message"
                  value={formData.personalMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, personalMessage: e.target.value }))}
                  placeholder={tx('messagePlaceholder', lang)}
                  rows={2}
                  className="mt-1 border-[#ddd] bg-white text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#c9a96e] focus:ring-0 rounded-none text-[16px] resize-none"
                  dir={dir}
                  autoCapitalize="sentences"
                  spellCheck={true}
                />
              </div>
            </>
          )}

          <div className="flex items-start gap-2 py-1">
            <Checkbox
              id="checkout-terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-0.5 border-[#ccc] data-[state=checked]:bg-[#1a1a1a] data-[state=checked]:border-[#1a1a1a] rounded-none"
            />
            <label htmlFor="checkout-terms" className="text-[11px] text-[#888] leading-relaxed cursor-pointer select-none">
              {tx('termsAccept', lang)}{' '}
              <a href="/terms" target="_blank" className="text-[#c9a96e] hover:underline">{tx('termsLink', lang)}</a>
              {' '}{tx('andPrivacy', lang)}{' '}
              <a href="/privacy-policy" target="_blank" className="text-[#c9a96e] hover:underline">{tx('privacyLink', lang)}</a>
            </label>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] tracking-[0.1em] uppercase text-[#999] font-medium">
                {tx('total', lang)}
              </span>
              <span className="text-xl font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                ₪{price}
              </span>
            </div>

            <Button
              type="submit"
              disabled={expressCheckoutMutation.isPending || !termsAccepted}
              className="w-full h-12 bg-[#1a1a1a] hover:bg-[#333] text-white text-[11px] tracking-[0.15em] uppercase font-medium transition-all duration-300 disabled:opacity-40 rounded-none"
            >
              {expressCheckoutMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{tx('processing', lang)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{tx('payNow', lang)} · ₪{price}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </Button>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#c9a96e]" />
              <span className="text-[10px] text-[#aaa] tracking-wide">
                {tx('encryptedData', lang)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#ccc] tracking-wider">
                {tx('poweredBy', lang)} <span className="font-medium text-[#aaa]">Nayax</span> · ⁦Pet Wash™⁩
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
