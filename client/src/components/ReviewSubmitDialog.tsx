import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ReviewSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingType: 'sitter' | 'walker' | 'pettrek';
  bookingId: string;
  contractorName: string;
  contractorType: 'sitter' | 'walker' | 'driver';
}

export function ReviewSubmitDialog({
  open,
  onOpenChange,
  bookingType,
  bookingId,
  contractorName,
  contractorType
}: ReviewSubmitDialogProps) {
  const { toast } = useToast();
  const [ratings, setRatings] = useState({
    overall: 0,
    punctuality: 0,
    communication: 0,
    professionalism: 0,
    cleanliness: 0,
    safety: 0
  });
  const [reviewText, setReviewText] = useState('');
  const [hoveredRating, setHoveredRating] = useState<{ category: string; value: number } | null>(null);

  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: any) => {
      return apiRequest('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Review Submitted',
        description: 'Thank you for your feedback!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/my-bookings'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit review',
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setRatings({ overall: 0, punctuality: 0, communication: 0, professionalism: 0, cleanliness: 0, safety: 0 });
    setReviewText('');
  };

  const handleSubmit = () => {
    if (ratings.overall === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please provide an overall rating',
        variant: 'destructive',
      });
      return;
    }

    submitReviewMutation.mutate({
      bookingType,
      bookingId,
      reviewType: 'owner_to_contractor',
      overallRating: ratings.overall,
      punctualityRating: ratings.punctuality || null,
      communicationRating: ratings.communication || null,
      professionalismRating: ratings.professionalism || null,
      cleanlinessRating: ratings.cleanliness || null,
      safetyRating: ratings.safety || null,
      reviewText: reviewText.trim() || null,
    });
  };

  const StarRating = ({ 
    category, 
    label, 
    value, 
    onChange 
  }: { 
    category: string; 
    label: string; 
    value: number; 
    onChange: (value: number) => void;
  }) => {
    const displayValue = hoveredRating?.category === category ? hoveredRating.value : value;
    
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              data-testid={`star-${category}-${star}`}
              className="transition-transform hover:scale-110"
              onMouseEnter={() => setHoveredRating({ category, value: star })}
              onMouseLeave={() => setHoveredRating(null)}
              onClick={() => onChange(star)}
            >
              <Star
                className={`w-6 h-6 ${
                  star <= displayValue
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {displayValue > 0 ? `${displayValue}.0` : '-'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate {contractorName}</DialogTitle>
          <DialogDescription>
            Share your experience with this {contractorType} to help other pet owners
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Rating - Required */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <StarRating
              category="overall"
              label="Overall Rating *"
              value={ratings.overall}
              onChange={(value) => setRatings({ ...ratings, overall: value })}
            />
          </div>

          {/* Category Ratings - Optional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StarRating
              category="punctuality"
              label="Punctuality"
              value={ratings.punctuality}
              onChange={(value) => setRatings({ ...ratings, punctuality: value })}
            />
            <StarRating
              category="communication"
              label="Communication"
              value={ratings.communication}
              onChange={(value) => setRatings({ ...ratings, communication: value })}
            />
            <StarRating
              category="professionalism"
              label="Professionalism"
              value={ratings.professionalism}
              onChange={(value) => setRatings({ ...ratings, professionalism: value })}
            />
            <StarRating
              category="cleanliness"
              label="Cleanliness"
              value={ratings.cleanliness}
              onChange={(value) => setRatings({ ...ratings, cleanliness: value })}
            />
            <StarRating
              category="safety"
              label="Safety & Care"
              value={ratings.safety}
              onChange={(value) => setRatings({ ...ratings, safety: value })}
            />
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label htmlFor="reviewText">Your Review (Optional)</Label>
            <Textarea
              id="reviewText"
              data-testid="input-review-text"
              placeholder="Share details about your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reviews are auto-flagged for inappropriate content
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-review"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitReviewMutation.isPending || ratings.overall === 0}
              data-testid="button-submit-review"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
