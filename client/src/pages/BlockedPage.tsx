import { useLocation } from "wouter";
import { ShieldX, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he");
  } catch {
    return false;
  }
};

export default function BlockedPage() {
  const [, setLocation] = useLocation();
  const he = isHebrew();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <Card className="max-w-md w-full mx-auto bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-red-500" />
          </div>
          <CardTitle className="text-xl">
            {he ? "החשבון הושעה" : "Account Suspended"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {he
              ? "החשבון שלך הושעה. לפרטים נוספים או לערעור, אנא צור קשר עם התמיכה שלנו."
              : "Your account has been suspended. For more details or to appeal, please contact our support team."}
          </p>
          <div className="bg-neutral-50 rounded-lg p-3">
            <a
              href="mailto:support@petwash.co.il"
              className="text-primary font-medium text-sm hover:underline"
            >
              support@petwash.co.il
            </a>
          </div>
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
