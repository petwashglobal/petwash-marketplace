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
  RefreshCw, Search, XCircle, AlertTriangle, MessageCircle,
  CalendarPlus, Navigation, Pencil, X, PawPrint, MessageSquare,
  Dog, Users, ChevronRight,
} from 'lucide-react';
import { BookingFinancialSummary } from '@/components/wallet/BookingFinancialSummary';

/* ── Service route map ────────────────────────────────────────────────── */
const SERVICE_TO_ROUTE: Record<string, string> = {
  k9000_wash:  '/k9000',
  pet_sitting: '/sitter-suite',
  dog_walking: '/walk-my-pet',
  grooming:    '/groomers',
  pet_taxi:    '/pettrek',
  daycare:     '/sitter-suite',
  training:    '/marketplace',
};

/* ── Service display names ────────────────────────────────────────────── */
const SERVICE_NAMES_HE: Record<string, string> = {
  k9000_wash:  'שטיפת K9000',
  pet_sitting: 'שמרטפות',
  dog_walking: 'טיול כלבים',
  grooming:    'טיפוח',
  pet_taxi:    'מונית לחיות',
  daycare:     'מעון יומי',
  training:    'אילוף',
};
const SERVICE_NAMES_EN: Record<string, string> = {
  k9000_wash:  'K9000 Wash',
  pet_sitting: 'Pet Sitting',
  dog_walking: 'Dog Walking',
  grooming:    'Grooming',
  pet_taxi:    'Pet Taxi',
  daycare:     'Daycare',
  training:    'Training',
};

