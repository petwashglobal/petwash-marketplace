import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { User, MapPin, Star, Calendar, DollarSign, Dog } from "lucide-react";

export default function BrowseWalkers() {
  const [, setLocation] = useLocation();

  const { data: walkers = [], isLoading } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/providers'],
    enabled: true,
  });

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="luxury-services-badge luxury-animate-fade-in">
            <Dog className="h-4 w-4" />
            Professional Dog Walking
          </div>
          <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1" data-testid="page-title">
            Walk My Pet™
          </h1>
          <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
            Professional dog walking services. Book trusted walkers with GPS tracking and real-time updates.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="luxury-grid-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="luxury-glass-card p-6">
                <div className="h-8 w-3/4 luxury-skeleton mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full luxury-skeleton" />
                  <div className="h-4 w-2/3 luxury-skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : walkers.length === 0 ? (
          <div className="luxury-glass-card luxury-shadow-xl p-12 text-center">
            <User className="h-16 w-16 mx-auto mb-6" style={{ color: '#667eea' }} />
            <h3 className="luxury-heading-md mb-3">No Walkers Available</h3>
            <p className="luxury-text-body">
              We're currently onboarding professional dog walkers in your area. Check back soon!
            </p>
          </div>
        ) : (
          <div className="luxury-grid-3">
            {walkers.map((walker: any, index: number) => (
              <div 
                key={walker.id} 
                className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl p-6 luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
                data-testid={`card-walker-${walker.id}`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center p-0.5">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                      <User className="h-8 w-8" style={{ color: '#667eea' }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="luxury-heading-sm">{walker.businessName || walker.displayName || 'Professional Walker'}</div>
                    {walker.rating && (
                      <div className="luxury-badge-gold inline-flex items-center gap-1 mt-1 text-xs">
                        <Star className="h-3 w-3 fill-current" />
                        {walker.rating.toFixed(1)} ({walker.totalReviews || 0} reviews)
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {walker.serviceArea && (
                    <div className="flex items-start gap-2 luxury-text-small">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#667eea' }} />
                      <span>{walker.serviceArea}</span>
                    </div>
                  )}
                  
                  {walker.bio && (
                    <p className="luxury-text-small line-clamp-2">
                      {walker.bio}
                    </p>
                  )}

                  {walker.hourlyRate && (
                    <div className="luxury-heading-lg luxury-text-gradient pt-2">
                      ₪{walker.hourlyRate}/hour
                    </div>
                  )}

                  <button
                    className="luxury-btn-primary w-full flex items-center justify-center gap-2"
                    onClick={() => setLocation(`/walk-my-pet/book/${walker.id}`)}
                    data-testid={`button-book-walker-${walker.id}`}
                  >
                    <Calendar className="h-4 w-4" />
                    Book Walk
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
