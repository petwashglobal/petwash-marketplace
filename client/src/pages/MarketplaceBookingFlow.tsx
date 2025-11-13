/**
 * MARKETPLACE BOOKING FLOW
 * 
 * Multi-step booking wizard for all marketplace platforms
 * - Step 1: Select service/package
 * - Step 2: Choose date/time
 * - Step 3: Add pet details
 * - Step 4: Review pricing (base + platform fee + 17% VAT)
 * - Step 5: Proceed to Nayax payment
 */

import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { GlassmorphismCard } from '@/components/luxury/GlassmorphismCard';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useProviderDetails } from '@/services/marketplace';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon, Clock, Check, ChevronLeft, ChevronRight,
  Dog, MapPin, Star, DollarSign, CreditCard, Shield, Lock
} from 'lucide-react';
import type { MarketplacePlatformId } from '@shared/schema';
import { BookingCalendar } from '@/components/marketplace/BookingCalendar';

interface BookingStep {
  id: number;
  title: string;
  titleHe: string;
  completed: boolean;
}

export default function MarketplaceBookingFlow() {
  const { platform, id } = useParams<{ platform: MarketplacePlatformId; id: string }>();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  // Booking state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string>('standard'); // Service selection state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  // Availability lock state
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const [lockSecondsLeft, setLockSecondsLeft] = useState<number>(0);
  const [selectedSlotStart, setSelectedSlotStart] = useState<Date | null>(null);
  const [selectedSlotEnd, setSelectedSlotEnd] = useState<Date | null>(null);

  // Fetch provider details
  const { data: providerData, isLoading: providerLoading } = useProviderDetails(platform!, id!);
  const provider = providerData?.provider;

  // Fetch user's pets
  const { data: pets } = useQuery<any[]>({
    queryKey: ['/api/pets', user?.uid],
    enabled: !!user,
  });

  // Countdown timer for lock expiry
  useEffect(() => {
    if (!lockExpiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.floor((lockExpiresAt.getTime() - now.getTime()) / 1000);

      if (remaining <= 0) {
        // Lock expired - reset state
        setLockToken(null);
        setLockExpiresAt(null);
        setLockSecondsLeft(0);
        setSelectedSlotId(null);
        toast({
          variant: 'destructive',
          title: isHebrew ? 'הזמן פג' : 'Time Expired',
          description: isHebrew ? 'ההזמנה שלך פגה. אנא בחר שוב.' : 'Your reservation has expired. Please select again.',
        });
      } else {
        setLockSecondsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockExpiresAt, toast, isHebrew]);

  // Handle slot selection from BookingCalendar
  const handleSlotSelected = (slotDetails: {
    slotId: number;
    lockToken: string;
    expiresAt: Date;
    startTime: Date;
    endTime: Date;
  }) => {
    setSelectedSlotId(slotDetails.slotId);
    setLockToken(slotDetails.lockToken);
    setLockExpiresAt(slotDetails.expiresAt);
    setSelectedSlotStart(slotDetails.startTime);
    setSelectedSlotEnd(slotDetails.endTime);
    
    // Also set legacy date/time fields for compatibility with Step 4 display
    setSelectedDate(slotDetails.startTime);
    setSelectedTime(slotDetails.startTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }));
  };

  // Format countdown
  const formatCountdown = () => {
    const minutes = Math.floor(lockSecondsLeft / 60);
    const seconds = lockSecondsLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Steps configuration
  const steps: BookingStep[] = [
    { id: 1, title: 'Select Service', titleHe: 'בחר שירות', completed: !!selectedService },
    { id: 2, title: 'Choose Date & Time', titleHe: 'בחר תאריך ושעה', completed: !!lockToken && !!selectedSlotId },
    { id: 3, title: 'Pet Details', titleHe: 'פרטי חיית מחמד', completed: !!selectedPetId },
    { id: 4, title: 'Review & Pay', titleHe: 'סקירה ותשלום', completed: false },
  ];

  // Calculate pricing - handle all provider types
  const basePriceCents = (() => {
    if (!provider) return 0;
    
    switch (provider.kind) {
      case 'walker':
        return (provider.hourlyRate || 0) * 100;
      case 'sitter':
        return provider.pricePerDayCents || 0;
      case 'driver':
        // TODO: Add driver pricing field when backend supports it
        return 15000; // Placeholder: ₪150
      case 'groomer':
        // TODO: Add groomer pricing field when backend supports it
        return 20000; // Placeholder: ₪200
      default:
        return 0;
    }
  })();
  
  const platformFeeCents = Math.round(basePriceCents * 0.10); // 10% platform fee
  const subtotalCents = basePriceCents + platformFeeCents;
  const vatCents = Math.round(subtotalCents * 0.17); // 17% VAT
  const totalCents = subtotalCents + vatCents;

  // Time slots (example - would come from backend)
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
  ];

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmitBooking = async () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew ? 'אנא התחבר כדי להזמין' : 'Please log in to book',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }

    if (!selectedDate || !selectedTime || !selectedPetId) {
      toast({
        title: isHebrew ? 'פרטים חסרים' : 'Missing Details',
        description: isHebrew ? 'אנא מלא את כל השדות' : 'Please complete all fields',
        variant: 'destructive',
      });
      return;
    }

    // TODO: Create booking and proceed to Nayax payment
    toast({
      title: isHebrew ? 'מעבר לתשלום...' : 'Proceeding to Payment...',
      description: isHebrew ? 'מעביר אותך לNayax' : 'Redirecting to Nayax',
    });

    // Navigate to payment (will be implemented with Nayax integration)
    console.log('Booking data:', {
      platform,
      providerId: id,
      date: selectedDate,
      time: selectedTime,
      petId: selectedPetId,
      totalCents,
      specialInstructions,
    });
  };

  if (providerLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {isHebrew ? 'טוען...' : 'Loading...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!provider) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
          <div className="text-center">
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {isHebrew ? 'ספק לא נמצא' : 'Provider not found'}
            </p>
            <Button onClick={() => navigate('/marketplace')} className="mt-4" data-testid="button-back-marketplace">
              {isHebrew ? 'חזור לשוק' : 'Back to Marketplace'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-black py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate(`/marketplace/${platform}/${id}`)}
              className="mb-4"
              data-testid="button-back-provider"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {isHebrew ? 'חזור לפרופיל' : 'Back to Profile'}
            </Button>
            
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent mb-2">
              {isHebrew ? 'הזמן שירות' : 'Book Service'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isHebrew ? `הזמנה עם ${provider.firstName} ${provider.lastName}` : `Booking with ${provider.firstName} ${provider.lastName}`}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex-1">
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        currentStep === step.id
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : step.completed
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-gray-300 dark:border-gray-700 text-gray-400'
                      }`}
                      data-testid={`step-${step.id}`}
                    >
                      {step.completed ? <Check className="w-5 h-5" /> : step.id}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 transition-all ${
                          step.completed ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </div>
                  <p className="text-xs mt-2 text-center text-gray-600 dark:text-gray-400">
                    {isHebrew ? step.titleHe : step.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <GlassmorphismCard>
            <div className="p-8">
              
              {/* Step 1: Select Service */}
              {currentStep === 1 && (
                <div data-testid="step-select-service">
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'בחר שירות' : 'Select Service'}
                  </h2>
                  <div className="space-y-4">
                    <Card 
                      className={`cursor-pointer hover:shadow-lg transition-all ${
                        selectedService === 'standard' 
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 border-2' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => setSelectedService('standard')}
                      data-testid="service-standard"
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{isHebrew ? 'שירות רגיל' : 'Standard Service'}</span>
                          <span className="text-purple-600">₪{(basePriceCents / 100).toFixed(0)}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-600 dark:text-gray-400">
                          {isHebrew 
                            ? 'שירות בסיסי עם כל הכוללים' 
                            : 'Basic service with all essentials'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Button
                    onClick={handleNextStep}
                    disabled={!selectedService}
                    className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600"
                    data-testid="button-next-step"
                  >
                    {isHebrew ? 'הבא' : 'Next'}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* Step 2: Choose Date & Time (Availability-Based) */}
              {currentStep === 2 && (
                <div data-testid="step-choose-datetime">
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'בחר תאריך ושעה' : 'Choose Date & Time'}
                  </h2>
                  
                  <BookingCalendar
                    platform={platform!}
                    providerId={Number(id)}
                    onSlotSelected={handleSlotSelected}
                    bookingMode="SINGLE_SLOT"
                  />

                  <div className="flex gap-4 mt-6">
                    <Button
                      variant="outline"
                      onClick={handlePrevStep}
                      className="flex-1"
                      data-testid="button-prev-step"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      {isHebrew ? 'אחורה' : 'Back'}
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={!lockToken}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                      data-testid="button-next-step"
                    >
                      {isHebrew ? 'הבא' : 'Next'}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Pet Details */}
              {currentStep === 3 && (
                <div data-testid="step-pet-details">
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'בחר חיית מחמד' : 'Select Your Pet'}
                  </h2>

                  {pets && pets.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {pets.map((pet) => (
                        <Card
                          key={pet.id}
                          className={`cursor-pointer transition-all ${
                            selectedPetId === pet.id
                              ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                          }`}
                          onClick={() => setSelectedPetId(pet.id)}
                          data-testid={`pet-option-${pet.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              {pet.photoUrl ? (
                                <img
                                  src={pet.photoUrl}
                                  alt={pet.name}
                                  className="w-16 h-16 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                  <Dog className="w-8 h-8 text-purple-600" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold">{pet.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {pet.breed || (isHebrew ? 'לא צוין' : 'Not specified')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
                      <Dog className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-400 font-medium mb-4">
                        {isHebrew ? 'אין חיות מחמד רשומות' : 'No pets registered'}
                      </p>
                      <Button
                        onClick={() => navigate('/pets')}
                        variant="outline"
                        data-testid="button-add-pet"
                      >
                        {isHebrew ? 'הוסף חיית מחמד' : 'Add Pet'}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <Button
                      variant="outline"
                      onClick={handlePrevStep}
                      className="flex-1"
                      data-testid="button-prev-step"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      {isHebrew ? 'אחורה' : 'Back'}
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={!selectedPetId}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                      data-testid="button-next-step"
                    >
                      {isHebrew ? 'הבא' : 'Next'}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Review & Pay */}
              {currentStep === 4 && (
                <div data-testid="step-review-pay">
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'סקירה ותשלום' : 'Review & Pay'}
                  </h2>

                  {/* Lock Countdown Banner */}
                  {lockToken && lockExpiresAt && (
                    <div className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-2 border-orange-400 dark:border-orange-600 rounded-2xl p-6">
                      <div className="flex items-center gap-4">
                        <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400 animate-pulse" />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-orange-900 dark:text-orange-100 mb-1">
                            {isHebrew ? 'ההזמנה שלך מוזמנת!' : 'Your Slot is Reserved!'}
                          </h3>
                          <p className="text-orange-700 dark:text-orange-300">
                            {isHebrew 
                              ? 'השלם את התשלום תוך' 
                              : 'Complete payment within'}
                            {' '}
                            <span className="font-mono text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-countdown">
                              {formatCountdown()}
                            </span>
                            {' '}
                            {isHebrew ? 'לפני שיפוג' : 'before it expires'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Booking Summary */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-semibold">{provider.firstName} {provider.lastName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{provider.city}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <CalendarIcon className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-semibold">
                          {selectedDate?.toLocaleDateString()} at {selectedTime}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isHebrew ? 'תאריך ושעה' : 'Date & Time'}
                        </p>
                      </div>
                    </div>

                    {selectedPetId && pets && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <Dog className="w-5 h-5 text-purple-600" />
                        <div>
                          <p className="font-semibold">
                            {pets.find(p => p.id === selectedPetId)?.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {isHebrew ? 'חיית מחמד' : 'Pet'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-2 border-purple-200 dark:border-purple-800 mb-6">
                    <h3 className="font-semibold mb-4">{isHebrew ? 'פירוט מחיר' : 'Price Breakdown'}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>{isHebrew ? 'מחיר בסיס' : 'Base Price'}</span>
                        <span data-testid="price-base">₪{(basePriceCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>{isHebrew ? 'עמלת פלטפורמה (10%)' : 'Platform Fee (10%)'}</span>
                        <span data-testid="price-platform-fee">₪{(platformFeeCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>{isHebrew ? 'מע״מ (17%)' : 'VAT (17%)'}</span>
                        <span data-testid="price-vat">₪{(vatCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="border-t-2 border-purple-300 dark:border-purple-700 pt-2 mt-2">
                        <div className="flex justify-between text-lg font-bold">
                          <span>{isHebrew ? 'סה"כ' : 'Total'}</span>
                          <span className="text-purple-600" data-testid="price-total">₪{(totalCents / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Button */}
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        onClick={handlePrevStep}
                        className="flex-1"
                        data-testid="button-prev-step"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        {isHebrew ? 'אחורה' : 'Back'}
                      </Button>
                      <Button
                        onClick={handleSubmitBooking}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        data-testid="button-proceed-payment"
                      >
                        <CreditCard className="w-5 h-5 mr-2" />
                        {isHebrew ? 'המשך לתשלום (Nayax)' : 'Proceed to Payment (Nayax)'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>{isHebrew ? 'תשלום מאובטח דרך Nayax Israel' : 'Secure payment via Nayax Israel'}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </GlassmorphismCard>
        </div>
      </div>
    </Layout>
  );
}