/* ── Important info per service type (Hebrew) ─────────────────────────── */
const IMPORTANT_INFO_HE: Record<string, string[]> = {
  pet_sitting: [
    'משך השמירה מוגבלת. אנא הכן/י את החיה בזמן להחזרה.',
    'הכן/י מזון, קערות, תרופות ומיטה קרוב לכניסה.',
    'השמרטף/ית ייצור/תיצור קשר שעה לפני ההגעה.',
    'במקרה חירום ניתן לפנות ל-PetWash™ בכל שעה.',
  ],
  daycare: [
    'משך השמירה מוגבלת. אנא הכן/י את החיה בזמן להחזרה.',
    'הכן/י מזון, קערות, תרופות ומיטה קרוב לכניסה.',
    'השמרטף/ית ייצור/תיצור קשר שעה לפני ההגעה.',
    'במקרה חירום ניתן לפנות ל-PetWash™ בכל שעה.',
  ],
  dog_walking: [
    'המוליך/ה יגיע/תגיע לכתובת שנקבעה בדיוק בזמן.',
    'עדכוני מיקום GPS חיים זמינים באפליקציה בזמן הטיול.',
    'במזג אוויר קיצוני יתכן שינוי מסלול — תישלח הודעה מראש.',
    'נשיכה או אירוע חריג ידווח מיידית ויתועד לפי חוק.',
  ],
  grooming: [
    'יש להגיע עם תיק חיסונים עדכני (חובה).',
    'לאחר הטיפוח תישלח הודעה לאיסוף — אנא אסוף תוך שעה.',
    'חיות עם עור רגיש — ציין/י בהוראות הבעלים מראש.',
    'ביטול פחות מ-24 שעות לפני — חיוב של 50% מהמחיר.',
  ],
  pet_taxi: [
    'יש להיות מוכן/ה עם החיה ונשא (carrier) בכניסה בזמן.',
    'הנהג/ת ייצור/תיצור קשר 10 דקות לפני ההגעה.',
    'חיה הנוטה לחרדה — מומלץ לכסות את הכלוב בנסיעה.',
    'ביטול פחות מ-2 שעות לפני — חיוב מלא.',
  ],
  k9000_wash: [
    'רכבך יישטף בטכנולוגיית K9000 — ידידותית לחיות מחמד.',
    'אנא ודא/י שהרכב נגיש ושמירה ניתנת.',
    'הנסיעה כוללת שטיפה מלאה + ייבוש ± 45 דקות.',
    'הובלה מבית הלקוח ובחזרה כלולה בחבילה.',
  ],
  training: [
    'נא להגיע עם כלב רעב קלות — מסייע בריכוז.',
    'חיזוקים חיוביים בלבד — ללא ציוד ענישה.',
    'מחויבות לסדרה מלאה חשובה לתוצאות.',
    'תאמן/י בין המפגשים על הנלמד — הורה מאמן מצליח.',
  ],
};
const IMPORTANT_INFO_EN: Record<string, string[]> = {
  pet_sitting: [
    'Sitting duration is limited. Please have your pet ready for pick-up on time.',
    'Prepare food, bowls, medication and bedding near the entrance.',
    'Your sitter will contact you one hour before arrival.',
    'For emergencies, PetWash™ support is available 24/7.',
  ],
  daycare: [
    'Daycare hours are fixed. Please collect your pet on time.',
    'Prepare food, bowls, medication and bedding near the entrance.',
    'Your caregiver will reach out an hour before arrival.',
    'For emergencies, PetWash™ support is available 24/7.',
  ],
  dog_walking: [
    'Your walker will arrive at the agreed address exactly on time.',
    'Live GPS tracking is available in the app during the walk.',
    'In extreme weather, route may be adjusted — you will be notified.',
    'Any incident will be reported immediately and documented per law.',
  ],
  grooming: [
    'Please bring an up-to-date vaccination record (mandatory).',
    'You will receive a pick-up notification — please collect within one hour.',
    'Pets with sensitive skin — note this in the owner instructions.',
    'Cancellations under 24 hours — 50% fee applies.',
  ],
  pet_taxi: [
    'Please be ready with your pet in a carrier at the entrance on time.',
    'Your driver will contact you 10 minutes before arrival.',
    'For anxious pets, covering the carrier during the trip is recommended.',
    'Cancellations under 2 hours before — full charge applies.',
  ],
  k9000_wash: [
    'Your vehicle will be washed with pet-safe K9000 technology.',
    'Please ensure vehicle access is available at the scheduled time.',
    'Full wash + dry takes approximately 45 minutes.',
    'Door-to-door pick-up and drop-off is included.',
  ],
  training: [
    'Bring your dog slightly hungry — improves focus during training.',
    'Positive reinforcement only — no punishment tools used.',
    'Full session commitment is important for best results.',
    'Practice between sessions — an engaged owner makes a great dog.',
  ],
};

