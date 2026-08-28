import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Car, MapPin, Clock, Star, Calendar, Package, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";

/**
 * PetTrekCustomerDashboard — customer surface for /pettrek/customer/dashboard.
 *
 * HONESTY REBUILD. Until this file rendered fake data as if real:
 *   • `activeTrip` was a hardcoded const ("Michael Shapiro / Toyota
 *     RAV4 / Bella / ETA 8 min") rendered on every load regardless of
 *     whether the customer had any live trip.
 *   • `upcomingTripsMock` / `pastTripsMock` swapped in whenever the
 *     real bookings query returned empty — so a customer with zero
 *     trips saw fabricated "confirmed" trips from Michael Shapiro and
 *     David Cohen with real-looking prices.
 *   • `savedLocations` (Home / Vet Clinic / Pet Groomer) and
 *     `favoriteDrivers` (four made-up drivers, all 4.9-5.0 stars)
 *     were hardcoded constants — no backend, no CRUD.
 *   • `stats = { totalTrips: 23, thisMonth: 5, ... }` shipped a lie
 *     to every user regardless of their actual trip count.
 *   • 12 action buttons (Reschedule, Details, Receipt, Book Again,
 *     Edit Location, Delete Location, favorite-driver Book Again) had
 *     no `onClick` — the buttons rendered but did nothing.
 *
 * Server-side note: PetTrek is CEO-legally-blocked
 * (server/routes/booking-requests.ts:3346 documents "pettrek is a
 * legally blocked service"), so no /api/bookings/my-bookings?platform=
 * pettrek path exists to fetch real trips today. The dashboard now
 * renders the honest empty state and points the customer at the
 * booking flow rather than fabricating history.
 *
 * When PetTrek launches:
 *   1. Wire the my-bookings platform filter for pettrek server-side.
 *   2. Add /api/pettrek/saved-locations (CRUD) + reintroduce the
 *      Saved Locations section.
 *   3. Add /api/pettrek/favorite-drivers + reintroduce the section.
 *   4. Add /api/pettrek/active-trip (returns the in-progress trip if
 *      any) + reintroduce the Active Trip block above the tabs.
 *   5. Wire the Reschedule / Details / Receipt / Book Again buttons.
 */

interface PetTrekTrip {
  id: string;
  driverName?: string;
  driverPhoto?: string;
  rating?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  pickup?: string;
  dropoff?: string;
  distance?: string;
  estimatedDuration?: number;
  duration?: number;
  price?: number;
  status?: string;
  petName?: string;
  date?: string;
  time?: string;
}

