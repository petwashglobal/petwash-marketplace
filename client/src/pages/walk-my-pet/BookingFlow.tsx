import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod } from "@/lib/paymentConfig";

type BookingStep = "details" | "summary" | "confirmation";

export default function WalkBookingFlow() {
  const { walkerId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const walkerIdNumber = walkerId ? parseInt(walkerId) : undefined;

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number>(60); // minutes
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Fetch walker data from real API
  const { data: providersData, isLoading: walkerLoading, error: walkerError } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/providers'],
    enabled: !!walkerIdNumber,
  });

  // Fetch user's pets from real API
  const { data: petsData, isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: step === 'details',
  });

  const providers = Array.isArray(providersData) ? providersData : [];
  const walker = providers.find((p: any) => Number(p.id) === walkerIdNumber);
  const pets = Array.isArray(petsData) ? petsData : (petsData?.pets || []);

  // Calculate pricing using VAT calculator
  const baseAmount = useMemo(() => {
    if (!walker?.hourlyRate) return 0;
    return walker.hourlyRate * (duration / 60); // Pro-rate for duration
  }, [walker, duration]);

  const pricing = useMemo(() => {
    return vatCalculator.calculateVAT(baseAmount);
  }, [baseAmount]);

  const canContinueDetails = useMemo(() => {
    return (
      !!walker &&
      selectedPetIds.length > 0 &&
      !!selectedDate &&
      duration > 0
    );
  }, [walker, selectedPetIds, selectedDate, duration]);

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
    if (!walker || !selectedDate || !walkerIdNumber) return;

    try {
      setIsSubmitting(true);

      const startTime = new Date(selectedDate);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + duration);

      const payload = {
        providerId: walkerIdNumber,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        petIds: selectedPetIds,
        notes,
        items: [
          {
            itemType: 'service',
            name: 'Dog Walking Service',
            nameHe: 'שירות הליכה עם הכלב',
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
          walkerName: walker.businessName || walker.displayName || 'Professional Walker',
          serviceArea: walker.serviceArea || 'Service Area',
          duration,
          paymentMethod: getActivePaymentMethod(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const booking = await apiRequest(`/api/platforms/walk_my_pet/bookings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setBookingId(booking.id || booking.bookingNumber || 'pending');
      setStep("confirmation");

      toast({
        title: "הזמנה נקלטה בהצלחה! 🐾",
        description: "המוליך/ה יקבל/תקבל הודעה. התשלום יתואם לאחר ההזמנה.",
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

  function togglePet(id: number) {
    setSelectedPetIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  // Loading state
  if (walkerLoading || petsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 font-light">טוען את נתוני המוליך/ה...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (walkerError || !walker) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-light mb-4 text-slate-900">לא נמצא/ה מוליך/ה</h2>
          <p className="text-slate-600 font-light mb-6">
            המוליך/ה לא זמינ/ה כרגע או שהקישור שגוי.
          </p>
          <Button onClick={() => setLocation("/walk-my-pet")} className="bg-blue-500 text-white font-light">
            חזרה לרשימת מוליכים
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
            onClick={() => setLocation("/walk-my-pet")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה למוליכים
          </button>

          <h1 className="luxury-heading-md luxury-text-gradient" data-testid="page-title">
            הזמנת {walker.businessName || walker.displayName}
          </h1>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-8 luxury-fade-in">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'details' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white luxury-shadow-lg' : step === 'summary' || step === 'confirmation' ? 'luxury-gradient-border bg-white text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
            1
          </div>
          <div className={`h-1 w-16 rounded-full ${step === 'summary' || step === 'confirmation' ? 'luxury-bg-primary' : 'bg-slate-200'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'summary' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white luxury-shadow-lg' : step === 'confirmation' ? 'luxury-gradient-border bg-white text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
            2
          </div>
          <div className={`h-1 w-16 rounded-full ${step === 'confirmation' ? 'luxury-bg-primary' : 'bg-slate-200'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'confirmation' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white luxury-shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
            3
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Walker Info Card */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="flex items-center gap-3">
                {walker.profilePictureUrl ? (
                  <img
                    src={walker.profilePictureUrl}
                    alt={walker.businessName || walker.displayName}
                    className="h-16 w-16 rounded-full object-cover border-2 border-blue-200"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-xl font-semibold text-blue-700">
                    {(walker.businessName || walker.displayName || 'W').charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="luxury-heading-sm">
                    {walker.businessName || walker.displayName}
                  </div>
                  <div className="text-sm text-slate-600">
                    {walker.serviceArea || 'שירות הליכה'} · ⭐ {walker.rating?.toFixed(1) || '5.0'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {walker.yearsOfExperience || 0} שנות ניסיון
                  </div>
                </div>
              </div>
            </section>

            {/* Pet Selection */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-blue-500" />
                כלבים להליכה
              </div>
              {pets.length === 0 ? (
                <div className="luxury-text-body text-center py-4">
                  אין כלבים. הוסף/י כלב לפרופיל שלך.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet: any) => {
                    const active = selectedPetIds.includes(pet.id);
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => togglePet(pet.id)}
                        className={`rounded-full px-4 py-2 text-sm transition-all ${
                          active
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                        data-testid={`button-pet-${pet.id}`}
                      >
                        {pet.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Date & Time */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                תאריך ושעת התחלה
              </div>
              <MobileDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                minDate={new Date()}
                includeTime={true}
                label=""
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-600">משך הליכה (דקות)</span>
                <select
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  data-testid="select-duration"
                >
                  <option value={30}>30 דקות</option>
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
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="luxury-glass-minimal w-full resize-none px-4 py-3 text-sm"
                placeholder="התנהגות הכלב, רגישויות, מסלול מועדף, וכו׳"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-stagger-item p-6">
              <div className="mb-3 flex items-center justify-between luxury-text-body">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-3 flex items-center justify-between luxury-text-body">
                <span>עמלת פלטפורמה (15%)</span>
                <span>₪{pricing.commission.toFixed(2)}</span>
              </div>
              <div className="mb-4 flex items-center justify-between luxury-text-body">
                <span>מע״מ על עמלה (18%)</span>
                <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
                <span className="luxury-heading-sm">סה״כ לחיוב</span>
                <span className="luxury-heading-lg luxury-text-gradient">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-4 luxury-text-small leading-relaxed opacity-80">
                <Shield className="h-3 w-3 inline mr-1 text-blue-500" />
                הכסף מוחזק ב-escrow ל-72 שעות להגנת שני הצדדים. התשלום משוחרר למוליך/ה לאחר סיום ההליכה.
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
              <div className="luxury-heading-sm">
                {walker.businessName || walker.displayName}
              </div>
              <div className="luxury-text-body">
                תאריך: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="luxury-text-body">
                משך: {duration} דקות
              </div>
              <div className="luxury-text-body">
                כלבים: {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
              </div>
            </div>

            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm">פירוט מחיר</div>
              <div className="mb-2 flex items-center justify-between luxury-text-small">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-2 flex items-center justify-between luxury-text-small">
                <span>עמלה + מע״מ</span>
                <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
                <span className="luxury-heading-sm">סה״כ</span>
                <span className="luxury-heading-lg luxury-text-gradient">₪{pricing.totalCharged.toFixed(2)}</span>
              </div>
              <div className="mt-4 luxury-text-small opacity-80">
                התשלום יתואם לאחר ההזמנה.
              </div>
            </div>

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
          <div className="text-center py-12 luxury-fade-in">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 mx-auto flex items-center justify-center mb-6 luxury-shadow-xl">
              <Check className="h-12 w-12 text-white" />
            </div>
            <h2 className="luxury-heading-lg mb-4">ההזמנה נקלטה בהצלחה!</h2>
            <p className="luxury-text-body max-w-md mx-auto mb-3">
              המוליך/ה יקבל/תקבל את פרטי ההזמנה. מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="luxury-text-small max-w-md mx-auto mb-8">
              פרטי התשלום ומעקב GPS ישלחו בהודעה נפרדת.
            </p>
            <Button
              className="luxury-btn-primary luxury-shadow-xl px-12"
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
