import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Car, MapPin, Calendar as CalendarIcon, Clock, DollarSign, AlertCircle, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';

interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  subtotal: number;
  platformCommission: number;
  driverPayout: number;
  totalFare: number;
  estimatedDistance: number;
  estimatedDuration: number;
  isPeakTime: boolean;
  surgeMultiplier: number;
}

export default function PetTrekBooking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);

  // Pet Information
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('');
  const [petSize, setPetSize] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petDob, setPetDob] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Location Information
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLon, setPickupLon] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState('');
  const [dropoffLon, setDropoffLon] = useState('');

  // Scheduling
  const [scheduledPickupDate, setScheduledPickupDate] = useState('');
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');

  // Fare Estimation
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [showFareEstimate, setShowFareEstimate] = useState(false);

  // Clear fare estimate when pricing-critical inputs change
  useEffect(() => {
    if (showFareEstimate) {
      setShowFareEstimate(false);
      setFareEstimate(null);
    }
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon, scheduledPickupDate, scheduledPickupTime, petSize]);

  // Calculate fare estimate when locations are set
  const estimateFare = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/pettrek/estimate-fare', 'POST', data);
    },
    onSuccess: (data: FareEstimate) => {
      setFareEstimate(data);
      setShowFareEstimate(true);
    },
    onError: (error: any) => {
      toast({
        title: t('pettrek.fareEstimateFailed'),
        description: error.message || t('pettrek.unableToCalculate'),
        variant: 'destructive',
      });
    },
  });

  // Create trip request
  const createTrip = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/pettrek/trips', 'POST', data);
    },
    onSuccess: (data: any) => {
      toast({
        title: t('pettrek.tripRequested'),
        description: t('pettrek.searchingDrivers').replace('{{tripId}}', data.tripId),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pettrek/my-trips'] });
      setLocation(`/pettrek/track/${data.tripId}`);
    },
    onError: (error: any) => {
      toast({
        title: t('booking.common.bookingFailed'),
        description: error.message || t('booking.common.tryAgain'),
        variant: 'destructive',
      });
    },
  });

  // Auto-detect user location for pickup
  const detectLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(7);
          const lon = position.coords.longitude.toFixed(7);
          setPickupLat(lat);
          setPickupLon(lon);
          
          // Reverse geocode to get address (simplified placeholder)
          setPickupAddress(`${t('booking.location.currentLocation')} (${lat}, ${lon})`);
          
          toast({
            title: t('booking.location.detected'),
            description: t('booking.location.detectedDesc'),
          });
        },
        (error) => {
          toast({
            title: t('booking.location.error'),
            description: t('booking.location.errorDesc'),
            variant: 'destructive',
          });
        }
      );
    } else {
      toast({
        title: t('booking.location.notSupported'),
        description: t('booking.location.enterManually'),
        variant: 'destructive',
      });
    }
  };

  const handleEstimateFare = () => {
    if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon) {
      toast({
        title: t('booking.common.missingInfo'),
        description: t('booking.location.enterManually'),
        variant: 'destructive',
      });
      return;
    }

    if (!scheduledPickupDate || !scheduledPickupTime) {
      toast({
        title: t('booking.common.missingInfo'),
        description: t('booking.common.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    estimateFare.mutate({
      pickupLatitude: parseFloat(pickupLat),
      pickupLongitude: parseFloat(pickupLon),
      dropoffLatitude: parseFloat(dropoffLat),
      dropoffLongitude: parseFloat(dropoffLon),
      scheduledPickupTime: `${scheduledPickupDate}T${scheduledPickupTime}:00Z`,
      petSize,
    });
  };

  const handleSubmitTrip = () => {
    if (!user) {
      toast({
        title: t('booking.common.missingInfo'),
        description: t('booking.common.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    if (!petName || !petType || !petSize || !pickupLat || !pickupLon || !dropoffLat || !dropoffLon || !scheduledPickupDate || !scheduledPickupTime) {
      toast({
        title: t('booking.common.missingInfo'),
        description: t('booking.common.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    if (!fareEstimate || !showFareEstimate) {
      toast({
        title: t('booking.common.missingInfo'),
        description: t('booking.common.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    createTrip.mutate({
      customerId: user.uid,
      petName,
      petType,
      petSize,
      petWeight: petWeight ? parseFloat(petWeight) : null,
      petDateOfBirth: petDob || null,
      specialInstructions,
      pickupLatitude: parseFloat(pickupLat),
      pickupLongitude: parseFloat(pickupLon),
      pickupAddress,
      dropoffLatitude: parseFloat(dropoffLat),
      dropoffLongitude: parseFloat(dropoffLon),
      dropoffAddress,
      scheduledPickupTime: `${scheduledPickupDate}T${scheduledPickupTime}:00Z`,
      serviceType: 'transport',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4 px-6 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-blue-200 dark:border-blue-700">
            <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
              {t('pettrek.title')}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">{t('hero.slogan')}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Pet Information Card */}
            <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/50 dark:to-cyan-900/50">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  {t('booking.pet.information')}
                </CardTitle>
                <CardDescription>{t('booking.pet.selectYourPet')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="petName" className="text-sm font-semibold">
                      {t('booking.pet.name')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="petName"
                      data-testid="input-pet-name"
                      placeholder={t('booking.pet.choosePet')}
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      className="h-12 rounded-xl border-2 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="petType" className="text-sm font-semibold">
                      {t('booking.pet.breed')} <span className="text-red-500">*</span>
                    </Label>
                    <Select value={petType} onValueChange={setPetType}>
                      <SelectTrigger 
                        id="petType" 
                        data-testid="select-pet-type"
                        className="h-12 rounded-xl border-2"
                      >
                        <SelectValue placeholder={t('booking.pet.choosePet')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dog">Dog</SelectItem>
                        <SelectItem value="cat">Cat</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="petSize" className="text-sm font-semibold">
                      {t('pettrek.petSize')} <span className="text-red-500">*</span>
                    </Label>
                    <Select value={petSize} onValueChange={setPetSize}>
                      <SelectTrigger 
                        id="petSize" 
                        data-testid="select-pet-size"
                        className="h-12 rounded-xl border-2"
                      >
                        <SelectValue placeholder={t('booking.pet.choosePet')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">{t('pettrek.small')} (up to 10kg)</SelectItem>
                        <SelectItem value="medium">{t('pettrek.medium')} (10-25kg)</SelectItem>
                        <SelectItem value="large">{t('pettrek.large')} (25-45kg)</SelectItem>
                        <SelectItem value="xlarge">Extra {t('pettrek.large')} (45kg+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="petWeight" className="text-sm font-semibold">
                      {t('booking.pet.weight')}
                    </Label>
                    <Input
                      id="petWeight"
                      data-testid="input-pet-weight"
                      type="number"
                      step="0.1"
                      placeholder="12.5 kg"
                      value={petWeight}
                      onChange={(e) => setPetWeight(e.target.value)}
                      className="h-12 rounded-xl border-2 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="petDob" className="text-sm font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    {t('booking.pet.choosePet')}
                  </Label>
                  <DatePicker
                    value={petDob}
                    onChange={setPetDob}
                    placeholder={t('booking.common.pickDate')}
                    maxDate={new Date()}
                    testId="datepicker-pet-dob"
                    className="h-14 text-lg"
                  />
                  {petDob && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      {Math.floor((new Date().getTime() - new Date(petDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} {t('booking.common.experience')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialInstructions" className="text-sm font-semibold">
                    {t('booking.pet.specialNeeds')}
                  </Label>
                  <Textarea
                    id="specialInstructions"
                    data-testid="textarea-special-instructions"
                    placeholder={t('booking.pet.specialNeedsPlaceholder')}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="min-h-24 rounded-xl border-2 focus:border-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Location Card */}
            <Card className="border-2 border-cyan-100 dark:border-cyan-900 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/50 dark:to-blue-900/50">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-600" />
                  {t('booking.location.pickupAddress')} & {t('booking.location.dropoffAddress')}
                </CardTitle>
                <CardDescription>{t('booking.pet.selectYourPet')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {t('booking.location.pickupAddress')} <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={detectLocation}
                      data-testid="button-detect-location"
                      className="h-12 rounded-xl border-2 flex-shrink-0"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {t('booking.location.detected')}
                    </Button>
                    <Input
                      placeholder={t('booking.location.enterAddress')}
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      data-testid="input-pickup-address"
                      className="h-12 rounded-xl border-2 focus:border-cyan-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={t('booking.location.latitude')}
                      value={pickupLat}
                      onChange={(e) => setPickupLat(e.target.value)}
                      data-testid="input-pickup-lat"
                      className="h-10 rounded-lg border-2 text-sm"
                    />
                    <Input
                      placeholder={t('booking.location.longitude')}
                      value={pickupLon}
                      onChange={(e) => setPickupLon(e.target.value)}
                      data-testid="input-pickup-lon"
                      className="h-10 rounded-lg border-2 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {t('booking.location.dropoffAddress')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder={t('booking.location.enterAddress')}
                    value={dropoffAddress}
                    onChange={(e) => setDropoffAddress(e.target.value)}
                    data-testid="input-dropoff-address"
                    className="h-12 rounded-xl border-2 focus:border-cyan-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={t('booking.location.latitude')}
                      value={dropoffLat}
                      onChange={(e) => setDropoffLat(e.target.value)}
                      data-testid="input-dropoff-lat"
                      className="h-10 rounded-lg border-2 text-sm"
                    />
                    <Input
                      placeholder={t('booking.location.longitude')}
                      value={dropoffLon}
                      onChange={(e) => setDropoffLon(e.target.value)}
                      data-testid="input-dropoff-lon"
                      className="h-10 rounded-lg border-2 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scheduling Card */}
            <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/50 dark:to-pink-900/50">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  {t('pettrek.scheduledPickupDate')}
                </CardTitle>
                <CardDescription>{t('booking.pet.selectYourPet')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {t('pettrek.scheduledPickupDate')} <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      value={scheduledPickupDate}
                      onChange={setScheduledPickupDate}
                      placeholder={t('booking.common.pickDate')}
                      minDate={new Date()}
                      testId="datepicker-pickup-date"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickupTime" className="text-sm font-semibold">
                      {t('pettrek.scheduledPickupTime')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pickupTime"
                      type="time"
                      value={scheduledPickupTime}
                      onChange={(e) => setScheduledPickupTime(e.target.value)}
                      data-testid="input-pickup-time"
                      className="h-14 rounded-xl border-2 text-lg focus:border-purple-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleEstimateFare}
                disabled={estimateFare.isPending}
                data-testid="button-estimate-fare"
                variant="outline"
                className="flex-1 h-14 rounded-xl text-base font-semibold border-2 border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <DollarSign className="w-5 h-5 mr-2" />
                {estimateFare.isPending ? t('booking.common.processing') : t('pettrek.estimateFare')}
              </Button>

              <Button
                onClick={handleSubmitTrip}
                disabled={createTrip.isPending || !showFareEstimate}
                data-testid="button-submit-trip"
                className="flex-1 h-14 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg"
              >
                <Car className="w-5 h-5 mr-2" />
                {createTrip.isPending ? t('booking.common.processing') : t('pettrek.requestTrip')}
              </Button>
            </div>
          </div>

          {/* Right Column - Fare Estimate & Info */}
          <div className="space-y-6">
            
            {/* Fare Estimate Card */}
            {showFareEstimate && fareEstimate && (
              <Card className="border-2 border-green-200 dark:border-green-800 shadow-xl sticky top-4 animate-in slide-in-from-right duration-500">
                <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/50 dark:to-emerald-900/50">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    {t('pettrek.estimateFare')}
                  </CardTitle>
                  {fareEstimate.isPeakTime && (
                    <Badge variant="destructive" className="w-fit">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {fareEstimate.surgeMultiplier}x {t('hero.slogan')}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('booking.common.total')}</span>
                      <span className="font-semibold">₪{fareEstimate.baseFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('booking.location.latitude')} ({fareEstimate.estimatedDistance}km)</span>
                      <span className="font-semibold">₪{fareEstimate.distanceFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('pettrek.scheduledPickupTime')} ({fareEstimate.estimatedDuration}min)</span>
                      <span className="font-semibold">₪{fareEstimate.timeFare.toFixed(2)}</span>
                    </div>
                    {fareEstimate.surgeFare > 0 && (
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span>{t('hero.slogan')}</span>
                        <span className="font-semibold">₪{fareEstimate.surgeFare.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t('booking.common.total')}</span>
                      <span className="text-green-600 dark:text-green-400">₪{fareEstimate.totalFare.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <p>• {t('booking.common.total')} (20%): ₪{fareEstimate.platformCommission.toFixed(2)}</p>
                    <p>• {t('booking.common.verified')} (80%): ₪{fareEstimate.driverPayout.toFixed(2)}</p>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">• {t('pettrek.scheduledPickupTime')}: {fareEstimate.estimatedDuration} {t('booking.common.experience')}</p>
                  </div>

                  {fareEstimate.isPeakTime && (
                    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800 dark:text-orange-200 text-xs">
                        {t('hero.slogan')}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Info Card */}
            <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">{t('pettrek.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{t('booking.common.verified')}</p>
                    <p className="text-gray-600 dark:text-gray-400">{t('hero.slogan')}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{t('booking.location.detected')}</p>
                    <p className="text-gray-600 dark:text-gray-400">{t('hero.slogan')}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{t('pettrek.estimateFare')}</p>
                    <p className="text-gray-600 dark:text-gray-400">{t('hero.slogan')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
