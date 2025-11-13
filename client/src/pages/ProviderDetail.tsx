import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassmorphismCard } from '@/components/luxury/GlassmorphismCard';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useProviderDetails } from '@/services/marketplace';
import {
  Star, MapPin, Shield, CheckCircle2, Award, Calendar as CalendarIcon,
  Clock, DollarSign, MessageCircle, Phone, Mail,
  TrendingUp, Users, Video, Plane, Dog, Car, Scissors
} from 'lucide-react';
import type { MarketplacePlatformId } from '@shared/schema';

export default function ProviderDetail() {
  const { platform, id } = useParams<{ platform: MarketplacePlatformId; id: string }>();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  const [showContactInfo, setShowContactInfo] = useState(false);

  // Fetch provider details
  const { data, isLoading, error } = useProviderDetails(platform!, id!);
  const provider = data?.provider;

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
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

  if (error || !provider) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
          <div className="text-center">
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {isHebrew ? 'ספק לא נמצא' : 'Provider not found'}
            </p>
            <Button onClick={() => navigate('/marketplace')} className="mt-4" data-testid="button-back-marketplace">
              {isHebrew ? 'חזור לשוק' : 'Back to Marketplace'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleBooking = () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew ? 'אנא התחבר כדי להזמין' : 'Please log in to book',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }

    // Navigate to booking flow with provider details
    navigate(`/marketplace/book/${platform}/${id}`);
  };

  const toggleContactInfo = () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew ? 'אנא התחבר כדי לראות פרטי קשר' : 'Please log in to view contact details',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }
    setShowContactInfo(!showContactInfo);
  };

  // Platform-specific labels
  const platformLabels = {
    walk_my_pet: {
      en: 'Dog Walker',
      he: 'מטייל כלבים',
    },
    sitter_suite: {
      en: 'Pet Sitter',
      he: 'שמרטף',
    },
    pet_trek: {
      en: 'Pet Transporter',
      he: 'מוביל חיות מחמד',
    },
    groomers: {
      en: 'Pet Groomer',
      he: 'מספר חיות מחמד',
    },
  };

  const platformLabel = platformLabels[provider.platform]?.[isHebrew ? 'he' : 'en'] || 'Provider';

  // Platform-specific badges
  const renderPlatformBadges = () => {
    const badges: React.ReactNode[] = [];

    if (provider.kind === 'walker') {
      if (provider.bodyCamera) {
        badges.push(
          <Badge key="bodycam" variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="badge-body-camera">
            <Video className="w-4 h-4 mr-1" />
            {isHebrew ? 'מצלמת גוף' : 'Body Camera'}
          </Badge>
        );
      }
      if (provider.droneAccess) {
        badges.push(
          <Badge key="drone" variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" data-testid="badge-drone">
            <Plane className="w-4 h-4 mr-1" />
            {isHebrew ? 'גישה לרחפן' : 'Drone Access'}
          </Badge>
        );
      }
    }

    if (provider.kind === 'sitter' && provider.hasOwnPets) {
      badges.push(
        <Badge key="pets" variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-has-pets">
          <Dog className="w-4 h-4 mr-1" />
          {isHebrew ? 'יש חיות מחמד' : 'Has Pets'}
        </Badge>
      );
    }

    // Only return badges if we have any
    return badges.length > 0 ? badges : null;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Provider Profile Header */}
          <GlassmorphismCard className="mb-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left: Profile Photo */}
              <div className="lg:col-span-1">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-purple-200 via-pink-200 to-amber-200">
                  {provider.profilePictureUrl ? (
                    <img 
                      src={provider.profilePictureUrl} 
                      alt={`${provider.firstName} ${provider.lastName}`}
                      className="w-full h-full object-cover"
                      data-testid="img-provider-photo"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-24 h-24 text-purple-400" />
                    </div>
                  )}
                  {provider.isVerified && (
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-3 rounded-full shadow-xl backdrop-blur-sm" data-testid="badge-verified-shield">
                      <Shield className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                    <div className="flex items-center gap-3">
                      <Star className="h-8 w-8 fill-amber-300 text-amber-300" />
                      <span className="text-white font-bold text-3xl" data-testid="text-provider-rating">{provider.rating || '5.0'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Profile Info */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent" data-testid="text-provider-name">
                      {provider.firstName} {provider.lastName}
                    </h1>
                    {provider.isVerified && (
                      <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full shadow-lg" data-testid="badge-verified">
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        {isHebrew ? 'מאומת' : 'Verified'}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-3">{platformLabel}</p>

                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-4">
                    <MapPin className="w-6 h-6 text-purple-600" />
                    <span className="text-xl font-medium" data-testid="text-provider-city">{provider.city}</span>
                  </div>

                  {/* Platform-specific badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {renderPlatformBadges()}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-5 bg-white dark:bg-black rounded-2xl border-2 border-amber-200 dark:border-amber-800 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent" data-testid="stat-rating">
                      {provider.rating || '5.0'}
                    </div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                      {isHebrew ? 'דירוג' : 'Rating'}
                    </div>
                  </div>

                  <div className="text-center p-5 bg-white dark:bg-black rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <Award className="w-7 h-7 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" data-testid="stat-total-bookings">
                      {provider.totalBookings || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                      {isHebrew ? 'הזמנות' : 'Bookings'}
                    </div>
                  </div>

                  <div className="text-center p-5 bg-white dark:bg-black rounded-2xl border-2 border-green-200 dark:border-green-800 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <Clock className="w-7 h-7 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      &lt;1h
                    </div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                      {isHebrew ? 'זמן תגובה' : 'Response'}
                    </div>
                  </div>

                  <div className="text-center p-5 bg-white dark:bg-black rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                    <div className="flex justify-center mb-2">
                      <TrendingUp className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent" data-testid="stat-years-experience">
                      {provider.yearsOfExperience || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                      {isHebrew ? 'שנות ניסיון' : 'Years'}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="bg-white dark:bg-black p-6 rounded-2xl border-2 border-purple-100 dark:border-purple-900">
                  <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'אודות' : 'About'}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg" data-testid="text-provider-bio">
                    {provider.bio || (isHebrew ? 'אין תיאור זמין' : 'No description available')}
                  </p>
                </div>

                {/* Certifications */}
                {provider.kind === 'walker' && provider.certifications && provider.certifications.length > 0 && (
                  <div className="bg-white dark:bg-black p-6 rounded-2xl border-2 border-green-100 dark:border-green-900">
                    <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {isHebrew ? 'הסמכות' : 'Certifications'}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {provider.certifications.map((cert, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 px-3 py-1"
                          data-testid={`badge-certification-${index}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Display */}
                <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-purple-200 dark:border-purple-800">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {isHebrew ? 'מחיר' : 'Price'}
                    </p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" data-testid="text-provider-price">
                      {provider.priceDisplay || (isHebrew ? 'צור קשר למחיר' : 'Contact for Price')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {isHebrew ? 'כולל 17% מע״מ' : 'Includes 17% VAT'}
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={handleBooking}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-xl px-8"
                    data-testid="button-book-now"
                  >
                    <CalendarIcon className="w-5 h-5 mr-2" />
                    {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                  </Button>
                </div>

                {/* Note about Availability */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <CalendarIcon className="w-4 h-4 inline mr-2 text-blue-600" />
                    {isHebrew 
                      ? 'זמינות ותאריכים יוצגו בשלב הבא של ההזמנה' 
                      : 'Availability and scheduling will be shown in the next booking step'}
                  </p>
                </div>
              </div>
            </div>
          </GlassmorphismCard>

          {/* Photos Section */}
          {provider.profilePictureUrl && (
            <GlassmorphismCard>
              <div className="p-6">
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {isHebrew ? 'תמונות' : 'Photos'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Main profile picture */}
                  <div className="aspect-square rounded-xl overflow-hidden border-2 border-purple-200 dark:border-purple-800" data-testid="photo-0">
                    <img
                      src={provider.profilePictureUrl}
                      alt={`${provider.firstName} ${provider.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Placeholder for additional photos */}
                  <div className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 flex items-center justify-center">
                    <p className="text-sm text-gray-400 dark:text-gray-600 text-center px-2">
                      {isHebrew ? 'תמונות נוספות בקרוב' : 'More photos coming soon'}
                    </p>
                  </div>
                </div>
              </div>
            </GlassmorphismCard>
          )}

          {/* Contact & Reviews Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Info */}
            <GlassmorphismCard>
              <div className="p-6">
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {isHebrew ? 'יצירת קשר' : 'Contact'}
                </h3>
                
                {showContactInfo ? (
                  <div className="space-y-4">
                    {provider.email && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <Mail className="w-5 h-5 text-purple-600" />
                        <span className="text-gray-700 dark:text-gray-300" data-testid="text-provider-email">{provider.email}</span>
                      </div>
                    )}
                    {provider.phone && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <Phone className="w-5 h-5 text-purple-600" />
                        <span className="text-gray-700 dark:text-gray-300" data-testid="text-provider-phone">{provider.phone}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button 
                    onClick={toggleContactInfo}
                    variant="outline"
                    className="w-full"
                    data-testid="button-show-contact"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    {isHebrew ? 'הצג פרטי קשר' : 'Show Contact Info'}
                  </Button>
                )}
              </div>
            </GlassmorphismCard>

            {/* Reviews Section - Data-driven */}
            <GlassmorphismCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'ביקורות' : 'Reviews'}
                  </h3>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <Star className="w-4 h-4 mr-1 fill-amber-500" />
                    {provider.rating || '5.0'}
                  </Badge>
                </div>
                
                {/* TODO: Backend needs to provide reviews array in provider detail response */}
                {/* For now, showing empty state since backend doesn't include reviews */}
                {(!data?.reviews || data.reviews.length === 0) ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800" data-testid="reviews-empty-state">
                    <Star className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                      {isHebrew ? 'אין ביקורות עדיין' : 'No reviews yet'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {isHebrew 
                        ? 'היה הראשון לתת ביקורת לאחר השירות' 
                        : 'Be the first to review after booking'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="reviews-list">
                    {data.reviews.map((review: any, index: number) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800" data-testid={`review-${index}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{review.customerName || 'Anonymous'}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${i < (review.rating || 0) ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}</p>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">{review.comment || ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassmorphismCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}
