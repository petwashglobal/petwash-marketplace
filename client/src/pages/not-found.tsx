import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/languageStore";

export default function NotFound() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardContent className="pt-8 pb-6">
          <div className={`flex mb-6 gap-3 items-center ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <AlertCircle className="h-10 w-10 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">404</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {isHebrew ? 'הדף לא נמצא' : 'Page Not Found'}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400" dir={isHebrew ? 'rtl' : 'ltr'}>
            {isHebrew 
              ? 'הדף שחיפשת לא קיים או הוסר. אנא בדוק את הכתובת או חזור לדף הבית.'
              : 'The page you are looking for does not exist or has been removed. Please check the URL or return to the home page.'}
          </p>

          <Link href="/">
            <Button 
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              data-testid="button-return-home"
            >
              <Home className={`h-4 w-4 ${isHebrew ? 'ml-2' : 'mr-2'}`} />
              {isHebrew ? 'חזרה לדף הבית' : 'Return to Home'}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
