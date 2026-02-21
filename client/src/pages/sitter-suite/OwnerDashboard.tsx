import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
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
  Plus,
  TrendingUp,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Crown,
  Shield,
  ChevronRight
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

  const { data: bookingsData } = useQuery({
    queryKey: ['/api/bookings/my-bookings', { platform: 'sitter-suite' }],
  });

  const bookings: Booking[] = bookingsData?.bookings || [];

  const { data: petsData } = useQuery({
    queryKey: ['/api/pets'],
  });

  const pets: PetProfile[] = petsData?.pets || [];

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

  const statusLabels: Record<string, string> = {
    pending: t('sitterHub.pending'),
    confirmed: t('sitterHub.confirmed'),
    completed: t('sitterHub.completed'),
    cancelled: t('sitterHub.cancelled'),
    refunded: t('sitterHub.refunded'),
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string; border: string; icon: any }> = {
      pending: { bg: 'bg-white', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
      confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
      completed: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', icon: CheckCircle2 },
      cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
    };
    const v = variants[status] || variants.pending;
    return (
      <span className={`${v.bg} ${v.text} border ${v.border} inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold`}>
        <v.icon className="w-3 h-3" />
        {statusLabels[status] || status}
      </span>
    );
  };

  const statCards = [
    { label: t('sitterHub.confirmed'), value: upcomingBookings.length, icon: CheckCircle2, gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-100' },
    { label: t('sitterHub.totalSpent'), value: `₪${totalSpent.toFixed(0)}`, icon: DollarSign, gradient: 'from-fuchsia-500 to-pink-500', shadow: 'shadow-fuchsia-100' },
    { label: t('sitterHub.myPets'), value: pets.length, icon: PawPrint, gradient: 'from-rose-400 to-pink-500', shadow: 'shadow-rose-100' },
    { label: t('sitterHub.completed'), value: pastBookings.length, icon: Calendar, gradient: 'from-pink-400 to-fuchsia-500', shadow: 'shadow-pink-100' },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero Section ── */}
      <section className="relative bg-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-pink-50 to-fuchsia-50 opacity-70 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-rose-50 to-pink-50 opacity-50 blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 pt-10 pb-12 md:pt-14 md:pb-16">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-rose-500 flex items-center justify-center shadow-xl shadow-pink-200/60">
                    <Heart className="w-7 h-7 text-white fill-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-md">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-pink-500 block">The Sitter Suite™</span>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
                    {t('sitterHub.title')}
                  </h1>
                </div>
              </div>
              <p className="text-gray-500 text-base max-w-md leading-relaxed">
                {t('sitterHub.description')}
              </p>
            </div>

            <Link href="/sitter-suite/browse">
              <Button 
                className="group relative bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-500 hover:from-pink-600 hover:via-fuchsia-600 hover:to-rose-600 text-white px-8 py-6 text-base font-bold rounded-2xl shadow-xl shadow-pink-300/40 transition-all duration-300 hover:shadow-2xl hover:shadow-pink-400/50 hover:-translate-y-1 active:translate-y-0"
                data-testid="button-book-new-stay"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('sitterHub.bookNewStay')}
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mt-10">
            {statCards.map((stat) => (
              <div key={stat.label} className={`group relative bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm ${stat.shadow} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-50 to-transparent rounded-bl-[60px] opacity-60 pointer-events-none" />
                <div className="relative flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{stat.value}</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />

      {/* ── Main Content ── */}
      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white border border-gray-200 rounded-2xl p-1.5 grid w-full grid-cols-5 lg:w-auto lg:inline-grid shadow-sm">
            {[
              { value: 'overview', icon: TrendingUp, label: t('sitterHub.overview') },
              { value: 'messages', icon: MessageCircle, label: t('sitterHub.messages') },
              { value: 'bookings', icon: Calendar, label: t('sitterHub.bookings') },
              { value: 'pets', icon: PawPrint, label: t('sitterHub.myPets') },
              { value: 'payments', icon: CreditCard, label: t('sitterHub.payments') },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-xl text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-200/50 text-gray-500 font-semibold transition-all duration-200"
              >
                <tab.icon className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="space-y-6">
            {pendingBookings.length > 0 && (
              <div className="bg-white rounded-3xl border border-amber-200/80 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50/50">
                  <h3 className="flex items-center gap-2 text-amber-800 font-bold text-base">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    {t('sitterHub.pendingApproval')} ({pendingBookings.length})
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {pendingBookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-pink-200 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12 ring-2 ring-pink-100 ring-offset-2">
                          <AvatarImage src={booking.sitterPhoto || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white font-bold text-sm">
                            {booking.sitterName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-gray-900">{booking.sitterName}</p>
                          <p className="text-sm text-gray-400">{booking.petName} · {booking.serviceType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-lg text-gray-900">₪{booking.totalPrice}</p>
                        <p className="text-xs text-gray-400 font-medium">
                          {format(new Date(booking.startDate), 'MMM d')} – {format(new Date(booking.endDate), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Stays */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-pink-200/50">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  {t('sitterHub.upcomingStays')}
                  <span className="text-sm font-semibold text-gray-400">({upcomingBookings.length})</span>
                </h2>
              </div>
              <div className="p-6">
                {upcomingBookings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="relative mx-auto w-24 h-24 mb-6">
                      <div className="absolute inset-0 rounded-full bg-pink-100/60 animate-pulse" />
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-pink-50 to-fuchsia-50 flex items-center justify-center border border-pink-100">
                        <PawPrint className="w-10 h-10 text-pink-300" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t('sitterHub.noUpcomingStays')}</h3>
                    <p className="text-gray-400 mb-8 text-sm max-w-xs mx-auto">
                      {t('sitterHub.bookFirstStay')}
                    </p>
                    <Link href="/sitter-suite/browse">
                      <Button className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-600 hover:to-fuchsia-600 text-white rounded-2xl px-8 py-3 font-bold shadow-xl shadow-pink-200/50 transition-all hover:shadow-2xl hover:-translate-y-0.5">
                        <Sparkles className="w-4 h-4 mr-2" />
                        {t('sitterHub.findSitter')}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <div key={booking.id} className="group bg-white border border-gray-100 rounded-2xl p-6 hover:border-pink-200 hover:shadow-lg hover:shadow-pink-50 transition-all duration-300">
                        <div className="flex flex-col md:flex-row gap-5">
                          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-rose-500 p-[3px] shrink-0 shadow-lg shadow-pink-200/40 group-hover:shadow-xl transition-shadow">
                            <div className="w-full h-full rounded-[13px] bg-white flex items-center justify-center overflow-hidden">
                              {booking.sitterPhoto ? (
                                <img src={booking.sitterPhoto} alt={booking.sitterName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-2xl font-extrabold bg-gradient-to-br from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
                                  {booking.sitterName.charAt(0)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">{booking.sitterName}</h3>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200/80">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    {booking.sitterRating.toFixed(1)}
                                  </span>
                                  <span className="text-sm text-gray-400 font-medium">{booking.serviceType}</span>
                                </div>
                              </div>
                              {getStatusBadge(booking.status)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {[
                                { icon: PawPrint, text: booking.petName },
                                { icon: Calendar, text: `${format(new Date(booking.startDate), 'MMM d')} – ${format(new Date(booking.endDate), 'MMM d')}` },
                                { icon: DollarSign, text: `${booking.currency} ${booking.totalPrice.toFixed(2)}`, bold: true },
                              ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <item.icon className="w-4 h-4 text-pink-400 shrink-0" />
                                  <span className={item.bold ? 'font-bold text-gray-900' : 'text-gray-600'}>{item.text}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-3 pt-2">
                              <Button variant="outline" size="sm" className="flex-1 rounded-xl border-pink-200 text-pink-600 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-300 font-semibold transition-all" data-testid={`button-message-${booking.id}`}>
                                <MessageCircle className="w-4 h-4 mr-2" />
                                {t('sitterHub.message')}
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold" data-testid={`button-view-${booking.id}`}>
                                {t('sitterHub.viewDetails')}
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Messages Tab ── */}
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
                  <div className="bg-white border border-gray-100 rounded-3xl h-[600px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-50 to-fuchsia-50 flex items-center justify-center mx-auto mb-5 border border-pink-100">
                        <MessageCircle className="h-9 w-9 text-pink-300" />
                      </div>
                      <p className="text-gray-900 font-bold text-lg mb-1">{t('sitterHub.noConversation')}</p>
                      <p className="text-gray-400 text-sm">{t('sitterHub.chooseConversation')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Bookings Tab ── */}
          <TabsContent value="bookings" className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-pink-200/50">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{t('sitterHub.allBookings')}</h2>
                  <p className="text-xs text-gray-400">{t('sitterHub.allBookingsDesc')}</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5 hover:border-pink-200 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-11 h-11 ring-2 ring-pink-100 ring-offset-1">
                          <AvatarImage src={booking.sitterPhoto || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white font-bold text-sm">
                            {booking.sitterName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-gray-900">{booking.sitterName}</p>
                          <p className="text-sm text-gray-400">{booking.petName} · {booking.serviceType}</p>
                          <p className="text-xs text-gray-300 mt-0.5 font-medium">
                            {format(new Date(booking.startDate), 'MMM d, yyyy')} – {format(new Date(booking.endDate), 'MMM d, yyyy')}
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
                              className="gap-1.5 rounded-xl border-pink-200 text-pink-600 hover:bg-pink-50 font-semibold text-xs"
                              data-testid={`button-review-${booking.id}`}
                              onClick={() => {
                                setSelectedBookingForReview(booking);
                                setReviewDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {t('sitterHub.review')}
                            </Button>
                          )}
                        </div>
                        <p className="font-extrabold text-gray-900">₪{booking.totalPrice}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-50 to-fuchsia-50 flex items-center justify-center mx-auto mb-5 border border-pink-100">
                      <Calendar className="w-9 h-9 text-pink-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{t('sitterHub.noBookings')}</h3>
                    <p className="text-gray-400 text-sm">{t('sitterHub.bookingHistoryHere')}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Pets Tab ── */}
          <TabsContent value="pets" className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-pink-200/50">
                    <PawPrint className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{t('sitterHub.myPets')}</h2>
                    <p className="text-xs text-gray-400">{t('sitterHub.managePets')}</p>
                  </div>
                </div>
                <Button className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-600 hover:to-fuchsia-600 text-white rounded-xl font-bold shadow-lg shadow-pink-200/40 px-5" data-testid="button-add-pet">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('sitterHub.addPet')}
                </Button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pets.map((pet) => (
                    <div key={pet.id} className="group bg-white border border-gray-100 rounded-2xl p-6 text-center hover:border-pink-200 hover:shadow-lg hover:shadow-pink-50 transition-all duration-300">
                      <div className="relative mx-auto w-24 h-24 mb-5">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-200 to-fuchsia-200 opacity-0 group-hover:opacity-40 transition-opacity blur-md" />
                        <Avatar className="relative w-24 h-24 ring-4 ring-pink-100 group-hover:ring-pink-200 transition-all">
                          <AvatarImage src={pet.photoUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-pink-500 via-fuchsia-500 to-rose-500 text-white">
                            <PawPrint className="w-10 h-10" />
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <h3 className="text-xl font-extrabold text-gray-900 mb-1">{pet.petName}</h3>
                      <p className="text-sm text-gray-400 font-medium mb-3">{pet.breed}</p>
                      <div className="flex items-center justify-center gap-3 text-xs text-gray-400 font-medium">
                        <span className="px-2.5 py-1 bg-gray-50 rounded-full">{pet.petType}</span>
                        <span className="px-2.5 py-1 bg-gray-50 rounded-full">{pet.age} {t('sitterHub.years')}</span>
                      </div>
                      <Button variant="outline" size="sm" className="mt-5 w-full rounded-xl border-pink-200 text-pink-600 hover:bg-pink-50 hover:text-pink-700 font-semibold" data-testid={`button-edit-pet-${pet.id}`}>
                        {t('sitterHub.editProfile')}
                      </Button>
                    </div>
                  ))}
                  {pets.length === 0 && (
                    <div className="col-span-full text-center py-16">
                      <div className="relative mx-auto w-24 h-24 mb-6">
                        <div className="absolute inset-0 rounded-full bg-pink-100/60 animate-pulse" />
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-pink-50 to-fuchsia-50 flex items-center justify-center border border-pink-100">
                          <PawPrint className="w-10 h-10 text-pink-300" />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{t('sitterHub.noPets')}</h3>
                      <p className="text-gray-400 text-sm mb-6">{t('sitterHub.addFurryFriends')}</p>
                      <Button className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-600 hover:to-fuchsia-600 text-white rounded-2xl px-8 py-3 font-bold shadow-xl shadow-pink-200/50" data-testid="button-add-first-pet">
                        <Plus className="w-4 h-4 mr-2" />
                        {t('sitterHub.addFirstPet')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Payments Tab ── */}
          <TabsContent value="payments" className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-pink-200/50">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{t('sitterHub.paymentHistory')}</h2>
                  <p className="text-xs text-gray-400">{t('sitterHub.viewTransactions')}</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-pink-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        payment.status === 'completed' ? 'bg-emerald-50' :
                        payment.status === 'refunded' ? 'bg-red-50' :
                        'bg-white'
                      }`}>
                        <DollarSign className={`w-5 h-5 ${
                          payment.status === 'completed' ? 'text-emerald-500' :
                          payment.status === 'refunded' ? 'text-red-500' :
                          'text-amber-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{payment.sitterName}</p>
                        <p className="text-xs text-gray-400 font-medium">{format(new Date(payment.date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-lg text-gray-900">{payment.currency} {payment.amount.toFixed(2)}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                        payment.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        payment.status === 'refunded' ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-white text-amber-700 border border-amber-200'
                      }`}>
                        {statusLabels[payment.status] || payment.status}
                      </span>
                    </div>
                  </div>
                ))}
                {payments.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-50 to-fuchsia-50 flex items-center justify-center mx-auto mb-5 border border-pink-100">
                      <CreditCard className="w-9 h-9 text-pink-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{t('sitterHub.noPayments')}</h3>
                    <p className="text-gray-400 text-sm">{t('sitterHub.transactionsHere')}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

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
