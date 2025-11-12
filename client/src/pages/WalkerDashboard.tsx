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
import { Link } from 'wouter';
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
    window.location.href = '/';
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
    <div className={`min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {isHebrew ? 'Walk My Pet™ - מטיילים' : 'Walk My Pet™ - Walker'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isHebrew ? 'שלום' : 'Welcome'}, {user?.displayName || user?.email?.split('@')[0]}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">
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
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {isHebrew ? 'היום' : 'Today'}
                    </p>
                    <p className="text-2xl font-bold">{formatCurrency(earnings.today)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {isHebrew ? 'השבוע' : 'This Week'}
                    </p>
                    <p className="text-2xl font-bold">{formatCurrency(earnings.thisWeek)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {isHebrew ? 'טיולים שהושלמו' : 'Completed Walks'}
                    </p>
                    <p className="text-2xl font-bold">{earnings.completedWalks}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {isHebrew ? 'דירוג' : 'Rating'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">{earnings.rating.toFixed(1)}</p>
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    </div>
                  </div>
                  <Award className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="grid grid-cols-6 w-full mb-6">
            <TabsTrigger value="requests">
              <Calendar className="w-4 h-4 mr-2" />
              {isHebrew ? 'בקשות' : 'Requests'}
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              <Navigation className="w-4 h-4 mr-2" />
              {isHebrew ? 'פעיל' : 'Active'}
              {activeWalks.length > 0 && (
                <Badge className="ml-2">{activeWalks.length}</Badge>
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
                <Badge className="ml-2">{reviews.length}</Badge>
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
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'אין בקשות חדשות כרגע' : 'No new walk requests at the moment'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {request.petPhotoUrl ? (
                          <img src={request.petPhotoUrl} alt={request.petName} className="w-16 h-16 rounded-full object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
                            <Dog className="w-8 h-8 text-purple-700 dark:text-purple-300" />
                          </div>
                        )}
                        <div>
                          <CardTitle>{request.petName}</CardTitle>
                          <CardDescription>{request.petBreed} • {request.petSize}</CardDescription>
                        </div>
                      </div>
                      <Badge className="text-lg font-bold bg-green-600">{formatCurrency(request.priceOffered)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-gray-600" />
                        <span>{request.ownerName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span>{formatDate(request.scheduledStart)} • {request.duration}min</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-600" />
                        <span className="truncate">{request.pickupAddress}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-600" />
                        <span>{request.ownerPhone}</span>
                      </div>
                    </div>

                    {request.specialInstructions && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                          {isHebrew ? '📝 הוראות מיוחדות:' : '📝 Special Instructions:'}
                        </p>
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">{request.specialInstructions}</p>
                      </div>
                    )}

                    {request.petNotes && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                          {isHebrew ? '🐾 הערות על חיית המחמד:' : '🐾 Pet Notes:'}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">{request.petNotes}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => acceptMutation.mutate(request.id)}
                        disabled={acceptMutation.isPending}
                      >
                        {acceptMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        {isHebrew ? 'קבל טיול' : 'Accept Walk'}
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1"
                        onClick={() => rejectMutation.mutate(request.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {isHebrew ? 'דחה' : 'Decline'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
              <Card>
                <CardContent className="py-12 text-center">
                  <Navigation className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'אין טיולים פעילים כרגע' : 'No active walks at the moment'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeWalks.map((walk) => (
                <Card key={walk.id} className="border-2 border-green-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {walk.petPhotoUrl ? (
                          <img src={walk.petPhotoUrl} alt={walk.petName} className="w-16 h-16 rounded-full object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
                            <Dog className="w-8 h-8 text-purple-700 dark:text-purple-300" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {walk.petName}
                            {walk.status === 'accepted' && (
                              <Badge variant="outline">{isHebrew ? 'ממתין להתחלה' : 'Ready to Start'}</Badge>
                            )}
                            {walk.status === 'active' && (
                              <Badge className="bg-green-600">{isHebrew ? '🚶 בטיול' : '🚶 In Progress'}</Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{walk.petBreed}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>{formatDate(walk.scheduledStart)} • {walk.duration}min</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {walk.status === 'accepted' && (
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => startWalkMutation.mutate(walk.id)}
                          disabled={startWalkMutation.isPending}
                        >
                          {startWalkMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Navigation className="w-4 h-4 mr-2" />
                          )}
                          {isHebrew ? 'התחל טיול' : 'Start Walk'}
                        </Button>
                      )}
                      
                      {walk.status === 'active' && (
                        <Link href={`/walk-tracking/${walk.id}`}>
                          <Button className="w-full bg-blue-600 hover:bg-blue-700">
                            <MapPin className="w-4 h-4 mr-2" />
                            {isHebrew ? 'מעקב GPS' : 'GPS Tracking'}
                          </Button>
                        </Link>
                      )}
                      
                      <a href={`tel:${walk.ownerPhone}`}>
                        <Button variant="outline" className="w-full">
                          <Phone className="w-4 h-4 mr-2" />
                          {isHebrew ? 'התקשר' : 'Call Owner'}
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
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
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'עדיין לא השלמת טיולים' : 'No completed walks yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedWalks.map((walk) => (
                <Card key={walk.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {walk.petPhotoUrl ? (
                          <img src={walk.petPhotoUrl} alt={walk.petName} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
                            <Dog className="w-6 h-6 text-purple-700 dark:text-purple-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{walk.petName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(walk.scheduledStart)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(walk.priceOffered)}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{walk.duration}min</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                <Card className="border-2 border-green-500">
                  <CardHeader className="bg-green-50 dark:bg-green-900/20">
                    <CardTitle className="text-3xl text-green-700 dark:text-green-400">
                      {formatCurrency(earnings.totalEarnings)}
                    </CardTitle>
                    <CardDescription className="text-lg">
                      {isHebrew ? 'סך כל הרווחים' : 'Total Lifetime Earnings'}
                    </CardDescription>
                  </CardHeader>
                </Card>

                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {isHebrew ? 'החודש' : 'This Month'}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(earnings.thisMonth)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {isHebrew ? 'השבוע' : 'This Week'}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(earnings.thisWeek)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {isHebrew ? 'היום' : 'Today'}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(earnings.today)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Earnings Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>{isHebrew ? 'פירוט רווחים' : 'Earnings Breakdown'}</CardTitle>
                    <CardDescription>{isHebrew ? 'ניתוח מפורט של ההכנסות שלך' : 'Detailed analysis of your income'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold text-green-900 dark:text-green-200">{isHebrew ? '💰 שכר בסיס' : '💰 Base Pay'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'תשלום עבור טיולים' : 'Payment for walks'}</p>
                      </div>
                      <span className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(earnings.basePay)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold text-yellow-900 dark:text-yellow-200">{isHebrew ? '🎁 טיפים' : '🎁 Tips'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'טיפים מלקוחות' : 'Tips from customers'}</p>
                      </div>
                      <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatCurrency(earnings.tips)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-200">{isHebrew ? '⭐ בונוסים' : '⭐ Bonuses'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'בונוסי ביצועים' : 'Performance bonuses'}</p>
                      </div>
                      <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(earnings.bonuses)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold text-red-900 dark:text-red-200">{isHebrew ? '📉 עמלת פלטפורמה' : '📉 Platform Fees'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? '24% עמלה' : '24% commission'}</p>
                      </div>
                      <span className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(earnings.platformFees)}</span>
                    </div>

                    <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-3 mt-3">
                      <div className="flex items-center justify-between p-4 bg-green-100 dark:bg-green-800/30 rounded-lg">
                        <p className="text-lg font-bold">{isHebrew ? 'סה"כ נטו' : 'Net Total'}</p>
                        <span className="text-3xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(earnings.basePay + earnings.tips + earnings.bonuses + earnings.platformFees)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle>{isHebrew ? 'מדדי ביצועים' : 'Performance Metrics'}</CardTitle>
                    <CardDescription>{isHebrew ? 'נתונים מפתח על הביצועים שלך' : 'Key data about your performance'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold">{isHebrew ? 'טיולים שהושלמו' : 'Completed Walks'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'סך כל הטיולים' : 'Total walks completed'}</p>
                      </div>
                      <span className="text-2xl font-bold">{earnings.completedWalks}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold">{isHebrew ? 'דירוג ממוצע' : 'Average Rating'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'מבוסס על ביקורות' : 'Based on reviews'}</p>
                      </div>
                      <span className="text-2xl font-bold flex items-center gap-2">
                        {earnings.rating.toFixed(2)}
                        <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold">{isHebrew ? 'שיעור קבלה' : 'Acceptance Rate'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'בקשות שהתקבלו' : 'Requests accepted'}</p>
                      </div>
                      <span className="text-2xl font-bold">{earnings.acceptanceRate}%</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold">{isHebrew ? 'שיעור השלמה' : 'Completion Rate'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'טיולים שהושלמו' : 'Walks completed successfully'}</p>
                      </div>
                      <span className="text-2xl font-bold">{earnings.completionRate}%</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold">{isHebrew ? 'זמן תגובה ממוצע' : 'Average Response Time'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'מהירות תגובה לבקשות' : 'Speed of responding to requests'}</p>
                      </div>
                      <span className="text-2xl font-bold">{earnings.avgResponseTime} {isHebrew ? 'דק׳' : 'min'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div>
                        <p className="font-semibold">{isHebrew ? 'סך ביקורות' : 'Total Reviews'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'מלקוחות מרוצים' : 'From satisfied customers'}</p>
                      </div>
                      <span className="text-2xl font-bold">{earnings.totalReviews}</span>
                    </div>
                  </CardContent>
                </Card>
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
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'עדיין אין לך ביקורות' : 'No reviews yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="bg-gradient-to-r from-yellow-50 to-green-50 dark:from-yellow-900/20 dark:to-green-900/20">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-5xl font-bold">{earnings?.rating.toFixed(2)}</span>
                        <Star className="w-12 h-12 text-yellow-500 fill-yellow-500" />
                      </div>
                      <p className="text-lg text-gray-600 dark:text-gray-300">
                        {isHebrew ? 'על בסיס' : 'Based on'} {reviews.length} {isHebrew ? 'ביקורות' : 'reviews'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {reviews.map((review) => (
                  <Card key={review.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {review.ownerAvatar ? (
                            <img src={review.ownerAvatar} alt={review.ownerName} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                              <User className="w-6 h-6 text-blue-700 dark:text-blue-300" />
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-lg">{review.ownerName}</CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              {isHebrew ? 'עבור' : 'for'} {review.petName} • {formatDate(review.date)}
                            </CardDescription>
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
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{review.comment}</p>
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isHebrew ? 'משך טיול:' : 'Walk duration:'} {review.walkDuration} {isHebrew ? 'דקות' : 'minutes'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
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
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold mb-2">
                        {achievements.filter(a => a.unlocked).length} / {achievements.length}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {isHebrew ? 'הישגים שהושגו' : 'Achievements Unlocked'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  {achievements.map((achievement) => (
                    <Card 
                      key={achievement.id} 
                      className={`${
                        achievement.unlocked 
                          ? 'border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' 
                          : 'opacity-75'
                      }`}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="text-5xl">{achievement.icon}</div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                              {achievement.title}
                              {achievement.unlocked && (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              )}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {achievement.description}
                            </p>
                            {achievement.unlocked ? (
                              <Badge className="bg-green-600">
                                {isHebrew ? 'הושג' : 'Unlocked'} • {formatDate(achievement.unlockedDate!)}
                              </Badge>
                            ) : achievement.progress !== undefined && achievement.maxProgress !== undefined ? (
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{isHebrew ? 'התקדמות' : 'Progress'}</span>
                                  <span className="font-semibold">
                                    {achievement.progress} / {achievement.maxProgress}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                  <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                                    style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline">{isHebrew ? 'נעול' : 'Locked'}</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
