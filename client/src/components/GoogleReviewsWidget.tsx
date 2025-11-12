import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, MapPin, Calendar, User, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/languageStore';
import { useQuery } from '@tanstack/react-query';

interface GoogleReview {
  authorName: string;
  authorUrl?: string;
  profilePhotoUrl?: string;
  rating: number;
  relativeTimeDescription: string;
  text: string;
  time: number;
}

interface GoogleReviewsWidgetProps {
  placeId: string;
  locationName?: string;
  maxReviews?: number;
  showPhotos?: boolean;
}

export function GoogleReviewsWidget({
  placeId,
  locationName,
  maxReviews = 5,
  showPhotos = true
}: GoogleReviewsWidgetProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [currentPage, setCurrentPage] = useState(0);

  const { data: placeData, isLoading } = useQuery({
    queryKey: ['/api/google/places', placeId],
    enabled: !!placeId
  });

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {isHebrew ? 'טוען ביקורות...' : 'Loading Reviews...'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!placeData || !placeData.reviews || placeData.reviews.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {isHebrew ? 'ביקורות לקוחות' : 'Customer Reviews'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            {isHebrew ? 'אין ביקורות זמינות כרגע' : 'No reviews available at this time'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { rating, userRatingsTotal, reviews, photos } = placeData;
  const displayReviews = reviews.slice(0, maxReviews);
  const reviewsPerPage = 3;
  const totalPages = Math.ceil(displayReviews.length / reviewsPerPage);
  const paginatedReviews = displayReviews.slice(
    currentPage * reviewsPerPage,
    (currentPage + 1) * reviewsPerPage
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-yellow-500 text-yellow-500'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const content = {
    en: {
      title: 'Customer Reviews',
      averageRating: 'Average Rating',
      totalReviews: 'reviews',
      viewOnGoogle: 'View on Google Maps',
      photos: 'Customer Photos',
      showMore: 'Show More',
      previous: 'Previous',
      next: 'Next'
    },
    he: {
      title: 'ביקורות לקוחות',
      averageRating: 'דירוג ממוצע',
      totalReviews: 'ביקורות',
      viewOnGoogle: 'צפה בגוגל מפות',
      photos: 'תמונות לקוחות',
      showMore: 'הצג עוד',
      previous: 'הקודם',
      next: 'הבא'
    }
  };

  const t = content[isHebrew ? 'he' : 'en'];

  return (
    <div className="w-full space-y-6">
      {/* Overall Rating Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                  {rating.toFixed(1)}
                </div>
                <div className="flex justify-center mt-2">
                  {renderStars(Math.round(rating))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {userRatingsTotal} {t.totalReviews}
                </p>
              </div>
            </div>

            {locationName && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <MapPin className="w-5 h-5" />
                <span className="font-medium">{locationName}</span>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => window.open(`https://search.google.com/local/writereview?placeid=${placeId}`, '_blank')}
              className="gap-2"
              data-testid="button-view-google-maps"
            >
              <ExternalLink className="w-4 h-4" />
              {t.viewOnGoogle}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Photos (if available) */}
      {showPhotos && photos && photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📸 {t.photos}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.slice(0, 8).map((photo, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg overflow-hidden hover:scale-105 transition-transform cursor-pointer"
                >
                  <img
                    src={`/api/google/places/photo?reference=${photo.photoReference}&maxWidth=400`}
                    alt={`Customer photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {paginatedReviews.map((review, index) => (
            <div
              key={index}
              className="pb-6 border-b border-gray-200 dark:border-gray-700 last:border-0"
              data-testid={`review-${index}`}
            >
              {/* Reviewer Info */}
              <div className="flex items-start gap-4 mb-3">
                {review.profilePhotoUrl ? (
                  <img
                    src={review.profilePhotoUrl}
                    alt={review.authorName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <a
                        href={review.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {review.authorName}
                      </a>
                      <div className="flex items-center gap-2 mt-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {review.relativeTimeDescription}
                    </div>
                  </div>

                  {/* Review Text */}
                  <p className="mt-3 text-gray-700 dark:text-gray-300 leading-relaxed">
                    {review.text}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                data-testid="button-reviews-previous"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t.previous}
              </Button>

              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentPage + 1} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                data-testid="button-reviews-next"
              >
                {t.next}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
