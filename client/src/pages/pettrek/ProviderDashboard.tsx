import { useState } from "react";
import { useLanguage } from "@/lib/languageStore";
import { 
  Car, 
  DollarSign, 
  TrendingUp, 
  Star, 
  MapPin, 
  Clock, 
  Phone,
  MessageSquare,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Navigation,
  Users,
  Award,
  BarChart3,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function ProviderDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  // Mock data
  const stats = {
    activeDrivers: 12,
    tripsToday: 28,
    revenue: 4250,
    avgRating: 4.8
  };

  const activeTrips = [
    {
      id: 1,
      driver: "David Cohen",
      pet: "Max (Golden Retriever)",
      from: "Tel Aviv Central",
      to: "Ramat Aviv",
      eta: "12 min",
      status: "in_progress",
      price: 85
    },
    {
      id: 2,
      driver: "Sarah Levi",
      pet: "Luna (Persian Cat)",
      from: "Herzliya Marina",
      to: "Kfar Saba",
      eta: "8 min",
      status: "in_progress",
      price: 120
    }
  ];

  const drivers = [
    {
      id: 1,
      name: "David Cohen",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
      status: "online",
      tripsToday: 8,
      rating: 4.9,
      earnings: 680
    },
    {
      id: 2,
      name: "Sarah Levi",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      status: "online",
      tripsToday: 6,
      rating: 4.8,
      earnings: 520
    },
    {
      id: 3,
      name: "Michael Ben David",
      photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
      status: "offline",
      tripsToday: 5,
      rating: 4.7,
      earnings: 425
    }
  ];

  const tripRequests = [
    {
      id: 1,
      pet: "Charlie (Beagle)",
      owner: "Rachel Green",
      from: "Dizengoff Center",
      to: "Gordon Beach Vet",
      distance: "3.2 km",
      price: 95,
      urgent: false
    },
    {
      id: 2,
      pet: "Bella (Husky)",
      owner: "Tom Anderson",
      from: "Ramat Gan Park",
      to: "Airport Area",
      distance: "12.5 km",
      price: 180,
      urgent: true
    }
  ];

  const performanceData = [
    { driver: "David Cohen", trips: 142, rating: 4.9, revenue: 12400, rank: 1 },
    { driver: "Sarah Levi", trips: 128, rating: 4.8, revenue: 11200, rank: 2 },
    { driver: "Michael Ben David", trips: 115, rating: 4.7, revenue: 10100, rank: 3 },
    { driver: "Anna Rosenberg", trips: 98, rating: 4.6, revenue: 8600, rank: 4 }
  ];

  const fleetStatus = [
    { status: "Active", count: 12, color: "text-green-600" },
    { status: "Available", count: 5, color: "text-blue-600" },
    { status: "On Break", count: 3, color: "text-yellow-600" },
    { status: "Offline", count: 8, color: "text-gray-600" }
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh p-6" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="luxury-animate-fade-in">
          <h1 className="luxury-heading-lg luxury-text-gradient mb-2">
            {isHebrew ? 'מרכז בקרה לספקים' : 'Provider Command Center'}
          </h1>
          <p className="luxury-text-body">
            {isHebrew ? 'נהל את צי הנהגים והנסיעות שלך בזמן אמת' : 'Manage your driver fleet and trips in real-time'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="luxury-grid-4 luxury-animate-slide-up luxury-delay-1">
          {/* Active Drivers */}
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="luxury-text-small">
                {isHebrew ? 'נהגים פעילים' : 'Active Drivers'}
              </span>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="stat-active-drivers">
              {stats.activeDrivers}
            </div>
          </div>

          {/* Trips Today */}
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="luxury-text-small">
                {isHebrew ? 'נסיעות היום' : 'Trips Today'}
              </span>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <Car className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="stat-trips-today">
              {stats.tripsToday}
            </div>
          </div>

          {/* Revenue */}
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="luxury-text-small">
                {isHebrew ? 'הכנסות היום' : 'Revenue Today'}
              </span>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="stat-revenue">
              ₪{stats.revenue.toLocaleString()}
            </div>
          </div>

          {/* Avg Rating */}
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="luxury-text-small">
                {isHebrew ? 'דירוג ממוצע' : 'Avg Rating'}
              </span>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="stat-avg-rating">
              {stats.avgRating}
            </div>
          </div>
        </div>

        {/* Active Trips Monitor */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-slide-up luxury-delay-2">
          <h2 className="luxury-heading-md mb-6">
            {isHebrew ? 'מוניטור נסיעות פעילות' : 'Active Trips Monitor'}
          </h2>
          
          {/* Map View Placeholder */}
          <div className="luxury-glass-minimal p-8 mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-purple-100">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-purple-600" />
                <p className="luxury-text-body text-purple-900">
                  {isHebrew ? 'מפה בזמן אמת - מיקומי נהגים' : 'Real-Time Map - Driver Locations'}
                </p>
              </div>
            </div>
          </div>

          {/* Trip List */}
          <div className="space-y-4">
            {activeTrips.map((trip, index) => (
              <div 
                key={trip.id} 
                className={`luxury-glass-minimal p-5 rounded-xl luxury-hover-lift luxury-delay-${index + 3}`}
                data-testid={`active-trip-${trip.id}`}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="luxury-heading-sm mb-1">{trip.driver}</h3>
                    <p className="luxury-text-small text-gray-600 mb-2">{trip.pet}</p>
                    <div className="flex items-center gap-2 luxury-text-small text-gray-700">
                      <Navigation className="w-4 h-4" />
                      <span>{trip.from}</span>
                      <span>→</span>
                      <span>{trip.to}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="luxury-badge-success mb-1">
                        {isHebrew ? 'בדרך' : 'In Progress'}
                      </div>
                      <div className="flex items-center gap-1 luxury-text-gradient font-semibold">
                        <Clock className="w-4 h-4" />
                        <span>{trip.eta}</span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="luxury-text-small mb-1">
                        {isHebrew ? 'מחיר' : 'Price'}
                      </p>
                      <p className="luxury-heading-sm luxury-text-gradient">
                        ₪{trip.price}
                      </p>
                    </div>
                    
                    <Button 
                      className="luxury-btn-secondary"
                      data-testid={`view-trip-${trip.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {isHebrew ? 'צפה' : 'View'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Management */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-slide-up luxury-delay-4">
          <h2 className="luxury-heading-md mb-6">
            {isHebrew ? 'ניהול נהגים' : 'Driver Management'}
          </h2>
          
          <div className="luxury-grid-3">
            {drivers.map((driver, index) => (
              <div 
                key={driver.id} 
                className={`luxury-glass-minimal luxury-hover-lift p-5 rounded-xl luxury-delay-${index + 5}`}
                data-testid={`driver-card-${driver.id}`}
              >
                {/* Driver Photo with Gradient Border */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 p-[3px]">
                      <div className="w-full h-full rounded-full bg-white"></div>
                    </div>
                    <img 
                      src={driver.photo} 
                      alt={driver.name}
                      className="w-16 h-16 rounded-full relative z-10"
                    />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm mb-1">{driver.name}</h3>
                    {driver.status === 'online' ? (
                      <span className="luxury-badge-success">
                        {isHebrew ? 'מחובר' : 'Online'}
                      </span>
                    ) : (
                      <span className="luxury-badge bg-white text-gray-600 border-gray-200">
                        {isHebrew ? 'לא מחובר' : 'Offline'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Driver Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <p className="luxury-text-small text-gray-600">
                      {isHebrew ? 'נסיעות' : 'Trips'}
                    </p>
                    <p className="luxury-heading-sm luxury-text-gradient">
                      {driver.tripsToday}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="luxury-text-small text-gray-600">
                      {isHebrew ? 'דירוג' : 'Rating'}
                    </p>
                    <span className="luxury-badge-gold">
                      <Star className="w-3 h-3" />
                      {driver.rating}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="luxury-text-small text-gray-600">
                      {isHebrew ? 'הכנסות' : 'Earnings'}
                    </p>
                    <p className="luxury-heading-sm luxury-text-gradient">
                      ₪{driver.earnings}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    className="luxury-btn-ghost flex-1" 
                    size="sm"
                    data-testid={`view-driver-${driver.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {isHebrew ? 'צפה' : 'View'}
                  </Button>
                  <Button 
                    className="luxury-btn-ghost flex-1" 
                    size="sm"
                    data-testid={`edit-driver-${driver.id}`}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {isHebrew ? 'ערוך' : 'Edit'}
                  </Button>
                  <Button 
                    className="luxury-btn-ghost flex-1" 
                    size="sm"
                    data-testid={`message-driver-${driver.id}`}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    {isHebrew ? 'הודעה' : 'Message'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trip Requests Panel */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-slide-up luxury-delay-7">
          <h2 className="luxury-heading-md mb-6">
            {isHebrew ? 'בקשות נסיעה חדשות' : 'New Trip Requests'}
          </h2>
          
          <div className="space-y-4">
            {tripRequests.map((request, index) => (
              <div 
                key={request.id} 
                className={`luxury-glass-minimal p-5 rounded-xl ${request.urgent ? 'border-2 border-yellow-400' : ''}`}
                data-testid={`trip-request-${request.id}`}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[250px]">
                    {request.urgent && (
                      <span className="luxury-badge bg-yellow-100 text-yellow-700 border-yellow-300 mb-2 inline-block">
                        {isHebrew ? 'דחוף' : 'Urgent'}
                      </span>
                    )}
                    <h3 className="luxury-heading-sm mb-1">{request.pet}</h3>
                    <p className="luxury-text-small text-gray-600 mb-2">{request.owner}</p>
                    <div className="luxury-text-body text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{request.from}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Navigation className="w-4 h-4" />
                        <span>{request.to}</span>
                      </div>
                    </div>
                    <p className="luxury-text-small text-gray-500">
                      {isHebrew ? 'מרחק' : 'Distance'}: {request.distance}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="luxury-text-small mb-1">
                        {isHebrew ? 'מחיר מוצע' : 'Estimated Price'}
                      </p>
                      <p className="luxury-heading-lg luxury-text-gradient">
                        ₪{request.price}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Select>
                        <SelectTrigger className="w-[180px] luxury-glass-minimal border-purple-200">
                          <SelectValue placeholder={isHebrew ? 'בחר נהג' : 'Assign Driver'} />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.filter(d => d.status === 'online').map(d => (
                            <SelectItem key={d.id} value={d.id.toString()}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="flex gap-2">
                        <Button 
                          className="luxury-btn-primary flex-1"
                          data-testid={`accept-request-${request.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {isHebrew ? 'אשר' : 'Accept'}
                        </Button>
                        <Button 
                          className="luxury-btn-secondary"
                          data-testid={`decline-request-${request.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {isHebrew ? 'דחה' : 'Decline'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-slide-up luxury-delay-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="luxury-heading-md">
              {isHebrew ? 'תרשים הכנסות' : 'Revenue Chart'}
            </h2>
            
            <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <TabsList className="luxury-glass-minimal">
                <TabsTrigger value="week" className="data-[state=active]:luxury-text-gradient">
                  {isHebrew ? 'שבוע' : 'Week'}
                </TabsTrigger>
                <TabsTrigger value="month" className="data-[state=active]:luxury-text-gradient">
                  {isHebrew ? 'חודש' : 'Month'}
                </TabsTrigger>
                <TabsTrigger value="year" className="data-[state=active]:luxury-text-gradient">
                  {isHebrew ? 'שנה' : 'Year'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="luxury-glass-minimal p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-100">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 mx-auto mb-3 text-purple-600" />
                <p className="luxury-text-body text-purple-900">
                  {isHebrew ? 'תרשים הכנסות - תצוגה חזותית' : 'Revenue Chart - Visual Display'}
                </p>
                <p className="luxury-text-small text-purple-700 mt-2">
                  {isHebrew ? 'נתוני הכנסות לתקופה שנבחרה' : 'Revenue data for selected period'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Performance Table */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-slide-up luxury-delay-9">
          <h2 className="luxury-heading-md mb-6">
            {isHebrew ? 'ביצועי נהגים' : 'Driver Performance'}
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-purple-100">
                  <th className="text-left p-3 luxury-heading-sm luxury-text-gradient">
                    {isHebrew ? 'דירוג' : 'Rank'}
                  </th>
                  <th className="text-left p-3 luxury-heading-sm luxury-text-gradient">
                    {isHebrew ? 'נהג' : 'Driver'}
                  </th>
                  <th className="text-left p-3 luxury-heading-sm luxury-text-gradient">
                    {isHebrew ? 'נסיעות' : 'Trips'}
                  </th>
                  <th className="text-left p-3 luxury-heading-sm luxury-text-gradient">
                    {isHebrew ? 'דירוג' : 'Rating'}
                  </th>
                  <th className="text-left p-3 luxury-heading-sm luxury-text-gradient">
                    {isHebrew ? 'הכנסות' : 'Revenue'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((perf, index) => (
                  <tr 
                    key={perf.driver} 
                    className={`luxury-glass-minimal luxury-hover-lift border-b border-gray-100 luxury-delay-${index + 10}`}
                    data-testid={`performance-row-${index}`}
                  >
                    <td className="p-3">
                      {perf.rank <= 3 ? (
                        <span className="luxury-badge-gold">
                          <Award className="w-3 h-3 mr-1" />
                          #{perf.rank}
                        </span>
                      ) : (
                        <span className="luxury-text-body">#{perf.rank}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="luxury-heading-sm">{perf.driver}</span>
                    </td>
                    <td className="p-3">
                      <span className="luxury-text-body">{perf.trips}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="luxury-text-body">{perf.rating}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="luxury-heading-sm luxury-text-gradient">
                        ₪{perf.revenue.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fleet Status */}
        <div className="luxury-grid-4 luxury-animate-slide-up luxury-delay-10">
          {fleetStatus.map((fleet, index) => (
            <div 
              key={fleet.status} 
              className={`luxury-glass-minimal p-5 rounded-xl luxury-delay-${index + 11}`}
              data-testid={`fleet-status-${fleet.status.toLowerCase()}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="luxury-text-small text-gray-600">
                  {fleet.status}
                </span>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                  fleet.status === 'Active' ? 'from-green-400 to-green-600' :
                  fleet.status === 'Available' ? 'from-blue-400 to-blue-600' :
                  fleet.status === 'On Break' ? 'from-yellow-400 to-yellow-600' :
                  'from-gray-400 to-gray-600'
                } flex items-center justify-center`}>
                  <Car className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className={`luxury-heading-lg luxury-text-gradient ${fleet.color}`}>
                {fleet.count}
              </div>
              <p className="luxury-text-small text-gray-500 mt-1">
                {isHebrew ? 'רכבים' : 'Vehicles'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
