import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar as CalendarIcon, Clock, DollarSign, Star, Shield, 
  ChevronRight, ChevronLeft, Check, AlertCircle, CreditCard, 
  GraduationCap, Target, MapPin
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/languageStore";
import { Layout } from "@/components/Layout";

type BookingStep = "calendar" | "time-slot" | "session-type" | "payment" | "confirm";

interface Trainer {
  id: number;
  trainerId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  averageRating: string;
  totalSessions: number;
  hourlyRate: string;
  commissionRate: string;
  city: string;
  isCertified: boolean;
  specialties: string[] | null;
}

export default function AcademyBookingFlow() {
  const { trainerId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<BookingStep>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [sessionDuration, setSessionDuration] = useState<number>(60); // minutes
  const [sessionType, setSessionType] = useState<string>("private");
  const [specialNotes, setSpecialNotes] = useState<string>("");
  const [selectedPayment, setSelectedPayment] = useState("");

  // Fetch trainer data
  const { data: trainerData, isLoading } = useQuery<{ trainer: Trainer }>({
    queryKey: [`/api/academy/trainers/${trainerId}`],
  });

  const trainer = trainerData?.trainer;

  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const sessionDurations = [
    { minutes: 60, label: "1 Hour" },
    { minutes: 90, label: "1.5 Hours" },
    { minutes: 120, label: "2 Hours" },
  ];
  const sessionTypes = [
    { id: "private", name: "Private Session", description: "One-on-one training" },
    { id: "group", name: "Group Class", description: "Small group training (2-4 dogs)" },
    { id: "behavior", name: "Behavior Consultation", description: "Specialized behavioral assessment" },
  ];

  // **ISRAELI VAT CALCULATION - 18% ON COMMISSION ONLY (Jan 1, 2025)**
  const calculatePricing = () => {
    if (!trainer) return { baseAmount: 0, commission: 0, vatOnCommission: 0, totalCharged: 0, trainerPayout: 0 };
    
    const hours = sessionDuration / 60;
    const baseAmount = parseFloat(trainer.hourlyRate) * hours;
    const commission = baseAmount * (parseFloat(trainer.commissionRate) / 100);
    const vatOnCommission = commission * 0.18; // Israeli VAT 18% on commission only
    const totalCharged = baseAmount + commission + vatOnCommission;
    const trainerPayout = baseAmount; // Trainer gets full base amount

    return { baseAmount, commission, vatOnCommission, totalCharged, trainerPayout };
  };

  const pricing = calculatePricing();

  const steps: BookingStep[] = ["calendar", "time-slot", "session-type", "payment", "confirm"];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  // **UNIFIED BOOKING API - CONNECTS TO CENTRAL PAYMENTS & LEDGER SERVICE**
  const handleConfirmBooking = async () => {
    try {
      if (!trainer) throw new Error("Trainer data not loaded");

      await apiRequest("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          platform: "academy",
          providerId: trainerId,
          serviceDate: selectedDate,
          timeSlot: selectedTimeSlot,
          sessionDuration,
          sessionType,
          specialNotes,
          baseAmount: pricing.baseAmount,
          commission: pricing.commission,
          vatOnCommission: pricing.vatOnCommission,
          totalAmount: pricing.totalCharged,
          currency: "ILS",
          metadata: {
            paymentMethod: selectedPayment,
            trainerName: trainer.fullName,
            sessionTypeDetails: sessionTypes.find(t => t.id === sessionType),
          },
        }),
      });

      toast({
        title: "Training Session Booked! 🎓",
        description: `Session confirmed with ${trainer.fullName}. 72-hour payment hold placed for ₪${pricing.totalCharged.toFixed(2)}. Processed by Pet Wash™ Ltd.`,
      });

      setTimeout(() => setLocation("/academy/owner/dashboard"), 2000);
    } catch (error) {
      toast({
        title: "Booking Failed",
        description: "There was an error creating your booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "calendar": return !!selectedDate;
      case "time-slot": return !!selectedTimeSlot;
      case "session-type": return !!sessionType && sessionDuration > 0;
      case "payment": return !!selectedPayment;
      default: return true;
    }
  };

  if (isLoading || !trainer) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('Loading booking flow...')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#FAFAFA]">
        {/* Header with Trainer Info */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  {trainer.profilePhotoUrl ? (
                    <AvatarImage src={trainer.profilePhotoUrl} alt={trainer.fullName} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-purple-400 to-blue-400 text-white">
                      {trainer.fullName.charAt(0)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h2 className="font-semibold text-gray-900">{trainer.fullName}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span>{trainer.averageRating} ({trainer.totalSessions} sessions)</span>
                    {trainer.isCertified && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">Certified</Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  ₪{pricing.totalCharged.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">{sessionDuration / 60} hour session</div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`flex flex-col items-center ${index <= currentStepIndex ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      index < currentStepIndex 
                        ? 'bg-green-500 text-white'
                        : index === currentStepIndex
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {index < currentStepIndex ? <Check className="h-5 w-5" /> : index + 1}
                    </div>
                    <div className="text-xs font-medium text-gray-900 capitalize">
                      {step.replace("-", " ")}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-1 mx-2 ${index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Left Column - Step Content */}
              <div className="md:col-span-2">
                <Card>
                  <CardContent className="p-6">
                    {/* Step 1: Calendar */}
                    {currentStep === "calendar" && (
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                          <CalendarIcon className="h-6 w-6 text-purple-600" />
                          {t('Select Training Date')}
                        </h3>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => date < new Date()}
                          className="rounded-md border mx-auto"
                        />
                      </div>
                    )}

                    {/* Step 2: Time Slot */}
                    {currentStep === "time-slot" && (
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                          <Clock className="h-6 w-6 text-purple-600" />
                          {t('Choose Time Slot')}
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {timeSlots.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`p-4 rounded-lg border-2 text-center transition-all ${
                                selectedTimeSlot === slot
                                  ? 'border-purple-600 bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300'
                              }`}
                            >
                              <Clock className="h-5 w-5 mx-auto mb-2 text-gray-600" />
                              <div className="font-semibold">{slot}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 3: Session Type & Duration */}
                    {currentStep === "session-type" && (
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                          <Target className="h-6 w-6 text-purple-600" />
                          {t('Session Details')}
                        </h3>
                        
                        <div className="space-y-6">
                          {/* Duration Selection */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                              {t('Session Duration')}
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                              {sessionDurations.map((duration) => (
                                <button
                                  key={duration.minutes}
                                  onClick={() => setSessionDuration(duration.minutes)}
                                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                                    sessionDuration === duration.minutes
                                      ? 'border-purple-600 bg-purple-50'
                                      : 'border-gray-200 hover:border-purple-300'
                                  }`}
                                >
                                  <div className="font-semibold">{duration.label}</div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    ₪{(parseFloat(trainer.hourlyRate) * (duration.minutes / 60)).toFixed(0)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Session Type Selection */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                              {t('Training Type')}
                            </label>
                            <div className="space-y-3">
                              {sessionTypes.map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => setSessionType(type.id)}
                                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                    sessionType === type.id
                                      ? 'border-purple-600 bg-purple-50'
                                      : 'border-gray-200 hover:border-purple-300'
                                  }`}
                                >
                                  <div className="font-semibold text-gray-900">{type.name}</div>
                                  <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Special Notes */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              {t('Special Notes (Optional)')}
                            </label>
                            <textarea
                              value={specialNotes}
                              onChange={(e) => setSpecialNotes(e.target.value)}
                              placeholder={t('Any special requirements or behavioral notes...')}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 resize-none"
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 4: Payment */}
                    {currentStep === "payment" && (
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                          <CreditCard className="h-6 w-6 text-purple-600" />
                          {t('Payment Method')}
                        </h3>
                        
                        <div className="space-y-3 mb-6">
                          {[
                            { id: "nayax-credit", name: "Credit Card (Nayax Israel)", icon: CreditCard },
                            { id: "nayax-applepay", name: "Apple Pay (via Nayax)", icon: Shield },
                            { id: "nayax-googlepay", name: "Google Pay (via Nayax)", icon: Shield },
                          ].map((method) => (
                            <button
                              key={method.id}
                              onClick={() => setSelectedPayment(method.id)}
                              className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                                selectedPayment === method.id
                                  ? 'border-purple-600 bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300'
                              }`}
                            >
                              <method.icon className="h-5 w-5 text-gray-600" />
                              <span className="font-medium text-gray-900">{method.name}</span>
                            </button>
                          ))}
                        </div>

                        {/* Security Message */}
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                          <div className="flex items-start gap-3">
                            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                            <div className="text-sm text-green-900">
                              <div className="font-semibold mb-1">{t('Secure Payment Processing')}</div>
                              <div>{t('All payments processed exclusively by Pet Wash™ Ltd through Nayax Israel. PCI DSS compliant.')}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 5: Confirmation */}
                    {currentStep === "confirm" && (
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                          <Check className="h-6 w-6 text-green-600" />
                          {t('Confirm Booking')}
                        </h3>
                        
                        <div className="space-y-6">
                          {/* Booking Summary */}
                          <div className="p-4 rounded-lg bg-gray-50">
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('Date')}</span>
                                <span className="font-semibold">
                                  {selectedDate?.toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('Time')}</span>
                                <span className="font-semibold">{selectedTimeSlot}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('Duration')}</span>
                                <span className="font-semibold">{sessionDuration / 60} hour(s)</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('Session Type')}</span>
                                <span className="font-semibold">
                                  {sessionTypes.find(t => t.id === sessionType)?.name}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 72-Hour Escrow Messaging */}
                          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                            <div className="flex items-start gap-3">
                              <Shield className="h-5 w-5 text-purple-600 mt-0.5" />
                              <div className="text-sm text-purple-900">
                                <div className="font-semibold mb-1">{t('72-Hour Payment Protection')}</div>
                                <div>{t('Payment held in escrow for 72 hours after session completion. Automatically released to trainer if no issues reported.')}</div>
                              </div>
                            </div>
                          </div>

                          {/* Terms Agreement */}
                          <div className="flex items-start gap-3">
                            <Checkbox id="terms" />
                            <label htmlFor="terms" className="text-sm text-gray-600">
                              {t('I agree to the terms of service and cancellation policy. All payments processed by Pet Wash™ Ltd.')}
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t">
                      {currentStepIndex > 0 && (
                        <Button variant="outline" onClick={handleBack} className="gap-2">
                          <ChevronLeft className="h-4 w-4" />
                          {t('Back')}
                        </Button>
                      )}
                      
                      <div className="flex-1" />

                      {currentStep !== "confirm" ? (
                        <Button
                          onClick={handleNext}
                          disabled={!canProceed()}
                          className="bg-purple-600 hover:bg-purple-700 gap-2"
                        >
                          {t('Continue')}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleConfirmBooking}
                          disabled={!canProceed()}
                          className="bg-green-600 hover:bg-green-700 gap-2"
                        >
                          <Check className="h-4 w-4" />
                          {t('Confirm Booking')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Pricing Summary */}
              <div className="md:col-span-1">
                <div className="sticky top-6">
                  <Card>
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-gray-900 mb-4">{t('Price Breakdown')}</h4>
                      
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>{t('Trainer Rate')} ({sessionDuration / 60}h)</span>
                          <span>₪{pricing.baseAmount.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between text-gray-600">
                          <span>{t('Platform Fee')} ({parseFloat(trainer.commissionRate).toFixed(0)}%)</span>
                          <span>₪{pricing.commission.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between text-gray-600">
                          <span>{t('Israeli VAT on Fee')} (18%)</span>
                          <span>₪{pricing.vatOnCommission.toFixed(2)}</span>
                        </div>
                        
                        <Separator />
                        
                        <div className="flex justify-between font-semibold text-gray-900 text-base">
                          <span>{t('Total')}</span>
                          <span>₪{pricing.totalCharged.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-6 p-3 rounded-lg bg-gray-50 text-xs text-gray-600 space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-3 w-3 text-green-600 mt-0.5" />
                          <span>{t('Processed by Pet Wash™ Ltd')}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-3 w-3 text-green-600 mt-0.5" />
                          <span>{t('72-hour escrow protection')}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-3 w-3 text-green-600 mt-0.5" />
                          <span>{t('Trainer receives ₪' + pricing.trainerPayout.toFixed(2))}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
