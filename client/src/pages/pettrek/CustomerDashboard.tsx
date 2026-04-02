import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Car, MapPin, Clock, DollarSign, Star, Calendar, Navigation, Package, TrendingUp, ChevronRight, Bell, Home, Building2, Scissors, Heart, Edit2, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

export default function PetTrekCustomerDashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Fetch real bookings from API
  const { data: bookingsData } = useQuery({
    queryKey: ['/api/bookings/my-bookings', { platform: 'pettrek' }],
  });

  const allTrips = bookingsData?.bookings || [];
  const upcomingTrips = allTrips.length > 0 ? allTrips.filter((t: any) => t.status === 'confirmed' && new Date(t.serviceDate) > new Date()) : [];
  const pastTrips = allTrips.length > 0 ? allTrips.filter((t: any) => t.status === 'completed') : [];
  
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
    },
    {
      id: "past-3",
      driverName: "David Cohen",
      driverPhoto: "https://i.pravatar.cc/150?img=12",
      date: "2025-10-20",
      time: "15:30",
      pickup: "Home",
      dropoff: "Dog Park",
      distance: "8 km",
      price: 65,
      petName: "Luna",
      rating: 4,
      duration: 22
    }
  ];

  const savedLocations = [
    {
      id: "loc-1",
      name: "Home",
      address: "123 Rothschild Blvd, Tel Aviv",
      icon: Home,
      color: "from-blue-500 to-blue-600"
    },
    {
      id: "loc-2",
      name: "Vet Clinic",
      address: "Veterinary Clinic, Herzliya",
      icon: Building2,
      color: "from-green-500 to-green-600"
    },
    {
      id: "loc-3",
      name: "Pet Groomer",
      address: "Premium Pet Spa, Ramat Aviv",
      icon: Scissors,
      color: "from-purple-500 to-purple-600"
    }
  ];

  const favoriteDrivers = [
    {
      id: "drv-1",
      name: "Michael Shapiro",
      photo: "https://i.pravatar.cc/150?img=11",
      rating: 4.9,
      totalTrips: 12
    },
    {
      id: "drv-2",
      name: "Sarah Levi",
      photo: "https://i.pravatar.cc/150?img=13",
      rating: 5.0,
      totalTrips: 8
    },
    {
      id: "drv-3",
      name: "David Cohen",
      photo: "https://i.pravatar.cc/150?img=12",
      rating: 4.8,
      totalTrips: 5
    },
    {
      id: "drv-4",
      name: "Rachel Ben-David",
      photo: "https://i.pravatar.cc/150?img=14",
      rating: 4.9,
      totalTrips: 7
    }
  ];

  const stats = {
    totalTrips: 23,
    thisMonth: 5,
    savedLocations: 3,
    favoriteDrivers: 4
  };

  const displayUpcomingTrips = upcomingTrips.length > 0 ? upcomingTrips : upcomingTripsMock;
  const displayPastTrips = pastTrips.length > 0 ? pastTrips : pastTripsMock;

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Luxury Welcome Header */}
      <div className="luxury-container luxury-section-compact">
        <div className="flex items-center justify-between mb-8 luxury-animate-fade-in">
          <div>
            <h1 className="luxury-heading-lg luxury-text-gradient mb-2" data-testid="page-title">
              🚗 Welcome to ⁦PetTrek™⁩
            </h1>
            <p className="luxury-text-body" data-testid="page-subtitle">Your Premium Pet Transportation Hub</p>
          </div>
          <Button 
            className="luxury-btn-primary luxury-shadow-xl gap-2"
            data-testid="button-quick-book"
            onClick={() => setLocation('/pettrek/book')}
          >
            <Car className="h-5 w-5" />
            <span className="hidden sm:inline">Quick Book</span>
          </Button>
        </div>

        {/* Quick Stats - Luxury Grid */}
        <div className="luxury-grid-4 luxury-animate-fade-in luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid="stat-total-trips">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 mb-4">
              <Car className="h-6 w-6 text-white" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">{stats.totalTrips}</div>
            <div className="luxury-text-small">Total Trips</div>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid="stat-this-month">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mb-4">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">{stats.thisMonth}</div>
            <div className="luxury-text-small">This Month</div>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid="stat-saved-locations">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 mb-4">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">{stats.savedLocations}</div>
            <div className="luxury-text-small">Saved Locations</div>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid="stat-favorite-drivers">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 mb-4">
              <Star className="h-6 w-6 text-white" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">{stats.favoriteDrivers}</div>
            <div className="luxury-text-small">Favorite Drivers</div>
          </div>
        </div>
      </div>

      {/* Active Trip Section */}
      {activeTrip && (
        <div className="luxury-container luxury-animate-fade-in luxury-delay-2">
          <div className="luxury-glass-card luxury-shadow-xl p-8 mb-8" data-testid="card-active-trip">
            <h2 className="luxury-heading-md mb-6">Active Trip</h2>
            
            <div className="luxury-glass-minimal luxury-hover-lift p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-3 border-gradient-to-br from-purple-500 to-purple-600 shadow-lg" data-testid="avatar-active-driver">
                      <AvatarImage src={activeTrip.driverPhoto} />
                      <AvatarFallback>MS</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
                      <Car className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="luxury-heading-sm mb-1" data-testid="text-pet-name">
                      {activeTrip.petName} is on the way!
                    </div>
                    <div className="luxury-text-small" data-testid="text-driver-info">
                      {activeTrip.driverName} • {activeTrip.vehicleMake}
                    </div>
                  </div>
                </div>
                <Button 
                  className="luxury-btn-primary gap-2"
                  data-testid="button-track-live"
                  onClick={() => setLocation(`/pettrek/track/${activeTrip.id}`)}
                >
                  <Navigation className="h-4 w-4" />
                  Track Live
                </Button>
              </div>

              <div className="mb-6">
                <div className="flex justify-between luxury-text-small mb-2">
                  <span>Trip Progress</span>
                  <span className="luxury-text-gradient font-semibold" data-testid="text-progress">{activeTrip.progress}%</span>
                </div>
                <div className="h-3 bg-gradient-to-r from-purple-100 to-purple-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${activeTrip.progress}%` }}
                    data-testid="progress-bar"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center" data-testid="stat-eta">
                  <div className="luxury-heading-sm luxury-text-gradient mb-1">{activeTrip.eta}</div>
                  <div className="luxury-text-small">ETA</div>
                </div>
                <div className="text-center" data-testid="stat-remaining">
                  <div className="luxury-heading-sm luxury-text-gradient mb-1">{activeTrip.distance}</div>
                  <div className="luxury-text-small">Remaining</div>
                </div>
                <div className="text-center" data-testid="stat-gps">
                  <div className="luxury-heading-sm luxury-text-gradient mb-1 flex items-center justify-center gap-1">
                    <MapPin className="h-4 w-4 animate-bounce" /> Live
                  </div>
                  <div className="luxury-text-small">GPS Active</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                className="luxury-btn-secondary flex-1"
                data-testid="button-contact-driver"
                onClick={() => { window.location.href = 'tel:+972501234567'; }}
              >
                Call Driver
              </Button>
              <Button
                className="luxury-btn-secondary flex-1"
                data-testid="button-share-eta"
                onClick={async () => {
                  const text = 'My pet is on the way! Track here: ' + window.location.href;
                  if (navigator.share) {
                    await navigator.share({ title: 'PetTrek™ ETA', text, url: window.location.href });
                  } else {
                    await navigator.clipboard.writeText(text);
                    toast({ title: 'ETA copied', description: 'Share the link with your family' });
                  }
                }}
              >
                Share ETA
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Trips & History Tabs */}
      <div className="luxury-container luxury-animate-fade-in luxury-delay-3">
        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto" data-testid="tabs-trips">
              <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming Trips</TabsTrigger>
              <TabsTrigger value="past" data-testid="tab-past">Trip History</TabsTrigger>
            </TabsList>

            {/* Upcoming Trips */}
            <TabsContent value="upcoming" className="space-y-4">
              <h2 className="luxury-heading-md mb-4">Scheduled Trips</h2>
              {displayUpcomingTrips.map((trip, index) => (
                <div 
                  key={trip.id} 
                  className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${Math.min(index + 1, 10)}`}
                  data-testid={`card-trip-${trip.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="relative">
                        <Avatar className="h-14 w-14 border-2 border-gradient-to-br from-purple-500 to-purple-600 shadow-md" data-testid={`avatar-driver-${trip.id}`}>
                          <AvatarImage src={trip.driverPhoto} />
                          <AvatarFallback>{trip.driverName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="luxury-heading-sm" data-testid={`text-driver-${trip.id}`}>
                            {trip.driverName}
                          </h3>
                          <div className="luxury-badge-gold px-2 py-1 rounded-full text-xs flex items-center gap-1" data-testid={`rating-${trip.id}`}>
                            <Star className="h-3 w-3 fill-current" />
                            {trip.rating}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 luxury-text-body">
                            <Calendar className="h-4 w-4 text-purple-500" />
                            <span data-testid={`datetime-${trip.id}`}>{trip.scheduledDate} at {trip.scheduledTime}</span>
                          </div>
                          <div className="flex items-start gap-2 luxury-text-body">
                            <MapPin className="h-4 w-4 text-purple-500 mt-1" />
                            <div className="flex-1" data-testid={`route-${trip.id}`}>
                              <div className="font-medium">{trip.pickup}</div>
                              <div className="luxury-text-small text-gray-400 my-1">↓ {trip.distance} • ~{trip.estimatedDuration} min</div>
                              <div className="font-medium">{trip.dropoff}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 luxury-text-body">
                            <Package className="h-4 w-4 text-purple-500" />
                            <span data-testid={`pet-${trip.id}`}>Pet: {trip.petName}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="luxury-heading-lg luxury-text-gradient" data-testid={`price-${trip.id}`}>
                        ₪{trip.price}
                      </div>
                      <div className={trip.status === "confirmed" ? "luxury-badge-success" : "luxury-badge"} data-testid={`status-${trip.id}`}>
                        {trip.status === "confirmed" ? "Confirmed" : "Pending"}
                      </div>
                      <div className="flex gap-2">
                        <Button className="luxury-btn-secondary text-sm" size="sm" data-testid={`button-reschedule-${trip.id}`}>
                          Reschedule
                        </Button>
                        <Button className="luxury-btn-primary text-sm" size="sm" data-testid={`button-details-${trip.id}`}>
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Past Trips History */}
            <TabsContent value="past" className="space-y-4">
              <h2 className="luxury-heading-md mb-4">Recent Trips</h2>
              {displayPastTrips.map((trip, index) => (
                <div 
                  key={trip.id} 
                  className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${Math.min(index + 1, 10)}`}
                  data-testid={`card-past-${trip.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="h-12 w-12 border-2 border-purple-200 shadow-sm" data-testid={`avatar-past-${trip.id}`}>
                        <AvatarImage src={trip.driverPhoto} />
                        <AvatarFallback>{trip.driverName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="luxury-heading-sm mb-2" data-testid={`driver-past-${trip.id}`}>{trip.driverName}</h3>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 luxury-text-small">
                            <Calendar className="h-3 w-3 text-purple-500" />
                            <span data-testid={`date-past-${trip.id}`}>{trip.date} at {trip.time}</span>
                          </div>
                          <div className="luxury-text-body" data-testid={`route-past-${trip.id}`}>
                            {trip.pickup} → {trip.dropoff}
                          </div>
                          <div className="flex items-center gap-2 luxury-text-small">
                            <Clock className="h-3 w-3 text-purple-500" />
                            <span data-testid={`duration-past-${trip.id}`}>{trip.duration} min • {trip.distance}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${i < trip.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="luxury-heading-sm luxury-text-gradient" data-testid={`price-past-${trip.id}`}>
                        ₪{trip.price}
                      </div>
                      <div className="luxury-badge-success" data-testid={`status-past-${trip.id}`}>
                        Completed
                      </div>
                      <div className="flex gap-2">
                        <Button className="luxury-btn-ghost text-sm" size="sm" data-testid={`button-receipt-${trip.id}`}>
                          <Package className="h-3 w-3 mr-1" />
                          Receipt
                        </Button>
                        <Button className="luxury-btn-ghost text-sm" size="sm" data-testid={`button-book-again-${trip.id}`}>
                          <Car className="h-3 w-3 mr-1" />
                          Book Again
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Saved Locations */}
      <div className="luxury-container luxury-animate-fade-in luxury-delay-4">
        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-8">
          <h2 className="luxury-heading-md mb-6">Saved Locations</h2>
          <div className="luxury-grid-3">
            {savedLocations.map((location, index) => {
              const IconComponent = location.icon;
              return (
                <div 
                  key={location.id} 
                  className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-scale-in luxury-delay-${index + 1}`}
                  data-testid={`card-location-${location.id}`}
                >
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br ${location.color} mb-4`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="luxury-heading-sm mb-2" data-testid={`location-name-${location.id}`}>{location.name}</h3>
                  <p className="luxury-text-small mb-4" data-testid={`location-address-${location.id}`}>{location.address}</p>
                  <div className="flex gap-2">
                    <Button className="luxury-btn-ghost text-sm flex-1" size="sm" data-testid={`button-edit-${location.id}`}>
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button className="luxury-btn-ghost text-sm" size="sm" data-testid={`button-delete-${location.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Favorite Drivers */}
      <div className="luxury-container luxury-animate-fade-in luxury-delay-5">
        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-8">
          <h2 className="luxury-heading-md mb-6">Favorite Drivers</h2>
          <div className="luxury-grid-4">
            {favoriteDrivers.map((driver, index) => (
              <div 
                key={driver.id} 
                className={`luxury-glass-card luxury-hover-glow p-6 text-center luxury-animate-scale-in luxury-delay-${index + 1}`}
                data-testid={`card-driver-${driver.id}`}
              >
                <div className="relative inline-block mb-4">
                  <Avatar className="h-20 w-20 border-3 border-gradient-to-br from-purple-500 to-purple-600 shadow-lg mx-auto" data-testid={`avatar-fav-${driver.id}`}>
                    <AvatarImage src={driver.photo} />
                    <AvatarFallback>{driver.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center">
                    <Heart className="h-3 w-3 text-white fill-white" />
                  </div>
                </div>
                <h3 className="luxury-heading-sm mb-2" data-testid={`driver-name-${driver.id}`}>{driver.name}</h3>
                <div className="luxury-badge-gold mb-3 inline-flex items-center gap-1" data-testid={`driver-rating-${driver.id}`}>
                  <Star className="h-3 w-3 fill-current" />
                  {driver.rating}
                </div>
                <p className="luxury-text-small mb-4" data-testid={`driver-trips-${driver.id}`}>{driver.totalTrips} trips together</p>
                <Button className="luxury-btn-primary w-full text-sm" size="sm" data-testid={`button-book-driver-${driver.id}`}>
                  Book Again
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Book CTA */}
      <div className="luxury-container pb-12 luxury-animate-fade-in luxury-delay-6">
        <div className="luxury-glass-panel p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="luxury-heading-lg luxury-text-gradient mb-4">
              Need a Ride for Your Pet?
            </h2>
            <p className="luxury-text-body mb-8">
              Professional drivers, climate-controlled vehicles, real-time GPS tracking, and premium care for your beloved pets.
            </p>
            <Button
              className="luxury-btn-primary luxury-shadow-xl gap-3 px-8 py-6 text-lg"
              data-testid="button-book-trip"
              onClick={() => setLocation('/pettrek/book')}
            >
              <Car className="h-6 w-6" />
              Book a Trip Now
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
