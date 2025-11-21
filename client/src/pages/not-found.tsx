import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/languageStore";

export default function NotFound() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="min-h-screen w-full flex items-center justify-center luxury-bg-mesh dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md mx-4 luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-animate-scale-in">
        <CardContent className="pt-8 pb-6">
          <div className={`flex mb-6 gap-3 items-center ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <div className="relative">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <div className="absolute inset-0 h-10 w-10 bg-gradient-to-r from-purple-600 to-red-500 opacity-20 blur-xl rounded-full"></div>
            </div>
            <div>
              <h1 className="luxury-heading-lg">404</h1>
              <p className="luxury-heading-sm">
                {isHebrew ? 'הדף לא נמצא' : 'Page Not Found'}
              </p>
            </div>
          </div>

          <p className="mt-4 luxury-text-body" dir={isHebrew ? 'rtl' : 'ltr'}>
            {isHebrew 
              ? 'הדף שחיפשת לא קיים או הוסר. אנא בדוק את הכתובת או חזור לדף הבית.'
              : 'The page you are looking for does not exist or has been removed. Please check the URL or return to the home page.'}
          </p>

          <Link href="/">
            <button 
              className="luxury-btn-primary w-full mt-6 flex items-center justify-center"
              data-testid="button-return-home"
            >
              <Home className={`h-4 w-4 ${isHebrew ? 'ml-2' : 'mr-2'}`} />
              {isHebrew ? 'חזרה לדף הבית' : 'Return to Home'}
            </button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
