import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Smartphone, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { WashPackage } from '@shared/schema';
import type { Language } from '@/lib/i18n';
import { trackVoucherRedeemed } from '@/lib/analytics';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface CheckoutModalProps {
  package: WashPackage;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

interface CheckoutResponse {
  success: boolean;
  message: string;
  washesAdded: number;
  amountPaid: number;
  discountApplied: number;
  discountType?: string;
}

export function CheckoutModal({ package: pkg, isOpen, onClose, language: initialLanguage }: CheckoutModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<'credit_card' | 'nayax'>('credit_card');
  const [currentLanguage, setCurrentLanguage] = useState<Language>(initialLanguage);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useFirebaseAuth();
  const { trackPackageSelection } = useAnalytics();

  // CRITICAL: No RTL layout changes - Hebrew mode only changes text content

  const checkoutMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          paymentMethod
        })
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data: CheckoutResponse) => {
      // Track voucher redemption if a discount was applied
      if (data.discountApplied > 0 && data.discountType === 'birthday_coupon') {
        trackVoucherRedeemed(
          user?.uid || 'guest',
          'BIRTHDAY_' + data.discountType,
          pkg.name,
          data.amountPaid
        );
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: currentLanguage === 'en' ? "Purchase Successful!" : "רכישה הושלמה בהצלחה!",
        description: currentLanguage === 'en' 
          ? `${data.washesAdded} washes added to your account. You saved ₪${data.discountApplied}!`
          : `${data.washesAdded} רחיצות נוספו לחשבונך. חסכת ₪${data.discountApplied}!`,
      });
      
      onClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: currentLanguage === 'en' ? "Unauthorized" : "לא מורשה",
          description: currentLanguage === 'en' 
            ? "You are logged out. Logging in again..."
            : "אתה מחובר החוצה. מתחבר שוב...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: currentLanguage === 'en' ? "Payment Failed" : "התשלום נכשל",
        description: currentLanguage === 'en' 
          ? "There was an issue processing your payment. Please try again."
          : "הייתה בעיה בעיבוד התשלום. אנא נסה שוב.",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = () => {
    // SECURITY: Block Nayax payments until API keys are configured
    if (selectedPayment === 'nayax') {
      toast({
        title: currentLanguage === 'en' ? "Payment Method Coming Soon" : "אמצעי תשלום בקרוב",
        description: currentLanguage === 'en' 
          ? "Mobile payment (Nayax) will be available soon. Please use card payment."
          : "תשלום נייד (Nayax) יהיה זמין בקרוב. אנא השתמש בתשלום בכרטיס.",
        variant: "destructive",
      });
      return;
    }
    
    trackPackageSelection(pkg.name, Number(pkg.price), currentLanguage);
    checkoutMutation.mutate(selectedPayment);
  };

  const toggleLanguage = () => {
    setCurrentLanguage(prev => prev === 'en' ? 'he' : 'en');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] ltr"
         style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden">
        {/* Minimalist Header - Apple Style */}
        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">Pet Wash™</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleLanguage}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {currentLanguage.toUpperCase()}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Package Summary - Clean Card */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                {currentLanguage === 'en' ? pkg.name : pkg.nameHe}
              </h3>
              <span className="text-lg font-bold text-gray-900">₪{pkg.price}</span>
            </div>
            <p className="text-sm text-gray-600">
              {pkg.washCount} {currentLanguage === 'en' ? 'washes' : 'רחיצות'}
            </p>
          </div>

          {/* Payment Methods - Minimal Design */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              {currentLanguage === 'en' ? 'Payment Method' : 'אמצעי תשלום'}
            </label>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedPayment('credit_card')}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  selectedPayment === 'credit_card' 
                    ? 'border-gray-900 bg-gray-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">
                    {currentLanguage === 'en' ? 'Card Payment' : 'תשלום בכרטיס'}
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedPayment === 'credit_card' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                }`}>
                  {selectedPayment === 'credit_card' && (
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
                      {currentLanguage === 'en' ? 'Mobile Pay (Nayax)' : 'תשלום נייד (Nayax)'}
                    </span>
                    <span className="text-xs text-amber-600 font-semibold">
                      {currentLanguage === 'en' ? 'Coming Soon' : 'בקרוב'}
                    </span>
                  </div>
                </div>
                <div className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                  {currentLanguage === 'en' ? 'Soon' : 'בקרוב'}
                </div>
              </button>
            </div>
          </div>

          {/* Purchase Button - Apple Style */}
          <Button
            onClick={handlePurchase}
            disabled={checkoutMutation.isPending}
            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {checkoutMutation.isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{currentLanguage === 'en' ? 'Processing...' : 'מעבד...'}</span>
              </div>
            ) : (
              <span>
                {currentLanguage === 'en' ? 'Pay' : 'שלם'} ₪{pkg.price}
              </span>
            )}
          </Button>

          {/* Security Note */}
          <div className="flex items-center justify-center space-x-2 pt-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">
              {currentLanguage === 'en' ? 'Secured by SSL encryption' : 'מאובטח בהצפנת SSL'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}