import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar as CalendarIcon, Clock, MapPin, DollarSign, Star, Shield, 
  Award, CheckCircle2, GraduationCap, MessageCircle, Heart, 
  ArrowLeft, BookOpen, Target, Users, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/lib/languageStore";
import { GlassCard } from "@/components/LuxuryWidgets";
import { NavigationButton } from "@/components/NavigationButton";

interface Trainer {
  id: number;
  trainerId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  specialties: string[] | null;
  certifications: string[] | null;
  experienceYears: number;
  hourlyRate: string;
  serviceTypes: string[] | null;
  availableDays: string[] | null;
  languages: string[] | null;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  averageRating: string;
  totalSessions: number;
  isActive: boolean;
  isAcceptingBookings: boolean;
  isCertified: boolean;
  verificationStatus: string;
  commissionRate: string;
  location?: { lat: number; lng: number };
}

interface Review {
  id: number;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function TrainerProfile() {
  const { trainerId } = useParams();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(false);

  // Fetch trainer profile
  const { data: trainerData, isLoading } = useQuery<{ trainer: Trainer; reviews: Review[] }>({
    queryKey: [`/api/academy/trainers/${trainerId}`],
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('Loading trainer profile...')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!trainerData || !trainerData.trainer) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
          <GlassCard className="p-12 text-center max-w-md">
            <GraduationCap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('Trainer Not Found')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('This trainer profile could not be found.')}
            </p>
            <Link href="/academy">
              <Button>{t('Browse All Trainers')}</Button>
            </Link>
          </GlassCard>
        </div>
      </Layout>
    );
  }

  const { trainer, reviews } = trainerData;

  // Generate Waze deep link for navigation to trainer location
  const getWazeNavigationLink = () => {
    if (trainer.location) {
      return `https://waze.com/ul?ll=${trainer.location.lat},${trainer.location.lng}&navigate=yes`;
    }
    // Fallback to city search if no GPS coordinates
    return `https://waze.com/ul?q=${encodeURIComponent(trainer.city + ', Israel')}&navigate=yes`;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
        {/* Back Button */}
        <div className="container mx-auto px-4 pt-6">
          <Link href="/academy">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('Back to Trainers')}
            </Button>
          </Link>
        </div>

        {/* Cover Photo / Gradient */}
        <div className="relative h-64 bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500">
          {trainer.coverPhotoUrl && (
            <img src={trainer.coverPhotoUrl} alt="" className="w-full h-full object-cover opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          
          {/* Verified Badge */}
          {trainer.isCertified && (
            <div className="absolute top-4 left-4">
              <Badge className="bg-white/90 text-purple-900 border-0 shadow-lg gap-2">
                <Shield className="h-4 w-4" />
                {t('Certified Professional')}
              </Badge>
            </div>
          )}

          {/* Favorite Button */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/90 hover:bg-white transition-colors shadow-lg"
            data-testid="button-favorite-trainer"
          >
            <Heart
              className={`h-5 w-5 ${
                isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
              }`}
            />
          </button>
        </div>

        <div className="container mx-auto px-4 -mt-20 pb-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Trainer Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <GlassCard className="p-8">
                <div className="flex items-start gap-6 mb-6">
                  {/* Profile Photo */}
                  <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                    {trainer.profilePhotoUrl ? (
                      <AvatarImage src={trainer.profilePhotoUrl} alt={trainer.fullName} />
                    ) : (
                      <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-400 to-blue-400 text-white">
                        {trainer.fullName.charAt(0)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {trainer.fullName}
                    </h1>
                    
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {trainer.averageRating}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          ({trainer.totalSessions} {t('sessions')})
                        </span>
                      </div>
                      
                      <Separator orientation="vertical" className="h-6" />
                      
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="h-4 w-4" />
                        {trainer.city}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {trainer.certifications?.map((cert) => (
                        <Badge key={cert} variant="secondary" className="bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100">
                          <Award className="h-3 w-3 mr-1" />
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {t('About Me')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {trainer.bio}
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {trainer.experienceYears}+
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('Years Experience')}
                    </div>
                  </div>

                  <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {trainer.totalSessions}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('Sessions Completed')}
                    </div>
                  </div>

                  <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <Target className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {parseFloat(trainer.averageRating).toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('Rating')}
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Tabs - Specialties, Reviews, etc. */}
              <GlassCard className="p-6">
                <Tabs defaultValue="specialties">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="specialties">{t('Specialties')}</TabsTrigger>
                    <TabsTrigger value="reviews">{t('Reviews')} ({reviews.length})</TabsTrigger>
                    <TabsTrigger value="availability">{t('Availability')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="specialties" className="mt-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {t('Training Specialties')}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {trainer.specialties?.map((specialty) => (
                          <div
                            key={specialty}
                            className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20"
                          >
                            <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            <span className="text-gray-900 dark:text-white">{specialty}</span>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-6" />

                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {t('Service Types')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {trainer.serviceTypes?.map((type) => (
                          <Badge key={type} variant="outline" className="text-sm">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="reviews" className="mt-6">
                    <div className="space-y-4">
                      {reviews.length === 0 ? (
                        <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                          {t('No reviews yet')}
                        </p>
                      ) : (
                        reviews.map((review) => (
                          <div key={review.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {review.authorName}
                              </span>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < review.rating
                                        ? 'fill-yellow-500 text-yellow-500'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300">{review.comment}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="availability" className="mt-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {t('Available Days')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                          <Badge
                            key={day}
                            variant={trainer.availableDays?.includes(day) ? 'default' : 'outline'}
                            className={
                              trainer.availableDays?.includes(day)
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'opacity-50'
                            }
                          >
                            {t(day)}
                          </Badge>
                        ))}
                      </div>

                      <Separator className="my-6" />

                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {t('Languages')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {trainer.languages?.map((lang) => (
                          <Badge key={lang} variant="secondary">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </GlassCard>
            </div>

            {/* Right Column - Booking Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                {/* Pricing Card */}
                <GlassCard className="p-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                      ₪{parseFloat(trainer.hourlyRate).toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('per hour')}
                    </div>
                  </div>

                  {trainer.isAcceptingBookings ? (
                    <>
                      <Button
                        className="w-full mb-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white gap-2"
                        size="lg"
                        onClick={() => setLocation(`/academy/book/${trainer.id}`)}
                        data-testid="button-book-trainer"
                      >
                        <CalendarIcon className="h-5 w-5" />
                        {t('Book Training Session')}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full mb-3 gap-2"
                        data-testid="button-message-trainer"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {t('Message Trainer')}
                      </Button>

                      {/* Unified Navigation (Waze + Google Maps + Apple Maps) */}
                      {trainer.location ? (
                        <NavigationButton
                          latitude={trainer.location.lat}
                          longitude={trainer.location.lng}
                          address={trainer.city}
                          placeName={`${trainer.fullName} - Pet Wash Academy™`}
                          variant="outline"
                          className="w-full"
                          testId="button-navigate-trainer"
                        />
                      ) : (
                        <a href={getWazeNavigationLink()} target="_blank" rel="noopener noreferrer">
                          <Button
                            variant="outline"
                            className="w-full gap-2"
                            data-testid="button-navigate-waze"
                          >
                            <MapPin className="h-4 w-4" />
                            {t('Navigate')}
                          </Button>
                        </a>
                      )}

                      {/* Pricing Breakdown */}
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3 text-sm">
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>{t('Hourly Rate')}</span>
                          <span>₪{parseFloat(trainer.hourlyRate).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>{t('Platform Fee')} ({parseFloat(trainer.commissionRate).toFixed(0)}%)</span>
                          <span>₪{(parseFloat(trainer.hourlyRate) * parseFloat(trainer.commissionRate) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>{t('VAT on Fee')} (18%)</span>
                          <span>₪{(parseFloat(trainer.hourlyRate) * parseFloat(trainer.commissionRate) / 100 * 0.18).toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                          <span>{t('Total per Hour')}</span>
                          <span>
                            ₪{(
                              parseFloat(trainer.hourlyRate) +
                              (parseFloat(trainer.hourlyRate) * parseFloat(trainer.commissionRate) / 100) +
                              (parseFloat(trainer.hourlyRate) * parseFloat(trainer.commissionRate) / 100 * 0.18)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Info Notes */}
                      <div className="mt-6 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-start gap-2">
                          <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <span>{t('72-hour payment hold with automatic release')}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <span>{t('All payments processed by Pet Wash™ Ltd')}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <span>{t('Full refund if cancelled within 24 hours')}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">
                        {t('This trainer is not currently accepting bookings')}
                      </p>
                    </div>
                  )}
                </GlassCard>

                {/* Trust & Safety */}
                <GlassCard className="p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {t('Trust & Safety')}
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('Background Verified')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('Professional Certifications')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('Secure Payment Processing')}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
