import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { GlassmorphismCard, LuxuryButton } from '@/components/luxury/GlassmorphismCard';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Star, MapPin, Shield, CheckCircle2, Award, Calendar as CalendarIcon,
  Clock, Heart, Home, DollarSign, MessageCircle, Phone, Mail,
  Sparkles, TrendingUp, Users, Camera, Wifi, Wind, Droplet,
  Tree, Sun, Moon, Thermometer, Dog, Cat, Activity
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

export default function SitterDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Fetch sitter profile with reviews
  const { data: sitterData, isLoading } = useQuery<{
    sitter: any;
    reviews: any[];
  }>({
    queryKey: [`/api/sitter-suite/sitters/${id}`],
  });

  // Fetch user's pets
  const { data: pets } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/pets', user?.uid],
    queryFn: () => {
      if (!user?.uid) throw new Error('User not authenticated');
      return fetch(`/api/sitter-suite/pets?userId=${user.uid}`).then(res => {
        if (!res.ok) throw new Error('Failed to fetch pets');
        return res.json();
      });
    },
    enabled: !!user,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      return apiRequest('/api/sitter-suite/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingData),
      });
    },
    onSuccess: (data) => {
      toast({
        title: isHebrew ? 'הזמנה נוצרה בהצלחה!' : 'Booking Created!',
        description: isHebrew 
          ? 'השמרטף יקבל את ההצעה. תקבל עדכון כשהוא יגיב.' 
          : 'Sitter will receive the offer. You\'ll get notified when they respond.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sitter-suite/bookings'] });
      navigate(`/sitter-suite/owner/dashboard`);
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message || (isHebrew ? 'לא ניתן ליצור הזמנה' : 'Failed to create booking'),
        variant: 'destructive',
      });
    },
  });

  const sitter = sitterData?.sitter;
  const reviews = sitterData?.reviews || [];

  const calculateTotalCost = () => {
    if (!startDate || !endDate) return 0;
    const days = Math.max(1, differenceInDays(endDate, startDate));
    const basePrice = (sitter?.pricePerDayCents || 0) / 100;
    const platformFee = basePrice * days * 0.1; // 10% platform fee
    return basePrice * days + platformFee;
  };

  const handleBooking = async () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew ? 'אנא התחבר כדי להזמין' : 'Please log in to book',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }

    if (!selectedPetId || !startDate || !endDate) {
      toast({
        title: isHebrew ? 'פרטים חסרים' : 'Missing Details',
        description: isHebrew 
          ? 'אנא בחר חיית מחמד ותאריכים' 
          : 'Please select a pet and dates',
        variant: 'destructive',
      });
      return;
    }

    const days = Math.max(1, differenceInDays(endDate, startDate));
    const basePriceCents = (sitter?.pricePerDayCents || 0) * days;
    const platformServiceFeeCents = Math.round(basePriceCents * 0.1);
    const totalChargeCents = basePriceCents + platformServiceFeeCents;

    await createBookingMutation.mutateAsync({
      ownerId: user.uid,
      ownerPaymentToken: 'PLACEHOLDER_TOKEN',
      sitterId: parseInt(id!),
      petId: selectedPetId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDays: days,
      basePriceCents,
      platformServiceFeeCents,
      brokerCutCents: Math.round(basePriceCents * 0.07),
      sitterPayoutCents: Math.round(basePriceCents * 0.93),
      totalChargeCents,
      specialInstructions,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {isHebrew ? 'טוען...' : 'Loading...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!sitter) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {isHebrew ? 'שמרטף לא נמצא' : 'Sitter not found'}
            </p>
            <Button onClick={() => navigate('/sitter-suite')} className="mt-4">
              {isHebrew ? 'חזור לרשימה' : 'Back to List'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const totalCost = calculateTotalCost();
  const days = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : 0;

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Sitter Profile Header */}
          <div className="luxury-glass-card luxury-shadow-xl mb-8 p-8 luxury-animate-fade-in">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left: Profile Photo */}
              <div className="lg:col-span-1 luxury-animate-scale-in luxury-delay-1">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-purple-200 via-pink-200 to-amber-200 border-4 border-transparent bg-clip-padding" style={{
                  backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box'
                }}>
                  {sitter.profilePictureUrl ? (
                    <img 
                      src={sitter.profilePictureUrl} 
                      alt={`${sitter.firstName} ${sitter.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-24 h-24 text-purple-400" />
                    </div>
                  )}
                  {sitter.isVerified && (
                    <div className="absolute top-4 right-4">
                      <div className="luxury-badge-gold p-3 rounded-full">
                        <Shield className="w-6 h-6" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                    <div className="luxury-badge-gold inline-flex items-center gap-2">
                      <Star className="h-6 w-6 fill-current" />
                      <span className="font-bold text-2xl">{sitter.rating}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Profile Info */}
              <div className="lg:col-span-2 space-y-6 luxury-animate-fade-in luxury-delay-2">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="luxury-heading-xl">
                      {sitter.firstName} {sitter.lastName}
                    </h1>
                    {sitter.isVerified && (
                      <div className="luxury-badge-gold">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{isHebrew ? 'מאומת' : 'Verified'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-700 mb-4">
                    <MapPin className="w-6 h-6 text-purple-600" />
                    <span className="text-xl font-medium">{sitter.city}</span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="luxury-glass-card luxury-hover-lift text-center p-5 luxury-animate-scale-in luxury-delay-3">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                        <Star className="w-7 h-7 text-white fill-white" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold luxury-text-gradient">
                      {sitter.rating || '5.0'}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'דירוג' : 'Rating'}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift text-center p-5 luxury-animate-scale-in luxury-delay-4">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Award className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold luxury-text-gradient">
                      {sitter.totalBookings || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'הזמנות' : 'Stays'}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift text-center p-5 luxury-animate-scale-in luxury-delay-5">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Clock className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold luxury-text-gradient">
                      &lt;1h
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'זמן תגובה' : 'Response'}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift text-center p-5 luxury-animate-scale-in luxury-delay-6">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <TrendingUp className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold luxury-text-gradient">
                      {sitter.yearsOfExperience || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'שנות ניסיון' : 'Years'}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-7">
                  <h3 className="luxury-heading-md mb-3 luxury-text-gradient">
                    {isHebrew ? 'אודות' : 'About Me'}
                  </h3>
                  <p className="luxury-text-body">
                    {sitter.bio || (isHebrew ? 'אין תיאור זמין' : 'No description available')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Section */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Booking Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Select Pet */}
              {user && pets && pets.length > 0 && (
                <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-8">
                  <h3 className="luxury-heading-md mb-6 flex items-center gap-3 luxury-text-gradient">
                    <Dog className="w-8 h-8 text-purple-600" />
                    {isHebrew ? 'בחר חיית מחמד' : 'Select Your Pet'}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {pets.map((pet, idx) => (
                      <div
                        key={pet.id}
                        onClick={() => setSelectedPetId(pet.id)}
                        className={`luxury-glass-minimal luxury-hover-lift p-4 cursor-pointer transition-all luxury-animate-scale-in luxury-delay-${Math.min(10, 9 + idx)} ${
                          selectedPetId === pet.id
                            ? 'border-2 border-purple-600 luxury-shadow-lg'
                            : 'border border-gray-200 dark:border-gray-700'
                        }`}
                        data-testid={`pet-option-${pet.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {pet.photoUrl ? (
                            <img 
                              src={pet.photoUrl} 
                              alt={pet.name}
                              className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center ring-2 ring-purple-200">
                              <Dog className="w-8 h-8 text-purple-600" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">{pet.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{pet.breed}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">{pet.weight}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Select Dates */}
              <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-9">
                <h3 className="luxury-heading-md mb-6 flex items-center gap-3 luxury-text-gradient">
                  <CalendarIcon className="w-8 h-8 text-purple-600" />
                  {isHebrew ? 'בחר תאריכים' : 'Select Dates'}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-gray-700">
                      {isHebrew ? 'תאריך התחלה' : 'Start Date'}
                    </label>
                    <div className="luxury-glass-minimal p-2">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => date < new Date()}
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-gray-700">
                      {isHebrew ? 'תאריך סיום' : 'End Date'}
                    </label>
                    <div className="luxury-glass-minimal p-2">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => !startDate || date < startDate}
                        className="rounded-md"
                      />
                    </div>
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="mt-6 luxury-glass-card luxury-shadow-md p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold text-lg">
                        {isHebrew ? 'סה"כ ימים:' : 'Total Days:'}
                      </span>
                      <span className="text-4xl font-bold luxury-text-gradient">
                        {days} {isHebrew ? 'ימים' : days === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reviews */}
              {reviews.length > 0 && (
                <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-10">
                  <h3 className="luxury-heading-md mb-6 flex items-center gap-3">
                    <div className="luxury-badge-gold">
                      <Star className="w-6 h-6 fill-current" />
                    </div>
                    <span className="luxury-text-gradient">
                      {isHebrew ? 'ביקורות' : 'Reviews'} ({reviews.length})
                    </span>
                  </h3>
                  <div className="space-y-4">
                    {reviews.map((review, idx) => (
                      <div key={review.id} className={`luxury-glass-minimal luxury-hover-lift p-5 luxury-animate-fade-in luxury-delay-${Math.min(10, idx + 1)}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="luxury-badge-gold inline-flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating
                                    ? 'fill-current'
                                    : 'text-gray-300 fill-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-gray-600">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="luxury-text-body">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Booking Summary */}
            <div className="lg:col-span-1">
              <div className="luxury-glass-card luxury-shadow-xl sticky top-24 p-6 luxury-animate-scale-in luxury-delay-8">
                <h3 className="luxury-heading-lg mb-6 luxury-text-gradient text-center">
                  {isHebrew ? 'סיכום הזמנה' : 'Booking Summary'}
                </h3>
                <div className="space-y-6">
                  {/* Price Breakdown */}
                  <div className="space-y-4">
                    <div className="flex justify-between luxury-text-body">
                      <span className="font-medium">₪{(sitter.pricePerDayCents / 100).toFixed(0)} × {days} {isHebrew ? 'ימים' : 'days'}</span>
                      <span className="font-bold">₪{days > 0 ? ((sitter.pricePerDayCents / 100) * days).toFixed(0) : '0'}</span>
                    </div>
                    <div className="flex justify-between luxury-text-body">
                      <span className="font-medium">{isHebrew ? 'עמלת שירות' : 'Service Fee'} (10%)</span>
                      <span className="font-bold">₪{days > 0 ? (((sitter.pricePerDayCents / 100) * days * 0.1).toFixed(0)) : '0'}</span>
                    </div>
                    <div className="luxury-divider"></div>
                    <div className="luxury-glass-minimal p-4">
                      <div className="flex justify-between items-center">
                        <span className="luxury-heading-sm">{isHebrew ? 'סה"כ' : 'Total'}</span>
                        <span className="text-5xl font-bold luxury-text-gradient">
                          ₪{totalCost.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Book Button */}
                  <button
                    className="luxury-btn-primary luxury-shadow-xl w-full h-16 text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleBooking}
                    disabled={!selectedPetId || !startDate || !endDate || createBookingMutation.isPending}
                    data-testid="button-confirm-booking"
                  >
                    {createBookingMutation.isPending ? (
                      <>
                        <div className="luxury-spinner w-6 h-6"></div>
                        <span>{isHebrew ? 'מעבד...' : 'Processing...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6" />
                        <span>{isHebrew ? 'הזמן עכשיו' : 'Book Now'}</span>
                      </>
                    )}
                  </button>

                  <div className="luxury-badge-success w-full text-center p-3">
                    {isHebrew 
                      ? '✅ לא תחויב עד שהשמרטף יאשר'
                      : '✅ You won\'t be charged until confirmed'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
