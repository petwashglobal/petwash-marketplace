import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Star, TrendingUp } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';

export default function WalkerDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title={isHebrew ? 'לוח בקרה למטייל' : 'Walker Dashboard'}
    >
      <div className="luxury-bg-mesh min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="luxury-grid-4 mb-8">
            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {isHebrew ? 'הליכות היום' : 'Today\'s Walks'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-today-walks">0</div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {isHebrew ? 'הכנסות חודשיות' : 'Monthly Earnings'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-monthly-earnings">₪0</div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {isHebrew ? 'דירוג ממוצע' : 'Average Rating'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Star className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-avg-rating">--</div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {isHebrew ? 'סה״כ הליכות' : 'Total Walks'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-total-walks">0</div>
            </div>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-5">
            <h2 className="luxury-heading-md mb-6">
              {isHebrew ? 'הליכות קרובות' : 'Upcoming Walks'}
            </h2>
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mb-4">
                <Calendar className="h-10 w-10 text-purple-500" />
              </div>
              <p className="luxury-text-body text-center text-gray-500">
                {isHebrew ? 'אין הליכות מתוכננות' : 'No upcoming walks scheduled'}
              </p>
              <p className="luxury-text-small text-center text-gray-400 mt-2">
                {isHebrew ? 'הזדמנויות חדשות יופיעו כאן' : 'New opportunities will appear here'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </LuxuryPageWrapper>
  );
}
