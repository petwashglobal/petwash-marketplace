import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, Star, TrendingUp } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

export default function ProviderDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" dir={isHebrew ? 'rtl' : 'ltr'}>
          {isHebrew ? 'לוח בקרה לנהג' : 'Driver Dashboard'}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'נסיעות היום' : 'Today\'s Trips'}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-today-trips">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'הכנסות חודשיות' : 'Monthly Earnings'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-monthly-earnings">₪0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'דירוג ממוצע' : 'Average Rating'}
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-avg-rating">--</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'סה״כ נסיעות' : 'Total Trips'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-total-trips">0</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isHebrew ? 'נסיעות פעילות' : 'Active Trips'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">
              {isHebrew ? 'אין נסיעות פעילות' : 'No active trips'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
