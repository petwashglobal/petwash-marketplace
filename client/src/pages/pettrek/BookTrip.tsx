import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { 
  MapPin, 
  Navigation,
  Shield, 
  Heart, 
  Star,
  CheckCircle2,
  Dog,
  Cat,
  Phone,
  Award,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Zap,
  Route,
  Clock
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useLocation } from "wouter";
import { vatCalculator } from "@/lib/vatCalculator";

interface FareEstimate {
  estimatedFare: number;
  driverPayout: number;
  platformCommission: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  breakdown: {
    distanceKm: number;
    estimatedMinutes: number;
    isPeakTime: boolean;
    surgeMultiplier: number;
  };
}

interface LocationCoords {
  address: string;
  lat: number;
  lng: number;
}

export default function BookTrip() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  const [currentStep, setCurrentStep] = useState(1);
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [isFetchingFare, setIsFetchingFare] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);

  const [selectedPetType, setSelectedPetType] = useState<string>('');
  const [petName, setPetName] = useState('');
  const [petSize, setPetSize] = useState<string>('medium');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('transport');
  const [specialNotes, setSpecialNotes] = useState('');

  const [pickup, setPickup] = useState<LocationCoords | null>(null);
  const [dropoff, setDropoff] = useState<LocationCoords | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  const handlePickupSelect = useCallback((value: string, details?: PlaceDetails) => {
    setPickupAddress(value);
    if (details?.lat && details?.lng) {
      setPickup({ address: value, lat: details.lat, lng: details.lng });
    }
  }, []);

  const handleDropoffSelect = useCallback((value: string, details?: PlaceDetails) => {
    setDropoffAddress(value);
    if (details?.lat && details?.lng) {
      setDropoff({ address: value, lat: details.lat, lng: details.lng });
    }
  }, []);

  const canGetFare = useMemo(() => {
    return pickup && dropoff && selectedPetType && petName.trim().length > 0;
  }, [pickup, dropoff, selectedPetType, petName]);

  const pricing = useMemo(() => {
    if (!fareEstimate) return null;
    return vatCalculator.calculateVAT(fareEstimate.estimatedFare);
  }, [fareEstimate]);

  async function fetchFareEstimate() {
    if (!pickup || !dropoff) return;
    setIsFetchingFare(true);
    try {
      let scheduledTime: string | undefined;
      if (selectedDate && selectedTime) {
        const [h, m] = selectedTime.split(':').map(Number);
        const d = new Date(selectedDate);
        d.setHours(h, m, 0, 0);
        scheduledTime = d.toISOString();
      }

      const response = await apiRequest('POST', '/api/pettrek/fare-estimate', {
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        dropoffLatitude: dropoff.lat,
        dropoffLongitude: dropoff.lng,
        scheduledPickupTime: scheduledTime,
      });
      const data = await response.json();
      setFareEstimate(data);
      setCurrentStep(2);
    } catch (error: any) {
      toast({
        title: isHebrew ? 'שגיאה בחישוב מחיר' : 'Failed to estimate fare',
        description: error.message || (isHebrew ? 'נסה שוב' : 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsFetchingFare(false);
    }
  }

  async function handleBookTrip() {
    if (!pickup || !dropoff || !fareEstimate || !user) {
      toast({
        title: isHebrew ? 'נא להתחבר' : 'Please sign in',
        description: isHebrew ? 'יש להתחבר כדי להזמין נסיעה' : 'Sign in to book a trip',
        variant: 'destructive',
      });
      return;
    }
    setIsBooking(true);
    try {
      let scheduledPickupTime = new Date();
      if (selectedDate && selectedTime) {
        const [h, m] = selectedTime.split(':').map(Number);
        scheduledPickupTime = new Date(selectedDate);
        scheduledPickupTime.setHours(h, m, 0, 0);
      }

      const response = await apiRequest('POST', '/api/pettrek/request-trip', {
        petName,
        petType: selectedPetType,
        petSize,
        specialInstructions: specialNotes || '',
        serviceType: selectedServiceType,
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        pickupAddress: pickup.address,
        dropoffLatitude: dropoff.lat,
        dropoffLongitude: dropoff.lng,
        dropoffAddress: dropoff.address,
        scheduledPickupTime: scheduledPickupTime.toISOString(),
      });
      const data = await response.json();
      setTripId(data.trip?.tripId || data.tripId || 'confirmed');
      setBookingComplete(true);
      setCurrentStep(3);
      toast({
        title: isHebrew ? 'הנסיעה הוזמנה!' : 'Trip booked!',
        description: isHebrew ? 'נהג ייצור איתך קשר בקרוב' : 'A driver will contact you soon',
      });
    } catch (error: any) {
      toast({
        title: isHebrew ? 'שגיאה בהזמנה' : 'Booking failed',
        description: error.message || (isHebrew ? 'נסה שוב' : 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsBooking(false);
    }
  }

  const petTypes = [
    { id: 'dog', icon: Dog, label: isHebrew ? 'כלב' : 'Dog' },
    { id: 'cat', icon: Cat, label: isHebrew ? 'חתול' : 'Cat' },
    { id: 'other', icon: Heart, label: isHebrew ? 'אחר' : 'Other' }
  ];

  const petSizes = [
    { id: 'small', label: isHebrew ? 'קטן (עד 10 ק"ג)' : 'Small (up to 10kg)' },
    { id: 'medium', label: isHebrew ? 'בינוני (10-25 ק"ג)' : 'Medium (10-25kg)' },
    { id: 'large', label: isHebrew ? 'גדול (25+ ק"ג)' : 'Large (25+ kg)' },
  ];

  const serviceTypes = [
    { id: 'transport', label: isHebrew ? 'הסעה' : 'Transport', icon: Navigation },
    { id: 'sitting', label: isHebrew ? 'שמירה' : 'Sitting', icon: Heart },
    { id: 'stay', label: isHebrew ? 'לינה' : 'Stay', icon: Star },
  ];

  const safetyFeatures = [
    {
      icon: Shield,
      title: isHebrew ? 'ביטוח מלא' : 'Full Insurance',
      description: isHebrew ? 'כל נסיעה מבוטחת במלואה' : 'Every trip is fully insured'
    },
    {
      icon: Heart,
      title: isHebrew ? 'טיפול מקצועי' : 'Professional Care',
      description: isHebrew ? 'נהגים מאומנים לטיפול בחיות' : 'Trained pet care drivers'
    },
    {
      icon: Phone,
      title: isHebrew ? 'תמיכה 24/7' : '24/7 Support',
      description: isHebrew ? 'צוות תמיכה זמין תמיד' : 'Support team always available'
    },
    {
      icon: Award,
      title: isHebrew ? 'אישורים מוסמכים' : 'Certified Service',
      description: isHebrew ? 'שירות מורשה ומוסמך' : 'Licensed and certified service'
    }
  ];

  const stepLabels = [
    isHebrew ? 'פרטי נסיעה' : 'Trip Details',
    isHebrew ? 'אישור מחיר' : 'Confirm Price',
    isHebrew ? 'הזמנה מאושרת' : 'Confirmed',
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-8">
      <div className="luxury-container">
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="luxury-badge-gold">
              <Star className="h-4 w-4" />
              {isHebrew ? 'שירות פרמיום' : 'Premium Service'}
            </div>
          </div>
          
          <h1 className="luxury-heading-xl mb-4">
            {isHebrew ? 'הסעות יוקרה לחיות המחמד' : 'Luxury Pet Transport'}
          </h1>
          
          <p className="luxury-text-body max-w-2xl mx-auto">
            {isHebrew 
              ? 'שירות הסעות מקצועי ובטוח לחיות המחמד שלכם — מחיר ידוע מראש, כמו אובר'
              : 'Professional and safe pet transport — upfront pricing, Uber-style'
            }
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-semibold transition-all ${
                  step <= currentStep 
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white luxury-shadow-lg' 
                    : 'luxury-glass-minimal text-gray-400'
                }`}>
                  {step < currentStep ? <CheckCircle2 className="h-6 w-6" /> : step}
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-1 mx-2 rounded ${
                    step < currentStep ? 'bg-gradient-to-r from-purple-500 to-purple-700' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3">
            {stepLabels.map((label, idx) => (
              <span key={idx} className={`luxury-text-small font-medium ${idx + 1 === currentStep ? 'text-purple-700' : ''}`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="luxury-glass-card luxury-shadow-xl p-6 md:p-8 luxury-animate-scale-in luxury-delay-2">
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <h2 className="luxury-heading-md mb-6">
                      {isHebrew ? 'פרטי הנסיעה' : 'Trip Information'}
                    </h2>

                    <div>
                      <label className="luxury-heading-sm mb-2 block">
                        {isHebrew ? 'שם חיית המחמד' : 'Pet Name'}
                      </label>
                      <input
                        type="text"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder={isHebrew ? 'שם חיית המחמד שלך' : 'Your pet\'s name'}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white/80 focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all"
                        data-testid="input-pet-name"
                      />
                    </div>

                    <div>
                      <label className="luxury-heading-sm mb-3 block">
                        {isHebrew ? 'סוג חיית המחמד' : 'Pet Type'}
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {petTypes.map((pet) => (
                          <button
                            key={pet.id}
                            type="button"
                            onClick={() => setSelectedPetType(pet.id)}
                            className={`luxury-glass-minimal luxury-hover-lift p-4 rounded-xl text-center transition-all ${
                              selectedPetType === pet.id ? 'ring-2 ring-purple-500 bg-purple-50' : ''
                            }`}
                            data-testid={`button-pet-${pet.id}`}
                          >
                            <pet.icon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                            <span className="luxury-text-small font-medium">{pet.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="luxury-heading-sm mb-3 block">
                        {isHebrew ? 'גודל' : 'Size'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {petSizes.map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => setPetSize(size.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              petSize === size.id 
                                ? 'bg-purple-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            data-testid={`button-size-${size.id}`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="luxury-heading-sm mb-3 block">
                        {isHebrew ? 'סוג שירות' : 'Service Type'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {serviceTypes.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => setSelectedServiceType(service.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              selectedServiceType === service.id 
                                ? 'bg-purple-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            data-testid={`button-service-${service.id}`}
                          >
                            <service.icon className="h-4 w-4" />
                            {service.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="luxury-heading-sm mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          {isHebrew ? 'נקודת איסוף' : 'Pickup Location'}
                        </label>
                        <GooglePlacesAutocomplete
                          value={pickupAddress}
                          onChange={handlePickupSelect}
                          placeholder={isHebrew ? 'מאיפה לאסוף?' : 'Where to pick up?'}
                          country={['il']}
                          className="w-full"
                        />
                      </div>

                      <div className="flex justify-center">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Route className="h-4 w-4 text-purple-600" />
                        </div>
                      </div>

                      <div>
                        <label className="luxury-heading-sm mb-2 flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-red-500" />
                          {isHebrew ? 'יעד' : 'Drop-off Location'}
                        </label>
                        <GooglePlacesAutocomplete
                          value={dropoffAddress}
                          onChange={handleDropoffSelect}
                          placeholder={isHebrew ? 'לאן להגיע?' : 'Where to drop off?'}
                          country={['il']}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="luxury-heading-sm mb-2 block">
                          {isHebrew ? 'תאריך' : 'Date'}
                        </label>
                        <DatePicker
                          value={selectedDate}
                          onChange={setSelectedDate}
                          placeholder={isHebrew ? 'בחר תאריך' : 'Select date'}
                          minDate={new Date()}
                          language={language}
                          testId="input-date"
                          className="luxury-glass-minimal"
                        />
                      </div>
                      <div>
                        <label className="luxury-heading-sm mb-2 block">
                          {isHebrew ? 'שעה' : 'Time'}
                        </label>
                        <TimePicker
                          value={selectedTime}
                          onChange={setSelectedTime}
                          placeholder={isHebrew ? 'בחר שעה' : 'Select time'}
                          language={language}
                          testId="input-time"
                          className="luxury-glass-minimal"
                          interval={30}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="notes" className="luxury-heading-sm mb-2 block">
                        {isHebrew ? 'דרישות מיוחדות' : 'Special Requirements'}
                      </label>
                      <Textarea
                        id="notes"
                        value={specialNotes}
                        onChange={(e) => setSpecialNotes(e.target.value)}
                        className="luxury-glass-minimal resize-none"
                        rows={3}
                        placeholder={isHebrew ? 'הוסף הערות מיוחדות...' : 'Add special notes...'}
                        data-testid="textarea-notes"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={fetchFareEstimate}
                      disabled={!canGetFare || isFetchingFare}
                      className="luxury-btn-primary luxury-shadow-xl w-full text-lg py-6"
                      data-testid="button-get-fare"
                    >
                      {isFetchingFare ? (
                        <><Loader2 className="h-5 w-5 animate-spin mr-2" /> {isHebrew ? 'מחשב מחיר...' : 'Calculating fare...'}</>
                      ) : (
                        <><Zap className="h-5 w-5 mr-2" /> {isHebrew ? 'קבל הצעת מחיר מיידית' : 'Get Instant Quote'}</>
                      )}
                    </Button>

                    {!canGetFare && (
                      <p className="text-center text-sm text-gray-400">
                        {isHebrew 
                          ? 'מלא שם חיה, סוג חיה, ונקודות איסוף ויעד לקבלת מחיר' 
                          : 'Fill in pet name, type, and both locations to get a price'}
                      </p>
                    )}
                  </div>
                )}

                {currentStep === 2 && fareEstimate && pricing && (
                  <div className="space-y-6">
                    <h2 className="luxury-heading-md mb-2">
                      {isHebrew ? 'המחיר שלך — ידוע מראש!' : 'Your Price — Known Upfront!'}
                    </h2>
                    <p className="luxury-text-body mb-6">
                      {isHebrew 
                        ? 'המחיר סופי — לא יהיו הפתעות. כמו אובר, מה שרואים זה מה שמשלמים.'
                        : 'Final price — no surprises. Like Uber, what you see is what you pay.'}
                    </p>

                    <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-6 border border-purple-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-600">{pickup?.address}</span>
                      </div>
                      <div className="border-l-2 border-dashed border-purple-200 ml-1.5 h-6"></div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm text-gray-600">{dropoff?.address}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                          <Route className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xl font-bold text-gray-900">{fareEstimate.breakdown.distanceKm.toFixed(1)} km</p>
                          <p className="text-xs text-gray-500">{isHebrew ? 'מרחק' : 'Distance'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                          <Clock className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xl font-bold text-gray-900">{fareEstimate.breakdown.estimatedMinutes} {isHebrew ? 'דק׳' : 'min'}</p>
                          <p className="text-xs text-gray-500">{isHebrew ? 'זמן משוער' : 'Est. time'}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{isHebrew ? 'תעריף בסיס' : 'Base fare'}</span>
                          <span className="font-medium">₪{fareEstimate.baseFare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{isHebrew ? 'מרחק' : 'Distance'}</span>
                          <span className="font-medium">₪{fareEstimate.distanceFare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{isHebrew ? 'זמן' : 'Time'}</span>
                          <span className="font-medium">₪{fareEstimate.timeFare.toFixed(2)}</span>
                        </div>
                        {fareEstimate.surgeFare > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-orange-600 flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {isHebrew ? 'תוספת שעות עומס' : 'Peak hours surge'}
                              <span className="text-xs">(x{fareEstimate.breakdown.surgeMultiplier})</span>
                            </span>
                            <span className="font-medium text-orange-600">₪{fareEstimate.surgeFare.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{isHebrew ? 'מע"מ (17%)' : 'VAT (17%)'}</span>
                          <span className="font-medium">₪{pricing.vatOnCommission.toFixed(2)}</span>
                        </div>

                        <div className="border-t border-purple-200 pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">{isHebrew ? 'סה"כ לתשלום' : 'Total to pay'}</span>
                            <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                              ₪{pricing.totalCharged.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {fareEstimate.breakdown.isPeakTime && (
                      <div className="bg-white border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                        <Zap className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-orange-800">
                            {isHebrew ? 'שעות עומס' : 'Peak Hours'}
                          </p>
                          <p className="text-xs text-orange-600">
                            {isHebrew 
                              ? 'המחיר כולל תוספת שעות עומס. שקול לקבוע שעה אחרת לחיסכון.'
                              : 'Price includes peak hour surcharge. Consider a different time to save.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="luxury-btn-secondary"
                        data-testid="button-back"
                      >
                        {isHebrew ? <><ArrowRight className="h-4 w-4 ml-1" /> חזור</> : <><ArrowLeft className="h-4 w-4 mr-1" /> Back</>}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleBookTrip}
                        disabled={isBooking}
                        className="luxury-btn-primary luxury-shadow-xl flex-1 text-lg py-6"
                        data-testid="button-confirm-booking"
                      >
                        {isBooking ? (
                          <><Loader2 className="h-5 w-5 animate-spin mr-2" /> {isHebrew ? 'מזמין...' : 'Booking...'}</>
                        ) : (
                          <>{isHebrew ? `אשר והזמן ₪${pricing?.totalCharged.toFixed(0)}` : `Confirm & Book ₪${pricing?.totalCharged.toFixed(0)}`}</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {currentStep === 3 && bookingComplete && (
                  <div className="text-center py-12 space-y-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto luxury-shadow-lg">
                      <CheckCircle2 className="h-12 w-12 text-white" />
                    </div>
                    <h2 className="luxury-heading-lg">
                      {isHebrew ? 'הנסיעה הוזמנה בהצלחה!' : 'Trip Booked Successfully!'}
                    </h2>
                    <p className="luxury-text-body max-w-md mx-auto">
                      {isHebrew 
                        ? 'נהג מוסמך ייצור איתך קשר בקרוב לתיאום האיסוף. תקבל/י הודעת SMS עם פרטי הנהג.'
                        : 'A certified driver will contact you shortly to coordinate pickup. You\'ll receive an SMS with driver details.'}
                    </p>
                    {tripId && (
                      <div className="bg-purple-50 rounded-xl px-6 py-3 inline-block">
                        <p className="text-sm text-gray-500">{isHebrew ? 'מספר הזמנה' : 'Booking ID'}</p>
                        <p className="text-lg font-mono font-bold text-purple-700">{tripId}</p>
                      </div>
                    )}
                    <div className="flex justify-center gap-3 pt-4">
                      <Button
                        onClick={() => setLocation('/pettrek')}
                        className="luxury-btn-secondary"
                        data-testid="button-back-to-pettrek"
                      >
                        {isHebrew ? 'חזרה ל-PetTrek' : 'Back to PetTrek'}
                      </Button>
                      <Button
                        onClick={() => {
                          setCurrentStep(1);
                          setBookingComplete(false);
                          setFareEstimate(null);
                          setPetName('');
                          setSelectedPetType('');
                          setPickup(null);
                          setDropoff(null);
                          setPickupAddress('');
                          setDropoffAddress('');
                          setSpecialNotes('');
                        }}
                        className="luxury-btn-primary"
                        data-testid="button-new-trip"
                      >
                        {isHebrew ? 'הזמן נסיעה נוספת' : 'Book Another Trip'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-6 sticky top-8 luxury-animate-scale-in luxury-delay-3">
                <h3 className="luxury-heading-md mb-6">
                  {isHebrew ? 'סיכום מחיר' : 'Price Summary'}
                </h3>

                {fareEstimate && pricing ? (
                  <div className="space-y-4">
                    <div className="flex justify-between luxury-text-body">
                      <span>{isHebrew ? 'תעריף בסיס' : 'Base Fare'}</span>
                      <span>₪{fareEstimate.baseFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between luxury-text-small">
                      <span>{isHebrew ? 'מרחק' : 'Distance'} ({fareEstimate.breakdown.distanceKm.toFixed(1)} km)</span>
                      <span>₪{fareEstimate.distanceFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between luxury-text-small">
                      <span>{isHebrew ? 'זמן' : 'Time'} ({fareEstimate.breakdown.estimatedMinutes} {isHebrew ? 'דק׳' : 'min'})</span>
                      <span>₪{fareEstimate.timeFare.toFixed(2)}</span>
                    </div>
                    {fareEstimate.surgeFare > 0 && (
                      <div className="flex justify-between luxury-text-small text-orange-600">
                        <span>{isHebrew ? 'תוספת עומס' : 'Surge'}</span>
                        <span>₪{fareEstimate.surgeFare.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between luxury-text-small">
                      <span>{isHebrew ? 'עמלת פלטפורמה (15%)' : 'Platform fee (15%)'}</span>
                      <span>₪{pricing.commission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between luxury-text-small">
                      <span>{isHebrew ? 'מע"מ' : 'VAT'}</span>
                      <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
                    </div>
                    
                    <div className="luxury-divider"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="luxury-heading-sm">{isHebrew ? 'סה"כ' : 'Total'}</span>
                      <span className="luxury-heading-lg luxury-text-gradient">
                        ₪{pricing.totalCharged.toFixed(0)}
                      </span>
                    </div>

                    {fareEstimate.breakdown.isPeakTime && (
                      <div className="text-xs text-center text-orange-500 flex items-center justify-center gap-1">
                        <Zap className="h-3 w-3" />
                        {isHebrew ? 'תעריף שעות עומס פעיל' : 'Peak hour pricing active'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Route className="h-10 w-10 text-purple-300 mx-auto mb-3" />
                    <p className="luxury-text-small">
                      {isHebrew ? 'מלא את הפרטים לקבלת הצעת מחיר מיידית' : 'Fill in details for an instant quote'}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3 luxury-animate-fade-in luxury-delay-4">
                {safetyFeatures.map((feature, idx) => (
                  <div 
                    key={idx}
                    className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="luxury-heading-sm mb-1">{feature.title}</h4>
                        <p className="luxury-text-small">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
