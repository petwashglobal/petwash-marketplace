import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';
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

  // Auto-detect user location for pickup — uses reverse-geocode to show readable name (never raw coords)
  const detectLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(7);
          const lon = position.coords.longitude.toFixed(7);
          setPickupLat(lat);
          setPickupLon(lon);
          try {
            const params = new URLSearchParams({ lat, lng: lon, language: 'iw' });
            const res = await fetch(`/api/google/reverse-geocode?${params}`, { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              setPickupAddress(data.name || data.formattedAddress || t('booking.location.currentLocation'));
            } else {
              setPickupAddress(t('booking.location.currentLocation'));
            }
          } catch {
            setPickupAddress(t('booking.location.currentLocation'));
          }
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
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-10 luxury-animate-fade-in">
          <div className="luxury-badge inline-flex items-center gap-2 mb-4">
            <Car className="w-6 h-6" />
            <h1 className="text-3xl font-bold luxury-text-gradient">
              {t('pettrek.title')}
            </h1>
          </div>
          <p className="luxury-text-body">{t('hero.slogan')}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Pet Information Card */}
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 luxury-heading-sm">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  {t('booking.pet.information')}
                </CardTitle>
                <CardDescription className="luxury-text-small">{t('booking.pet.selectYourPet')}</CardDescription>
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
                      className="luxury-glass-minimal h-12"
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
                        className="luxury-glass-minimal h-12"
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
                        className="luxury-glass-minimal h-12"
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
                      className="luxury-glass-minimal h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="petDob" className="text-sm font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-purple-600" />
                    {t('booking.pet.choosePet')}
                  </Label>
                  <DatePicker
                    value={petDob}
                    onChange={setPetDob}
                    placeholder={t('booking.common.pickDate')}
                    maxDate={new Date()}
                    testId="datepicker-pet-dob"
                    className="luxury-glass-minimal h-14 text-lg"
                  />
                  {petDob && (
                    <p className="text-sm luxury-text-gradient font-medium">
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
                    className="luxury-glass-minimal min-h-24"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Location Card */}
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 luxury-heading-sm">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  {t('booking.location.pickupAddress')} & {t('booking.location.dropoffAddress')}
                </CardTitle>
                <CardDescription className="luxury-text-small">{t('booking.pet.selectYourPet')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    {t('booking.location.pickupAddress')} <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={detectLocation}
                      data-testid="button-detect-location"
                      className="luxury-btn-secondary h-12 flex-shrink-0"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {t('booking.location.detected')}
                    </Button>
                    <GooglePlacesAutocomplete
                      value={pickupAddress}
                      onChange={(value, details) => {
                        setPickupAddress(value);
                        if (details) {
                          setPickupLat(details.lat != null ? details.lat.toString() : '');
                          setPickupLon(details.lng != null ? details.lng.toString() : '');
                        } else {
                          setPickupLat('');
                          setPickupLon('');
                        }
                      }}
                      placeholder={t('booking.location.enterAddress')}
                      country={['il', 'us', 'gb', 'au', 'ca']}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    {t('booking.location.dropoffAddress')} <span className="text-red-500">*</span>
                  </Label>
                  <GooglePlacesAutocomplete
                    value={dropoffAddress}
                    onChange={(value, details) => {
                      setDropoffAddress(value);
                      if (details) {
                        setDropoffLat(details.lat != null ? details.lat.toString() : '');
                        setDropoffLon(details.lng != null ? details.lng.toString() : '');
                      } else {
                        setDropoffLat('');
                        setDropoffLon('');
                      }
                    }}
                    placeholder={t('booking.location.enterAddress')}
                    country={['il', 'us', 'gb', 'au', 'ca']}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Scheduling Card */}
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 luxury-heading-sm">
                  <Clock className="w-5 h-5 text-purple-600" />
                  {t('pettrek.scheduledPickupDate')}
                </CardTitle>
                <CardDescription className="luxury-text-small">{t('booking.pet.selectYourPet')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-purple-600" />
                      {t('pettrek.scheduledPickupDate')} <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      value={scheduledPickupDate}
                      onChange={setScheduledPickupDate}
                      placeholder={t('booking.common.pickDate')}
                      minDate={new Date()}
                      testId="datepicker-pickup-date"
                      className="luxury-glass-minimal h-14 text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickupTime" className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      {t('pettrek.scheduledPickupTime')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pickupTime"
                      type="time"
                      value={scheduledPickupTime}
                      onChange={(e) => setScheduledPickupTime(e.target.value)}
                      data-testid="input-pickup-time"
                      className="luxury-glass-minimal h-14 text-lg"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 luxury-animate-fade-in luxury-delay-4">
              <Button
                onClick={handleEstimateFare}
                disabled={estimateFare.isPending}
                data-testid="button-estimate-fare"
                variant="outline"
                className="luxury-btn-secondary flex-1 h-14 text-base font-semibold"
              >
                <DollarSign className="w-5 h-5 mr-2" />
                {estimateFare.isPending ? t('booking.common.processing') : t('pettrek.estimateFare')}
              </Button>

              <Button
                onClick={handleSubmitTrip}
                disabled={createTrip.isPending || !showFareEstimate}
                data-testid="button-submit-trip"
                className="luxury-btn-primary luxury-shadow-xl flex-1 h-14 text-base font-semibold"
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
              <Card className="luxury-glass-card luxury-shadow-xl sticky top-4 luxury-animate-scale-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 luxury-heading-sm">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    {t('pettrek.estimateFare')}
                  </CardTitle>
                  {fareEstimate.isPeakTime && (
                    <Badge className="luxury-badge-gold w-fit mt-2">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {fareEstimate.surgeMultiplier}x {t('hero.slogan')}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="luxury-text-small">{t('booking.common.total')}</span>
                      <span className="font-semibold luxury-text-gradient">₪{fareEstimate.baseFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="luxury-text-small">{t('booking.location.latitude')} ({fareEstimate.estimatedDistance}km)</span>
                      <span className="font-semibold luxury-text-gradient">₪{fareEstimate.distanceFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="luxury-text-small">{t('pettrek.scheduledPickupTime')} ({fareEstimate.estimatedDuration}min)</span>
                      <span className="font-semibold luxury-text-gradient">₪{fareEstimate.timeFare.toFixed(2)}</span>
                    </div>
                    {fareEstimate.surgeFare > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="luxury-text-small text-orange-600 dark:text-orange-400">{t('hero.slogan')}</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">₪{fareEstimate.surgeFare.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="luxury-divider" />
                    <div className="flex justify-between items-center pt-2">
                      <span className="luxury-heading-md">{t('booking.common.total')}</span>
                      <span className="luxury-heading-lg luxury-text-gradient">₪{fareEstimate.totalFare.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="luxury-glass-panel p-4 space-y-2 luxury-text-small">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                      <p>{t('booking.common.total')} (15%): ₪{fareEstimate.platformCommission.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                      <p>{t('booking.common.verified')} (85%): ₪{fareEstimate.driverPayout.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                      <p className="luxury-text-gradient font-medium">{t('pettrek.scheduledPickupTime')}: {fareEstimate.estimatedDuration} {t('booking.common.experience')}</p>
                    </div>
                  </div>

                  {fareEstimate.isPeakTime && (
                    <Alert className="luxury-glass-panel border-2 border-orange-300">
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
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-5">
              <CardHeader>
                <CardTitle className="luxury-heading-sm">{t('pettrek.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3 luxury-hover-lift">
                  <div className="w-10 h-10 rounded-full luxury-glass-panel flex items-center justify-center flex-shrink-0">
                    <Car className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold luxury-text-gradient">{t('booking.common.verified')}</p>
                    <p className="luxury-text-small">{t('hero.slogan')}</p>
                  </div>
                </div>
                
                <div className="luxury-divider" />
                
                <div className="flex items-start gap-3 luxury-hover-lift">
                  <div className="w-10 h-10 rounded-full luxury-glass-panel flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold luxury-text-gradient">{t('booking.location.detected')}</p>
                    <p className="luxury-text-small">{t('hero.slogan')}</p>
                  </div>
                </div>
                
                <div className="luxury-divider" />
                
                <div className="flex items-start gap-3 luxury-hover-lift">
                  <div className="w-10 h-10 rounded-full luxury-glass-panel flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold luxury-text-gradient">{t('pettrek.estimateFare')}</p>
                    <p className="luxury-text-small">{t('hero.slogan')}</p>
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
