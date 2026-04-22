import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/languageStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const DISPUTE_REASONS: {
  value: string;
  labelEn: string;
  labelHe: string;
}[] = [
  { value: "service_not_received", labelEn: "Service not received", labelHe: "לא קיבלתי את השירות" },
  { value: "poor_quality", labelEn: "Poor quality", labelHe: "איכות ירודה" },
  { value: "wrong_service", labelEn: "Wrong service performed", labelHe: "שירות שגוי בוצע" },
  { value: "no_show", labelEn: "Provider no-show", labelHe: "הנותן שירות לא הגיע" },
  { value: "damage", labelEn: "Damage caused", labelHe: "נגרם נזק" },
  { value: "safety_concern", labelEn: "Safety concern", labelHe: "חשש לבטיחות" },
  { value: "other", labelEn: "Other", labelHe: "אחר" },
];

export default function ReportProblemPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const disputeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/disputes", {
        bookingId,
        bookingType: "marketplace",
        reason,
        description: description.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: isHebrew ? "הדיווח נשלח" : "Report submitted",
        description: isHebrew
          ? "הצוות שלנו יטפל בפנייה תוך 24 שעות"
          : "Our team will handle this within 24 hours",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: isHebrew ? "שגיאה" : "Error",
        description: err?.message || (isHebrew ? "שגיאה בשליחת הדיווח" : "Failed to submit report"),
      });
    },
  });

  const handleSubmit = () => {
    if (!reason) {
      toast({
        variant: "destructive",
        title: isHebrew ? "בחר סיבה" : "Select a reason",
      });
      return;
    }
    disputeMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {isHebrew ? "נדרשת התחברות" : "Login required"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isHebrew ? "הדיווח נשלח" : "Report Submitted"}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">
              {isHebrew
                ? "הצוות שלנו יבחן את הפנייה ויצור איתך קשר תוך 24 שעות"
                : "Our team will review your report and reach out within 24 hours"}
            </p>
            <div className="flex items-center justify-center gap-2 text-purple-600 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              {isHebrew ? "PetWash™ ערבות השירות מגנה עליך" : "PetWash™ Service Guarantee protects you"}
            </div>
            <Button
              onClick={() => navigate("/bookings")}
              className="luxury-btn-primary luxury-shadow-xl"
            >
              {isHebrew ? "לכל ההזמנות" : "My Bookings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 p-4"
      dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}
    >
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6 pt-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-black">
              {isHebrew ? "דיווח על בעיה" : "Report a Problem"}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isHebrew
              ? `הזמנה #${bookingId?.slice(0, 8)}`
              : `Booking #${bookingId?.slice(0, 8)}`}
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">
              {isHebrew ? "מהי הבעיה?" : "What is the issue?"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-3">
              {DISPUTE_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-3 rtl:space-x-reverse">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="cursor-pointer font-normal">
                    {isHebrew ? r.labelHe : r.labelEn}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-black block mb-2">
                {isHebrew ? "פרטים נוספים (אופציונלי)" : "Additional details (optional)"}
              </label>
              <Textarea
                placeholder={
                  isHebrew
                    ? "תאר את הבעיה בפירוט..."
                    : "Describe the issue in detail..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 dark:bg-white dark:border-purple-800">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  {isHebrew
                    ? "PetWash™ מציעה ערבות שביעות רצון. אם השירות לא עמד בסטנדרטים שלנו, נפעל לפתרון."
                    : "PetWash™ offers a satisfaction guarantee. If the service didn't meet our standards, we will work to resolve it."}
                </p>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!reason || disputeMutation.isPending}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              {disputeMutation.isPending
                ? isHebrew
                  ? "שולח..."
                  : "Submitting..."
                : isHebrew
                ? "שלח דיווח"
                : "Submit Report"}
            </Button>

            <Button
              variant="ghost"
              className="w-full text-gray-500"
              onClick={() => navigate(-1 as any)}
            >
              {isHebrew ? "ביטול" : "Cancel"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
