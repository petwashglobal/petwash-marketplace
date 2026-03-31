import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, Clock, Check, CalendarRange, Loader2, CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod, PAYMENTS_CONFIG } from "@/lib/paymentConfig";
import { GooglePlacesAutocomplete, PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { OwnerInstructionsForm, useOwnerInstructions, type OwnerInstructions } from "@/components/booking/OwnerInstructionsForm";
import { CreditWalletCard } from "@/components/wallet/CreditWalletCard";
import { PrestigePassPaymentOption } from "@/components/PrestigePassPaymentOption";
import { WalletCheckoutPreview } from "@/components/wallet/WalletCheckoutPreview";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

type BookingStep = "details" | "summary" | "pending_match" | "confirmation";

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
  const { user } = useFirebaseAuth();

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [checkInTime, setCheckInTime] = useState("10:00");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [appliedCredits, setAppliedCredits] = useState<{ redemptionSessionId: string; totalCreditsAppliedCents: number; cashDueCents: number } | null>(null);
  const { instructions: ownerInstructions, setInstructions: setOwnerInstructions } = useOwnerInstructions();

  const { data: sitterData, isLoading: sitterLoading, error: sitterError } = useQuery({
    queryKey: [`/api/sitter-suite/sitters/${sitterId}`],
    enabled: !!sitterId,
  });

  const { data: petsData, isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: step === 'details',
  });

  const { data: bookingStatus } = useQuery({
    queryKey: [`/api/sitter-suite/bookings/${bookingId}/status`],
    enabled: step === 'pending_match' && !!bookingId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (step === 'pending_match' && bookingStatus) {
      if (bookingStatus.status === 'accepted' || bookingStatus.status === 'confirmed') {
        setStep('confirmation');
      }
    }
  }, [step, bookingStatus]);

  const sitter = sitterData?.sitter;
  const pets = Array.isArray(petsData) ? petsData : (petsData?.pets || []);

  // Auto-select pet if user has exactly one pet
  useEffect(() => {
    if (pets.length === 1 && selectedPetIds.length === 0) {
      setSelectedPetIds([pets[0].id]);
    }
  }, [pets, selectedPetIds]);

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

  function handleCalendarRangeSelect(range: DateRange | undefined) {
    setCalendarRange(range);
    if (range?.from) {
      const d = new Date(range.from);
      const [h, m] = checkInTime.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      setCheckInDate(d);
    } else {
      setCheckInDate(null);
    }
    if (range?.to) {
      const d = new Date(range.to);
      const [h, m] = checkOutTime.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      setCheckOutDate(d);
    } else {
      setCheckOutDate(null);
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
        addressCity: addressCity || undefined,
        addressPostal: addressPostal || undefined,
        addressLat: addressLat ?? undefined,
        addressLng: addressLng ?? undefined,
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
        },
        ...(appliedCredits ? {
          redemptionSessionId: appliedCredits.redemptionSessionId,
          creditsAppliedCents: appliedCredits.totalCreditsAppliedCents,
          cashDueCents: appliedCredits.cashDueCents,
        } : {})
      };

      const response = await apiRequest('POST', '/api/sitter-suite/bookings', payload);
      const booking = await response.json();

      setBookingId(booking.booking?.id || booking.id || booking.bookingId || 'pending');
      
      // Open chat conversation
      if (booking.booking?.id || booking.id) {
        apiRequest('POST', `/api/booking-chat/${booking.booking?.id || booking.id}/open`).catch(err => {
          console.error('Failed to open booking chat:', err);
        });
      }

      // Mark first booking as complete for push notification permission (Apple compliance)
      localStorage.setItem('petwash_first_booking_complete', 'true');

      setStep("pending_match");

      toast({
        title: "ההזמנה נקלטה בהצלחה!",
        description: "השמרטף/ית יקבל/תקבל הודעה. ממתינים לאישור.",
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
          description: "שירות זה זמין לחברי מועדון ⁦Pet Wash™⁩. הצטרפו עכשיו!",
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
    <div className="min-h-screen bg-white">
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
            { num: 3, label: 'התאמה', key: 'pending_match' },
            { num: 4, label: 'אישור', key: 'confirmation' },
          ].map(({ num, label, key }, idx) => {
            const steps: BookingStep[] = ['details', 'summary', 'pending_match', 'confirmation'];
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
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-slate-500">אין חיות מחמד ברשומה.</p>
                  <button
                    type="button"
                    onClick={() => setLocation('/pets')}
                    className="rounded-full px-5 py-3 min-h-[44px] text-sm font-medium bg-emerald-500 text-white shadow-md transition-all"
                  >
                    + הוסף חיית מחמד
                  </button>
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

            {/* Date Range Picker */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="mb-3 flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold text-slate-800 text-sm">בחירת תאריכי שמרטפות</span>
              </div>

              {/* Inline range calendar */}
              <div className="flex justify-center overflow-x-auto">
                <Calendar
                  mode="range"
                  selected={calendarRange}
                  onSelect={handleCalendarRangeSelect}
                  disabled={{ before: new Date() }}
                  numberOfMonths={1}
                  defaultMonth={new Date()}
                  className="rounded-xl border border-slate-100 bg-slate-50"
                />
              </div>

              {/* Selected range summary */}
              {(checkInDate || checkOutDate) && (
                <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center space-y-1">
                  {checkInDate && (
                    <p className="text-sm text-emerald-700">
                      <span className="font-medium">כניסה: </span>{formatDisplayDate(checkInDate)}
                    </p>
                  )}
                  {checkOutDate && (
                    <p className="text-sm text-emerald-700">
                      <span className="font-medium">יציאה: </span>{formatDisplayDate(checkOutDate)}
                    </p>
                  )}
                  {totalDays > 0 && (
                    <p className="text-base font-semibold text-emerald-800">
                      {totalDays === 1 ? 'לילה אחד' : `${totalDays} לילות`}
                    </p>
                  )}
                </div>
              )}

              {!checkInDate && (
                <p className="mt-3 text-center text-xs text-slate-400">לחץ על תאריך התחלה ואז תאריך סיום</p>
              )}
              {checkInDate && !checkOutDate && (
                <p className="mt-3 text-center text-xs text-emerald-500">כעת בחר את תאריך היציאה</p>
              )}

              {/* Time row */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">שעת כניסה</label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => handleCheckInTimeChange(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-base rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all bg-white text-center touch-manipulation"
                    style={{ fontSize: '16px' }}
                    data-testid="input-checkin-time"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">שעת יציאה</label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => handleCheckOutTimeChange(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-base rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all bg-white text-center touch-manipulation"
                    style={{ fontSize: '16px' }}
                    data-testid="input-checkout-time"
                  />
                </div>
              </div>
            </section>

            {/* Address */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                כתובת מלאה
              </label>
              <GooglePlacesAutocomplete
                value={address}
                onChange={(value, details) => {
                  setAddress(value);
                  if (details?.city) setAddressCity(details.city);
                  if (details?.postalCode) setAddressPostal(details.postalCode);
                  if (details?.lat != null) setAddressLat(details.lat);
                  if (details?.lng != null) setAddressLng(details.lng);
                }}
                onPlaceSelected={(place: PlaceDetails) => {
                  setAddress(place.formattedAddress);
                  if (place.city) setAddressCity(place.city);
                  if (place.postalCode) setAddressPostal(place.postalCode);
                  if (place.lat != null) setAddressLat(place.lat);
                  if (place.lng != null) setAddressLng(place.lng);
                }}
                placeholder="הקלידו כתובת..."
                country={['il', 'us', 'gb', 'au', 'ca']}
                showExtraFields={true}
                apartmentLabel="דירה / קומה / כניסה"
                postalCodeLabel="מיקוד"
                apartmentPlaceholder="לדוגמה: דירה 4, קומה 2"
                postalCodePlaceholder="לדוגמה: 6100000"
              />
            </section>

            {/* Notes */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                הערות (אופציונלי)
              </label>
              <Textarea
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
                  <span>₪{pricing.grossCollectedILS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs pl-3 border-l-2 border-slate-100">
                  <span>כולל עמלת PetWash (15%)</span>
                  <span>₪{pricing.commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs pl-3 border-l-2 border-slate-100">
                  <span>מהם מע״מ (18/118)</span>
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
                הסכום ייושמר מהארנק שלך עם אישור המשמר/ת, ויחויב לאחר סיום השהות.
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
                  <span>מחיר השירות ({totalDays} ימים)</span>
                  <span>₪{pricing.grossCollectedILS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs pl-3 border-l-2 border-slate-100">
                  <span>כולל עמלת PetWash + מע״מ</span>
                  <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between">
                  <span className="font-semibold text-slate-900">סה״כ</span>
                  <span className="font-bold text-lg text-emerald-600">₪{pricing.totalCharged.toFixed(2)}</span>
                </div>
                {appliedCredits && (
                  <>
                    <div className="flex justify-between text-emerald-600 text-sm">
                      <span>קרדיטים שהופעלו</span>
                      <span>-₪{(appliedCredits.totalCreditsAppliedCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-2 mt-1">
                      <span>לתשלום במזומן</span>
                      <span className="text-emerald-600">₪{(appliedCredits.cashDueCents / 100).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-3">התשלום יתואם לאחר ההזמנה.</p>
            </section>

            <WalletCheckoutPreview
              subtotalCents={Math.round(pricing.totalCharged * 100)}
              divisionCode="petsitter"
            />

            {user && (
              <CreditWalletCard
                userId={user.uid}
                platform="sitter"
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
              <PrestigePassPaymentOption
                bookingId={bookingId || `PENDING-SITTER-${user.uid.slice(0, 8)}`}
                serviceType="pet_sitter"
                amountGross={Math.round(pricing.totalCharged * 100)}
              />
            )}

            {/* Payment Method Disclosure */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4 font-semibold text-slate-900 text-sm">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                אמצעי תשלום
              </div>
              
              {PAYMENTS_CONFIG.enableCreditCard && !PAYMENTS_CONFIG.enableNayax && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">כרטיס אשראי שמור</div>
                    <div className="text-xs text-slate-500">החיוב יתבצע רק לאחר סיום השירות</div>
                  </div>
                  <Lock className="h-4 w-4 text-slate-300 ml-auto" />
                </div>
              )}

              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex gap-3">
                <Shield className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800 leading-relaxed">
                  <span className="font-semibold block mb-1">הגנת ⁦Pet Wash™⁩</span>
                  {PAYMENTS_CONFIG.escrowMessage.he} הכרטיס שלך לא יחויב כעת.
                </div>
              </div>
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

        {/* Step 3: Pending Match */}
        {step === "pending_match" && (
          <div className="text-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative mx-auto w-32 h-32">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-20" />
              <div className="relative w-32 h-32 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">מחפשים התאמה...</h2>
              <p className="text-slate-500 max-w-sm mx-auto">
                שלחנו את הבקשה שלך ל{sitter.firstName}.
                <br />
                זה לוקח בדרך כלל כמה רגעים.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm max-w-sm mx-auto">
              <div className="flex items-center gap-4 text-right" dir="rtl">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">ממתינים לאישור</div>
                  <div className="text-sm text-slate-500">השמרטף/ית בודק/ת את הפרטים</div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic">
              ניתן לסגור את הדף, תקבל/י עדכון ב-SMS כשההזמנה תאושר
            </p>
          </div>
        )}

        {/* Step 4: Confirmation */}
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

            {/* What happens next section */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-8 text-right max-w-md mx-auto">
              <h3 className="text-emerald-900 font-semibold mb-3 flex items-center justify-end gap-2">
                <Clock className="h-4 w-4" />
                מה קורה עכשיו?
              </h3>
              <p className="text-emerald-800 text-sm leading-relaxed">
                השמרטף שלך אישר! תקבל את כל הפרטים ב-SMS ובמייל.
              </p>
            </div>

            <div className="flex flex-col gap-3 max-w-md mx-auto mb-8">
              <Button
                className="h-14 px-12 rounded-xl text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg touch-manipulation"
                onClick={() => setLocation(`/booking-chat/${bookingId}`)}
                data-testid="button-message-sitter"
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                {isHebrew ? 'שלח הודעה לשמרטף' : 'Message your sitter'}
              </Button>
              <Button
                variant="outline"
                className="h-12 px-12 rounded-xl text-base font-semibold border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm touch-manipulation"
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
