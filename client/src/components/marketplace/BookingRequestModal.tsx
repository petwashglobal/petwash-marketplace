/**
 * Pet Wash™ Booking Request Modal
 * 
 * Features:
 * - Service dates selection
 * - Pet count and details
 * - Special requirements textarea
 * - Personal message to provider
 * - Price breakdown (service + platform fee)
 * - Submit booking request
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarDays, User, MapPin, Star, Shield, Heart, 
  Loader2, CheckCircle, Plus, Minus, AlertTriangle,
  ChevronRight
} from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { useLanguage } from "@/lib/languageStore";
import { useToast } from "@/hooks/use-toast";

interface Provider {
  id: number;
  userId: string;
  name: string;
  photo: string | null;
  location: string;
  rating: number;
  reviewCount: number;
  pricePerDay: number;
  verified: boolean;
  providerType: 'sitter' | 'walker' | 'trainer' | 'driver' | 'groomer';
  serviceType: string;
  specialties?: string[];
}

interface BookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  initialDates?: { start: Date; end: Date };
  initialPetCount?: number;
}

export function BookingRequestModal({
  isOpen,
  onClose,
  provider,
  initialDates,
  initialPetCount = 1,
}: BookingRequestModalProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  // Fetch user profile to pre-fill service address
  const { data: userProfile } = useQuery<{
    street?: string; city?: string; postalCode?: string; address?: string;
  }>({
    queryKey: ['/api/user/profile'],
    staleTime: 5 * 60 * 1000,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [startDate, setStartDate] = useState<Date>(initialDates?.start && initialDates.start >= today ? initialDates.start : today);
  const [endDate, setEndDate] = useState<Date>(initialDates?.end && initialDates.end > today ? initialDates.end : addDays(today, 1));
  const [petCount, setPetCount] = useState(initialPetCount);
  const [message, setMessage] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [step, setStep] = useState<'details' | 'review' | 'success'>('details');

  // Service address — pre-filled from profile, user can edit
  const [serviceAddress, setServiceAddress] = useState('');
  const [addressFromProfile, setAddressFromProfile] = useState(false);

  useEffect(() => {
    if (userProfile && !serviceAddress) {
      const filled = [userProfile.street, userProfile.city]
        .filter(Boolean).join(', ') || userProfile.address || '';
      if (filled) {
        setServiceAddress(filled);
        setAddressFromProfile(true);
      }
    }
  }, [userProfile]);

  const totalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
  const dailyRate = provider?.pricePerDay || 150;
  const subtotal = dailyRate * totalDays * petCount;
  const serviceFee = Math.round(subtotal * 0.15);
  const total = subtotal + serviceFee;

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/booking-requests', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    },
    onSuccess: () => {
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
      toast({
        title: isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Request sent successfully!',
        description: isHebrew 
          ? 'הספק יקבל הודעה ויחזור אליך בקרוב'
          : 'The provider will receive your request and respond soon',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message || (isHebrew ? 'לא ניתן לשלוח את הבקשה' : 'Failed to send request'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!provider) return;

    createBookingMutation.mutate({
      providerId: provider.userId,
      providerProfileId: provider.id,
      providerType: provider.providerType,
      serviceType: provider.serviceType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      petCount,
      message,
      specialRequirements,
      serviceAddress: serviceAddress.trim() || undefined,
    });
  };

  const handleClose = () => {
    setStep('details');
    setMessage('');
    setSpecialRequirements('');
    setServiceAddress('');
    setAddressFromProfile(false);
    onClose();
  };

  if (!provider) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {step === 'success' ? (
          <div className="text-center py-8" dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isHebrew ? 'הבקשה נשלחה!' : 'Request Sent!'}
            </h2>
            <p className="text-gray-600 mb-6">
              {isHebrew 
                ? `${provider.name} יקבל הודעה ויחזור אליך תוך 24 שעות`
                : `${provider.name} will receive your request and respond within 24 hours`}
            </p>
            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full"
                onClick={handleClose}
                data-testid="button-close-success"
              >
                {isHebrew ? 'הבנתי' : 'Got it'}
              </Button>
              <p className="text-xs text-gray-500">
                {isHebrew 
                  ? 'תקבל התראה כשהספק יאשר או יציע מועד למפגש היכרות'
                  : 'You\'ll be notified when the provider accepts or suggests a Meet & Greet'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="pb-2" dir={isHebrew ? 'rtl' : 'ltr'}>
              <DialogTitle className="text-xl font-bold">
                {isHebrew ? 'שלח בקשת הזמנה' : 'Send Booking Request'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6" dir={isHebrew ? 'rtl' : 'ltr'}>
              {/* Provider Card */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white shadow-md">
                  {provider.photo ? (
                    <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-pink-100 text-pink-600 text-xl font-bold">
                      {provider.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    {provider.verified && (
                      <Shield className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {provider.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-current" />
                      {provider.rating.toFixed(1)} ({provider.reviewCount})
                    </span>
                  </div>
                </div>
              </div>

              {step === 'details' && (
                <>
                  {/* Service Address */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-pink-500" />
                      {isHebrew ? 'כתובת השירות' : 'Service Address'}
                    </label>
                    <Input
                      value={serviceAddress}
                      onChange={(e) => {
                        setServiceAddress(e.target.value);
                        setAddressFromProfile(false);
                      }}
                      placeholder={isHebrew ? 'הזן את הכתובת בה יינתן השירות...' : 'Enter the address where service will be provided...'}
                      className="rounded-xl"
                      dir={isHebrew ? 'rtl' : 'ltr'}
                      data-testid="input-service-address"
                    />
                    {addressFromProfile && (
                      <p className="text-xs text-emerald-600">
                        {isHebrew ? '✓ מולא אוטומטית מפרטי הפרופיל שלך' : '✓ Auto-filled from your profile'}
                      </p>
                    )}
                  </div>

                  {/* Date Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">
                      {isHebrew ? 'תאריכים' : 'Dates'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="justify-start text-left rounded-xl"
                            data-testid="button-start-date"
                          >
                            <CalendarDays className="h-4 w-4 mr-2" />
                            <span>{format(startDate, 'dd/MM/yyyy')}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => {
                              if (date) {
                                setStartDate(date);
                                if (date >= endDate) {
                                  setEndDate(addDays(date, 1));
                                }
                              }
                            }}
                            disabled={(date) => {
                              const now = new Date();
                              now.setHours(0, 0, 0, 0);
                              return date < now;
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="justify-start text-left rounded-xl"
                            data-testid="button-end-date"
                          >
                            <CalendarDays className="h-4 w-4 mr-2" />
                            <span>{format(endDate, 'dd/MM/yyyy')}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => date && setEndDate(date)}
                            disabled={(date) => date < startDate}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <p className="text-sm text-gray-500">
                      {totalDays} {isHebrew ? (totalDays === 1 ? 'יום' : 'ימים') : (totalDays === 1 ? 'day' : 'days')}
                    </p>
                  </div>

                  {/* Pet Count */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">
                      {isHebrew ? 'מספר חיות מחמד' : 'Number of Pets'}
                    </label>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full"
                        onClick={() => setPetCount(Math.max(1, petCount - 1))}
                        disabled={petCount <= 1}
                        data-testid="button-decrease-pets"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-xl font-bold w-8 text-center">{petCount}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full"
                        onClick={() => setPetCount(Math.min(5, petCount + 1))}
                        disabled={petCount >= 5}
                        data-testid="button-increase-pets"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">
                      {isHebrew ? 'הודעה לספק' : 'Message to Provider'}
                    </label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={isHebrew 
                        ? 'ספר על חיית המחמד שלך ועל מה שאתה מחפש...'
                        : 'Tell about your pet and what you\'re looking for...'
                      }
                      className="min-h-[100px] rounded-xl"
                      data-testid="input-message"
                    />
                  </div>

                  {/* Special Requirements */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">
                      {isHebrew ? 'דרישות מיוחדות (אופציונלי)' : 'Special Requirements (optional)'}
                    </label>
                    <Textarea
                      value={specialRequirements}
                      onChange={(e) => setSpecialRequirements(e.target.value)}
                      placeholder={isHebrew 
                        ? 'תרופות, דיאטה מיוחדת, אלרגיות...'
                        : 'Medications, special diet, allergies...'
                      }
                      className="min-h-[80px] rounded-xl"
                      data-testid="input-special-requirements"
                    />
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full py-6 text-lg"
                    onClick={() => setStep('review')}
                    data-testid="button-continue-to-review"
                  >
                    {isHebrew ? 'המשך לסיכום' : 'Continue to Review'}
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                </>
              )}

              {step === 'review' && (
                <>
                  {/* Booking Summary */}
                  <div className="bg-white rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900">
                      {isHebrew ? 'סיכום הזמנה' : 'Booking Summary'}
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {isHebrew ? 'תאריכים' : 'Dates'}
                        </span>
                        <span className="font-medium">
                          {format(startDate, 'dd/MM')} - {format(endDate, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {isHebrew ? 'חיות מחמד' : 'Pets'}
                        </span>
                        <span className="font-medium">{petCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          ₪{dailyRate} × {totalDays} {isHebrew ? 'ימים' : 'days'} × {petCount} {isHebrew ? 'חיות' : 'pets'}
                        </span>
                        <span className="font-medium">₪{subtotal}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>
                          {isHebrew ? 'עמלת שירות (15%)' : 'Service fee (15%)'}
                        </span>
                        <span>₪{serviceFee}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between text-lg font-bold">
                        <span>{isHebrew ? 'סה"כ' : 'Total'}</span>
                        <span className="text-pink-600">₪{total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Important Notes */}
                  <div className="bg-white border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium mb-1">
                          {isHebrew ? 'מה קורה אחרי השליחה?' : 'What happens next?'}
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-amber-700">
                          <li>{isHebrew ? 'הספק יקבל את הבקשה שלך' : 'Provider receives your request'}</li>
                          <li>{isHebrew ? 'תיקבע פגישת היכרות (Meet & Greet)' : 'Meet & Greet will be scheduled'}</li>
                          <li>{isHebrew ? 'התשלום יבוצע רק לאחר אישור' : 'Payment only after confirmation'}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full py-6"
                      onClick={() => setStep('details')}
                      data-testid="button-back-to-details"
                    >
                      {isHebrew ? 'חזור' : 'Back'}
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full py-6"
                      onClick={handleSubmit}
                      disabled={createBookingMutation.isPending}
                      data-testid="button-send-request"
                    >
                      {createBookingMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {isHebrew ? 'שולח...' : 'Sending...'}
                        </>
                      ) : (
                        <>
                          <Heart className="h-4 w-4 mr-2" />
                          {isHebrew ? 'שלח בקשה' : 'Send Request'}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