export default function PetTrekCustomerDashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Real bookings query. Uses apiRequest so Firebase Bearer + App
  // Check + 401 refresh land the same way as every other authed
  // surface. The platform filter is respected server-side; today it
  // returns [] because pettrek is legally-blocked, and that's what
  // the honest empty state renders.
  const { data: bookingsData } = useQuery<{ bookings: PetTrekTrip[] }>({
    queryKey: ['/api/bookings/my-bookings', 'pettrek'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/bookings/my-bookings?platform=pettrek`);
      if (!res.ok) throw new Error(`Failed to load PetTrek bookings: ${res.status}`);
      return res.json();
    },
  });

  const allTrips: PetTrekTrip[] = bookingsData?.bookings ?? [];
  const upcomingTrips = allTrips.filter(
    (t) => t.status === 'confirmed' && t.scheduledDate && new Date(t.scheduledDate) > new Date(),
  );
  const pastTrips = allTrips.filter((t) => t.status === 'completed');

  // Stats derived from the real bookings. No hardcoded numbers.
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const stats = {
    totalTrips: allTrips.length,
    thisMonth: allTrips.filter((t) => {
      const d = t.scheduledDate ?? t.date;
      return d ? new Date(d) > monthAgo : false;
    }).length,
  };

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Luxury Welcome Header */}
      <div className="luxury-container luxury-section-compact">
        <div className="flex items-center justify-between mb-8 luxury-animate-fade-in">
          <div>
            <h1 className="luxury-heading-lg luxury-text-gradient mb-2" data-testid="page-title">
              🚗 Welcome to ⁦PetTrek™⁩
            </h1>
            <p className="luxury-text-body" data-testid="page-subtitle">
              Premium Pet Transportation — launching soon in your area
            </p>
          </div>
          <Button
            className="luxury-btn-primary luxury-shadow-xl gap-2"
            data-testid="button-quick-book"
            onClick={() => setLocation('/pettrek/book')}
          >
            <Car className="h-5 w-5" />
            <span className="hidden sm:inline">Quick Book</span>
          </Button>
        </div>

        {/* Honest stats — derived from real bookings only. */}
        <div className="luxury-grid-2 luxury-animate-fade-in luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid="stat-total-trips">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] mb-4">
              <Car className="h-6 w-6 text-white" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">{stats.totalTrips}</div>
            <div className="luxury-text-small">Total Trips</div>
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid="stat-this-month">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] mb-4">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">{stats.thisMonth}</div>
            <div className="luxury-text-small">This Month</div>
          </div>
        </div>

        {/* Launch note — replaces the hardcoded activeTrip block. Every
            customer used to see the same fake "Michael Shapiro / Bella"
            live trip on the top of this page. Now they get an honest
            status message that matches the state of the service. */}
        <div
          className="luxury-glass-panel p-6 mt-8 flex items-start gap-4"
          data-testid="pettrek-launch-note"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="luxury-heading-sm mb-1">PetTrek is not yet live in your area</div>
            <div className="luxury-text-small">
              We&apos;re accepting waitlist bookings — trips you create won&apos;t
              be dispatched until PetTrek launches. Your bookings list below
              shows only trips you&apos;ve actually created.
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Trips & History Tabs */}
      <div className="luxury-container luxury-animate-fade-in luxury-delay-3">
        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto" data-testid="tabs-trips">
              <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming Trips</TabsTrigger>
              <TabsTrigger value="past" data-testid="tab-past">Trip History</TabsTrigger>
            </TabsList>

            {/* Upcoming Trips — real data only, honest empty state */}
            <TabsContent value="upcoming" className="space-y-4">
              <h2 className="luxury-heading-md mb-4">Scheduled Trips</h2>
              {upcomingTrips.length === 0 ? (
                <EmptyTripState
                  title="No upcoming trips"
                  body="Book a trip and it will show up here once a driver accepts."
                  onCta={() => setLocation('/pettrek/book')}
                  ctaLabel="Book a Trip"
                />
              ) : (
                upcomingTrips.map((trip, index) => (
                  <div
                    key={trip.id}
                    className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${Math.min(index + 1, 10)}`}
                    data-testid={`card-trip-${trip.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {trip.driverPhoto && (
                          <Avatar className="h-14 w-14 border-2 border-[#D4AF37] shadow-md">
                            <AvatarImage src={trip.driverPhoto} />
                            <AvatarFallback>{(trip.driverName ?? '?').split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="luxury-heading-sm">{trip.driverName ?? 'Driver TBD'}</h3>
                            {typeof trip.rating === 'number' && (
                              <div className="luxury-badge-gold px-2 py-1 rounded-full text-xs flex items-center gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                {trip.rating}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {trip.scheduledDate && (
                              <div className="flex items-center gap-2 luxury-text-body">
                                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                                <span>
                                  {trip.scheduledDate}
                                  {trip.scheduledTime ? ` at ${trip.scheduledTime}` : ''}
                                </span>
                              </div>
                            )}
                            {(trip.pickup || trip.dropoff) && (
                              <div className="flex items-start gap-2 luxury-text-body">
                                <MapPin className="h-4 w-4 text-[#D4AF37] mt-1" />
                                <div className="flex-1">
                                  {trip.pickup && <div className="font-medium">{trip.pickup}</div>}
                                  {(trip.distance || trip.estimatedDuration) && (
                                    <div className="luxury-text-small text-gray-400 my-1">
                                      ↓ {trip.distance ?? ''} {trip.estimatedDuration ? `• ~${trip.estimatedDuration} min` : ''}
                                    </div>
                                  )}
                                  {trip.dropoff && <div className="font-medium">{trip.dropoff}</div>}
                                </div>
                              </div>
                            )}
                            {trip.petName && (
                              <div className="flex items-center gap-2 luxury-text-body">
                                <Package className="h-4 w-4 text-[#D4AF37]" />
                                <span>Pet: {trip.petName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        {typeof trip.price === 'number' && (
                          <div className="luxury-heading-lg luxury-text-gradient">₪{trip.price}</div>
                        )}
                        <div className={trip.status === 'confirmed' ? 'luxury-badge-success' : 'luxury-badge'}>
                          {trip.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Past Trips History — real data only, honest empty state */}
            <TabsContent value="past" className="space-y-4">
              <h2 className="luxury-heading-md mb-4">Recent Trips</h2>
              {pastTrips.length === 0 ? (
                <EmptyTripState
                  title="No trip history yet"
                  body="Completed trips will appear here."
                  onCta={() => setLocation('/pettrek/book')}
                  ctaLabel="Book Your First Trip"
                />
              ) : (
                pastTrips.map((trip, index) => (
                  <div
                    key={trip.id}
                    className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${Math.min(index + 1, 10)}`}
                    data-testid={`card-past-${trip.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {trip.driverPhoto && (
                          <Avatar className="h-12 w-12 border-2 border-[#D4AF37] shadow-sm">
                            <AvatarImage src={trip.driverPhoto} />
                            <AvatarFallback>{(trip.driverName ?? '?').split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1">
                          <h3 className="luxury-heading-sm mb-2">{trip.driverName ?? 'Driver'}</h3>
                          <div className="space-y-1">
                            {(trip.date || trip.time) && (
                              <div className="flex items-center gap-2 luxury-text-small">
                                <Calendar className="h-3 w-3 text-[#D4AF37]" />
                                <span>
                                  {trip.date ?? ''}
                                  {trip.time ? ` at ${trip.time}` : ''}
                                </span>
                              </div>
                            )}
                            {(trip.pickup || trip.dropoff) && (
                              <div className="luxury-text-body">
                                {trip.pickup ?? ''} → {trip.dropoff ?? ''}
                              </div>
                            )}
                            {(trip.duration || trip.distance) && (
                              <div className="flex items-center gap-2 luxury-text-small">
                                <Clock className="h-3 w-3 text-[#D4AF37]" />
                                <span>
                                  {trip.duration ? `${trip.duration} min` : ''}
                                  {trip.duration && trip.distance ? ' • ' : ''}
                                  {trip.distance ?? ''}
                                </span>
                              </div>
                            )}
                          </div>
                          {typeof trip.rating === 'number' && (
                            <div className="flex items-center gap-1 mt-2">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < (trip.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        {typeof trip.price === 'number' && (
                          <div className="luxury-heading-sm luxury-text-gradient">₪{trip.price}</div>
                        )}
                        <div className="luxury-badge-success">Completed</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Quick Book CTA */}
      <div className="luxury-container pb-12 luxury-animate-fade-in luxury-delay-6">
        <div className="luxury-glass-panel p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="luxury-heading-lg luxury-text-gradient mb-4">Need a Ride for Your Pet?</h2>
            <p className="luxury-text-body mb-8">
              Professional drivers, climate-controlled vehicles, real-time GPS tracking,
              and premium care for your beloved pets.
            </p>
            <Button
              className="luxury-btn-primary luxury-shadow-xl gap-3 px-8 py-6 text-lg"
              data-testid="button-book-trip"
              onClick={() => setLocation('/pettrek/book')}
            >
              <Car className="h-6 w-6" />
              Book a Trip Now
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyTripState({
  title, body, onCta, ctaLabel,
}: { title: string; body: string; onCta: () => void; ctaLabel: string }) {
  return (
    <div className="luxury-glass-minimal p-8 text-center" data-testid="empty-trips">
      <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center mb-4">
        <Car className="h-7 w-7 text-white" />
      </div>
      <h3 className="luxury-heading-sm mb-2">{title}</h3>
      <p className="luxury-text-small mb-6">{body}</p>
      <Button className="luxury-btn-primary" onClick={onCta} data-testid="button-empty-cta">
        {ctaLabel}
      </Button>
    </div>
  );
}
