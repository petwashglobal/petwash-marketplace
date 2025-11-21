import { useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Dog,
  CheckCircle,
  XCircle,
  Navigation,
  Star,
  TrendingUp,
  Award,
  User,
  Loader2,
  Phone,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface WalkRequest {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  petId: string;
  petName: string;
  petBreed: string;
  petPhotoUrl?: string;
  petSize: 'small' | 'medium' | 'large';
  petAge: number;
  petNotes: string | null;
  pickupAddress: string;
  pickupLat: number;
  pickupLon: number;
  duration: number; // minutes
  scheduledStart: string;
  priceOffered: number;
  specialInstructions: string | null;
  requiresLeash: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'active' | 'completed';
  createdAt: string;
}

interface WalkerEarnings {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalEarnings: number;
  completedWalks: number;
  rating: number;
  totalReviews: number;
  basePay: number;
  tips: number;
  bonuses: number;
  platformFees: number;
  acceptanceRate: number;
  completionRate: number;
  avgResponseTime: number; // minutes
}

interface CustomerReview {
  id: string;
  ownerName: string;
  ownerAvatar?: string;
  petName: string;
  rating: number;
  comment: string;
  date: string;
  walkDuration: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedDate?: string;
  progress?: number;
  maxProgress?: number;
}

export default function WalkerDashboard() {
  const { user, signOut } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isHebrew = language === 'he';
  
  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'completed' | 'earnings' | 'reviews' | 'achievements'>('requests');

  // Fetch walk requests (pending)
  const { data: pendingRequests = [], isLoading: loadingPending } = useQuery<WalkRequest[]>({
    queryKey: ['/api/walk-my-pet/walker/requests'],
    enabled: !!user && activeTab === 'requests',
  });

  // Fetch active walks
  const { data: activeWalks = [], isLoading: loadingActive } = useQuery<WalkRequest[]>({
    queryKey: ['/api/walk-my-pet/walker/active'],
    enabled: !!user && activeTab === 'active',
  });

  // Fetch completed walks
  const { data: completedWalks = [], isLoading: loadingCompleted } = useQuery<WalkRequest[]>({
    queryKey: ['/api/walk-my-pet/walker/completed'],
    enabled: !!user && activeTab === 'completed',
  });

  // Fetch earnings data
  const { data: earningsFromApi, isLoading: loadingEarnings } = useQuery<WalkerEarnings>({
    queryKey: ['/api/walk-my-pet/walker/earnings'],
    enabled: !!user && activeTab === 'earnings',
  });

  // Fetch reviews
  const { data: reviewsFromApi, isLoading: loadingReviews } = useQuery<CustomerReview[]>({
    queryKey: ['/api/walk-my-pet/walker/reviews'],
    enabled: !!user && activeTab === 'reviews',
  });

  // Fetch achievements
  const { data: achievementsFromApi, isLoading: loadingAchievements } = useQuery<Achievement[]>({
    queryKey: ['/api/walk-my-pet/walker/achievements'],
    enabled: !!user && activeTab === 'achievements',
  });

  // Mock data fallback for earnings with detailed breakdown
  const mockEarnings: WalkerEarnings = {
    today: 285,
    thisWeek: 1840,
    thisMonth: 7240,
    totalEarnings: 28950,
    completedWalks: 147,
    rating: 4.92,
    totalReviews: 98,
    basePay: 21600,
    tips: 4820,
    bonuses: 3250,
    platformFees: -2720,
    acceptanceRate: 94,
    completionRate: 99,
    avgResponseTime: 8,
  };

  // Mock reviews data
  const mockReviews: CustomerReview[] = [
    {
      id: '1',
      ownerName: 'Sarah Cohen',
      petName: 'Max',
      rating: 5,
      comment: 'Amazing walker! Max loves him. Very professional and always sends photos during the walk. Highly recommend!',
      date: '2025-10-28T14:30:00Z',
      walkDuration: 45,
    },
    {
      id: '2',
      ownerName: 'David Levi',
      petName: 'Bella',
      rating: 5,
      comment: 'Bella had such a great time! The GPS tracking gave me peace of mind. Will definitely book again.',
      date: '2025-10-27T10:15:00Z',
      walkDuration: 60,
    },
    {
      id: '3',
      ownerName: 'Rachel Mizrahi',
      petName: 'Charlie',
      rating: 5,
      comment: 'Perfect walker for my reactive dog. Very patient and knowledgeable. Charlie was calm and happy after the walk.',
      date: '2025-10-26T16:45:00Z',
      walkDuration: 30,
    },
    {
      id: '4',
      ownerName: 'Michael Peretz',
      petName: 'Luna',
      rating: 4,
      comment: 'Great experience overall. Luna enjoyed the walk. Only minor issue was being 5 minutes late to pickup.',
      date: '2025-10-25T09:00:00Z',
      walkDuration: 45,
    },
    {
      id: '5',
      ownerName: 'Noa Goldstein',
      petName: 'Rocky',
      rating: 5,
      comment: 'Rocky came back exhausted and happy! Exactly what we needed. The vital stats tracking is amazing.',
      date: '2025-10-24T13:20:00Z',
      walkDuration: 60,
    },
    {
      id: '6',
      ownerName: 'Yoni Shapira',
      petName: 'Milo',
      rating: 5,
      comment: 'Best dog walker we\'ve found! Milo gets so excited when he sees you. Thank you for the excellent service!',
      date: '2025-10-23T11:30:00Z',
      walkDuration: 45,
    },
  ];

  // Mock achievements data
  const mockAchievements: Achievement[] = [
    {
      id: '1',
      title: 'First Steps',
      description: 'Complete your first walk',
      icon: '🐾',
      unlocked: true,
      unlockedDate: '2025-08-15T10:00:00Z',
    },
    {
      id: '2',
      title: 'Century Club',
      description: 'Complete 100 walks',
      icon: '💯',
      unlocked: true,
      unlockedDate: '2025-10-20T14:30:00Z',
    },
    {
      id: '3',
      title: 'Five Star Pro',
      description: 'Maintain a 5.0 rating for 50 walks',
      icon: '⭐',
      unlocked: true,
      unlockedDate: '2025-09-12T09:15:00Z',
    },
    {
      id: '4',
      title: 'Speed Demon',
      description: 'Average response time under 10 minutes',
      icon: '⚡',
      unlocked: true,
      unlockedDate: '2025-09-25T16:45:00Z',
    },
    {
      id: '5',
      title: 'Tipping Point',
      description: 'Earn ₪5,000 in tips',
      icon: '💰',
      unlocked: false,
      progress: 4820,
      maxProgress: 5000,
    },
    {
      id: '6',
      title: 'Marathon Master',
      description: 'Complete 250 walks',
      icon: '🏃',
      unlocked: false,
      progress: 147,
      maxProgress: 250,
    },
    {
      id: '7',
      title: 'Perfect Month',
      description: 'Complete 30 days with 100% acceptance rate',
      icon: '📅',
      unlocked: false,
      progress: 18,
      maxProgress: 30,
    },
    {
      id: '8',
      title: 'Community Champion',
      description: 'Walk 10 different dogs in one week',
      icon: '🏆',
      unlocked: true,
      unlockedDate: '2025-09-30T12:00:00Z',
    },
  ];

  // Use API data if available, otherwise use mock data
  const earnings = earningsFromApi || mockEarnings;
  const reviews = reviewsFromApi && reviewsFromApi.length > 0 ? reviewsFromApi : mockReviews;
  const achievements = achievementsFromApi && achievementsFromApi.length > 0 ? achievementsFromApi : mockAchievements;

  // Accept walk mutation
  const acceptMutation = useMutation({
    mutationFn: async (walkId: string) => {
      return await apiRequest(`/api/walk-my-pet/walker/accept/${walkId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: isHebrew ? '✅ הטיול התקבל' : '✅ Walk Accepted',
        description: isHebrew ? 'הטיול נוסף ללוח הזמנים שלך' : 'Walk added to your schedule',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/walker/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/walker/active'] });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'נכשל לקבל את הטיול' : 'Failed to accept walk',
        variant: 'destructive',
      });
    },
  });

  // Reject walk mutation
  const rejectMutation = useMutation({
    mutationFn: async (walkId: string) => {
      return await apiRequest(`/api/walk-my-pet/walker/reject/${walkId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: isHebrew ? 'הטיול נדחה' : 'Walk Rejected',
        description: isHebrew ? 'הטיול הוסר מהבקשות' : 'Walk removed from requests',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/walker/requests'] });
    },
  });

  // Start walk mutation
  const startWalkMutation = useMutation({
    mutationFn: async (walkId: string) => {
      return await apiRequest(`/api/walk-my-pet/walker/start/${walkId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: isHebrew ? '🚶 הטיול התחיל' : '🚶 Walk Started',
        description: isHebrew ? 'מעקב GPS פעיל' : 'GPS tracking active',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/walker/active'] });
    },
  });

  const handleLogout = async () => {
    await signOut();
    setLocation('/');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isHebrew ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  return (
    <div className={`min-h-screen luxury-bg-mesh ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="luxury-glass-panel sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center luxury-shadow-md">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-sm luxury-text-gradient">
                {isHebrew ? 'Walk My Pet™ - מטיילים' : 'Walk My Pet™ - Walker'}
              </h1>
              <p className="luxury-text-small">
                {isHebrew ? 'שלום' : 'Welcome'}, {user?.displayName || user?.email?.split('@')[0]}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="luxury-btn-secondary">
                {isHebrew ? 'עמוד הבית' : 'Home'}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              {isHebrew ? 'התנתק' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {earnings && (
          <div className="luxury-grid-4 mb-8">
            <div className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in luxury-delay-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="luxury-text-small mb-1">
                      {isHebrew ? 'היום' : 'Today'}
                    </p>
                    <p className="luxury-heading-lg luxury-text-gradient">{formatCurrency(earnings.today)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center luxury-shadow-md">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in luxury-delay-2">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="luxury-text-small mb-1">
                      {isHebrew ? 'השבוע' : 'This Week'}
                    </p>
                    <p className="luxury-heading-lg luxury-text-gradient">{formatCurrency(earnings.thisWeek)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center luxury-shadow-md">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in luxury-delay-3">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="luxury-text-small mb-1">
                      {isHebrew ? 'טיולים שהושלמו' : 'Completed Walks'}
                    </p>
                    <p className="luxury-heading-lg luxury-text-gradient">{earnings.completedWalks}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center luxury-shadow-md">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in luxury-delay-4">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="luxury-text-small mb-1">
                      {isHebrew ? 'דירוג' : 'Rating'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="luxury-heading-lg luxury-text-gradient">{earnings.rating.toFixed(1)}</p>
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center luxury-shadow-md">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="grid grid-cols-6 w-full mb-6">
            <TabsTrigger value="requests">
              <Calendar className="w-4 h-4 mr-2" />
              {isHebrew ? 'בקשות' : 'Requests'}
              {pendingRequests.length > 0 && (
                <span className="luxury-badge luxury-badge-gold ml-2 text-xs px-2 py-0.5">{pendingRequests.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              <Navigation className="w-4 h-4 mr-2" />
              {isHebrew ? 'פעיל' : 'Active'}
              {activeWalks.length > 0 && (
                <span className="luxury-badge ml-2 text-xs px-2 py-0.5">{activeWalks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              <CheckCircle className="w-4 h-4 mr-2" />
              {isHebrew ? 'הושלמו' : 'Completed'}
            </TabsTrigger>
            <TabsTrigger value="earnings">
              <DollarSign className="w-4 h-4 mr-2" />
              {isHebrew ? 'רווחים' : 'Earnings'}
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Star className="w-4 h-4 mr-2" />
              {isHebrew ? 'ביקורות' : 'Reviews'}
              {reviews.length > 0 && (
                <span className="luxury-badge ml-2 text-xs px-2 py-0.5">{reviews.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Award className="w-4 h-4 mr-2" />
              {isHebrew ? 'הישגים' : 'Achievements'}
            </TabsTrigger>
          </TabsList>

          {/* Walk Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {loadingPending ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg">
                <div className="py-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="luxury-text-body">
                    {isHebrew ? 'אין בקשות חדשות כרגע' : 'No new walk requests at the moment'}
                  </p>
                </div>
              </div>
            ) : (
              pendingRequests.map((request, index) => (
                <div key={request.id} className={`luxury-glass-minimal luxury-hover-lift luxury-shadow-lg luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}>
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {request.petPhotoUrl ? (
                          <div className="p-0.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                            <img src={request.petPhotoUrl} alt={request.petName} className="w-16 h-16 rounded-full object-cover luxury-shadow-md border-2 border-white dark:border-gray-900" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center luxury-shadow-md">
                            <Dog className="w-8 h-8 text-white" />
                          </div>
                        )}
                        <div>
                          <h3 className="luxury-heading-sm">{request.petName}</h3>
                          <p className="luxury-text-small">{request.petBreed} • {request.petSize}</p>
                        </div>
                      </div>
                      <span className="luxury-badge luxury-badge-gold text-lg">{formatCurrency(request.priceOffered)}</span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="luxury-text-small">{request.ownerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="luxury-text-small">{formatDate(request.scheduledStart)} • {request.duration}min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-600" />
                        <span className="luxury-text-small truncate">{request.pickupAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-600" />
                        <span className="luxury-text-small">{request.ownerPhone}</span>
                      </div>
                    </div>

                    {request.specialInstructions && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                          {isHebrew ? '📝 הוראות מיוחדות:' : '📝 Special Instructions:'}
                        </p>
                        <p className="luxury-text-small text-yellow-800 dark:text-yellow-300">{request.specialInstructions}</p>
                      </div>
                    )}

                    {request.petNotes && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                          {isHebrew ? '🐾 הערות על חיית המחמד:' : '🐾 Pet Notes:'}
                        </p>
                        <p className="luxury-text-small text-blue-800 dark:text-blue-300">{request.petNotes}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button 
                        className="flex-1 luxury-btn-primary"
                        onClick={() => acceptMutation.mutate(request.id)}
                        disabled={acceptMutation.isPending}
                      >
                        {acceptMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2 inline" />
                        )}
                        {isHebrew ? 'קבל טיול' : 'Accept Walk'}
                      </button>
                      <button 
                        className="flex-1 luxury-btn-secondary"
                        onClick={() => rejectMutation.mutate(request.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2 inline" />
                        {isHebrew ? 'דחה' : 'Decline'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Active Walks Tab */}
          <TabsContent value="active" className="space-y-4">
            {loadingActive ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : activeWalks.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg">
                <div className="py-12 text-center">
                  <Navigation className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="luxury-text-body">
                    {isHebrew ? 'אין טיולים פעילים כרגע' : 'No active walks at the moment'}
                  </p>
                </div>
              </div>
            ) : (
              activeWalks.map((walk, index) => (
                <div key={walk.id} className={`luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}>
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {walk.petPhotoUrl ? (
                          <div className="p-0.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                            <img src={walk.petPhotoUrl} alt={walk.petName} className="w-16 h-16 rounded-full object-cover luxury-shadow-md border-2 border-white dark:border-gray-900" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center luxury-shadow-md">
                            <Dog className="w-8 h-8 text-white" />
                          </div>
                        )}
                        <div>
                          <h3 className="luxury-heading-sm flex items-center gap-2">
                            {walk.petName}
                            {walk.status === 'accepted' && (
                              <span className="luxury-badge">{isHebrew ? 'ממתין להתחלה' : 'Ready to Start'}</span>
                            )}
                            {walk.status === 'active' && (
                              <span className="luxury-badge luxury-badge-success">{isHebrew ? '🚶 בטיול' : '🚶 In Progress'}</span>
                            )}
                          </h3>
                          <p className="luxury-text-small">{walk.petBreed}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span className="luxury-text-small">{formatDate(walk.scheduledStart)} • {walk.duration}min</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {walk.status === 'accepted' && (
                        <button 
                          className="w-full luxury-btn-primary"
                          onClick={() => startWalkMutation.mutate(walk.id)}
                          disabled={startWalkMutation.isPending}
                        >
                          {startWalkMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                          ) : (
                            <Navigation className="w-4 h-4 mr-2 inline" />
                          )}
                          {isHebrew ? 'התחל טיול' : 'Start Walk'}
                        </button>
                      )}
                      
                      {walk.status === 'active' && (
                        <Link href={`/walk-tracking/${walk.id}`}>
                          <button className="w-full luxury-btn-primary">
                            <MapPin className="w-4 h-4 mr-2 inline" />
                            {isHebrew ? 'מעקב GPS' : 'GPS Tracking'}
                          </button>
                        </Link>
                      )}
                      
                      <a href={`tel:${walk.ownerPhone}`}>
                        <button className="w-full luxury-btn-secondary">
                          <Phone className="w-4 h-4 mr-2 inline" />
                          {isHebrew ? 'התקשר' : 'Call Owner'}
                        </button>
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Completed Walks Tab */}
          <TabsContent value="completed" className="space-y-4">
            {loadingCompleted ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : completedWalks.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg">
                <div className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="luxury-text-body">
                    {isHebrew ? 'עדיין לא השלמת טיולים' : 'No completed walks yet'}
                  </p>
                </div>
              </div>
            ) : (
              completedWalks.map((walk, index) => (
                <div key={walk.id} className={`luxury-glass-minimal luxury-hover-lift luxury-shadow-lg luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {walk.petPhotoUrl ? (
                          <div className="p-0.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                            <img src={walk.petPhotoUrl} alt={walk.petName} className="w-12 h-12 rounded-full object-cover luxury-shadow-sm border-2 border-white dark:border-gray-900" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center luxury-shadow-sm">
                            <Dog className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="luxury-heading-sm">{walk.petName}</p>
                          <p className="luxury-text-small">{formatDate(walk.scheduledStart)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="luxury-heading-sm luxury-text-gradient">{formatCurrency(walk.priceOffered)}</p>
                        <p className="luxury-text-small">{walk.duration}min</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings">
            {loadingEarnings ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : earnings ? (
              <div className="space-y-6">
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-1" style={{background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)'}}>
                  <div className="p-8 text-center">
                    <h2 className="luxury-heading-xl luxury-text-gradient mb-2">
                      {formatCurrency(earnings.totalEarnings)}
                    </h2>
                    <p className="luxury-text-body">
                      {isHebrew ? 'סך כל הרווחים' : 'Total Lifetime Earnings'}
                    </p>
                    <button className="luxury-btn-primary mt-4">
                      <DollarSign className="w-4 h-4 mr-2 inline" />
                      {isHebrew ? 'משוך כסף' : 'Withdraw'}
                    </button>
                  </div>
                </div>

                <div className="luxury-grid-3">
                  <div className="luxury-glass-minimal luxury-hover-lift luxury-shadow-md luxury-animate-fade-in luxury-delay-2">
                    <div className="p-6">
                      <p className="luxury-text-small mb-1">
                        {isHebrew ? 'החודש' : 'This Month'}
                      </p>
                      <p className="luxury-heading-lg luxury-text-gradient">{formatCurrency(earnings.thisMonth)}</p>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal luxury-hover-lift luxury-shadow-md luxury-animate-fade-in luxury-delay-3">
                    <div className="p-6">
                      <p className="luxury-text-small mb-1">
                        {isHebrew ? 'השבוע' : 'This Week'}
                      </p>
                      <p className="luxury-heading-lg luxury-text-gradient">{formatCurrency(earnings.thisWeek)}</p>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal luxury-hover-lift luxury-shadow-md luxury-animate-fade-in luxury-delay-4">
                    <div className="p-6">
                      <p className="luxury-text-small mb-1">
                        {isHebrew ? 'היום' : 'Today'}
                      </p>
                      <p className="luxury-heading-lg luxury-text-gradient">{formatCurrency(earnings.today)}</p>
                    </div>
                  </div>
                </div>

                {/* Earnings Breakdown */}
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-5">
                  <div className="p-6">
                    <h3 className="luxury-heading-md mb-2">{isHebrew ? 'פירוט רווחים' : 'Earnings Breakdown'}</h3>
                    <p className="luxury-text-small mb-6">{isHebrew ? 'ניתוח מפורט של ההכנסות שלך' : 'Detailed analysis of your income'}</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div>
                          <p className="font-semibold text-green-900 dark:text-green-200">{isHebrew ? '💰 שכר בסיס' : '💰 Base Pay'}</p>
                          <p className="luxury-text-small">{isHebrew ? 'תשלום עבור טיולים' : 'Payment for walks'}</p>
                        </div>
                        <span className="luxury-heading-md text-green-700 dark:text-green-400">{formatCurrency(earnings.basePay)}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div>
                          <p className="font-semibold text-yellow-900 dark:text-yellow-200">{isHebrew ? '🎁 טיפים' : '🎁 Tips'}</p>
                          <p className="luxury-text-small">{isHebrew ? 'טיפים מלקוחות' : 'Tips from customers'}</p>
                        </div>
                        <span className="luxury-heading-md text-yellow-700 dark:text-yellow-400">{formatCurrency(earnings.tips)}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div>
                          <p className="font-semibold text-blue-900 dark:text-blue-200">{isHebrew ? '⭐ בונוסים' : '⭐ Bonuses'}</p>
                          <p className="luxury-text-small">{isHebrew ? 'בונוסי ביצועים' : 'Performance bonuses'}</p>
                        </div>
                        <span className="luxury-heading-md text-blue-700 dark:text-blue-400">{formatCurrency(earnings.bonuses)}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div>
                          <p className="font-semibold text-red-900 dark:text-red-200">{isHebrew ? '📉 עמלת פלטפורמה' : '📉 Platform Fees'}</p>
                          <p className="luxury-text-small">{isHebrew ? '24% עמלה' : '24% commission'}</p>
                        </div>
                        <span className="luxury-heading-md text-red-700 dark:text-red-400">{formatCurrency(earnings.platformFees)}</span>
                      </div>

                      <div className="luxury-divider"></div>
                      
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-100 to-green-50 dark:from-green-800/30 dark:to-green-900/20 rounded-lg">
                        <p className="luxury-heading-sm">{isHebrew ? 'סה"כ נטו' : 'Net Total'}</p>
                        <span className="luxury-heading-lg luxury-text-gradient">
                          {formatCurrency(earnings.basePay + earnings.tips + earnings.bonuses + earnings.platformFees)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in">
                  <div className="p-6">
                    <h3 className="luxury-heading-md mb-2">{isHebrew ? 'מדדי ביצועים' : 'Performance Metrics'}</h3>
                    <p className="luxury-text-small mb-6">{isHebrew ? 'נתונים מפתח על הביצועים שלך' : 'Key data about your performance'}</p>
                    
                    <div className="luxury-grid-4">
                      <div className="luxury-glass-minimal luxury-hover-lift p-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center luxury-shadow-md mx-auto mb-3">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <p className="luxury-heading-lg luxury-text-gradient mb-1">{earnings.completedWalks}</p>
                        <p className="luxury-text-small">{isHebrew ? 'טיולים' : 'Walks'}</p>
                      </div>

                      <div className="luxury-glass-minimal luxury-hover-lift p-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center luxury-shadow-md mx-auto mb-3">
                          <Star className="w-6 h-6 text-white" />
                        </div>
                        <p className="luxury-heading-lg luxury-text-gradient mb-1">{earnings.rating.toFixed(2)}</p>
                        <p className="luxury-text-small">{isHebrew ? 'דירוג' : 'Rating'}</p>
                      </div>

                      <div className="luxury-glass-minimal luxury-hover-lift p-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center luxury-shadow-md mx-auto mb-3">
                          <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <p className="luxury-heading-lg luxury-text-gradient mb-1">{earnings.acceptanceRate}%</p>
                        <p className="luxury-text-small">{isHebrew ? 'קבלה' : 'Acceptance'}</p>
                      </div>

                      <div className="luxury-glass-minimal luxury-hover-lift p-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center luxury-shadow-md mx-auto mb-3">
                          <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <p className="luxury-heading-lg luxury-text-gradient mb-1">{earnings.completionRate}%</p>
                        <p className="luxury-text-small">{isHebrew ? 'השלמה' : 'Completion'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            {loadingReviews ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg">
                <div className="py-12 text-center">
                  <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="luxury-text-body">
                    {isHebrew ? 'עדיין אין לך ביקורות' : 'No reviews yet'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-1" style={{background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)'}}>
                  <div className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="luxury-heading-xl luxury-text-gradient">{earnings?.rating.toFixed(2)}</span>
                      <Star className="w-12 h-12 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="luxury-text-body">
                      {isHebrew ? 'על בסיס' : 'Based on'} {reviews.length} {isHebrew ? 'ביקורות' : 'reviews'}
                    </p>
                  </div>
                </div>

                {reviews.map((review, index) => (
                  <div key={review.id} className={`luxury-glass-minimal luxury-hover-lift luxury-shadow-lg luxury-animate-fade-in luxury-delay-${Math.min(index + 2, 5)}`}>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {review.ownerAvatar ? (
                            <div className="p-0.5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                              <img src={review.ownerAvatar} alt={review.ownerName} className="w-12 h-12 rounded-full object-cover luxury-shadow-md border-2 border-white dark:border-gray-900" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center luxury-shadow-md">
                              <User className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <div>
                            <h3 className="luxury-heading-sm">{review.ownerName}</h3>
                            <p className="luxury-text-small">
                              {isHebrew ? 'עבור' : 'for'} {review.petName} • {formatDate(review.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${
                                i < review.rating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="luxury-text-body leading-relaxed mb-3">{review.comment}</p>
                      <div className="luxury-divider my-3"></div>
                      <p className="luxury-text-small">
                        {isHebrew ? 'משך טיול:' : 'Walk duration:'} {review.walkDuration} {isHebrew ? 'דקות' : 'minutes'}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            {loadingAchievements ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-1" style={{background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)'}}>
                  <div className="p-8 text-center">
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-2">
                      {achievements.filter(a => a.unlocked).length} / {achievements.length}
                    </h3>
                    <p className="luxury-text-body">
                      {isHebrew ? 'הישגים שהושגו' : 'Achievements Unlocked'}
                    </p>
                  </div>
                </div>

                <div className="luxury-grid-2">
                  {achievements.map((achievement, index) => (
                    <div 
                      key={achievement.id} 
                      className={`luxury-glass-card luxury-hover-lift luxury-shadow-lg luxury-animate-fade-in luxury-delay-${Math.min(index + 2, 5)} ${
                        achievement.unlocked 
                          ? 'border-2 border-yellow-500' 
                          : 'opacity-75'
                      }`}
                      style={achievement.unlocked ? {background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%)'} : {}}
                    >
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="text-5xl">{achievement.icon}</div>
                          <div className="flex-1">
                            <h3 className="luxury-heading-sm mb-1 flex items-center gap-2">
                              {achievement.title}
                              {achievement.unlocked && (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              )}
                            </h3>
                            <p className="luxury-text-small mb-3">
                              {achievement.description}
                            </p>
                            {achievement.unlocked ? (
                              <span className="luxury-badge-success">
                                {isHebrew ? 'הושג' : 'Unlocked'} • {formatDate(achievement.unlockedDate!)}
                              </span>
                            ) : achievement.progress !== undefined && achievement.maxProgress !== undefined ? (
                              <div>
                                <div className="flex justify-between luxury-text-small mb-1">
                                  <span>{isHebrew ? 'התקדמות' : 'Progress'}</span>
                                  <span className="font-semibold">
                                    {achievement.progress} / {achievement.maxProgress}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                  <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all"
                                    style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="luxury-badge">{isHebrew ? 'נעול' : 'Locked'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
