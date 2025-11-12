import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, MapPin, Calendar, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { GlassmorphismCard } from "@/components/luxury/GlassmorphismCard";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent mb-3 animate-gradient">
            The Sitter Suite™
          </h1>
          <p className="text-gray-700 text-lg">Premium pet sitting • Trusted professionals • Luxury care</p>
        </div>

        {/* Filters */}
        <GlassmorphismCard className="p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📍 Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-purple-500" />
                <Input
                  placeholder="Enter city or zip code"
                  className="pl-10 bg-white/50 border-purple-200 focus:border-purple-500"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  data-testid="input-location"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">⭐ Min Rating</label>
              <select
                className="w-full p-2.5 border border-pink-200 rounded-lg bg-white/50 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">💰 Max Price (₪/day)</label>
              <Input
                type="number"
                className="bg-white/50 border-amber-200 focus:border-amber-500"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                data-testid="input-max-price"
              />
            </div>
          </div>
        </GlassmorphismCard>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Finding amazing sitters...</p>
          </div>
        ) : sitters.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-600 text-lg">No sitters found. Try adjusting your filters.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sitters.map((sitter) => {
              const ratingNum = parseFloat(sitter.rating);
              const priceInShekels = sitter.pricePerDayCents / 100;
              
              return (
                <GlassmorphismCard
                  key={sitter.id}
                  onClick={() => setLocation(`/sitter-suite/sitters/${sitter.id}`)}
                  className="cursor-pointer transform hover:scale-105 transition-all duration-300"
                  data-testid={`card-sitter-${sitter.id}`}
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-purple-200 via-pink-200 to-amber-200 relative rounded-t-2xl overflow-hidden">
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
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1 shadow-lg backdrop-blur-sm">
                        <Shield className="h-4 w-4" />
                        Verified
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 fill-amber-300 text-amber-300" />
                        <span className="text-white font-bold text-lg">{ratingNum.toFixed(1)}</span>
                        <span className="text-white/90 text-sm">({sitter.totalBookings} stays)</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2" data-testid={`text-name-${sitter.id}`}>
                      {sitter.firstName} {sitter.lastName}
                    </h3>

                    <div className="flex items-center gap-2 text-gray-600 mb-3">
                      <MapPin className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">{sitter.city}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600 mb-4">
                      <Calendar className="h-4 w-4 text-pink-600" />
                      <span className="text-sm">{sitter.yearsOfExperience} years experience</span>
                    </div>

                    <p className="text-gray-700 text-sm mb-6 line-clamp-3 leading-relaxed">{sitter.bio}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent">
                          ₪{priceInShekels}
                        </div>
                        <div className="text-gray-500 text-xs">per day</div>
                      </div>
                      <LuxuryButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/sitter-suite/sitters/${sitter.id}`);
                        }}
                        data-testid={`button-book-${sitter.id}`}
                      >
                        View Profile
                      </LuxuryButton>
                    </div>
                  </div>
                </GlassmorphismCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
