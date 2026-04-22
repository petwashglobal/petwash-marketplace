/**
 * Accounting Dashboard
 * 
 * AI Bookkeeping & Israeli Compliance 2025/2026
 * Export to Google Sheets, VAT reports, escrow tracking
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getApiUrl } from '@/lib/apiConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import { 
  FileSpreadsheet, Download, Brain, Shield, 
  Calculator, Wallet, TrendingUp, Clock,
  Loader2, ExternalLink, RefreshCw, CheckCircle
} from "lucide-react";

export default function AccountingDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['/api/accounting/summary', year, month],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/accounting/summary?year=${year}&month=${month}`));
      if (!res.ok) return null;
      return res.json();
    },
  });

  const exportTransactionsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getApiUrl('/api/accounting/export/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeAI: true }),
      });
      if (!res.ok) throw new Error('Export failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: isHebrew ? 'הייצוא הושלם!' : 'Export Complete!',
        description: `${data.exportedCount} transactions exported`,
      });
      if (data.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה בייצוא' : 'Export Error',
        variant: 'destructive',
      });
    },
  });

  const exportComplianceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getApiUrl('/api/accounting/export/compliance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) throw new Error('Export failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: isHebrew ? 'דו"ח תאימות יוצא!' : 'Compliance Report Exported!',
      });
      if (data.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        variant: 'destructive',
      });
    },
  });

  const exportEscrowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getApiUrl('/api/accounting/export/escrow'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Export failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: isHebrew ? 'מצב נאמנות יוצא!' : 'Escrow Status Exported!',
        description: `${data.exportedCount} records`,
      });
      if (data.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', variant: 'destructive' });
    },
  });

  const metrics = summary?.data?.metrics;
  const taxes = summary?.data?.taxes;
  const compliance = summary?.data?.complianceStatus;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-black flex items-center gap-3">
              <Calculator className="h-8 w-8 text-pink-500" />
              {isHebrew ? 'הנהלת חשבונות ותאימות' : 'Accounting & Compliance'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {isHebrew 
                ? 'ניהול AI, ייצוא ל-Google Sheets, תאימות מס ישראלי 2025'
                : 'AI Bookkeeping, Google Sheets Export, Israeli Tax Compliance 2025'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[120px]" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2024, m-1).toLocaleString(isHebrew ? 'he' : 'en', { month: 'short' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => refetchSummary()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {summaryLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white" data-testid="card-revenue">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg opacity-90 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {isHebrew ? 'סה"כ הכנסות' : 'Total Revenue'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ₪{(metrics?.totalRevenue?.amount || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white" data-testid="card-fees">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg opacity-90 flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    {isHebrew ? 'עמלות פלטפורמה' : 'Platform Fees'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ₪{(metrics?.platformFees?.amount || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white" data-testid="card-payouts">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg opacity-90 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {isHebrew ? 'תשלום לספקים' : 'Provider Payouts'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ₪{(metrics?.providerPayouts?.amount || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white" data-testid="card-escrow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg opacity-90 flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {isHebrew ? 'בנאמנות' : 'In Escrow'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ₪{(metrics?.escrowHeld?.amount || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="export" className="space-y-4">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="export" data-testid="tab-export">
                  {isHebrew ? 'ייצוא' : 'Export'}
                </TabsTrigger>
                <TabsTrigger value="taxes" data-testid="tab-taxes">
                  {isHebrew ? 'מיסים' : 'Taxes'}
                </TabsTrigger>
                <TabsTrigger value="compliance" data-testid="tab-compliance">
                  {isHebrew ? 'תאימות' : 'Compliance'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="export">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        {isHebrew ? 'ייצוא עסקאות' : 'Export Transactions'}
                      </CardTitle>
                      <CardDescription>
                        {isHebrew 
                          ? 'ייצא את כל עסקאות ההזמנות ל-Google Sheets עם סיווג AI'
                          : 'Export all booking transactions to Google Sheets with AI classification'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => exportTransactionsMutation.mutate()}
                        disabled={exportTransactionsMutation.isPending}
                        data-testid="button-export-transactions"
                      >
                        {exportTransactionsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {isHebrew ? 'ייצא עסקאות' : 'Export Transactions'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-600" />
                        {isHebrew ? 'דו"ח תאימות' : 'Compliance Report'}
                      </CardTitle>
                      <CardDescription>
                        {isHebrew 
                          ? 'יצר דו"ח מס ישראלי: מע"מ, ניכוי במקור, ביטוח לאומי'
                          : 'Generate Israeli tax report: VAT, Withholding, National Insurance'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        onClick={() => exportComplianceMutation.mutate()}
                        disabled={exportComplianceMutation.isPending}
                        data-testid="button-export-compliance"
                      >
                        {exportComplianceMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {isHebrew ? 'ייצא דו"ח' : 'Export Report'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-teal-600" />
                        {isHebrew ? 'מעקב נאמנות' : 'Escrow Tracking'}
                      </CardTitle>
                      <CardDescription>
                        {isHebrew 
                          ? 'ייצא את מצב הכספים המוחזקים בנאמנות'
                          : 'Export current escrow funds status'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        onClick={() => exportEscrowMutation.mutate()}
                        disabled={exportEscrowMutation.isPending}
                        data-testid="button-export-escrow"
                      >
                        {exportEscrowMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {isHebrew ? 'ייצא נאמנות' : 'Export Escrow'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="taxes">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card data-testid="card-vat">
                    <CardHeader>
                      <CardTitle className="text-blue-600">
                        {isHebrew ? 'מע"מ לתשלום' : 'VAT Payable'}
                      </CardTitle>
                      <CardDescription>
                        {isHebrew ? 'מס ערך מוסף 17%' : 'Value Added Tax 17%'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">
                        ₪{(taxes?.vatCollected?.amount || 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {isHebrew 
                          ? `יעד: ${compliance?.vatReportDue ? new Date(compliance.vatReportDue).toLocaleDateString('he') : 'N/A'}`
                          : `Due: ${compliance?.vatReportDue ? new Date(compliance.vatReportDue).toLocaleDateString() : 'N/A'}`}
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-withholding">
                    <CardHeader>
                      <CardTitle className="text-orange-600">
                        {isHebrew ? 'ניכוי מס במקור' : 'Withholding Tax'}
                      </CardTitle>
                      <CardDescription>
                        {isHebrew ? '20% תשלומים לספקים' : '20% on provider payouts'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600">
                        ₪{(taxes?.withholdingTax?.amount || 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {isHebrew 
                          ? `יעד: ${compliance?.withholdingReportDue ? new Date(compliance.withholdingReportDue).toLocaleDateString('he') : 'N/A'}`
                          : `Due: ${compliance?.withholdingReportDue ? new Date(compliance.withholdingReportDue).toLocaleDateString() : 'N/A'}`}
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-national-insurance">
                    <CardHeader>
                      <CardTitle className="text-green-600">
                        {isHebrew ? 'ביטוח לאומי' : 'National Insurance'}
                      </CardTitle>
                      <CardDescription>
                        {isHebrew ? 'דמי ביטוח לאומי ודמי בריאות' : 'National & Health Insurance'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">
                        ₪{(taxes?.nationalInsurance?.amount || 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {isHebrew 
                          ? `יעד: ${compliance?.nationalInsuranceDue ? new Date(compliance.nationalInsuranceDue).toLocaleDateString('he') : 'N/A'}`
                          : `Due: ${compliance?.nationalInsuranceDue ? new Date(compliance.nationalInsuranceDue).toLocaleDateString() : 'N/A'}`}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="compliance">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-indigo-600" />
                      {isHebrew ? 'תאימות מס ישראלי 2025/2026' : 'Israeli Tax Compliance 2025/2026'}
                    </CardTitle>
                    <CardDescription>
                      {isHebrew 
                        ? 'דרישות רשות המסים, ביטוח לאומי, וחוק מע"מ'
                        : 'Tax Authority, National Insurance, and VAT Law requirements'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">{isHebrew ? 'חוק מס ערך מוסף' : 'VAT Law (חוק מע"מ)'}</p>
                            <p className="text-sm text-gray-500">{isHebrew ? 'שיעור 17% על עמלות שירות' : '17% rate on service fees'}</p>
                          </div>
                        </div>
                        <span className="text-sm text-green-600 font-medium">{isHebrew ? 'תואם' : 'Compliant'}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white dark:bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">{isHebrew ? 'ניכוי מס במקור' : 'Withholding Tax'}</p>
                            <p className="text-sm text-gray-500">{isHebrew ? '20% ברירת מחדל (בכפוף לאישור)' : '20% default (subject to exemption)'}</p>
                          </div>
                        </div>
                        <span className="text-sm text-green-600 font-medium">{isHebrew ? 'תואם' : 'Compliant'}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white dark:bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">{isHebrew ? 'ביטוח לאומי' : 'National Insurance'}</p>
                            <p className="text-sm text-gray-500">{isHebrew ? 'שיעור מופחת 5.97% / רגיל 17.83%' : 'Reduced 5.97% / Regular 17.83%'}</p>
                          </div>
                        </div>
                        <span className="text-sm text-green-600 font-medium">{isHebrew ? 'תואם' : 'Compliant'}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white dark:bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">{isHebrew ? 'נאמנות (Escrow)' : 'Escrow Payments'}</p>
                            <p className="text-sm text-gray-500">{isHebrew ? '72 שעות החזקת תשלום' : '72-hour payment hold'}</p>
                          </div>
                        </div>
                        <span className="text-sm text-green-600 font-medium">{isHebrew ? 'תואם' : 'Compliant'}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white dark:bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">{isHebrew ? 'סיווג קבלני משנה' : 'Contractor Classification'}</p>
                            <p className="text-sm text-gray-500">{isHebrew ? 'מודל מתווך למניעת העסקה שגויה' : 'Broker model prevents misclassification'}</p>
                          </div>
                        </div>
                        <span className="text-sm text-green-600 font-medium">{isHebrew ? 'תואם' : 'Compliant'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
