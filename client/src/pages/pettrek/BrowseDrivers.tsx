import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, MapPin, Car, DollarSign, Zap } from "lucide-react";
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
}

export default function BrowseDrivers() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState({
    location: "",
    vehicleType: "",
    minRating: 0,
    availableNow: false,
  });

  const { data, isLoading } = useQuery<{ drivers: Driver[] }>({
    queryKey: ["/api/providers/drivers", filters],
  });

  const drivers = data?.drivers || [];

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent mb-2">
            Book Safe Pet Transport
          </h1>
          <p className="text-gray-600">Professional drivers with climate-controlled vehicles</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Service Area</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Enter location"
                  className="pl-10"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  data-testid="input-location"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Vehicle Type</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={filters.vehicleType}
                onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}
                data-testid="select-vehicle-type"
              >
                <option value="">Any vehicle</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="van">Van</option>
              </select>
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
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.availableNow}
                  onChange={(e) => setFilters({ ...filters, availableNow: e.target.checked })}
                  className="w-4 h-4"
                  data-testid="checkbox-available-now"
                />
                <span className="text-sm font-medium">Available Now</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Finding available drivers...</p>
          </div>
        ) : drivers.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-600 text-lg">No drivers found. Try adjusting your filters.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((driver) => (
              <Card
                key={driver.id}
                className="overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)]"
                onClick={() => setLocation(`/pettrek/book?driverId=${driver.id}`)}
                data-testid={`card-driver-${driver.id}`}
              >
                <div className="aspect-video bg-gradient-to-br from-amber-100 to-yellow-100 relative">
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
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Available Now
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2" data-testid={`text-name-${driver.id}`}>
                    {driver.name}
                  </h3>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="ml-1 font-medium">{driver.averageRating.toFixed(1)}</span>
                    </div>
                    <span className="text-gray-500 text-sm">({driver.totalTrips} trips)</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{driver.serviceArea}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 mb-3">
                    <Car className="h-4 w-4" />
                    <span className="text-sm">
                      {driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleType})
                    </span>
                  </div>

                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">{driver.bio}</p>

                  {driver.specialFeatures && driver.specialFeatures.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {driver.specialFeatures.slice(0, 3).map((feature, idx) => (
                        <span
                          key={idx}
                          className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-amber-600" />
                      <span className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                        ₪{driver.pricePerKm}
                      </span>
                      <span className="text-gray-500 text-sm">/km</span>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
                      data-testid={`button-book-${driver.id}`}
                    >
                      Book Ride
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
