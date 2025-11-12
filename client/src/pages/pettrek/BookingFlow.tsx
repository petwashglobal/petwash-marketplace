import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { MapPin, Clock, DollarSign, Star, Check, CreditCard, ChevronRight, ChevronLeft, Car, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BookingStep = "route" | "schedule" | "pet-details" | "payment" | "confirm";

export default function PetTrekBookingFlow() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<BookingStep>("route");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [selectedPayment, setSelectedPayment] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState(125);

  const userPets = [
    { id: "1", name: "Max", type: "Dog", size: "Large" },
    { id: "2", name: "Bella", type: "Cat", size: "Medium" }
  ];

  const calculatePricing = () => {
    const baseAmount = estimatedPrice;
    const commission = baseAmount * 0.15;
    const vatOnCommission = commission * 0.18;
    const totalCharged = baseAmount + commission + vatOnCommission;

    return { baseAmount, commission, vatOnCommission, totalCharged };
  };

  const pricing = calculatePricing();

  const steps: BookingStep[] = ["route", "schedule", "pet-details", "payment", "confirm"];
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
          platform: "pettrek",
          providerId: "auto-assign", // PetTrek auto-assigns drivers
          serviceDate: selectedDateTime,
          pickupAddress,
          dropoffAddress,
          petIds: selectedPets,
          baseAmount: pricing.baseAmount,
          metadata: {
            estimatedPrice,
            paymentMethod: selectedPayment,
          },
        }),
      });

      toast({
        title: "Trip Booked! 🚗",
        description: `Your PetTrek ride has been confirmed. Escrow hold placed for ₪${pricing.totalCharged.toFixed(2)}.`,
      });

      setTimeout(() => setLocation("/pettrek/customer/dashboard"), 2000);
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
      case "route": return pickupAddress && dropoffAddress;
      case "schedule": return !!selectedDateTime;
      case "pet-details": return selectedPets.length > 0;
      case "payment": return !!selectedPayment;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" className="mb-4" onClick={() => setLocation("/pettrek")} data-testid="button-back">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent" data-testid="page-title">
            Book a PetTrek Ride
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
            
            {currentStep === "route" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-route">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-amber-500" />
                  Trip Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pickup">Pickup Address</Label>
                    <Input id="pickup" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Enter pickup location" className="mt-1" data-testid="input-pickup" />
                  </div>
                  <div>
                    <Label htmlFor="dropoff">Dropoff Address</Label>
                    <Input id="dropoff" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder="Enter destination" className="mt-1" data-testid="input-dropoff" />
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <Car className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-blue-900 text-sm">Estimated Distance</div>
                        <div className="text-xs text-blue-700 mt-1">~18.5 km • 35 min drive</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {currentStep === "schedule" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-schedule">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Schedule Pickup
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="datetime">Pickup Date & Time</Label>
                    <Input id="datetime" type="datetime-local" value={selectedDateTime} onChange={(e) => setSelectedDateTime(e.target.value)} className="mt-1" data-testid="input-datetime" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="p-4 rounded-lg border-2 border-slate-200 hover:border-amber-300 transition-all" data-testid="button-asap">
                      <div className="font-semibold text-slate-900">ASAP</div>
                      <div className="text-xs text-slate-600 mt-1">Driver arrives in ~10 min</div>
                    </button>
                    <button className="p-4 rounded-lg border-2 border-slate-200 hover:border-amber-300 transition-all" data-testid="button-scheduled">
                      <div className="font-semibold text-slate-900">Scheduled</div>
                      <div className="text-xs text-slate-600 mt-1">Choose date & time</div>
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {currentStep === "pet-details" && (
              <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-step-pet-details">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-amber-500" />
                  Pet Passengers
                </h2>
                <div className="space-y-3">
                  {userPets.map((pet) => (
                    <div key={pet.id} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedPets.includes(pet.id) ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`} onClick={() => setSelectedPets(prev => prev.includes(pet.id) ? prev.filter(id => id !== pet.id) : [...prev, pet.id])} data-testid={`button-select-pet-${pet.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 flex items-center justify-center text-white font-bold">{pet.name[0]}</div>
                          <div>
                            <div className="font-semibold text-slate-900">{pet.name}</div>
                            <div className="text-sm text-slate-600">{pet.type} • {pet.size}</div>
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
                  <h2 className="text-2xl font-bold mb-2">Review Trip</h2>
                  <p className="text-slate-600">Confirm all details</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Pickup</span>
                    <span className="font-semibold text-right">{pickupAddress}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Dropoff</span>
                    <span className="font-semibold text-right">{dropoffAddress}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-slate-600">Pickup Time</span>
                    <span className="font-semibold">{selectedDateTime || "ASAP"}</span>
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
            <Card className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 sticky top-4" data-testid="card-price-summary">
              <h4 className="font-semibold text-slate-900 mb-4">Price Estimate</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Base Fare</span>
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
