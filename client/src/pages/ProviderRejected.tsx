import { useLocation } from "wouter";
import { XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he");
  } catch {
    return false;
  }
};

export default function ProviderRejected() {
  const [, setLocation] = useLocation();
  const he = isHebrew();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <Card className="max-w-md w-full mx-auto bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <CardTitle className="text-xl">
            {he ? "הבקשה לא אושרה" : "Application Not Approved"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {he
              ? "לצערנו, הבקשה שלך לא אושרה בשלב זה. אתה מוזמן לפנות אלינו לפרטים נוספים או להגיש בקשה מחדש."
              : "Unfortunately, your application was not approved at this time. You're welcome to contact us for more details or reapply."}
          </p>
          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => window.open("mailto:support@petwash.co.il", "_blank")}
            >
              <Mail className="w-4 h-4" />
              {he ? "פנייה לתמיכה" : "Contact Support"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/")}
            >
              {he ? "חזרה לדף הבית" : "Back to Home"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
