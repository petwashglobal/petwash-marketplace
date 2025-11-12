import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { Calendar as CalendarIcon, Clock, MapPin, DollarSign, Star, Check, AlertCircle, CreditCard, Shield, ChevronRight, ChevronLeft, PawPrint, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BookingStep = "calendar" | "time-slot" | "walk-type" | "pet-selection" | "payment" | "confirm";

export default function WalkMyPetBookingFlow() {
  const { walkerId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<BookingStep>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [walkType, setWalkType] = useState<"one-time" | "recurring">("one-time");
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [selectedPayment, setSelectedPayment] = useState("");

  const walker = {
    id: walkerId,
    name: "Sarah Cohen",
    photo: "https://i.pravatar.cc/150?img=1",
    rating: 4.9,
    reviewCount: 89,
    verified: true,
    baseRate: 45,
    platformCommission: 0.15,
    location: "Tel Aviv, Israel",
    availability: ["Mon", "Wed", "Fri", "Sat", "Sun"]
  };

  const userPets = [
    { id: "1", name: "Max", type: "Dog", breed: "Golden Retriever" },
    { id: "2", name: "Bella", type: "Dog", breed: "Labrador" }
  ];

  const timeSlots = ["08:00", "09:00", "10:00", "16:00", "17:00", "18:00"];
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const calculatePricing = () => {
    const baseAmount = walker.baseRate * selectedPets.length;
    const commission = baseAmount * walker.platformCommission;
    const vatOnCommission = commission * 0.18;
    const totalCharged = baseAmount + commission + vatOnCommission;

    return { baseAmount, commission, vatOnCommission, totalCharged };
  };

  const pricing = calculatePricing();

  const steps: BookingStep[] = ["calendar", "time-slot", "walk-type", "pet-selection", "payment", "confirm"];
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

  const handleConfirmBooking = async () => {
    try {
      await apiRequest("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          platform: "walk-my-pet",
          providerId: walkerId,
          serviceDate: selectedDate,
          timeSlot: selectedTimeSlot,
          walkType,
          recurringDays: walkType === "recurring" ? recurringDays : undefined,
          petIds: selectedPets,
          baseAmount: pricing.baseAmount,
          metadata: {
            paymentMethod: selectedPayment,
          },
        }),
      });

      toast({
        title: "Walk Booked! 🐕",
        description: `${walkType === "recurring" ? "Recurring walk" : "Walk"} confirmed with ${walker.name}. Escrow hold placed for ₪${pricing.totalCharged.toFixed(2)}.`,
      });

      setTimeout(() => setLocation("/walk-my-pet/owner/dashboard"), 2000);
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
      case "walk-type": return walkType === "one-time" || recurringDays.length > 0;
      case "pet-selection": return selectedPets.length > 0;
      case "payment": return !!selectedPayment;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" className="mb-4" onClick={() => setLocation("/walk-my-pet")} data-testid="button-back">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Walkers
          </Button>
          
          <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent" data-testid="page-title">
            Book {walker.name}
          </h1>

          <div className="flex items-center justify-between max-w-4xl" data-testid="stepper-booking-flow">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${index <= currentStepIndex ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`} data-testid={`step-indicator-${index}`}>
                    {index < currentStepIndex ? <Check className="h-5 w-5" /> : index + 1}
                  </div>
                  <span className="text-xs mt-2 text-slate-600 hidden sm:block capitalize">{step.replace("-", " ")}</span>
                </div>
                {index < steps.length - 1 && <div className={`h-1 flex-1 mx-2 ${index < currentStepIndex ? 'bg-gradient-to-r from-amber-500 to-yellow-600' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {currentStep === "calendar" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-calendar">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-amber-500" />
                  Select Start Date
                </h2>
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} disabled={(date) => date < new Date()} data-testid="calendar-date-picker" />
              </Card>
            )}

            {currentStep === "time-slot" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-time-slot">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Choose Time
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {timeSlots.map((slot) => (
                    <button key={slot} onClick={() => setSelectedTimeSlot(slot)} className={`p-4 rounded-lg border-2 transition-all ${selectedTimeSlot === slot ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-slate-200 hover:border-amber-300'}`} data-testid={`button-time-${slot}`}>
                      <div className="font-semibold text-slate-900">{slot}</div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {currentStep === "walk-type" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-walk-type">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-amber-500" />
                  Walk Schedule
                </h2>
                <div className="space-y-4">
                  <button onClick={() => setWalkType("one-time")} className={`w-full p-6 rounded-lg border-2 text-left transition-all ${walkType === "one-time" ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-slate-200 hover:border-amber-300'}`} data-testid="button-walk-one-time">
                    <div className="font-semibold text-lg mb-1">One-Time Walk</div>
                    <div className="text-sm text-slate-600">Single walk on selected date</div>
                  </button>
                  <button onClick={() => setWalkType("recurring")} className={`w-full p-6 rounded-lg border-2 text-left transition-all ${walkType === "recurring" ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-slate-200 hover:border-amber-300'}`} data-testid="button-walk-recurring">
                    <div className="font-semibold text-lg mb-1">Recurring Walks</div>
                    <div className="text-sm text-slate-600">Weekly schedule for regular walks</div>
                  </button>

                  {walkType === "recurring" && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                      <div className="text-sm font-medium text-slate-700 mb-3">Select Days</div>
                      <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day) => (
                          <button key={day} onClick={() => setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={`p-3 rounded-lg text-sm font-semibold transition-all ${recurringDays.includes(day) ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`} data-testid={`button-day-${day}`}>
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {currentStep === "pet-selection" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-pet-selection">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <PawPrint className="h-5 w-5 text-amber-500" />
                  Select Pets
                </h2>
                <div className="space-y-3">
                  {userPets.map((pet) => (
                    <div key={pet.id} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedPets.includes(pet.id) ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`} onClick={() => setSelectedPets(prev => prev.includes(pet.id) ? prev.filter(id => id !== pet.id) : [...prev, pet.id])} data-testid={`button-select-pet-${pet.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 flex items-center justify-center text-white font-bold">{pet.name[0]}</div>
                          <div>
                            <div className="font-semibold text-slate-900">{pet.name}</div>
                            <div className="text-sm text-slate-600">{pet.breed}</div>
                          </div>
                        </div>
                        {selectedPets.includes(pet.id) && <Check className="h-5 w-5 text-amber-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {currentStep === "payment" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-payment">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-amber-500" />
                  Payment Method
                </h2>
                <div className="space-y-3">
                  {["Credit Card (Nayax)", "Apple Pay", "Google Pay"].map((method) => (
                    <button key={method} onClick={() => setSelectedPayment(method)} className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between ${selectedPayment === method ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-slate-200 hover:border-amber-300'}`} data-testid={`button-payment-${method}`}>
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-amber-500" />
                        <span className="font-semibold text-slate-900">{method}</span>
                      </div>
                      {selectedPayment === method && <Check className="h-5 w-5 text-amber-500" />}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {currentStep === "confirm" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-confirm">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Review Booking</h2>
                  <p className="text-slate-600">Confirm all details</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Walker</span>
                    <span className="font-semibold">{walker.name}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Date</span>
                    <span className="font-semibold">{selectedDate?.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Time</span>
                    <span className="font-semibold">{selectedTimeSlot}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Type</span>
                    <span className="font-semibold capitalize">{walkType}{walkType === "recurring" && ` (${recurringDays.join(", ")})`}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Pets</span>
                    <span className="font-semibold">{selectedPets.length} pet(s)</span>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between">
              {currentStepIndex > 0 && (
                <Button variant="outline" onClick={handleBack} className="gap-2" data-testid="button-back-step">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              
              {currentStep !== "confirm" ? (
                <Button onClick={handleNext} disabled={!canProceed()} className={`gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white ${currentStepIndex === 0 ? 'ml-auto' : ''}`} data-testid="button-next">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleConfirmBooking} className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white ml-auto" data-testid="button-confirm-booking">
                  Confirm Booking
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 sticky top-4" data-testid="card-walker-info">
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-16 w-16 border-2 border-amber-400 shadow-lg">
                  <AvatarImage src={walker.photo} />
                  <AvatarFallback>SC</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{walker.name}</h3>
                    {walker.verified && <Badge className="bg-blue-500 text-white text-xs">Verified</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-sm mb-2">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{walker.rating}</span>
                    <span className="text-slate-500">({walker.reviewCount})</span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 mb-3">Price Breakdown</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Base Rate ({selectedPets.length} pet{selectedPets.length !== 1 ? 's' : ''})</span>
                  <span className="font-medium">₪{pricing.baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Commission (15%)</span>
                  <span className="font-medium">₪{pricing.commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">VAT (18%)</span>
                  <span className="font-medium">₪{pricing.vatOnCommission.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                    ₪{pricing.totalCharged.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
