import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap, MapPin, Clock, DollarSign, AlertTriangle, Loader2, CheckCircle2, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GlassCard } from '@/components/LuxuryWidgets';

interface EmergencyWalkRequest {
  location: {
    latitude: number;
    longitude: number;
  };
  requiredDuration: number;
  petName: string;
}

interface EmergencyWalkResponse {
  bookingId: string;
  matchedWalker: {
    walkerId: string;
    walkerName: string;
    rating: number;
    completedWalks: number;
    estimatedArrivalMinutes: number;
    distanceKm: number;
  };
  pricing: {
    basePrice: number;
    basePriceILS: string;
    ownerFee: number;
    ownerFeeILS: string;
    walkerDeduction: number;
    walkerDeductionILS: string;
    walkerPayout: number;
    walkerPayoutILS: string;
    totalCharge: number;
    totalChargeILS: string;
    vat: number;
    vatILS: string;
    totalChargeWithVAT: number;
    totalChargeWithVATILS: string;
  };
  surgePricing: {
    surgeMultiplier: number;
    surgeReasons: string[];
    isSurge: boolean;
    surgePriceCents: number;
    surgePriceILS: string;
    surgeMessage: string;
  };
  estimatedArrival: string;
}

export function EmergencyWalkBooking() {
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [bookingResult, setBookingResult] = useState<EmergencyWalkResponse | null>(null);
  const [petName, setPetName] = useState('');

  const emergencyBookingMutation = useMutation({
    mutationFn: async (data: EmergencyWalkRequest) => {
      const response = await apiRequest<EmergencyWalkResponse>('/api/walks/emergency-request', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data) => {
      setBookingResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/walks'] });
      const description = t('walker.walkerOnWay')
        .replace('{{walkerName}}', data.matchedWalker.walkerName)
        .replace('{{minutes}}', data.matchedWalker.estimatedArrivalMinutes.toString());
      toast({
        title: t('walker.walkerFound'),
        description,
      });
    },
    onError: (error: Error) => {
      toast({
        title: `❌ ${t('common.error')}`,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEmergencyBooking = () => {
    if (!petName.trim()) {
      toast({
        title: t('emergency.petNameRequired'),
        description: t('emergency.petNameRequiredDesc'),
        variant: 'destructive',
      });
      return;
    }

    // Get user's current location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          emergencyBookingMutation.mutate({
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            requiredDuration: 30, // Default 30 minutes for emergency walk
            petName: petName,
          });
        },
        (error) => {
          toast({
            title: t('emergency.locationError'),
            description: t('emergency.locationErrorDesc'),
            variant: 'destructive',
          });
        }
      );
    } else {
      toast({
        title: t('emergency.locationNotSupported'),
        description: t('emergency.locationNotSupportedDesc'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg"
          className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 hover:from-red-700 hover:via-orange-700 hover:to-yellow-700 text-white font-bold shadow-2xl border-2 border-white/20 backdrop-blur-sm animate-pulse"
          data-testid="button-emergency-walk"
        >
          <Zap className="mr-2 h-5 w-5" />
          {t('emergency.trigger')}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-emergency-walk">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Zap className="h-6 w-6 text-orange-500" />
            {t('emergency.title')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('emergency.description')}
          </DialogDescription>
        </DialogHeader>

        {!bookingResult ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold" data-testid="label-pet-name">
                {t('emergency.petNameLabel')}
              </label>
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder={t('emergency.petNamePlaceholder')}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                data-testid="input-pet-name"
                disabled={emergencyBookingMutation.isPending}
              />
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <div className="space-y-1">
                    <p className="font-semibold">{t('emergency.whatIncluded')}</p>
                    <ul className="list-disc list-inside space-y-1 mr-4">
                      <li>{t('emergency.guaranteedArrival')}</li>
                      <li>{t('emergency.highlyRatedWalker')}</li>
                      <li>{t('emergency.gpsTracking')}</li>
                      <li>{t('emergency.surgePricing')}</li>
                      <li>{t('emergency.platformCommission')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleEmergencyBooking}
              disabled={emergencyBookingMutation.isPending}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white text-lg py-6"
              data-testid="button-find-walker"
            >
              {emergencyBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('emergency.finding')}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  {t('emergency.findWalker')}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <h3 className="text-xl font-bold" data-testid="text-walker-name">
                    {bookingResult.matchedWalker.walkerName}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      ⭐ {bookingResult.matchedWalker.rating.toFixed(2)}
                    </span>
                    <span>•</span>
                    <span data-testid="text-completed-walks">
                      {bookingResult.matchedWalker.completedWalks} {t('emergency.experience')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-600">{t('emergency.arrival')}</p>
                    <p className="font-bold" data-testid="text-eta">
                      {bookingResult.matchedWalker.estimatedArrivalMinutes} {t('emergency.minutes')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-600">{t('emergency.distance')}</p>
                    <p className="font-bold" data-testid="text-distance">
                      {bookingResult.matchedWalker.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {bookingResult.surgePricing.isSurge && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-orange-900" data-testid="text-surge-active">
                      {t('emergency.surgeActive')} ({bookingResult.surgePricing.surgeMultiplier}x)
                    </p>
                    <p className="text-sm text-orange-800 mt-1">
                      {t('emergency.surgeReasons')}
                    </p>
                    <ul className="list-disc list-inside text-sm text-orange-700 mt-1 mr-4">
                      {bookingResult.surgePricing.surgeReasons.map((reason, idx) => (
                        <li key={idx} data-testid={`text-surge-reason-${idx}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <GlassCard className="p-6 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                {t('emergency.pricing')}
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('emergency.basePrice')}:</span>
                  <span className="font-semibold" data-testid="text-base-price">
                    {bookingResult.pricing.basePriceILS}
                  </span>
                </div>
                
                {bookingResult.surgePricing.isSurge && (
                  <div className="flex justify-between text-orange-600">
                    <span>
                      {t('emergency.surgeMultiplier').replace('{{multiplier}}', bookingResult.surgePricing.surgeMultiplier.toString())}:
                    </span>
                    <span className="font-semibold" data-testid="text-surge-price">
                      {bookingResult.surgePricing.surgePriceILS}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('emergency.ownerFee')}:</span>
                  <span data-testid="text-owner-fee">{bookingResult.pricing.ownerFeeILS}</span>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('emergency.walkerDeduction')}:</span>
                  <span data-testid="text-walker-deduction">{bookingResult.pricing.walkerDeductionILS}</span>
                </div>
                
                <div className="flex justify-between text-xs text-green-600">
                  <span>{t('emergency.walkerPayout')}:</span>
                  <span className="font-semibold" data-testid="text-walker-payout">
                    {bookingResult.pricing.walkerPayoutILS}
                  </span>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('emergency.vat')}:</span>
                  <span data-testid="text-vat">{bookingResult.pricing.vatILS}</span>
                </div>
                
                <div className="border-t-2 border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t('emergency.total')}:</span>
                    <span className="text-blue-600" data-testid="text-total-price">
                      {bookingResult.pricing.totalChargeWithVATILS}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>

            <Button
              onClick={async () => {
                toast({
                  title: t('emergency.nayaxPayment'),
                  description: t('emergency.redirectingToNayax'),
                });
                
                try {
                  // Step 1: Create slot hold (prevents double-booking)
                  const slotId = `SLOT-${bookingResult?.matchedWalker?.walkerId}-${Date.now()}`;
                  const holdResponse = await apiRequest('/api/walks/holds', {
                    method: 'POST',
                    body: JSON.stringify({
                      slotId, // CRITICAL: Enforces unique active hold per slot
                      walkerId: bookingResult?.matchedWalker?.walkerId,
                      latitude: bookingResult?.location?.latitude || 0,
                      longitude: bookingResult?.location?.longitude || 0,
                      petName,
                      walkDuration: bookingResult?.walkDuration || 30,
                      estimatedAmount: parseFloat(bookingResult?.pricing?.totalChargeWithVATILS?.replace(/[^\d.]/g, '') || '0'),
                    }),
                  });

                  if (!holdResponse.success) {
                    throw new Error(holdResponse.error || 'Slot unavailable');
                  }

                  // Step 2: Start payment session
                  const paymentResponse = await apiRequest('/api/payments/nayax/walk-session', {
                    method: 'POST',
                    body: JSON.stringify({
                      holdId: holdResponse.holdId,
                      amount: holdResponse.estimatedAmount || parseFloat(bookingResult?.pricing?.totalChargeWithVATILS?.replace(/[^\d.]/g, '') || '0'),
                      service: 'emergency_walk',
                    }),
                  });

                  // Step 3: Redirect to Nayax
                  window.location.href = paymentResponse.redirectUrl;
                } catch (error) {
                  toast({
                    title: t('common.error'),
                    description: t('emergency.paymentFailed'),
                    variant: 'destructive',
                  });
                }
              }}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white text-lg py-6"
              data-testid="button-proceed-payment"
            >
              {t('emergency.bookAndPay')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
