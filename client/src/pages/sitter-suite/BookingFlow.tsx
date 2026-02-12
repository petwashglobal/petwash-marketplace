import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod } from "@/lib/paymentConfig";
import { GooglePlacesAutocomplete, PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { OwnerInstructionsForm, useOwnerInstructions, type OwnerInstructions } from "@/components/booking/OwnerInstructionsForm";

type BookingStep = "details" | "summary" | "confirmation";

function formatDateForInput(date?: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTimeForInput(date?: Date | null): string {
  if (!date) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDisplayDate(date?: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('he-IL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function daysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function SitterBookingFlow() {
  const { sitterId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [checkInTime, setCheckInTime] = useState("10:00");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const { instructions: ownerInstructions, setInstructions: setOwnerInstructions } = useOwnerInstructions();

  const { data: sitterData, isLoading: sitterLoading, error: sitterError } = useQuery({
    queryKey: [`/api/sitter-suite/sitters/${sitterId}`],
    enabled: !!sitterId,
  });

  const { data: petsData, isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: step === 'details',
  });

  const sitter = sitterData?.sitter;
  const pets = Array.isArray(petsData) ? petsData : (petsData?.pets || []);

  const totalDays = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    return daysBetween(checkInDate, checkOutDate);
  }, [checkInDate, checkOutDate]);

  const baseAmount = useMemo(() => {
    if (!sitter?.pricePerDayCents || totalDays === 0) return 0;
    return (sitter.pricePerDayCents / 100) * totalDays;
  }, [sitter, totalDays]);

  const pricing = useMemo(() => {
    return vatCalculator.calculateVAT(baseAmount);
  }, [baseAmount]);

  const canContinueDetails = useMemo(() => {
    return (
      !!sitter &&
      selectedPetIds.length > 0 &&
      !!checkInDate &&
      !!checkOutDate &&
      checkOutDate > checkInDate &&
      address.trim().length > 5
    );
  }, [sitter, selectedPetIds, checkInDate, checkOutDate, address]);

  function handleCheckInDateChange(dateStr: string) {
    if (!dateStr) return;
    const d = new Date(dateStr);
    const [h, m] = checkInTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    setCheckInDate(d);
    if (checkOutDate && d >= checkOutDate) {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const [oh, om] = checkOutTime.split(':').map(Number);
      next.setHours(oh, om, 0, 0);
      setCheckOutDate(next);
    }
  }

  function handleCheckOutDateChange(dateStr: string) {
    if (!dateStr) return;
    const d = new Date(dateStr);
    const [h, m] = checkOutTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    setCheckOutDate(d);
  }

  function handleCheckInTimeChange(timeStr: string) {
    setCheckInTime(timeStr);
    if (checkInDate) {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(checkInDate);
      d.setHours(h, m, 0, 0);
      setCheckInDate(d);
    }
  }

  function handleCheckOutTimeChange(timeStr: string) {
    setCheckOutTime(timeStr);
    if (checkOutDate) {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(checkOutDate);
      d.setHours(h, m, 0, 0);
      setCheckOutDate(d);
    }
  }

  async function handleNextFromDetails() {
    if (!canContinueDetails) {
      toast({
        title: "חסרים פרטים",
        description: "יש למלא את כל השדות לפני המשך",
        variant: "destructive",
      });
      return;
    }
    setStep("summary");
  }

  async function handleConfirmBooking() {
    if (!sitter || !checkInDate || !checkOutDate) return;

    try {
      setIsSubmitting(true);

      const payload = {
        sitterId: sitter.id,
        petId: selectedPetIds[0],
        startDate: checkInDate.toISOString(),
        endDate: checkOutDate.toISOString(),
        specialInstructions: notes || '',
        address,
        petIds: selectedPetIds,
        pricing: {
          currency: "ILS",
          baseAmount: pricing.baseAmount,
          commission: pricing.commission,
          vatAmount: pricing.vatOnCommission,
          totalAmount: pricing.totalCharged
        },
        ownerInstructions: ownerInstructions.shareWithProvider ? {
          gateCode: ownerInstructions.gateCode,
          doorCode: ownerInstructions.doorCode,
          alarmCode: ownerInstructions.alarmCode,
          alarmInstructions: ownerInstructions.alarmInstructions,
          airconLocation: ownerInstructions.airconLocation,
          foodLocation: ownerInstructions.foodLocation,
          waterLocation: ownerInstructions.waterLocation,
          medicationInstructions: ownerInstructions.medicationInstructions,
          emergencyContact: ownerInstructions.emergencyContact,
          vetContact: ownerInstructions.vetContact,
          additionalNotes: ownerInstructions.additionalNotes,
        } : null,
        platformData: {
          sitterName: `${sitter.firstName} ${sitter.lastName}`,
          totalDays,
          paymentMethod: getActivePaymentMethod(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const response = await apiRequest('POST', '/api/sitter-suite/bookings', payload);
      const booking = await response.json();

      setBookingId(booking.booking?.id || booking.id || booking.bookingId || 'pending');
      setStep("confirmation");

      toast({
        title: "ההזמנה נקלטה בהצלחה!",
        description: "השמרטף/ית יקבל/תקבל הודעה. התשלום יתואם לאחר ההזמנה.",
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
          description: "שירות זה זמין לחברי מועדון Pet Wash™. הצטרפו עכשיו!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "שגיאה ביצירת הזמנה",
          description: errorMsg || "אירעה שגיאה. אין חיוב. נסו שוב.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function togglePet(id: number) {
    setSelectedPetIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  function handleBack() {
    if (step === "summary") setStep("details");
    if (step === "confirmation") setLocation("/sitter-suite");
  }

  const todayStr = formatDateForInput(new Date());

  if (sitterLoading || petsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-600 font-light">...טוען</p>
        </div>
      </div>
    );
  }

  if (sitterError || !sitter) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-light mb-4 text-slate-900">לא נמצא/ה שמרטף/ית</h2>
          <p className="text-slate-600 font-light mb-6">
            השמרטף/ית לא זמינ/ה כרגע או שהקישור שגוי.
          </p>
          <Button onClick={() => setLocation("/sitter-suite")} className="bg-emerald-500 text-white font-light">
            חזרה לרשימת שמרטפים
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            className="flex items-center gap-1 text-sm text-slate-500 mb-2 touch-manipulation min-h-[44px]"
            onClick={() => setLocation("/sitter-suite")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4" />
            חזרה לשמרטפים
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            הזמנת {sitter.firstName} {sitter.lastName}
          </h1>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center justify-center gap-3">
          {[
            { num: 1, label: 'פרטים', key: 'details' },
            { num: 2, label: 'סיכום', key: 'summary' },
            { num: 3, label: 'אישור', key: 'confirmation' },
          ].map(({ num, label, key }, idx) => {
            const steps: BookingStep[] = ['details', 'summary', 'confirmation'];
            const currentIdx = steps.indexOf(step);
            const stepIdx = steps.indexOf(key as BookingStep);
            const isActive = step === key;
            const isDone = stepIdx < currentIdx;
            return (
              <div key={key} className="flex items-center gap-3">
                {idx > 0 && (
                  <div className={`h-0.5 w-8 sm:w-12 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isActive ? 'bg-emerald-500 text-white shadow-lg' :
                    isDone ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {isDone ? <Check className="h-4 w-4" /> : num}
                  </div>
                  <span className={`text-xs ${isActive ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* Step 1: Details */}
        {step === "details" && (
          <div className="space-y-5">
            {/* Sitter Info */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-4">
                {sitter.profilePictureUrl ? (
                  <img
                    src={sitter.profilePictureUrl}
                    alt={`${sitter.firstName} ${sitter.lastName}`}
                    className="h-14 w-14 rounded-full object-cover border-2 border-emerald-100"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center text-lg font-semibold text-emerald-600">
                    {sitter.firstName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {sitter.firstName} {sitter.lastName}
                  </div>
                  <div className="text-sm text-slate-500">
                    {sitter.city} · {Number(sitter.rating).toFixed(1)} ({sitter.totalBookings} הזמנות)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {sitter.yearsOfExperience} שנות ניסיון · ₪{(sitter.pricePerDayCents / 100).toFixed(0)}/יום
                  </div>
                </div>
              </div>
            </section>

            {/* Pet Selection */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="mb-3 flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold text-slate-800 text-sm">בחירת חיות מחמד</span>
              </div>
              {pets.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  אין חיות מחמד ברשומה. יש להוסיף חיה לפרופיל.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet: any) => {
                    const active = selectedPetIds.includes(pet.id);
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => togglePet(pet.id)}
                        className={`rounded-full px-5 py-3 min-h-[44px] text-sm font-medium transition-all touch-manipulation ${
                          active
                            ? "bg-emerald-500 text-white shadow-md"
                            : "bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-300"
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

            {/* Check-in / Check-out */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold text-slate-800 text-sm">תאריכי שמרטפות</span>
              </div>

              <div className="space-y-4">
                {/* Check-in */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">כניסה (Check-in)</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      type="date"
                      value={formatDateForInput(checkInDate)}
                      onChange={(e) => handleCheckInDateChange(e.target.value)}
                      min={todayStr}
                      className="w-full px-4 py-3 min-h-[48px] text-base rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all touch-manipulation bg-white"
                      style={{ fontSize: '16px' }}
                      data-testid="input-checkin-date"
                    />
                    <input
                      type="time"
                      value={checkInTime}
                      onChange={(e) => handleCheckInTimeChange(e.target.value)}
                      className="w-28 px-3 py-3 min-h-[48px] text-base rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all touch-manipulation bg-white text-center"
                      style={{ fontSize: '16px' }}
                      data-testid="input-checkin-time"
                    />
                  </div>
                  {checkInDate && (
                    <p className="text-xs text-slate-500 mt-1">{formatDisplayDate(checkInDate)}</p>
                  )}
                </div>

                {/* Check-out */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">יציאה (Check-out)</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      type="date"
                      value={formatDateForInput(checkOutDate)}
                      onChange={(e) => handleCheckOutDateChange(e.target.value)}
                      min={checkInDate ? formatDateForInput(new Date(checkInDate.getTime() + 86400000)) : todayStr}
                      className="w-full px-4 py-3 min-h-[48px] text-base rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all touch-manipulation bg-white"
                      style={{ fontSize: '16px' }}
                      data-testid="input-checkout-date"
                    />
                    <input
                      type="time"
                      value={checkOutTime}
                      onChange={(e) => handleCheckOutTimeChange(e.target.value)}
                      className="w-28 px-3 py-3 min-h-[48px] text-base rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all touch-manipulation bg-white text-center"
                      style={{ fontSize: '16px' }}
                      data-testid="input-checkout-time"
                    />
                  </div>
                  {checkOutDate && (
                    <p className="text-xs text-slate-500 mt-1">{formatDisplayDate(checkOutDate)}</p>
                  )}
                </div>

                {/* Duration summary */}
                {totalDays > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
                    <span className="text-sm font-medium text-emerald-800">
                      {totalDays === 1 ? 'יום אחד' : `${totalDays} ימים`}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Address */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                כתובת מלאה
              </label>
              <GooglePlacesAutocomplete
                value={address}
                onChange={(value) => setAddress(value)}
                onPlaceSelected={(place: PlaceDetails) => setAddress(place.formattedAddress)}
                placeholder="הקלידו כתובת..."
                country={['il']}
              />
            </section>

            {/* Notes */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                הערות (אופציונלי)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none px-4 py-3 text-sm rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all min-h-[48px] touch-manipulation"
                placeholder="הנחיות מיוחדות, רגישויות וכו׳"
                style={{ fontSize: '16px' }}
                data-testid="textarea-notes"
              />
            </section>

            {/* Owner Instructions */}
            <OwnerInstructionsForm
              value={ownerInstructions}
              onChange={setOwnerInstructions}
              className="mb-2"
            />

            {/* Pricing */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>₪{(sitter.pricePerDayCents / 100).toFixed(0)}/יום x {totalDays || 0} ימים</span>
                  <span>₪{pricing.baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>עמלת פלטפורמה (15%)</span>
                  <span>₪{pricing.commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>מע״מ על עמלה (18%)</span>
                  <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between">
                  <span className="font-semibold text-slate-900">סה״כ לחיוב</span>
                  <span className="font-bold text-lg text-emerald-600">
                    ₪{pricing.totalCharged.toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                <Shield className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                הכסף מוחזק ב-escrow ל-72 שעות להגנת שני הצדדים
              </p>
            </section>

            {/* Continue Button */}
            <Button
              className="w-full h-14 text-base font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg touch-manipulation"
              disabled={!canContinueDetails}
              onClick={handleNextFromDetails}
              data-testid="button-continue"
            >
              המשך לסיכום
            </Button>
          </div>
        )}

        {/* Step 2: Summary */}
        {step === "summary" && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">סיכום הזמנה</h2>

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
              <div className="font-semibold text-slate-900">
                {sitter.firstName} {sitter.lastName}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-700">כניסה: </span>
                  {checkInDate ? checkInDate.toLocaleString("he-IL") : "-"}
                </div>
                <div>
                  <span className="font-medium text-slate-700">יציאה: </span>
                  {checkOutDate ? checkOutDate.toLocaleString("he-IL") : "-"}
                </div>
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">משך: </span>
                {totalDays === 1 ? 'יום אחד' : `${totalDays} ימים`}
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">חיות: </span>
                {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">כתובת: </span>
                {address}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="font-semibold text-slate-900 mb-3">פירוט מחיר</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>סכום בסיס ({totalDays} ימים)</span>
                  <span>₪{pricing.baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>עמלה + מע״מ</span>
                  <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between">
                  <span className="font-semibold text-slate-900">סה״כ</span>
                  <span className="font-bold text-lg text-emerald-600">₪{pricing.totalCharged.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">התשלום יתואם לאחר ההזמנה.</p>
            </section>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14 rounded-xl text-base font-medium touch-manipulation"
                onClick={handleBack}
                data-testid="button-back-summary"
              >
                חזרה
              </Button>
              <Button
                className="flex-1 h-14 rounded-xl text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg touch-manipulation"
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                data-testid="button-confirm"
              >
                {isSubmitting ? "שולח..." : "אישור הזמנה"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirmation" && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-6">
              <Check className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-3">ההזמנה נקלטה בהצלחה</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-2">
              השמרטף/ית יקבל/תקבל את פרטי ההזמנה.
            </p>
            <p className="text-sm text-slate-400 mb-1">
              מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="text-sm text-slate-400 mb-8">
              פרטי התשלום ישלחו בהודעה נפרדת.
            </p>
            <Button
              className="h-14 px-12 rounded-xl text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg touch-manipulation"
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
