import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CreditCard, Smartphone, X, Mail, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import type { WashPackage } from '@shared/schema';
import type { Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';
import { logger } from "@/lib/logger";

interface ExpressCheckoutModalProps {
  package: WashPackage;
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
  paymentMethod: 'credit_card' | 'nayax';
}

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
    paymentMethod: 'credit_card'
  });
  
  const { toast } = useToast();
  const { t } = useLanguage();

  // CRITICAL: No RTL layout changes - Hebrew mode only changes text content

  const expressCheckoutMutation = useMutation({
    mutationFn: async (data: ExpressCheckoutData) => {
      // For gift cards: always use full price (no discounts)
      if (isGiftCard) {
        const response = await fetch('/api/nayax-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: pkg.id,
            email: data.email,
            recipientName: data.recipientName,
            recipientEmail: data.recipientEmail,
            personalMessage: data.personalMessage,
            paymentMethod: data.paymentMethod,
            isGiftCard: true,
            useFullPrice: true, // No discounts for gift cards
          }),
        });
        
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } else {
        // For regular packages: allow discounts for authenticated members
        const response = await fetch('/api/express-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: pkg.id,
            email: data.email,
            paymentMethod: data.paymentMethod,
            applyMemberDiscount: true, // Allow 10% discount for authenticated members
          }),
        });
        
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      }
    },
    onSuccess: (data: any) => {
      if (data.redirectUrl) {
        // Redirect to Nayax payment gateway
        window.location.href = data.redirectUrl;
      } else {
        toast({
          title: t('express.orderComplete'),
          description: isGiftCard ? t('express.checkEmailGiftCard') : t('express.checkEmailPurchase'),
        });
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: t('express.checkoutFailed'),
        description: t('express.checkoutError'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // SECURITY: Block Nayax payments until API keys are configured
    if (formData.paymentMethod === 'nayax') {
      toast({
        title: t('express.paymentComingSoon'),
        description: t('express.nayaxComingSoon'),
        variant: "destructive",
      });
      return;
    }
    
    expressCheckoutMutation.mutate(formData);
  };

  if (!isOpen) {
    logger.debug('ExpressCheckoutModal not opening - isOpen is false');
    return null;
  }

  logger.debug('ExpressCheckoutModal rendering', { packageName: pkg?.name });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] ltr"
         style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Minimalist Header - Apple Style */}
        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">Pet Wash™</span>
            </div>
            
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Package Summary - Clean Card */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                {language === 'en' ? pkg.name : pkg.nameHe}
              </h3>
              <span className="text-lg font-bold text-gray-900">₪{pkg.price}</span>
            </div>
            <p className="text-sm text-gray-600">
              {isGiftCard ? t('express.digitalVoucher') : `${pkg.washCount} ${t('express.washes')}`}
            </p>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              {t('express.yourEmail')}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t('express.yourEmailPlaceholder')}
                required
                className="pl-10 border-gray-200 focus:border-gray-900 focus:ring-0"
              />
            </div>
          </div>

          {/* Gift Card Fields */}
          {isGiftCard && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recipientName" className="text-sm font-medium text-gray-700">
                  {t('express.recipientName')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="recipientName"
                    type="text"
                    value={formData.recipientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                    placeholder={t('express.recipientNamePlaceholder')}
                    className="pl-10 border-gray-200 focus:border-gray-900 focus:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientEmail" className="text-sm font-medium text-gray-700">
                  {t('express.recipientEmail')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={formData.recipientEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    placeholder={t('express.recipientEmailPlaceholder')}
                    className="pl-10 border-gray-200 focus:border-gray-900 focus:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalMessage" className="text-sm font-medium text-gray-700">
                  {t('express.personalMessage')}
                </Label>
                <Textarea
                  id="personalMessage"
                  value={formData.personalMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, personalMessage: e.target.value }))}
                  placeholder={t('express.personalMessagePlaceholder')}
                  rows={3}
                  className="border-gray-200 focus:border-gray-900 focus:ring-0"
                />
              </div>
            </>
          )}

          {/* Payment Methods */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              {t('express.paymentMethod')}
            </label>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'credit_card' }))}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  formData.paymentMethod === 'credit_card' 
                    ? 'border-gray-900 bg-gray-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">
                    {t('express.cardPayment')}
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 ${
                  formData.paymentMethod === 'credit_card' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                }`}>
                  {formData.paymentMethod === 'credit_card' && (
                    <div className="w-1 h-1 bg-white rounded-full mx-auto mt-1"></div>
                  )}
                </div>
              </button>
              
              <button
                type="button"
                disabled={true}
                className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed relative"
              >
                <div className="flex items-center space-x-3">
                  <Smartphone className="w-5 h-5 text-gray-400" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-gray-500">
                      {t('express.mobilePay')}
                    </span>
                    <span className="text-xs text-amber-600 font-semibold">
                      {t('express.comingSoon')}
                    </span>
                  </div>
                </div>
                <div className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                  {t('express.soon')}
                </div>
              </button>
            </div>
          </div>

          {/* Purchase Button */}
          <Button
            type="submit"
            disabled={expressCheckoutMutation.isPending}
            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {expressCheckoutMutation.isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{t('express.processing')}</span>
              </div>
            ) : (
              <span>
                {t('express.completeOrder')} • ₪{pkg.price}
              </span>
            )}
          </Button>

          {/* Security Note */}
          <div className="flex items-center justify-center space-x-2 pt-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">
              {t('express.securedSSL')}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}