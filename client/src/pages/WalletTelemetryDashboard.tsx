/**
 * Wallet Telemetry Dashboard
 * 
 * Admin-only dashboard for viewing AI-assisted wallet pass success rates.
 * Shows real-time statistics on Apple/Google Wallet pass additions with
 * confidence scores and heuristic-based success inference.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from "@/lib/apiConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

interface TelemetryStats {
  total: number;
  confirmedSuccess: number;
  likelySuccess: number;
  failed: number;
  abandoned: number;
  avgConfidence: number;
  platforms: {
    apple: number;
    google: number;
  };
  passTypes: {
    vip: number;
    business: number;
    voucher: number;
  };
}

export default function WalletTelemetryDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  const { data: stats, isLoading, refetch } = useQuery<{ stats: TelemetryStats }>({
    queryKey: ['/api/wallet/telemetry/stats', timeRange],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/wallet/telemetry/stats?range=${timeRange}`), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch telemetry stats');
      return res.json();
    },
  });

  const handleCleanup = async () => {
    try {
      await fetch(getApiUrl('/api/wallet/telemetry/cleanup'), {
        method: 'POST',
        credentials: 'include'
      });
      alert('Old telemetry data cleaned up successfully!');
      refetch();
    } catch (error) {
      alert('Failed to cleanup telemetry data');
    }
  };

  const content = {
    en: {
      title: 'Wallet Telemetry Dashboard',
      description: 'AI-assisted monitoring of wallet pass success rates with heuristic inference',
      timeRangeLabel: 'Time Range',
      today: 'Today',
      week: 'This Week',
      month: 'This Month',
      overview: 'Overview',
      platforms: 'Platforms',
      passTypes: 'Pass Types',
      totalAttempts: 'Total Attempts',
      confirmedSuccess: 'Confirmed Success',
      likelySuccess: 'Likely Success',
      failed: 'Failed',
      abandoned: 'Abandoned',
      avgConfidence: 'Average Confidence',
      appleWallet: 'Apple Wallet',
      googleWallet: 'Google Wallet',
      vipCards: 'VIP Cards',
      businessCards: 'Business Cards',
      vouchers: 'Vouchers',
      successRate: 'Success Rate',
      cleanup: 'Cleanup Old Data',
      refresh: 'Refresh',
      noData: 'No telemetry data available for selected time range',
      highConfidence: 'High confidence (Passbook installer detected)',
      mediumConfidence: 'Medium confidence (visibility change detected)',
      lowConfidence: 'Low confidence (minimal signals)'
    },
    he: {
      title: 'לוח בקרת טלמטריה - Wallet',
      description: 'ניטור מתקדם עם AI של שיעורי הצלחה בהוספת כרטיסי Wallet',
      timeRangeLabel: 'טווח זמן',
      today: 'היום',
      week: 'השבוע',
      month: 'החודש',
      overview: 'סקירה כללית',
      platforms: 'פלטפורמות',
      passTypes: 'סוגי כרטיסים',
      totalAttempts: 'סה"כ ניסיונות',
      confirmedSuccess: 'הצלחה מאומתת',
      likelySuccess: 'הצלחה צפויה',
      failed: 'נכשל',
      abandoned: 'ננטש',
      avgConfidence: 'ממוצע רמת ביטחון',
      appleWallet: 'Apple Wallet',
      googleWallet: 'Google Wallet',
      vipCards: 'כרטיסי VIP',
      businessCards: 'כרטיסי ביקור',
      vouchers: 'שוברים',
      successRate: 'שיעור הצלחה',
      cleanup: 'ניקוי נתונים ישנים',
      refresh: 'רענון',
      noData: 'אין נתוני טלמטריה זמינים לטווח הזמן שנבחר',
      highConfidence: 'רמת ביטחון גבוהה (זוהה התקנת Passbook)',
      mediumConfidence: 'רמת ביטחון בינונית (זוהה שינוי visibility)',
      lowConfidence: 'רמת ביטחון נמוכה (סימנים מינימליים)'
    }
  };

  const t = content[isHebrew ? 'he' : 'en'];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  const telemetry = stats?.stats;
  const successRate = telemetry 
    ? ((telemetry.confirmedSuccess + telemetry.likelySuccess) / telemetry.total * 100).toFixed(1)
    : '0';

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title={t.title}
      subtitle={t.description}
      icon={<Wallet className="w-8 h-8 text-blue-600" />}
    >
      <div className="luxury-container p-6 space-y-8" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-end gap-3 luxury-animate-fade-in">
        <button onClick={() => refetch()} className="luxury-btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          {t.refresh}
        </button>
        <button onClick={handleCleanup} className="luxury-btn-secondary">
          {t.cleanup}
        </button>
      </div>

      {/* Time Range Selector */}
      <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-slide-up luxury-delay-1">
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList className="bg-transparent">
            <TabsTrigger value="today" className="luxury-btn-secondary data-[state=active]:luxury-btn-primary">{t.today}</TabsTrigger>
            <TabsTrigger value="week" className="luxury-btn-secondary data-[state=active]:luxury-btn-primary">{t.week}</TabsTrigger>
            <TabsTrigger value="month" className="luxury-btn-secondary data-[state=active]:luxury-btn-primary">{t.month}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!telemetry || telemetry.total === 0 ? (
        <div className="luxury-glass-card luxury-shadow-xl p-16 text-center luxury-animate-scale-in luxury-delay-2">
          <Clock className="w-16 h-16 mx-auto mb-6 text-purple-600 opacity-50" />
          <p className="luxury-text-body">{t.noData}</p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="luxury-grid-4 luxury-animate-slide-up luxury-delay-2">
            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6">
              <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-purple-600" />
              </div>
              <p className="luxury-text-small mb-2">{t.totalAttempts}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient mb-3">{telemetry.total}</h3>
              <div className="flex items-center gap-2 luxury-text-small">
                <Wallet className="w-4 h-4 text-purple-600" />
                {t.successRate}: {successRate}%
              </div>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6">
              <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="luxury-text-small mb-2">{t.confirmedSuccess}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient mb-3">{telemetry.confirmedSuccess}</h3>
              <span className="luxury-badge luxury-badge-success">
                {((telemetry.confirmedSuccess / telemetry.total) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6">
              <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <p className="luxury-text-small mb-2">{t.likelySuccess}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient mb-3">{telemetry.likelySuccess}</h3>
              <span className="luxury-badge luxury-badge-gold">
                {((telemetry.likelySuccess / telemetry.total) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6">
              <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <p className="luxury-text-small mb-2">{t.avgConfidence}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient mb-3">{telemetry.avgConfidence.toFixed(0)}%</h3>
              {telemetry.avgConfidence >= 80 && <span className="luxury-badge luxury-badge-success">High</span>}
              {telemetry.avgConfidence >= 50 && telemetry.avgConfidence < 80 && <span className="luxury-badge luxury-badge-gold">Medium</span>}
              {telemetry.avgConfidence < 50 && <span className="luxury-badge">Low</span>}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="luxury-grid-3 luxury-animate-slide-up luxury-delay-3">
            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6 border-l-4 border-l-red-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="luxury-heading-sm">{t.failed}</h3>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient mb-2">{telemetry.failed}</div>
              <p className="luxury-text-small">
                {((telemetry.failed / telemetry.total) * 100).toFixed(1)}% of total
              </p>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6 border-l-4 border-l-gray-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-900/30 dark:to-slate-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-gray-600" />
                </div>
                <h3 className="luxury-heading-sm">{t.abandoned}</h3>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient mb-2">{telemetry.abandoned}</div>
              <p className="luxury-text-small">
                {((telemetry.abandoned / telemetry.total) * 100).toFixed(1)}% of total
              </p>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-6 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="luxury-heading-sm">{t.platforms}</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="luxury-text-small">{t.appleWallet}:</span>
                  <span className="luxury-badge luxury-badge-gold">{telemetry.platforms.apple}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="luxury-text-small">{t.googleWallet}:</span>
                  <span className="luxury-badge luxury-badge-success">{telemetry.platforms.google}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pass Types */}
          <div className="luxury-glass-card luxury-shadow-xl overflow-hidden luxury-animate-scale-in luxury-delay-4">
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 p-6">
              <h2 className="luxury-heading-lg">{t.passTypes}</h2>
              <p className="luxury-text-small">Breakdown by pass type</p>
            </div>
            <div className="p-8">
              <div className="luxury-grid-3">
                <div className="luxury-glass-minimal p-8 rounded-xl text-center luxury-hover-lift">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient mb-2">{telemetry.passTypes.vip}</div>
                  <div className="luxury-text-small">{t.vipCards}</div>
                </div>
                <div className="luxury-glass-minimal p-8 rounded-xl text-center luxury-hover-lift">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient mb-2">{telemetry.passTypes.business}</div>
                  <div className="luxury-text-small">{t.businessCards}</div>
                </div>
                <div className="luxury-glass-minimal p-8 rounded-xl text-center luxury-hover-lift">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient mb-2">{telemetry.passTypes.voucher}</div>
                  <div className="luxury-text-small">{t.vouchers}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </LuxuryPageWrapper>
  );
}
