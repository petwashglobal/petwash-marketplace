import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Clock } from "lucide-react";

interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
  phone: string;
  coordinates: { lat: number; lng: number };
}

export default function Locations() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  const stations: Station[] = [
    {
      id: '1',
      name: 'Pet Wash™ - רמת גן',
      address: 'רחוב בילינסון 12',
      city: 'רמת גן',
      hours: 'א׳-ה׳: 08:00-20:00, ו׳: 08:00-14:00',
      phone: '03-1234567',
      coordinates: { lat: 32.0853, lng: 34.8065 }
    },
    {
      id: '2',
      name: 'Pet Wash™ - תל אביב',
      address: 'רחוב דיזנגוף 100',
      city: 'תל אביב',
      hours: 'א׳-ה׳: 08:00-20:00, ו׳: 08:00-14:00',
      phone: '03-7654321',
      coordinates: { lat: 32.0808, lng: 34.7742 }
    },
    {
      id: '3',
      name: 'Pet Wash™ - ראש העין',
      address: 'עוזי חיטמן 8',
      city: 'ראש העין',
      hours: 'א׳-ה׳: 08:00-20:00, ו׳: 08:00-14:00',
      phone: '03-9999999',
      coordinates: { lat: 32.0942, lng: 34.9591 }
    }
  ];

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const sortedStations = userLocation 
    ? [...stations].sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.coordinates.lat, a.coordinates.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.coordinates.lat, b.coordinates.lng);
        return distA - distB;
      })
    : stations;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">📍</div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Find a Station Near You
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Premium organic pet washing stations across Israel
          </p>
        </div>

        {/* User Location Status */}
        {userLocation && (
          <div className="max-w-4xl mx-auto mb-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-800 flex items-center justify-center gap-2">
              <Navigation className="w-5 h-5" />
              Showing stations sorted by distance from your location
            </p>
          </div>
        )}

        {/* Stations List */}
        <div className="max-w-4xl mx-auto space-y-6">
          {sortedStations.map((station) => {
            const distance = userLocation 
              ? calculateDistance(userLocation.lat, userLocation.lng, station.coordinates.lat, station.coordinates.lng)
              : null;

            return (
              <Card key={station.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{station.name}</CardTitle>
                      <CardDescription className="text-lg mt-2">
                        {station.address}, {station.city}
                      </CardDescription>
                    </div>
                    {distance && (
                      <div className="bg-blue-50 px-4 py-2 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{distance.toFixed(1)}</div>
                        <div className="text-xs text-blue-600">km away</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-purple-600 mt-1" />
                      <div>
                        <div className="font-semibold text-sm text-gray-700">שעות פעילות</div>
                        <div className="text-gray-600">{station.hours}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-green-600 mt-1" />
                      <div>
                        <div className="font-semibold text-sm text-gray-700">טלפון</div>
                        <a href={`tel:${station.phone}`} className="text-blue-600 hover:underline">
                          {station.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${station.coordinates.lat},${station.coordinates.lng}`, '_blank')}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Navigate with Google Maps
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`https://waze.com/ul?ll=${station.coordinates.lat},${station.coordinates.lng}&navigate=yes`, '_blank')}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Navigate with Waze
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Coming Soon Section */}
        <div className="max-w-4xl mx-auto mt-12 p-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 text-center">
          <h2 className="text-2xl font-bold mb-3">More Locations Coming Soon!</h2>
          <p className="text-gray-600 mb-6">
            We're expanding across Israel in 2025. Want a Pet Wash™ station in your neighborhood?
          </p>
          <Button 
            variant="outline"
            onClick={() => window.location.href = 'mailto:Support@PetWash.co.il?subject=New Location Request'}
          >
            📧 Request a New Location
          </Button>
        </div>
      </div>
    </div>
  );
}
