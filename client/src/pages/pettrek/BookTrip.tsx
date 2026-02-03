import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { 
  MapPin, 
  Navigation, 
  DollarSign, 
  Shield, 
  Heart, 
  Star,
  CheckCircle2,
  Calendar,
  Clock,
  Dog,
  Cat,
  Briefcase,
  Phone,
  Award
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { useState } from "react";

interface Driver {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  vehicle: string;
  photo: string;
  price: number;
  experience: string;
}

export default function BookTrip() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [currentStep, setCurrentStep] = useState(1);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [selectedPetType, setSelectedPetType] = useState<string>('');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Mock driver data
  const drivers: Driver[] = [
    {
      id: '1',
      name: isHebrew ? 'דני כהן' : 'Danny Cohen',
      rating: 4.9,
      reviews: 342,
      vehicle: 'Mercedes-Benz Sprinter',
      photo: '👨‍✈️',
      price: 120,
      experience: isHebrew ? '8 שנות ניסיון' : '8 years experience'
    },
    {
      id: '2',
      name: isHebrew ? 'שרה לוי' : 'Sarah Levy',
      rating: 5.0,
      reviews: 456,
      vehicle: 'Tesla Model X',
      photo: '👩‍✈️',
      price: 150,
      experience: isHebrew ? '10 שנות ניסיון' : '10 years experience'
    },
    {
      id: '3',
      name: isHebrew ? 'מיכאל ברק' : 'Michael Barak',
      rating: 4.8,
      reviews: 289,
      vehicle: 'Ford Transit Custom',
      photo: '👨‍💼',
      price: 110,
      experience: isHebrew ? '6 שנות ניסיון' : '6 years experience'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      if (currentStep === 1) {
        setEstimatedFare(120);
      }
    }
  };

  const petTypes = [
    { id: 'dog', icon: Dog, label: isHebrew ? 'כלב' : 'Dog' },
    { id: 'cat', icon: Cat, label: isHebrew ? 'חתול' : 'Cat' },
    { id: 'other', icon: Heart, label: isHebrew ? 'אחר' : 'Other' }
  ];

  const serviceTypes = [
    { id: 'standard', label: isHebrew ? 'רגיל' : 'Standard' },
    { id: 'premium', label: isHebrew ? 'פרמיום' : 'Premium' },
    { id: 'express', label: isHebrew ? 'אקספרס' : 'Express' }
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

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-8">
      <div className="luxury-container">
        {/* Hero Section */}
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
              ? 'שירות הסעות מקצועי ובטוח לחיות המחמד שלכם עם נהגים מאומנים ורכבים מפוארים'
              : 'Professional and safe transport service for your beloved pets with trained drivers and luxury vehicles'
            }
          </p>
        </div>

        {/* Progress Stepper */}
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
            <span className="luxury-text-small font-medium">
              {isHebrew ? 'פרטי נסיעה' : 'Trip Details'}
            </span>
            <span className="luxury-text-small font-medium">
              {isHebrew ? 'בחר נהג' : 'Select Driver'}
            </span>
            <span className="luxury-text-small font-medium">
              {isHebrew ? 'סיכום ותשלום' : 'Summary & Payment'}
            </span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Booking Form */}
            <div className="lg:col-span-2">
              <div className="luxury-glass-card luxury-shadow-xl p-6 md:p-8 luxury-animate-scale-in luxury-delay-2">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {currentStep === 1 && (
                    <>
                      <div>
                        <h2 className="luxury-heading-md mb-6">
                          {isHebrew ? 'פרטי הנסיעה' : 'Trip Information'}
                        </h2>

                        {/* Pet Selection */}
                        <div className="mb-6">
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
                                  selectedPetType === pet.id ? 'ring-2 ring-purple-500' : ''
                                }`}
                                data-testid={`button-pet-${pet.id}`}
                              >
                                <pet.icon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                                <span className="luxury-text-small font-medium">{pet.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Service Type */}
                        <div className="mb-6">
                          <label className="luxury-heading-sm mb-3 block">
                            {isHebrew ? 'סוג שירות' : 'Service Type'}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {serviceTypes.map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => setSelectedServiceType(service.id)}
                                className={`luxury-badge ${
                                  selectedServiceType === service.id ? 'ring-2 ring-purple-500' : ''
                                }`}
                                data-testid={`button-service-${service.id}`}
                              >
                                {service.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Location Inputs */}
                        <div className="space-y-4">
                          <div>
                            <label className="luxury-heading-sm mb-2 block">
                              {isHebrew ? 'נקודת איסוף' : 'Pickup Location'}
                            </label>
                            <GooglePlacesAutocomplete
                              value={pickupAddress}
                              onChange={(value) => setPickupAddress(value)}
                              placeholder={isHebrew ? 'התחל להקליד כתובת...' : 'Start typing address...'}
                              country={['il']}
                              className="w-full"
                            />
                          </div>

                          <div>
                            <label className="luxury-heading-sm mb-2 block">
                              {isHebrew ? 'יעד' : 'Drop-off Location'}
                            </label>
                            <GooglePlacesAutocomplete
                              value={dropoffAddress}
                              onChange={(value) => setDropoffAddress(value)}
                              placeholder={isHebrew ? 'התחל להקליד כתובת...' : 'Start typing address...'}
                              country={['il']}
                              className="w-full"
                            />
                          </div>
                        </div>

                        {/* Date & Time */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

                        {/* Special Requirements */}
                        <div className="mt-4">
                          <label htmlFor="notes" className="luxury-heading-sm mb-2 block">
                            {isHebrew ? 'דרישות מיוחדות' : 'Special Requirements'}
                          </label>
                          <Textarea
                            id="notes"
                            className="luxury-glass-minimal resize-none"
                            rows={4}
                            placeholder={isHebrew ? 'הוסף הערות או דרישות מיוחדות...' : 'Add any special notes or requirements...'}
                            data-testid="textarea-notes"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === 2 && (
                    <>
                      <div>
                        <h2 className="luxury-heading-md mb-6">
                          {isHebrew ? 'בחר נהג' : 'Select Your Driver'}
                        </h2>

                        <div className="luxury-grid-3">
                          {drivers.map((driver) => (
                            <div
                              key={driver.id}
                              className={`luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 cursor-pointer transition-all ${
                                selectedDriver === driver.id ? 'ring-2 ring-purple-500' : ''
                              }`}
                              onClick={() => setSelectedDriver(driver.id)}
                              data-testid={`card-driver-${driver.id}`}
                            >
                              <div className="text-center mb-4">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-4xl mx-auto mb-3 luxury-shadow-md">
                                  {driver.photo}
                                </div>
                                <h3 className="luxury-heading-sm mb-1">{driver.name}</h3>
                                <p className="luxury-text-small">{driver.experience}</p>
                              </div>

                              <div className="space-y-2 mb-4">
                                <div className="flex items-center justify-center gap-1">
                                  <div className="luxury-badge-gold flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-current" />
                                    <span>{driver.rating}</span>
                                    <span className="text-xs">({driver.reviews})</span>
                                  </div>
                                </div>
                                <p className="luxury-text-small text-center">{driver.vehicle}</p>
                              </div>

                              <div className="text-center mb-4">
                                <p className="luxury-heading-lg luxury-text-gradient">
                                  ₪{driver.price}
                                </p>
                              </div>

                              <Button
                                type="button"
                                className="luxury-btn-primary w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDriver(driver.id);
                                }}
                                data-testid={`button-select-driver-${driver.id}`}
                              >
                                {isHebrew ? 'בחר' : 'Select'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === 3 && (
                    <>
                      <div>
                        <h2 className="luxury-heading-md mb-6">
                          {isHebrew ? 'אישור ותשלום' : 'Confirmation & Payment'}
                        </h2>
                        <div className="text-center py-12">
                          <CheckCircle2 className="h-20 w-20 text-purple-600 mx-auto mb-4" />
                          <p className="luxury-heading-sm mb-2">
                            {isHebrew ? 'ההזמנה מוכנה!' : 'Your booking is ready!'}
                          </p>
                          <p className="luxury-text-body">
                            {isHebrew ? 'לחץ להשלמת התשלום' : 'Click to complete payment'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-4">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="luxury-btn-secondary"
                        data-testid="button-back"
                      >
                        {isHebrew ? 'חזור' : 'Back'}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="luxury-btn-primary luxury-shadow-xl flex-1"
                      data-testid="button-continue"
                      disabled={currentStep === 2 && !selectedDriver}
                    >
                      {currentStep === 3 
                        ? (isHebrew ? 'השלם הזמנה' : 'Complete Booking')
                        : (isHebrew ? 'המשך' : 'Continue')
                      }
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Price Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-6 sticky top-8 luxury-animate-scale-in luxury-delay-3">
                <h3 className="luxury-heading-md mb-6">
                  {isHebrew ? 'סיכום מחיר' : 'Price Summary'}
                </h3>

                {estimatedFare ? (
                  <div className="space-y-4">
                    <div className="flex justify-between luxury-text-body">
                      <span>{isHebrew ? 'תעריף בסיס' : 'Base Fare'}</span>
                      <span>₪{estimatedFare}</span>
                    </div>
                    <div className="flex justify-between luxury-text-small">
                      <span>{isHebrew ? 'דמי שירות' : 'Service Fee'}</span>
                      <span>₪15</span>
                    </div>
                    <div className="flex justify-between luxury-text-small">
                      <span>{isHebrew ? 'ביטוח' : 'Insurance'}</span>
                      <span>₪10</span>
                    </div>
                    
                    <div className="luxury-divider"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="luxury-heading-sm">{isHebrew ? 'סה"כ' : 'Total'}</span>
                      <span className="luxury-heading-lg luxury-text-gradient">
                        ₪{estimatedFare + 25}
                      </span>
                    </div>

                    {currentStep === 3 && (
                      <Button 
                        className="luxury-btn-primary luxury-shadow-xl w-full mt-4"
                        data-testid="button-book-trip"
                      >
                        {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="luxury-text-small text-center py-8">
                    {isHebrew ? 'מלא את הפרטים לקבלת הצעת מחיר' : 'Fill in the details to get a quote'}
                  </p>
                )}
              </div>

              {/* Safety Features */}
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
