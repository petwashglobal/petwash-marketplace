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
      {/* Luxury Glass Container */}
      <div className="luxury-glass-card luxury-shadow-xl p-8 md:p-12">
        {/* Metallic Accent Corners */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-300/20 to-yellow-500/20 rounded-bl-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-300/20 to-cyan-500/20 rounded-tr-full -ml-16 -mb-16"></div>
        
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h3 className="luxury-heading-lg mb-4 luxury-text-gradient">
              {t('roi.title', language)}
            </h3>
            <p className="luxury-text-body">
              {t('roi.description', language)}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Input Controls */}
            <div className="space-y-8">
              {/* Investment Slider */}
              <div className="luxury-gap-sm">
                <div className="flex justify-between items-center mb-4">
                  <label className="luxury-heading-sm">
                    {t('roi.initialInvestment', language)}
                  </label>
                  <span className="luxury-heading-md luxury-text-gradient">
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
              <div className="luxury-gap-sm">
                <div className="flex justify-between items-center mb-4">
                  <label className="luxury-heading-sm">
                    {t('roi.monthlyCustomers', language)}
                  </label>
                  <span className="luxury-heading-md luxury-text-gradient">
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
              <div className="luxury-gap-sm">
                <div className="flex justify-between items-center mb-4">
                  <label className="luxury-heading-sm">
                    {t('roi.averageTicket', language)}
                  </label>
                  <span className="luxury-heading-md luxury-text-gradient">
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
            <div className="luxury-gap-md">
              {/* Monthly Revenue */}
              <div className="luxury-glass-minimal p-5 border border-blue-300/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="luxury-text-small mb-1">
                      {t('roi.monthlyRevenue', language)}
                    </div>
                    <div className="luxury-heading-lg luxury-text-gradient">
                      ${monthlyRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* Annual Profit */}
              <div className="luxury-glass-minimal p-5 border border-emerald-300/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="luxury-text-small mb-1">
                      {t('roi.annualProfit', language)}
                    </div>
                    <div className="luxury-heading-lg luxury-text-gradient">
                      ${annualProfit.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* ROI Percentage */}
              <div className="luxury-glass-minimal p-5 border border-amber-300/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="luxury-text-small mb-1">
                      {t('roi.annualROI', language)}
                    </div>
                    <div className="luxury-heading-lg luxury-text-gradient">
                      {roi}%
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* Payback Period */}
              <div className="luxury-glass-minimal p-5 border border-purple-300/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="luxury-text-small mb-1">
                      {t('roi.paybackPeriod', language)}
                    </div>
                    <div className="luxury-heading-lg luxury-text-gradient">
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
              <div className="luxury-badge luxury-badge-gold inline-flex items-center gap-2 px-6 py-3">
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
