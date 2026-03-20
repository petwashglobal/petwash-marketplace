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
  Phone, Mail, Download, Share2, ArrowLeft, CheckCircle2, Loader2,
  RefreshCw, Search, XCircle, AlertTriangle, MessageCircle, Coins,
} from 'lucide-react';

const SERVICE_TO_ROUTE: Record<string, string> = {
  k9000_wash:  '/k9000/booking',
  pet_sitting: '/sitter-suite',
  dog_walking: '/walk-my-pet',
  grooming:    '/groomers',
  pet_taxi:    '/pettrek',
  daycare:     '/sitter-suite',
  training:    '/marketplace',
};

const labels = {
  he: {
    title: 'אישור הזמנה',
    bothConfirmed: 'ההזמנה הושלמה!',
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
    back: 'כל ההזמנות',
    escrow: 'נתיב מאובטח 72 שעות',
    thankYou: 'תודה שבחרת ב-Pet Wash™!',
    phoneLabel: 'מספר טלפון',
    emailLabel: 'כתובת אימייל',
    phonePlaceholder: '+972...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'אשר ושלח התראות',
    confirming: 'מאשר...',
    rating: 'דרג את השירות',
    review: 'ביקורת (אופציונלי)',
    chatNowTitle: 'ספקך אישר! מוכן להתחיל?',
    chatNowSub: 'שוחח עם הספק, תאם פרטים, ותכן את הביקור.',
    chatNowBtn: 'שוחח עכשיו',
    rebookTitle: 'הזמן שוב',
    rebookWith: 'הזמן שוב עם',
    rebookSub: 'אותן חיות מחמד, אותו שירות — בלחיצה אחת',
    rebookBtn: 'הזמן שוב',
    viewAllBookings: 'כל ההזמנות שלי',
    declinedTitle: 'הבקשה נדחתה',
    cancelledTitle: 'ההזמנה בוטלה',
    findAnotherProvider: 'חפש ספק אחר',
    findAnotherSub: 'יש לנו ספקים נוספים שישמחו לעזור',
    declinedReason: 'סיבה',
    cancelledBy: 'בוטל על ידי',
    byProvider: 'נותן השירות',
    byCustomer: 'הלקוח',
    refund: 'החזר כספי',
    loyaltyRedeemed: 'קרדיטים מומשו',
    creditsEarned: 'קרדיטים שנצברו',
  },
  en: {
    title: 'Booking Confirmation',
    bothConfirmed: 'Booking Complete!',
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
    back: 'All Bookings',
    escrow: '72-Hour Secure Escrow',
    thankYou: 'Thank you for choosing Pet Wash™!',
    phoneLabel: 'Phone Number',
    emailLabel: 'Email Address',
    phonePlaceholder: '+972...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'Confirm & Send Notifications',
    confirming: 'Confirming...',
    rating: 'Rate the service',
    review: 'Review (optional)',
    chatNowTitle: 'Your provider confirmed! Ready to start?',
    chatNowSub: 'Chat with your provider, coordinate details, and prepare for the visit.',
    chatNowBtn: 'Chat Now',
    rebookTitle: 'Book Again',
    rebookWith: 'Book again with',
    rebookSub: 'Same pets, same service — one tap',
    rebookBtn: 'Book Again',
    viewAllBookings: 'My Bookings',
    declinedTitle: 'Request Declined',
    cancelledTitle: 'Booking Cancelled',
    findAnotherProvider: 'Find Another Provider',
    findAnotherSub: 'We have other providers ready to help',
    declinedReason: 'Reason',
    cancelledBy: 'Cancelled by',
    byProvider: 'Provider',
    byCustomer: 'Customer',
    refund: 'Refund',
    loyaltyRedeemed: 'Credits Redeemed',
    creditsEarned: 'Credits Earned',
  },
};

/* ── Chat Now Panel (shown when booking is confirmed / accepted) ──────── */
interface ChatNowPanelProps {
  booking: any;
  t: typeof labels['en'];
  navigate: (path: string) => void;
}

function ChatNowPanel({ booking, t, navigate }: ChatNowPanelProps) {
  return (
    <div
      className="rounded-2xl p-5 mb-4 flex items-center justify-between gap-4"
      style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', border: '1.5px solid #3B82F622' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#3B82F61A' }}
        >
          <MessageCircle className="w-5 h-5 text-blue-500" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">{t.chatNowTitle}</p>
          <p className="text-xs text-gray-500">{t.chatNowSub}</p>
        </div>
      </div>
      <Button
        onClick={() => navigate(`/booking-chat/${booking.requestId}`)}
        className="flex-shrink-0 font-semibold text-sm px-5 py-2 rounded-xl text-white"
        style={{ background: '#3B82F6', border: 'none' }}
      >
        {t.chatNowBtn}
      </Button>
    </div>
  );
}

