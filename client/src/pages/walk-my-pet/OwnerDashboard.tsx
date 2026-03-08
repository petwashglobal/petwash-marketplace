import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, DollarSign, Star, Bell, MessageCircle, TrendingUp, ChevronRight, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function WalkMyPetOwnerDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Fetch real bookings from API
  const { data: bookingsData } = useQuery({
    queryKey: ['/api/bookings/my-bookings', { platform: 'walk-my-pet' }],
  });

  const allWalks = bookingsData?.bookings || [];
  const upcomingWalks = allWalks.length > 0 ? allWalks.filter((w: any) => w.status === 'confirmed' && new Date(w.serviceDate) > new Date()) : [];
  const pastWalks = allWalks.length > 0 ? allWalks.filter((w: any) => w.status === 'completed') : [];
  
  // Mock active walk for now
  const activeWalkMock = null;

  // Fallback mock data for development
  const upcomingWalksMock = [
    {
      id: "1",
      walkerName: "Sarah Cohen",
      walkerPhoto: "https://i.pravatar.cc/150?img=1",
      rating: 4.9,
      date: "2025-11-08",
      time: "09:00",
      duration: 30,
      price: 45,
      status: "confirmed",
      petName: "Max",
      isRecurring: true,
      recurringDays: ["Mon", "Wed", "Fri"]
    },
    {
      id: "2",
      walkerName: "David Levi",
      walkerPhoto: "https://i.pravatar.cc/150?img=2",
      rating: 5.0,
      date: "2025-11-08",
      time: "16:00",
      duration: 45,
      price: 60,
      status: "walker_en_route",
      petName: "Luna"
    }
  ];

  const activeWalk = {
    id: "active-1",
    walkerName: "Sarah Cohen",
    walkerPhoto: "https://i.pravatar.cc/150?img=1",
    petName: "Max",
    startTime: "09:00",
    currentLocation: { lat: 32.0853, lng: 34.7818 },
    distance: "1.2 km",
    timeElapsed: "12 min"
  };

  const pastWalksMock = [
    {
      id: "past-1",
      walkerName: "Sarah Cohen",
      walkerPhoto: "https://i.pravatar.cc/150?img=1",
      date: "2025-11-06",
      time: "09:00",
      duration: 30,
      price: 45,
      petName: "Max",
      rating: 5,
      photo: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300&h=200&fit=crop"
    },
    {
      id: "past-2",
      walkerName: "David Levi",
      walkerPhoto: "https://i.pravatar.cc/150?img=2",
      date: "2025-11-05",
      time: "16:00",
      duration: 45,
      price: 60,
      petName: "Luna",
      rating: 5,
      photo: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=200&fit=crop"
    }
  ];

  const stats = {
    totalWalks: 47,
    totalSpent: 2145,
    favoriteWalker: "Sarah Cohen",
    avgRating: 4.9
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Premium White Neomorphic Header */}
      <div className="relative bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent" data-testid="page-title">
                🐾 Walk My Pet™
              </h1>
              <p className="text-slate-600 text-lg" data-testid="page-subtitle">Owner Dashboard</p>
            </div>
            <Button 
              variant="outline" 
              className="gap-2 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-slate-200"
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </Button>
          </div>

          {/* Quick Stats - Pure White Neomorphism */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all" data-testid="stat-total-walks">
              <div className="text-slate-500 text-sm mb-2 font-medium">Total Walks</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                {stats.totalWalks}
              </div>
            </Card>
            <Card className="bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all" data-testid="stat-total-spent">
              <div className="text-slate-500 text-sm mb-2 font-medium">Total Spent</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                ₪{stats.totalSpent}
              </div>
            </Card>
            <Card className="bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all" data-testid="stat-avg-rating">
              <div className="text-slate-500 text-sm mb-2 font-medium">Avg Rating</div>
              <div className="text-4xl font-bold flex items-center gap-1">
                <span className="bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                  {stats.avgRating}
                </span>
                <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              </div>
            </Card>
            <Card className="bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all" data-testid="stat-favorite-walker">
              <div className="text-slate-500 text-sm mb-2 font-medium">Favorite Walker</div>
              <div className="text-lg font-semibold text-slate-800 truncate">{stats.favoriteWalker}</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Active Walk Alert - White Neomorphic with Gold Accent */}
        {activeWalk && (
          <Card className="mb-8 p-6 bg-white shadow-[8px_8px_24px_rgba(163,177,198,0.2),-4px_-4px_16px_rgba(255,255,255,0.9)] border-l-4 border-amber-500" data-testid="card-active-walk">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12 border-2 border-amber-400 shadow-lg" data-testid="avatar-walker">
                    <AvatarImage src={activeWalk.walkerPhoto} />
                    <AvatarFallback>SC</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900" data-testid="text-active-walk-title">
                    {activeWalk.petName}'s Walk is Live!
                  </div>
                  <div className="text-sm text-slate-600" data-testid="text-walker-name">
                    with {activeWalk.walkerName}
                  </div>
                </div>
              </div>
              <Button 
                className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg hover:shadow-xl"
                data-testid="button-track-live"
              >
                <Navigation className="h-4 w-4" />
                Track Live
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div data-testid="stat-time-elapsed">
                <div className="text-2xl font-bold text-slate-900">{activeWalk.timeElapsed}</div>
                <div className="text-sm text-slate-500">Elapsed</div>
              </div>
              <div data-testid="stat-distance">
                <div className="text-2xl font-bold text-slate-900">{activeWalk.distance}</div>
                <div className="text-sm text-slate-500">Distance</div>
              </div>
              <div data-testid="stat-gps-status">
                <div className="text-2xl font-bold flex items-center justify-center gap-1 text-slate-900">
                  <MapPin className="h-5 w-5 text-amber-500" /> Live
                </div>
                <div className="text-sm text-slate-500">GPS Tracking</div>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs - White Neomorphism */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto bg-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.2),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] p-1" data-testid="tabs-walk-sections">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">History</TabsTrigger>
            <TabsTrigger value="recurring" data-testid="tab-recurring">Recurring</TabsTrigger>
          </TabsList>

          {/* Upcoming Walks */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingWalks.map((walk) => (
              <Card 
                key={walk.id} 
                className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2)] transition-all"
                data-testid={`card-walk-${walk.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 shadow-lg" data-testid={`avatar-walker-${walk.id}`}>
                      <AvatarImage src={walk.walkerPhoto} />
                      <AvatarFallback>{walk.walkerName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-slate-900" data-testid={`text-walker-name-${walk.id}`}>
                          {walk.walkerName}
                        </h3>
                        <div className="flex items-center gap-1 text-sm" data-testid={`rating-${walk.id}`}>
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-slate-700">{walk.rating}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2" data-testid={`walk-datetime-${walk.id}`}>
                          <Calendar className="h-4 w-4 text-amber-500" />
                          <span>{walk.date} at {walk.time}</span>
                        </div>
                        <div className="flex items-center gap-2" data-testid={`walk-duration-${walk.id}`}>
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span>{walk.duration} minutes • {walk.petName}</span>
                        </div>
                        {walk.isRecurring && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200" data-testid={`badge-recurring-${walk.id}`}>
                              Recurring: {walk.recurringDays.join(", ")}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent" data-testid={`price-${walk.id}`}>
                      ₪{walk.price}
                    </div>
                    <Badge className={
                      walk.status === "walker_en_route" 
                        ? "bg-amber-500 text-white" 
                        : "bg-green-500 text-white"
                    } data-testid={`badge-status-${walk.id}`}>
                      {walk.status === "walker_en_route" ? "Walker En Route" : "Confirmed"}
                    </Badge>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" className="gap-2 shadow-sm" data-testid={`button-chat-${walk.id}`}>
                        <MessageCircle className="h-4 w-4" />
                        Chat
                      </Button>
                      <Button size="sm" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white" data-testid={`button-details-${walk.id}`}>
                        Details
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Past Walks */}
          <TabsContent value="past" className="space-y-4">
            {pastWalks.map((walk) => (
              <Card 
                key={walk.id} 
                className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2)] transition-all"
                data-testid={`card-past-walk-${walk.id}`}
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <img 
                    src={walk.photo} 
                    alt="Walk photo"
                    className="w-full md:w-48 h-32 object-cover rounded-lg shadow-md"
                    data-testid={`img-walk-photo-${walk.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 shadow-md" data-testid={`avatar-past-walker-${walk.id}`}>
                        <AvatarImage src={walk.walkerPhoto} />
                        <AvatarFallback>{walk.walkerName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2 text-slate-900" data-testid={`text-past-walker-name-${walk.id}`}>
                          {walk.walkerName}
                        </h3>
                        <div className="text-sm text-slate-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            <span data-testid={`past-walk-datetime-${walk.id}`}>{walk.date} at {walk.time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span data-testid={`past-walk-duration-${walk.id}`}>{walk.duration} minutes • {walk.petName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-amber-500" />
                            <span data-testid={`past-walk-price-${walk.id}`}>₪{walk.price}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3" data-testid={`rating-past-${walk.id}`}>
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-5 w-5 ${i < walk.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Recurring Walks */}
          <TabsContent value="recurring">
            <Card className="p-8 text-center bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-recurring-empty">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Manage Recurring Walks</h3>
              <p className="text-slate-600 mb-6">
                Set up regular walking schedules for your pets
              </p>
              <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg" data-testid="button-create-recurring">
                <Calendar className="h-5 w-5" />
                Create Recurring Schedule
              </Button>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Book New Walk CTA - White Neomorphic */}
        <Card className="mt-8 p-8 bg-white text-center shadow-[8px_8px_24px_rgba(163,177,198,0.2),-8px_-8px_24px_rgba(255,255,255,0.9)] border-0" data-testid="card-book-cta">
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
            Need a Walk Today?
          </h2>
          <p className="text-slate-600 mb-6">Book a trusted walker in seconds</p>
          <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg hover:shadow-xl" data-testid="button-find-walkers">
            <MapPin className="h-5 w-5" />
            Find Walkers Near Me
          </Button>
        </Card>
      </div>
    </div>
  );
}
