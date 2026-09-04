import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, GraduationCap, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod } from "@/lib/paymentConfig";
import { CreditWalletCard } from "@/components/wallet/CreditWalletCard";
import { PrestigePassPaymentOption } from "@/components/PrestigePassPaymentOption";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { WalletCheckoutPreview } from "@/components/wallet/WalletCheckoutPreview";
import { BookingFinancialSummary } from "@/components/wallet/BookingFinancialSummary";
import { useJourneyCheckpoint } from "@/hooks/useJourneyCheckpoint";
import { emitCtaEvent } from "@/lib/ctaActions";

type BookingStep = "details" | "summary" | "confirmation";

export default function AcademyBookingFlow() {
  const { trainerId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(60); // minutes
  const [sessionType, setSessionType] = useState<string>("private");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingFinanceState, setBookingFinanceState] = useState<string>('none');
  const [bookingWalletHoldCents, setBookingWalletHoldCents] = useState<number>(0);
  const [appliedCredits, setAppliedCredits] = useState<{ redemptionSessionId: string; totalCreditsAppliedCents: number; cashDueCents: number } | null>(null);

  // Fetch trainer data from real API
  const { data: trainerData, isLoading: trainerLoading, error: trainerError } = useQuery({
    queryKey: [`/api/academy/trainers/${trainerId}`],
    enabled: !!trainerId,
  });

  const trainer = trainerData?.trainer;

  /**
   * Journey Brain Phase 2 · academy_book wire.
   *
   * Only RESUMABLE, non-payment intent is persisted (trainer id,
   * selected date, session duration + type, notes). Payment/wallet
   * fields (bookingWalletHoldCents, appliedCredits, financeState)
   * are DELIBERATELY excluded — the resuming wizard is the sole
   * authority on payment on arrival, per the CEO's Phase 2 rule.
   *
   * Enabled only when the user is signed in — a guest-view of the
   * academy page keeps form state entirely local (no server write).
   *
   * The debounced save skips no-op cases (isSubmitting, empty
   * form). The clear runs on successful booking submit BEFORE any
   * navigation, since the real /api/academy/bookings POST re-runs
   * every price / auth / wallet check server-side.
   */
  const checkpoint = useJourneyCheckpoint<Record<string, unknown>>('academy_book', {
    enabled: !!user,
  });

  // Hydrate untouched fields from the saved checkpoint. Never
  // overwrite what the user has already typed in this session.
  useMemo(() => {
    if (checkpoint.hydrating || !checkpoint.initial) return;
    const draft = checkpoint.initial as any;
    if (!selectedDate && draft?.serviceDate) {
      const d = new Date(draft.serviceDate);
      if (!isNaN(d.getTime())) setSelectedDate(d);
    }
    if (draft?.sessionDuration && sessionDuration === 60 && draft.sessionDuration !== 60) {
      setSessionDuration(Number(draft.sessionDuration));
    }
    if (draft?.sessionType && sessionType === 'private' && draft.sessionType !== 'private') {
      setSessionType(String(draft.sessionType));
    }
    if (draft?.specialNotes && !notes) setNotes(String(draft.specialNotes));
  }, [checkpoint.hydrating, checkpoint.initial]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist resumable state on every meaningful change. Payload is
  // deliberately narrow — no payment truth, no ledger truth.
  useMemo(() => {
    if (step === 'confirmation') return; // don't overwrite after success
    if (isSubmitting) return;             // don't race the POST
    if (!trainerId || !selectedDate) return; // no meaningful state yet
    checkpoint.save({
      trainerId,
      serviceDate: selectedDate.toISOString(),
      sessionDuration,
      sessionType,
      specialNotes: notes,
      step,
    });
  }, [step, isSubmitting, trainerId, selectedDate, sessionDuration, sessionType, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionTypes = [
    { id: "private", name: "שיעור פרטי", description: "אימון אחד על אחד" },
    { id: "group", name: "קבוצה קטנה", description: "2-4 כלבים" },
    { id: "behavior", name: "ייעוץ התנהגותי", description: "הערכה התנהגותית מתקדמת" },
  ];

  // Calculate pricing using VAT calculator
  const baseAmount = useMemo(() => {
    if (!trainer?.hourlyRate) return 0;
    const hours = sessionDuration / 60;
    return parseFloat(trainer.hourlyRate) * hours;
  }, [trainer, sessionDuration]);

  const pricing = useMemo(() => {
    return vatCalculator.calculateVAT(baseAmount);
  }, [baseAmount]);

  const canContinueDetails = useMemo(() => {
    return (
      !!trainer &&
      !!selectedDate &&
      sessionDuration > 0 &&
      !!sessionType
    );
  }, [trainer, selectedDate, sessionDuration, sessionType]);

  async function handleNextFromDetails() {
    if (!canContinueDetails) {
      toast({
        title: "נדרשים פרטים נוספים",
        description: "יש למלא את כל השדות לפני המשך",
        variant: "destructive",
      });
      return;
    }
    setStep("summary");
  }

  async function handleConfirmBooking() {
    if (!trainer || !selectedDate) return;

    try {
      setIsSubmitting(true);

      const payload = {
        platform: "academy",
        // Backend (POST /api/academy/bookings) reads validatedData.trainerId — must send trainerId.
        trainerId: Number(trainerId),
        providerId: trainerId,
        serviceDate: selectedDate.toISOString(),
        sessionDuration,
        sessionType,
        specialNotes: notes,
        items: [
          {
            itemType: 'service',
            name: 'Dog Training Session',
            nameHe: 'שיעור אילוף כלבים',
            unitPrice: pricing.totalCharged
          }
        ],
        pricing: {
          currency: "ILS",
          baseAmount: pricing.baseAmount,
          commission: pricing.commission,
          vatAmount: pricing.vatOnCommission,
          totalAmount: pricing.totalCharged
        },
        platformData: {
          trainerName: trainer.fullName,
          sessionTypeDetails: sessionTypes.find(t => t.id === sessionType),
          paymentMethod: getActivePaymentMethod(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        ...(appliedCredits ? {
          redemptionSessionId: appliedCredits.redemptionSessionId,
          // Server reads walletCreditAppliedCents for the wallet hold (academy.ts);
          // we only sent creditsAppliedCents, so the redeemed credit was ignored and
          // the displayed discount was never applied. Send the key it reads. (2026-07-27)
          walletCreditAppliedCents: appliedCredits.totalCreditsAppliedCents,
          creditsAppliedCents: appliedCredits.totalCreditsAppliedCents,
          cashDueCents: appliedCredits.cashDueCents,
        } : {})
      };

      const response = await apiRequest('POST', '/api/academy/bookings', payload);
      const booking = await response.json();

      const bookingRecord = booking.booking || booking;
      // Show the human ref (TRN-YYYY-xxxx), not the numeric PK. (2026-07-27)
      setBookingId(bookingRecord?.bookingId || bookingRecord?.bookingNumber || bookingRecord?.id || 'pending');
      setBookingFinanceState(bookingRecord?.financeState || 'none');
      setBookingWalletHoldCents(bookingRecord?.walletHoldCents || 0);
      // Journey Brain Phase 2 · clear the resumable draft — the real
      // booking is now server-owned. Fire-and-forget; a failure to
      // clear never blocks the confirmation UX (the row TTL is 72h
      // and the pruner cron sweeps it either way).
      checkpoint.clear();
      setStep("confirmation");

      toast({
        title: "בקשת הזמנה נשלחה",
        description: "ממתין לאישור המאמן/ת. חיוב יתבצע רק לאחר שהמאמן/ת יאשר/תאשר.",
      });
    } catch (error: any) {
      const errorMsg = error.message || "";
      if (errorMsg.includes("Authentication") || errorMsg.includes("401") || errorMsg.includes("sign in")) {
        toast({
          title: "יש להתחבר תחילה",
          description: "כדי לבצע הזמנה, יש להתחבר לחשבון שלך.",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/signin"), 2000);
      } else if (errorMsg.includes("loyalty") || errorMsg.includes("403")) {
        toast({
          title: "נדרשת חברות במועדון",
          description: "שירות זה זמין לחברי מועדון ⁦PetWash™⁩. הצטרפו עכשיו!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "שגיאה ביצירת הזמנה",
          description: errorMsg || "אירעה שגיאה. אין חיוב. נסה/י שוב.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Loading state
  if (trainerLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-slate-600 font-light">טוען את נתוני המאמן/ת...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (trainerError || !trainer) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-light mb-4 text-slate-900">לא נמצא/ה מאמן/ת</h2>
          <p className="text-slate-600 font-light mb-6">
            המאמן/ת לא זמינ/ה כרגע או שהקישור שגוי.
          </p>
          <Button onClick={() => setLocation("/academy")} className="bg-[#D4AF37] text-white font-light">
            חזרה לרשימת מאמנים
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Header */}
      <div className="luxury-glass-panel border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <button
            className="luxury-btn-ghost mb-4"
            onClick={() => setLocation("/academy")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה למאמנים
          </button>

          <h1 className="luxury-heading-md luxury-text-gradient" data-testid="page-title">
            הזמנת {trainer.fullName}
          </h1>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-8 luxury-fade-in">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'details' ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8932F] text-white luxury-shadow-lg' : step === 'summary' || step === 'confirmation' ? 'luxury-gradient-border bg-white text-[#D4AF37]' : 'bg-white text-slate-500'}`}>
            1
          </div>
          <div className={`h-1 w-16 rounded-full ${step === 'summary' || step === 'confirmation' ? 'luxury-bg-primary' : 'bg-white'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'summary' ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8932F] text-white luxury-shadow-lg' : step === 'confirmation' ? 'luxury-gradient-border bg-white text-[#D4AF37]' : 'bg-white text-slate-500'}`}>
            2
          </div>
          <div className={`h-1 w-16 rounded-full ${step === 'confirmation' ? 'luxury-bg-primary' : 'bg-white'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'confirmation' ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8932F] text-white luxury-shadow-lg' : 'bg-white text-slate-500'}`}>
            3
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Trainer Info Card */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="flex items-center gap-3">
                {trainer.profilePhotoUrl ? (
                  <img
                    src={trainer.profilePhotoUrl}
                    alt={trainer.fullName}
                    className="h-16 w-16 rounded-full object-cover border-2 border-[#D4AF37]/30"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-[#D4AF37]/15 flex items-center justify-center text-xl font-semibold text-black">
                    {trainer.fullName.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="luxury-heading-sm">{trainer.fullName}</div>
                  <div className="text-sm text-slate-600">
                    {trainer.city} · ⭐ {parseFloat(trainer.averageRating).toFixed(1)} ({trainer.totalSessions} שיעורים)
                  </div>
                  {trainer.isCertified && (
                    <div className="text-xs text-[#D4AF37] mt-1">✓ מאומן/ת מוסמך/ת</div>
                  )}
                </div>
              </div>
            </section>

            {/* Session Type */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[#D4AF37]" />
                סוג שיעור
              </div>
              <div className="flex flex-wrap gap-2">
                {sessionTypes.map((type) => {
                  const active = sessionType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSessionType(type.id)}
                      className={`rounded-xl px-4 py-3 text-sm transition-all border ${
                        active
                          ? "bg-[#D4AF37] text-white shadow-md border-[#D4AF37]"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                      data-testid={`button-type-${type.id}`}
                    >
                      <div className="font-semibold">{type.name}</div>
                      <div className="text-xs opacity-80">{type.description}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Date & Time */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#D4AF37]" />
                תאריך ושעה
              </div>
              <MobileDatePicker
                value={selectedDate || undefined}
                onChange={(date) => setSelectedDate(date)}
                minDate={new Date()}
                includeTime={true}
                label=""
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-600">משך שיעור (דקות)</span>
                <select
                  value={sessionDuration}
                  onChange={e => setSessionDuration(Number(e.target.value))}
                  className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  data-testid="select-duration"
                >
                  <option value={60}>60 דקות</option>
                  <option value={90}>90 דקות</option>
                  <option value={120}>120 דקות</option>
                </select>
              </div>
            </section>

            {/* Notes */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-2 text-sm font-semibold text-slate-700">
                הערות (אופציונלי)
              </div>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="luxury-glass-minimal w-full resize-none px-4 py-3 text-sm"
                placeholder="בעיות התנהגות, מטרות אימון, רגישויות, וכו׳"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-stagger-item p-6">
              <div className="mb-3 flex items-center justify-between luxury-text-body">
                <span>מחיר השיעור</span>
                <span>₪{pricing.grossCollectedILS.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between luxury-text-small opacity-70 pl-3 border-l-2 border-[#D4AF37]/20">
                <span>כולל עמלת PetWash (15%)</span>
                <span>₪{pricing.commission.toFixed(2)}</span>
              </div>
              <div className="mb-4 flex items-center justify-between luxury-text-small opacity-70 pl-3 border-l-2 border-[#D4AF37]/20">
                <span>מהם מע״מ (18/118)</span>
                <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-[#D4AF37]/20 flex items-center justify-between">
                <span className="luxury-heading-sm">סה״כ לחיוב</span>
                <span className="luxury-heading-lg luxury-text-gradient">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-4 luxury-text-small leading-relaxed opacity-80">
                <Shield className="h-3 w-3 inline mr-1 text-[#D4AF37]" />
                הסכום ייושמר מהארנק שלך עם אישור המאמן/ת, ויחויב לאחר סיום השיעור.
              </div>
            </div>

            {/* Continue Button */}
            <Button
              className="luxury-btn-primary luxury-shadow-xl w-full h-14 luxury-stagger-item"
              disabled={!canContinueDetails}
              onClick={handleNextFromDetails}
              data-testid="button-continue"
            >
              המשך לאישור
            </Button>
          </>
        )}

        {/* Step 2: Summary */}
        {step === "summary" && (
          <>
            <h2 className="luxury-heading-md mb-8 luxury-fade-in">סיכום הזמנה</h2>
            
            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6 space-y-3">
              <div className="luxury-heading-sm">{trainer.fullName}</div>
              <div className="luxury-text-body">
                תאריך: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="luxury-text-body">
                סוג: {sessionTypes.find(t => t.id === sessionType)?.name}
              </div>
              <div className="luxury-text-body">
                משך: {sessionDuration} דקות
              </div>
            </div>

            <div className="mb-4 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-4">
              <BookingFinancialSummary
                subtotalCents={Math.round(pricing.grossCollectedILS * 100)}
                serviceFeeCents={Math.round((pricing.commission + pricing.vatOnCommission) * 100)}
                totalCents={Math.round(pricing.totalCharged * 100)}
                loyaltyRedeemedCents={appliedCredits ? appliedCredits.totalCreditsAppliedCents : 0}
              />
            </div>

            <WalletCheckoutPreview
              subtotalCents={Math.round(pricing.totalCharged * 100)}
              divisionCode="academy"
              className="mb-4"
            />

            {user && (
              <CreditWalletCard
                userId={user.uid}
                platform="academy"
                transactionAmountCents={Math.round(pricing.totalCharged * 100)}
                onRedeemCredits={(preview, redemption) => {
                  setAppliedCredits({
                    redemptionSessionId: redemption.sessionId,
                    totalCreditsAppliedCents: preview.totalCreditsApplicableCents,
                    cashDueCents: redemption.cashDueCents,
                  });
                }}
              />
            )}

            {/* PrestigePass Payment Option */}
            {user && pricing.totalCharged > 0 && (
              <div className="mb-4">
                <PrestigePassPaymentOption
                  bookingId={bookingId || `PENDING-ACADEMY-${user.uid.slice(0, 8)}`}
                  serviceType="academy"
                  amountGross={Math.round(pricing.totalCharged * 100)}
                />
              </div>
            )}

            <div className="flex gap-4 luxury-stagger-item">
              <Button
                variant="outline"
                className="luxury-btn-secondary flex-1 h-14"
                onClick={() => setStep("details")}
                data-testid="button-back-summary"
              >
                חזרה
              </Button>
              <Button
                className="luxury-btn-primary luxury-shadow-xl flex-1 h-14"
                onClick={() => {
                  emitCtaEvent('BOOK_CONFIRM', { domain: 'academy_book' });
                  handleConfirmBooking();
                }}
                disabled={isSubmitting}
                data-action-id="BOOK_CONFIRM"
                data-testid="button-confirm"
              >
                {isSubmitting ? "שולח..." : "אישור והמשך"}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirmation" && (
          <div className="py-12 luxury-fade-in">
            <div className="text-center mb-6">
              {/* Honesty fix (booking audit CRIT #5): the server writes
                 bookingStatus='pending' and waits for the trainer to accept
                 via /bookings/:id/confirm. The old screen showed a green
                 check + "ההזמנה נקלטה" which read as "the trainer confirmed"
                 — but nothing was confirmed yet, and the trainer inbox was
                 silent. Now: amber "awaiting trainer confirmation" state
                 with a clear next-step line, plus a link into the customer
                 bookings list where the accept notification will surface. */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 mx-auto flex items-center justify-center mb-6 luxury-shadow-xl">
                <Clock className="h-12 w-12 text-white" />
              </div>
              <h2 className="luxury-heading-lg mb-3">בקשת ההזמנה נשלחה — ממתין לאישור המאמן/ת</h2>
              <p className="luxury-text-body max-w-md mx-auto mb-2">
                המאמן/ת יקבל/תקבל את פרטי ההזמנה כעת. חיוב יבוצע רק לאחר שהמאמן/ת יאשר/תאשר את הפגישה.
              </p>
              <p className="luxury-text-body max-w-md mx-auto mb-2 text-slate-500">
                מספר הזמנה: <strong className="text-slate-800">{bookingId || "בבדיקה"}</strong>
              </p>
              <p className="luxury-text-body max-w-md mx-auto text-xs text-amber-700">
                תקבל/י התראה ברגע שהמאמן/ת יאשר/תאשר או ידחה/תדחה את ההזמנה.
              </p>
            </div>

            <div className="max-w-md mx-auto mb-6 luxury-glass-card luxury-shadow-xl p-4">
              <BookingFinancialSummary
                subtotalCents={Math.round(pricing.grossCollectedILS * 100)}
                serviceFeeCents={Math.round((pricing.commission + pricing.vatOnCommission) * 100)}
                totalCents={Math.round(pricing.totalCharged * 100)}
                loyaltyRedeemedCents={appliedCredits ? appliedCredits.totalCreditsAppliedCents : 0}
                financeState={bookingFinanceState !== 'none' ? bookingFinanceState : undefined}
                walletHoldCents={bookingWalletHoldCents}
              />
            </div>

            <div className="text-center">
              <Button
                className="luxury-btn-primary luxury-shadow-xl px-12"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-dashboard"
              >
                חזרה ללוח הבקרה
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
