import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, MapPin, Clock, DollarSign, Award } from "lucide-react";
import { useLocation } from "wouter";

interface Walker {
  id: string;
  name: string;
  bio: string;
  photoUrl: string;
  serviceArea: string;
  hourlyRate: number;
  averageRating: number;
  totalWalks: number;
  yearsExperience: number;
  certifications: string[];
  availability: boolean;
}

export default function BrowseWalkers() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState({
    location: "",
    minRating: 0,
    maxPrice: 500,
  });

  const { data, isLoading } = useQuery<{ walkers: Walker[] }>({
    queryKey: ["/api/providers/walkers", filters],
  });

  const walkers = data?.walkers || [];

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent mb-2">
            Find Your Trusted Dog Walker
          </h1>
          <p className="text-gray-600">Professional walkers with real-time GPS tracking</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Service Area</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Enter neighborhood"
                  className="pl-10"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  data-testid="input-location"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Min Rating</label>
              <select
                className="w-full p-2 border rounded-lg"
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
              <label className="block text-sm font-medium mb-2">Max Price (₪/hour)</label>
              <Input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                data-testid="input-max-price"
              />
            </div>
          </div>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Finding amazing walkers...</p>
          </div>
        ) : walkers.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-600 text-lg">No walkers found. Try adjusting your filters.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {walkers.map((walker) => (
              <Card
                key={walker.id}
                className="overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)]"
                onClick={() => setLocation(`/walk-my-pet/book/${walker.id}`)}
                data-testid={`card-walker-${walker.id}`}
              >
                <div className="aspect-video bg-gradient-to-br from-amber-100 to-yellow-100 relative">
                  {walker.photoUrl ? (
                    <img
                      src={walker.photoUrl}
                      alt={walker.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      🦮
                    </div>
                  )}
                  {walker.availability && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Available Today
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2" data-testid={`text-name-${walker.id}`}>
                    {walker.name}
                  </h3>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="ml-1 font-medium">{walker.averageRating.toFixed(1)}</span>
                    </div>
                    <span className="text-gray-500 text-sm">({walker.totalWalks} walks)</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{walker.serviceArea}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 mb-3">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{walker.yearsExperience} years experience</span>
                  </div>

                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">{walker.bio}</p>

                  {walker.certifications && walker.certifications.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">
                      <Award className="h-4 w-4" />
                      <span className="font-medium">Certified Professional</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-amber-600" />
                      <span className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                        ₪{walker.hourlyRate}
                      </span>
                      <span className="text-gray-500 text-sm">/hour</span>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
                      data-testid={`button-book-${walker.id}`}
                    >
                      Book Walk
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
