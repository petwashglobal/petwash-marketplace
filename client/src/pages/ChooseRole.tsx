import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, Shield, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/apiConfig";

export default function ChooseRole() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";

  const handleChoice = async (intent: "customer" | "provider" | "staff_request") => {
    setLoading(intent);
    try {
      const res = await fetch(getApiUrl("/api/auth/choose-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ intent }),
      });
      const data = await res.json();
      if (data.redirectTo) {
        navigate(data.redirectTo);
      }
    } catch (err) {
      console.error("[ChooseRole] Error:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" dir={isHe ? "rtl" : "ltr"}>
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isHe ? "ברוכים הבאים ל-Pet Wash™" : "Welcome to Pet Wash™"}
          </h1>
          <p className="text-gray-600">
            {isHe ? "בחרו כיצד תרצו להשתמש בפלטפורמה" : "Choose how you'd like to use the platform"}
          </p>
        </div>

        <Card
          className="cursor-pointer border-2 hover:border-blue-500 hover:shadow-lg transition-all"
          onClick={() => !loading && handleChoice("customer")}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Search className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isHe ? "הזמנת שירותים" : "Book Services"}
              </h3>
              <p className="text-sm text-gray-500">
                {isHe
                  ? "שטיפה, טיפוח, שמרטפות, הולכת כלבים ועוד"
                  : "Washing, grooming, pet sitting, dog walking & more"}
              </p>
            </div>
            {loading === "customer" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-2 hover:border-emerald-500 hover:shadow-lg transition-all"
          onClick={() => !loading && handleChoice("provider")}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full">
              <Briefcase className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isHe ? "הפוך לנותן שירות" : "Become a Provider"}
              </h3>
              <p className="text-sm text-gray-500">
                {isHe
                  ? "הרוויחו כספטפן/ית, מטפל/ת, מפעיל/ת תחנת שטיפה"
                  : "Earn as a sitter, walker, or station operator"}
              </p>
            </div>
            {loading === "provider" && <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-2 hover:border-purple-500 hover:shadow-lg transition-all"
          onClick={() => !loading && handleChoice("staff_request")}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isHe ? "בקשת גישה לצוות" : "Staff / Admin Access"}
              </h3>
              <p className="text-sm text-gray-500">
                {isHe
                  ? "שליחת בקשת גישה להנהלה (דורש אישור)"
                  : "Request access from management (requires approval)"}
              </p>
            </div>
            {loading === "staff_request" && <Loader2 className="h-5 w-5 animate-spin text-purple-500" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