/* ── i18n ─────────────────────────────────────────────────────────────── */
const labels = {
  he: {
    title:            'אישור הזמנה',
    bothConfirmed:    'ההזמנה הושלמה!',
    bookingId:        'מזהה הזמנה',
    service:          'שירות',
    dates:            'תאריכים',
    pets:             'חיות מחמד',
    subtotal:         'סכום ביניים',
    fee:              'עמלת שירות (15%)',
    total:            'סה"כ',
    status:           'סטטוס',
    confirmed:        'מאושר',
    completed:        'הושלם',
    reviewed:         'נבדק',
    payoutNote:       'התשלום לנותן השירות יועבר תוך 72 שעות',
    sendSMS:          'שלח SMS',
    sendEmail:        'שלח קבלה במייל',
    smsSent:          'SMS נשלח בהצלחה',
    emailSent:        'קבלה נשלחה במייל',
    back:             'כל ההזמנות',
    escrow:           'נתיב מאובטח 72 שעות',
    thankYou:         'תודה שבחרת ב-Pet Wash™! נשמח לראותך שוב 😊',
    phoneLabel:       'מספר טלפון',
    emailLabel:       'כתובת אימייל',
    phonePlaceholder: '+972...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'אשר ושלח התראות',
    confirming:       'מאשר...',
    rating:           'דרג את השירות',
    review:           'ביקורת (אופציונלי)',
    chatNowTitle:     'ספקך אישר! מוכן להתחיל?',
    chatNowSub:       'שוחח עם הספק, תאם פרטים, ותכן את הביקור.',
    chatNowBtn:       'שוחח עכשיו',
    rebookTitle:      'הזמן שוב',
    rebookWith:       'הזמן שוב עם',
    rebookSub:        'אותן חיות מחמד, אותו שירות — בלחיצה אחת',
    rebookBtn:        'הזמן שוב',
    viewAllBookings:  'כל ההזמנות שלי',
    declinedTitle:    'הבקשה נדחתה',
    cancelledTitle:   'ההזמנה בוטלה',
    findAnotherProvider: 'חפש ספק אחר',
    findAnotherSub:   'יש לנו ספקים נוספים שישמחו לעזור',
    declinedReason:   'סיבה',
    cancelledBy:      'בוטל על ידי',
    byProvider:       'נותן השירות',
    byCustomer:       'הלקוח',
    refund:           'החזר כספי',
    loyaltyRedeemed:  'קרדיטים מומשו',
    creditsEarned:    'קרדיטים שנצברו',
    importantInfo:    'מידע חשוב',
    greetingLine:     'ההזמנה שלך נקלטה בהצלחה.',
    dear:             'יקר/ה',
    modify:           'שינוי הזמנה',
    cancel:           'ביטול הזמנה',
    share:            'שתף',
    addCalendar:      'לוח שנה',
    messageProvider:  'הודעה',
    navigate:         'נווט',
    cancelConfirm:    'לבטל את ההזמנה?',
    cancelYes:        'כן, בטל',
    cancelNo:         'לא, חזור',
    cancelling:       'מבטל...',
    cancelSuccess:    'ההזמנה בוטלה',
    provider:         'ספק',
    petCount:         'חיות',
    date:             'תאריך',
    time:             'שעה',
  },
  en: {
    title:            'Booking Confirmation',
    bothConfirmed:    'Booking Complete!',
    bookingId:        'Booking ID',
    service:          'Service',
    dates:            'Dates',
    pets:             'Pets',
    subtotal:         'Subtotal',
    fee:              'Service Fee (15%)',
    total:            'Total',
    status:           'Status',
    confirmed:        'Confirmed',
    completed:        'Completed',
    reviewed:         'Reviewed',
    payoutNote:       'Provider payout will be transferred within 72 hours',
    sendSMS:          'Send SMS',
    sendEmail:        'Send Email Receipt',
    smsSent:          'SMS sent successfully',
    emailSent:        'Receipt sent to email',
    back:             'All Bookings',
    escrow:           '72-Hour Secure Escrow',
    thankYou:         'Thank you for choosing Pet Wash™! We hope to see you again 😊',
    phoneLabel:       'Phone Number',
    emailLabel:       'Email Address',
    phonePlaceholder: '+972...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'Confirm & Send Notifications',
    confirming:       'Confirming...',
    rating:           'Rate the service',
    review:           'Review (optional)',
    chatNowTitle:     'Your provider confirmed! Ready to start?',
    chatNowSub:       'Chat with your provider, coordinate details, and prepare for the visit.',
    chatNowBtn:       'Chat Now',
    rebookTitle:      'Book Again',
    rebookWith:       'Book again with',
    rebookSub:        'Same pets, same service — one tap',
    rebookBtn:        'Book Again',
    viewAllBookings:  'My Bookings',
    declinedTitle:    'Request Declined',
    cancelledTitle:   'Booking Cancelled',
    findAnotherProvider: 'Find Another Provider',
    findAnotherSub:   'We have other providers ready to help',
    declinedReason:   'Reason',
    cancelledBy:      'Cancelled by',
    byProvider:       'Provider',
    byCustomer:       'Customer',
    refund:           'Refund',
    loyaltyRedeemed:  'Credits Redeemed',
    creditsEarned:    'Credits Earned',
    importantInfo:    'Important Information',
    greetingLine:     'Your reservation has been booked successfully.',
    dear:             'Dear',
    modify:           'Modify Reservation',
    cancel:           'Cancel Reservation',
    share:            'Share',
    addCalendar:      'Calendar',
    messageProvider:  'Message',
    navigate:         'Navigate',
    cancelConfirm:    'Cancel this booking?',
    cancelYes:        'Yes, cancel',
    cancelNo:         'No, keep it',
    cancelling:       'Cancelling...',
    cancelSuccess:    'Booking cancelled',
    provider:         'Provider',
    petCount:         'Pets',
    date:             'Date',
    time:             'Time',
  },
};

