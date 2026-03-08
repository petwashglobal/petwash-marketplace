import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth } from "@/auth/AuthProvider";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he");
  } catch {
    return false;
  }
};

export default function ProviderPending() {
  const [, setLocation] = useLocation();
  const he = isHebrew();
  const { user } = useFirebaseAuth();
  const [checking, setChecking] = useState(false);
  const [rejected, setRejected] = useState(false);

  const checkStatus = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const token = await user.getIdToken(true);
      const decodedToken = await user.getIdTokenResult(true);
      const claims = decodedToken.claims as any;

      if (claims?.role === "provider" || claims?.accountType === "provider") {
        setLocation("/provider/dashboard");
        return;
      }

      const res = await fetch("/api/provider-review/my-status/any", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "rejected") {
          setRejected(true);
        } else if (data.status === "approved") {
          setLocation("/provider/dashboard");
        }
      }
    } catch {
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkStatus();
    }
  }, [user]);

  if (rejected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
        <Card className="max-w-md w-full mx-auto bg-white">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-xl">
              {he ? "הבקשה לא אושרה" : "Application Not Approved"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {he
                ? "לצערנו בקשתך לא אושרה בשלב זה. ניתן לפנות לתמיכה לקבלת פרטים נוספים."
                : "Unfortunately your application was not approved at this time. Please contact support for more information."}
            </p>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              {he ? "חזרה לדף הבית" : "Back to Home"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <Card className="max-w-md w-full mx-auto bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-300" />
            </div>
          </div>
          <CardTitle className="text-xl">
            {he ? "הבקשה שלך בבדיקה" : "Application Under Review"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {he
              ? "הבקשה שלך להצטרף כספק שירות התקבלה ונמצאת בבדיקה. נעדכן אותך ברגע שתאושר."
              : "Your application to join as a service provider has been received and is currently under review. We'll notify you once it's approved."}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={checkStatus}
            disabled={checking}
          >
            {checking ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {he ? "בדוק סטטוס" : "Check Status"}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setLocation("/")}
          >
            {he ? "חזרה לדף הבית" : "Back to Home"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
