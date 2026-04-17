import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, AlertTriangle, Shield, Star, MapPin, Clock, DollarSign, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { WalletCheckoutPreview } from '@/components/wallet/WalletCheckoutPreview';

interface SitterProfile {
  id: string;
  fullName: string;
  city: string;
  bio: string;
  experienceYears: number;
  hourlyRateIls: number;
  available: boolean;
  profilePhotoUrl: string | null;
  rating: number;
  totalReviews: number;
  services: string[];
}

interface PetProfile {
  id: string;
  petName: string;
  petType: string;
  breed: string;
  specialNeeds: string;
  allergies: string;
  highAlertFlag: boolean;
}

interface PricingBreakdown {
  baseRate: number;
  duration: number;
  subtotal: number;
  holidaySurge: number;
  platformFee: number;
  tax: number;
  totalPrice: number;
  currency: string;
  sitterPayout: number;
}

export default function SitterBooking() {
  const [, params] = useRoute('/sitter-suite/book/:sitterId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  const sitterId = params?.sitterId;

  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTimeSlot, setStartTimeSlot] = useState<string>('');
  const [endTimeSlot, setEndTimeSlot] = useState<string>('');
  const [showPayment, setShowPayment] = useState(false);

  // Fetch sitter profile
  const { data: sitter, isLoading: sitterLoading } = useQuery<SitterProfile>({
    queryKey: ['/api/sitter-suite/sitters', sitterId],
    enabled: !!sitterId,
  });

  // Fetch user's pets
  const { data: pets } = useQuery<PetProfile[]>({
    queryKey: ['/api/sitter-suite/my-pets'],
  });

  // Calculate pricing when dates and times change
  const { data: pricing, isLoading: pricingLoading } = useQuery<PricingBreakdown>({
    queryKey: ['/api/sitter-suite/calculate-price', sitterId, selectedService, startDate, endDate, startTimeSlot, endTimeSlot],
    enabled: !!sitterId && !!selectedService && !!startDate && !!endDate && !!startTimeSlot && !!endTimeSlot,
    queryFn: async () => {
      const params = new URLSearchParams({
        sitterId: sitterId!,
        service: selectedService,
        startDate: startDate!.toISOString(),
        endDate: endDate!.toISOString(),
        startTimeSlot,
        endTimeSlot,
      });
      const res = await fetch(`/api/sitter-suite/calculate-price?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to calculate price');
      return res.json();
    },
  });

  const TIME_SLOTS = [
    { value: 'morning', label: 'Morning (8:00 AM - 12:00 PM)', time: '08:00' },
    { value: 'afternoon', label: 'Afternoon (12:00 PM - 5:00 PM)', time: '12:00' },
    { value: 'evening', label: 'Evening (5:00 PM - 9:00 PM)', time: '17:00' },
    { value: 'overnight', label: 'Overnight (9:00 PM - 8:00 AM)', time: '21:00' },
  ];

  // Create booking mutation
  const createBooking = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/sitter-suite/bookings', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: t('sitter.bookingRequest'),
        description: t('sitter.requestDesc'),
      });
      // Stage B cache fix (BOOKING_READ_REPAIR.md Change 3):
      // Sitter bookings are in Postgres sitter_bookings — invalidate the correct endpoint.
      // Also invalidate /api/booking-requests since it now includes sitter bookings in the unified read.
      queryClient.invalidateQueries({ queryKey: ['/api/sitter-suite/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: t('booking.common.bookingFailed'),
        description: error.message || t('booking.common.tryAgain'),
        variant: 'destructive',
      });
    },
  });

  const selectedPet = pets?.find(p => p.id === selectedPetId);

  const handleSubmit = () => {
    if (!selectedPetId || !selectedService || !startDate || !endDate || !startTimeSlot || !endTimeSlot) {
      toast({
        title: t('booking.common.missingInfo'),
        description: 'Please select all fields including time slots',
        variant: 'destructive',
      });
      return;
    }

    if (!pricing) {
      toast({
        title: 'Price calculation pending',
        description: 'Please wait for price calculation',
        variant: 'destructive',
      });
      return;
    }

    // Show payment modal
    setShowPayment(true);
  };

  const handlePaymentConfirm = async () => {
    createBooking.mutate({
      sitterId,
      petId: selectedPetId,
      serviceType: selectedService,
      startDate: startDate!.toISOString(),
      endDate: endDate!.toISOString(),
      startTimeSlot,
      endTimeSlot,
      totalPrice: pricing!.totalPrice,
    });
  };

  if (sitterLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">{t('booking.common.loading')}</div>
      </div>
    );
  }

  if (!sitter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>{t('booking.common.notFound')}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Sitter Info */}
          <div className="luxury-animate-fade-in luxury-delay-1">
            <Card className="luxury-glass-card luxury-shadow-xl luxury-hover-glow mb-6 sticky top-4">
              <CardHeader>
                <div className="flex items-start gap-4">
                  {sitter.profilePhotoUrl ? (
                    <img 
                      src={sitter.profilePhotoUrl} 
                      alt={sitter.fullName}
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-purple-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-purple-200">
                      {sitter.fullName.charAt(0)}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{sitter.fullName}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      {sitter.city}
                    </div>
                    
                    {sitter.totalReviews > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{sitter.rating.toFixed(1)}</span>
                        <span className="text-sm text-gray-500">
                          ({sitter.totalReviews} {t('booking.common.reviews')})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {sitter.bio}
                </p>
                
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary" className="luxury-badge-gold">
                    {sitter.experienceYears}+ {t('booking.common.experience')}
                  </Badge>
                  <Badge variant="outline" className="luxury-badge-success">
                    <Shield className="w-3 h-3 mr-1" />
                    {t('booking.common.verified')}
                  </Badge>
                </div>

                <Separator className="my-4 luxury-divider" />
                
                <div>
                  <h4 className="font-semibold mb-2">{t('sitter.selectService')}:</h4>
                  <div className="flex flex-wrap gap-2">
                    {sitter.services.map((service, i) => (
                      <Badge key={i} className="luxury-badge">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Booking Form */}
          <div className="luxury-animate-fade-in luxury-delay-2">
            <Card className="luxury-glass-card luxury-shadow-xl">
              <CardHeader>
                <CardTitle className="luxury-heading-md luxury-text-gradient">{t('sitter.title')}</CardTitle>
                <CardDescription className="luxury-text-small">
                  {t('sitter.requestDesc')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Pet Selection */}
                <div className="space-y-2 luxury-animate-fade-in luxury-delay-3">
                  <Label htmlFor="pet" className="luxury-text-small font-semibold">{t('booking.pet.selectYourPet')}</Label>
                  <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                    <SelectTrigger id="pet" data-testid="select-pet" className="luxury-glass-minimal">
                      <SelectValue placeholder={t('booking.pet.choosePet')} />
                    </SelectTrigger>
                    <SelectContent>
                      {pets && pets.length > 0 ? (
                        pets.map((pet) => (
                          <SelectItem key={pet.id} value={pet.id}>
                            {pet.petName} ({pet.petType})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>{t('booking.pet.choosePet')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* High Alert Banner */}
                {selectedPet?.highAlertFlag && (
                  <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-white">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="font-semibold">
                      HIGH ALERT: {selectedPet.petName} has critical allergies or special needs. 
                      Please discuss with sitter before booking.
                    </AlertDescription>
                  </Alert>
                )}

                {selectedPet && (
                  <Card className="luxury-glass-minimal luxury-hover-lift luxury-animate-scale-in">
                    <CardContent className="pt-4">
                      <p className="text-sm"><strong>{t('pets.petType')}:</strong> {selectedPet.petType}</p>
                      <p className="text-sm"><strong>{t('booking.pet.breed')}:</strong> {selectedPet.breed}</p>
                      {selectedPet.specialNeeds && (
                        <p className="text-sm"><strong>{t('booking.pet.specialNeeds')}:</strong> {selectedPet.specialNeeds}</p>
                      )}
                      {selectedPet.allergies && (
                        <p className="text-sm text-red-600"><strong>{t('booking.pet.specialNeeds')}:</strong> {selectedPet.allergies}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Service Type */}
                <div className="space-y-2 luxury-animate-fade-in luxury-delay-4">
                  <Label htmlFor="service" className="luxury-text-small font-semibold">{t('sitter.selectService')}</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger id="service" data-testid="select-service" className="luxury-glass-minimal">
                      <SelectValue placeholder={t('booking.pet.choosePet')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sitter.services.map((service, i) => (
                        <SelectItem key={i} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Selection */}
                <div className="grid grid-cols-2 gap-4 luxury-animate-fade-in luxury-delay-5">
                  <div className="space-y-2">
                    <Label className="luxury-text-small font-semibold">{t('sitter.startDate')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal luxury-glass-minimal",
                            !startDate && "text-muted-foreground"
                          )}
                          data-testid="button-start-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : t('booking.common.pickDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 luxury-glass-card">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="luxury-text-small font-semibold">{t('sitter.endDate')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal luxury-glass-minimal",
                            !endDate && "text-muted-foreground"
                          )}
                          data-testid="button-end-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : t('booking.common.pickDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 luxury-glass-card">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => !startDate || date <= startDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Time Slot Selection */}
                <div className="grid grid-cols-2 gap-4 luxury-animate-fade-in luxury-delay-6">
                  <div className="space-y-2">
                    <Label htmlFor="start-time" className="luxury-text-small font-semibold">Start Time</Label>
                    <Select value={startTimeSlot} onValueChange={setStartTimeSlot}>
                      <SelectTrigger id="start-time" data-testid="select-start-time" className="luxury-glass-minimal">
                        <SelectValue placeholder="Select time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-time" className="luxury-text-small font-semibold">End Time</Label>
                    <Select value={endTimeSlot} onValueChange={setEndTimeSlot}>
                      <SelectTrigger id="end-time" data-testid="select-end-time" className="luxury-glass-minimal">
                        <SelectValue placeholder="Select time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pricing Breakdown - Like Booking.com */}
                {pricing && (
                  <Card className="luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-animate-scale-in luxury-delay-7">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 luxury-text-gradient">
                        <DollarSign className="w-5 h-5" />
                        {t('walker.pricingBreakdown')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm luxury-text-body">
                        <span>Base Rate ({pricing.duration} {pricing.duration > 1 ? 'days' : 'day'})</span>
                        <span>{pricing.currency} {pricing.subtotal.toFixed(2)}</span>
                      </div>
                      
                      {pricing.holidaySurge > 0 && (
                        <div className="flex justify-between text-sm text-orange-600 font-semibold">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Holiday Surge (50%)
                          </span>
                          <span>+{pricing.currency} {pricing.holidaySurge.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm luxury-text-body">
                        <span>{t('walker.platformFee')} (10%)</span>
                        <span>{pricing.currency} {pricing.platformFee.toFixed(2)}</span>
                      </div>

                      {pricing.tax > 0 && (
                        <div className="flex justify-between text-sm luxury-text-body">
                          <span>Tax</span>
                          <span>{pricing.currency} {pricing.tax.toFixed(2)}</span>
                        </div>
                      )}

                      <Separator className="luxury-divider" />

                      <div className="flex justify-between luxury-heading-lg luxury-text-gradient">
                        <span>{t('booking.common.total')}</span>
                        <span>{pricing.currency} {pricing.totalPrice.toFixed(2)}</span>
                      </div>

                      <WalletCheckoutPreview
                        subtotalCents={Math.round(pricing.totalPrice * 100)}
                        divisionCode="petsitter"
                        className="mt-2"
                      />

                      <p className="text-xs text-gray-500 mt-2">
                        הסכום ייושמר מהארנק שלך עם אישור המשמר/ת, ויחויב לאחר סיום השהות.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Submit Button */}
                <Button 
                  className="luxury-btn-primary luxury-shadow-xl w-full text-lg py-6 luxury-animate-fade-in luxury-delay-8"
                  onClick={handleSubmit}
                  disabled={createBooking.isPending || pricingLoading}
                  data-testid="button-submit-booking"
                >
                  {createBooking.isPending ? t('booking.common.processing') : t('sitter.title')}
                </Button>

                <p className="text-xs text-center text-gray-500 luxury-animate-fade-in luxury-delay-9">
                  By requesting a booking, you agree to our Terms of Service and Privacy Policy
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Confirmation Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md luxury-glass-card luxury-shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 luxury-heading-sm luxury-text-gradient">
              <CreditCard className="h-5 w-5" />
              Confirm Payment
            </DialogTitle>
            <DialogDescription className="luxury-text-small">
              You will be charged {pricing?.currency} {pricing?.totalPrice.toFixed(2)} for this booking
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="luxury-glass-minimal p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm luxury-text-body">
                <span>Service:</span>
                <span className="font-semibold">{selectedService}</span>
              </div>
              <div className="flex justify-between text-sm luxury-text-body">
                <span>Dates:</span>
                <span className="font-semibold">
                  {startDate && format(startDate, "MMM d")} - {endDate && format(endDate, "MMM d")}
                </span>
              </div>
              <div className="flex justify-between text-sm luxury-text-body">
                <span>Times:</span>
                <span className="font-semibold">
                  {TIME_SLOTS.find(s => s.value === startTimeSlot)?.label.split(' ')[0]} - {TIME_SLOTS.find(s => s.value === endTimeSlot)?.label.split(' ')[0]}
                </span>
              </div>
              <Separator className="luxury-divider" />
              <div className="flex justify-between luxury-heading-md luxury-text-gradient">
                <span>Total:</span>
                <span>₪{pricing?.totalPrice.toFixed(2)}</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              Payment processed securely via Nayax. Your card will be charged immediately.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPayment(false)}
              disabled={createBooking.isPending}
              className="luxury-btn-secondary"
            >
              Cancel
            </Button>
            <Button 
              className="luxury-btn-primary luxury-shadow-xl"
              onClick={handlePaymentConfirm}
              disabled={createBooking.isPending}
              data-testid="button-confirm-payment"
            >
              {createBooking.isPending ? 'Processing...' : 'Confirm & Pay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
