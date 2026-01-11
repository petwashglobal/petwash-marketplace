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

// Station data - will be loaded from database when stations are live
const mockStations: Array<{
  id: number;
  name: string;
  address: string;
  distance: string;
  status: string;
  availability: string;
  image: string;
  hours: string;
  amenities: string[];
}> = [];

// Stats will show when stations are live
const stats: Array<{ label: string; value: string; icon: any }> = [];

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
    <div className="min-h-screen luxury-dark-mesh">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section - Ultra Luxury Dark Theme */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          {/* Premium Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold tracking-wider text-cyan-300">K9000™ SMART WASH HUBS</span>
          </div>
          
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center luxury-shadow-xl">
              <Droplet className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="luxury-dark-heading-xl mb-4">
            Premium Wash Stations
          </h1>
          <p className="luxury-dark-text-body max-w-2xl mx-auto mb-8">
            Self-service K9000™ organic wash locations. Professional-grade equipment, organic products, convenient locations.
          </p>

          {/* Luxury Dark Search Bar */}
          <div className="max-w-2xl mx-auto luxury-wallet-hero p-5">
            <div className="h-1 -mt-5 -mx-5 mb-5 rounded-t-[28px] bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
              <Input
                type="text"
                placeholder="Search by location or station name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg bg-[rgba(26,24,37,0.6)] border-[rgba(232,230,240,0.1)] text-[#e8e6f0] placeholder:text-[rgba(149,144,168,0.5)] focus:border-cyan-500/40 rounded-xl"
                data-testid="input-search-stations"
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="luxury-dark-grid-4 mb-12 luxury-animate-slide-up luxury-delay-1">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="luxury-dark-card p-6 text-center transition-all duration-300 hover:scale-[1.02]"
                data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-500/15 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="luxury-dark-heading-lg luxury-dark-text-gradient mb-1">
                  {stat.value}
                </div>
                <div className="luxury-dark-text-small">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter Panel - Dark Theme */}
        <div className="luxury-dark-panel p-6 mb-8 luxury-animate-fade-in luxury-delay-2">
          <div className="flex flex-wrap items-center gap-6">
            <h3 className="luxury-dark-heading-sm text-[#e8e6f0]">Filters:</h3>
            
            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={filters.available}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, available: !!checked }))}
                className="border-cyan-500/50 data-[state=checked]:bg-cyan-600"
                data-testid="filter-available"
              />
              <span className="luxury-dark-text-small group-hover:text-cyan-300 transition-colors">Available Now</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={filters.accessible}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, accessible: !!checked }))}
                className="border-cyan-500/50 data-[state=checked]:bg-cyan-600"
                data-testid="filter-accessible"
              />
              <span className="luxury-dark-text-small group-hover:text-cyan-300 transition-colors">Wheelchair Accessible</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={filters.wifi}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, wifi: !!checked }))}
                className="border-cyan-500/50 data-[state=checked]:bg-cyan-600"
                data-testid="filter-wifi"
              />
              <span className="luxury-dark-text-small group-hover:text-cyan-300 transition-colors">Free WiFi</span>
            </label>

            {(filters.available || filters.accessible || filters.wifi) && (
              <button
                onClick={() => setFilters({ available: false, accessible: false, wifi: false })}
                className="luxury-dark-text-small text-cyan-400 hover:text-cyan-300 ml-auto transition-colors"
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
                <span className="luxury-dark-badge luxury-dark-badge-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Available Now
                </span>
              )}
              {filters.accessible && (
                <span className="luxury-dark-badge">
                  <Accessibility className="w-4 h-4" />
                  Accessible
                </span>
              )}
              {filters.wifi && (
                <span className="luxury-dark-badge">
                  <Wifi className="w-4 h-4" />
                  WiFi
                </span>
              )}
            </div>
          )}
        </div>

        {/* Station Map Preview - Dark Theme */}
        <div 
          className="luxury-wallet-hero overflow-hidden mb-12 luxury-animate-scale-in luxury-delay-3"
          data-testid="map-container"
        >
          <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
          <div className="aspect-video bg-gradient-to-br from-cyan-900/30 via-[#1a1825] to-blue-900/30 flex items-center justify-center relative p-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="luxury-dark-heading-md mb-3">Interactive Map</h3>
              <p className="luxury-dark-text-body mb-6">View all stations on an interactive map</p>
              <button
                onClick={() => setLocation("/map")}
                className="luxury-dark-btn-primary px-8 py-3"
                data-testid="button-view-map"
              >
                <Navigation className="w-5 h-5 mr-2 inline" />
                Open Map View
              </button>
            </div>
          </div>
        </div>

        {/* Station Grid - Dark Theme */}
        <div className="mb-12">
          <h2 className="luxury-dark-heading-lg text-[#e8e6f0] mb-6">
            {filteredStations.length} Station{filteredStations.length !== 1 ? 's' : ''} Found
          </h2>
          
          <div className="luxury-dark-grid-3">
            {filteredStations.map((station, index) => (
              <div
                key={station.id}
                className="luxury-dark-card overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] luxury-animate-fade-in"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                onClick={() => setSelectedStation(station)}
                data-testid={`station-card-${station.id}`}
              >
                {/* Gradient Top Bar */}
                <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
                
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
                      <span className="luxury-dark-badge luxury-dark-badge-success">
                        <CheckCircle2 className="w-4 h-4" />
                        Open
                      </span>
                    )}
                    {station.status === "busy" && (
                      <span className="luxury-dark-badge-gold">
                        <Users className="w-4 h-4" />
                        Busy
                      </span>
                    )}
                    {station.status === "closed" && (
                      <span className="luxury-dark-badge">
                        <XCircle className="w-4 h-4" />
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Station Name */}
                  <h3 className="luxury-dark-heading-md text-[#e8e6f0] mb-2">{station.name}</h3>
                  
                  {/* Address */}
                  <p className="luxury-dark-text-small mb-3 flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                    {station.address}
                  </p>

                  {/* Distance */}
                  <p className="luxury-dark-text-gradient font-semibold mb-3 text-cyan-300">
                    {station.distance} away
                  </p>

                  {/* Availability */}
                  <p className="luxury-dark-text-small mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    {station.availability} • {station.hours}
                  </p>

                  {/* Amenities */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {station.amenities.slice(0, 4).map((amenity) => {
                      const Icon = amenityIcons[amenity];
                      return (
                        <div
                          key={amenity}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/15 flex items-center justify-center"
                          title={amenityLabels[amenity]}
                        >
                          <Icon className="w-4 h-4 text-cyan-400" />
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
                      className="luxury-dark-btn-primary flex-1 py-2.5"
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
                      className="luxury-dark-btn-ghost flex-1 py-2.5 border border-[rgba(232,230,240,0.1)]"
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

      {/* Station Details Modal - Dark Theme */}
      <Dialog open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <DialogContent className="bg-[#1a1825] border border-[rgba(232,230,240,0.1)] text-[#e8e6f0] max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedStation && (
            <>
              <DialogHeader>
                <DialogTitle className="luxury-dark-heading-lg text-[#e8e6f0] mb-4">
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
                  <h4 className="luxury-dark-heading-sm text-[#e8e6f0] mb-2">Location</h4>
                  <p className="luxury-dark-text-body flex items-start gap-2">
                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-cyan-400" />
                    {selectedStation.address}
                  </p>
                  <p className="text-cyan-300 font-semibold mt-2 ml-7">
                    {selectedStation.distance} from your location
                  </p>
                </div>

                {/* Hours */}
                <div className="luxury-dark-surface p-4 rounded-xl">
                  <h4 className="luxury-dark-heading-sm text-[#e8e6f0] mb-2">Operating Hours</h4>
                  <p className="luxury-dark-text-body flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    {selectedStation.hours}
                  </p>
                </div>

                {/* Status */}
                <div className="luxury-dark-surface p-4 rounded-xl">
                  <h4 className="luxury-dark-heading-sm text-[#e8e6f0] mb-2">Current Status</h4>
                  <div className="flex items-center gap-3">
                    {selectedStation.status === "open" && (
                      <span className="luxury-dark-badge luxury-dark-badge-success">
                        <CheckCircle2 className="w-4 h-4" />
                        Open Now
                      </span>
                    )}
                    {selectedStation.status === "busy" && (
                      <span className="luxury-dark-badge-gold">
                        <Users className="w-4 h-4" />
                        Busy
                      </span>
                    )}
                    {selectedStation.status === "closed" && (
                      <span className="luxury-dark-badge">
                        <XCircle className="w-4 h-4" />
                        Temporarily Closed
                      </span>
                    )}
                    <span className="luxury-dark-text-small">{selectedStation.availability}</span>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="luxury-dark-heading-sm text-[#e8e6f0] mb-4">Amenities</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedStation.amenities.map((amenity) => {
                      const Icon = amenityIcons[amenity];
                      return (
                        <div
                          key={amenity}
                          className="flex items-center gap-3 luxury-dark-surface p-3 rounded-xl"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/15 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-cyan-400" />
                          </div>
                          <span className="luxury-dark-text-small">{amenityLabels[amenity]}</span>
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
                    className="luxury-dark-btn-primary flex-1 py-3"
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
                    className="luxury-dark-btn-ghost flex-1 py-3 border border-[rgba(232,230,240,0.15)]"
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
