import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function OwnerDashboard() {
  const [, setLocation] = useLocation();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/bookings'],
    enabled: true,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-light mb-4 text-gray-900 dark:text-gray-100" data-testid="page-title">
            My Walks
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-light">
            View and manage your upcoming and past dog walks
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Button
            className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-light"
            onClick={() => setLocation("/walk-my-pet")}
            data-testid="button-book-walk"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Book New Walk
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400 font-light">Loading your walks...</p>
          </div>
        ) : bookings.length === 0 ? (
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-xl font-light mb-2 text-gray-900 dark:text-gray-100">No Walks Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light mb-6">
                Book your first dog walk to get started!
              </p>
              <Button
                className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-light"
                onClick={() => setLocation("/walk-my-pet")}
              >
                Browse Walkers
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {bookings.map((booking: any) => (
              <Card key={booking.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm" data-testid={`card-booking-${booking.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between font-light">
                    <span className="text-lg text-gray-900 dark:text-gray-100">
                      Booking #{booking.bookingNumber}
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full font-light ${
                      booking.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100' :
                      booking.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100' :
                      'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100'
                    }`}>
                      {booking.status}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(booking.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
                    <MapPin className="h-4 w-4" />
                    <span>{booking.platformData?.walkerName || 'Professional Walker'}</span>
                  </div>
                  <div className="text-sm font-light text-gray-900 dark:text-gray-100">
                    Total: ₪{booking.total}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
