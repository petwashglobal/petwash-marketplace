import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassmorphismCard } from '@/components/luxury/GlassmorphismCard';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { usePaymentStatus } from '@/hooks/use-payment-status';
import { useProviderDetails, useProviderReviews } from '@/services/marketplace';
import {
  Star, MapPin, Shield, CheckCircle2, Award, Calendar as CalendarIcon,
  Clock, DollarSign, MessageCircle, Phone, Mail,
  TrendingUp, Users, Video, Plane, Dog, Car, Scissors,
  UserCheck, CheckSquare, AlertTriangle,
} from 'lucide-react';
import type { MarketplacePlatformId } from '@shared/schema';

export default function ProviderDetail() {
  const { platform, id } = useParams<{ platform: MarketplacePlatformId; id: string }>();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const { paymentsEnabled } = usePaymentStatus();

  const [showContactInfo, setShowContactInfo] = useState(false);

  // Fetch provider details
  const { data, isLoading, error } = useProviderDetails(platform!, id!);
  const provider = data?.provider;

  // Fetch trust stats once provider loads (lazy — only when userId available)
  const { data: trustStats } = useQuery<any>({
    queryKey: ['/api/providers/stats', provider?.userId],
    queryFn: () => fetch(`/api/providers/stats/${provider!.userId}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 300_000,
    enabled: !!provider?.userId,
  });

  // Fetch reviews from the dedicated reviews endpoint
  const { data: reviewsData, isLoading: reviewsLoading } = useProviderReviews(platform!, id!);

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

  // Compute reviews list once (from dedicated reviews endpoint)
  const reviewList: any[] = (() => {
    const raw = (reviewsData as any)?.reviews || reviewsData;
    return Array.isArray(raw) ? raw : [];
  })();

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
          <Badge key="bodycam" variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-white dark:text-blue-400" data-testid="badge-body-camera">
            <Video className="w-4 h-4 mr-1" />
            {isHebrew ? 'מצלמת גוף' : 'Body Camera'}
          </Badge>
        );
      }
      if (provider.droneAccess) {
        badges.push(
          <Badge key="drone" variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-white dark:text-purple-400" data-testid="badge-drone">
            <Plane className="w-4 h-4 mr-1" />
            {isHebrew ? 'גישה לרחפן' : 'Drone Access'}
          </Badge>
        );
      }
    }

    if (provider.kind === 'sitter' && provider.hasOwnPets) {
      badges.push(
        <Badge key="pets" variant="secondary" className="bg-green-100 text-green-800 dark:bg-white dark:text-green-400" data-testid="badge-has-pets">
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
      <div className="min-h-screen luxury-bg-mesh py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Provider Profile Header */}
          <GlassmorphismCard className="mb-8 luxury-glass-card luxury-shadow-xl">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left: Profile Photo - Circular with Gradient Border */}
              <div className="lg:col-span-1 flex items-center justify-center">
                <div className="relative w-80 h-80 rounded-full overflow-hidden p-2 bg-gradient-to-br from-purple-600 via-pink-600 to-amber-600 luxury-shadow-xl">
                  <div className="relative w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-purple-200 via-pink-200 to-amber-200">
                    {provider.profilePictureUrl ? (
                      <img 
                        src={provider.profilePictureUrl} 
                        alt={`${provider.firstName} ${provider.lastName}`}
                        className="w-full h-full object-cover"
                        data-testid="img-provider-photo"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-white">
                        <Users className="w-24 h-24 text-purple-400" />
                      </div>
                    )}
                    {provider.isVerified && (
                      <div className="absolute top-6 right-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-full shadow-2xl luxury-shadow-xl" data-testid="badge-verified-shield">
                        <Shield className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                      <div className="flex items-center justify-center gap-3">
                        <Star className="h-10 w-10 fill-amber-300 text-amber-300" />
                        <span className="text-white font-bold text-4xl" data-testid="text-provider-rating">{provider.rating || '5.0'}</span>
                      </div>
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

                  <div className="flex items-center gap-2 text-gray-700 dark:text-black mb-4">
                    <MapPin className="w-6 h-6 text-purple-600" />
                    <span className="text-xl font-medium" data-testid="text-provider-city">{provider.city}</span>
                  </div>

                  {/* Platform-specific badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {renderPlatformBadges()}
                  </div>
                </div>

                {/* Stats Row - Luxury Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-5 luxury-glass-panel luxury-shadow-xl rounded-2xl border-2 border-amber-200 dark:border-amber-800">
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

                  <div className="text-center p-5 luxury-glass-panel luxury-shadow-xl rounded-2xl border-2 border-purple-200 dark:border-purple-800">
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

                  <div className="text-center p-5 luxury-glass-panel luxury-shadow-xl rounded-2xl border-2 border-green-200 dark:border-green-800">
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

                  <div className="text-center p-5 luxury-glass-panel luxury-shadow-xl rounded-2xl border-2 border-blue-200 dark:border-blue-800">
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

                {/* Trust Metrics Section */}
                {(trustStats?.trustScore != null || trustStats?.acceptanceRatePct != null || (trustStats?.badges && trustStats.badges.length > 0)) && (
                  <div className="p-5 rounded-2xl border-2 border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                      <h3 className="text-lg font-bold text-gray-900 dark:text-black">
                        {isHebrew ? 'אמינות ספק' : 'Provider Trust'}
                      </h3>
                      {trustStats?.trustScore != null && (
                        <div
                          className="ms-auto w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-base"
                          style={{
                            borderColor: trustStats.trustScore >= 75 ? '#C5A55A' : '#3b82f6',
                            color: trustStats.trustScore >= 75 ? '#C5A55A' : '#3b82f6',
                          }}
                        >
                          {trustStats.trustScore}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {trustStats?.acceptanceRatePct != null && (
                        <div className="flex items-center gap-2 bg-white dark:bg-white p-3 rounded-xl border border-blue-100">
                          <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                          <div>
                            <p className="text-[10px] text-gray-500">{isHebrew ? 'אחוז קבלה' : 'Acceptance'}</p>
                            <p className="text-sm font-bold text-blue-700">{trustStats.acceptanceRatePct}%</p>
                          </div>
                        </div>
                      )}
                      {trustStats?.completionRatePct != null && (
                        <div className="flex items-center gap-2 bg-white dark:bg-white p-3 rounded-xl border border-green-100">
                          <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
                          <div>
                            <p className="text-[10px] text-gray-500">{isHebrew ? 'אחוז השלמה' : 'Completion'}</p>
                            <p className="text-sm font-bold text-green-700">{trustStats.completionRatePct}%</p>
                          </div>
                        </div>
                      )}
                      {trustStats?.responseRatePct != null && (
                        <div className="flex items-center gap-2 bg-white dark:bg-white p-3 rounded-xl border border-purple-100">
                          <Clock className="w-4 h-4 text-purple-500 shrink-0" />
                          <div>
                            <p className="text-[10px] text-gray-500">{isHebrew ? 'אחוז תגובה' : 'Response'}</p>
                            <p className="text-sm font-bold text-purple-700">{trustStats.responseRatePct}%</p>
                          </div>
                        </div>
                      )}
                      {trustStats?.cancellationRatePct != null && (
                        <div className={`flex items-center gap-2 bg-white dark:bg-white p-3 rounded-xl border ${trustStats.cancellationRatePct > 10 ? 'border-red-100' : trustStats.cancellationRatePct > 5 ? 'border-amber-100' : 'border-green-100'}`}>
                          <AlertTriangle className={`w-4 h-4 shrink-0 ${trustStats.cancellationRatePct > 10 ? 'text-red-400' : trustStats.cancellationRatePct > 5 ? 'text-amber-400' : 'text-green-400'}`} />
                          <div>
                            <p className="text-[10px] text-gray-500">{isHebrew ? 'סיכון ביטול' : 'Cancel risk'}</p>
                            <p className={`text-sm font-bold ${trustStats.cancellationRatePct > 10 ? 'text-red-600' : trustStats.cancellationRatePct > 5 ? 'text-amber-600' : 'text-green-700'}`}>
                              {trustStats.cancellationRatePct > 10 ? (isHebrew ? 'גבוה' : 'High') : trustStats.cancellationRatePct > 5 ? (isHebrew ? 'בינוני' : 'Medium') : (isHebrew ? 'נמוך' : 'Low')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Verified badges */}
                    {Array.isArray(trustStats?.badges) && trustStats.badges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(trustStats.badges as string[]).map((b: string) => {
                          const BADGE_LABELS: Record<string, string> = {
                            id_verified: isHebrew ? 'זהות מאומתת' : 'ID Verified',
                            insured: isHebrew ? 'מבוטח' : 'Insured',
                            licensed: isHebrew ? 'מורשה' : 'Licensed',
                            background_check: isHebrew ? 'בדיקת רקע' : 'Background Check',
                          };
                          return (
                            <span key={b} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-amber-200 text-xs font-semibold text-amber-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {BADGE_LABELS[b] ?? b}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Bio */}
                <div className="bg-white dark:bg-black p-6 rounded-2xl border-2 border-purple-100 dark:border-purple-900">
                  <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isHebrew ? 'אודות' : 'About'}
                  </h3>
                  <p className="text-gray-700 dark:text-black leading-relaxed text-lg" data-testid="text-provider-bio">
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
                          className="bg-green-50 dark:bg-white text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 px-3 py-1"
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
                      {isHebrew ? 'כולל 18% מע״מ' : 'Includes 18% VAT'}
                    </p>
                  </div>
                  {paymentsEnabled ? (
                    <Button 
                      size="lg" 
                      onClick={handleBooking}
                      className="luxury-btn-primary luxury-shadow-xl text-white px-8 py-6 text-lg"
                      data-testid="button-book-now"
                    >
                      <CalendarIcon className="w-5 h-5 mr-2" />
                      {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                    </Button>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        size="lg"
                        disabled
                        className="w-full px-8 py-6 text-lg bg-violet-100 text-violet-700 border-2 border-violet-300 cursor-not-allowed opacity-80"
                        data-testid="button-book-soon"
                      >
                        <CalendarIcon className="w-5 h-5 mr-2" />
                        {isHebrew ? '🚀 בקרוב — מערכת הזמנות בפיתוח' : '🚀 Coming Soon — Bookings launching shortly'}
                      </Button>
                      <p className="text-xs text-center text-gray-500">
                        {isHebrew
                          ? 'ניתן ליצור קשר ישיר עם הספק בינתיים'
                          : 'Contact the provider directly in the meantime'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Note about Availability */}
                <div className="bg-blue-50 dark:bg-white p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-700 dark:text-black">
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
            <GlassmorphismCard className="luxury-glass-card luxury-shadow-xl mb-8">
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
                  <div className="aspect-square rounded-xl bg-white dark:bg-white border-2 border-gray-200 dark:border-gray-800 flex items-center justify-center">
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
            <GlassmorphismCard className="luxury-glass-card luxury-shadow-xl">
              <div className="p-6">
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {isHebrew ? 'יצירת קשר' : 'Contact'}
                </h3>
                
                {showContactInfo ? (
                  <div className="space-y-4">
                    {provider.email && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <Mail className="w-5 h-5 text-purple-600" />
                        <span className="text-gray-700 dark:text-black" data-testid="text-provider-email">{provider.email}</span>
                      </div>
                    )}
                    {provider.phone && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <Phone className="w-5 h-5 text-purple-600" />
                        <span className="text-gray-700 dark:text-black" data-testid="text-provider-phone">{provider.phone}</span>
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
            <GlassmorphismCard className="luxury-glass-card luxury-shadow-xl">
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
                
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : reviewList.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-white/50 rounded-lg border border-gray-200 dark:border-gray-800" data-testid="reviews-empty-state">
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
                    {reviewList.map((review: any, index: number) => (
                      <div key={index} className="p-4 bg-white dark:bg-white/50 rounded-lg border border-gray-200 dark:border-gray-800" data-testid={`review-${index}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-black">{review.customerName || 'Anonymous'}</p>
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
                        <p className="text-gray-700 dark:text-black">{review.comment || ''}</p>
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
