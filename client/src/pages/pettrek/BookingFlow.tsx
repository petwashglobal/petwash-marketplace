import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";

type BookingStep = "details" | "summary" | "confirmation";

export default function PetTrekBookingFlow() {
  const { driverId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [estimatedDistance, setEstimatedDistance] = useState(18); // km
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Fetch pets from real API
  const { data: petsData, isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: step === 'details',
  });

  const pets = Array.isArray(petsData) ? petsData : (petsData?.pets || []);

  // Calculate pricing using VAT calculator (₪8/km base rate for PetTrek)
  const baseAmount = useMemo(() => {
    return estimatedDistance * 8;
  }, [estimatedDistance]);

  const pricing = useMemo(() => {
    return vatCalculator.calculateVAT(baseAmount);
  }, [baseAmount]);

  const canContinueDetails = useMemo(() => {
    return (
      selectedPetIds.length > 0 &&
      !!selectedDate &&
      pickupAddress.trim().length > 5 &&
      dropoffAddress.trim().length > 5
    );
  }, [selectedPetIds, selectedDate, pickupAddress, dropoffAddress]);

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
    if (!selectedDate) return;

    try {
      setIsSubmitting(true);

      const payload = {
        platform: "pettrek",
        providerId: driverId || "auto-assign",
        startTime: selectedDate.toISOString(),
        petIds: selectedPetIds,
        items: [
          {
            itemType: 'service',
            name: 'Pet Transport Service',
            nameHe: 'שירות הסעת חיות מחמד',
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
          pickupAddress,
          dropoffAddress,
          estimatedDistance,
          paymentMethod: 'nayax',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const booking = await apiRequest(`/api/bookings/create`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setBookingId(booking.id || booking.bookingNumber || 'pending');
      setStep("confirmation");

      toast({
        title: "הזמנה נקלטה בהצלחה! 🚗",
        description: "הנהג/ת יקבל/תקבל הודעה. החיוב מתבצע רק דרך Nayax Israel.",
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
  if (petsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-600 font-light">טוען נתונים...</p>
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
            onClick={() => setLocation("/pettrek")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה ל-PetTrek
          </Button>

          <h1 className="text-2xl font-light text-slate-900" data-testid="page-title">
            הזמנת הסעה - PetTrek™
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Route */}
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-500" />
                מסלול נסיעה
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">כתובת איסוף</label>
                  <Input
                    value={pickupAddress}
                    onChange={e => setPickupAddress(e.target.value)}
                    placeholder="רחוב, מספר, עיר"
                    className="rounded-xl border-slate-200 bg-white"
                    data-testid="input-pickup"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">כתובת יעד</label>
                  <Input
                    value={dropoffAddress}
                    onChange={e => setDropoffAddress(e.target.value)}
                    placeholder="רחוב, מספר, עיר"
                    className="rounded-xl border-slate-200 bg-white"
                    data-testid="input-dropoff"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">מרחק משוער (ק״מ)</label>
                  <Input
                    type="number"
                    value={estimatedDistance}
                    onChange={e => setEstimatedDistance(Math.max(1, Number(e.target.value) || 1))}
                    min={1}
                    className="rounded-xl border-slate-200 bg-white"
                    data-testid="input-distance"
                  />
                </div>
              </div>
            </section>

            {/* Pet Selection */}
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-amber-500" />
                חיות מחמד להסעה
              </div>
              {pets.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
                  אין חיות מחמד. הוסף/י חיה לפרופיל שלך.
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
                            ? "bg-amber-500 text-white shadow-md"
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
              <div className="mb-3 text-sm font-semibold text-slate-700">
                מועד איסוף
              </div>
              <MobileDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                minDate={new Date()}
                includeTime={true}
                label=""
              />
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
                placeholder="נושא רגיש, ציוד מיוחד, הנחיות נוספות"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
                <span>סכום בסיס (₪8/ק״מ)</span>
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
              <div className="pt-3 border-t border-amber-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ לחיוב</span>
                <span className="text-2xl font-bold text-amber-600">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-600 leading-relaxed">
                <Shield className="h-3 w-3 inline mr-1 text-amber-500" />
                החיוב מתבצע אך ורק דרך Nayax Israel. הכסף מוחזק ב-escrow ל-72 שעות להגנת שני הצדדים. התשלום משוחרר לנהג/ת לאחר סיום ההסעה.
              </div>
            </div>

            {/* Continue Button */}
            <Button
              className="w-full h-12 rounded-2xl bg-amber-500 text-white text-base font-semibold shadow-lg hover:bg-amber-600"
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
                הסעה - PetTrek™
              </div>
              <div className="text-slate-600">
                מועד איסוף: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="text-slate-600">
                מסלול: {pickupAddress} → {dropoffAddress}
              </div>
              <div className="text-slate-600">
                מרחק: {estimatedDistance} ק״מ
              </div>
              <div className="text-slate-600">
                חיות: {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
              <div className="mb-1 text-xs font-semibold text-slate-700">פירוט מחיר</div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>עמלה + מע״מ</span>
                <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ</span>
                <span className="text-xl font-bold text-amber-600">₪{pricing.totalCharged.toFixed(2)}</span>
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
                className="flex-1 h-12 rounded-2xl bg-amber-500 text-white text-sm font-semibold shadow-lg hover:bg-amber-600"
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
            <div className="w-20 h-20 rounded-full bg-amber-100 mx-auto flex items-center justify-center mb-4">
              <Check className="h-10 w-10 text-amber-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-slate-900">ההזמנה נקלטה בהצלחה!</h2>
            <p className="text-slate-600 max-w-sm mx-auto mb-2">
              הנהג/ת יקבל/תקבל את פרטי ההזמנה. מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              פרטי חיוב Nayax ומעקב GPS ישלחו בהודעה נפרדת.
            </p>
            <Button
              className="rounded-2xl px-8 bg-amber-500 text-white shadow-lg hover:bg-amber-600"
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
