import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/languageStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Star, CheckCircle, AlertCircle, ArrowRight, Calendar, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={`w-9 h-9 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const RATING_LABELS: Record<number, { en: string; he: string }> = {
  1: { en: "Very Poor", he: "גרוע מאוד" },
  2: { en: "Poor", he: "גרוע" },
  3: { en: "OK", he: "בסדר" },
  4: { en: "Good", he: "טוב" },
  5: { en: "Excellent", he: "מצוין!" },
};

export default function MarketplaceReviewPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: bookingData, isLoading: bookingLoading } = useQuery<any>({
    queryKey: [`/api/marketplace-bookings/${bookingId}`],
    enabled: !!bookingId && !!user,
  });

  const booking = bookingData?.booking ?? bookingData;

  const { data: existingReview } = useQuery<any>({
    queryKey: ["/api/marketplace-reviews/my-reviews"],
    enabled: !!user,
    select: (data: any) =>
      data?.reviews?.find((r: any) => r.bookingId === bookingId),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/marketplace-reviews", {
        bookingId,
        overallRating: rating,
        reviewText: reviewText.trim() || null,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save review");
      return data;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: isHebrew ? "תודה על המשוב!" : "Thanks for your feedback!",
        description: isHebrew
          ? "הביקורת שלך נשמרה בהצלחה"
          : "Your review has been saved",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: isHebrew ? "שגיאה" : "Error",
        description: err?.message || (isHebrew ? "שגיאה בשמירת הביקורת" : "Failed to save review"),
      });
    },
  });

  // Detect whether the booking is in a reviewable state
  const isReviewable =
    !booking || ["completed", "reviewed"].includes(booking.status);
  const bookingDate = booking?.startTime
    ? new Date(booking.startTime).toLocaleDateString(
        isHebrew ? "he-IL" : "en-IL",
        { day: "numeric", month: "long" }
      )
    : null;

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        variant: "destructive",
        title: isHebrew ? "בחר דירוג" : "Select a rating",
      });
      return;
    }
    reviewMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              {isHebrew ? "נדרשת התחברות" : "Login required"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Booking loaded but service not yet completed → show informational screen
  if (!bookingLoading && booking && !isReviewable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-9 h-9 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isHebrew ? "השירות עדיין לא הושלם" : "Service Not Yet Completed"}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {isHebrew
                ? "תוכל לכתוב ביקורת לאחר השלמת השירות"
                : "You can leave a review after the service is completed"}
            </p>
            {bookingDate && (
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-6">
                {isHebrew ? `השירות מתוכנן ל-${bookingDate}` : `Service scheduled for ${bookingDate}`}
              </p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate("/bookings")}
              >
                {isHebrew ? "לכל ההזמנות" : "My Bookings"}
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => navigate(`/report-problem/${bookingId}`)}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {isHebrew ? "דווח על בעיה" : "Report a Problem"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || existingReview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isHebrew ? "תודה רבה!" : "Thank you!"}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {isHebrew
                ? "הביקורת שלך עוזרת לאחרים לבחור נכון"
                : "Your review helps others make the right choice"}
            </p>
            {(existingReview || submitted) && (
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-6 h-6 ${
                      s <= (existingReview?.overallRating ?? rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}
            {/* Low-rating prompt to report a problem */}
            {(existingReview?.overallRating ?? rating) <= 2 && (existingReview || submitted) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300">
                <p className="font-medium mb-2">
                  {isHebrew ? "חוויה רעה? נעזור לפתור את זה." : "Bad experience? We can help."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-400 text-orange-700 hover:bg-orange-100"
                  onClick={() => navigate(`/report-problem/${bookingId}`)}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  {isHebrew ? "דווח על בעיה" : "Report a Problem"}
                </Button>
              </div>
            )}
            <Button
              onClick={() => navigate("/bookings")}
              className="luxury-btn-primary luxury-shadow-xl"
            >
              {isHebrew ? "לכל ההזמנות" : "My Bookings"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-4"
      dir={isHebrew ? "rtl" : "ltr"}
    >
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6 pt-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {isHebrew ? "ספר לנו על החוויה שלך" : "Tell us about your experience"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {isHebrew ? `הזמנה #${bookingId?.slice(0, 8)}` : `Booking #${bookingId?.slice(0, 8)}`}
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">
              {isHebrew ? "דירוג כולל" : "Overall Rating"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <StarRating value={rating} onChange={setRating} />
              {rating > 0 && (
                <Badge
                  variant="secondary"
                  className={`text-sm font-medium ${
                    rating <= 2
                      ? "bg-red-100 text-red-700"
                      : rating === 3
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {isHebrew
                    ? RATING_LABELS[rating].he
                    : RATING_LABELS[rating].en}
                </Badge>
              )}
            </div>

            {rating > 0 && rating <= 2 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300">
                {isHebrew
                  ? "מצטערים לשמוע. הצוות שלנו יבחן את הדיווח ויצור איתך קשר."
                  : "Sorry to hear that. Our team will review this report and reach out to you."}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-black block mb-2">
                {isHebrew ? "ספר עוד (אופציונלי)" : "Tell us more (optional)"}
              </label>
              <Textarea
                placeholder={
                  isHebrew
                    ? "מה אהבת? מה היה אפשר לשפר?"
                    : "What did you like? What could be improved?"
                }
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                maxLength={500}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {reviewText.length}/500
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || reviewMutation.isPending}
              className="w-full luxury-btn-primary luxury-shadow-xl"
            >
              {reviewMutation.isPending
                ? isHebrew
                  ? "שולח..."
                  : "Submitting..."
                : isHebrew
                ? "שלח ביקורת"
                : "Submit Review"}
            </Button>

            <Button
              variant="ghost"
              className="w-full text-gray-500"
              onClick={() => navigate("/bookings")}
            >
              {isHebrew ? "דלג" : "Skip"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