/* ── Helper: format a date for Google Calendar ────────────────────────── */
function toGCalDate(d: Date) {
  return d.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, 15) + 'Z';
}

/* ── Detail chip ──────────────────────────────────────────────────────── */
function DetailChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-white border border-gray-100">
      <div className="text-gray-400">{icon}</div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium leading-none">{label}</p>
      <p className="text-sm font-bold text-gray-900 text-center leading-tight">{value}</p>
    </div>
  );
}

/* ── Quick action button ──────────────────────────────────────────────── */
function QuickAction({
  icon, label, onClick, disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border border-gray-200 bg-white hover:bg-white active:scale-95 transition-all disabled:opacity-40"
    >
      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-600">
        {icon}
      </div>
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
    </button>
  );
}

/* ── Chat Now panel ───────────────────────────────────────────────────── */
function ChatNowPanel({ booking, t, navigate }: { booking: any; t: typeof labels['en']; navigate: (p: string) => void }) {
  return (
    <div
      className="rounded-2xl p-5 mb-4 flex items-center justify-between gap-4"
      style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', border: '1.5px solid #3B82F622' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#3B82F61A' }}>
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

/* ── Rebook panel ─────────────────────────────────────────────────────── */
function RebookPanel({ booking, t, navigate }: { booking: any; t: typeof labels['en']; navigate: (p: string) => void }) {
  const handleRebook = () => {
    if (!booking.providerId) { navigate(SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace'); return; }
    const p = new URLSearchParams({ rebook: '1' });
    if (booking.petIds?.length)     p.set('petIds',  booking.petIds.join(','));
    if (booking.addonCodes?.length) p.set('addons',  booking.addonCodes.join(','));
    if (booking.ownerMessage)       p.set('notes',   booking.ownerMessage);
    navigate(`/booking/new/${booking.serviceType}/${booking.providerId}?${p.toString()}`);
  };
  const providerLabel = booking.providerName ? `${t.rebookWith} ${booking.providerName}` : t.rebookTitle;
  return (
    <div
      className="rounded-2xl p-5 mb-4 flex items-center justify-between gap-4"
      style={{ background: 'linear-gradient(135deg, #fdf8ee 0%, #fef9f0 100%)', border: '1.5px solid #C5A55A33' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#C5A55A1A' }}>
          <RefreshCw className="w-5 h-5" style={{ color: '#C5A55A' }} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">{providerLabel}</p>
          <p className="text-xs text-gray-500">{t.rebookSub}</p>
        </div>
      </div>
      <Button onClick={handleRebook} className="flex-shrink-0 font-semibold text-sm px-5 py-2 rounded-xl" style={{ background: '#C5A55A', color: '#fff', border: 'none' }}>
        {t.rebookBtn}
      </Button>
    </div>
  );
}

/* ── Declined / Cancelled alert ───────────────────────────────────────── */
function StatusAlertPanel({ booking, t, navigate }: { booking: any; t: typeof labels['en']; navigate: (p: string) => void }) {
  const isDeclined  = booking.status === 'declined';
  const isCancelled = booking.status === 'cancelled';
  if (!isDeclined && !isCancelled) return null;
  const cleanReason = (r: string | null | undefined) => r?.replace(/^(DECLINED:|CANCELLED:|DISPUTE:|CANCELED:)\s*/i, '') || null;
  const reason    = cleanReason(booking.cancellationReason);
  const cancelledByLabel = booking.cancelledBy === 'provider' ? t.byProvider : t.byCustomer;
  const hasRefund = (booking.refundCents ?? 0) > 0;
  const serviceRoute = SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace';
  return (
    <div className="mb-4 space-y-3">
      <Card className={isDeclined ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isDeclined ? <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />}
            <div className="space-y-1 min-w-0">
              <p className={`font-bold text-sm ${isDeclined ? 'text-red-800' : 'text-orange-800'}`}>{isDeclined ? t.declinedTitle : t.cancelledTitle}</p>
              {reason && <p className={`text-xs ${isDeclined ? 'text-red-600' : 'text-orange-600'}`}>{t.declinedReason}: {reason}</p>}
              {isCancelled && booking.cancelledBy && <p className="text-xs text-orange-600">{t.cancelledBy}: {cancelledByLabel}</p>}
              {hasRefund && <p className={`text-xs font-semibold ${isDeclined ? 'text-red-700' : 'text-orange-700'}`}>{t.refund}: ₪{((booking.refundCents ?? 0) / 100).toFixed(2)}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: '#ffffff', border: '1.5px solid rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0"><Search className="w-4 h-4 text-gray-500" /></div>
          <div>
            <p className="font-semibold text-sm text-gray-800">{t.findAnotherProvider}</p>
            <p className="text-xs text-gray-500">{t.findAnotherSub}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(serviceRoute)} className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border-gray-300">{t.findAnotherProvider}</Button>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function BookingConfirmation() {
  const { requestId }  = useParams<{ requestId: string }>();
  const [, navigate]   = useLocation();
  const { user }       = useFirebaseAuth();
  const { language }   = useLanguage();
  const { toast }      = useToast();
  const t              = labels[language === 'he' ? 'he' : 'en'];
  const isRTL          = language === 'he';
  const importantInfo  = language === 'he'
    ? IMPORTANT_INFO_HE
    : IMPORTANT_INFO_EN;

  const [phone, setPhone]                     = useState('');
  const [email, setEmail]                     = useState('');
  const [rating, setRating]                   = useState(5);
  const [reviewText, setReviewText]           = useState('');
  const [confirmed, setConfirmed]             = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

  /* confirm / review mutation */
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
        description: [data.smsSent ? t.smsSent : null, data.emailSent ? t.emailSent : null, t.payoutNote].filter(Boolean).join('. '),
      });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to confirm booking', variant: 'destructive' }),
  });

  /* cancel mutation */
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/booking-requests/${requestId}/cancel`, { cancelledBy: 'customer' });
      return res.json();
    },
    onSuccess: () => {
      setShowCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', requestId] });
      toast({ title: t.cancelSuccess });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to cancel booking', variant: 'destructive' }),
  });

  /* ── Quick-action handlers ── */
  const handleShare = async () => {
    const text = isRTL
      ? `הזמנה #${booking?.requestId} ב-PetWash™ — ${SERVICE_NAMES_HE[booking?.serviceType] ?? ''}`
      : `Booking #${booking?.requestId} at PetWash™ — ${SERVICE_NAMES_EN[booking?.serviceType] ?? ''}`;
    if (navigator.share) {
      await navigator.share({ title: 'PetWash™', text });
    } else {
      await navigator.clipboard?.writeText(text);
      toast({ title: isRTL ? 'הועתק!' : 'Copied!' });
    }
  };

  const handleAddToCalendar = () => {
    if (!booking?.startDate) return;
    const start = new Date(booking.startDate);
    const end   = booking.endDate ? new Date(booking.endDate) : new Date(start.getTime() + 3600_000);
    const title = encodeURIComponent(
      `PetWash™ — ${isRTL ? SERVICE_NAMES_HE[booking.serviceType] ?? '' : SERVICE_NAMES_EN[booking.serviceType] ?? ''}`
    );
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${toGCalDate(start)}/${toGCalDate(end)}&details=${encodeURIComponent(`Booking #${booking.requestId}`)}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleNavigate = () => {
    const addr = booking?.providerAddress || booking?.pickupAddress;
    if (!addr) { toast({ title: isRTL ? 'כתובת לא זמינה' : 'Address not available' }); return; }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank', 'noopener');
  };

  const handleMessageProvider = () => {
    if (booking?.requestId) navigate(`/booking-chat/${booking.requestId}`);
  };

  /* ── Loading / not found ── */
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
          <p className="text-gray-500">{isRTL ? 'הזמנה לא נמצאה' : 'Booking not found'}</p>
        </div>
      </Layout>
    );
  }

  /* ── Derived booleans ── */
  const firstName      = user?.displayName?.split(' ')[0] || '';
  const isOwner        = booking.ownerId === user?.uid;
  const canConfirm     = isOwner && booking.status === 'completed' && !confirmed;
  const showChatNow    = isOwner && booking.status === 'confirmed' && !!booking.requestId;
  const showRebook     = isOwner && (confirmed || booking.status === 'reviewed') && booking.providerId;
  const showAlertPanel = isOwner && ['declined', 'cancelled'].includes(booking.status);
  const canModify      = isOwner && ['pending', 'confirmed'].includes(booking.status);
  const canCancel      = isOwner && ['pending', 'confirmed'].includes(booking.status) && !showCancelConfirm;
  const infoItems      = importantInfo[booking.serviceType] ?? importantInfo['pet_sitting'];

  const startDateObj   = booking.startDate ? new Date(booking.startDate) : null;
  const dateLabel      = startDateObj
    ? startDateObj.toLocaleDateString(isRTL ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'numeric' })
    : '—';
  const timeLabel      = startDateObj
    ? startDateObj.toLocaleTimeString(isRTL ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <Layout>
      <div className="min-h-screen bg-white py-6 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-lg mx-auto">

          {/* ── Back ── */}
          <Button variant="ghost" onClick={() => navigate('/bookings')} className="mb-4 gap-2 -mx-2 text-gray-500">
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {t.back}
          </Button>

          {/* ══════════════════════════════════════════════════════════
              TABIT-STYLE HERO CARD
          ══════════════════════════════════════════════════════════ */}
          <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm mb-4">

            {/* Provider / service header */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 pt-6 pb-5 text-center relative">
              {/* PetWash paw icon */}
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
                <PawPrint className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-white font-bold text-lg leading-tight">
                {booking.providerName || (isRTL ? SERVICE_NAMES_HE[booking.serviceType] : SERVICE_NAMES_EN[booking.serviceType]) || 'PetWash™'}
              </h1>
              {booking.providerAddress && (
                <p className="text-white/60 text-xs mt-1 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />{booking.providerAddress}
                </p>
              )}
            </div>

            {/* Detail chips row */}
            <div className="flex gap-2 p-4 bg-white border-b border-gray-100">
              <DetailChip
                icon={<Calendar className="w-4 h-4" />}
                label={t.date}
                value={dateLabel}
              />
              <DetailChip
                icon={<Clock className="w-4 h-4" />}
                label={t.time}
                value={timeLabel}
              />
              <DetailChip
                icon={<PawPrint className="w-4 h-4" />}
                label={t.petCount}
                value={String(booking.petCount ?? 1)}
              />
            </div>

            {/* Personalized greeting */}
            <div className="px-6 py-5 bg-white border-b border-gray-100">
              {firstName ? (
                <p className="text-gray-800 text-[15px] leading-relaxed">
                  {isRTL ? `יקר/ה ${firstName},` : `Dear ${firstName},`}
                </p>
              ) : null}
              <p className="text-gray-800 text-[15px] leading-relaxed mt-0.5">
                {t.greetingLine}
              </p>
            </div>

            {/* Important Information */}
            <div className="px-6 py-5 bg-white border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-3">
                {t.importantInfo}
              </h2>
              <ol className="space-y-2">
                {infoItems.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-400 flex-shrink-0 w-4">{idx + 1}.</span>
                    <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                ))}
              </ol>
            </div>

            {/* Thank you + booking ID */}
            <div className="px-6 py-5 bg-white border-b border-gray-100">
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                <strong>{t.thankYou}</strong>
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400 font-mono bg-white rounded-xl px-4 py-2.5">
                <span>{t.bookingId}</span>
                <span className="font-semibold text-gray-600">{booking.requestId}</span>
              </div>
            </div>

            {/* Modify / Cancel buttons */}
            {(canModify || canCancel) && !showAlertPanel && (
              <div className="flex gap-3 px-4 py-4 bg-white border-b border-gray-100">
                {canModify && (
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-2xl border-gray-200 font-semibold text-sm gap-2"
                    onClick={() => navigate(SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace')}
                  >
                    <Pencil className="w-4 h-4" />
                    {t.modify}
                  </Button>
                )}
                {!showCancelConfirm && (
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-2xl border-gray-200 font-semibold text-sm gap-2 text-red-600 border-red-100 hover:bg-red-50"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    <X className="w-4 h-4" />
                    {t.cancel}
                  </Button>
                )}
              </div>
            )}

            {/* Cancel confirm inline */}
            {showCancelConfirm && (
              <div className="px-4 py-4 bg-red-50 border-b border-red-100">
                <p className="text-sm font-semibold text-red-800 mb-3 text-center">{t.cancelConfirm}</p>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 h-10 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t.cancelling}</> : t.cancelYes}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-2xl font-semibold text-sm border-gray-200"
                    onClick={() => setShowCancelConfirm(false)}
                  >
                    {t.cancelNo}
                  </Button>
                </div>
              </div>
            )}

            {/* 4-up quick actions: Share | Calendar | Message | Navigate */}
            <div className="grid grid-cols-4 gap-2 px-4 py-4 bg-white">
              <QuickAction
                icon={<Share2 className="w-4 h-4" />}
                label={t.share}
                onClick={handleShare}
              />
              <QuickAction
                icon={<CalendarPlus className="w-4 h-4" />}
                label={t.addCalendar}
                onClick={handleAddToCalendar}
                disabled={!booking.startDate}
              />
              <QuickAction
                icon={<MessageSquare className="w-4 h-4" />}
                label={t.messageProvider}
                onClick={handleMessageProvider}
                disabled={!booking.requestId}
              />
              <QuickAction
                icon={<Navigation className="w-4 h-4" />}
                label={t.navigate}
                onClick={handleNavigate}
                disabled={!booking.providerAddress && !booking.pickupAddress}
              />
            </div>

          </div>
          {/* ── End Tabit card ── */}

          {/* ── Post-confirmation green banner ── */}
          {confirmed && (
            <div className="mb-4 rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-center text-white">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">{t.bothConfirmed}</h2>
              </div>
            </div>
          )}

          {/* ── Chat Now panel ── */}
          {showChatNow && <ChatNowPanel booking={booking} t={t} navigate={navigate} />}

          {/* ── Rebook + next actions ── */}
          {showRebook && (
            <>
              <RebookPanel booking={booking} t={t} navigate={navigate} />
              <div className="mb-4 rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #eeeeee' }}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {isRTL ? 'מה הלאה?' : "What's Next?"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: '✂️', labelHe: 'הזמן טיפוח', labelEn: 'Book Grooming', route: '/groomers' },
                    { icon: '🐾', labelHe: 'כל השירותים', labelEn: 'Browse Services', route: '/marketplace' },
                    { icon: '💳', labelHe: 'טעינת ארנק', labelEn: 'Top Up Wallet', route: '/my-wallet' },
                  ].map(item => (
                    <button
                      key={item.route}
                      onClick={() => navigate(item.route)}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl hover:bg-white active:scale-95 transition-all"
                      style={{ border: '1px solid #f0f0f0' }}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-xs font-medium text-gray-600 text-center leading-tight">
                        {isRTL ? item.labelHe : item.labelEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Declined / Cancelled alert ── */}
          {showAlertPanel && <StatusAlertPanel booking={booking} t={t} navigate={navigate} />}

          {/* ── Financial summary ── */}
          <GlassmorphismCard className="mb-4">
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                {isRTL ? 'סיכום כספי' : 'Financial Summary'}
              </p>
              <div className="space-y-0">
                {booking.providerName && (
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">{t.provider}</span>
                    <span className="font-semibold text-sm">{booking.providerName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="text-gray-500 text-sm flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{t.dates}</span>
                  <span className="font-semibold text-sm">
                    {booking.startDate ? new Date(booking.startDate).toLocaleDateString() : 'N/A'}
                    {' – '}
                    {booking.endDate   ? new Date(booking.endDate).toLocaleDateString()   : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">{t.pets}</span>
                  <span className="font-semibold text-sm">{booking.petCount}</span>
                </div>
                <BookingFinancialSummary
                  subtotalCents={booking.subtotalCents ?? undefined}
                  serviceFeeCents={booking.serviceFeeCents ?? undefined}
                  totalCents={booking.totalCents}
                  loyaltyRedeemedCents={booking.loyaltyRedeemedCents ?? 0}
                  financeState={booking.financeState}
                  walletHoldCents={booking.walletHoldCents ?? 0}
                  walletDebitedCents={booking.walletDebitedCents ?? 0}
                  walletRefundedCents={booking.walletRefundedCents ?? 0}
                />
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-gray-500 text-sm">{t.status}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    confirmed || booking.status === 'reviewed' ? 'bg-emerald-100 text-emerald-700'
                    : booking.status === 'completed'           ? 'bg-blue-100 text-blue-700'
                    : booking.status === 'confirmed'           ? 'bg-green-100 text-green-700'
                    : booking.status === 'declined'            ? 'bg-red-100 text-red-700'
                    : booking.status === 'cancelled'           ? 'bg-orange-100 text-orange-700'
                    : 'bg-white text-gray-700'
                  }`}>
                    {confirmed ? t.confirmed : booking.status}
                  </span>
                </div>
              </div>
            </div>
          </GlassmorphismCard>

          {/* ── 72-hour escrow notice ── */}
          {confirmed && (
            <Card className="mb-4 border-blue-200 bg-blue-50">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-800">{t.escrow}</p>
                  <p className="text-blue-600 text-sm">{t.payoutNote}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Rating + confirm form ── */}
          {canConfirm && (
            <GlassmorphismCard className="mb-4">
              <div className="p-5">
                <h3 className="font-bold mb-4">{t.confirmAndNotify}</h3>
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Star className="w-4 h-4 inline mr-1" /> {t.rating}
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${star <= rating ? 'bg-yellow-400 text-white' : 'bg-white text-gray-400'}`}
                        >
                          <Star className="w-5 h-5" fill={star <= rating ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.review}</label>
                    <Textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder={isRTL ? 'שירות מצוין! (אופציונלי)' : 'Great service! (optional)'}
                      className="resize-none h-20 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" /> {t.phoneLabel}
                    </label>
                    <PhoneInput value={phone} onChange={val => setPhone(val || '')} defaultCountry="IL" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Mail className="w-4 h-4 inline mr-1" /> {t.emailLabel}
                    </label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.emailPlaceholder} />
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

          {/* ── View all bookings ── */}
          {confirmed && (
            <div className="flex gap-3 mt-2 mb-6">
              <Button variant="outline" onClick={() => navigate('/bookings')} className="flex-1 rounded-xl font-semibold border-gray-200">
                {t.viewAllBookings}
              </Button>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
