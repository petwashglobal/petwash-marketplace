import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod } from "@/lib/paymentConfig";

type BookingStep = "details" | "summary" | "confirmation";

export default function K9000BookingFlow() {
  const { stationId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const stationIdNumber = stationId ? parseInt(stationId) : undefined;

  const [step, setStep] = useState<BookingStep>("details");
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<number | undefined>(stationIdNumber);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Fetch specific station or all stations
  const { data: stationData, isLoading: stationLoading } = useQuery({
    queryKey: stationIdNumber ? [`/api/platforms/k9000/stations/${stationIdNumber}`] : ['/api/platforms/k9000/stations'],
    enabled: true,
  });

  // Fetch user's pets from real API
  const { data: petsData, isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: step === 'details',
  });

  // Handle both single station and list of stations
  const stations = Array.isArray(stationData) ? stationData : (stationData?.station ? [stationData.station] : []);
  const selectedStation = stationIdNumber && stationData?.station ? stationData.station : stations.find((s: any) => s.id === selectedStationId);
  const pets = Array.isArray(petsData) ? petsData : (petsData?.pets || []);

  // Calculate pricing using VAT calculator (₪45 fixed for K9000 wash)
  const baseAmount = 45;
  const pricing = useMemo(() => {
    return vatCalculator.calculateVAT(baseAmount);
  }, [baseAmount]);

  const canContinueDetails = useMemo(() => {
    return (
      !!selectedStationId &&
      selectedPetIds.length > 0 &&
      !!selectedDate
    );
  }, [selectedStationId, selectedPetIds, selectedDate]);

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
    if (!selectedDate || !selectedStation) return;

    try {
      setIsSubmitting(true);

      const endTime = new Date(selectedDate);
      endTime.setMinutes(endTime.getMinutes() + 30); // 30-minute wash

      const payload = {
        stationId: selectedStationId,
        startTime: selectedDate.toISOString(),
        endTime: endTime.toISOString(),
        petIds: selectedPetIds,
        items: [
          {
            itemType: 'service',
            name: 'K9000 Self-Service Wash',
            nameHe: 'שטיפה עצמית K9000',
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
          stationName: selectedStation.name,
          stationAddress: selectedStation.address,
          paymentMethod: getActivePaymentMethod(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const response = await apiRequest('POST', '/api/platforms/k9000/bookings', payload);
      const booking = await response.json();

      setBookingId(booking.booking?.id || booking.id || booking.bookingNumber || 'pending');
      setStep("confirmation");

      toast({
        title: "הזמנה נקלטה בהצלחה! 🐾",
        description: "התור נשמר. התשלום יתבצע בתחנה.",
      });
    } catch (error: any) {
      toast({
        title: "שגיאה ביצירת הזמנה",
        description: error.message || "אירעה שגיאה. נסה/י שוב.",
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
  if (stationLoading || petsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
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
            onClick={() => setLocation("/locations")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה לתחנות
          </button>

          <h1 className="luxury-heading-md luxury-text-gradient" data-testid="page-title">
            הזמנת ⁦K9000™⁩
          </h1>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-8 luxury-fade-in">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'details' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white luxury-shadow-lg' : step === 'summary' || step === 'confirmation' ? 'luxury-gradient-border bg-white text-purple-600' : 'bg-gray-100 text-slate-500'}`}>
            1
          </div>
          <div className={`h-1 w-16 rounded-full ${step === 'summary' || step === 'confirmation' ? 'luxury-bg-primary' : 'bg-gray-100'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'summary' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white luxury-shadow-lg' : step === 'confirmation' ? 'luxury-gradient-border bg-white text-purple-600' : 'bg-gray-100 text-slate-500'}`}>
            2
          </div>
          <div className={`h-1 w-16 rounded-full ${step === 'confirmation' ? 'luxury-bg-primary' : 'bg-gray-100'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === 'confirmation' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white luxury-shadow-lg' : 'bg-gray-100 text-slate-500'}`}>
            3
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Station Selection */}
            {!stationIdNumber && (
              <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
                <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-500" />
                  בחירת תחנה
                </div>
                {stations.length === 0 ? (
                  <div className="luxury-text-body text-center py-4">
                    אין תחנות זמינות. נסה/י מאוחר יותר.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {stations.map((station: any) => {
                      const active = selectedStationId === station.id;
                      return (
                        <button
                          key={station.id}
                          type="button"
                          onClick={() => setSelectedStationId(station.id)}
                          className={`luxury-badge ${active ? 'luxury-badge-active' : ''}`}
                          data-testid={`button-station-${station.id}`}
                        >
                          <div className="font-semibold">{station.name}</div>
                          <div className="text-xs opacity-80">{station.address}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Pet Selection */}
            <section className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm flex items-center gap-2">
                <PawPrint className="h-5 w-5 text-purple-500" />
                חיות לשטיפה
              </div>
              {pets.length === 0 ? (
                <div className="text-center py-4 space-y-3">
                  <p className="luxury-text-body">אין חיות מחמד ברשומה.</p>
                  <button
                    type="button"
                    onClick={() => setLocation('/pets')}
                    className="rounded-full px-5 py-3 min-h-[44px] text-sm font-medium luxury-btn-primary shadow-md transition-all"
                  >
                    + הוסף חיית מחמד
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {pets.map((pet: any) => {
                    const active = selectedPetIds.includes(pet.id);
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => togglePet(pet.id)}
                        className={`luxury-badge ${active ? 'luxury-badge-active' : ''}`}
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
              <div className="mb-4 luxury-heading-sm">
                מועד שטיפה
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
              <div className="mb-3 luxury-heading-sm">
                הערות (אופציונלי)
              </div>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="luxury-glass-minimal w-full resize-none px-4 py-3 text-sm"
                placeholder="גודל כלב, רגישויות, העדפות, וכו׳"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-stagger-item p-6">
              <div className="mb-3 flex items-center justify-between luxury-text-body">
                <span>מחיר השטיפה</span>
                <span>₪{pricing.grossCollectedILS.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between luxury-text-small opacity-70 pl-3 border-l-2 border-purple-100">
                <span>כולל עמלת PetWash (15%)</span>
                <span>₪{pricing.commission.toFixed(2)}</span>
              </div>
              <div className="mb-4 flex items-center justify-between luxury-text-small opacity-70 pl-3 border-l-2 border-purple-100">
                <span>מהם מע״מ (18/118)</span>
                <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
                <span className="luxury-heading-sm">סה״כ לחיוב</span>
                <span className="luxury-heading-lg luxury-text-gradient">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-4 luxury-text-small leading-relaxed opacity-80">
                <Shield className="h-4 w-4 inline mr-1 text-purple-500" />
                התשלום מתבצע בתחנה. ההזמנה מבטיחה זמינות התחנה.
              </div>
            </div>

            {/* Continue Button */}
            <button
              className="luxury-btn-primary luxury-shadow-xl w-full h-14 luxury-stagger-item"
              disabled={!canContinueDetails}
              onClick={handleNextFromDetails}
              data-testid="button-continue"
            >
              המשך לאישור
            </button>
          </>
        )}

        {/* Step 2: Summary */}
        {step === "summary" && (
          <>
            <h2 className="luxury-heading-md mb-8 luxury-fade-in">סיכום הזמנה</h2>
            
            <div className="mb-6 luxury-glass-card luxury-shadow-xl luxury-stagger-item p-6 space-y-3">
              <div className="luxury-heading-sm">
                ⁦K9000™⁩ - {selectedStation?.name || "תחנת שטיפה"}
              </div>
              <div className="luxury-text-body">
                תאריך: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="luxury-text-body">
                כתובת: {selectedStation?.address || "-"}
              </div>
              <div className="luxury-text-body">
                חיות: {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
              </div>
            </div>

            <div className="mb-8 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-stagger-item p-6">
              <div className="mb-4 luxury-heading-sm">פירוט מחיר</div>
              <div className="mb-2 flex items-center justify-between luxury-text-small">
                <span>מחיר השטיפה</span>
                <span>₪{pricing.grossCollectedILS.toFixed(2)}</span>
              </div>
              <div className="mb-4 flex items-center justify-between luxury-text-small opacity-70 pl-3 border-l-2 border-purple-100">
                <span>כולל עמלת PetWash + מע״מ</span>
                <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
                <span className="luxury-heading-sm">סה״כ</span>
                <span className="luxury-heading-lg luxury-text-gradient">₪{pricing.totalCharged.toFixed(2)}</span>
              </div>
              <div className="mt-4 luxury-text-small opacity-80">
                התשלום יתבצע בתחנה.
              </div>
            </div>

            <div className="flex gap-4 luxury-stagger-item">
              <button
                className="luxury-btn-secondary flex-1 h-14"
                onClick={() => setStep("details")}
                data-testid="button-back-summary"
              >
                חזרה
              </button>
              <button
                className="luxury-btn-primary luxury-shadow-xl flex-1 h-14"
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                data-testid="button-confirm"
              >
                {isSubmitting ? "שולח..." : "אישור והמשך"}
              </button>
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
              התור שלך נשמר. מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="luxury-text-small max-w-md mx-auto mb-8">
              התשלום יתבצע בתחנה.
            </p>
            <button
              className="luxury-btn-primary luxury-shadow-xl px-12"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-dashboard"
            >
              חזרה ללוח הבקרה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
