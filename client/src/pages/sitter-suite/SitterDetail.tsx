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
    queryKey: ['/api/sitter-suite/sitters', id],
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Sitter Profile Header */}
          <GlassmorphismCard className="mb-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left: Profile Photo */}
              <div className="lg:col-span-1">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-purple-200 via-pink-200 to-amber-200">
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
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-3 rounded-full shadow-xl backdrop-blur-sm">
                      <Shield className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                    <div className="flex items-center gap-3">
                      <Star className="h-8 w-8 fill-amber-300 text-amber-300" />
                      <span className="text-white font-bold text-3xl">{sitter.rating}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Profile Info */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent">
                      {sitter.firstName} {sitter.lastName}
                    </h1>
                    {sitter.isVerified && (
                      <div className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full shadow-lg">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">{isHebrew ? 'מאומת' : 'Verified'}</span>
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
                  <div className="text-center p-5 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                      {sitter.rating || '5.0'}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'דירוג' : 'Rating'}
                    </div>
                  </div>

                  <div className="text-center p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <Award className="w-7 h-7 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {sitter.totalBookings || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'הזמנות' : 'Stays'}
                    </div>
                  </div>

                  <div className="text-center p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <Clock className="w-7 h-7 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      &lt;1h
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'זמן תגובה' : 'Response'}
                    </div>
                  </div>

                  <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <TrendingUp className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      {sitter.yearsOfExperience || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      {isHebrew ? 'שנות ניסיון' : 'Years'}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border-2 border-purple-100">
                  <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'אודות' : 'About Me'}
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    {sitter.bio || (isHebrew ? 'אין תיאור זמין' : 'No description available')}
                  </p>
                </div>
              </div>
            </div>
          </GlassmorphismCard>

          {/* Booking Section */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Booking Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Select Pet */}
              {user && pets && pets.length > 0 && (
                <GlassmorphismCard>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      <Dog className="w-7 h-7 text-purple-600" />
                      {isHebrew ? 'בחר חיית מחמד' : 'Select Your Pet'}
                    </h3>
                    <div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {pets.map((pet) => (
                        <div
                          key={pet.id}
                          onClick={() => setSelectedPetId(pet.id)}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedPetId === pet.id
                              ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                          }`}
                          data-testid={`pet-option-${pet.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {pet.photoUrl ? (
                              <img 
                                src={pet.photoUrl} 
                                alt={pet.name}
                                className="w-16 h-16 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
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
                  </div>
                </GlassmorphismCard>
              )}

              {/* Select Dates */}
              <GlassmorphismCard>
                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    <CalendarIcon className="w-7 h-7 text-purple-600" />
                    {isHebrew ? 'בחר תאריכים' : 'Select Dates'}
                  </h3>
                  <div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {isHebrew ? 'תאריך התחלה' : 'Start Date'}
                      </label>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {isHebrew ? 'תאריך סיום' : 'End Date'}
                      </label>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => !startDate || date < startDate}
                        className="rounded-md border"
                      />
                    </div>
                  </div>

                  {startDate && endDate && (
                    <div className="mt-6 p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">
                          {isHebrew ? 'סה"כ ימים:' : 'Total Days:'}
                        </span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {days} {isHebrew ? 'ימים' : days === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                    </div>
                  )}
                  </div>
                  </div>
              </GlassmorphismCard>

              {/* Reviews */}
              {reviews.length > 0 && (
                <GlassmorphismCard>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                      <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
                      {isHebrew ? 'ביקורות' : 'Reviews'} ({reviews.length})
                    </h3>
                    <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-5 h-5 ${
                                  i < review.rating
                                    ? 'text-amber-500 fill-amber-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-gray-600">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                  </div>
                </GlassmorphismCard>
              )}
            </div>

            {/* Right: Booking Summary */}
            <div className="lg:col-span-1">
              <GlassmorphismCard className="sticky top-24">
                <div className="p-6">
                  <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'סיכום הזמנה' : 'Booking Summary'}
                  </h3>
                  <div className="space-y-6">
                  {/* Price Breakdown */}
                  <div className="space-y-4">
                    <div className="flex justify-between text-gray-700 text-lg">
                      <span className="font-medium">₪{(sitter.pricePerDayCents / 100).toFixed(0)} × {days} {isHebrew ? 'ימים' : 'days'}</span>
                      <span className="font-bold">₪{days > 0 ? ((sitter.pricePerDayCents / 100) * days).toFixed(0) : '0'}</span>
                    </div>
                    <div className="flex justify-between text-gray-700 text-lg">
                      <span className="font-medium">{isHebrew ? 'עמלת שירות' : 'Service Fee'} (10%)</span>
                      <span className="font-bold">₪{days > 0 ? (((sitter.pricePerDayCents / 100) * days * 0.1).toFixed(0)) : '0'}</span>
                    </div>
                    <div className="border-t-2 border-purple-200 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-gray-900">{isHebrew ? 'סה"כ' : 'Total'}</span>
                        <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent">
                          ₪{totalCost.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Book Button */}
                  <LuxuryButton
                    className="w-full h-16 text-xl"
                    onClick={handleBooking}
                    disabled={!selectedPetId || !startDate || !endDate || createBookingMutation.isPending}
                    data-testid="button-confirm-booking"
                  >
                    {createBookingMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        {isHebrew ? 'מעבד...' : 'Processing...'}
                      </div>
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6 mr-2" />
                        {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                      </>
                    )}
                  </LuxuryButton>

                  <p className="text-sm text-center text-gray-600 bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-xl border border-green-200">
                    {isHebrew 
                      ? '✅ לא תחויב עד שהשמרטף יאשר'
                      : '✅ You won\'t be charged until confirmed'}
                  </p>
                  </div>
                </div>
              </GlassmorphismCard>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
