import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Shield, PawPrint, Clock, Check, Users, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { vatCalculator } from "@/lib/vatCalculator";
import { getActivePaymentMethod } from "@/lib/paymentConfig";
import { WeatherConsentDialog, useWeatherConsent } from "@/components/weather/WeatherConsentDialog";
import { OwnerInstructionsForm, useOwnerInstructions } from "@/components/booking/OwnerInstructionsForm";

type BookingStep = "details" | "summary" | "weather_consent" | "pending_match" | "confirmation";

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
  const [showWeatherConsent, setShowWeatherConsent] = useState(false);
  const [weatherConsentAccepted, setWeatherConsentAccepted] = useState(false);
  const [weatherConditions, setWeatherConditions] = useState<string[]>([]);
  const { instructions: ownerInstructions, setInstructions: setOwnerInstructions } = useOwnerInstructions();

  // Check if weather consent is needed for the selected date
  const { data: weatherCheck } = useWeatherConsent(selectedDate);

  // Simulate provider acceptance for two-way matching
  // In production, this would be replaced by real-time WebSocket/polling for provider response
  useEffect(() => {
    if (step === 'pending_match' && bookingId) {
      // Simulate provider accepting the job after 3-5 seconds
      const acceptanceDelay = 3000 + Math.random() * 2000;
      const timer = setTimeout(() => {
        setStep('confirmation');
        toast({
          title: "יש התאמה! 🎉",
          description: "המוליך/ה אישר/ה את הבקשה. ההזמנה מאושרת!",
        });
      }, acceptanceDelay);
      
      return () => clearTimeout(timer);
    }
  }, [step, bookingId, toast]);

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
    
    // Check if weather consent is needed for adverse conditions
    if (weatherCheck?.needsConsent && !weatherConsentAccepted) {
      setShowWeatherConsent(true);
      return;
    }
    
    setStep("summary");
  }
  
  function handleWeatherConsent(accepted: boolean, conditions: string[]) {
    if (accepted) {
      setWeatherConsentAccepted(true);
      setWeatherConditions(conditions);
      setStep("summary");
    } else {
      toast({
        title: "הזמנה בוטלה",
        description: "ניתן לבחור תאריך אחר עם תנאי מזג אוויר טובים יותר",
      });
    }
  }

  async function handleConfirmBooking() {
    if (!walker || !selectedDate || !walkerIdNumber) return;

    try {
      setIsSubmitting(true);

      const scheduledDate = selectedDate.toISOString().split('T')[0];
      const scheduledStartTime = selectedDate.toTimeString().slice(0, 5);

      const payload = {
        walkerId: walker.walkerId || `WALKER-${walkerIdNumber}`,
        scheduledDate,
        scheduledStartTime,
        durationMinutes: duration,
        pickupLatitude: walker.latitude || 32.0853,
        pickupLongitude: walker.longitude || 34.7818,
        pickupAddress: walker.serviceArea || 'Tel Aviv, Israel',
        petName: 'My Pet',
        petBreed: 'Mixed',
        petWeight: 15,
        petSpecialNeeds: notes || '',
        notes,
        petIds: selectedPetIds,
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
        },
        // Two-way matching: requires provider approval
        requiresProviderApproval: true,
        // Weather consent data (if applicable)
        weatherConsent: weatherConsentAccepted ? {
          customerAccepted: true,
          acceptedAt: new Date().toISOString(),
          conditions: weatherConditions,
          adverseWeather: weatherCheck?.weather?.isAdverse || false,
          adverseReason: weatherCheck?.weather?.adverseReason || null
        } : null,
        // Owner instructions (only if consent given)
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
        } : null
      };

      const response = await apiRequest('POST', '/api/walks/book', payload);
      const booking = await response.json();

      setBookingId(booking.booking?.id || booking.id || booking.bookingNumber || 'pending');
      
      // Show pending match step for two-way consent (like Uber/Tinder matching)
      setStep("pending_match");

      toast({
        title: "בקשת הליכה נשלחה! 🐾",
        description: "ממתינים לאישור המוליך/ה. תקבל/י התראה כשיהיה התאמה.",
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

      {/* 24/7 Availability Banner */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl p-3 border border-emerald-200/50 text-center">
          <p className="text-sm text-emerald-800 font-medium">
            🐾 שירות 24/7 כל השנה
          </p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 luxury-fade-in">
          {/* Step 1: Details */}
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${step === 'details' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white luxury-shadow-lg' : ['summary', 'pending_match', 'confirmation'].includes(step) ? 'luxury-gradient-border bg-white text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
            1
          </div>
          <div className={`h-1 w-8 sm:w-12 rounded-full ${['summary', 'pending_match', 'confirmation'].includes(step) ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
          {/* Step 2: Summary */}
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${step === 'summary' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white luxury-shadow-lg' : ['pending_match', 'confirmation'].includes(step) ? 'luxury-gradient-border bg-white text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
            2
          </div>
          <div className={`h-1 w-8 sm:w-12 rounded-full ${['pending_match', 'confirmation'].includes(step) ? 'bg-amber-500' : 'bg-slate-200'}`}></div>
          {/* Step 3: Matching */}
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${step === 'pending_match' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white luxury-shadow-lg animate-pulse' : step === 'confirmation' ? 'luxury-gradient-border bg-white text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
            3
          </div>
          <div className={`h-1 w-8 sm:w-12 rounded-full ${step === 'confirmation' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
          {/* Step 4: Confirmed */}
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${step === 'confirmation' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white luxury-shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
            4
          </div>
        </div>
        {/* Step Labels */}
        <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
          <span className={step === 'details' ? 'text-blue-600 font-medium' : ''}>פרטים</span>
          <span className={step === 'summary' ? 'text-blue-600 font-medium' : ''}>סיכום</span>
          <span className={step === 'pending_match' ? 'text-amber-600 font-medium' : ''}>התאמה</span>
          <span className={step === 'confirmation' ? 'text-emerald-600 font-medium' : ''}>אישור</span>
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
                        className={`rounded-full px-5 py-3 min-h-[44px] text-sm transition-all touch-manipulation ${
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
                value={selectedDate || undefined}
                onChange={(date) => setSelectedDate(date)}
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

            {/* Owner Instructions (codes, locations, etc.) */}
            <OwnerInstructionsForm
              value={ownerInstructions}
              onChange={setOwnerInstructions}
              className="mb-6 luxury-shadow-xl luxury-stagger-item"
            />

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

        {/* Step 3: Pending Match (Two-Way Consent - Like Uber/Tinder) */}
        {step === "pending_match" && (
          <div className="text-center py-12 luxury-fade-in">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 mx-auto flex items-center justify-center mb-6 luxury-shadow-xl animate-pulse">
              <Handshake className="h-12 w-12 text-white" />
            </div>
            <h2 className="luxury-heading-lg mb-4">ממתינים להתאמה...</h2>
            <p className="luxury-text-body max-w-md mx-auto mb-3">
              הבקשה נשלחה ל{walker?.businessName || walker?.displayName || 'המוליך/ה'}
            </p>
            <p className="luxury-text-small max-w-md mx-auto mb-4">
              מספר בקשה: {bookingId || "בבדיקה"}
            </p>
            
            {/* Matching Animation */}
            <div className="flex items-center justify-center gap-4 my-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border-2 border-blue-300">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center border-2 border-emerald-300">
                <PawPrint className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            
            <div className="luxury-glass-card p-4 max-w-sm mx-auto mb-6">
              <p className="luxury-text-small text-amber-700">
                כמו Uber - שני הצדדים צריכים לאשר. המוליך/ה יקבל/תקבל התראה ויוכל/תוכל לאשר או לסרב. 
                תקבל/י עדכון בהודעה כשיהיה התאמה!
              </p>
            </div>
            
            {weatherConsentAccepted && (
              <div className="luxury-glass-card p-3 max-w-sm mx-auto mb-6 border border-amber-200 bg-amber-50/50">
                <p className="luxury-text-small text-amber-800 flex items-center justify-center gap-2">
                  <Shield className="h-4 w-4" />
                  הסכמה לתנאי מזג אוויר נרשמה
                </p>
              </div>
            )}
            
            <Button
              className="luxury-btn-primary luxury-shadow-xl px-12"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-dashboard"
            >
              חזרה ללוח הבקרה
            </Button>
          </div>
        )}

        {/* Step 4: Confirmation (After Match) */}
        {step === "confirmation" && (
          <div className="text-center py-12 luxury-fade-in">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 mx-auto flex items-center justify-center mb-6 luxury-shadow-xl">
              <Check className="h-12 w-12 text-white" />
            </div>
            <h2 className="luxury-heading-lg mb-4">יש התאמה! 🎉</h2>
            <p className="luxury-text-body max-w-md mx-auto mb-3">
              {walker?.businessName || walker?.displayName || 'המוליך/ה'} אישר/ה את ההזמנה!
            </p>
            <p className="luxury-text-small max-w-md mx-auto mb-8">
              מספר הזמנה: {bookingId || "בבדיקה"} · פרטי התשלום ומעקב GPS ישלחו בהודעה נפרדת.
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
      
      {/* Weather Consent Dialog */}
      <WeatherConsentDialog
        open={showWeatherConsent}
        onOpenChange={setShowWeatherConsent}
        onConsent={handleWeatherConsent}
        walkerName={walker?.businessName || walker?.displayName || 'המוליך/ה'}
        scheduledDate={selectedDate || new Date()}
      />
    </div>
  );
}
