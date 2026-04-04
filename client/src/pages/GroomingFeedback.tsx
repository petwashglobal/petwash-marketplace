import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRoute, useLocation } from "wouter";
import { Star, Send, ArrowLeft, Dog, Cat, Sparkles, ThumbsUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/lib/languageStore";

const feedbackSchema = z.object({
  stationId: z.string().min(1, "Please select a station"),
  overallRating: z.number().min(1).max(5),
  cleanlinessRating: z.number().min(1).max(5).optional(),
  equipmentRating: z.number().min(1).max(5).optional(),
  valueRating: z.number().min(1).max(5).optional(),
  easeOfUseRating: z.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  petName: z.string().max(50).optional(),
  petType: z.string().optional(),
  serviceType: z.string().optional(),
  wouldRecommend: z.boolean().optional(),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

function StarRating({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="transition-transform hover:scale-110 focus:outline-none"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            size={size}
            className={`transition-colors ${
              star <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

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
              : "text-gray-300 dark:text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

export default function GroomingFeedback() {
  const { t, dir, language } = useLanguage();
  const isRtl = dir === "rtl";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);

  const { data: stationsData, isLoading: stationsLoading } = useQuery<{ stations: any[] }>({
    queryKey: ["/api/grooming-feedback/all-stations"],
  });

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      stationId: "",
      overallRating: 0,
      cleanlinessRating: undefined,
      equipmentRating: undefined,
      valueRating: undefined,
      easeOfUseRating: undefined,
      comment: "",
      petName: "",
      petType: "",
      serviceType: "self_service_wash",
      wouldRecommend: true,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      const res = await apiRequest("POST", "/api/grooming-feedback/submit", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/grooming-feedback"] });
      toast({
        title: t("groomingFeedback.successTitle"),
        description: t("groomingFeedback.successMessage"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("groomingFeedback.errorTitle"),
        description: error.message || t("groomingFeedback.errorMessage"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FeedbackFormData) => {
    if (data.overallRating < 1) {
      toast({
        title: t("groomingFeedback.errorTitle"),
        description: t("groomingFeedback.ratingRequired"),
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate(data);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" dir={dir}>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
            {t("groomingFeedback.thankYouTitle")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
            {t("groomingFeedback.thankYouMessage")}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              onClick={() => { setSubmitted(false); form.reset(); }}
              variant="outline"
              className="border-amber-300 hover:bg-white dark:border-amber-700 dark:hover:bg-amber-900/20"
            >
              {t("groomingFeedback.submitAnother")}
            </Button>
            <Button
              onClick={() => setLocation("/grooming-reviews")}
              className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white"
            >
              {t("groomingFeedback.viewReviews")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" dir={dir}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => window.history.back()}
          className={`flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors ${isRtl ? "flex-row-reverse" : ""}`}
        >
          <ArrowLeft className={isRtl ? "rotate-180" : ""} size={18} />
          <span className="text-sm">{t("groomingFeedback.back")}</span>
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
            {t("groomingFeedback.pageTitle")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t("groomingFeedback.pageSubtitle")}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="border-amber-200/50 dark:border-amber-800/30 shadow-lg bg-white/80 dark:bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Dog className="w-5 h-5 text-amber-600" />
                  {t("groomingFeedback.serviceDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="stationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("groomingFeedback.selectStation")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("groomingFeedback.stationPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stationsLoading ? (
                            <SelectItem value="loading" disabled>{t("groomingFeedback.loading")}</SelectItem>
                          ) : (
                            stationsData?.stations?.map((station: any) => (
                              <SelectItem key={station.id} value={station.id.toString()}>
                                {(language === "he" && station.nameHe) ? station.nameHe : station.name} ({station.stationCode})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="petName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("groomingFeedback.petName")}</FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder={t("groomingFeedback.petNamePlaceholder")}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="petType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("groomingFeedback.petType")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("groomingFeedback.petTypePlaceholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="dog">{t("groomingFeedback.dog")}</SelectItem>
                            <SelectItem value="cat">{t("groomingFeedback.cat")}</SelectItem>
                            <SelectItem value="other">{t("groomingFeedback.other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("groomingFeedback.serviceTypeLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="self_service_wash">{t("groomingFeedback.selfServiceWash")}</SelectItem>
                          <SelectItem value="premium_wash">{t("groomingFeedback.premiumWash")}</SelectItem>
                          <SelectItem value="full_grooming">{t("groomingFeedback.fullGrooming")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-amber-200/50 dark:border-amber-800/30 shadow-lg bg-white/80 dark:bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-600" />
                  {t("groomingFeedback.ratingsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="overallRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">{t("groomingFeedback.overallRating")} *</FormLabel>
                      <FormControl>
                        <StarRating value={field.value} onChange={field.onChange} size={36} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                  <FormField
                    control={form.control}
                    name="cleanlinessRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-gray-600 dark:text-gray-400">{t("groomingFeedback.cleanliness")}</FormLabel>
                        <FormControl>
                          <StarRating value={field.value || 0} onChange={field.onChange} size={22} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="equipmentRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-gray-600 dark:text-gray-400">{t("groomingFeedback.equipment")}</FormLabel>
                        <FormControl>
                          <StarRating value={field.value || 0} onChange={field.onChange} size={22} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valueRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-gray-600 dark:text-gray-400">{t("groomingFeedback.valueForMoney")}</FormLabel>
                        <FormControl>
                          <StarRating value={field.value || 0} onChange={field.onChange} size={22} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="easeOfUseRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-gray-600 dark:text-gray-400">{t("groomingFeedback.easeOfUse")}</FormLabel>
                        <FormControl>
                          <StarRating value={field.value || 0} onChange={field.onChange} size={22} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200/50 dark:border-amber-800/30 shadow-lg bg-white/80 dark:bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-amber-600" />
                  {t("groomingFeedback.additionalDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("groomingFeedback.yourComments")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder={t("groomingFeedback.commentPlaceholder")}
                          className="resize-none"
                          maxLength={1000}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-400 mt-1">
                        {(field.value?.length || 0)}/1000
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wouldRecommend"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-lg border border-amber-200/50 dark:border-amber-800/30 p-4">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer">
                        {t("groomingFeedback.wouldRecommend")}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full h-12 text-base bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-lg"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("groomingFeedback.submitting")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send size={18} />
                  {t("groomingFeedback.submitFeedback")}
                </span>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
