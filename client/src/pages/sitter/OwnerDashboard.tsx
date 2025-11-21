import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Heart, Search, Star } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

export default function OwnerDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="luxury-heading-xl luxury-text-gradient mb-8" dir={isHebrew ? 'rtl' : 'ltr'}>
          {isHebrew ? 'לוח בקרה לבעלים' : 'Pet Owner Dashboard'}
        </h1>

        <div className="luxury-grid-3 gap-6 mb-8">
          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isHebrew ? 'הזמנות פעילות' : 'Active Bookings'}
              </CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl bg-blue-50">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-active-bookings">0</div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isHebrew ? 'מטפלים מועדפים' : 'Favorite Sitters'}
              </CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl bg-amber-50">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-favorite-sitters">0</div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isHebrew ? 'חיות מחמד' : 'My Pets'}
              </CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl bg-pink-50">
                <Heart className="h-5 w-5 text-pink-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-my-pets">0</div>
            </CardContent>
          </Card>
        </div>

        <Card className="luxury-glass-card luxury-shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">{isHebrew ? 'הזמנות קרובות' : 'Upcoming Bookings'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-6 text-lg">
                {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
              </p>
              <Button className="luxury-btn-primary" data-testid="button-find-sitter">
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
