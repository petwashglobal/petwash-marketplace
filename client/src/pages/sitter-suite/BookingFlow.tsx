import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { Calendar as CalendarIcon, Clock, DollarSign, Star, Check, AlertCircle, CreditCard, FileText, Shield, ChevronRight, ChevronLeft, User, Home, PawPrint } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BookingStep = "calendar" | "time-slots" | "pet-details" | "payment" | "contract" | "confirm";

export default function SitterBookingFlow() {
  const { sitterId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<BookingStep>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [acceptedContract, setAcceptedContract] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("");
  const [duration, setDuration] = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");

  // Mock sitter data - will be fetched from API
  const sitter = {
    id: sitterId,
    name: "Sarah Cohen",
    photo: "https://i.pravatar.cc/150?img=1",
    rating: 4.9,
    reviewCount: 127,
    responseTime: "< 2 hours",
    experienceYears: 5,
    verified: true,
    baseRate: 120, // Base daily rate in ILS
    platformCommission: 0.15, // 15% commission
    insuranceIncluded: true,
    services: ["Overnight Sitting", "Daily Visits", "Dog Walking", "Medication"],
    location: "Tel Aviv, Israel"
  };

  // Mock user pets
  const userPets = [
    { id: "1", name: "Max", type: "Dog", breed: "Golden Retriever" },
    { id: "2", name: "Luna", type: "Cat", breed: "Persian" }
  ];

  // Available time slots
  const timeSlots = [
    "08:00 - 12:00",
    "12:00 - 16:00",
    "16:00 - 20:00",
    "20:00 - 24:00",
    "Full Day (24hrs)"
  ];

  // Calculate pricing with Israeli VAT (18% on platform commission only)
  const calculatePricing = () => {
    const baseAmount = sitter.baseRate;
    const commission = baseAmount * sitter.platformCommission;
    const vatOnCommission = commission * 0.18; // Israeli VAT 18% (effective Jan 1, 2025)
    const totalToPlatform = commission + vatOnCommission;
    const totalCharged = baseAmount + totalToPlatform;

    return {
      baseAmount,
      commission,
      vatOnCommission,
      totalToPlatform,
      totalCharged,
      sitterReceives: baseAmount
    };
  };

  const pricing = calculatePricing();

  const steps: BookingStep[] = ["calendar", "time-slots", "pet-details", "payment", "contract", "confirm"];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handleConfirmBooking = async () => {
    try {
      // Create booking via API with auth
      const data = await apiRequest("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          platform: "sitter-suite",
          providerId: sitterId,
          serviceDate: selectedDate,
          timeSlot: selectedTimeSlot,
          duration: duration,
          petIds: selectedPets,
          baseAmount: pricing.baseAmount,
          metadata: {
            specialRequests,
            contractAccepted: acceptedContract,
            paymentMethod: selectedPayment,
          },
        }),
      });

      toast({
        title: "Booking Confirmed! 🎉",
        description: `Escrow hold placed for ₪${pricing.totalCharged.toFixed(2)}. Payment will be released to sitter after service completion.`,
      });

      // Redirect to owner dashboard
      setTimeout(() => {
        setLocation("/sitter-suite/owner/dashboard");
      }, 2000);
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
      case "calendar":
        return !!selectedDate;
      case "time-slots":
        return !!selectedTimeSlot;
      case "pet-details":
        return selectedPets.length > 0;
      case "payment":
        return !!selectedPayment;
      case "contract":
        return acceptedContract;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header with Stepper */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => setLocation("/sitter-suite")}
            data-testid="button-back-to-sitters"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Sitters
          </Button>
          
          <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent" data-testid="page-title">
            Book {sitter.name}
          </h1>

          {/* Progress Stepper */}
          <div className="flex items-center justify-between max-w-4xl" data-testid="stepper-booking-flow">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${index <= currentStepIndex 
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg' 
                      : 'bg-slate-200 text-slate-400'}
                  `} data-testid={`step-indicator-${index}`}>
                    {index < currentStepIndex ? <Check className="h-5 w-5" /> : index + 1}
                  </div>
                  <span className="text-xs mt-2 text-slate-600 hidden sm:block capitalize">
                    {step.replace("-", " ")}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 ${index < currentStepIndex ? 'bg-gradient-to-r from-amber-500 to-yellow-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Booking Steps */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Calendar */}
            {currentStep === "calendar" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-calendar">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-amber-500" />
                  Select Date
                </h2>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-lg border-0"
                  disabled={(date) => date < new Date()}
                  data-testid="calendar-date-picker"
                />
              </Card>
            )}

            {/* Step 2: Time Slots */}
            {currentStep === "time-slots" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-time-slots">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Choose Time Slot
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`
                        p-4 rounded-lg border-2 text-left transition-all
                        ${selectedTimeSlot === slot 
                          ? 'border-amber-500 bg-amber-50 shadow-md' 
                          : 'border-slate-200 hover:border-amber-300'}
                      `}
                      data-testid={`button-time-slot-${slot}`}
                    >
                      <div className="font-semibold text-slate-900">{slot}</div>
                      <div className="text-sm text-slate-600">Available</div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Step 3: Pet Details */}
            {currentStep === "pet-details" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-pet-details">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <PawPrint className="h-5 w-5 text-amber-500" />
                  Select Pets
                </h2>
                <div className="space-y-3">
                  {userPets.map((pet) => (
                    <div
                      key={pet.id}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedPets.includes(pet.id) 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-slate-200 hover:border-amber-300'}
                      `}
                      onClick={() => {
                        setSelectedPets(prev => 
                          prev.includes(pet.id) 
                            ? prev.filter(id => id !== pet.id)
                            : [...prev, pet.id]
                        );
                      }}
                      data-testid={`button-select-pet-${pet.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 flex items-center justify-center text-white font-bold">
                            {pet.name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{pet.name}</div>
                            <div className="text-sm text-slate-600">{pet.breed} • {pet.type}</div>
                          </div>
                        </div>
                        {selectedPets.includes(pet.id) && <Check className="h-5 w-5 text-amber-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Step 4: Payment Method */}
            {currentStep === "payment" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-payment">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-amber-500" />
                  Payment Method
                </h2>
                <div className="space-y-3">
                  {["Credit Card (Nayax)", "Apple Pay", "Google Pay"].map((method) => (
                    <button
                      key={method}
                      onClick={() => setSelectedPayment(method)}
                      className={`
                        w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between
                        ${selectedPayment === method 
                          ? 'border-amber-500 bg-amber-50 shadow-md' 
                          : 'border-slate-200 hover:border-amber-300'}
                      `}
                      data-testid={`button-payment-${method}`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-amber-500" />
                        <span className="font-semibold text-slate-900">{method}</span>
                      </div>
                      {selectedPayment === method && <Check className="h-5 w-5 text-amber-500" />}
                    </button>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-blue-900 text-sm">Escrow Protection</div>
                      <div className="text-xs text-blue-700 mt-1">
                        Payment held securely for 72 hours. Funds released to sitter after successful service completion.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Step 5: Contract */}
            {currentStep === "contract" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-contract">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Service Agreement
                </h2>
                <div className="prose max-w-none text-sm text-slate-600 bg-slate-50 p-4 rounded-lg max-h-96 overflow-y-auto mb-4">
                  <h3 className="text-base font-semibold text-slate-900">Pet Sitting Service Agreement</h3>
                  <p>This agreement is between the Pet Owner and {sitter.name} for pet sitting services.</p>
                  <h4 className="text-sm font-semibold text-slate-900 mt-4">1. Services Provided</h4>
                  <p>The sitter agrees to provide care for the pet(s) during the scheduled period.</p>
                  <h4 className="text-sm font-semibold text-slate-900 mt-4">2. Liability</h4>
                  <p>The sitter maintains insurance coverage for pet-related incidents.</p>
                  <h4 className="text-sm font-semibold text-slate-900 mt-4">3. Cancellation Policy</h4>
                  <p>Cancellations within 24 hours incur a 50% fee. Full refund if cancelled 48+ hours in advance.</p>
                  <h4 className="text-sm font-semibold text-slate-900 mt-4">4. Payment Terms</h4>
                  <p>Payment is processed through Pet Wash Group escrow. Funds released after service completion.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="contract"
                    checked={acceptedContract}
                    onCheckedChange={(checked) => setAcceptedContract(checked as boolean)}
                    data-testid="checkbox-accept-contract"
                  />
                  <label htmlFor="contract" className="text-sm text-slate-700 cursor-pointer">
                    I have read and agree to the Service Agreement and understand the cancellation policy
                  </label>
                </div>
              </Card>
            )}

            {/* Step 6: Confirmation */}
            {currentStep === "confirm" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-confirm">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Review Your Booking</h2>
                  <p className="text-slate-600">Please confirm all details before finalizing</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-slate-600">Sitter</span>
                    <span className="font-semibold">{sitter.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-slate-600">Date</span>
                    <span className="font-semibold">{selectedDate?.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-slate-600">Time</span>
                    <span className="font-semibold">{selectedTimeSlot}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-slate-600">Pets</span>
                    <span className="font-semibold">{selectedPets.length} pet(s)</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-slate-600">Payment</span>
                    <span className="font-semibold">{selectedPayment}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between">
              {currentStepIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="gap-2"
                  data-testid="button-back"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              
              {currentStep !== "confirm" ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={`gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white ${currentStepIndex === 0 ? 'ml-auto' : ''}`}
                  data-testid="button-next"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmBooking}
                  className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white ml-auto"
                  data-testid="button-confirm-booking"
                >
                  Confirm Booking
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Right Column - Sitter Info & Price Summary */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Sitter Card */}
            <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 sticky top-4" data-testid="card-sitter-info">
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-16 w-16 border-2 border-amber-400 shadow-lg">
                  <AvatarImage src={sitter.photo} />
                  <AvatarFallback>SC</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{sitter.name}</h3>
                    {sitter.verified && <Badge className="bg-blue-500 text-white text-xs">Verified</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-sm mb-2">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{sitter.rating}</span>
                    <span className="text-slate-500">({sitter.reviewCount} reviews)</span>
                  </div>
                  <div className="text-xs text-slate-600">{sitter.location}</div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Pricing Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 mb-3">Price Breakdown</h4>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Base Rate</span>
                  <span className="font-medium">₪{pricing.baseAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Platform Commission (15%)</span>
                  <span className="font-medium">₪{pricing.commission.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">VAT on Commission (18%)</span>
                  <span className="font-medium">₪{pricing.vatOnCommission.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                    ₪{pricing.totalCharged.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-slate-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-700">Israeli VAT Compliance</div>
                      <div className="mt-1">18% VAT applied only to platform commission (₪{pricing.commission.toFixed(2)}), not to sitter's base rate. (Effective Jan 1, 2025)</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
