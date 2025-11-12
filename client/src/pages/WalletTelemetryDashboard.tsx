/**
 * Wallet Telemetry Dashboard
 * 
 * Admin-only dashboard for viewing AI-assisted wallet pass success rates.
 * Shows real-time statistics on Apple/Google Wallet pass additions with
 * confidence scores and heuristic-based success inference.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    enabled: true
  });

  const handleCleanup = async () => {
    try {
      await fetch('/api/wallet/telemetry/cleanup', {
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
    <div className="container mx-auto p-6 space-y-6" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Wallet className="w-8 h-8 text-blue-600" />
            {t.title}
          </h1>
          <p className="text-muted-foreground mt-2">{t.description}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t.refresh}
          </Button>
          <Button onClick={handleCleanup} variant="outline" size="sm">
            {t.cleanup}
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
        <TabsList>
          <TabsTrigger value="today">{t.today}</TabsTrigger>
          <TabsTrigger value="week">{t.week}</TabsTrigger>
          <TabsTrigger value="month">{t.month}</TabsTrigger>
        </TabsList>
      </Tabs>

      {!telemetry || telemetry.total === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t.noData}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{t.totalAttempts}</CardDescription>
                <CardTitle className="text-3xl">{telemetry.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="w-4 h-4" />
                  {t.successRate}: {successRate}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{t.confirmedSuccess}</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {telemetry.confirmedSuccess}
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-green-600">
                  {((telemetry.confirmedSuccess / telemetry.total) * 100).toFixed(1)}%
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{t.likelySuccess}</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {telemetry.likelySuccess}
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-blue-600">
                  {((telemetry.likelySuccess / telemetry.total) * 100).toFixed(1)}%
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{t.avgConfidence}</CardDescription>
                <CardTitle className="text-3xl">{telemetry.avgConfidence.toFixed(0)}%</CardTitle>
              </CardHeader>
              <CardContent>
                {telemetry.avgConfidence >= 80 && <Badge className="bg-green-600">High</Badge>}
                {telemetry.avgConfidence >= 50 && telemetry.avgConfidence < 80 && <Badge className="bg-blue-600">Medium</Badge>}
                {telemetry.avgConfidence < 50 && <Badge className="bg-amber-600">Low</Badge>}
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  {t.failed}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{telemetry.failed}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  {((telemetry.failed / telemetry.total) * 100).toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-gray-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-600" />
                  {t.abandoned}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{telemetry.abandoned}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  {((telemetry.abandoned / telemetry.total) * 100).toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  {t.platforms}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{t.appleWallet}:</span>
                  <Badge>{telemetry.platforms.apple}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>{t.googleWallet}:</span>
                  <Badge>{telemetry.platforms.google}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pass Types */}
          <Card>
            <CardHeader>
              <CardTitle>{t.passTypes}</CardTitle>
              <CardDescription>Breakdown by pass type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{telemetry.passTypes.vip}</div>
                  <div className="text-sm text-muted-foreground">{t.vipCards}</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{telemetry.passTypes.business}</div>
                  <div className="text-sm text-muted-foreground">{t.businessCards}</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{telemetry.passTypes.voucher}</div>
                  <div className="text-sm text-muted-foreground">{t.vouchers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
