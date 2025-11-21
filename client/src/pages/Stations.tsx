import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Droplet, 
  Sparkles, 
  Search,
  CheckCircle2,
  XCircle,
  Users,
  Wifi,
  CreditCard,
  Accessibility,
  Camera,
  Coffee,
  X
} from "lucide-react";

// Mock station data
const mockStations = [
  {
    id: 1,
    name: "Tel Aviv Marina Station",
    address: "34 HaYarkon St, Tel Aviv",
    distance: "1.2 km",
    status: "open",
    availability: "Available",
    image: "/gallery/IMG_8435_1761100129902.jpeg",
    hours: "24/7",
    amenities: ["wifi", "payment", "camera", "accessible"]
  },
  {
    id: 2,
    name: "Ramat Aviv Mall",
    address: "40 Einstein St, Tel Aviv",
    distance: "2.8 km",
    status: "busy",
    availability: "2 of 3 available",
    image: "/gallery/IMG_8664_1761100129901.jpeg",
    hours: "24/7",
    amenities: ["wifi", "payment", "camera", "accessible", "cafe"]
  },
  {
    id: 3,
    name: "Herzliya Station",
    address: "Arena Mall, Herzliya",
    distance: "5.4 km",
    status: "open",
    availability: "Available",
    image: "/gallery/IMG_8665_1761100129901.jpeg",
    hours: "24/7",
    amenities: ["wifi", "payment", "accessible"]
  },
  {
    id: 4,
    name: "Dizengoff Center",
    address: "50 Dizengoff St, Tel Aviv",
    distance: "3.1 km",
    status: "open",
    availability: "Available",
    image: "/gallery/IMG_8666_1761100129901.jpeg",
    hours: "24/7",
    amenities: ["wifi", "payment", "camera", "accessible", "cafe"]
  },
  {
    id: 5,
    name: "Azrieli Mall",
    address: "132 Menachem Begin Rd, Tel Aviv",
    distance: "4.5 km",
    status: "closed",
    availability: "Maintenance",
    image: "/gallery/IMG_8667_1761100129901.jpeg",
    hours: "Reopens 6:00 AM",
    amenities: ["wifi", "payment", "camera", "accessible"]
  },
  {
    id: 6,
    name: "Raanana Park Station",
    address: "Park HaYarkon, Raanana",
    distance: "8.2 km",
    status: "open",
    availability: "Available",
    image: "/gallery/IMG_8668_1761100129901.jpeg",
    hours: "24/7",
    amenities: ["wifi", "payment", "accessible"]
  }
];

const stats = [
  { label: "Active Stations", value: "47", icon: MapPin },
  { label: "Cities Covered", value: "12", icon: Navigation },
  { label: "Monthly Washes", value: "8.5K", icon: Droplet },
  { label: "Avg. Rating", value: "4.9", icon: Sparkles }
];

const amenityIcons: Record<string, any> = {
  wifi: Wifi,
  payment: CreditCard,
  camera: Camera,
  accessible: Accessibility,
  cafe: Coffee
};

const amenityLabels: Record<string, string> = {
  wifi: "Free WiFi",
  payment: "Contactless Payment",
  camera: "Security Camera",
  accessible: "Wheelchair Accessible",
  cafe: "Nearby Café"
};

