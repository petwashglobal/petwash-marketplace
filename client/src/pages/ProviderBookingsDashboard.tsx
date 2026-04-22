/**
 * Provider Bookings Dashboard
 * 
 * Pet Wash™ dashboard for service providers to:
 * - View incoming booking requests
 * - Accept/decline requests
 * - Schedule Meet & Greet sessions
 * - Track active bookings
 * - Send photo updates during service
 * - Mark services as complete
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarDays, Clock, User, MapPin, Star, Check, X,
  MessageSquare, Camera, Play, CheckCircle, AlertTriangle,
  Loader2, Dog, ChevronRight, Coffee, Phone, Mail, Navigation2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/lib/languageStore";
import { useToast } from "@/hooks/use-toast";

type BookingStatus = 
  | 'pending' 
  | 'accepted' 
  | 'declined'
  | 'meet_greet_scheduled'
  | 'meet_greet_completed'
  | 'payment_pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'reviewed'
  | 'cancelled'
  | 'disputed';

interface BookingRequest {
  requestId: string;
  status: BookingStatus;
  serviceType: string;
  startDate: string;
  endDate: string;
  petCount: number;
  totalCents: number;
  currency: string;
  ownerMessage?: string;
  meetGreetDate?: string;
  meetGreetLocation?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; labelHe: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', labelHe: 'ממתין', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  accepted: { label: 'Accepted', labelHe: 'אושר', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  declined: { label: 'Declined', labelHe: 'נדחה', color: 'text-red-700', bgColor: 'bg-red-100' },
  meet_greet_scheduled: { label: 'Meet & Greet', labelHe: 'פגישת היכרות', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  meet_greet_completed: { label: 'M&G Done', labelHe: 'פגישה הושלמה', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  payment_pending: { label: 'Awaiting Payment', labelHe: 'ממתין לתשלום', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  confirmed: { label: 'Confirmed', labelHe: 'מאושר', color: 'text-green-700', bgColor: 'bg-green-100' },
  in_progress: { label: 'In Progress', labelHe: 'בביצוע', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  completed: { label: 'Completed', labelHe: 'הושלם', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  reviewed: { label: 'Reviewed', labelHe: 'נבדק', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  cancelled: { label: 'Cancelled', labelHe: 'בוטל', color: 'text-gray-700', bgColor: 'bg-white' },
  disputed: { label: 'Disputed', labelHe: 'במחלוקת', color: 'text-rose-700', bgColor: 'bg-rose-100' },
};

const SERVICE_LABELS: Record<string, { en: string; he: string }> = {
  pet_sitting: { en: 'Pet Sitting', he: 'שמירה על חיות' },
  dog_walking: { en: 'Dog Walking', he: 'הליכת כלבים' },
  training: { en: 'Training', he: 'אילוף' },
  grooming: { en: 'Grooming', he: 'טיפוח' },
  pet_taxi: { en: 'Pet Taxi', he: 'הסעת חיות' },
  daycare: { en: 'Daycare', he: 'טיפול יומי' },
};

export default function ProviderBookingsDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'active' | 'completed'>('pending');

  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/booking-requests', 'provider'],
    queryFn: async () => {
      const res = await apiRequest('/api/booking-requests?role=provider');
      return res.json();
    },
  });

  const bookings: BookingRequest[] = bookingsData?.bookings || [];

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const upcomingBookings = bookings.filter(b => 
    ['accepted', 'meet_greet_scheduled', 'meet_greet_completed', 'confirmed'].includes(b.status)
  );
  const activeBookings = bookings.filter(b => b.status === 'in_progress');
  const completedBookings = bookings.filter(b => 
    ['completed', 'reviewed', 'cancelled', 'declined'].includes(b.status)
  );

  const tabCounts = {
    pending: pendingBookings.length,
    upcoming: upcomingBookings.length,
    active: activeBookings.length,
    completed: completedBookings.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              {isHebrew ? 'לוח בקרה לספקים' : 'Provider Dashboard'}
            </h1>
            <span className="px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold bg-white/20 text-white border border-white/30 rounded-sm">
              {isHebrew ? 'הזמנות' : 'Bookings'}
            </span>
          </div>
          <p className="text-white/80">
            {isHebrew ? 'נהל את ההזמנות והבקשות שלך' : 'Manage your bookings and requests'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { key: 'pending', icon: Clock, color: 'from-amber-500 to-orange-500' },
            { key: 'upcoming', icon: CalendarDays, color: 'from-blue-500 to-indigo-500' },
            { key: 'active', icon: Play, color: 'from-green-500 to-emerald-500' },
            { key: 'completed', icon: CheckCircle, color: 'from-gray-500 to-gray-600' },
          ].map(({ key, icon: Icon, color }) => (
            <Card 
              key={key}
              className={`cursor-pointer transition-all hover:scale-105 ${activeTab === key ? 'ring-2 ring-pink-500' : ''}`}
              onClick={() => setActiveTab(key as any)}
              data-testid={`card-stat-${key}`}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-r ${color} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{tabCounts[key as keyof typeof tabCounts]}</div>
                <div className="text-xs text-gray-500 capitalize">
                  {isHebrew ? (
                    key === 'pending' ? 'ממתינים' :
                    key === 'upcoming' ? 'קרובים' :
                    key === 'active' ? 'פעילים' : 'הושלמו'
                  ) : key}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="pending" className="relative" data-testid="tab-pending">
              {isHebrew ? 'ממתינים' : 'Pending'}
              {tabCounts.pending > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-amber-500">
                  {tabCounts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              {isHebrew ? 'קרובים' : 'Upcoming'}
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              {isHebrew ? 'פעילים' : 'Active'}
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              {isHebrew ? 'הושלמו' : 'Completed'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {isLoading ? (
              <LoadingSkeleton />
            ) : pendingBookings.length === 0 ? (
              <EmptyState type="pending" isHebrew={isHebrew} />
            ) : (
              <div className="space-y-4">
                {pendingBookings.map((booking) => (
                  <PendingBookingCard 
                    key={booking.requestId} 
                    booking={booking} 
                    isHebrew={isHebrew}
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming">
            {isLoading ? (
              <LoadingSkeleton />
            ) : upcomingBookings.length === 0 ? (
              <EmptyState type="upcoming" isHebrew={isHebrew} />
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <UpcomingBookingCard 
                    key={booking.requestId} 
                    booking={booking} 
                    isHebrew={isHebrew}
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active">
            {isLoading ? (
              <LoadingSkeleton />
            ) : activeBookings.length === 0 ? (
              <EmptyState type="active" isHebrew={isHebrew} />
            ) : (
              <div className="space-y-4">
                {activeBookings.map((booking) => (
                  <ActiveBookingCard 
                    key={booking.requestId} 
                    booking={booking} 
                    isHebrew={isHebrew}
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {isLoading ? (
              <LoadingSkeleton />
            ) : completedBookings.length === 0 ? (
              <EmptyState type="completed" isHebrew={isHebrew} />
            ) : (
              <div className="space-y-4">
                {completedBookings.map((booking) => (
                  <CompletedBookingCard 
                    key={booking.requestId} 
                    booking={booking} 
                    isHebrew={isHebrew}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-white rounded w-1/3 mb-4"></div>
            <div className="h-3 bg-white rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-white rounded w-1/4"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ type, isHebrew }: { type: string; isHebrew: boolean }) {
  const messages = {
    pending: { en: 'No pending requests', he: 'אין בקשות ממתינות' },
    upcoming: { en: 'No upcoming bookings', he: 'אין הזמנות קרובות' },
    active: { en: 'No active bookings', he: 'אין הזמנות פעילות' },
    completed: { en: 'No completed bookings yet', he: 'אין הזמנות שהושלמו עדיין' },
  };

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center">
        <Dog className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-gray-500">
        {isHebrew ? messages[type as keyof typeof messages]?.he : messages[type as keyof typeof messages]?.en}
      </p>
    </div>
  );
}

function PendingBookingCard({ 
  booking, 
  isHebrew, 
  onRefresh 
}: { 
  booking: BookingRequest; 
  isHebrew: boolean; 
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [meetGreetDate, setMeetGreetDate] = useState<Date | undefined>(undefined);
  const [meetGreetLocation, setMeetGreetLocation] = useState('');
  const [responseMessage, setResponseMessage] = useState('');

  const respondMutation = useMutation({
    mutationFn: async ({ action, data }: { action: 'accept' | 'decline'; data?: any }) => {
      const res = await apiRequest('POST', `/api/booking-requests/${booking.requestId}/respond`, { action, ...data });
      return res.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'accept' 
          ? (isHebrew ? 'הבקשה אושרה!' : 'Request accepted!') 
          : (isHebrew ? 'הבקשה נדחתה' : 'Request declined'),
      });
      setShowAcceptModal(false);
      onRefresh();
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'לא ניתן לעדכן את הבקשה' : 'Failed to update request',
        variant: 'destructive',
      });
    },
  });

  const statusConfig = STATUS_CONFIG[booking.status];
  const serviceLabel = SERVICE_LABELS[booking.serviceType] || { en: booking.serviceType, he: booking.serviceType };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0 mb-2`}>
              {isHebrew ? statusConfig.labelHe : statusConfig.label}
            </Badge>
            <h3 className="font-semibold text-lg text-gray-900">
              {isHebrew ? serviceLabel.he : serviceLabel.en}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">
              ₪{(booking.totalCents / 100).toFixed(0)}
            </div>
            <div className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>
              {format(new Date(booking.startDate), 'dd/MM')} - {format(new Date(booking.endDate), 'dd/MM/yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dog className="h-4 w-4" />
            <span>
              {booking.petCount} {isHebrew ? (booking.petCount === 1 ? 'חיה' : 'חיות') : (booking.petCount === 1 ? 'pet' : 'pets')}
            </span>
          </div>
        </div>

        {booking.ownerMessage && (
          <div className="bg-white rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">{booking.ownerMessage}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => respondMutation.mutate({ action: 'decline' })}
            disabled={respondMutation.isPending}
            data-testid={`button-decline-${booking.requestId}`}
          >
            <X className="h-4 w-4 mr-2" />
            {isHebrew ? 'דחה' : 'Decline'}
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white"
            onClick={() => setShowAcceptModal(true)}
            disabled={respondMutation.isPending}
            data-testid={`button-accept-${booking.requestId}`}
          >
            <Check className="h-4 w-4 mr-2" />
            {isHebrew ? 'אשר' : 'Accept'}
          </Button>
        </div>

        {/* Accept Modal with Meet & Greet Scheduling */}
        <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
          <DialogContent className="sm:max-w-md" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>
                {isHebrew ? 'אשר וקבע פגישת היכרות' : 'Accept & Schedule Meet & Greet'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {isHebrew ? 'תאריך פגישת היכרות' : 'Meet & Greet Date'}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="button-meet-greet-date">
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {meetGreetDate ? format(meetGreetDate, 'PPP') : (isHebrew ? 'בחר תאריך' : 'Pick a date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={meetGreetDate}
                      onSelect={setMeetGreetDate}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {isHebrew ? 'מיקום (אופציונלי)' : 'Location (optional)'}
                </label>
                <Input
                  value={meetGreetLocation}
                  onChange={(e) => setMeetGreetLocation(e.target.value)}
                  placeholder={isHebrew ? 'פארק, בית הלקוח...' : 'Park, client\'s home...'}
                  data-testid="input-meet-greet-location"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {isHebrew ? 'הודעה לבעלים' : 'Message to owner'}
                </label>
                <Textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder={isHebrew ? 'שמח לעזור! מחכה להיפגש...' : 'Happy to help! Looking forward to meeting...'}
                  data-testid="input-response-message"
                />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                onClick={() => {
                  respondMutation.mutate({
                    action: 'accept',
                    data: {
                      meetGreetDate: meetGreetDate?.toISOString(),
                      meetGreetLocation,
                      response: responseMessage,
                    },
                  });
                }}
                disabled={respondMutation.isPending}
                data-testid="button-confirm-accept"
              >
                {respondMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isHebrew ? 'שומר...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isHebrew ? 'אשר הזמנה' : 'Confirm Booking'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function UpcomingBookingCard({ 
  booking, 
  isHebrew, 
  onRefresh 
}: { 
  booking: BookingRequest; 
  isHebrew: boolean; 
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const statusConfig = STATUS_CONFIG[booking.status];
  const serviceLabel = SERVICE_LABELS[booking.serviceType] || { en: booking.serviceType, he: booking.serviceType };

  const completeMeetGreetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/booking-requests/${booking.requestId}/meet-greet`, { action: 'complete' });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isHebrew ? 'פגישת היכרות הושלמה!' : 'Meet & Greet completed!' });
      onRefresh();
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', variant: 'destructive' });
    },
  });

  const startServiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/booking-requests/${booking.requestId}/start`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isHebrew ? 'השירות התחיל!' : 'Service started!' });
      onRefresh();
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', description: isHebrew ? 'לא ניתן להתחיל את השירות' : 'Failed to start service', variant: 'destructive' });
    },
  });

  const [etaMinutes, setEtaMinutes] = useState('');
  const [showArrivingInput, setShowArrivingInput] = useState(false);

  const arrivingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/booking-requests/${booking.requestId}/arriving`, { eta: etaMinutes ? `${etaMinutes} דקות` : null });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: isHebrew ? '🚗 הלקוח קיבל התראה!' : '🚗 Customer notified!',
        description: etaMinutes
          ? (isHebrew ? `ETA: ${etaMinutes} דקות` : `ETA: ${etaMinutes} minutes`)
          : undefined,
      });
      setShowArrivingInput(false);
      setEtaMinutes('');
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', variant: 'destructive' });
    },
  });

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0 mb-2`}>
              {isHebrew ? statusConfig.labelHe : statusConfig.label}
            </Badge>
            <h3 className="font-semibold text-lg text-gray-900">
              {isHebrew ? serviceLabel.he : serviceLabel.en}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">
              ₪{(booking.totalCents / 100).toFixed(0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>
              {format(new Date(booking.startDate), 'dd/MM')} - {format(new Date(booking.endDate), 'dd/MM/yyyy')}
            </span>
          </div>
          {booking.meetGreetDate && (
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4" />
              <span>
                {isHebrew ? 'מפגש: ' : 'Meet: '}
                {format(new Date(booking.meetGreetDate), 'dd/MM HH:mm')}
              </span>
            </div>
          )}
        </div>

        {/* I'm Arriving — shown for accepted / confirmed / in_progress */}
        {['accepted', 'confirmed', 'in_progress'].includes(booking.status) && (
          <div className="mb-3">
            {showArrivingInput ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Navigation2 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <Input
                  type="number"
                  min="1"
                  max="120"
                  placeholder={isHebrew ? 'ETA (דקות)' : 'ETA (minutes)'}
                  value={etaMinutes}
                  onChange={e => setEtaMinutes(e.target.value)}
                  className="h-8 w-28 text-sm"
                  data-testid={`input-eta-${booking.requestId}`}
                />
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white h-8 px-3"
                  onClick={() => arrivingMutation.mutate()}
                  disabled={arrivingMutation.isPending}
                  data-testid={`button-confirm-arriving-${booking.requestId}`}
                >
                  {arrivingMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    isHebrew ? 'שלח' : 'Send'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => setShowArrivingInput(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                onClick={() => setShowArrivingInput(true)}
                data-testid={`button-arriving-${booking.requestId}`}
              >
                <Navigation2 className="h-4 w-4 mr-1.5" />
                {isHebrew ? 'אני בדרך!' : "I'm Arriving!"}
              </Button>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {booking.status === 'meet_greet_scheduled' && (
            <Button
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
              onClick={() => completeMeetGreetMutation.mutate()}
              disabled={completeMeetGreetMutation.isPending}
              data-testid={`button-complete-meet-greet-${booking.requestId}`}
            >
              <Coffee className="h-4 w-4 mr-2" />
              {isHebrew ? 'סיום פגישת היכרות' : 'Complete Meet & Greet'}
            </Button>
          )}
          {booking.status === 'confirmed' && (
            <Button
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white"
              onClick={() => startServiceMutation.mutate()}
              disabled={startServiceMutation.isPending}
              data-testid={`button-start-service-${booking.requestId}`}
            >
              <Play className="h-4 w-4 mr-2" />
              {isHebrew ? 'התחל שירות' : 'Start Service'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveBookingCard({ 
  booking, 
  isHebrew, 
  onRefresh 
}: { 
  booking: BookingRequest; 
  isHebrew: boolean; 
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const statusConfig = STATUS_CONFIG[booking.status];
  const serviceLabel = SERVICE_LABELS[booking.serviceType] || { en: booking.serviceType, he: booking.serviceType };

  const completeServiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/booking-requests/${booking.requestId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isHebrew ? 'השירות הסתיים!' : 'Service completed!' });
      onRefresh();
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', description: isHebrew ? 'לא ניתן לסיים את השירות' : 'Failed to complete service', variant: 'destructive' });
    },
  });

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0 mb-2`}>
              {isHebrew ? statusConfig.labelHe : statusConfig.label}
            </Badge>
            <h3 className="font-semibold text-lg text-gray-900">
              {isHebrew ? serviceLabel.he : serviceLabel.en}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">
              ₪{(booking.totalCents / 100).toFixed(0)}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled
            aria-label={isHebrew ? 'שלח תמונה — בקרוב' : 'Send Photo Update — coming soon'}
            data-testid={`button-photo-update-${booking.requestId}`}
          >
            <Camera className="h-4 w-4 mr-2" />
            {isHebrew ? 'שלח תמונה' : 'Send Photo Update'}
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white"
            onClick={() => completeServiceMutation.mutate()}
            disabled={completeServiceMutation.isPending}
            data-testid={`button-complete-service-${booking.requestId}`}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isHebrew ? 'סיים שירות' : 'Complete Service'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedBookingCard({ 
  booking, 
  isHebrew 
}: { 
  booking: BookingRequest; 
  isHebrew: boolean;
}) {
  const statusConfig = STATUS_CONFIG[booking.status];
  const serviceLabel = SERVICE_LABELS[booking.serviceType] || { en: booking.serviceType, he: booking.serviceType };

  return (
    <Card className="border-l-4 border-l-gray-300 opacity-75">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0 mb-2`}>
              {isHebrew ? statusConfig.labelHe : statusConfig.label}
            </Badge>
            <h3 className="font-semibold text-lg text-gray-900">
              {isHebrew ? serviceLabel.he : serviceLabel.en}
            </h3>
            <div className="text-sm text-gray-500 mt-1">
              {format(new Date(booking.startDate), 'dd/MM/yyyy')} - {format(new Date(booking.endDate), 'dd/MM/yyyy')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">
              ₪{(booking.totalCents / 100).toFixed(0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
