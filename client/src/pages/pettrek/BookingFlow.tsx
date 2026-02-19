import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod } from "@/lib/paymentConfig";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";

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
          paymentMethod: getActivePaymentMethod(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const response = await apiRequest('POST', '/api/bookings/create', payload);
      const booking = await response.json();

      setBookingId(booking.booking?.id || booking.id || booking.bookingNumber || 'pending');
      setStep("confirmation");

      toast({
        title: "הזמנה נקלטה בהצלחה! 🚗",
        description: "הנהג/ת יקבל/תקבל הודעה. התשלום יתואם לאחר ההזמנה.",
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
    <div className="min-h-screen luxury-bg-mesh">
      {/* Header */}
      <div className="luxury-glass-panel border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <button
            className="luxury-btn-ghost mb-4"
            onClick={() => setLocation("/pettrek")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה ל-PetTrek
          </button>

          <h1 className="luxury-heading-md luxury-text-gradient" data-testid="page-title">
            הזמנת הסעה - ⁦PetTrek™⁩
          </h1>
        </div>
      </div>

      {/* 24/7 Availability Banner */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-3 border border-amber-200/50 text-center">
          <p className="text-sm text-amber-800 font-medium">
            🚗 הסעות VIP 24/7 כל השנה
          </p>
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
            {/* Route */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-500" />
                מסלול נסיעה
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">כתובת איסוף</label>
                  <GooglePlacesAutocomplete
                    value={pickupAddress}
                    onChange={(value, details) => {
                      setPickupAddress(value);
                    }}
                    placeholder="רחוב, מספר, עיר"
                    country={['il', 'us', 'gb', 'au', 'ca']}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">כתובת יעד</label>
                  <GooglePlacesAutocomplete
                    value={dropoffAddress}
                    onChange={(value, details) => {
                      setDropoffAddress(value);
                    }}
                    placeholder="רחוב, מספר, עיר"
                    country={['il', 'us', 'gb', 'au', 'ca']}
                    className="rounded-xl"
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
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-amber-500" />
                חיות מחמד להסעה
              </div>
              {pets.length === 0 ? (
                <div className="luxury-text-body text-center py-4">
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
                        className={`rounded-full px-5 py-3 min-h-[44px] text-sm transition-all touch-manipulation ${
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
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-3 text-sm font-semibold text-slate-700">
                מועד איסוף
              </div>
              <MobileDatePicker
                value={selectedDate || undefined}
                onChange={(date) => setSelectedDate(date)}
                minDate={new Date()}
                includeTime={true}
                label=""
              />
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
                placeholder="נושא רגיש, ציוד מיוחד, הנחיות נוספות"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-stagger-item p-6">
              <div className="mb-3 flex items-center justify-between luxury-text-body">
                <span>סכום בסיס (₪8/ק״מ)</span>
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
                <Shield className="h-3 w-3 inline mr-1 text-amber-500" />
                הכסף מוחזק ב-escrow ל-72 שעות להגנת שני הצדדים. התשלום משוחרר לנהג/ת לאחר סיום ההסעה.
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
                הסעה - ⁦PetTrek™⁩
              </div>
              <div className="luxury-text-body">
                מועד איסוף: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="luxury-text-body">
                מסלול: {pickupAddress} → {dropoffAddress}
              </div>
              <div className="luxury-text-body">
                מרחק: {estimatedDistance} ק״מ
              </div>
              <div className="luxury-text-body">
                חיות: {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
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
              הנהג/ת יקבל/תקבל את פרטי ההזמנה. מספר הזמנה: {bookingId || "בבדיקה"}
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
