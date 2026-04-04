import { useLocation } from "wouter";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he");
  } catch {
    return false;
  }
};

export default function StaffPending() {
  const [, setLocation] = useLocation();
  const he = isHebrew();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <Card className="max-w-md w-full mx-auto bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-xl">
            {he ? "בקשת הגישה ממתינה" : "Access Request Pending"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {he
              ? "בקשת הגישה שלך נמצאת בבדיקה על ידי ההנהלה. נעדכן אותך ברגע שהבקשה תאושר."
              : "Your access request is being reviewed by management. We'll notify you once it's approved."}
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