/* ── Rebook CTA Panel ─────────────────────────────────────────────────── */
interface RebookPanelProps {
  booking: any;
  t: typeof labels['en'];
  navigate: (path: string) => void;
}

function RebookPanel({ booking, t, navigate }: RebookPanelProps) {
  const handleRebook = () => {
    if (!booking.providerId) {
      navigate(SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace');
      return;
    }
    const p = new URLSearchParams({ rebook: '1' });
    if (booking.petIds?.length)     p.set('petIds',  booking.petIds.join(','));
    if (booking.addonCodes?.length) p.set('addons',  booking.addonCodes.join(','));
    if (booking.ownerMessage)       p.set('notes',   booking.ownerMessage);
    navigate(`/booking/new/${booking.serviceType}/${booking.providerId}?${p.toString()}`);
  };

  const providerLabel = booking.providerName
    ? `${t.rebookWith} ${booking.providerName}`
    : t.rebookTitle;

  return (
    <div
      className="rounded-2xl p-5 mb-4 flex items-center justify-between gap-4"
      style={{ background: 'linear-gradient(135deg, #fdf8ee 0%, #fef9f0 100%)', border: '1.5px solid #C5A55A33' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#C5A55A1A' }}
        >
          <RefreshCw className="w-5 h-5" style={{ color: '#C5A55A' }} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">{providerLabel}</p>
          <p className="text-xs text-gray-500">{t.rebookSub}</p>
        </div>
      </div>
      <Button
        onClick={handleRebook}
        className="flex-shrink-0 font-semibold text-sm px-5 py-2 rounded-xl"
        style={{ background: '#C5A55A', color: '#fff', border: 'none' }}
      >
        {t.rebookBtn}
      </Button>
    </div>
  );
}

/* ── Declined / Cancelled Panel ───────────────────────────────────────── */
interface StatusAlertPanelProps {
  booking: any;
  t: typeof labels['en'];
  navigate: (path: string) => void;
}

function StatusAlertPanel({ booking, t, navigate }: StatusAlertPanelProps) {
  const isDeclined   = booking.status === 'declined';
  const isCancelled  = booking.status === 'cancelled';
  if (!isDeclined && !isCancelled) return null;

  const cleanReason = (r: string | null | undefined) =>
    r?.replace(/^(DECLINED:|CANCELLED:|DISPUTE:|CANCELED:)\s*/i, '') || null;

  const reason    = cleanReason(booking.cancellationReason);
  const cancelledByLabel = booking.cancelledBy === 'provider' ? t.byProvider : t.byCustomer;
  const hasRefund = (booking.refundCents ?? 0) > 0;

  const serviceRoute = SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace';

  return (
    <div className="mb-4 space-y-3">
      {/* Alert card */}
      <Card className={isDeclined ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isDeclined
              ? <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              : <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            }
            <div className="space-y-1 min-w-0">
              <p className={`font-bold text-sm ${isDeclined ? 'text-red-800' : 'text-orange-800'}`}>
                {isDeclined ? t.declinedTitle : t.cancelledTitle}
              </p>
              {reason && (
                <p className={`text-xs ${isDeclined ? 'text-red-600' : 'text-orange-600'}`}>
                  {t.declinedReason}: {reason}
                </p>
              )}
              {isCancelled && booking.cancelledBy && (
                <p className="text-xs text-orange-600">{t.cancelledBy}: {cancelledByLabel}</p>
              )}
              {hasRefund && (
                <p className={`text-xs font-semibold ${isDeclined ? 'text-red-700' : 'text-orange-700'}`}>
                  {t.refund}: ₪{((booking.refundCents ?? 0) / 100).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Find another provider CTA */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between gap-4"
        style={{ background: '#ffffff', border: '1.5px solid rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Search className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">{t.findAnotherProvider}</p>
            <p className="text-xs text-gray-500">{t.findAnotherSub}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(serviceRoute)}
          className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border-gray-300"
        >
          {t.findAnotherProvider}
        </Button>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function BookingConfirmation() {
  const { requestId } = useParams<{ requestId: string }>();
  const [, navigate]  = useLocation();
  const { user }      = useFirebaseAuth();
  const { language }  = useLanguage();
  const { toast }     = useToast();
  const t             = labels[language === 'he' ? 'he' : 'en'];
  const isRTL         = language === 'he';

  const [phone, setPhone]           = useState('');
  const [email, setEmail]           = useState('');
  const [rating, setRating]         = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [confirmed, setConfirmed]   = useState(false);

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
          data.smsSent  ? t.smsSent  : null,
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

  const isOwner      = booking.ownerId === user?.uid;
  const canConfirm   = isOwner && booking.status === 'completed' && !confirmed;
  const showChatNow  = isOwner && booking.status === 'confirmed' && !!booking.requestId;
  const showRebook   = isOwner && (confirmed || booking.status === 'reviewed') && booking.providerId;
  const showAlertPanel = isOwner && ['declined', 'cancelled'].includes(booking.status);

  return (
    <Layout>
      <div className="min-h-screen bg-white py-8 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto">

          {/* Back button → /my-bookings */}
          <Button
            variant="ghost"
            onClick={() => navigate('/my-bookings')}
            className="mb-6 gap-2"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {t.back}
          </Button>

          {/* ── Post-confirmation green banner ── */}
          {confirmed && (
            <div className="mb-6 rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-center text-white">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
                <h1 className="text-3xl font-bold mb-2">{t.bothConfirmed}</h1>
                <p className="text-emerald-100">{t.thankYou}</p>
              </div>
            </div>
          )}

          {/* ── Chat Now panel (booking accepted, awaiting service) ── */}
          {showChatNow && (
            <ChatNowPanel booking={booking} t={t} navigate={navigate} />
          )}

          {/* ── Rebook panel (post-confirm or already reviewed) ── */}
          {showRebook && (
            <RebookPanel booking={booking} t={t} navigate={navigate} />
          )}

          {/* ── Declined / Cancelled alert + find-another ── */}
          {showAlertPanel && (
            <StatusAlertPanel booking={booking} t={t} navigate={navigate} />
          )}

          {/* ── Booking detail card ── */}
          <GlassmorphismCard className="mb-6">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-6">{t.title}</h2>

              <div className="space-y-0">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.bookingId}</span>
                  <span className="font-mono font-semibold text-sm">{booking.requestId}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.service}</span>
                  <span className="font-semibold capitalize">{booking.serviceType?.replace(/_/g, ' ')}</span>
                </div>

                {booking.providerName && (
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-500">ספק / Provider</span>
                    <span className="font-semibold">{booking.providerName}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> {t.dates}
                  </span>
                  <span className="font-semibold text-sm">
                    {booking.startDate ? new Date(booking.startDate).toLocaleDateString() : 'N/A'}
                    {' – '}
                    {booking.endDate   ? new Date(booking.endDate).toLocaleDateString()   : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">{t.pets}</span>
                  <span className="font-semibold">{booking.petCount}</span>
                </div>

                {booking.subtotalCents != null && (
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-500">{t.subtotal}</span>
                    <span className="font-semibold">₪{(booking.subtotalCents / 100).toFixed(2)}</span>
                  </div>
                )}

                {booking.serviceFeeCents != null && (
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-500">{t.fee}</span>
                    <span className="font-semibold">₪{(booking.serviceFeeCents / 100).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3 border-b-2 border-gray-200">
                  <span className="text-lg font-bold">{t.total}</span>
                  <span className="text-lg font-bold">₪{(booking.totalCents / 100).toFixed(2)}</span>
                </div>

                {/* Loyalty credits redeemed row */}
                {booking.loyaltyRedeemedCents > 0 && (
                  <div className="flex justify-between items-center py-2.5 border-b border-[#C5A55A]/20 bg-[#C5A55A]/5 rounded-xl px-2 mt-1">
                    <span className="flex items-center gap-1.5 text-sm text-[#7A5C1E] font-medium">
                      <Coins className="w-4 h-4 text-[#C5A55A]" />
                      {(t as any).loyaltyRedeemed}
                    </span>
                    <span className="text-sm font-bold text-[#7A5C1E]">
                      -₪{(booking.loyaltyRedeemedCents / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">{t.status}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    confirmed || booking.status === 'reviewed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : booking.status === 'completed'
                      ? 'bg-blue-100 text-blue-700'
                      : booking.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : booking.status === 'declined'
                      ? 'bg-red-100 text-red-700'
                      : booking.status === 'cancelled'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {confirmed ? t.confirmed : booking.status}
                  </span>
                </div>
              </div>
            </div>
          </GlassmorphismCard>

          {/* ── 72-hour escrow notice ── */}
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

          {/* ── Review + confirm form (owner, status=completed, not yet reviewed) ── */}
          {canConfirm && (
            <GlassmorphismCard className="mb-6">
              <div className="p-6">
                <h3 className="font-bold mb-4">{t.confirmAndNotify}</h3>

                <div className="space-y-4 mb-6">
                  {/* Star rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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

                  {/* Review text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.review}</label>
                    <Textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder={isRTL ? 'שירות מצוין! (אופציונלי)' : 'Great service! (optional)'}
                      className="resize-none h-20 text-sm"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" /> {t.phoneLabel}
                    </label>
                    <PhoneInput value={phone} onChange={val => setPhone(val || '')} defaultCountry="IL" />
                  </div>

                  {/* Email */}
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
                  className="w-full py-3 rounded-xl font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {confirmMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.confirming}</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" /> {t.confirmAndNotify}</>
                  }
                </Button>
              </div>
            </GlassmorphismCard>
          )}

          {/* ── Bottom nav strip (always visible once confirmed) ── */}
          {confirmed && (
            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/my-bookings')}
                className="flex-1 rounded-xl font-semibold border-gray-200"
              >
                {t.viewAllBookings}
              </Button>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
