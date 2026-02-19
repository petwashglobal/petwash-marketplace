import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he");
  } catch {
    return false;
  }
};

export default function StaffRejected() {
  const [, setLocation] = useLocation();
  const he = isHebrew();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <Card className="max-w-md w-full mx-auto bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <CardTitle className="text-xl">
            {he ? "בקשת הגישה לא אושרה" : "Access Request Not Approved"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {he
              ? "לצערנו, בקשת הגישה שלך לא אושרה. אנא פנה להנהלה לפרטים נוספים."
              : "Unfortunately, your access request was not approved. Please contact management for more details."}
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
