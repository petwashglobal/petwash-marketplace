import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Clock, MapPin, CreditCard, Check, ChevronLeft, PawPrint } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BookingStep = "station" | "datetime" | "pets" | "review";

export default function K9000BookingFlow() {
  const { stationId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Convert stationId to number (API returns numbers, route params are strings)
  const stationIdNumber = stationId ? parseInt(stationId) : undefined;
  
  const [currentStep, setCurrentStep] = useState<BookingStep>(stationIdNumber ? "datetime" : "station");
  const [selectedStationId, setSelectedStationId] = useState<number | undefined>(stationIdNumber);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedPets, setSelectedPets] = useState<number[]>([]);

  // Fetch real stations from API
  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ['/api/platforms/k9000/stations'],
    enabled: true,
  });

  // Fetch user's pets
  const { data: userPets = [], isLoading: petsLoading } = useQuery({
    queryKey: ['/api/pets'],
    enabled: currentStep === 'pets',
  });

  const timeSlots = ["08:00", "09:00", "10:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  const selectedStation = stations.find((s: any) => s.id === selectedStationId);

  const steps: BookingStep[] = ["station", "datetime", "pets", "review"];
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
      if (!selectedStation || !selectedDate || !selectedTimeSlot || selectedPets.length === 0) {
        throw new Error("Please complete all booking details");
      }

      // Create timezone-safe start/end times
      const startTime = new Date(selectedDate);
      const [hours, minutes] = selectedTimeSlot.split(":");
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30); // 30-minute wash session

      const payload = {
        stationId: selectedStationId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        petIds: selectedPets,
        items: [
          {
            itemType: 'service',
            name: 'K9000 Self-Service Wash',
            nameHe: 'שטיפה עצמית K9000',
            unitPrice: 45.00
          }
        ],
        platformData: {
          stationName: selectedStation.name,
          stationAddress: selectedStation.address,
          paymentMethod: 'nayax-onsite',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const booking = await apiRequest(`/api/platforms/k9000/bookings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast({
        title: "Booking Created! 🐾",
        description: `Your K9000 wash is reserved. Booking #${booking.bookingNumber}. Payment at station.`,
      });

      setTimeout(() => setLocation("/dashboard"), 2000);
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
      case "station": return !!selectedStationId;
      case "datetime": return !!selectedDate && !!selectedTimeSlot;
      case "pets": return selectedPets.length > 0;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button 
            variant="ghost" 
            className="mb-4 text-gray-600 dark:text-gray-400" 
            onClick={() => setLocation("/locations")} 
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Locations
          </Button>
          
          <h1 className="text-2xl font-light mb-6 text-gray-900 dark:text-gray-100" data-testid="page-title">
            Book K9000 Wash Station
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
                    {step}
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
            
            {currentStep === "station" && (
              <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm" data-testid="card-step-station">
                <h2 className="text-xl font-light mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  Select Station
                </h2>
                {stationsLoading ? (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400 font-light">
                    Loading stations...
                  </div>
                ) : stations.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400 font-light">
                    No stations available. Please check back later.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {stations.map((station: any) => (
                      <button
                        key={station.id}
                        onClick={() => setSelectedStationId(Number(station.id))}
                        className={`p-4 rounded-sm border text-left transition-all ${
                          selectedStationId === Number(station.id)
                            ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                        }`}
                        data-testid={`button-station-${station.id}`}
                      >
                        <div className="font-light text-gray-900 dark:text-gray-100">{station.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{station.address || station.city}</div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

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
                        className={`p-3 rounded-sm border transition-all ${
                          selectedTimeSlot === slot
                            ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                        }`}
                        data-testid={`button-time-${slot}`}
                      >
                        <div className="font-light text-gray-900 dark:text-gray-100">{slot}</div>
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
                          {pet.name} ({pet.breed || pet.species || 'Pet'})
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
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Station</div>
                    <div className="font-light text-gray-900 dark:text-gray-100">{selectedStation?.name}</div>
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
                      {selectedPets.map(id => userPets.find((p: any) => p.id === id)?.name).join(', ')}
                    </div>
                  </div>
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-light">Total</div>
                    <div className="text-xl font-light text-gray-900 dark:text-gray-100">₪45</div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-sm p-4">
                  <div className="text-sm font-light text-gray-600 dark:text-gray-400 mb-2">
                    Payment Method: Nayax (On-Site)
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 font-light">
                    Payment will be processed at the station when you arrive. This booking reserves your time slot.
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm sticky top-4">
              <h3 className="font-light text-lg mb-4 text-gray-900 dark:text-gray-100">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                {selectedStation && (
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
                    <div className="text-gray-600 dark:text-gray-400 font-light">Station</div>
                    <div className="text-gray-900 dark:text-gray-100 font-light">{selectedStation.name}</div>
                  </div>
                )}
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
                  <div className="text-2xl font-light text-gray-900 dark:text-gray-100">₪45</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {currentStep !== "station" && (
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
