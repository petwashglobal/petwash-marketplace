import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Clock, Waves } from "lucide-react";

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
  const [, setRouterLocation] = useLocation();
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
      name: '⁦Pet Wash™⁩ - רמת גן',
      address: 'רחוב בילינסון 12',
      city: 'רמת גן',
      hours: 'א׳-ה׳: 08:00-20:00, ו׳: 08:00-14:00',
      phone: '03-1234567',
      coordinates: { lat: 32.0853, lng: 34.8065 }
    },
    {
      id: '2',
      name: '⁦Pet Wash™⁩ - תל אביב',
      address: 'רחוב דיזנגוף 100',
      city: 'תל אביב',
      hours: 'א׳-ה׳: 08:00-20:00, ו׳: 08:00-14:00',
      phone: '03-7654321',
      coordinates: { lat: 32.0808, lng: 34.7742 }
    },
    {
      id: '3',
      name: '⁦Pet Wash™⁩ - ראש העין',
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
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12 luxury-fade-in">
          <div className="text-7xl mb-6">📍</div>
          <h1 className="luxury-heading-xl mb-6">
            Find a Station Near You
          </h1>
          <p className="luxury-subtitle-lg max-w-2xl mx-auto">
            Premium organic pet washing stations across Israel
          </p>
        </div>

        {/* User Location Status */}
        {userLocation && (
          <div className="max-w-4xl mx-auto mb-8 luxury-glass-card luxury-bg-success p-6 text-center luxury-scale-in">
            <p className="text-white flex items-center justify-center gap-3 text-lg font-semibold">
              <Navigation className="w-6 h-6" />
              Showing stations sorted by distance from your location
            </p>
          </div>
        )}

        {/* Stations List */}
        <div className="max-w-4xl mx-auto space-y-6 luxury-stagger-fade-in">
          {sortedStations.map((station, index) => {
            const distance = userLocation 
              ? calculateDistance(userLocation.lat, userLocation.lng, station.coordinates.lat, station.coordinates.lng)
              : null;

            return (
              <div key={station.id} className="luxury-glass-card luxury-hover-lift luxury-shadow-lg" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold luxury-gradient-text mb-3">{station.name}</h2>
                      <p className="text-xl luxury-text-body">
                        {station.address}, {station.city}
                      </p>
                    </div>
                    {distance && (
                      <div className="luxury-glass-minimal px-6 py-4 rounded-xl text-center luxury-pulse-glow">
                        <div className="text-3xl font-black luxury-gradient-text">{distance.toFixed(1)}</div>
                        <div className="text-sm luxury-text-muted mt-1">km away</div>
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 luxury-pulse-glow">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-sm luxury-text-muted mb-1">שעות פעילות</div>
                        <div className="luxury-text-body text-lg">{station.hours}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0 luxury-pulse-glow">
                        <Phone className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-sm luxury-text-muted mb-1">טלפון</div>
                        <a href={`tel:${station.phone}`} className="luxury-link text-lg">
                          {station.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button
                      className="luxury-btn-primary luxury-shadow-xl"
                      onClick={() => setRouterLocation(`/k9000/booking/${station.id}`)}
                      data-testid={`button-wash-${station.id}`}
                    >
                      <Waves className="w-5 h-5 mr-2" />
                      Wash Now
                    </Button>
                    <Button
                      className="luxury-btn-outline"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${station.coordinates.lat},${station.coordinates.lng}`, '_blank')}
                    >
                      <MapPin className="w-5 h-5 mr-2" />
                      Navigate with Google Maps
                    </Button>
                    <Button
                      className="luxury-btn-outline"
                      onClick={() => window.open(`https://waze.com/ul?ll=${station.coordinates.lat},${station.coordinates.lng}&navigate=yes`, '_blank')}
                    >
                      <Navigation className="w-5 h-5 mr-2" />
                      Navigate with Waze
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming Soon Section */}
        <div className="max-w-4xl mx-auto mt-16 luxury-glass-card luxury-shadow-xl p-10 text-center luxury-slide-up">
          <h2 className="text-3xl font-bold luxury-gradient-text mb-4">More Locations Coming Soon!</h2>
          <p className="luxury-text-body text-lg mb-8">
            We're expanding across Israel in 2025. Want a ⁦Pet Wash™⁩ station in your neighborhood?
          </p>
          <Button 
            className="luxury-btn-outline luxury-shadow-lg"
            onClick={() => window.location.href = 'mailto:Support@PetWash.co.il?subject=New Location Request'}
          >
            📧 Request a New Location
          </Button>
        </div>
      </div>
    </div>
  );
}
