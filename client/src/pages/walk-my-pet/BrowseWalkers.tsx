import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Star, Calendar, DollarSign } from "lucide-react";

export default function BrowseWalkers() {
  const [, setLocation] = useLocation();

  const { data: walkers = [], isLoading } = useQuery({
    queryKey: ['/api/platforms/walk_my_pet/providers'],
    enabled: true,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-light mb-4 text-gray-900 dark:text-gray-100" data-testid="page-title">
            Walk My Pet™
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-light max-w-2xl">
            Professional dog walking services. Book trusted walkers with GPS tracking and real-time updates.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
                <CardHeader>
                  <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : walkers.length === 0 ? (
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-xl font-light mb-2 text-gray-900 dark:text-gray-100">No Walkers Available</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light">
                We're currently onboarding professional dog walkers in your area. Check back soon!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {walkers.map((walker: any) => (
              <Card key={walker.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-walker-${walker.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 font-light text-gray-900 dark:text-gray-100">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <div className="text-lg">{walker.businessName || walker.displayName || 'Professional Walker'}</div>
                      {walker.rating && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 font-light">
                          <Star className="h-3 w-3 fill-current text-yellow-500" />
                          {walker.rating.toFixed(1)} ({walker.totalReviews || 0} reviews)
                        </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {walker.serviceArea && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 font-light">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{walker.serviceArea}</span>
                    </div>
                  )}
                  
                  {walker.bio && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-light line-clamp-2">
                      {walker.bio}
                    </p>
                  )}

                  {walker.hourlyRate && (
                    <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 font-light">
                      <DollarSign className="h-4 w-4" />
                      <span>₪{walker.hourlyRate}/hour</span>
                    </div>
                  )}

                  <Button
                    className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-light"
                    onClick={() => setLocation(`/walk-my-pet/book/${walker.id}`)}
                    data-testid={`button-book-walker-${walker.id}`}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Walk
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