export default function Stations() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedStation, setSelectedStation] = useState<typeof mockStations[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    available: false,
    accessible: false,
    wifi: false
  });

  const filteredStations = mockStations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         station.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilters = 
      (!filters.available || station.status === "open") &&
      (!filters.accessible || station.amenities.includes("accessible")) &&
      (!filters.wifi || station.amenities.includes("wifi"));
    return matchesSearch && matchesFilters;
  });

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <Droplet className="w-10 h-10 text-purple-600" />
            <h1 className="luxury-heading-xl">
              Premium Wash Stations
            </h1>
          </div>
          <p className="luxury-text-body max-w-2xl mx-auto mb-8">
            Self-service K9000™ organic wash locations. Professional-grade equipment, organic products, convenient locations.
          </p>

          {/* Luxury Search Bar */}
          <div className="max-w-2xl mx-auto luxury-glass-card luxury-shadow-xl p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by location or station name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg border-0 bg-transparent focus-visible:ring-0"
                data-testid="input-search-stations"
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="luxury-grid-4 mb-12 luxury-animate-slide-up luxury-delay-1">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="luxury-glass-minimal luxury-hover-lift p-6 text-center"
                data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                <div className="luxury-heading-lg luxury-text-gradient mb-1">
                  {stat.value}
                </div>
                <div className="luxury-text-small">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter Panel */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 mb-8 luxury-animate-fade-in luxury-delay-2">
          <div className="flex flex-wrap items-center gap-6">
            <h3 className="luxury-heading-sm">Filters:</h3>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.available}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, available: !!checked }))}
                data-testid="filter-available"
              />
              <span className="luxury-text-small">Available Now</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.accessible}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, accessible: !!checked }))}
                data-testid="filter-accessible"
              />
              <span className="luxury-text-small">Wheelchair Accessible</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.wifi}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, wifi: !!checked }))}
                data-testid="filter-wifi"
              />
              <span className="luxury-text-small">Free WiFi</span>
            </label>

            {(filters.available || filters.accessible || filters.wifi) && (
              <button
                onClick={() => setFilters({ available: false, accessible: false, wifi: false })}
                className="luxury-text-small text-purple-600 hover:text-purple-700 ml-auto"
                data-testid="button-clear-filters"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Active Filters */}
          {(filters.available || filters.accessible || filters.wifi) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {filters.available && (
                <span className="luxury-badge luxury-badge-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Available Now
                </span>
              )}
              {filters.accessible && (
                <span className="luxury-badge">
                  <Accessibility className="w-4 h-4" />
                  Accessible
                </span>
              )}
              {filters.wifi && (
                <span className="luxury-badge">
                  <Wifi className="w-4 h-4" />
                  WiFi
                </span>
              )}
            </div>
          )}
        </div>

        {/* Station Map Preview */}
        <div 
          className="luxury-glass-card luxury-shadow-xl mb-12 overflow-hidden luxury-animate-scale-in luxury-delay-3"
          data-testid="map-container"
        >
          <div className="aspect-video bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center relative">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h3 className="luxury-heading-md mb-2">Interactive Map</h3>
              <p className="luxury-text-small mb-4">View all stations on an interactive map</p>
              <button
                onClick={() => setLocation("/map")}
                className="luxury-btn-primary"
                data-testid="button-view-map"
              >
                <Navigation className="w-5 h-5 mr-2 inline" />
                Open Map View
              </button>
            </div>
          </div>
        </div>

        {/* Station Grid */}
        <div className="mb-12">
          <h2 className="luxury-heading-lg mb-6">
            {filteredStations.length} Station{filteredStations.length !== 1 ? 's' : ''} Found
          </h2>
          
          <div className="luxury-grid-3">
            {filteredStations.map((station, index) => (
              <div
                key={station.id}
                className="luxury-glass-card luxury-hover-glow luxury-shadow-xl overflow-hidden cursor-pointer luxury-animate-fade-in"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                onClick={() => setSelectedStation(station)}
                data-testid={`station-card-${station.id}`}
              >
                {/* Station Photo */}
                <div className="aspect-video overflow-hidden relative">
                  <img
                    src={station.image}
                    alt={station.name}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    {station.status === "open" && (
                      <span className="luxury-badge luxury-badge-success">
                        <CheckCircle2 className="w-4 h-4" />
                        Open
                      </span>
                    )}
                    {station.status === "busy" && (
                      <span className="luxury-badge luxury-badge-gold">
                        <Users className="w-4 h-4" />
                        Busy
                      </span>
                    )}
                    {station.status === "closed" && (
                      <span className="luxury-badge">
                        <XCircle className="w-4 h-4" />
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Station Name */}
                  <h3 className="luxury-heading-md mb-2">{station.name}</h3>
                  
                  {/* Address */}
                  <p className="luxury-text-small mb-3 flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-600" />
                    {station.address}
                  </p>

                  {/* Distance */}
                  <p className="luxury-text-gradient font-semibold mb-3">
                    {station.distance} away
                  </p>

                  {/* Availability */}
                  <p className="luxury-text-small mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    {station.availability} • {station.hours}
                  </p>

                  {/* Amenities */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {station.amenities.slice(0, 4).map((amenity) => {
                      const Icon = amenityIcons[amenity];
                      return (
                        <div
                          key={amenity}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center"
                          title={amenityLabels[amenity]}
                        >
                          <Icon className="w-4 h-4 text-purple-600" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/map?station=${station.id}`);
                      }}
                      className="luxury-btn-primary flex-1"
                      data-testid={`button-directions-${station.id}`}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Directions
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/booking?station=${station.id}`);
                      }}
                      className="luxury-btn-secondary flex-1"
                      data-testid={`button-book-${station.id}`}
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Station Details Modal */}
      <Dialog open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <DialogContent className="luxury-glass-card luxury-shadow-xl max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedStation && (
            <>
              <DialogHeader>
                <DialogTitle className="luxury-heading-lg mb-4">
                  {selectedStation.name}
                </DialogTitle>
              </DialogHeader>

              {/* Gallery */}
              <div className="aspect-video overflow-hidden rounded-2xl mb-6">
                <img
                  src={selectedStation.image}
                  alt={selectedStation.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details */}
              <div className="space-y-6">
                {/* Location */}
                <div>
                  <h4 className="luxury-heading-sm mb-2">Location</h4>
                  <p className="luxury-text-body flex items-start gap-2">
                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-purple-600" />
                    {selectedStation.address}
                  </p>
                  <p className="luxury-text-gradient font-semibold mt-2 ml-7">
                    {selectedStation.distance} from your location
                  </p>
                </div>

                {/* Hours */}
                <div className="luxury-glass-minimal p-4 rounded-xl">
                  <h4 className="luxury-heading-sm mb-2">Operating Hours</h4>
                  <p className="luxury-text-body flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    {selectedStation.hours}
                  </p>
                </div>

                {/* Status */}
                <div className="luxury-glass-minimal p-4 rounded-xl">
                  <h4 className="luxury-heading-sm mb-2">Current Status</h4>
                  <div className="flex items-center gap-3">
                    {selectedStation.status === "open" && (
                      <span className="luxury-badge luxury-badge-success">
                        <CheckCircle2 className="w-4 h-4" />
                        Open Now
                      </span>
                    )}
                    {selectedStation.status === "busy" && (
                      <span className="luxury-badge luxury-badge-gold">
                        <Users className="w-4 h-4" />
                        Busy
                      </span>
                    )}
                    {selectedStation.status === "closed" && (
                      <span className="luxury-badge">
                        <XCircle className="w-4 h-4" />
                        Temporarily Closed
                      </span>
                    )}
                    <span className="luxury-text-small">{selectedStation.availability}</span>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="luxury-heading-sm mb-4">Amenities</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedStation.amenities.map((amenity) => {
                      const Icon = amenityIcons[amenity];
                      return (
                        <div
                          key={amenity}
                          className="flex items-center gap-3 luxury-glass-minimal p-3 rounded-xl"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-purple-600" />
                          </div>
                          <span className="luxury-text-small">{amenityLabels[amenity]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      setLocation(`/map?station=${selectedStation.id}`);
                      setSelectedStation(null);
                    }}
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    data-testid="modal-button-directions"
                  >
                    <Navigation className="w-5 h-5 mr-2" />
                    Get Directions
                  </button>
                  <button
                    onClick={() => {
                      setLocation(`/booking?station=${selectedStation.id}`);
                      setSelectedStation(null);
                    }}
                    className="luxury-btn-secondary flex-1"
                    data-testid="modal-button-book"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
