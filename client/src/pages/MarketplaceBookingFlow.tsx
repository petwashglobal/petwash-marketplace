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
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Calendar as CalendarIcon, Clock, Check, ChevronLeft, ChevronRight,
  Dog, MapPin, Star, DollarSign, CreditCard, Shield, Lock
} from 'lucide-react';
import type { MarketplacePlatformId } from '@shared/schema';
import { BookingCalendar } from '@/components/marketplace/BookingCalendar';
import { CreditWalletCard } from '@/components/wallet/CreditWalletCard';

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

  // T005: Upsell add-ons
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const ADDON_OPTIONS = [
    { code: 'pickup',    labelHe: 'איסוף',              labelEn: 'Pet Pickup',   priceCents: 3500,  emoji: '🚗' },
    { code: 'dropoff',   labelHe: 'החזרה',              labelEn: 'Drop-off',     priceCents: 3500,  emoji: '🏠' },
    { code: 'grooming',  labelHe: 'טיפוח',              labelEn: 'Grooming',     priceCents: 8500,  emoji: '✂️' },
    { code: 'medication',labelHe: 'מתן תרופות',         labelEn: 'Medication',   priceCents: 2500,  emoji: '💊' },
  ] as const;

  const addonsTotalCents = ADDON_OPTIONS
    .filter(a => selectedAddons.includes(a.code))
    .reduce((sum, a) => sum + a.priceCents, 0);

  const toggleAddon = (code: string) => {
    setSelectedAddons(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code],
    );
  };

  // Credit wallet state
  const [appliedCredits, setAppliedCredits] = useState<{
    redemptionSessionId: string;
    egiftCents: number;
    washPackages: number;
    loyaltyPointsCents: number;
    promoCents: number;
    referralCents: number;
    totalCreditsAppliedCents: number;
    cashPaidCents: number;
  } | null>(null);

  // Quote state (fetched from backend)
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<{
    baseAmountCents: number;
    additionalPetsCents: number;
    addonsCents: number;
    weekendSurchargeCents: number;
    durationDiscountCents: number;
    comboDiscountCents: number;
    loyaltyDiscountCents: number;
    subtotalCents: number;
    platformFeeCents: number;
    vatCents: number;
    totalCents: number;
    providerEarningsCents: number;
    appliedDiscounts: string[];
    loyaltyInfo?: { tierName: string; discountPercent: number };
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const subtotalCents = basePriceCents + platformFeeCents + addonsTotalCents;
  const vatCents = Math.round(subtotalCents * 0.18); // 18% VAT (Israeli law updated Jan 2025)
  const totalCents = subtotalCents + vatCents;

  // Time slots (example - would come from backend)
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
  ];

  // Quote mutation - fetches pricing from backend
  const quoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/marketplace-bookings/quote', {
        platform,
        providerId: Number(id),
        startDate: selectedSlotStart?.toISOString() || selectedDate?.toISOString(),
        endDate: selectedSlotEnd?.toISOString() || selectedDate?.toISOString(),
        petIds: selectedPetId ? [selectedPetId] : [],
        serviceType: selectedService,
        addons: selectedAddons,
        slotId: selectedSlotId,
        lockToken,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.quoteId && data.quote) {
        setQuoteId(data.quoteId);
        setQuoteData(data.quote);
      }
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה בחישוב מחיר' : 'Pricing Error',
        description: error.message || (isHebrew ? 'לא ניתן לחשב מחיר' : 'Could not calculate pricing'),
        variant: 'destructive',
      });
    },
  });

  // Checkout mutation - creates booking and redirects to payment
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!quoteId) throw new Error('No quote available');
      const response = await apiRequest('POST', `/api/marketplace-bookings/${quoteId}/checkout`, {
        slotId: selectedSlotId,
        lockToken,
        petIds: selectedPetId ? [selectedPetId] : [],
        specialInstructions,
        ...(appliedCredits ? {
          creditBreakdown: {
            egiftCents: appliedCredits.egiftCents,
            washPackages: appliedCredits.washPackages,
            loyaltyPointsCents: appliedCredits.loyaltyPointsCents,
            promoCents: appliedCredits.promoCents,
            referralCents: appliedCredits.referralCents,
            totalCreditsAppliedCents: appliedCredits.totalCreditsAppliedCents,
            cashPaidCents: appliedCredits.cashPaidCents,
          },
          redemptionSessionId: appliedCredits.redemptionSessionId,
        } : {}),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.paymentUrl) {
        // Redirect to Nayax payment page
        window.location.href = data.paymentUrl;
      } else if (data.bookingId) {
        // Booking created successfully (for free quotes or demo mode)
        toast({
          title: isHebrew ? 'ההזמנה נוצרה!' : 'Booking Created!',
          description: isHebrew ? 'ההזמנה שלך אושרה' : 'Your booking has been confirmed',
        });
        navigate(`/bookings/${data.bookingId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה בהזמנה' : 'Booking Error',
        description: error.message || (isHebrew ? 'לא ניתן ליצור הזמנה' : 'Could not create booking'),
        variant: 'destructive',
      });
      setIsSubmitting(false);
    },
  });

  const handleNextStep = async () => {
    if (currentStep < steps.length) {
      // When moving from Step 3 (pet selection) to Step 4 (review), fetch quote
      if (currentStep === 3 && selectedPetId && lockToken) {
        quoteMutation.mutate();
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      // Clear quote data when going back from Step 4
      if (currentStep === 4) {
        setQuoteId(null);
        setQuoteData(null);
      }
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

    if (!quoteId || !selectedPetId) {
      toast({
        title: isHebrew ? 'פרטים חסרים' : 'Missing Details',
        description: isHebrew ? 'אנא מלא את כל השדות' : 'Please complete all fields',
        variant: 'destructive',
      });
      return;
    }

    // Check if lock expired
    if (lockSecondsLeft <= 0) {
      toast({
        title: isHebrew ? 'פג תוקף ההזמנה' : 'Reservation Expired',
        description: isHebrew ? 'אנא בחר זמן חדש' : 'Please select a new time',
        variant: 'destructive',
      });
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);
    checkoutMutation.mutate();
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
      <div className="min-h-screen luxury-bg-mesh py-12">
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

          {/* Progress Steps - Luxury Gradient Circles */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex-1">
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-14 h-14 rounded-full border-4 transition-all luxury-shadow-xl ${
                        currentStep === step.id
                          ? 'border-transparent bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 text-white shadow-purple-400/50 scale-110'
                          : step.completed
                          ? 'border-transparent bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-400/50'
                          : 'border-gray-300 dark:border-gray-700 text-gray-400 bg-white dark:bg-gray-900'
                      }`}
                      data-testid={`step-${step.id}`}
                    >
                      {step.completed ? <Check className="w-6 h-6" /> : <span className="text-lg font-bold">{step.id}</span>}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-2 transition-all rounded-full ${
                          step.completed ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-400/30' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </div>
                  <p className="text-xs mt-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                    {isHebrew ? step.titleHe : step.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <GlassmorphismCard className="luxury-glass-card luxury-shadow-xl">
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
                    className="w-full mt-6 luxury-btn-primary luxury-shadow-xl"
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
                      className="flex-1 luxury-btn-primary luxury-shadow-xl"
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

                  {/* T005: Upsell — Extras */}
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {isHebrew ? 'תוספות (אופציונלי)' : 'Add-ons (Optional)'}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {ADDON_OPTIONS.map(addon => {
                        const active = selectedAddons.includes(addon.code);
                        return (
                          <button
                            key={addon.code}
                            type="button"
                            onClick={() => toggleAddon(addon.code)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                              active
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                            }`}
                          >
                            <span className="text-xl">{addon.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {isHebrew ? addon.labelHe : addon.labelEn}
                              </p>
                              <p className="text-xs text-gray-500">
                                +₪{(addon.priceCents / 100).toFixed(0)}
                              </p>
                            </div>
                            {active && (
                              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {addonsTotalCents > 0 && (
                      <p className="text-xs text-purple-600 font-medium mt-2">
                        {isHebrew
                          ? `תוספות: +₪${(addonsTotalCents / 100).toFixed(0)}`
                          : `Add-ons total: +₪${(addonsTotalCents / 100).toFixed(0)}`}
                      </p>
                    )}
                  </div>

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
                      className="flex-1 luxury-btn-primary luxury-shadow-xl"
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
                    
                    {quoteMutation.isPending ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          {isHebrew ? 'מחשב מחיר...' : 'Calculating pricing...'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>{isHebrew ? 'מחיר בסיס' : 'Base Price'}</span>
                          <span data-testid="price-base">₪{((quoteData?.baseAmountCents || basePriceCents) / 100).toFixed(2)}</span>
                        </div>
                        
                        {/* Show discounts if any applied */}
                        {quoteData?.loyaltyDiscountCents && quoteData.loyaltyDiscountCents > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>{isHebrew ? 'הנחת נאמנות' : 'Loyalty Discount'} ({quoteData.loyaltyInfo?.tierName || ''})</span>
                            <span data-testid="price-loyalty-discount">-₪{(quoteData.loyaltyDiscountCents / 100).toFixed(2)}</span>
                          </div>
                        )}
                        {quoteData?.weekendSurchargeCents && quoteData.weekendSurchargeCents > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>{isHebrew ? 'תוספת סוף שבוע' : 'Weekend Surcharge'}</span>
                            <span data-testid="price-weekend-surcharge">+₪{(quoteData.weekendSurchargeCents / 100).toFixed(2)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>{isHebrew ? 'עמלת פלטפורמה (10%)' : 'Platform Fee (10%)'}</span>
                          <span data-testid="price-platform-fee">₪{((quoteData?.platformFeeCents || platformFeeCents) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>{isHebrew ? 'מע״מ (18%)' : 'VAT (18%)'}</span>
                          <span data-testid="price-vat">₪{((quoteData?.vatCents || vatCents) / 100).toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 border-purple-300 dark:border-purple-700 pt-2 mt-2">
                          <div className="flex justify-between text-lg font-bold">
                            <span>{isHebrew ? 'סה"כ' : 'Total'}</span>
                            <span className="text-purple-600" data-testid="price-total">₪{((quoteData?.totalCents || totalCents) / 100).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Credit Wallet Integration */}
                  {user && quoteData && (
                    <div className="mb-6">
                      <CreditWalletCard
                        userId={user.uid}
                        platform={platform as 'walker' | 'sitter' | 'pettrek' | 'k9000' | 'plush_lab'}
                        transactionAmountCents={quoteData.totalCents}
                        compact={false}
                        onRedeemCredits={(preview, redemption) => {
                          setAppliedCredits({
                            redemptionSessionId: redemption.sessionId,
                            egiftCents: redemption.creditsApplied.egiftCents,
                            washPackages: redemption.creditsApplied.washPackages,
                            loyaltyPointsCents: redemption.creditsApplied.loyaltyPoints,
                            promoCents: redemption.creditsApplied.promoCents,
                            referralCents: 0,
                            totalCreditsAppliedCents: preview.totalCreditsApplicableCents,
                            cashPaidCents: redemption.cashDueCents,
                          });
                        }}
                      />
                      {appliedCredits && appliedCredits.totalCreditsAppliedCents > 0 && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-green-800 dark:text-green-200 font-medium">
                              {isHebrew ? 'זיכויים הופעלו' : 'Credits Applied'}
                            </span>
                            <span className="text-green-700 dark:text-green-300 font-bold">
                              -₪{(appliedCredits.totalCreditsAppliedCents / 100).toFixed(2)}
                            </span>
                          </div>
                          {appliedCredits.cashPaidCents > 0 && (
                            <div className="flex items-center justify-between text-sm mt-1">
                              <span className="text-gray-600 dark:text-gray-400">
                                {isHebrew ? 'יתרה לתשלום במזומן' : 'Remaining cash payment'}
                              </span>
                              <span className="text-gray-800 dark:text-gray-200 font-semibold">
                                ₪{(appliedCredits.cashPaidCents / 100).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {appliedCredits.cashPaidCents === 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              {isHebrew ? 'מכוסה במלואו על ידי הזיכויים שלך!' : 'Fully covered by your credits!'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Button */}
                  <div className="space-y-4">
                    {/* Lock expiry warning */}
                    {lockSecondsLeft > 0 && lockSecondsLeft <= 60 && (
                      <div className="p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg text-center">
                        <span className="text-amber-800 dark:text-amber-200 font-medium">
                          {isHebrew ? 'ההזמנה תפוג בעוד ' : 'Reservation expires in '}{formatCountdown()}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        onClick={handlePrevStep}
                        className="flex-1"
                        data-testid="button-prev-step"
                        disabled={isSubmitting || checkoutMutation.isPending}
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        {isHebrew ? 'אחורה' : 'Back'}
                      </Button>
                      <Button
                        onClick={handleSubmitBooking}
                        className="flex-1 luxury-btn-primary luxury-shadow-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        data-testid="button-proceed-payment"
                        disabled={isSubmitting || checkoutMutation.isPending || quoteMutation.isPending || lockSecondsLeft <= 0}
                      >
                        {(isSubmitting || checkoutMutation.isPending) ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            {isHebrew ? 'מעבד...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-5 h-5 mr-2" />
                            {appliedCredits && appliedCredits.cashPaidCents === 0
                              ? (isHebrew ? 'אישור הזמנה (מכוסה בזיכויים)' : 'Confirm Booking (Covered by Credits)')
                              : appliedCredits && appliedCredits.cashPaidCents > 0
                                ? (isHebrew ? `המשך לתשלום ₪${(appliedCredits.cashPaidCents / 100).toFixed(2)}` : `Pay ₪${(appliedCredits.cashPaidCents / 100).toFixed(2)} via Nayax`)
                                : (isHebrew ? 'המשך לתשלום (Nayax)' : 'Proceed to Payment (Nayax)')
                            }
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>
                        {appliedCredits && appliedCredits.cashPaidCents === 0
                          ? (isHebrew ? 'מכוסה במלואו על ידי הזיכויים שלך' : 'Fully covered by your wallet credits')
                          : (isHebrew ? 'תשלום מאובטח דרך Nayax Israel' : 'Secure payment via Nayax Israel')
                        }
                      </span>
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
