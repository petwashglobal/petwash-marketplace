/**
 * Booking Payment & Confirmation Modal
 * 
 * Pet Wash™ escrow payment flow:
 * - Owner pays after Meet & Greet
 * - Payment held in escrow until service completion
 * - Owner confirms completion to release payment
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getApiUrl } from '@/lib/apiConfig';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  CreditCard, Shield, Lock, CheckCircle, Star,
  Loader2, AlertTriangle, Calendar, User
} from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/lib/languageStore";
import { useToast } from "@/hooks/use-toast";

interface BookingDetails {
  requestId: string;
  providerName?: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  petCount: number;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  currency: string;
}

interface BookingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetails | null;
  mode: 'pay' | 'confirm';
}

export function BookingPaymentModal({
  isOpen,
  onClose,
  booking,
  mode,
}: BookingPaymentModalProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [showGoogleReview, setShowGoogleReview] = useState(true);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error('No booking');
      const res = await fetch(getApiUrl(`/api/booking-requests/${booking.requestId}/pay`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethod: 'nayax',
          last4: cardNumber.slice(-4),
        }),
      });
      if (!res.ok) throw new Error('Payment failed');
      return res.json();
    },
    onSuccess: () => {
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
      toast({
        title: isHebrew ? 'התשלום בוצע בהצלחה!' : 'Payment successful!',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה בתשלום' : 'Payment error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error('No booking');
      const res = await fetch(getApiUrl(`/api/booking-requests/${booking.requestId}/confirm`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, review }),
      });
      if (!res.ok) throw new Error('Confirmation failed');
      return res.json();
    },
    onSuccess: () => {
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
      toast({
        title: isHebrew ? 'השירות אושר!' : 'Service confirmed!',
        description: isHebrew ? 'התשלום שוחרר לספק' : 'Payment released to provider',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setStep('form');
    setCardNumber('');
    setExpiry('');
    setCvc('');
    setRating(5);
    setReview('');
    onClose();
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir={isHebrew ? 'rtl' : 'ltr'}>
        {step === 'success' ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {mode === 'pay' 
                ? (isHebrew ? 'התשלום בוצע!' : 'Payment Complete!')
                : (isHebrew ? 'השירות אושר!' : 'Service Confirmed!')}
            </h2>
            <p className="text-gray-600 mb-6">
              {mode === 'pay'
                ? (isHebrew 
                    ? 'התשלום יוחזק עד סיום השירות בהצלחה'
                    : 'Your payment is held in escrow until service completion')
                : (isHebrew 
                    ? 'התשלום שוחרר לספק. תודה על הביקורת!'
                    : 'Payment released to provider. Thank you for your review!')}
            </p>
            <Button 
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full"
              onClick={handleClose}
              data-testid="button-close-payment-success"
            >
              {isHebrew ? 'סגור' : 'Close'}
            </Button>

            {/* Google review — soft ask, only after confirmed service (happy moment), only high ratings */}
            {showGoogleReview && mode === 'confirm' && rating >= 4 && (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center">
                <p className="text-sm font-semibold text-amber-900 mb-0.5">
                  {isHebrew ? '🌟 שמחנו שהכל הלך טוב!' : '🌟 So glad it went well!'}
                </p>
                <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                  {isHebrew
                    ? 'אם יש לך דקה, ביקורת ב-Google עוזרת לנו להגיע לעוד בעלי חיות אהובות ❤️'
                    : 'A quick Google review helps other pet owners find us ❤️'}
                </p>
                <div className="flex gap-2 justify-center">
                  <a
                    href="https://maps.app.goo.gl/yXgfzyiYTYwLwcNy9?g_st=ic"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors"
                  >
                    ⭐ {isHebrew ? 'בכיף, אכתוב ביקורת' : 'Sure, leave a review'}
                  </a>
                  <button
                    onClick={() => setShowGoogleReview(false)}
                    className="text-xs px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    {isHebrew ? 'לא עכשיו' : 'Not now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mode === 'pay' ? (
          <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Lock className="h-5 w-5 text-green-600" />
                {isHebrew ? 'תשלום מאובטח' : 'Secure Payment'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Booking Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{isHebrew ? 'שירות' : 'Service'}</span>
                  <span className="font-medium">{booking.serviceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{isHebrew ? 'תאריכים' : 'Dates'}</span>
                  <span className="font-medium">
                    {format(new Date(booking.startDate), 'dd/MM')} - {format(new Date(booking.endDate), 'dd/MM')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{isHebrew ? 'סכום' : 'Subtotal'}</span>
                  <span>₪{(booking.subtotalCents / 100).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>{isHebrew ? 'עמלת שירות' : 'Service fee'}</span>
                  <span>₪{(booking.serviceFeeCents / 100).toFixed(0)}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-lg">
                  <span>{isHebrew ? 'סה"כ' : 'Total'}</span>
                  <span className="text-pink-600">₪{(booking.totalCents / 100).toFixed(0)}</span>
                </div>
              </div>

              {/* Credit Card Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {isHebrew ? 'מספר כרטיס' : 'Card Number'}
                  </label>
                  <div className="relative">
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      placeholder="1234 5678 9012 3456"
                      className="pl-10 rounded-xl"
                      data-testid="input-card-number"
                    />
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      {isHebrew ? 'תוקף' : 'Expiry'}
                    </label>
                    <Input
                      value={expiry}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                        setExpiry(val);
                      }}
                      placeholder="MM/YY"
                      className="rounded-xl"
                      data-testid="input-expiry"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      CVC
                    </label>
                    <Input
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="123"
                      className="rounded-xl"
                      data-testid="input-cvc"
                    />
                  </div>
                </div>
              </div>

              {/* Escrow Note */}
              <div className="bg-white border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">
                      {isHebrew ? 'תשלום בנאמנות (Escrow)' : 'Escrow Payment'}
                    </p>
                    <p className="text-amber-700">
                      {isHebrew 
                        ? 'התשלום שלך מוחזק בביטחון עד שתאשר שהשירות הושלם כנדרש'
                        : 'Your payment is held securely until you confirm the service was completed successfully'}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full py-6"
                onClick={() => paymentMutation.mutate()}
                disabled={paymentMutation.isPending || cardNumber.length < 16 || !expiry || !cvc}
                data-testid="button-pay"
              >
                {paymentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isHebrew ? 'מעבד...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    {isHebrew ? `שלם ₪${(booking.totalCents / 100).toFixed(0)}` : `Pay ₪${(booking.totalCents / 100).toFixed(0)}`}
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                {isHebrew 
                  ? 'מאובטח ע"י Nayax Israel. תואם PCI DSS.'
                  : 'Secured by Nayax Israel. PCI DSS compliant.'}
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl font-bold">
                {isHebrew ? 'אשר ושחרר תשלום' : 'Confirm & Release Payment'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Rating */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  {isHebrew ? 'איך היה השירות?' : 'How was the service?'}
                </p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                      data-testid={`button-star-${star}`}
                    >
                      <Star 
                        className={`h-8 w-8 ${star <= rating ? 'text-amber-500 fill-current' : 'text-gray-300'}`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-lg font-medium mt-2">
                  {rating === 5 ? (isHebrew ? 'מצוין!' : 'Excellent!') :
                   rating === 4 ? (isHebrew ? 'טוב מאוד' : 'Very Good') :
                   rating === 3 ? (isHebrew ? 'טוב' : 'Good') :
                   rating === 2 ? (isHebrew ? 'בסדר' : 'OK') :
                   (isHebrew ? 'צריך שיפור' : 'Needs Improvement')}
                </p>
              </div>

              {/* Review */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {isHebrew ? 'ספר על החוויה שלך (אופציונלי)' : 'Share your experience (optional)'}
                </label>
                <Textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder={isHebrew 
                    ? 'השמרטף היה מקצועי, אדיב...'
                    : 'The sitter was professional, caring...'
                  }
                  className="min-h-[100px] rounded-xl"
                  data-testid="input-review"
                />
              </div>

              {/* Payment Release Note */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">
                      {isHebrew ? 'שחרור תשלום' : 'Payment Release'}
                    </p>
                    <p className="text-green-700">
                      {isHebrew 
                        ? `בלחיצה על אישור, התשלום של ₪${(booking.totalCents / 100).toFixed(0)} ישוחרר לספק`
                        : `By confirming, ₪${(booking.totalCents / 100).toFixed(0)} will be released to the provider`}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full py-6"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                data-testid="button-confirm-release"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isHebrew ? 'מעבד...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isHebrew ? 'אשר ושחרר תשלום' : 'Confirm & Release Payment'}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
