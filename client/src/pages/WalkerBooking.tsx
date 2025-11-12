import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, MapPin, Star, Shield, Clock, DollarSign, Navigation, Camera, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';

interface WalkerProfile {
  walkerId: string;
  displayName: string;
  city: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  baseHourlyRate: string;
  currency: string;
  averageRating: string;
  totalWalks: number;
  totalReviews: number;
  hasBodyCamera: boolean;
  hasDroneAccess: boolean;
  verificationStatus: string;
  experienceYears: number | null;
}

interface PetProfile {
  id: string;
  petName: string;
  petType: string;
  breed: string;
  weight: number | null;
  specialNeeds: string;
}

export default function WalkerBooking() {
  const [, params] = useRoute('/walk-my-pet/book/:walkerId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const walkerId = params?.walkerId;
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);

  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [duration, setDuration] = useState<number>(60);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [pickupLat, setPickupLat] = useState<string>('');
  const [pickupLon, setPickupLon] = useState<string>('');
  const [petName, setPetName] = useState<string>('');
  const [petBreed, setPetBreed] = useState<string>('');
  const [petWeight, setPetWeight] = useState<string>('');
  const [petSpecialNeeds, setPetSpecialNeeds] = useState<string>('');

  // Fetch walker profile
  const { data: walker, isLoading: walkerLoading } = useQuery<WalkerProfile>({
    queryKey: ['/api/walkers', walkerId],
    enabled: !!walkerId,
  });

  // Fetch user's pets (if available)
  const { data: pets } = useQuery<PetProfile[]>({
    queryKey: ['/api/sitter-suite/my-pets'],
  });

  // Create walk booking mutation
  const createBooking = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/walks/book', 'POST', data);
    },
    onSuccess: (data: any) => {
      toast({
        title: t('booking.common.bookingSuccess'),
        description: t('walker.bookingSuccessDesc').replace('{code}', data.booking.confirmationCode),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/walks'] });
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

  // Auto-detect user location
  const detectLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(7);
          const lon = position.coords.longitude.toFixed(7);
          setPickupLat(lat);
          setPickupLon(lon);
          setPickupAddress(`${t('booking.location.currentLocation')} (${lat}, ${lon})`);
          
          toast({
            title: t('booking.location.detected'),
            description: t('booking.location.detectedDesc'),
          });
        },
        () => {
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

  const handleSubmit = () => {
    if (!scheduledDate || !scheduledTime || !pickupAddress || !pickupLat || !pickupLon || !petName) {
      toast({
        title: t('booking.common.missingInfo'),
        description: t('booking.common.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    createBooking.mutate({
      walkerId,
      scheduledDate: scheduledDate.toISOString().split('T')[0],
      scheduledStartTime: scheduledTime,
      durationMinutes: duration,
      pickupLatitude: parseFloat(pickupLat),
      pickupLongitude: parseFloat(pickupLon),
      pickupAddress,
      petName,
      petBreed,
      petWeight: petWeight ? parseFloat(petWeight) : null,
      petSpecialNeeds,
    });
  };

  // Calculate pricing
  const hourlyRate = walker ? parseFloat(walker.baseHourlyRate) : 0;
  const hours = duration / 60;
  const walkerRate = hourlyRate * hours;
  const platformFeeOwner = walkerRate * 0.06; // 6% owner pays
  const totalCost = walkerRate + platformFeeOwner;
  const walkerPayout = walkerRate * 0.82; // Walker receives 82% (base - 18%)

  if (walkerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">{t('walker.loadingProfile')}</div>
      </div>
    );
  }

  if (!walker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>{t('walker.notFound')}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Walker Info */}
          <div>
            <Card className="mb-6 sticky top-4">
              <CardHeader>
                <div className="flex items-start gap-4">
                  {walker.profilePhotoUrl ? (
                    <img 
                      src={walker.profilePhotoUrl} 
                      alt={walker.displayName}
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-blue-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-blue-200">
                      {walker.displayName.charAt(0)}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{walker.displayName}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      {walker.city}
                    </div>
                    
                    {walker.totalReviews > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{parseFloat(walker.averageRating).toFixed(1)}</span>
                        <span className="text-sm text-gray-500">
                          ({walker.totalReviews} {t('booking.common.reviews')})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {walker.bio && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {walker.bio}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {walker.experienceYears && (
                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30">
                      {walker.experienceYears}+ {t('booking.common.experience')}
                    </Badge>
                  )}
                  {walker.verificationStatus === 'verified' && (
                    <Badge variant="outline">
                      <Shield className="w-3 h-3 mr-1" />
                      {t('booking.common.verified')}
                    </Badge>
                  )}
                  {walker.hasBodyCamera && (
                    <Badge variant="outline" className="border-blue-300">
                      <Camera className="w-3 h-3 mr-1" />
                      {t('walker.bodyCamera')}
                    </Badge>
                  )}
                  {walker.hasDroneAccess && (
                    <Badge variant="outline" className="border-purple-300">
                      <Video className="w-3 h-3 mr-1" />
                      {t('walker.droneMonitoring')}
                    </Badge>
                  )}
                </div>

                <Separator className="my-4" />
                
                <div>
                  <h4 className="font-semibold mb-2">{t('walker.walkExperience')}</h4>
                  <p className="text-sm text-gray-600">
                    {walker.totalWalks} {t('walker.completedWalks')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('walker.gpsTracking')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('walker.support247')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Booking Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t('walker.title')}</CardTitle>
                <CardDescription>
                  {t('walker.subtitle')} {walker.displayName}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Date & Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('walker.walkDate')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduledDate && "text-muted-foreground"
                          )}
                          data-testid="button-scheduled-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "PPP") : t('booking.common.pickDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">{t('walker.startTime')}</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      data-testid="input-scheduled-time"
                    />
                  </div>
                </div>

                {/* Duration Selection */}
                <div className="space-y-2">
                  <Label htmlFor="duration">{t('walker.duration')}</Label>
                  <Select value={duration.toString()} onValueChange={(val) => setDuration(parseInt(val))}>
                    <SelectTrigger id="duration" data-testid="select-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">{t('walker.30min')}</SelectItem>
                      <SelectItem value="60">{t('walker.1hour')}</SelectItem>
                      <SelectItem value="90">{t('walker.1_5hours')}</SelectItem>
                      <SelectItem value="120">{t('walker.2hours')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pickup Location */}
                <div className="space-y-2">
                  <Label htmlFor="pickup">{t('booking.location.pickupAddress')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pickup"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder={t('booking.location.enterAddress')}
                      className="flex-1"
                      data-testid="input-pickup-address"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={detectLocation}
                      data-testid="button-detect-location"
                    >
                      <Navigation className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={t('booking.location.latitude')}
                      value={pickupLat}
                      onChange={(e) => setPickupLat(e.target.value)}
                      data-testid="input-pickup-lat"
                    />
                    <Input
                      placeholder={t('booking.location.longitude')}
                      value={pickupLon}
                      onChange={(e) => setPickupLon(e.target.value)}
                      data-testid="input-pickup-lon"
                    />
                  </div>
                </div>

                {/* Pet Information */}
                <Separator />
                <h4 className="font-semibold">{t('booking.pet.information')}</h4>

                {/* Pet Selection or Manual Entry */}
                {pets && pets.length > 0 ? (
                  <div className="space-y-2">
                    <Label>{t('booking.pet.selectYourPet')}</Label>
                    <Select 
                      onValueChange={(petId) => {
                        const pet = pets.find(p => p.id === petId);
                        if (pet) {
                          setPetName(pet.petName);
                          setPetBreed(pet.breed);
                          setPetWeight(pet.weight?.toString() || '');
                          setPetSpecialNeeds(pet.specialNeeds);
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-pet">
                        <SelectValue placeholder={t('booking.pet.choosePet')} />
                      </SelectTrigger>
                      <SelectContent>
                        {pets.map((pet) => (
                          <SelectItem key={pet.id} value={pet.id}>
                            {pet.petName} ({pet.breed})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="petName">{t('booking.pet.name')} *</Label>
                    <Input
                      id="petName"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="e.g., Buddy"
                      data-testid="input-pet-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="petBreed">{t('booking.pet.breed')}</Label>
                    <Input
                      id="petBreed"
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      placeholder="e.g., Golden Retriever"
                      data-testid="input-pet-breed"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="petWeight">{t('booking.pet.weight')}</Label>
                  <Input
                    id="petWeight"
                    type="number"
                    value={petWeight}
                    onChange={(e) => setPetWeight(e.target.value)}
                    placeholder="e.g., 25"
                    data-testid="input-pet-weight"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialNeeds">{t('booking.pet.specialNeeds')}</Label>
                  <Textarea
                    id="specialNeeds"
                    value={petSpecialNeeds}
                    onChange={(e) => setPetSpecialNeeds(e.target.value)}
                    placeholder={t('booking.pet.specialNeedsPlaceholder')}
                    rows={3}
                    data-testid="input-special-needs"
                  />
                </div>

                {/* Pricing Breakdown */}
                {scheduledDate && duration > 0 && (
                  <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        {t('walker.pricingBreakdown')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t('walker.walkerRate')} ({duration} min @ {walker.currency} {hourlyRate}/hr)</span>
                        <span>{walker.currency} {walkerRate.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span>{t('walker.platformFee')} (6%)</span>
                        <span>{walker.currency} {platformFeeOwner.toFixed(2)}</span>
                      </div>

                      <Separator />

                      <div className="flex justify-between text-lg font-bold text-blue-700 dark:text-blue-400">
                        <span>{t('booking.common.total')}</span>
                        <span>{walker.currency} {totalCost.toFixed(2)}</span>
                      </div>

                      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 mt-3">
                        <AlertDescription className="text-xs">
                          <p className="font-semibold mb-1">{t('walker.whatsIncluded')}</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>{t('walker.realTimeGPS')}</li>
                            <li>{t('walker.liveLocation')}</li>
                            <li>{t('walker.geofenceSafety')}</li>
                            <li>{t('walker.photoVideo')}</li>
                            <li>{t('walker.blockchainCertificate')}</li>
                          </ul>
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                )}

                {/* Submit Button */}
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-6"
                  onClick={handleSubmit}
                  disabled={createBooking.isPending}
                  data-testid="button-submit-booking"
                >
                  {createBooking.isPending ? t('booking.common.processing') : t('walker.bookWalk')}
                </Button>

                <p className="text-xs text-center text-gray-500">
                  {t('walker.termsAgreement')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
