import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, Star, Heart } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';

export default function SitterDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title={isHebrew ? 'לוח בקרה למטפל' : 'Sitter Dashboard'}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'הזמנות היום' : 'Today\'s Bookings'}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-today-bookings">0</div>
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
                {isHebrew ? 'חיות מחמד שטופלו' : 'Pets Cared For'}
              </CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-pets-cared">0</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isHebrew ? 'הזמנות קרובות' : 'Upcoming Bookings'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">
              {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
            </p>
          </CardContent>
        </Card>
      </div>
    </LuxuryPageWrapper>
  );
}
