import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/languageStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, AlertTriangle, TrendingUp, MessageSquare, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${
            s <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-200 dark:text-gray-700"
          }`}
        />
      ))}
    </div>
  );
}

function BigStat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 text-center ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

function formatDate(dateStr: string, isHebrew: boolean) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(isHebrew ? "he-IL" : "en-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProviderFeedbackDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/provider-dashboard/v2/feedback"],
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{isHebrew ? "נדרשת התחברות" : "Login required"}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800"
      dir={isHebrew ? "rtl" : "ltr"}
    >
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 pt-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/provider/dashboard")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {isHebrew ? "משוב מלקוחות" : "Customer Feedback"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {isHebrew ? "ביקורות שהתקבלו על השירותים שלך" : "Reviews received on your services"}
            </p>
          </div>
        </div>

        {/* Stats row */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="mb-6">
            <CardContent className="pt-6 text-center text-red-500">
              {isHebrew ? "שגיאה בטעינת הנתונים" : "Failed to load data"}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <BigStat
                value={
                  data?.stats?.avgRating != null
                    ? `⭐ ${data.stats.avgRating}`
                    : "—"
                }
                label={isHebrew ? "דירוג ממוצע" : "Avg Rating"}
                color="bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
              />
              <BigStat
                value={data?.stats?.reviewCount ?? 0}
                label={isHebrew ? "ביקורות" : "Reviews"}
                color="bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
              />
              <BigStat
                value={data?.stats?.flaggedCount ?? 0}
                label={isHebrew ? "דיווחים" : "Flagged"}
                color={
                  (data?.stats?.flaggedCount ?? 0) > 0
                    ? "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                    : "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                }
              />
            </div>

            {/* Quality nudge */}
            {data?.stats?.avgRating != null && (
              <Card className="mb-4 border-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 shrink-0" />
                    <p className="text-sm font-medium">
                      {data.stats.avgRating >= 4.5
                        ? isHebrew
                          ? "מצוין! אתה בין ספקי השירות המובילים 🏆"
                          : "Excellent! You're among the top service providers 🏆"
                        : data.stats.avgRating >= 3.5
                        ? isHebrew
                          ? "המשך כך — עוד כמה ביקורות טובות ותגיע לחמישה כוכבים"
                          : "Keep it up — a few more great reviews and you'll hit 5 stars"
                        : isHebrew
                        ? "שים לב לביקורות הנמוכות כדי לשפר את הדירוג שלך"
                        : "Pay attention to low reviews to improve your rating"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews list */}
            <div className="space-y-3">
              {!data?.reviews?.length ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-gray-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>{isHebrew ? "אין ביקורות עדיין" : "No reviews yet"}</p>
                    <p className="text-xs mt-1">
                      {isHebrew
                        ? "ביקורות יופיעו כאן לאחר השלמת הזמנות"
                        : "Reviews will appear here after completing bookings"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                data.reviews.map((review: any) => (
                  <Card
                    key={review.id}
                    className={`${
                      review.isFlagged
                        ? "border-orange-300 dark:border-orange-700"
                        : ""
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <StarDisplay rating={review.rating} />
                            <span className="text-sm font-semibold">
                              {review.rating}/5
                            </span>
                            {review.isFlagged && (
                              <Badge
                                variant="secondary"
                                className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs"
                              >
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {isHebrew ? "מסומן" : "Flagged"}
                              </Badge>
                            )}
                          </div>
                          {review.text && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              "{review.text}"
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDate(review.createdAt, isHebrew)}
                            {" · "}
                            {isHebrew ? "הזמנה" : "Booking"} #{review.bookingId?.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
