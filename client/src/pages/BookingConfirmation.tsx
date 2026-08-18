import { useState, useEffect, useRef } from 'react';
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
    thankYou:         'תודה שבחרת ב-PetWash™! נשמח לראותך שוב 😊',
    paymentSuccessTitle: 'התשלום התקבל · ההזמנה מאושרת',
    paymentSuccessSub:   'הכספים מוחזקים במסלול מאובטח עד לסיום השירות.',
    paymentFailedTitle:  'התשלום לא עבר',
    paymentFailedSub:    'לא בוצע חיוב. באפשרותך לנסות שוב או לפנות אלינו לעזרה.',
    paymentBannerDismiss: 'סגור',
    phoneLabel:       'מספר טלפון',
    emailLabel:       'כתובת אימייל',
    phonePlaceholder: '+972...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'אשר ושלח התראות',
    confirming:       'מאשר...',
    rating:           'דרג את השירות',
    review:           'ביקורת (אופציונלי)',
    endOfStayTitle:   'ההזמנה שלך הסתיימה — נכון?',
    endOfStayLead:    'הספק דיווח שהשירות הושלם. אשרו לסיום ההזמנה — לאחר האישור התשלום ישוחרר לספק.',
    endOfStayNext:    'מה קורה עכשיו?',
    endOfStayStep1:   'אשרו את סיום השירות למטה.',
    endOfStayStep2:   'תוזמנו לתת דירוג כוכבים וביקורת קצרה — זה עוזר להורי חיות אחרים לבחור.',
    awaitingReport:   'ממתין לאישור סיום',
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
    callProvider:     'שיחה',
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
    paymentStartFailed: 'לא הצלחנו להתחיל את התשלום. נסו שוב.',
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
    thankYou:         'Thank you for choosing PetWash™! We hope to see you again 😊',
    paymentSuccessTitle: 'Payment received · booking confirmed',
    paymentSuccessSub:   'Funds are held in secure escrow until the service is complete.',
    paymentFailedTitle:  'Payment could not be processed',
    paymentFailedSub:    'Nothing was charged. You can try again or contact support.',
    paymentBannerDismiss: 'Dismiss',
    phoneLabel:       'Phone Number',
    emailLabel:       'Email Address',
    phonePlaceholder: '+972...',
    emailPlaceholder: 'you@email.com',
    confirmAndNotify: 'Confirm & Send Notifications',
    confirming:       'Confirming...',
    rating:           'Rate the service',
    review:           'Review (optional)',
    endOfStayTitle:   'Your booking has been completed — right?',
    endOfStayLead:    'Your provider marked the service as done. Confirm to finalise the booking — payment will be released to the provider after your confirmation.',
    endOfStayNext:    'What happens next?',
    endOfStayStep1:   'Confirm the end of service below.',
    endOfStayStep2:   'You\'ll be asked for a star rating and a short review — it helps other pet parents choose.',
    awaitingReport:   'Awaiting your confirmation',
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
    callProvider:     'Call',
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
    paymentStartFailed: 'Could not start payment. Please try again.',
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
          <MessageCircle className="w-5 h-5 text-[#D4AF37]" />
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
      style={{ background: 'linear-gradient(135deg, #fdf8ee 0%, #fef9f0 100%)', border: '1.5px solid #D9B84C33' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#D9B84C1A' }}>
          <RefreshCw className="w-5 h-5" style={{ color: '#0a0a0a' }} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">{providerLabel}</p>
          <p className="text-xs text-gray-500">{t.rebookSub}</p>
        </div>
      </div>
      <Button onClick={handleRebook} className="flex-shrink-0 font-semibold text-sm px-5 py-2 rounded-xl" style={{ background: '#D9B84C', color: '#fff', border: 'none' }}>
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
      <Card className={isDeclined ? 'border-red-200 bg-red-50' : 'border-[#D4AF37] bg-[#D4AF37]'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isDeclined ? <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-[#D4AF37] mt-0.5 flex-shrink-0" />}
            <div className="space-y-1 min-w-0">
              <p className={`font-bold text-sm ${isDeclined ? 'text-red-800' : 'text-[#B8932F]'}`}>{isDeclined ? t.declinedTitle : t.cancelledTitle}</p>
              {reason && <p className={`text-xs ${isDeclined ? 'text-red-600' : 'text-[#B8932F]'}`}>{t.declinedReason}: {reason}</p>}
              {isCancelled && booking.cancelledBy && <p className="text-xs text-[#B8932F]">{t.cancelledBy}: {cancelledByLabel}</p>}
              {hasRefund && <p className={`text-xs font-semibold ${isDeclined ? 'text-red-700' : 'text-[#B8932F]'}`}>{t.refund}: ₪{((booking.refundCents ?? 0) / 100).toFixed(2)}</p>}
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

  // Payment-return banner state (2026-08-18): SUMIT redirects the customer
  // back with ?payment=success or ?payment=failed. Before this the params
  // were silently ignored — the customer got no feedback about whether the
  // charge actually went through, and had to infer from the pill status.
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'failed' | null>(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search).get('payment');
    return p === 'success' || p === 'failed' ? p : null;
  });

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

  /* Idempotency keys per money-adjacent action (2026-08-16 audit CRIT).
   * Server (booking-requests.ts:107, 227) trusts a caller-supplied
   * Idempotency-Key. Without one, a slow network + double-tap could create
   * two payment intents or fire the confirm→payout branch twice. We hold a
   * fresh UUID per user-initiated action in a ref; RETRIES of the same
   * action (network drop, transient 5xx) reuse it so the server dedupes;
   * a SUCCESSFUL round-trip clears it so the next user-initiated action
   * gets a new key. */
  const confirmKeyRef = useRef<string | null>(null);
  const payKeyRef = useRef<string | null>(null);
  const cancelKeyRef = useRef<string | null>(null);
  const meetGreetKeyRef = useRef<string | null>(null);

  /* confirm / review mutation */
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!confirmKeyRef.current) confirmKeyRef.current = crypto.randomUUID();
      // Clamp rating to the server's zod boundary (1..5 integer or absent).
      const safeRating =
        typeof rating === 'number' && rating >= 1 && rating <= 5
          ? Math.floor(rating)
          : undefined;
      const trimmedReview = (reviewText || '').trim().slice(0, 2000);
      const res = await apiRequest(`/api/booking-requests/${requestId}/confirm`, {
        method: 'POST',
        body: {
          rating: safeRating,
          review: trimmedReview || undefined,
          ownerPhone: phone || undefined,
          ownerEmail: email || undefined,
        },
        headers: { 'Idempotency-Key': confirmKeyRef.current },
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      confirmKeyRef.current = null;
      setConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', requestId] });
      toast({
        title: '✅ ' + t.confirmed,
        description: [data.smsSent ? t.smsSent : null, data.emailSent ? t.emailSent : null, t.payoutNote].filter(Boolean).join('. '),
      });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to confirm booking', variant: 'destructive' }),
  });

  /* pay mutation */
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payKeyRef.current) payKeyRef.current = crypto.randomUUID();
      const res = await apiRequest(`/api/booking-requests/${requestId}/pay`, {
        method: 'POST',
        body: { paymentMethod: 'card' },
        headers: { 'Idempotency-Key': payKeyRef.current },
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      payKeyRef.current = null;
      // Server returns the hosted Nayax payment page — money is verified by
      // the payment webhook, which is the only writer of 'confirmed'.
      if (data?.paymentUrl) { window.location.href = data.paymentUrl; return; }
      toast({ title: t.paymentStartFailed ?? 'Could not start payment', variant: 'destructive' });
    },
    onError: (err: any) => {
      // Surface the server's honest reason (e.g. online card rail not live yet)
      // instead of a generic failure — the booking is saved, nothing was charged.
      // apiRequest throws ApiError with the parsed JSON on `.body`.
      // Key preserved in the ref so a retry of the SAME payment attempt reuses it.
      const msg = err?.body?.error || (t.paymentStartFailed ?? 'Could not start payment');
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelKeyRef.current) cancelKeyRef.current = crypto.randomUUID();
      const res = await apiRequest(`/api/booking-requests/${requestId}/cancel`, {
        method: 'POST',
        body: { cancelledBy: 'customer' },
        headers: { 'Idempotency-Key': cancelKeyRef.current },
      });
      return res.json();
    },
    onSuccess: () => {
      cancelKeyRef.current = null;
      setShowCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', requestId] });
      toast({ title: t.cancelSuccess });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to cancel booking', variant: 'destructive' }),
  });

  /* Meet & Greet request (customer asks for a pre-payment intro; provider confirms a time) */
  const [mgType, setMgType] = useState<'video' | 'phone' | 'public'>('video');
  const meetGreetMutation = useMutation({
    mutationFn: async () => {
      if (!meetGreetKeyRef.current) meetGreetKeyRef.current = crypto.randomUUID();
      const res = await apiRequest(`/api/booking-requests/${requestId}/meet-greet`, {
        method: 'POST',
        body: { action: 'request', type: mgType },
        headers: { 'Idempotency-Key': meetGreetKeyRef.current },
      });
      return res.json();
    },
    onSuccess: () => {
      meetGreetKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', requestId] });
      toast({
        title: isRTL ? 'בקשת פגישת היכרות נשלחה' : 'Meet & Greet requested',
        description: isRTL ? 'הספק יאשר זמן בקרוב.' : 'The provider will confirm a time soon.',
      });
    },
    onError: (e: any) => toast({ title: isRTL ? 'שגיאה' : 'Error', description: e?.message || 'Failed', variant: 'destructive' }),
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

  /**
   * Call the provider — fetches the server-side /provider-contact endpoint
   * (already exists at server/routes/booking-requests.ts:1269, gated by
   * ownership + status ∈ CONTACTABLE + 401). Opens tel: with the resolved
   * number. Server was live but had zero client callers before this.
   * Toast on failure — never throws in the render tree.
   */
  const handleCallProvider = async () => {
    if (!booking?.requestId) return;
    try {
      const res = await apiRequest('GET', `/api/booking-requests/${booking.requestId}/provider-contact`);
      const data = await res.json() as { phone?: string | null; providerName?: string | null };
      const raw = (data?.phone ?? '').replace(/[\s-]/g, '');
      if (!raw) {
        toast({
          title: isRTL ? 'טלפון לא זמין' : 'Phone unavailable',
          description: isRTL ? 'הספק לא הגדיר מספר טלפון.' : 'The provider has not set a phone number.',
        });
        return;
      }
      // Open the OS tel: handler. On desktop this triggers the default
      // system dialer (or the browser's chosen handler); on mobile it opens
      // the phone app. Fallback: copy to clipboard so the customer can dial.
      const opened = window.open(`tel:${raw}`, '_self');
      if (!opened) {
        try {
          await navigator.clipboard?.writeText(raw);
          toast({
            title: isRTL ? 'המספר הועתק' : 'Number copied',
            description: raw,
          });
        } catch { /* clipboard best-effort */ }
      }
    } catch (err: any) {
      // Server returns 409 with code NOT_CONTACTABLE outside the allowed
      // window, 403 for non-owner, 404 for no provider yet. Show the
      // server's honest message when available (apiRequest ApiError shape).
      const msg = err?.body?.error || (isRTL ? 'לא ניתן ליצור קשר כרגע' : 'Cannot reach the provider right now');
      toast({ title: msg, variant: 'destructive' });
    }
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
  // ── P0 correctness (2026-08-18): the server contract is
  //     POST /:requestId/confirm requires status === 'provider_marked_complete'
  //     (server/routes/booking-requests.ts:2817). Gating this on 'completed'
  //     meant the "Confirm end of stay" form NEVER rendered for the customer —
  //     the button was dead, the review capture was dead, and every booking
  //     had to wait 24h for the auto-approve cron to fire. Rover / MadPaws
  //     both show this exact "please confirm end of stay, then rate" step.
  const canConfirm     = isOwner && booking.status === 'provider_marked_complete' && !confirmed;
  const showChatNow    = isOwner && booking.status === 'confirmed' && !!booking.requestId;
  // Provider said yes → the customer must PAY to confirm. Until 2026-07-30 no
  // client surface ever called /pay, so 'accepted' bookings dead-ended.
  const canPayNow      = isOwner && ['accepted', 'meet_greet_completed'].includes(booking.status) && !!booking.requestId;
  const showRebook     = isOwner && (confirmed || booking.status === 'reviewed') && booking.providerId;
  const showAlertPanel = isOwner && ['declined', 'cancelled'].includes(booking.status);
  const canModify      = isOwner && ['pending', 'confirmed'].includes(booking.status);
  const canCancel      = isOwner && ['pending', 'confirmed'].includes(booking.status) && !showCancelConfirm;
  const isEnquirySent  = isOwner && (booking.status === 'pending' || booking.status === 'meet_greet_requested');
  const meetGreetRequested = booking.status === 'meet_greet_requested';
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

          {/* ── Payment-return banner (2026-08-18) ──
              SUMIT redirects back with ?payment=success|failed. Before this
              the params were silently ignored — the customer got no feedback
              about whether the charge went through. */}
          {paymentBanner === 'success' && (
            <div
              data-testid="payment-banner-success"
              className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-900 text-sm leading-snug">
                  {t.paymentSuccessTitle}
                </p>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  {t.paymentSuccessSub}
                </p>
              </div>
              <button
                onClick={() => setPaymentBanner(null)}
                aria-label={t.paymentBannerDismiss}
                className="text-emerald-700 hover:text-emerald-900 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {paymentBanner === 'failed' && (
            <div
              data-testid="payment-banner-failed"
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 text-sm leading-snug">
                  {t.paymentFailedTitle}
                </p>
                <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                  {t.paymentFailedSub}
                </p>
              </div>
              <button
                onClick={() => setPaymentBanner(null)}
                aria-label={t.paymentBannerDismiss}
                className="text-red-700 hover:text-red-900 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              BOOKING ENQUIRY SENT — pending request, pre-acceptance.
              Original PetWash wording, white + gold. "You haven't been charged."
          ══════════════════════════════════════════════════════════ */}
          {isEnquirySent && (
            <div className="mb-4">
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="font-semibold text-emerald-800 text-sm">
                  {isRTL ? 'בקשת ההזמנה נשלחה' : 'Booking enquiry sent'}
                </p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {isRTL
                  ? `שיתפנו את הבקשה עם ${booking.providerName || 'הספק'} לבדיקה. נעדכן אותך ברגע שתתקבל תשובה. עדיין לא חויבת.`
                  : `We've shared your request with ${booking.providerName || 'the provider'} for review. We'll notify you as soon as they respond. You haven't been charged.`}
              </p>
              <div className="rounded-2xl border border-gray-100 p-4 mb-3">
                <h2 className="font-bold text-gray-900 text-sm mb-3">
                  {isRTL ? 'מה קורה עכשיו?' : 'What happens next?'}
                </h2>
                <ol className="space-y-2 text-sm text-gray-700">
                  {[
                    isRTL ? 'השלמת פרופיל חיית המחמד' : 'Complete your pet profile',
                    isRTL ? 'תיאום פגישת היכרות (Meet & Greet)' : 'Arrange a Meet & Greet',
                    isRTL ? 'הספק בודק ומגיב' : 'The provider reviews & responds',
                    isRTL ? 'אישור ותשלום מאובטח — תמיד דרך PetWash' : 'Confirm & pay securely — always inside PetWash',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style={{ background: '#D4AF37' }}>{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => navigate('/pets')} className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <PawPrint className="w-5 h-5" style={{ color: '#D4AF37' }} />
                  {isRTL ? 'פרופיל חיה' : 'Pet profile'}
                </button>
                <button onClick={() => booking.requestId && navigate(`/booking-chat/${booking.requestId}`)} className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <MessageCircle className="w-5 h-5" style={{ color: '#D4AF37' }} />
                  {isRTL ? 'הודעה לספק' : 'Message provider'}
                </button>
                <button onClick={() => navigate('/search')} className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Search className="w-5 h-5" style={{ color: '#D4AF37' }} />
                  {isRTL ? 'ספקים נוספים' : 'More sitters'}
                </button>
              </div>

              {/* Meet & Greet request — optional pre-payment intro (Sitter/Walk) */}
              <div className="mt-3 rounded-2xl border border-gray-100 p-4">
                {meetGreetRequested ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    {isRTL ? 'פגישת היכרות התבקשה — הספק יאשר זמן.' : 'Meet & Greet requested — the provider will confirm a time.'}
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {isRTL ? 'פגישת היכרות (מומלץ)' : 'Meet & Greet (recommended)'}
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      {isRTL
                        ? 'מפגש קצר לפני התשלום כדי לוודא התאמה. בחר/י סוג:'
                        : "A short intro before you pay, to make sure it's a good fit. Choose a type:"}
                    </p>
                    <div className="flex gap-2 mb-3">
                      {([['video', isRTL ? 'וידאו' : 'Video'], ['phone', isRTL ? 'טלפון' : 'Phone'], ['public', isRTL ? 'מקום ציבורי' : 'Public place']] as const).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setMgType(val)}
                          className="flex-1 rounded-xl border py-2 text-xs font-medium"
                          style={{ borderColor: mgType === val ? '#D4AF37' : 'rgba(0,0,0,0.12)', background: mgType === val ? 'rgba(212,175,55,0.08)' : 'white', color: '#000' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={() => meetGreetMutation.mutate()}
                      disabled={meetGreetMutation.isPending}
                      className="w-full font-semibold text-black hover:opacity-90"
                      style={{ background: '#D4AF37' }}
                    >
                      {meetGreetMutation.isPending ? (isRTL ? 'שולח…' : 'Sending…') : (isRTL ? 'בקשת פגישת היכרות' : 'Request Meet & Greet')}
                    </Button>
                  </>
                )}
              </div>

              <p className="mt-3 text-center text-xs text-gray-400">
                {isRTL
                  ? 'פנייה למספר ספקים מגדילה את הסיכוי למצוא התאמה מושלמת.'
                  : 'Contacting a few providers improves your chance of the perfect match.'}
              </p>
            </div>
          )}

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
              {/* Call provider — hits GET /provider-contact for the resolved
                  phone, opens tel:. Server enforces owner + contactable-status
                  gate (409 outside window); disabled here on statuses the
                  server would refuse so we don't waste a round-trip. */}
              <QuickAction
                icon={<Phone className="w-4 h-4" />}
                label={t.callProvider}
                onClick={handleCallProvider}
                disabled={
                  !booking.requestId ||
                  !booking.providerId ||
                  !['accepted', 'confirmed', 'in_progress',
                    'meet_greet_completed', 'provider_marked_complete',
                    'completed'].includes(booking.status)
                }
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

          {/* ── Pay-to-confirm panel: provider accepted, payment completes the booking ── */}
          {canPayNow && (
            <div className="mb-4 rounded-3xl overflow-hidden" style={{ border: '1px solid #D4AF37' }}>
              <div className="bg-gradient-to-r from-[#0a0a0a] to-[#1a1a1a] p-6 text-center">
                <p className="text-[#D4AF37] text-xs font-bold tracking-widest uppercase mb-2">
                  {isRTL ? 'הספק אישר את הבקשה' : 'Provider accepted your request'}
                </p>
                <p className="text-white text-sm mb-4">
                  {isRTL
                    ? `להשלמת ההזמנה נותר לשלם ₪${((booking.totalCents ?? 0) / 100).toFixed(2)} — התשלום מאובטח ומוחזק בנאמנות עד לביצוע השירות.`
                    : `Complete your booking by paying ₪${((booking.totalCents ?? 0) / 100).toFixed(2)} — held securely in escrow until the service is done.`}
                </p>
                <button
                  onClick={() => payMutation.mutate()}
                  disabled={payMutation.isPending}
                  className="w-full py-3 rounded-xl font-bold text-black"
                  style={{ background: '#D4AF37' }}
                  data-testid="booking-pay-now"
                >
                  {payMutation.isPending
                    ? (isRTL ? 'מעביר לתשלום…' : 'Opening payment…')
                    : (isRTL ? 'לתשלום ואישור סופי' : 'Pay & confirm booking')}
                </button>
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
                    confirmed || booking.status === 'reviewed'          ? 'bg-emerald-100 text-emerald-700'
                    : booking.status === 'completed'                    ? 'bg-[#D4AF37] text-black'
                    : booking.status === 'provider_marked_complete'     ? 'bg-amber-100 text-amber-800'
                    : booking.status === 'confirmed'                    ? 'bg-green-100 text-green-700'
                    : booking.status === 'declined'                     ? 'bg-red-100 text-red-700'
                    : booking.status === 'cancelled'                    ? 'bg-[#D4AF37] text-black'
                    : 'bg-white text-gray-700'
                  }`}>
                    {confirmed
                      ? t.confirmed
                      : booking.status === 'provider_marked_complete'
                        ? t.awaitingReport
                        : booking.status}
                  </span>
                </div>
              </div>
            </div>
          </GlassmorphismCard>

          {/* ── 72-hour escrow notice ── */}
          {confirmed && (
            <Card className="mb-4 border-[#D4AF37] bg-[#D4AF37]">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#B8932F] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[#B8932F]">{t.escrow}</p>
                  <p className="text-[#B8932F] text-sm">{t.payoutNote}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── End-of-service banner — Rover / MadPaws parity (2026-08-18) ── */}
          {canConfirm && (
            <div
              data-testid="end-of-stay-banner"
              className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-emerald-900 text-base leading-snug">
                    {t.endOfStayTitle}
                  </h3>
                  <p className="text-sm text-emerald-800 leading-relaxed mt-1">
                    {t.endOfStayLead}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-emerald-100 pt-3">
                <p className="text-xs font-semibold text-emerald-900 mb-2">
                  {t.endOfStayNext}
                </p>
                <ol className="space-y-1.5 text-xs text-emerald-800">
                  {[t.endOfStayStep1, t.endOfStayStep2].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white bg-emerald-600">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
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
