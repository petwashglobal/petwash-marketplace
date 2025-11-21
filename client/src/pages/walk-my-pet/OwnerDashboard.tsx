import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Dog } from "lucide-react";
import { useLocation } from "wouter";

export default function OwnerDashboard() {
  const [, setLocation] = useLocation();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/bookings'],
    enabled: true,
  });

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="luxury-services-badge luxury-animate-fade-in">
            <Dog className="h-4 w-4" />
            Your Walk Dashboard
          </div>
          <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1" data-testid="page-title">
            My Walks
          </h1>
          <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
            View and manage your upcoming and past dog walks
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <button
            className="luxury-btn-primary flex items-center gap-2"
            onClick={() => setLocation("/walk-my-pet")}
            data-testid="button-book-walk"
          >
            <Calendar className="h-4 w-4" />
            Book New Walk
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="luxury-spinner mx-auto mb-4"></div>
            <p className="luxury-text-body">Loading your walks...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="luxury-glass-card luxury-shadow-xl p-12 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-6" style={{ color: '#667eea' }} />
            <h3 className="luxury-heading-md mb-3">No Walks Yet</h3>
            <p className="luxury-text-body mb-6">
              Book your first dog walk to get started!
            </p>
            <button
              className="luxury-btn-primary"
              onClick={() => setLocation("/walk-my-pet")}
            >
              Browse Walkers
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking: any, index: number) => (
              <div 
                key={booking.id} 
                className={`luxury-glass-card luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
                data-testid={`card-booking-${booking.id}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="luxury-heading-sm">
                    Booking #{booking.bookingNumber}
                  </span>
                  <span className={`luxury-badge ${
                    booking.status === 'confirmed' ? 'luxury-badge-success' :
                    booking.status === 'pending' ? 'luxury-badge-gold' :
                    ''
                  }`}>
                    {booking.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 luxury-text-small">
                    <Clock className="h-4 w-4" style={{ color: '#667eea' }} />
                    <span>{new Date(booking.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 luxury-text-small">
                    <MapPin className="h-4 w-4" style={{ color: '#667eea' }} />
                    <span>{booking.platformData?.walkerName || 'Professional Walker'}</span>
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient">
                    ₪{booking.total}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
