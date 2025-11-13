import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, GraduationCap, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";

type BookingStep = "details" | "summary" | "confirmation";

export default function AcademyBookingFlow() {
  const { trainerId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(60); // minutes
  const [sessionType, setSessionType] = useState<string>("private");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Fetch trainer data from real API
  const { data: trainerData, isLoading: trainerLoading, error: trainerError } = useQuery({
    queryKey: [`/api/academy/trainers/${trainerId}`],
    enabled: !!trainerId,
  });

  const trainer = trainerData?.trainer;

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
          paymentMethod: 'nayax',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const booking = await apiRequest("/api/academy/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setBookingId(booking.id || booking.bookingNumber || 'pending');
      setStep("confirmation");

      toast({
        title: "הזמנה נקלטה בהצלחה! 🎓",
        description: "המאמן/ת יקבל/תקבל הודעה. החיוב מתבצע רק דרך Nayax Israel.",
      });
    } catch (error: any) {
      toast({
        title: "שגיאה ביצירת הזמנה",
        description: error.message || "אירעה שגיאה. אין חיוב. נסה/י שוב.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Loading state
  if (trainerLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
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
          <Button onClick={() => setLocation("/academy")} className="bg-purple-500 text-white font-light">
            חזרה לרשימת מאמנים
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            className="mb-4 text-slate-600 font-light"
            onClick={() => setLocation("/academy")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה למאמנים
          </Button>

          <h1 className="text-2xl font-light text-slate-900" data-testid="page-title">
            הזמנת {trainer.fullName}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Trainer Info Card */}
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex items-center gap-3">
                {trainer.profilePhotoUrl ? (
                  <img
                    src={trainer.profilePhotoUrl}
                    alt={trainer.fullName}
                    className="h-16 w-16 rounded-full object-cover border-2 border-purple-200"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center text-xl font-semibold text-purple-700">
                    {trainer.fullName.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{trainer.fullName}</div>
                  <div className="text-sm text-slate-600">
                    {trainer.city} · ⭐ {parseFloat(trainer.averageRating).toFixed(1)} ({trainer.totalSessions} שיעורים)
                  </div>
                  {trainer.isCertified && (
                    <div className="text-xs text-purple-600 mt-1">✓ מאומן/ת מוסמך/ת</div>
                  )}
                </div>
              </div>
            </section>

            {/* Session Type */}
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-purple-500" />
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
                          ? "bg-purple-500 text-white shadow-md border-purple-500"
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
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                תאריך ושעה
              </div>
              <MobileDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
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
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">
                הערות (אופציונלי)
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                placeholder="בעיות התנהגות, מטרות אימון, רגישויות, וכו׳"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 rounded-2xl border border-purple-100 bg-purple-50/30 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
                <span>עמלת פלטפורמה (15%)</span>
                <span>₪{pricing.commission.toFixed(2)}</span>
              </div>
              <div className="mb-3 flex items-center justify-between text-sm text-slate-700">
                <span>מע״מ על עמלה (18%)</span>
                <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-purple-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ לחיוב</span>
                <span className="text-2xl font-bold text-purple-600">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-600 leading-relaxed">
                <Shield className="h-3 w-3 inline mr-1 text-purple-500" />
                החיוב מתבצע אך ורק דרך Nayax Israel. הכסף מוחזק ב-escrow ל-72 שעות להגנת שני הצדדים. התשלום משוחרר למאמן/ת לאחר סיום השיעור.
              </div>
            </div>

            {/* Continue Button */}
            <Button
              className="w-full h-12 rounded-2xl bg-purple-500 text-white text-base font-semibold shadow-lg hover:bg-purple-600"
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
            <h2 className="text-xl font-semibold mb-6 text-slate-900">סיכום הזמנה</h2>
            
            <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm space-y-2">
              <div className="font-semibold text-slate-900">{trainer.fullName}</div>
              <div className="text-slate-600">
                תאריך: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="text-slate-600">
                סוג: {sessionTypes.find(t => t.id === sessionType)?.name}
              </div>
              <div className="text-slate-600">
                משך: {sessionDuration} דקות
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-purple-100 bg-purple-50/30 p-4">
              <div className="mb-1 text-xs font-semibold text-slate-700">פירוט מחיר</div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>עמלה + מע״מ</span>
                <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ</span>
                <span className="text-xl font-bold text-purple-600">₪{pricing.totalCharged.toFixed(2)}</span>
              </div>
              <div className="mt-3 text-[10px] text-slate-600">
                החיוב רק דרך Nayax Israel. אין גובים באמצעים אחרים.
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl text-sm"
                onClick={() => setStep("details")}
                data-testid="button-back-summary"
              >
                חזרה
              </Button>
              <Button
                className="flex-1 h-12 rounded-2xl bg-purple-500 text-white text-sm font-semibold shadow-lg hover:bg-purple-600"
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                data-testid="button-confirm"
              >
                {isSubmitting ? "שולח..." : "אישור והמשך"}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirmation" && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-purple-100 mx-auto flex items-center justify-center mb-4">
              <Check className="h-10 w-10 text-purple-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-slate-900">ההזמנה נקלטה בהצלחה!</h2>
            <p className="text-slate-600 max-w-sm mx-auto mb-2">
              המאמן/ת יקבל/תקבל את פרטי ההזמנה. מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              פרטי חיוב Nayax ישלחו בהודעה נפרדת.
            </p>
            <Button
              className="rounded-2xl px-8 bg-purple-500 text-white shadow-lg hover:bg-purple-600"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-dashboard"
            >
              חזרה ללוח הבקרה
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
