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
      <div className="luxury-bg-mesh min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="luxury-grid-4 mb-8">
            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">
                  {isHebrew ? 'הזמנות היום' : 'Today\'s Bookings'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-today-bookings">0</div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">
                  {isHebrew ? 'הכנסות חודשיות' : 'Monthly Earnings'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-monthly-earnings">₪0</div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">
                  {isHebrew ? 'דירוג ממוצע' : 'Average Rating'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                  <Star className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-avg-rating">--</div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">
                  {isHebrew ? 'חיות מחמד שטופלו' : 'Pets Cared For'}
                </h3>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="kpi-pets-cared">0</div>
            </div>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-5">
            <h2 className="luxury-heading-md mb-6">
              {isHebrew ? 'הזמנות קרובות' : 'Upcoming Bookings'}
            </h2>
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
              <p className="luxury-text-body text-gray-500">
                {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
              </p>
              <p className="luxury-text-small text-gray-400 mt-2">
                {isHebrew ? 'ההזמנות שלך יופיעו כאן' : 'Your bookings will appear here'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </LuxuryPageWrapper>
  );
}
