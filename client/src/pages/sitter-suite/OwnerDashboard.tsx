import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { 
  Calendar, 
  CreditCard, 
  Heart, 
  MessageCircle, 
  PawPrint, 
  Star, 
  Clock, 
  CheckCircle2,
  XCircle,
  DollarSign,
  MapPin,
  Plus,
  TrendingUp,
  Shield,
  MessageSquare
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { format } from 'date-fns';
import { ConversationList, ChatInterface } from '@/components/ChatInterface';
import { ReviewSubmitDialog } from '@/components/ReviewSubmitDialog';

interface Booking {
  id: string;
  sitterName: string;
  sitterPhoto: string | null;
  petName: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  totalPrice: number;
  currency: string;
  sitterRating: number;
}

interface PetProfile {
  id: string;
  petName: string;
  petType: string;
  breed: string;
  age: number;
  photoUrl: string | null;
}

interface PaymentHistory {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  date: string;
  status: 'completed' | 'pending' | 'refunded';
  sitterName: string;
}

export default function OwnerDashboard() {
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedConversation, setSelectedConversation] = useState<string>();
  const [currentUserId, setCurrentUserId] = useState<string>('demo-user-id');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);

  // Fetch bookings from unified API
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/bookings/my-bookings', { platform: 'sitter-suite' }],
  });

  const bookings: Booking[] = bookingsData?.bookings || [];

  // Fetch pets
  const { data: petsData } = useQuery({
    queryKey: ['/api/pets'],
  });

  const pets: PetProfile[] = petsData?.pets || [];

  // Fetch payment history (escrow payments)
  const { data: paymentsData } = useQuery({
    queryKey: ['/api/escrow/payments'],
  });

  const payments: PaymentHistory[] = paymentsData?.payments || [];

  const upcomingBookings = bookings.filter(b => 
    b.status === 'confirmed' && new Date(b.startDate) > new Date()
  );
  const pastBookings = bookings.filter(b => 
    b.status === 'completed' || new Date(b.endDate) < new Date()
  );
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  const totalSpent = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
      confirmed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
      completed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', icon: CheckCircle2 },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
    };
    const { color, icon: Icon } = variants[status] || variants.pending;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20">
      {/* Hero Header - Like Airbnb */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ 
                background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255,215,0,0.5)'
              }}>
                ✨ My Pet Stays
              </h1>
              <p className="text-lg text-purple-100">Manage bookings, pets, and payments</p>
            </div>
            <Link href="/sitter-suite/browse">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-6 shadow-2xl" data-testid="button-book-new-stay">
                <Plus className="w-5 h-5 mr-2" />
                Book New Stay
              </Button>
            </Link>
          </div>

          {/* Quick Stats - Like Booking.com */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{upcomingBookings.length}</p>
                    <p className="text-sm text-purple-100">Upcoming</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <PawPrint className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{pets.length}</p>
                    <p className="text-sm text-purple-100">My Pets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">₪{totalSpent.toFixed(0)}</p>
                    <p className="text-sm text-purple-100">Total Spent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{pastBookings.length}</p>
                    <p className="text-sm text-purple-100">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid bg-white dark:bg-gray-800 shadow-lg">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <MessageCircle className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="bookings" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              My Bookings
            </TabsTrigger>
            <TabsTrigger value="pets" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <PawPrint className="w-4 h-4 mr-2" />
              My Pets
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {pendingBookings.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
                    <Clock className="w-5 h-5" />
                    Pending Approval ({pendingBookings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingBookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={booking.sitterPhoto || undefined} />
                          <AvatarFallback className="bg-purple-600 text-white">
                            {booking.sitterName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{booking.sitterName}</p>
                          <p className="text-sm text-gray-500">{booking.petName} • {booking.serviceType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">₪{booking.totalPrice}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Upcoming Bookings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Upcoming Stays ({upcomingBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No upcoming bookings</p>
                    <Link href="/sitter-suite/browse">
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        Find a Sitter
                      </Button>
                    </Link>
                  </div>
                ) : (
                  upcomingBookings.map((booking) => (
                    <Card key={booking.id} className="border-purple-200 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          <Avatar className="w-20 h-20">
                            <AvatarImage src={booking.sitterPhoto || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-2xl">
                              {booking.sitterName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-xl font-bold">{booking.sitterName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                  <span className="font-semibold">{booking.sitterRating.toFixed(1)}</span>
                                  <Separator orientation="vertical" className="h-4" />
                                  <span className="text-sm text-gray-500">{booking.serviceType}</span>
                                </div>
                              </div>
                              {getStatusBadge(booking.status)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <PawPrint className="w-4 h-4 text-purple-600" />
                                <span>{booking.petName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-purple-600" />
                                <span>
                                  {format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-purple-600" />
                                <span className="font-bold">{booking.currency} {booking.totalPrice.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" size="sm" className="flex-1" data-testid={`button-message-${booking.id}`}>
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Message Sitter
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${booking.id}`}>
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ConversationList
                  currentUserId={currentUserId}
                  onSelectConversation={setSelectedConversation}
                  selectedConversationId={selectedConversation}
                />
              </div>
              <div className="lg:col-span-2">
                {selectedConversation ? (
                  <ChatInterface
                    conversationId={selectedConversation}
                    currentUserId={currentUserId}
                    otherParticipantName="Sitter"
                  />
                ) : (
                  <Card className="h-[600px] flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                      <p>Select a conversation to start messaging</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Bookings</CardTitle>
                <CardDescription>View and manage all your pet sitting bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <Card key={booking.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarImage src={booking.sitterPhoto || undefined} />
                              <AvatarFallback className="bg-purple-600 text-white">
                                {booking.sitterName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{booking.sitterName}</p>
                              <p className="text-sm text-gray-500">{booking.petName} • {booking.serviceType}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(booking.startDate), 'MMM d, yyyy')} - {format(new Date(booking.endDate), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="flex items-center gap-2 justify-end">
                              {getStatusBadge(booking.status)}
                              {booking.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  data-testid={`button-review-${booking.id}`}
                                  onClick={() => {
                                    setSelectedBookingForReview(booking);
                                    setReviewDialogOpen(true);
                                  }}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Review
                                </Button>
                              )}
                            </div>
                            <p className="font-bold">₪{booking.totalPrice}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {bookings.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No bookings found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pets Tab */}
          <TabsContent value="pets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Pets</CardTitle>
                    <CardDescription>Manage your pet profiles</CardDescription>
                  </div>
                  <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-pet">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Pet
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pets.map((pet) => (
                    <Card key={pet.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6 text-center">
                        <Avatar className="w-24 h-24 mx-auto mb-4">
                          <AvatarImage src={pet.photoUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-3xl">
                            <PawPrint className="w-12 h-12" />
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="text-xl font-bold mb-1">{pet.petName}</h3>
                        <p className="text-sm text-gray-500 mb-2">{pet.breed}</p>
                        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
                          <span>{pet.petType}</span>
                          <Separator orientation="vertical" className="h-3" />
                          <span>{pet.age} years</span>
                        </div>
                        <Button variant="outline" size="sm" className="mt-4 w-full" data-testid={`button-edit-pet-${pet.id}`}>
                          Edit Profile
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {pets.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No pets added yet</p>
                      <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-first-pet">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Pet
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>View all your transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${
                          payment.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' :
                          payment.status === 'refunded' ? 'bg-red-100 dark:bg-red-900/20' :
                          'bg-yellow-100 dark:bg-yellow-900/20'
                        }`}>
                          <DollarSign className={`w-5 h-5 ${
                            payment.status === 'completed' ? 'text-green-600' :
                            payment.status === 'refunded' ? 'text-red-600' :
                            'text-yellow-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-semibold">{payment.sitterName}</p>
                          <p className="text-sm text-gray-500">{format(new Date(payment.date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{payment.currency} {payment.amount.toFixed(2)}</p>
                        <Badge variant={payment.status === 'completed' ? 'default' : 'outline'}>
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No payment history
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      {selectedBookingForReview && (
        <ReviewSubmitDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          bookingType="sitter"
          bookingId={selectedBookingForReview.id}
          contractorName={selectedBookingForReview.sitterName}
          contractorType="sitter"
        />
      )}
    </div>
  );
}
