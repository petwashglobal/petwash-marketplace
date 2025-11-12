import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Car, MapPin, Clock, DollarSign, Star, Calendar, Navigation, Package, TrendingUp, ChevronRight, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PetTrekCustomerDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Fetch real bookings from API
  const { data: bookingsData } = useQuery({
    queryKey: ['/api/bookings/my-bookings', { platform: 'pettrek' }],
  });

  const allTrips = bookingsData?.bookings || [];
  const upcomingTrips = allTrips.length > 0 ? allTrips.filter((t: any) => t.status === 'confirmed' && new Date(t.serviceDate) > new Date()) : [];
  const pastTrips = allTrips.length > 0 ? allTrips.filter((t: any) => t.status === 'completed') : [];
  
  // Mock active trip for now
  const activeTripMock = null;

  // Fallback mock data for development
  const upcomingTripsMock = [
    {
      id: "1",
      driverName: "Michael Shapiro",
      driverPhoto: "https://i.pravatar.cc/150?img=11",
      rating: 4.9,
      vehicleType: "SUV",
      vehicleMake: "Toyota RAV4",
      licensePlate: "12-345-67",
      scheduledDate: "2025-11-08",
      scheduledTime: "14:00",
      pickup: "123 Rothschild Blvd, Tel Aviv",
      dropoff: "Veterinary Clinic, Herzliya",
      distance: "18.5 km",
      estimatedDuration: 35,
      price: 125,
      status: "confirmed",
      petName: "Bella"
    },
    {
      id: "2",
      driverName: "David Cohen",
      driverPhoto: "https://i.pravatar.cc/150?img=12",
      rating: 5.0,
      vehicleType: "Van",
      vehicleMake: "Mercedes Sprinter",
      licensePlate: "45-678-90",
      scheduledDate: "2025-11-10",
      scheduledTime: "10:00",
      pickup: "Home",
      dropoff: "Airport Pet Terminal",
      distance: "42 km",
      estimatedDuration: 55,
      price: 280,
      status: "pending",
      petName: "Max & Luna"
    }
  ];

  const activeTrip = {
    id: "active-1",
    driverName: "Michael Shapiro",
    driverPhoto: "https://i.pravatar.cc/150?img=11",
    vehicleMake: "Toyota RAV4",
    licensePlate: "12-345-67",
    petName: "Bella",
    currentLocation: { lat: 32.0853, lng: 34.7818 },
    eta: "8 min",
    distance: "3.2 km",
    progress: 65
  };

  const pastTripsMock = [
    {
      id: "past-1",
      driverName: "Michael Shapiro",
      driverPhoto: "https://i.pravatar.cc/150?img=11",
      date: "2025-11-05",
      time: "14:00",
      pickup: "Home",
      dropoff: "Vet Clinic",
      distance: "18.5 km",
      price: 125,
      petName: "Bella",
      rating: 5,
      duration: 32
    },
    {
      id: "past-2",
      driverName: "Sarah Levi",
      driverPhoto: "https://i.pravatar.cc/150?img=13",
      date: "2025-10-28",
      time: "09:00",
      pickup: "Home",
      dropoff: "Pet Grooming",
      distance: "12 km",
      price: 85,
      petName: "Max",
      rating: 5,
      duration: 28
    }
  ];

  const stats = {
    totalTrips: 23,
    totalSpent: 2890,
    favoriteDriver: "Michael Shapiro",
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
                🚗 PetTrek™
              </h1>
              <p className="text-slate-600 text-lg" data-testid="page-subtitle">Premium Pet Transport</p>
            </div>
            <Button 
              variant="outline" 
              className="gap-2 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-slate-200"
              data-testid="button-alerts"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </Button>
          </div>

          {/* Quick Stats - Pure White Neomorphism with Metallic Gold */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all" data-testid="stat-total-trips">
              <div className="text-slate-500 text-sm mb-2 font-medium">Total Trips</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                {stats.totalTrips}
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
            <Card className="bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all" data-testid="stat-top-driver">
              <div className="text-slate-500 text-sm mb-2 font-medium">Top Driver</div>
              <div className="text-lg font-semibold text-slate-800 truncate">{stats.favoriteDriver}</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Active Trip Alert - White Neomorphic with Gold Accent */}
        {activeTrip && (
          <Card className="mb-8 p-6 bg-white shadow-[8px_8px_24px_rgba(163,177,198,0.2),-4px_-4px_16px_rgba(255,255,255,0.9)] border-l-4 border-amber-500" data-testid="card-active-trip">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-amber-400 shadow-lg" data-testid="avatar-driver">
                    <AvatarImage src={activeTrip.driverPhoto} />
                    <AvatarFallback>MS</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
                    <Car className="h-3 w-3 text-white" />
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-lg text-slate-900" data-testid="text-active-trip-title">
                    {activeTrip.petName} is on the way!
                  </div>
                  <div className="text-sm text-slate-600" data-testid="text-driver-vehicle">
                    {activeTrip.driverName} • {activeTrip.vehicleMake} {activeTrip.licensePlate}
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
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2 text-slate-600">
                <span>Trip Progress</span>
                <span data-testid="text-progress-percent">{activeTrip.progress}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full transition-all duration-500"
                  style={{ width: `${activeTrip.progress}%` }}
                  data-testid="progress-bar"
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div data-testid="stat-eta">
                <div className="text-2xl font-bold text-slate-900">{activeTrip.eta}</div>
                <div className="text-sm text-slate-500">ETA</div>
              </div>
              <div data-testid="stat-remaining-distance">
                <div className="text-2xl font-bold text-slate-900">{activeTrip.distance}</div>
                <div className="text-sm text-slate-500">Remaining</div>
              </div>
              <div data-testid="stat-gps-status">
                <div className="text-2xl font-bold flex items-center justify-center gap-1 text-slate-900">
                  <MapPin className="h-5 w-5 animate-bounce text-amber-500" /> Live
                </div>
                <div className="text-sm text-slate-500">GPS Active</div>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs - White Neomorphism */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto bg-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.2),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] p-1" data-testid="tabs-trip-sections">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">History</TabsTrigger>
            <TabsTrigger value="receipts" data-testid="tab-receipts">Receipts</TabsTrigger>
          </TabsList>

          {/* Upcoming Trips */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingTrips.map((trip) => (
              <Card 
                key={trip.id} 
                className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2)] transition-all"
                data-testid={`card-trip-${trip.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 border-2 border-slate-100 shadow-lg" data-testid={`avatar-driver-${trip.id}`}>
                      <AvatarImage src={trip.driverPhoto} />
                      <AvatarFallback>{trip.driverName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-slate-900" data-testid={`text-driver-name-${trip.id}`}>
                          {trip.driverName}
                        </h3>
                        <div className="flex items-center gap-1 text-sm" data-testid={`rating-${trip.id}`}>
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-slate-700">{trip.rating}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-500 mb-2" data-testid={`text-vehicle-${trip.id}`}>
                        {trip.vehicleMake} • {trip.licensePlate}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2" data-testid={`trip-datetime-${trip.id}`}>
                          <Calendar className="h-4 w-4 text-amber-500" />
                          <span>{trip.scheduledDate} at {trip.scheduledTime}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-amber-500 mt-0.5" />
                          <div className="flex-1" data-testid={`trip-route-${trip.id}`}>
                            <div className="font-medium">{trip.pickup}</div>
                            <div className="text-xs text-slate-400 my-1">↓ {trip.distance} • ~{trip.estimatedDuration} min</div>
                            <div className="font-medium">{trip.dropoff}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" data-testid={`trip-pet-${trip.id}`}>
                          <Package className="h-4 w-4 text-amber-500" />
                          <span>Pet: {trip.petName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent" data-testid={`price-${trip.id}`}>
                      ₪{trip.price}
                    </div>
                    <Badge className={
                      trip.status === "confirmed" 
                        ? "bg-green-500 text-white" 
                        : "bg-amber-500 text-white"
                    } data-testid={`badge-status-${trip.id}`}>
                      {trip.status === "confirmed" ? "Confirmed" : "Pending"}
                    </Badge>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" className="gap-2 shadow-sm" data-testid={`button-reschedule-${trip.id}`}>
                        <Calendar className="h-4 w-4" />
                        Reschedule
                      </Button>
                      <Button size="sm" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white" data-testid={`button-details-${trip.id}`}>
                        Details
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Past Trips */}
          <TabsContent value="past" className="space-y-4">
            {pastTrips.map((trip) => (
              <Card 
                key={trip.id} 
                className="p-6 bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2)] transition-all"
                data-testid={`card-past-trip-${trip.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14 border-2 border-slate-100 shadow-md" data-testid={`avatar-past-driver-${trip.id}`}>
                      <AvatarImage src={trip.driverPhoto} />
                      <AvatarFallback>{trip.driverName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2 text-slate-900" data-testid={`text-past-driver-name-${trip.id}`}>
                        {trip.driverName}
                      </h3>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-amber-500" />
                          <span data-testid={`past-trip-datetime-${trip.id}`}>{trip.date} at {trip.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-amber-500" />
                          <span data-testid={`past-trip-route-${trip.id}`}>{trip.pickup} → {trip.dropoff}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span data-testid={`past-trip-duration-${trip.id}`}>{trip.duration} min • {trip.distance}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-amber-500" />
                          <span data-testid={`past-trip-price-${trip.id}`}>₪{trip.price}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-3" data-testid={`rating-past-${trip.id}`}>
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-5 w-5 ${i < trip.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="gap-2 shadow-sm" data-testid={`button-receipt-${trip.id}`}>
                      <Package className="h-4 w-4" />
                      Receipt
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 shadow-sm" data-testid={`button-book-again-${trip.id}`}>
                      <Car className="h-4 w-4" />
                      Book Again
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Receipts */}
          <TabsContent value="receipts">
            <Card className="p-8 text-center bg-white shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0" data-testid="card-receipts-empty">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Trip Receipts & Invoices</h3>
              <p className="text-slate-600 mb-6">
                Download detailed receipts for all your trips
              </p>
              <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg" data-testid="button-view-receipts">
                <DollarSign className="h-5 w-5" />
                View All Receipts
              </Button>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Book New Trip CTA - White Neomorphic */}
        <Card className="mt-8 p-8 bg-white text-center shadow-[8px_8px_24px_rgba(163,177,198,0.2),-8px_-8px_24px_rgba(255,255,255,0.9)] border-0" data-testid="card-book-cta">
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
            Need a Ride for Your Pet?
          </h2>
          <p className="text-slate-600 mb-6">Professional drivers, climate-controlled vehicles, GPS tracking</p>
          <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg hover:shadow-xl" data-testid="button-book-trip">
            <Car className="h-5 w-5" />
            Book a Trip Now
          </Button>
        </Card>
      </div>
    </div>
  );
}
