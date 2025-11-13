import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Clock, User, CreditCard, Check, ChevronLeft, PawPrint } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BookingStep = "datetime" | "pets" | "review";

export default function WalkBookingFlow() {
  const { walkerId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const walkerIdNumber = walkerId ? parseInt(walkerId) : undefined;
  
  const [currentStep, setCurrentStep] = useState<BookingStep>("datetime");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedPets, setSelectedPets] = useState<number[]>([]);

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/providers'],
    enabled: true,
  });

  const { data: userPets = [], isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: currentStep === 'pets',
  });

  const timeSlots = ["08:00", "09:00", "10:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  const selectedWalker = providers.find((p: any) => Number(p.id) === walkerIdNumber);

  const steps: BookingStep[] = ["datetime", "pets", "review"];
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
      // CRITICAL: Validate all required data before booking
      if (!selectedWalker) {
        throw new Error("Walker information is missing. Please try again.");
      }
      
      if (!walkerIdNumber || isNaN(walkerIdNumber)) {
        throw new Error("Invalid walker ID. Please select a walker.");
      }
      
      if (!selectedDate || !selectedTimeSlot) {
        throw new Error("Please select both date and time.");
      }
      
      if (selectedPets.length === 0) {
        throw new Error("Please select at least one pet.");
      }

      const startTime = new Date(selectedDate);
      const [hours, minutes] = selectedTimeSlot.split(":");
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 60); // 60-minute walk

      // Validate pricing data exists
      const hourlyRate = selectedWalker.hourlyRate;
      if (!hourlyRate || hourlyRate <= 0) {
        throw new Error("Walker pricing information is missing. Please contact support.");
      }

      const payload = {
        providerId: walkerIdNumber,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        petIds: selectedPets,
        items: [
          {
            itemType: 'service',
            name: 'Dog Walking Service',
            nameHe: 'שירות הליכה עם הכלב',
            unitPrice: hourlyRate
          }
        ],
        platformData: {
          walkerName: selectedWalker.businessName || selectedWalker.displayName || 'Professional Walker',
          serviceArea: selectedWalker.serviceArea || 'Service Area',
          paymentMethod: 'stripe-connect',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const booking = await apiRequest(`/api/platforms/walk_my_pet/bookings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast({
        title: "Walk Booked! 🐾",
        description: `Your dog walk is confirmed. Booking #${booking.bookingNumber}. GPS tracking will be available during the walk.`,
      });

      setTimeout(() => setLocation("/walk-my-pet/owner/dashboard"), 2000);
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "There was an error creating your booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const togglePet = (petId: number) => {
    setSelectedPets(prev => 
      prev.includes(petId) 
        ? prev.filter(id => id !== petId)
        : [...prev, petId]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case "datetime": return !!selectedDate && !!selectedTimeSlot;
      case "pets": return selectedPets.length > 0;
      default: return true;
    }
  };

  // DEFENSIVE: Loading state
  if (providersLoading || petsLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-light">Loading booking information...</p>
        </div>
      </div>
    );
  }

  // DEFENSIVE: Invalid walker ID
  if (!walkerIdNumber || isNaN(walkerIdNumber)) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-light mb-4 text-gray-900 dark:text-gray-100">Invalid Walker</h2>
          <p className="text-gray-600 dark:text-gray-400 font-light mb-6">
            The walker ID is not valid.
          </p>
          <Button onClick={() => setLocation("/walk-my-pet")} className="bg-black dark:bg-white text-white dark:text-black font-light">
            Back to Walkers
          </Button>
        </div>
      </div>
    );
  }

  // DEFENSIVE: Walker not found in provider list
  if (!selectedWalker) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-light mb-4 text-gray-900 dark:text-gray-100">Walker Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 font-light mb-6">
            This walker is not currently available.
          </p>
          <Button onClick={() => setLocation("/walk-my-pet")} className="bg-black dark:bg-white text-white dark:text-black font-light">
            Back to Walkers
          </Button>
        </div>
      </div>
    );
  }

  // DEFENSIVE: No pets available - use useEffect to prevent toast spam
  useEffect(() => {
    if (currentStep === 'pets' && !petsLoading && userPets.length === 0) {
      toast({
        title: "No Pets Found",
        description: "Please add a pet to your profile before booking a walk.",
        variant: "destructive",
      });
    }
  }, [currentStep, petsLoading, userPets.length, toast]);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button 
            variant="ghost" 
            className="mb-4 text-gray-600 dark:text-gray-400 font-light" 
            onClick={() => setLocation("/walk-my-pet")} 
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Walkers
          </Button>
          
          <h1 className="text-2xl font-light mb-6 text-gray-900 dark:text-gray-100" data-testid="page-title">
            Book Walk with {selectedWalker.businessName || selectedWalker.displayName || 'Walker'}
          </h1>

          <div className="flex items-center justify-between max-w-4xl" data-testid="stepper-booking-flow">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-light border-2 ${
                      index <= currentStepIndex 
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                        : 'bg-white dark:bg-black text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-700'
                    }`} 
                    data-testid={`step-indicator-${index}`}
                  >
                    {index < currentStepIndex ? <Check className="h-5 w-5" /> : index + 1}
                  </div>
                  <span className="text-xs mt-2 text-gray-600 dark:text-gray-400 hidden sm:block capitalize font-light">
                    {step === "datetime" ? "Date & Time" : step}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 ${
                    index < currentStepIndex 
                      ? 'bg-black dark:bg-white' 
                      : 'bg-gray-200 dark:bg-gray-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {currentStep === "datetime" && (
              <>
                <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm" data-testid="card-step-calendar">
                  <h2 className="text-xl font-light mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <CalendarIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Select Date
                  </h2>
                  <Calendar 
                    mode="single" 
                    selected={selectedDate} 
                    onSelect={setSelectedDate} 
                    disabled={(date) => date < new Date()} 
                    data-testid="calendar-date-picker"
                    className="mx-auto"
                  />
                </Card>

                <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm" data-testid="card-step-time">
                  <h2 className="text-xl font-light mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Choose Time
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={`p-3 rounded-sm border transition-all font-light ${
                          selectedTimeSlot === slot
                            ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                        }`}
                        data-testid={`button-time-${slot}`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {currentStep === "pets" && (
              <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm" data-testid="card-step-pets">
                <h2 className="text-xl font-light mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <PawPrint className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  Select Pets
                </h2>
                {petsLoading ? (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400 font-light">
                    Loading your pets...
                  </div>
                ) : userPets.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400 font-light">
                    No pets found. Please add a pet to your profile first.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userPets.map((pet: any) => (
                      <div
                        key={pet.id}
                        className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-800 rounded-sm"
                      >
                        <Checkbox
                          id={String(pet.id)}
                          checked={selectedPets.includes(Number(pet.id))}
                          onCheckedChange={() => togglePet(Number(pet.id))}
                          data-testid={`checkbox-pet-${pet.id}`}
                        />
                        <label
                          htmlFor={String(pet.id)}
                          className="flex-1 font-light text-gray-900 dark:text-gray-100 cursor-pointer"
                        >
                          {pet.name} ({pet.breed || pet.species || 'Dog'})
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {currentStep === "review" && (
              <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm" data-testid="card-step-review">
                <h2 className="text-xl font-light mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  Review & Payment
                </h2>
                
                <div className="space-y-4 mb-6">
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Walker</div>
                    <div className="font-light text-gray-900 dark:text-gray-100">
                      {selectedWalker.businessName || selectedWalker.displayName}
                    </div>
                  </div>
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Date & Time</div>
                    <div className="font-light text-gray-900 dark:text-gray-100">
                      {selectedDate?.toLocaleDateString()} at {selectedTimeSlot}
                    </div>
                  </div>
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Pets ({selectedPets.length})</div>
                    <div className="font-light text-gray-900 dark:text-gray-100">
                      {selectedPets.map(id => userPets.find((p: any) => Number(p.id) === id)?.name).join(', ')}
                    </div>
                  </div>
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Total</div>
                    <div className="text-xl font-light text-gray-900 dark:text-gray-100">
                      ₪{selectedWalker.hourlyRate || 60}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-sm p-4">
                  <div className="text-sm font-light text-gray-600 dark:text-gray-400 mb-2">
                    Payment Method: Stripe Connect
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 font-light">
                    Payment will be processed after the walk is completed. GPS tracking will be enabled during the walk.
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm sticky top-4">
              <h3 className="font-light text-lg mb-4 text-gray-900 dark:text-gray-100">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
                  <div className="text-gray-600 dark:text-gray-400 font-light">Walker</div>
                  <div className="text-gray-900 dark:text-gray-100 font-light">
                    {selectedWalker.businessName || selectedWalker.displayName}
                  </div>
                </div>
                {selectedDate && selectedTimeSlot && (
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
                    <div className="text-gray-600 dark:text-gray-400 font-light">Date & Time</div>
                    <div className="text-gray-900 dark:text-gray-100 font-light">
                      {selectedDate.toLocaleDateString()} at {selectedTimeSlot}
                    </div>
                  </div>
                )}
                {selectedPets.length > 0 && (
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
                    <div className="text-gray-600 dark:text-gray-400 font-light">Pets</div>
                    <div className="text-gray-900 dark:text-gray-100 font-light">{selectedPets.length} selected</div>
                  </div>
                )}
                <div className="pt-2">
                  <div className="text-gray-600 dark:text-gray-400 font-light">Total</div>
                  <div className="text-2xl font-light text-gray-900 dark:text-gray-100">
                    ₪{selectedWalker.hourlyRate || 60}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {currentStep !== "datetime" && (
                  <Button 
                    variant="outline" 
                    className="w-full border-gray-300 dark:border-gray-700 font-light" 
                    onClick={handleBack}
                    data-testid="button-back-step"
                  >
                    Back
                  </Button>
                )}
                {currentStep !== "review" ? (
                  <Button 
                    className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-light"
                    onClick={handleNext}
                    disabled={!canProceed()}
                    data-testid="button-next-step"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-light"
                    onClick={handleConfirmBooking}
                    data-testid="button-confirm-booking"
                  >
                    Confirm Booking
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
