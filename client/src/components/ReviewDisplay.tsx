import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Shield, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Review {
  reviewId: string;
  reviewerName: string;
  reviewerType: 'owner' | 'contractor';
  overallRating: number;
  punctualityRating: number | null;
  communicationRating: number | null;
  professionalismRating: number | null;
  cleanlinessRating: number | null;
  safetyRating: number | null;
  reviewText: string | null;
  createdAt: string;
  isVerifiedBooking: boolean;
  isFlagged: boolean;
  moderationStatus: string;
  subjectResponse: string | null;
  subjectResponseAt: string | null;
}

interface ReviewDisplayProps {
  contractorId: string;
  contractorName: string;
}

export function ReviewDisplay({ contractorId, contractorName }: ReviewDisplayProps) {
  const { data, isLoading } = useQuery<{ reviews: Review[]; averageRating: number; totalReviews: number }>({
    queryKey: ['/api/reviews', contractorId],
  });

  const reviews = data?.reviews || [];
  const averageRating = data?.averageRating || 0;
  const totalReviews = data?.totalReviews || 0;

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500 dark:text-gray-400">Loading reviews...</p>
        </CardContent>
      </Card>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500 dark:text-gray-400">No reviews yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                {averageRating.toFixed(1)}
              </div>
              <StarRating rating={Math.round(averageRating)} />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{contractorName}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Reviews from verified bookings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Reviews */}
      {reviews.map((review) => (
        <Card key={review.reviewId} data-testid={`review-card-${review.reviewId}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{review.reviewerName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{review.reviewerName}</h4>
                    {review.isVerifiedBooking && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Verified
                      </Badge>
                    )}
                    {review.isFlagged && review.moderationStatus === 'pending' && (
                      <Badge variant="outline" className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="w-3 h-3" />
                        Under Review
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(review.createdAt), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <StarRating rating={review.overallRating} />
            </div>
          </CardHeader>
          <CardContent>
            {/* Category Ratings */}
            {(review.punctualityRating || review.communicationRating || review.professionalismRating) && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {review.punctualityRating && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Punctuality:</span>{' '}
                    <span className="font-medium">{review.punctualityRating}.0</span>
                  </div>
                )}
                {review.communicationRating && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Communication:</span>{' '}
                    <span className="font-medium">{review.communicationRating}.0</span>
                  </div>
                )}
                {review.professionalismRating && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Professionalism:</span>{' '}
                    <span className="font-medium">{review.professionalismRating}.0</span>
                  </div>
                )}
                {review.cleanlinessRating && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Cleanliness:</span>{' '}
                    <span className="font-medium">{review.cleanlinessRating}.0</span>
                  </div>
                )}
                {review.safetyRating && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Safety:</span>{' '}
                    <span className="font-medium">{review.safetyRating}.0</span>
                  </div>
                )}
              </div>
            )}

            {/* Review Text */}
            {review.reviewText && (
              <p className="text-gray-700 dark:text-gray-300 mb-4">{review.reviewText}</p>
            )}

            {/* Contractor Response */}
            {review.subjectResponse && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-purple-500">
                <p className="text-sm font-semibold mb-1">Response from {contractorName}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{review.subjectResponse}</p>
                {review.subjectResponseAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {format(new Date(review.subjectResponseAt), 'MMMM d, yyyy')}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
