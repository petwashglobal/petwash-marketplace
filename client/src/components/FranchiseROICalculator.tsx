import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, DollarSign, Clock, Zap, Award } from 'lucide-react';
import { type Language, t } from '@/lib/i18n';

interface FranchiseROICalculatorProps {
  language: Language;
  onCalculatorUse?: () => void;
}

export function FranchiseROICalculator({ language, onCalculatorUse }: FranchiseROICalculatorProps) {
  const [investment, setInvestment] = useState([90000]);
  const [monthlyCustomers, setMonthlyCustomers] = useState([500]);
  const [avgTicket, setAvgTicket] = useState([35]);
  
  const handleSliderChange = (setter: (value: number[]) => void) => (value: number[]) => {
    setter(value);
    onCalculatorUse?.();
  };

  // Real-time calculations
  const monthlyRevenue = monthlyCustomers[0] * avgTicket[0];
  const annualRevenue = monthlyRevenue * 12;
  const operatingCosts = monthlyRevenue * 0.35; // 35% operating costs
  const monthlyProfit = monthlyRevenue - operatingCosts;
  const annualProfit = monthlyProfit * 12;
  const roi = ((annualProfit / investment[0]) * 100).toFixed(1);
  const paybackMonths = Math.ceil(investment[0] / monthlyProfit);
  const paybackYears = (paybackMonths / 12).toFixed(1);

  return (
    <div className="relative">
      {/* Glassmorphism Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/70 to-blue-50/70 dark:from-gray-800/70 dark:to-blue-950/70 backdrop-blur-3xl border border-white/40 shadow-2xl p-8 md:p-12">
        {/* Metallic Accent Corners */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-300/20 to-yellow-500/20 rounded-bl-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-300/20 to-cyan-500/20 rounded-tr-full -ml-16 -mb-16"></div>
        
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h3 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #F9D976 50%, #D4AF37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {t('roi.title', language)}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('roi.description', language)}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Input Controls */}
            <div className="space-y-8">
              {/* Investment Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('roi.initialInvestment', language)}
                  </label>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    ${investment[0].toLocaleString()}
                  </span>
                </div>
                <Slider
                  value={investment}
                  onValueChange={handleSliderChange(setInvestment)}
                  min={70000}
                  max={150000}
                  step={5000}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>$70K</span>
                  <span>$150K</span>
                </div>
              </div>

              {/* Monthly Customers Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('roi.monthlyCustomers', language)}
                  </label>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {monthlyCustomers[0].toLocaleString()}
                  </span>
                </div>
                <Slider
                  value={monthlyCustomers}
                  onValueChange={handleSliderChange(setMonthlyCustomers)}
                  min={200}
                  max={1000}
                  step={50}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>200</span>
                  <span>1,000</span>
                </div>
              </div>

              {/* Average Ticket Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('roi.averageTicket', language)}
                  </label>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    ${avgTicket[0]}
                  </span>
                </div>
                <Slider
                  value={avgTicket}
                  onValueChange={handleSliderChange(setAvgTicket)}
                  min={20}
                  max={60}
                  step={5}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>$20</span>
                  <span>$60</span>
                </div>
              </div>
            </div>

            {/* Real-Time Results */}
            <div className="space-y-4">
              {/* Monthly Revenue */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-400/20 to-cyan-500/20 backdrop-blur-xl border border-blue-300/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('roi.monthlyRevenue', language)}
                    </div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      ${monthlyRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* Annual Profit */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400/20 to-green-500/20 backdrop-blur-xl border border-emerald-300/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('roi.annualProfit', language)}
                    </div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${annualProfit.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* ROI Percentage */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-500/20 backdrop-blur-xl border border-amber-300/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('roi.annualROI', language)}
                    </div>
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {roi}%
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* Payback Period */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-400/20 to-pink-500/20 backdrop-blur-xl border border-purple-300/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('roi.paybackPeriod', language)}
                    </div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {paybackYears} {t('roi.years', language)}
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Achievement Badge for Good ROI */}
          {parseFloat(roi) > 150 && (
            <div className="mt-8 text-center animate-bounce">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white rounded-full shadow-2xl">
                <Award className="w-6 h-6" />
                <span className="font-bold">
                  {t('roi.excellentROI', language)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
