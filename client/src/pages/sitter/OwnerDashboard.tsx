import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Heart, Search, Star } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

export default function OwnerDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" dir={isHebrew ? 'rtl' : 'ltr'}>
          {isHebrew ? 'לוח בקרה לבעלים' : 'Pet Owner Dashboard'}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'הזמנות פעילות' : 'Active Bookings'}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-active-bookings">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'מטפלים מועדפים' : 'Favorite Sitters'}
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-favorite-sitters">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'חיות מחמד' : 'My Pets'}
              </CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="kpi-my-pets">0</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isHebrew ? 'הזמנות קרובות' : 'Upcoming Bookings'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
              </p>
              <Button data-testid="button-find-sitter">
                <Search className="mr-2 h-4 w-4" />
                {isHebrew ? 'מצא מטפל' : 'Find a Sitter'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
