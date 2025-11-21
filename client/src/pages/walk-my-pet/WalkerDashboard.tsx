import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, DollarSign } from "lucide-react";
import { useLocation } from "wouter";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';

export default function WalkerDashboard() {
  const [, setLocation] = useLocation();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/provider/bookings'],
    enabled: true,
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'luxury-badge-success';
      case 'pending':
        return 'luxury-badge-gold';
      default:
        return 'luxury-badge';
    }
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="Walker Dashboard"
      subtitle="Manage your dog walking appointments and earnings"
    >
      <div className="luxury-bg-mesh min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="text-center py-12 luxury-animate-fade-in">
              <div className="luxury-spinner mx-auto mb-4"></div>
              <p className="luxury-text-small">Loading your appointments...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-scale-in">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 mb-6">
                <Calendar className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="luxury-heading-md mb-2">No Appointments Yet</h3>
              <p className="luxury-text-small">
                Your upcoming dog walking appointments will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {bookings.map((booking: any, index: number) => (
                <div 
                  key={booking.id} 
                  className={`luxury-glass-minimal luxury-hover-lift luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}
                  data-testid={`card-booking-${booking.id}`}
                  style={{ opacity: 0 }}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="luxury-heading-sm">
                        Booking #{booking.bookingNumber}
                      </span>
                      <span className={getStatusBadgeClass(booking.status)}>
                        {booking.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30">
                        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="luxury-text-body">
                        {new Date(booking.startTime).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
                        <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="luxury-text-body">
                        {booking.platformData?.serviceArea || 'Service Area'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                        <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="luxury-heading-lg luxury-text-gradient">
                        ₪{booking.total}
                      </span>
                    </div>
                  </CardContent>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LuxuryPageWrapper>
  );
}
