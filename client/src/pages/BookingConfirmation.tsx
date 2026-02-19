import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GlassmorphismCard } from '@/components/luxury/GlassmorphismCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/PhoneInput';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Check, Calendar, Clock, MapPin, Star, Shield, CreditCard,
  Phone, Mail, Download, Share2, ArrowLeft, CheckCircle2, Loader2
} from 'lucide-react';

const labels = {
  he: {
    title: 'אישור הזמנה',
    bothConfirmed: 'שני הצדדים אישרו',
    bookingId: 'מזהה הזמנה',
    service: 'שירות',
    dates: 'תאריכים',
    pets: 'חיות מחמד',
    subtotal: 'סכום ביניים',
    fee: 'עמלת שירות (15%)',
    total: 'סה"כ',
    status: 'סטטוס',
    confirmed: 'מאושר',
    completed: 'הושלם',
    reviewed: 'נבדק',
    payoutNote: 'התשלום לנותן השירות יועבר תוך 72 שעות',
    sendSMS: 'שלח SMS',
    sendEmail: 'שלח קבלה במייל',
    smsSent: 'SMS נשלח בהצלחה',
    emailSent: 'קבלה נשלחה במייל',
    back: 'חזרה',
    escrow: 'נתיב מאובטח 72 שעות',
    thankYou: 'תודה שבחרת ב-Pet Wash™!',
    phoneLabel: 'מספר טלפון',
    emailLabel: 'כתובת אימייל',
    phonePlaceholder: '+61...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'אשר ושלח התראות',
    confirming: 'מאשר...',
    rating: 'דירוג',
    review: 'ביקורת',
  },
  en: {
    title: 'Booking Confirmation',
    bothConfirmed: 'Both Parties Confirmed',
    bookingId: 'Booking ID',
    service: 'Service',
    dates: 'Dates',
    pets: 'Pets',
    subtotal: 'Subtotal',
    fee: 'Service Fee (15%)',
    total: 'Total',
    status: 'Status',
    confirmed: 'Confirmed',
    completed: 'Completed',
    reviewed: 'Reviewed',
    payoutNote: 'Provider payout will be transferred within 72 hours',
    sendSMS: 'Send SMS',
    sendEmail: 'Send Email Receipt',
    smsSent: 'SMS sent successfully',
    emailSent: 'Receipt sent to email',
    back: 'Back',
    escrow: '72-Hour Secure Escrow',
    thankYou: 'Thank you for choosing Pet Wash™!',
    phoneLabel: 'Phone Number',
    emailLabel: 'Email Address',
    phonePlaceholder: '+61...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'Confirm & Send Notifications',
    confirming: 'Confirming...',
    rating: 'Rating',
    review: 'Review',
  },
};

export default function BookingConfirmation() {
  const { requestId } = useParams<{ requestId: string }>();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const t = labels[language === 'he' ? 'he' : 'en'];

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const { data: bookingData, isLoading } = useQuery({
    queryKey: ['/api/booking-requests', requestId],
    enabled: !!requestId,
  });

  const booking = (bookingData as any)?.booking;

  useEffect(() => {
    if (booking && ['completed', 'reviewed'].includes(booking.status) && booking.ownerConfirmedAt) {
      setConfirmed(true);
    }
  }, [booking]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/booking-requests/${requestId}/confirm`, {
        rating,
        review: reviewText || undefined,
        ownerPhone: phone || undefined,
        ownerEmail: email || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', requestId] });
      toast({
        title: '✅ ' + t.confirmed,
        description: [
          data.smsSent ? t.smsSent : null,
          data.emailSent ? t.emailSent : null,
          t.payoutNote,
        ].filter(Boolean).join('. '),
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to confirm booking', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  if (!booking) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-gray-500">Booking not found</p>
        </div>
      </Layout>
    );
  }

  const isOwner = booking.ownerId === user?.uid;
  const canConfirm = isOwner && booking.status === 'completed' && !confirmed;

  return (
    <Layout>
      <div className="min-h-screen bg-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/provider/bookings')}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.back}
          </Button>

          {confirmed && (
            <div className="mb-8 rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-center text-white">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
                <h1 className="text-3xl font-bold mb-2">{t.bothConfirmed}</h1>
                <p className="text-emerald-100">{t.thankYou}</p>
              </div>
            </div>
          )}

          <GlassmorphismCard className="mb-6">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-6">{t.title}</h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.bookingId}</span>
                  <span className="font-mono font-semibold text-sm">{booking.requestId}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.service}</span>
                  <span className="font-semibold capitalize">{booking.serviceType?.replace(/_/g, ' ')}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4" /> {t.dates}</span>
                  <span className="font-semibold text-sm">
                    {booking.startDate ? new Date(booking.startDate).toLocaleDateString() : 'N/A'}
                    {' - '}
                    {booking.endDate ? new Date(booking.endDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.pets}</span>
                  <span className="font-semibold">{booking.petCount}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.subtotal}</span>
                  <span className="font-semibold">₪{(booking.subtotalCents / 100).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.fee}</span>
                  <span className="font-semibold">₪{(booking.serviceFeeCents / 100).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b-2 border-gray-200">
                  <span className="text-lg font-bold">{t.total}</span>
                  <span className="text-lg font-bold">₪{(booking.totalCents / 100).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">{t.status}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    confirmed ? 'bg-emerald-100 text-emerald-700' :
                    booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {confirmed ? t.confirmed : booking.status}
                  </span>
                </div>
              </div>
            </div>
          </GlassmorphismCard>

          {confirmed && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-800">{t.escrow}</p>
                  <p className="text-blue-600 text-sm">{t.payoutNote}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {canConfirm && (
            <GlassmorphismCard className="mb-6">
              <div className="p-6">
                <h3 className="font-bold mb-4">{t.confirmAndNotify}</h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Star className="w-4 h-4 inline mr-1" /> {t.rating}
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            star <= rating ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <Star className="w-5 h-5" fill={star <= rating ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.review}
                    </label>
                    <Textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder="Great service! (optional)"
                      className="resize-none h-20 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" /> {t.phoneLabel}
                    </label>
                    <PhoneInput
                      value={phone}
                      onChange={(val) => setPhone(val || '')}
                      defaultCountry="IL"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Mail className="w-4 h-4 inline mr-1" /> {t.emailLabel}
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-3 rounded-xl font-semibold"
                >
                  {confirmMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.confirming}</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> {t.confirmAndNotify}</>
                  )}
                </Button>
              </div>
            </GlassmorphismCard>
          )}
        </div>
      </div>
    </Layout>
  );
}
