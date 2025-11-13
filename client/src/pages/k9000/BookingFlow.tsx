import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";

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
          paymentMethod: 'nayax-onsite',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const booking = await apiRequest(`/api/platforms/k9000/bookings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setBookingId(booking.id || booking.bookingNumber || 'pending');
      setStep("confirmation");

      toast({
        title: "הזמנה נקלטה בהצלחה! 🐾",
        description: "התור נשמר. התשלום יתבצע בתחנה דרך Nayax.",
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            className="mb-4 text-slate-600 font-light"
            onClick={() => setLocation("/locations")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            חזרה לתחנות
          </Button>

          <h1 className="text-2xl font-light text-slate-900" data-testid="page-title">
            הזמנת K9000™
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* Step 1: Details */}
        {step === "details" && (
          <>
            {/* Station Selection */}
            {!stationIdNumber && (
              <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-900" />
                  בחירת תחנה
                </div>
                {stations.length === 0 ? (
                  <div className="text-sm text-slate-500 text-center py-4">
                    אין תחנות זמינות. נסה/י מאוחר יותר.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stations.map((station: any) => {
                      const active = selectedStationId === station.id;
                      return (
                        <button
                          key={station.id}
                          type="button"
                          onClick={() => setSelectedStationId(station.id)}
                          className={`rounded-xl px-4 py-3 text-sm transition-all border ${
                            active
                              ? "bg-slate-900 text-white shadow-md border-slate-900"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
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
            <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-slate-900" />
                חיות לשטיפה
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
                            ? "bg-slate-900 text-white shadow-md"
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
                מועד שטיפה
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
                placeholder="גודל כלב, רגישויות, העדפות, וכו׳"
                data-testid="textarea-notes"
              />
            </section>

            {/* Pricing Summary */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
              <div className="pt-3 border-t border-slate-300 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ לחיוב</span>
                <span className="text-2xl font-bold text-slate-900">
                  ₪{pricing.totalCharged.toFixed(2)}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-600 leading-relaxed">
                <Shield className="h-3 w-3 inline mr-1 text-slate-900" />
                התשלום מתבצע בתחנה דרך Nayax Israel בלבד. ההזמנה מבטיחה זמינות התחנה.
              </div>
            </div>

            {/* Continue Button */}
            <Button
              className="w-full h-12 rounded-2xl bg-slate-900 text-white text-base font-semibold shadow-lg hover:bg-slate-800"
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
                K9000™ - {selectedStation?.name || "תחנת שטיפה"}
              </div>
              <div className="text-slate-600">
                תאריך: {selectedDate ? selectedDate.toLocaleString("he-IL") : "-"}
              </div>
              <div className="text-slate-600">
                כתובת: {selectedStation?.address || "-"}
              </div>
              <div className="text-slate-600">
                חיות: {pets.filter((p: any) => selectedPetIds.includes(p.id)).map((p: any) => p.name).join(", ")}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-semibold text-slate-700">פירוט מחיר</div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>סכום בסיס</span>
                <span>₪{pricing.baseAmount.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>עמלה + מע״מ</span>
                <span>₪{(pricing.commission + pricing.vatOnCommission).toFixed(2)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-300 flex items-center justify-between">
                <span className="font-semibold text-slate-900">סה״כ</span>
                <span className="text-xl font-bold text-slate-900">₪{pricing.totalCharged.toFixed(2)}</span>
              </div>
              <div className="mt-3 text-[10px] text-slate-600">
                התשלום בתחנה דרך Nayax Israel בלבד.
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
                className="flex-1 h-12 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-lg hover:bg-slate-800"
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
            <div className="w-20 h-20 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
              <Check className="h-10 w-10 text-slate-900" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-slate-900">ההזמנה נקלטה בהצלחה!</h2>
            <p className="text-slate-600 max-w-sm mx-auto mb-2">
              התור שלך נשמר. מספר הזמנה: {bookingId || "בבדיקה"}
            </p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              התשלום יתבצע בתחנה דרך Nayax.
            </p>
            <Button
              className="rounded-2xl px-8 bg-slate-900 text-white shadow-lg hover:bg-slate-800"
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
