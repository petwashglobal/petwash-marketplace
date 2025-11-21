import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Star, 
  MapPin, 
  Car, 
  DollarSign, 
  Zap, 
  Search,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Check,
  Award,
  TrendingUp,
  Users,
  X,
  SlidersHorizontal
} from "lucide-react";
import { useLocation } from "wouter";

interface Driver {
  id: string;
  name: string;
  bio: string;
  photoUrl: string;
  serviceArea: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  pricePerKm: number;
  averageRating: number;
  totalTrips: number;
  yearsExperience: number;
  currentlyAvailable: boolean;
  specialFeatures: string[];
  languages?: string[];
  verified?: boolean;
  featured?: boolean;
}

export default function BrowseDrivers() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('rating');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    location: "",
    vehicleType: "",
    minRating: 0,
    availableNow: false,
    priceRange: [0, 100],
  });

  const { data, isLoading } = useQuery<{ drivers: Driver[] }>({
    queryKey: ["/api/providers/drivers", filters, sortBy],
  });

  const drivers = data?.drivers || [];
  const featuredDrivers = drivers.filter(d => d.featured).slice(0, 4);
  const regularDrivers = drivers.filter(d => !d.featured);
  
  // Pagination
  const itemsPerPage = 9;
  const totalPages = Math.ceil(regularDrivers.length / itemsPerPage);
  const paginatedDrivers = regularDrivers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const totalDrivers = drivers.length;
  const avgRating = drivers.length > 0 
    ? (drivers.reduce((acc, d) => acc + d.averageRating, 0) / drivers.length).toFixed(1)
    : "0.0";
  const totalTrips = drivers.reduce((acc, d) => acc + d.totalTrips, 0);

  const activeFilters = [
    filters.location && { label: filters.location, key: 'location' },
    filters.vehicleType && { label: filters.vehicleType, key: 'vehicleType' },
    filters.minRating > 0 && { label: `${filters.minRating}+ stars`, key: 'minRating' },
    filters.availableNow && { label: 'Available Now', key: 'availableNow' },
  ].filter(Boolean) as { label: string; key: string }[];

  const clearFilter = (key: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: key === 'availableNow' ? false : key === 'minRating' ? 0 : ''
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      location: "",
      vehicleType: "",
      minRating: 0,
      availableNow: false,
      priceRange: [0, 100],
    });
  };

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Hero Section */}
      <div className="luxury-container py-12 luxury-animate-fade-in">
        <div className="text-center max-w-4xl mx-auto mb-8">
          <div className="luxury-badge mb-4 inline-flex items-center gap-2">
            <Car className="h-4 w-4" />
            Premium Pet Transport
          </div>
          <h1 className="luxury-heading-xl mb-4">
            Book Safe Pet Transport
          </h1>
          <p className="luxury-text-body mb-8">
            Professional drivers with climate-controlled vehicles for your pet's comfort and safety
          </p>
          
          {/* Prominent Search Bar */}
          <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-slide-up luxury-delay-1">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by location or service area..."
                className="pl-12 pr-4 py-6 text-lg border-0 bg-white/50 focus:bg-white transition-all"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                data-testid="input-search-location"
              />
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="luxury-glass-panel luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="luxury-heading-lg luxury-text-gradient mb-1">
                {totalDrivers}+
              </div>
              <div className="luxury-text-small">Verified Drivers</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center">
                <Star className="h-8 w-8 text-amber-600" />
              </div>
              <div className="luxury-heading-lg luxury-text-gradient mb-1">
                {avgRating}
              </div>
              <div className="luxury-text-small">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <div className="luxury-heading-lg luxury-text-gradient mb-1">
                {totalTrips.toLocaleString()}+
              </div>
              <div className="luxury-text-small">Trips Completed</div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="mb-8 luxury-animate-slide-up luxury-delay-3">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="luxury-btn-ghost flex items-center gap-2"
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            
            {activeFilters.length > 0 && (
              <button
                onClick={clearAllFilters}
                className="luxury-text-small text-purple-600 hover:text-purple-700"
                data-testid="button-clear-all-filters"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeFilters.map((filter) => (
                <div key={filter.key} className="luxury-badge flex items-center gap-2">
                  {filter.label}
                  <button
                    onClick={() => clearFilter(filter.key)}
                    className="hover:bg-purple-100 rounded-full p-0.5"
                    data-testid={`button-remove-filter-${filter.key}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showFilters && (
            <div className="luxury-glass-panel luxury-shadow-md p-6">
              <h3 className="luxury-heading-sm mb-6">Filter Drivers</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="luxury-text-small block mb-3 font-semibold">Service Area</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Enter location"
                      className="pl-10 border-purple-200 focus:border-purple-400"
                      value={filters.location}
                      onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                      data-testid="input-location"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="luxury-text-small block mb-3 font-semibold">Vehicle Type</label>
                  <div className="flex flex-wrap gap-2">
                    {['sedan', 'suv', 'van'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilters({ ...filters, vehicleType: filters.vehicleType === type ? '' : type })}
                        className={filters.vehicleType === type ? 'luxury-badge-gold' : 'luxury-badge'}
                        data-testid={`button-vehicle-${type}`}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="luxury-text-small block mb-3 font-semibold">Minimum Rating</label>
                  <div className="flex gap-2">
                    {[3, 4, 4.5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setFilters({ ...filters, minRating: filters.minRating === rating ? 0 : rating })}
                        className={filters.minRating === rating ? 'luxury-badge-gold' : 'luxury-badge'}
                        data-testid={`button-rating-${rating}`}
                      >
                        <Star className="h-3 w-3 inline" />
                        {rating}+
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="luxury-text-small block mb-3 font-semibold">Availability</label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.availableNow}
                      onChange={(e) => setFilters({ ...filters, availableNow: e.target.checked })}
                      className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      data-testid="checkbox-available-now"
                    />
                    <span className="luxury-text-small font-medium">Available Now</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6 pt-6 border-t border-purple-100">
                <button className="luxury-btn-primary flex-1" data-testid="button-apply-filters">
                  Apply Filters
                </button>
                <button 
                  onClick={clearAllFilters}
                  className="luxury-btn-secondary flex-1" 
                  data-testid="button-clear-filters"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sort & View Options */}
        <div className="luxury-glass-minimal p-4 mb-8 flex items-center justify-between luxury-animate-fade-in luxury-delay-4">
          <div className="luxury-text-small">
            Showing <span className="font-semibold">{paginatedDrivers.length}</span> of <span className="font-semibold">{regularDrivers.length}</span> drivers
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="luxury-text-small font-medium">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-lg border border-purple-200 bg-white/80 luxury-text-small focus:outline-none focus:border-purple-400"
                data-testid="select-sort"
              >
                <option value="rating">Highest Rating</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="experience">Most Experience</option>
                <option value="trips">Most Trips</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 border-l border-purple-200 pl-4">
              <button
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'luxury-btn-primary p-2' : 'luxury-btn-ghost p-2'}
                data-testid="button-view-grid"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'luxury-btn-primary p-2' : 'luxury-btn-ghost p-2'}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Featured Drivers Section */}
        {featuredDrivers.length > 0 && (
          <div className="mb-12 luxury-animate-slide-up luxury-delay-5">
            <div className="luxury-glass-card luxury-shadow-xl luxury-bg-soft p-8">
              <div className="flex items-center gap-3 mb-6">
                <Award className="h-6 w-6 text-amber-600" />
                <h2 className="luxury-heading-md">Top Rated Drivers</h2>
              </div>
              
              <div className="luxury-grid-4">
                {featuredDrivers.map((driver, idx) => (
                  <div
                    key={driver.id}
                    className="luxury-glass-card luxury-shadow-md p-4 cursor-pointer luxury-hover-lift luxury-animate-scale-in"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                    onClick={() => setLocation(`/pettrek/book?driverId=${driver.id}`)}
                    data-testid={`card-featured-${driver.id}`}
                  >
                    <div className="relative mb-4">
                      <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-4 border-gradient-to-r from-amber-400 to-yellow-500 p-1 bg-gradient-to-r from-amber-400 to-yellow-500">
                        <div className="w-full h-full rounded-full overflow-hidden bg-white">
                          {driver.photoUrl ? (
                            <img
                              src={driver.photoUrl}
                              alt={driver.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-purple-100 to-indigo-100">
                              🚗
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="luxury-badge-gold absolute -top-2 left-1/2 -translate-x-1/2 text-xs px-2 py-1">
                        <Star className="h-3 w-3 inline" /> Top Rated
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <h4 className="font-semibold mb-1">{driver.name}</h4>
                      <div className="luxury-badge-gold text-xs mb-2 inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400" />
                        {driver.averageRating.toFixed(1)}
                      </div>
                      <p className="luxury-text-small">{driver.totalTrips} trips</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="luxury-spinner mx-auto"></div>
            <p className="mt-4 luxury-text-body">Finding available drivers...</p>
          </div>
        ) : paginatedDrivers.length === 0 ? (
          <div className="luxury-glass-card luxury-shadow-md p-12 text-center">
            <p className="luxury-text-body">No drivers found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className={viewMode === 'grid' ? 'luxury-grid-3' : 'space-y-4'}>
              {paginatedDrivers.map((driver, idx) => (
                <div
                  key={driver.id}
                  className="luxury-glass-card luxury-hover-glow luxury-shadow-xl overflow-hidden cursor-pointer luxury-animate-scale-in"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                  onClick={() => setLocation(`/pettrek/book?driverId=${driver.id}`)}
                  data-testid={`card-driver-${driver.id}`}
                >
                  <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 relative overflow-hidden">
                    {driver.photoUrl ? (
                      <img
                        src={driver.photoUrl}
                        alt={driver.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        🚗
                      </div>
                    )}
                    {driver.currentlyAvailable && (
                      <div className="luxury-badge-success absolute top-3 right-3 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Available Now
                      </div>
                    )}
                    {driver.verified && (
                      <div className="luxury-badge-gold absolute top-3 left-3 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Verified
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="luxury-heading-md mb-1" data-testid={`text-name-${driver.id}`}>
                          {driver.name}
                        </h3>
                        <p className="luxury-text-small">
                          {driver.yearsExperience} years experience
                        </p>
                      </div>
                      <div className="luxury-badge-gold flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400" />
                        <span className="font-semibold">{driver.averageRating.toFixed(1)}</span>
                        <span className="luxury-text-small ml-1">({driver.totalTrips})</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 luxury-text-body">
                        <MapPin className="h-4 w-4 text-purple-600" />
                        <span>{driver.serviceArea}</span>
                      </div>

                      <div className="flex items-center gap-2 luxury-text-body">
                        <Car className="h-4 w-4 text-purple-600" />
                        <span>
                          {driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleType})
                        </span>
                      </div>
                    </div>

                    <p className="luxury-text-body mb-4 line-clamp-2">{driver.bio}</p>

                    {/* Languages */}
                    {driver.languages && driver.languages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {driver.languages.map((lang, idx) => (
                          <span key={idx} className="luxury-badge text-xs">
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Specialties */}
                    {driver.specialFeatures && driver.specialFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {driver.specialFeatures.slice(0, 3).map((feature, idx) => (
                          <span
                            key={idx}
                            className="luxury-badge text-xs"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="luxury-divider"></div>

                    <div className="flex items-center justify-between pt-4">
                      <div>
                        <div className="luxury-text-small mb-1">From</div>
                        <div className="luxury-heading-lg luxury-text-gradient">
                          ₪{driver.pricePerKm}
                          <span className="luxury-text-small text-gray-500">/km</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="luxury-btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/pettrek/driver/${driver.id}`);
                          }}
                          data-testid={`button-view-profile-${driver.id}`}
                        >
                          View Profile
                        </button>
                        <button
                          className="luxury-btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/pettrek/book?driverId=${driver.id}`);
                          }}
                          data-testid={`button-book-${driver.id}`}
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="luxury-glass-minimal p-4 mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={currentPage === 1 ? 'luxury-btn-ghost opacity-50 cursor-not-allowed' : 'luxury-btn-ghost'}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={page === currentPage ? 'luxury-badge-gold px-4 py-2' : 'luxury-btn-ghost px-4 py-2'}
                    data-testid={`button-page-${page}`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'luxury-btn-ghost opacity-50 cursor-not-allowed' : 'luxury-btn-ghost'}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
