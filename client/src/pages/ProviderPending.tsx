import { useLocation } from "wouter";
import { Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
            onClick={() => setLocation("/")}
          >
            {he ? "חזרה לדף הבית" : "Back to Home"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
