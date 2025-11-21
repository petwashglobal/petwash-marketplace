import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Star, MapPin, Calendar, Shield, Home } from "lucide-react";
import { useLocation } from "wouter";

interface Sitter {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  yearsOfExperience: number;
  pricePerDayCents: number;
  profilePictureUrl: string | null;
  rating: string;
  totalBookings: number;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export default function BrowseSitters() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState({
    location: "",
    minRating: 0,
    maxPrice: 1000,
  });

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sitter-suite/sitters", filters],
  });

  const sitters = data || [];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content">
          <div className="luxury-services-badge luxury-animate-fade-in">
            <Home className="h-4 w-4" />
            Premium Pet Sitting
          </div>
          <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
            The Sitter Suite™
          </h1>
          <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
            Premium pet sitting • Trusted professionals • Luxury care
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filters */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 mb-8 luxury-animate-fade-in luxury-delay-3">
          <div className="luxury-grid-3">
            <div>
              <label className="luxury-text-small font-semibold mb-2 block" style={{ color: '#667eea' }}>📍 Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5" style={{ color: '#667eea' }} />
                <Input
                  placeholder="Enter city or zip code"
                  className="pl-10 bg-white/50 dark:bg-gray-900/50"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  data-testid="input-location"
                />
              </div>
            </div>
            <div>
              <label className="luxury-text-small font-semibold mb-2 block" style={{ color: '#667eea' }}>⭐ Min Rating</label>
              <select
                className="w-full p-2.5 border rounded-lg bg-white/50 dark:bg-gray-900/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                value={filters.minRating}
                onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
                data-testid="select-rating"
              >
                <option value="0">Any rating</option>
                <option value="3">3+ stars</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </select>
            </div>
            <div>
              <label className="luxury-text-small font-semibold mb-2 block" style={{ color: '#667eea' }}>💰 Max Price (₪/day)</label>
              <Input
                type="number"
                className="bg-white/50 dark:bg-gray-900/50"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                data-testid="input-max-price"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="luxury-spinner mx-auto"></div>
            <p className="mt-4 luxury-text-body">Finding amazing sitters...</p>
          </div>
        ) : sitters.length === 0 ? (
          <div className="luxury-glass-card luxury-shadow-xl p-12 text-center">
            <Home className="h-16 w-16 mx-auto mb-6" style={{ color: '#667eea' }} />
            <p className="luxury-heading-md">No sitters found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="luxury-grid-3">
            {sitters.map((sitter, index) => {
              const ratingNum = parseFloat(sitter.rating);
              const priceInShekels = sitter.pricePerDayCents / 100;
              
              return (
                <div
                  key={sitter.id}
                  onClick={() => setLocation(`/sitter-suite/sitters/${sitter.id}`)}
                  className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl cursor-pointer overflow-hidden luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
                  data-testid={`card-sitter-${sitter.id}`}
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-purple-200 via-pink-200 to-purple-300 relative overflow-hidden">
                    {sitter.profilePictureUrl ? (
                      <img
                        src={sitter.profilePictureUrl}
                        alt={`${sitter.firstName} ${sitter.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-7xl">
                        🐾
                      </div>
                    )}
                    {sitter.isVerified && (
                      <div className="absolute top-3 right-3 luxury-badge-success flex items-center gap-1 shadow-lg backdrop-blur-sm">
                        <Shield className="h-4 w-4" />
                        Verified
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <div className="luxury-badge-gold inline-flex items-center gap-1">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-white font-bold">{ratingNum.toFixed(1)}</span>
                        <span className="text-white/90 text-sm">({sitter.totalBookings} stays)</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="luxury-heading-sm mb-2" data-testid={`text-name-${sitter.id}`}>
                      {sitter.firstName} {sitter.lastName}
                    </h3>

                    <div className="flex items-center gap-2 luxury-text-small mb-3">
                      <MapPin className="h-4 w-4" style={{ color: '#667eea' }} />
                      <span>{sitter.city}</span>
                    </div>

                    <div className="flex items-center gap-2 luxury-text-small mb-4">
                      <Calendar className="h-4 w-4" style={{ color: '#667eea' }} />
                      <span>{sitter.yearsOfExperience} years experience</span>
                    </div>

                    <p className="luxury-text-small mb-6 line-clamp-3">{sitter.bio}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <div className="luxury-heading-lg luxury-text-gradient">
                          ₪{priceInShekels}
                        </div>
                        <div className="luxury-text-small">per day</div>
                      </div>
                      <button
                        className="luxury-btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/sitter-suite/sitters/${sitter.id}`);
                        }}
                        data-testid={`button-book-${sitter.id}`}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
