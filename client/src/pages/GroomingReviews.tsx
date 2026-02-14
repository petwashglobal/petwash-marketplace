import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Star, MessageSquare, ThumbsUp, ChevronDown, ArrowLeft, Award, Users, TrendingUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/languageStore";
import { getApiUrl } from "@/lib/apiConfig";

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={`${
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : star - 0.5 <= rating
              ? "fill-amber-400/50 text-amber-400"
              : "text-gray-300 dark:text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function RatingBar({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400 w-28 rtl:text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium w-8 text-right rtl:text-left">{value > 0 ? value.toFixed(1) : "-"}</span>
    </div>
  );
}

function DistributionBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-4 text-right">{stars}</span>
      <Star size={12} className="fill-amber-400 text-amber-400" />
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
    </div>
  );
}

function ReviewCard({ review, t, language }: { review: any; t: (key: string) => string; language: string }) {
  const date = new Date(review.createdAt);
  const formattedDate = date.toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const petIcon = review.petType === "cat" ? "🐱" : review.petType === "dog" ? "🐕" : "🐾";

  return (
    <Card className="border-amber-100/50 dark:border-amber-900/20 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {review.customerName || t("groomingFeedback.anonymous")}
              </span>
              {review.petName && (
                <Badge variant="outline" className="text-xs border-amber-300 dark:border-amber-700">
                  {petIcon} {review.petName}
                </Badge>
              )}
            </div>
            <StarDisplay rating={review.overallRating} size={14} />
          </div>
          <span className="text-xs text-gray-400">{formattedDate}</span>
        </div>

        {review.comment && (
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
            {review.comment}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          {review.cleanlinessRating && (
            <span>{t("groomingFeedback.cleanliness")}: {"⭐".repeat(review.cleanlinessRating)}</span>
          )}
          {review.equipmentRating && (
            <span>{t("groomingFeedback.equipment")}: {"⭐".repeat(review.equipmentRating)}</span>
          )}
          {review.valueRating && (
            <span>{t("groomingFeedback.valueForMoney")}: {"⭐".repeat(review.valueRating)}</span>
          )}
          {review.easeOfUseRating && (
            <span>{t("groomingFeedback.easeOfUse")}: {"⭐".repeat(review.easeOfUseRating)}</span>
          )}
        </div>

        {review.wouldRecommend && (
          <div className="mt-3 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
            <ThumbsUp size={12} />
            <span>{t("groomingFeedback.recommends")}</span>
          </div>
        )}

        {review.adminResponse && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
              Pet Wash™ {t("groomingFeedback.response")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{review.adminResponse}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GroomingReviews() {
  const { t, dir, language } = useLanguage();
  const isRtl = dir === "rtl";
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: stationsData } = useQuery<{ stations: any[] }>({
    queryKey: ["/api/grooming-feedback/all-stations"],
  });

  const { data: topRated } = useQuery<{ stations: any[] }>({
    queryKey: ["/api/grooming-feedback/stations/top-rated"],
  });

  const { data: stationReviews, isLoading: reviewsLoading } = useQuery<any>({
    queryKey: ["/api/grooming-feedback/station", selectedStation, page],
    queryFn: async () => {
      if (!selectedStation) return null;
      const res = await fetch(getApiUrl(`/api/grooming-feedback/station/${selectedStation}?page=${page}&limit=10`));
      return res.json();
    },
    enabled: !!selectedStation,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" dir={dir}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => window.history.back()}
          className={`flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors ${isRtl ? "flex-row-reverse" : ""}`}
        >
          <ArrowLeft className={isRtl ? "rotate-180" : ""} size={18} />
          <span className="text-sm">{t("groomingFeedback.back")}</span>
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg mb-4">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
            {t("groomingFeedback.reviewsPageTitle")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t("groomingFeedback.reviewsPageSubtitle")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <Select value={selectedStation} onValueChange={(v) => { setSelectedStation(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder={t("groomingFeedback.selectStationToView")} />
            </SelectTrigger>
            <SelectContent>
              {stationsData?.stations?.map((station: any) => (
                <SelectItem key={station.id} value={station.id.toString()}>
                  {(language === "he" && station.nameHe) ? station.nameHe : station.name} ({station.stationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/grooming-feedback">
            <Button className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white whitespace-nowrap">
              <MessageSquare size={16} className={isRtl ? "ml-2" : "mr-2"} />
              {t("groomingFeedback.leaveFeedback")}
            </Button>
          </Link>
        </div>

        {!selectedStation && topRated?.stations && topRated.stations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-600" />
              {t("groomingFeedback.topRatedStations")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topRated.stations.map((station: any, idx: number) => (
                <Card
                  key={station.stationId}
                  className="cursor-pointer hover:shadow-md transition-shadow border-amber-100/50 dark:border-amber-900/20 bg-white/60 dark:bg-gray-900/60"
                  onClick={() => { setSelectedStation(station.stationId.toString()); setPage(1); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {idx < 3 && (
                        <span className="text-lg">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                        </span>
                      )}
                      <span className="font-semibold text-sm">
                        {(language === "he" && station.stationNameHe) ? station.stationNameHe : station.stationName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={station.avgRating} size={14} />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{station.avgRating}</span>
                      <span className="text-xs text-gray-400">({station.totalReviews})</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!selectedStation && (!topRated?.stations || topRated.stations.length === 0) && (
          <Card className="border-amber-200/50 dark:border-amber-800/30 bg-white/60 dark:bg-gray-900/60">
            <CardContent className="p-12 text-center">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("groomingFeedback.noReviewsYet")}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{t("groomingFeedback.beFirstToReview")}</p>
              <Link href="/grooming-feedback">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-700 text-white">
                  {t("groomingFeedback.leaveFeedback")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {selectedStation && reviewsLoading && (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        )}

        {selectedStation && stationReviews && (
          <>
            <Card className="mb-6 border-amber-200/50 dark:border-amber-800/30 shadow-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="text-center md:text-left rtl:md:text-right flex-shrink-0">
                    <div className="text-5xl font-bold text-amber-700 dark:text-amber-400 mb-1">
                      {stationReviews.stats.averageRating || "-"}
                    </div>
                    <StarDisplay rating={stationReviews.stats.averageRating} size={20} />
                    <p className="text-sm text-gray-500 mt-1 flex items-center justify-center md:justify-start rtl:md:justify-end gap-1">
                      <Users size={14} />
                      {stationReviews.stats.totalReviews} {t("groomingFeedback.reviewsCount")}
                    </p>
                    {stationReviews.stats.recommendPercentage > 0 && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 justify-center md:justify-start rtl:md:justify-end">
                        <ThumbsUp size={12} />
                        {stationReviews.stats.recommendPercentage}% {t("groomingFeedback.recommend")}
                      </p>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((stars) => (
                        <DistributionBar
                          key={stars}
                          stars={stars}
                          count={stationReviews.stats.distribution[stars] || 0}
                          total={stationReviews.stats.totalReviews}
                        />
                      ))}
                    </div>

                    <div className="pt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 mt-3">
                      <RatingBar label={t("groomingFeedback.cleanliness")} value={stationReviews.stats.averageCleanliness} maxValue={5} />
                      <RatingBar label={t("groomingFeedback.equipment")} value={stationReviews.stats.averageEquipment} maxValue={5} />
                      <RatingBar label={t("groomingFeedback.valueForMoney")} value={stationReviews.stats.averageValue} maxValue={5} />
                      <RatingBar label={t("groomingFeedback.easeOfUse")} value={stationReviews.stats.averageEaseOfUse} maxValue={5} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {stationReviews.reviews.length > 0 ? (
                stationReviews.reviews.map((review: any) => (
                  <ReviewCard key={review.id} review={review} t={t} language={language} />
                ))
              ) : (
                <Card className="border-amber-200/50 dark:border-amber-800/30 bg-white/60 dark:bg-gray-900/60">
                  <CardContent className="p-8 text-center">
                    <MessageSquare className="w-10 h-10 text-amber-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t("groomingFeedback.noReviewsForStation")}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {stationReviews.pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {isRtl ? "→" : "←"}
                </Button>
                <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
                  {page} / {stationReviews.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(stationReviews.pagination.totalPages, p + 1))}
                  disabled={page === stationReviews.pagination.totalPages}
                >
                  {isRtl ? "←" : "→"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
