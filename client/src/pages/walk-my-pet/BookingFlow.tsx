import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";

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
          paymentMethod: 'nayax',
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
        description: "המוליך/ה יקבל/תקבל הודעה. החיוב מתבצע רק דרך Nayax Israel.",
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            className="mb-4 text-slate-600 font-light"
            onClick={() => setLocation("/walk-my-pet")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה למוליכים
          </Button>

          <h1 className="text-2xl font-light text-slate-900" data-testid="page-title">
            הזמנת {walker.businessName || walker.displayName}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Walker Info Card */}
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
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
                  <div className="font-semibold text-slate-900">
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
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-blue-500" />
                כלבים להליכה
              </div>
              {pets.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
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
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
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
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">
                הערות (אופציונלי)
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                placeholder="התנהגות הכלב, רגישויות, מסלול מועדף, וכו׳"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
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
              <div className="pt-3 border-t border-blue-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ לחיוב</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-600 leading-relaxed">
                <Shield className="h-3 w-3 inline mr-1 text-blue-500" />
                החיוב מתבצע אך ורק דרך Nayax Israel. הכסף מוחזק ב-escrow ל-72 שעות להגנת שני הצדדים. התשלום משוחרר למוליך/ה לאחר סיום ההליכה.
              </div>
            </div>

            {/* Continue Button */}
            <Button
              className="w-full h-12 rounded-2xl bg-blue-500 text-white text-base font-semibold shadow-lg hover:bg-blue-600"
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
              <div className="font-semibold text-slate-900">
                {walker.businessName || walker.displayName}
              </div>
              <div className="text-slate-600">
                תאריך: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="text-slate-600">
                משך: {duration} דקות
              </div>
              <div className="text-slate-600">
                כלבים: {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
              <div className="mb-1 text-xs font-semibold text-slate-700">פירוט מחיר</div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>עמלה + מע״מ</span>
                <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ</span>
                <span className="text-xl font-bold text-blue-600">₪{pricing.totalCharged.toFixed(2)}</span>
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
                className="flex-1 h-12 rounded-2xl bg-blue-500 text-white text-sm font-semibold shadow-lg hover:bg-blue-600"
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
            <div className="w-20 h-20 rounded-full bg-blue-100 mx-auto flex items-center justify-center mb-4">
              <Check className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-slate-900">ההזמנה נקלטה בהצלחה!</h2>
            <p className="text-slate-600 max-w-sm mx-auto mb-2">
              המוליך/ה יקבל/תקבל את פרטי ההזמנה. מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              פרטי חיוב Nayax ומעקב GPS ישלחו בהודעה נפרדת.
            </p>
            <Button
              className="rounded-2xl px-8 bg-blue-500 text-white shadow-lg hover:bg-blue-600"
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
