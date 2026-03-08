import { useState } from "react";
import { Link } from "wouter";
import { getApiUrl } from '@/lib/apiConfig';
import { Layout } from "@/components/Layout";
import { type Language } from "@/lib/i18n";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Download,
  Clock,
  CreditCard,
  Wallet,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Search,
  Filter,
  BarChart3,
  PieChart,
  Send,
  Mail,
  Heart,
  Loader2,
  Receipt,
  Building2,
  Briefcase,
  Truck,
  Zap,
  Users,
  ShieldCheck,
  Banknote,
  ExternalLink,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import type { MoneyFlowSummary } from "../../../shared/finance-flow-types";

interface AdminFinancialProps {
  language: Language;
}

export default function AdminFinancial({ language }: AdminFinancialProps) {
  const isHebrew = language === 'he';
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [txSearch, setTxSearch] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState('bronze');
  const [loyaltyLang, setLoyaltyLang] = useState('he');
  const [seasonalTheme, setSeasonalTheme] = useState('general');
  const [giftLang, setGiftLang] = useState('he');
  const { toast } = useToast();

  const { data: dashboardData } = useQuery({
    queryKey: ['/api/accounting/dashboard'],
  });

  const { data: moneyFlowSummary, isLoading: moneyFlowLoading } = useQuery<MoneyFlowSummary>({
    queryKey: ['/api/finance/money-flow-summary'],
  });

  const { data: vatDeclarations } = useQuery({
    queryKey: ['/api/accounting/vat/declarations', selectedYear],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/accounting/vat/declarations?year=${selectedYear}`), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch VAT declarations');
      return res.json();
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ['/api/accounting/expenses', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/accounting/expenses?year=${selectedYear}&month=${selectedMonth}`), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch expenses');
      return res.json();
    },
  });

  const { data: financialOverview, isLoading: overviewLoading } = useQuery({
    queryKey: ['/api/accounting/financial-overview', selectedYear],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/accounting/financial-overview?year=${selectedYear}`), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch financial overview');
      return res.json();
    },
  });

  const sendLoyaltyEmail = useMutation({
    mutationFn: async (data: { email: string; firstName: string; tier?: string; language?: string }) =>
      apiRequest('/api/accounting/email/send-loyalty-enrollment', { method: 'POST', body: data }),
    onSuccess: (data: any) => {
      toast({ title: isHebrew ? 'נשלח בהצלחה' : 'Sent Successfully', description: data.message });
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', description: isHebrew ? 'שליחת האימייל נכשלה' : 'Failed to send email', variant: 'destructive' });
    },
  });

  const sendEGiftEmail = useMutation({
    mutationFn: async (data: { buyerEmail: string; buyerName: string; recipientName: string; giftValue?: number; language?: string; seasonalTheme?: string }) =>
      apiRequest('/api/accounting/email/send-egift-purchase', { method: 'POST', body: data }),
    onSuccess: (data: any) => {
      toast({ title: isHebrew ? 'נשלח בהצלחה' : 'Sent Successfully', description: data.message });
    },
    onError: () => {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', description: isHebrew ? 'שליחת האימייל נכשלה' : 'Failed to send email', variant: 'destructive' });
    },
  });

  const generateReport = async (type: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/accounting/${type}/generate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth })
      });
      if (!response.ok) {
        const error = await response.json();
        toast({ title: isHebrew ? 'שגיאה' : 'Error', description: error.error || 'Failed', variant: 'destructive' });
        return;
      }
      toast({ title: isHebrew ? 'הצלחה' : 'Success', description: `${type} report generated` });
    } catch (error) {
      toast({ title: isHebrew ? 'שגיאה' : 'Error', description: 'Failed to generate report', variant: 'destructive' });
    }
  };

  const revenueGrowth = dashboardData?.yearToDate?.growth || 0;
  const overview = financialOverview;
  const cashFlow = overview?.cashFlow || [];
  const transactions = overview?.transactions || [];
  const incomeData = overview?.income || {};
  const runningCosts = overview?.runningCosts || {};

  const filteredTransactions = txSearch
    ? transactions.filter((tx: any) =>
        (tx.customerName || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        (tx.customerEmail || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        (tx.packageName || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        (tx.id || '').toLowerCase().includes(txSearch.toLowerCase())
      )
    : transactions;

  const categoryIcons: Record<string, any> = {
    rent: Building2,
    salary: Briefcase,
    utilities: Zap,
    transport: Truck,
    supplies: Receipt,
  };

  return (
    <Layout language={language} onLanguageChange={() => {}}>
      <div className="min-h-screen bg-white">
        <div className="luxury-container py-12">
          
          <div className="mb-12 luxury-animate-fade-in">
            <h1 className="luxury-heading-lg luxury-text-gradient mb-4">
              {isHebrew ? 'מערכת הנהלת חשבונות' : 'Financial Management System'}
            </h1>
            <p className="luxury-text-body max-w-2xl">
              {isHebrew 
                ? 'עסקאות, תזרים מזומנים, הכנסות, הוצאות שוטפות ודוחות מלאים' 
                : 'Transactions, cash flow, income, running costs & complete reports'}
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-8 mb-8 luxury-animate-slide-up luxury-delay-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="luxury-text-small mb-2">{isHebrew ? 'סה"כ הכנסות שנתי' : 'Total Year-to-Date Revenue'}</p>
                <h2 className="luxury-heading-xl luxury-text-gradient">
                  ₪{(incomeData.totalRevenue || dashboardData?.yearToDate?.totalRevenue || 0).toLocaleString()}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={`${revenueGrowth >= 0 ? 'luxury-badge-success' : 'luxury-badge'} flex items-center gap-1`}>
                  {revenueGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(revenueGrowth)}%
                </span>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="luxury-glass-minimal px-4 py-3 rounded-xl luxury-text-body border-0 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="luxury-glass-minimal px-4 py-3 rounded-xl luxury-text-body border-0 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                    <SelectItem key={month} value={String(month)}>
                      {new Date(2025, month - 1).toLocaleString(isHebrew ? 'he-IL' : 'en-US', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="luxury-grid-4 mb-12">
            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-2">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-green-600" />
              </div>
              <p className="luxury-text-small mb-2">{isHebrew ? 'הכנסות YTD' : 'YTD Revenue'}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient">
                ₪{(incomeData.totalRevenue || 0).toLocaleString()}
              </h3>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-3">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
                <ArrowDownRight className="h-5 w-5 text-red-600" />
              </div>
              <p className="luxury-text-small mb-2">{isHebrew ? 'הוצאות' : 'Expenses'}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient">
                ₪{(runningCosts.totalExpenses || 0).toLocaleString()}
              </h3>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-4">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-purple-600" />
              </div>
              <p className="luxury-text-small mb-2">{isHebrew ? 'רווח נקי' : 'Net Income'}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient">
                ₪{(incomeData.netIncome || 0).toLocaleString()}
              </h3>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <span className="luxury-badge">{incomeData.transactionCount || dashboardData?.yearToDate?.count || 0}</span>
              </div>
              <p className="luxury-text-small mb-2">{isHebrew ? 'עסקאות' : 'Transactions'}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient">
                {incomeData.transactionCount || dashboardData?.yearToDate?.count || 0}
              </h3>
            </div>
          </div>

          <Tabs defaultValue="transactions" className="space-y-6">
            <TabsList className="luxury-glass-panel p-2 flex-wrap">
              <TabsTrigger value="transactions" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'עסקאות' : 'Transactions'}</TabsTrigger>
              <TabsTrigger value="cashflow" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'תזרים מזומנים' : 'Cash Flow'}</TabsTrigger>
              <TabsTrigger value="income" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'הכנסות' : 'Income'}</TabsTrigger>
              <TabsTrigger value="costs" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'הוצאות שוטפות' : 'Running Costs'}</TabsTrigger>
              <TabsTrigger value="vat" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'מע"מ' : 'VAT'}</TabsTrigger>
              <TabsTrigger value="expenses" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'ניהול הוצאות' : 'Expense Mgmt'}</TabsTrigger>
              <TabsTrigger value="payments" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'אמצעי תשלום' : 'Payments'}</TabsTrigger>
              <TabsTrigger value="emails" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'אימיילים' : 'Emails'}</TabsTrigger>
              <TabsTrigger value="reports" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'דוחות' : 'Reports'}</TabsTrigger>
              <TabsTrigger value="money-flow" className="data-[state=active]:luxury-glass-card flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5" />
                {isHebrew ? 'זרימת כסף' : 'Money Flow'}
              </TabsTrigger>
            </TabsList>

            {/* Transactions Tab */}
            <TabsContent value="transactions">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="luxury-heading-md">{isHebrew ? 'עסקאות אחרונות' : 'Recent Transactions'}</h2>
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder={isHebrew ? 'חיפוש...' : 'Search...'}
                      className="luxury-glass-minimal w-full pl-10 pr-4 py-2 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                    />
                  </div>
                </div>

                {overviewLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-16">
                    <Receipt className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="luxury-text-body text-gray-500">{isHebrew ? 'אין עסקאות עדיין' : 'No transactions yet'}</p>
                    <p className="luxury-text-small text-gray-400 mt-2">{isHebrew ? 'עסקאות יופיעו כאן לאחר עיבוד תשלומים' : 'Transactions will appear here after payments are processed'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTransactions.map((tx: any, idx: number) => (
                      <div key={tx.id} className={`luxury-glass-minimal luxury-hover-lift p-5 rounded-xl luxury-animate-fade-in luxury-delay-${Math.min(idx + 1, 10)}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-semibold text-gray-900">{tx.packageName}</h4>
                              {tx.isGiftCard && (
                                <span className="luxury-badge-gold text-xs flex items-center gap-1">
                                  <Gift className="h-3 w-3" /> {isHebrew ? 'כרטיס מתנה' : 'Gift Card'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{tx.customerName || tx.customerEmail}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-400 font-mono">{tx.id?.substring(0, 12)}...</span>
                              {tx.paymentMethod && (
                                <span className="luxury-badge text-xs">{tx.paymentMethod}</span>
                              )}
                              {tx.invoiceGenerated && (
                                <span className="luxury-badge-success text-xs flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> {isHebrew ? 'חשבונית' : 'Invoice'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="luxury-heading-md luxury-text-gradient">₪{Number(tx.totalAmount).toLocaleString()}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                            </p>
                            <p className="text-xs text-gray-400">
                              {isHebrew ? 'מע"מ' : 'VAT'}: ₪{Number(tx.vatAmount || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Cash Flow Tab */}
            <TabsContent value="cashflow">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                  <h2 className="luxury-heading-md">{isHebrew ? 'תזרים מזומנים חודשי' : 'Monthly Cash Flow'}</h2>
                </div>

                {overviewLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-8">
                      {cashFlow.map((month: any) => {
                        const maxVal = Math.max(...cashFlow.map((m: any) => Math.max(m.income, m.costs, 1)));
                        const incomeWidth = maxVal > 0 ? (month.income / maxVal) * 100 : 0;
                        const costsWidth = maxVal > 0 ? (month.costs / maxVal) * 100 : 0;
                        return (
                          <div key={month.month} className="luxury-glass-minimal p-4 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-semibold text-gray-700 w-12">{month.monthName}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-green-600 font-medium">+₪{month.income.toLocaleString()}</span>
                                <span className="text-sm text-red-500 font-medium">-₪{month.costs.toLocaleString()}</span>
                                <span className={`text-sm font-bold ${month.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {month.net >= 0 ? '+' : ''}₪{month.net.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${incomeWidth}%` }} />
                              </div>
                              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full transition-all" style={{ width: `${costsWidth}%` }} />
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">{month.transactionCount} {isHebrew ? 'עסקאות' : 'transactions'}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="luxury-glass-panel p-6 rounded-2xl">
                      <h3 className="luxury-heading-sm mb-4">{isHebrew ? 'סיכום שנתי' : 'Annual Summary'}</h3>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'סה"כ הכנסות' : 'Total Income'}</p>
                          <p className="luxury-heading-md text-green-600">₪{cashFlow.reduce((s: number, m: any) => s + m.income, 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'סה"כ הוצאות' : 'Total Costs'}</p>
                          <p className="luxury-heading-md text-red-500">₪{cashFlow.reduce((s: number, m: any) => s + m.costs, 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'תזרים נטו' : 'Net Cash Flow'}</p>
                          <p className={`luxury-heading-md ${cashFlow.reduce((s: number, m: any) => s + m.net, 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            ₪{cashFlow.reduce((s: number, m: any) => s + m.net, 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Income Tab */}
            <TabsContent value="income">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                  <h2 className="luxury-heading-md">{isHebrew ? 'פירוט הכנסות' : 'Income Breakdown'}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="luxury-glass-minimal p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="luxury-text-small">{isHebrew ? 'הכנסות ברוטו' : 'Gross Revenue'}</p>
                        <p className="luxury-heading-lg luxury-text-gradient">₪{(incomeData.totalRevenue || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="luxury-text-small">{isHebrew ? 'מע"מ שנגבה' : 'VAT Collected'}</p>
                        <p className="luxury-heading-lg text-blue-600">₪{(incomeData.totalVat || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="luxury-text-small">{isHebrew ? 'עמלות עיבוד' : 'Processing Fees'}</p>
                        <p className="luxury-heading-lg text-orange-600">₪{(incomeData.totalFees || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal p-6 rounded-2xl border-2 border-green-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="luxury-text-small font-semibold">{isHebrew ? 'רווח נקי' : 'Net Income'}</p>
                        <p className="luxury-heading-lg text-green-700">₪{(incomeData.netIncome || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="luxury-glass-panel p-6 rounded-2xl">
                  <p className="luxury-text-small mb-2">{isHebrew ? 'נוסחת חישוב' : 'Calculation Formula'}</p>
                  <p className="text-sm text-gray-600">
                    {isHebrew 
                      ? 'רווח נקי = הכנסות ברוטו − מע"מ − עמלות עיבוד − הוצאות שוטפות'
                      : 'Net Income = Gross Revenue − VAT − Processing Fees − Running Costs'}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                    <span>₪{(incomeData.totalRevenue || 0).toLocaleString()}</span>
                    <span>−</span>
                    <span>₪{(incomeData.totalVat || 0).toLocaleString()}</span>
                    <span>−</span>
                    <span>₪{(incomeData.totalFees || 0).toLocaleString()}</span>
                    <span>−</span>
                    <span>₪{(runningCosts.totalExpenses || 0).toLocaleString()}</span>
                    <span>=</span>
                    <span className="font-bold text-green-700">₪{(incomeData.netIncome || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Running Costs Tab */}
            <TabsContent value="costs">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <PieChart className="h-6 w-6 text-red-500" />
                  <h2 className="luxury-heading-md">{isHebrew ? 'הוצאות שוטפות לפי קטגוריה' : 'Running Costs by Category'}</h2>
                </div>

                <div className="luxury-glass-panel p-6 rounded-2xl mb-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="luxury-text-small mb-1">{isHebrew ? 'סה"כ הוצאות שוטפות' : 'Total Running Costs'}</p>
                      <p className="luxury-heading-xl text-red-600">₪{(runningCosts.totalExpenses || 0).toLocaleString()}</p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center">
                      <TrendingDown className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>

                {(runningCosts.byCategory || []).length === 0 ? (
                  <div className="text-center py-12">
                    <PieChart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="luxury-text-body text-gray-500">{isHebrew ? 'אין הוצאות מאושרות עדיין' : 'No approved expenses yet'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(runningCosts.byCategory || []).map((cat: any, idx: number) => {
                      const maxCat = Math.max(...(runningCosts.byCategory || []).map((c: any) => c.total || 1));
                      const pct = maxCat > 0 ? (cat.total / maxCat) * 100 : 0;
                      const totalPct = runningCosts.totalExpenses > 0 ? ((cat.total / runningCosts.totalExpenses) * 100).toFixed(1) : '0';
                      const IconComp = categoryIcons[cat.category?.toLowerCase()] || Receipt;
                      return (
                        <div key={cat.category || idx} className="luxury-glass-minimal luxury-hover-lift p-5 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center">
                                <IconComp className="h-5 w-5 text-gray-700" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 capitalize">{cat.category || (isHebrew ? 'אחר' : 'Other')}</h4>
                                <p className="text-xs text-gray-400">{cat.count} {isHebrew ? 'רשומות' : 'entries'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="luxury-heading-sm text-red-600">₪{cat.total.toLocaleString()}</p>
                              <p className="text-xs text-gray-400">{totalPct}%</p>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* VAT Tab */}
            <TabsContent value="vat">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <h2 className="luxury-heading-md mb-6">{isHebrew ? 'דוחות מע"מ' : 'VAT Declarations'}</h2>
                
                <Button 
                  onClick={() => generateReport('vat')}
                  className="luxury-btn-primary mb-6"
                  data-testid="button-generate-vat"
                >
                  {isHebrew ? 'צור דוח מע"מ חודשי' : 'Generate Monthly VAT Report'}
                </Button>

                <div className="space-y-4">
                  {vatDeclarations?.map((decl: any, idx: number) => (
                    <div key={decl.id} className={`luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl luxury-animate-fade-in luxury-delay-${Math.min(idx + 1, 10)}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="luxury-heading-sm font-mono">{decl.declarationId}</h4>
                          <p className="luxury-text-small mt-1">
                            {new Date(decl.periodStart).toLocaleDateString()} - {new Date(decl.periodEnd).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`${
                          decl.status === 'filed' || decl.status === 'approved' ? 'luxury-badge-success' :
                          decl.status === 'pending' ? 'luxury-badge-gold' : 'luxury-badge'
                        }`}>
                          {decl.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'הכנסות' : 'Revenue'}</p>
                          <p className="luxury-heading-sm luxury-text-gradient">₪{Number(decl.totalRevenue).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'הוצאות' : 'Expenses'}</p>
                          <p className="luxury-heading-sm luxury-text-gradient">₪{Number(decl.totalExpenses).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'מע"מ פלט' : 'Output VAT'}</p>
                          <p className="luxury-heading-sm luxury-text-gradient">₪{Number(decl.totalOutputVat).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="luxury-text-small mb-1">{isHebrew ? 'מע"מ לתשלום' : 'VAT Payable'}</p>
                          <p className="luxury-heading-sm text-red-600 font-bold">₪{Number(decl.netVatPayable).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Expenses Tab */}
            <TabsContent value="expenses">
              <div className="luxury-glass-card luxury-shadow-lg p-8">
                <h2 className="luxury-heading-md mb-6">{isHebrew ? 'ניהול הוצאות' : 'Expense Management'}</h2>
                <div className="space-y-3">
                  {expenses?.map((expense: any, idx: number) => (
                    <div key={expense.id} className={`luxury-glass-minimal luxury-hover-lift p-6 rounded-xl luxury-animate-fade-in luxury-delay-${Math.min(idx + 1, 10)}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="luxury-heading-sm">{expense.description}</h4>
                            <span className="font-mono luxury-text-small text-gray-500">{expense.expenseId}</span>
                          </div>
                          <p className="luxury-text-body mb-1">{expense.vendor}</p>
                          <div className="flex items-center gap-2">
                            <span className="luxury-badge">{expense.category}</span>
                            <span className="luxury-text-small">
                              {new Date(expense.date || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="luxury-heading-lg luxury-text-gradient mb-2">₪{Number(expense.totalAmount).toLocaleString()}</p>
                          <span className={`${
                            expense.status === 'approved' ? 'luxury-badge-success' :
                            expense.status === 'rejected' ? 'luxury-badge text-red-600' : 'luxury-badge-gold'
                          }`}>
                            {expense.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Payment Methods Tab */}
            <TabsContent value="payments">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <h2 className="luxury-heading-md mb-8">{isHebrew ? 'פירוט אמצעי תשלום' : 'Payment Methods Breakdown'}</h2>
                <div className="luxury-grid-4">
                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-4">
                      <CreditCard className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">{isHebrew ? 'כרטיס אשראי' : 'Credit Card'}</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">45%</h3>
                    <p className="luxury-text-body">₪{((incomeData.totalRevenue || 0) * 0.45).toLocaleString()}</p>
                  </div>
                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-4">
                      <FileText className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">Nayax</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">35%</h3>
                    <p className="luxury-text-body">₪{((incomeData.totalRevenue || 0) * 0.35).toLocaleString()}</p>
                  </div>
                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-4">
                      <Wallet className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">{isHebrew ? 'ארנק דיגיטלי' : 'Digital Wallet'}</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">15%</h3>
                    <p className="luxury-text-body">₪{((incomeData.totalRevenue || 0) * 0.15).toLocaleString()}</p>
                  </div>
                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mb-4">
                      <Gift className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">{isHebrew ? 'כרטיס מתנה' : 'Gift Card'}</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">5%</h3>
                    <p className="luxury-text-body">₪{((incomeData.totalRevenue || 0) * 0.05).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Email Send Tab */}
            <TabsContent value="emails">
              <div className="space-y-6">
                {/* Loyalty Enrollment Email */}
                <div className="luxury-glass-card luxury-shadow-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="luxury-heading-md">{isHebrew ? 'אימייל הצטרפות Prestige Loyalty' : 'Prestige Loyalty Enrollment Email'}</h2>
                      <p className="luxury-text-small">{isHebrew ? 'שלח אימייל אישור הצטרפות למועדון הנאמנות' : 'Send loyalty club enrollment confirmation email'}</p>
                    </div>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    sendLoyaltyEmail.mutate({
                      email: fd.get('loyaltyEmail') as string,
                      firstName: fd.get('loyaltyName') as string,
                      tier: fd.get('loyaltyTier') as string || 'bronze',
                      language: fd.get('loyaltyLang') as string || 'he',
                    });
                  }} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'אימייל' : 'Email'} *</label>
                        <Input name="loyaltyEmail" type="email" required placeholder="user@example.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'שם פרטי' : 'First Name'} *</label>
                        <Input name="loyaltyName" type="text" required placeholder={isHebrew ? 'שם' : 'Name'} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'דרגה' : 'Tier'}</label>
                        <input type="hidden" name="loyaltyTier" value={loyaltyTier} />
                        <Select value={loyaltyTier} onValueChange={setLoyaltyTier}>
                          <SelectTrigger className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bronze">Bronze</SelectItem>
                            <SelectItem value="silver">Silver</SelectItem>
                            <SelectItem value="gold">Gold</SelectItem>
                            <SelectItem value="platinum">Platinum</SelectItem>
                            <SelectItem value="diamond">Diamond</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'שפה' : 'Language'}</label>
                        <input type="hidden" name="loyaltyLang" value={loyaltyLang} />
                        <Select value={loyaltyLang} onValueChange={setLoyaltyLang}>
                          <SelectTrigger className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="he">{isHebrew ? 'עברית' : 'Hebrew'}</SelectItem>
                            <SelectItem value="en">{isHebrew ? 'אנגלית' : 'English'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" disabled={sendLoyaltyEmail.isPending} className="luxury-btn-primary flex items-center gap-2">
                      {sendLoyaltyEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {isHebrew ? 'שלח אימייל הצטרפות' : 'Send Enrollment Email'}
                    </Button>
                  </form>
                </div>

                {/* E-Gift Purchase Email */}
                <div className="luxury-glass-card luxury-shadow-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="luxury-heading-md">{isHebrew ? 'אימייל רכישת כרטיס מתנה' : 'E-Gift Purchase Confirmation Email'}</h2>
                      <p className="luxury-text-small">{isHebrew ? 'שלח אישור רכישה יוקרתי לקונה' : 'Send luxury purchase confirmation to buyer'}</p>
                    </div>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    sendEGiftEmail.mutate({
                      buyerEmail: fd.get('buyerEmail') as string,
                      buyerName: fd.get('buyerName') as string,
                      recipientName: fd.get('recipientName') as string,
                      giftValue: Number(fd.get('giftValue') || 200),
                      language: fd.get('giftLang') as string || 'he',
                      seasonalTheme: fd.get('seasonalTheme') as string || 'general',
                    });
                  }} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'אימייל הקונה' : 'Buyer Email'} *</label>
                        <Input name="buyerEmail" type="email" required placeholder="buyer@example.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'שם הקונה' : 'Buyer Name'} *</label>
                        <Input name="buyerName" type="text" required placeholder={isHebrew ? 'שם הקונה' : 'Buyer name'} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'שם המקבל' : 'Recipient Name'} *</label>
                        <Input name="recipientName" type="text" required placeholder={isHebrew ? 'שם המקבל' : 'Recipient name'} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'סכום (₪)' : 'Gift Value (₪)'}</label>
                        <Input name="giftValue" type="number" defaultValue={200} min={50} max={5000} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'עיצוב עונתי' : 'Seasonal Theme'}</label>
                        <input type="hidden" name="seasonalTheme" value={seasonalTheme} />
                        <Select value={seasonalTheme} onValueChange={setSeasonalTheme}>
                          <SelectTrigger className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">{isHebrew ? 'כללי' : 'General'}</SelectItem>
                            <SelectItem value="black_friday">Black Friday</SelectItem>
                            <SelectItem value="valentines">{isHebrew ? 'יום האהבה' : "Valentine's"}</SelectItem>
                            <SelectItem value="christmas">{isHebrew ? 'חג המולד' : 'Christmas'}</SelectItem>
                            <SelectItem value="hannukah">{isHebrew ? 'חנוכה' : 'Hanukkah'}</SelectItem>
                            <SelectItem value="purim">{isHebrew ? 'פורים' : 'Purim'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'שפה' : 'Language'}</label>
                        <input type="hidden" name="giftLang" value={giftLang} />
                        <Select value={giftLang} onValueChange={setGiftLang}>
                          <SelectTrigger className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="he">{isHebrew ? 'עברית' : 'Hebrew'}</SelectItem>
                            <SelectItem value="en">{isHebrew ? 'אנגלית' : 'English'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" disabled={sendEGiftEmail.isPending} className="luxury-btn-primary flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
                      {sendEGiftEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      {isHebrew ? 'שלח אישור רכישת מתנה' : 'Send E-Gift Purchase Confirmation'}
                    </Button>
                  </form>
                </div>
              </div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <h2 className="luxury-heading-md mb-6">{isHebrew ? 'חבילות דיווח חודשיות' : 'Monthly Financial Packages'}</h2>
                <div className="space-y-6">
                  <div className="luxury-glass-panel p-6 rounded-2xl border-2 border-purple-200">
                    <h4 className="luxury-heading-sm luxury-text-gradient mb-3">
                      {isHebrew ? 'חבילה מלאה לרואה חשבון' : 'Complete Package for Accountant'}
                    </h4>
                    <p className="luxury-text-body mb-6">
                      {isHebrew 
                        ? 'כולל מע"מ, מס הכנסה, ביטוח לאומי + קבצי Excel ו-PDF'
                        : 'Includes VAT, Income Tax, National Insurance + Excel & PDF files'}
                    </p>
                    <Button className="luxury-btn-secondary w-full flex items-center justify-center gap-2" data-testid="button-generate-package">
                      <Download className="h-5 w-5" />
                      {isHebrew ? 'צור חבילה מלאה' : 'Generate Complete Package'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="luxury-heading-sm mb-2">{isHebrew ? 'דוח מע"מ' : 'VAT Report'}</h4>
                      <p className="luxury-text-small">{isHebrew ? 'טופס 1206' : 'Form 1206'}</p>
                    </div>
                    <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="luxury-heading-sm mb-2">{isHebrew ? 'מס הכנסה' : 'Income Tax'}</h4>
                      <p className="luxury-text-small">{isHebrew ? 'דיווח חודשי' : 'Monthly Report'}</p>
                    </div>
                    <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="luxury-heading-sm mb-2">{isHebrew ? 'ביטוח לאומי' : 'National Ins.'}</h4>
                      <p className="luxury-text-small">{isHebrew ? 'דיווח חודשי' : 'Monthly Report'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Money Flow Tab */}
            <TabsContent value="money-flow">
              <div className="space-y-6">
                {/* Header + link to visual page */}
                <div className="luxury-glass-card luxury-shadow-xl p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="luxury-heading-md flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-purple-600" />
                        {isHebrew ? 'זרימת כסף — מבנה פיננסי מלא' : 'Money Flow — Full Financial Architecture'}
                      </h2>
                      <p className="luxury-text-small mt-1">
                        {isHebrew
                          ? 'שני זרמי תשלום מופרדים: מרקטפלייס עם ספק | מכירה ישירה ללא ספק'
                          : 'Two separated payment flows: Marketplace with provider | Direct sale without provider'}
                      </p>
                    </div>
                    <Link href="/admin/money-flow">
                      <Button variant="outline" className="flex items-center gap-2 text-sm">
                        <ExternalLink className="w-4 h-4" />
                        {isHebrew ? 'פתח תרשים זרימה מלא' : 'Open Full Flow Diagram'}
                      </Button>
                    </Link>
                  </div>
                </div>

                {moneyFlowLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : (
                  <>
                    {/* Flow A — Marketplace */}
                    <div className="luxury-glass-card luxury-shadow-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">{isHebrew ? 'Flow A — הזמנות מרקטפלייס (עם ספק)' : 'Flow A — Marketplace Bookings (with provider)'}</h3>
                        <Badge className="bg-blue-100 text-blue-700 text-xs">{isHebrew ? 'ספק קיים' : 'Provider exists'}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: isHebrew ? 'הזמנות מרקטפלייס' : 'Marketplace Bookings', value: (moneyFlowSummary?.totalMarketplaceBookings ?? '—').toString(), icon: Users, color: 'text-blue-500' },
                          { label: isHebrew ? 'מחזור ברוטו' : 'Gross Revenue', value: `₪${(moneyFlowSummary?.totalMarketplaceGrossILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-blue-600' },
                          { label: isHebrew ? 'עמלות פלטפורמה' : 'Platform Fees', value: `₪${(moneyFlowSummary?.totalPlatformFeesILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: Building2, color: 'text-purple-500' },
                          { label: isHebrew ? 'תשלומים לספקים' : 'Provider Payouts', value: `₪${(moneyFlowSummary?.totalProviderPayoutsILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: Banknote, color: 'text-green-500' },
                          { label: isHebrew ? 'נאמנות מוחזקת' : 'Escrow Held', value: `₪${(moneyFlowSummary?.totalEscrowHeldILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: ShieldCheck, color: 'text-indigo-500' },
                          { label: isHebrew ? 'נאמנות שוחררה' : 'Escrow Released', value: `₪${(moneyFlowSummary?.totalEscrowReleasedILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: ShieldCheck, color: 'text-green-500' },
                          { label: isHebrew ? 'מע"מ על עמלות' : 'VAT on Fees (18%)', value: `₪${(moneyFlowSummary?.totalVATMarketplaceILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: Receipt, color: 'text-amber-500' },
                        ].map(item => (
                          <Card key={item.label} className="border-0 shadow-sm bg-blue-50/40">
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{item.label}</span>
                                <item.icon className={`w-4 h-4 ${item.color}`} />
                              </div>
                              <p className="text-lg font-bold text-gray-900">{item.value}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Flow B — Direct Sale */}
                    <div className="luxury-glass-card luxury-shadow-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Gift className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-semibold text-gray-900">{isHebrew ? 'Flow B — מכירות ישירות (ללא ספק)' : 'Flow B — Direct PetWash™ Sales (no provider)'}</h3>
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">{isHebrew ? 'ללא ספק' : 'No provider'}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: isHebrew ? 'מכירות ישירות' : 'Direct Sales', value: (moneyFlowSummary?.totalDirectPlatformSales ?? '—').toString(), icon: Building2, color: 'text-emerald-600' },
                          { label: isHebrew ? 'מחזור מכירות' : 'Direct Sales Revenue', value: `₪${(moneyFlowSummary?.totalDirectSalesGrossILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-emerald-600' },
                          { label: isHebrew ? 'גיפט קארד נמכרו' : 'E-Gift Cards Sold', value: (moneyFlowSummary?.totalEGiftSales ?? '—').toString(), icon: Gift, color: 'text-pink-500', sub: `₪${(moneyFlowSummary?.totalEGiftValueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}` },
                          { label: isHebrew ? 'טעינות ארנק' : 'Wallet Top-ups', value: (moneyFlowSummary?.totalWalletTopups ?? '—').toString(), icon: Wallet, color: 'text-blue-500', sub: `₪${(moneyFlowSummary?.totalWalletTopupValueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}` },
                          { label: isHebrew ? 'מע"מ מכירה ישירה' : 'VAT Direct Sales (18%)', value: `₪${(moneyFlowSummary?.totalVATDirectSalesILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: Receipt, color: 'text-amber-500' },
                        ].map(item => (
                          <Card key={item.label} className="border-0 shadow-sm bg-emerald-50/40">
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{item.label}</span>
                                <item.icon className={`w-4 h-4 ${item.color}`} />
                              </div>
                              <p className="text-lg font-bold text-gray-900">{item.value}</p>
                              {(item as any).sub && <p className="text-xs text-gray-400 mt-0.5">{(item as any).sub}</p>}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Shared Totals */}
                    <div className="luxury-glass-card luxury-shadow-xl p-6">
                      <h3 className="font-semibold text-gray-700 mb-4">{isHebrew ? 'סיכום — שני הזרמים' : 'Summary — Both Flows'}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: isHebrew ? 'סה"כ מע"מ' : 'Total VAT Collected', value: `₪${(moneyFlowSummary?.totalVATAllFlowsILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: Receipt, color: 'text-amber-500' },
                          { label: isHebrew ? 'הכנסה נטו' : 'Net Revenue', value: `₪${(moneyFlowSummary?.totalNetRevenueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-green-600' },
                          { label: isHebrew ? 'עמלות עיבוד' : 'Processing Fees', value: `₪${(moneyFlowSummary?.totalProcessorFeesILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: CreditCard, color: 'text-gray-500' },
                          { label: isHebrew ? 'החזרים' : 'Refunds', value: `₪${(moneyFlowSummary?.totalRefundsILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: AlertCircle, color: 'text-red-500' },
                        ].map(item => (
                          <Card key={item.label} className="border-0 shadow-sm">
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{item.label}</span>
                                <item.icon className={`w-4 h-4 ${item.color}`} />
                              </div>
                              <p className="text-lg font-bold text-gray-900">{item.value}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Critical rule reminder */}
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">
                              {isHebrew ? 'כלל קריטי — הפרדת זרמים' : 'Critical Rule — Flow Separation'}
                            </p>
                            <p className="text-blue-700">
                              {isHebrew
                                ? 'שני הזרמים הפיננסיים לעולם לא מתערבבים. Flow A כולל ספק, נאמנות, ומידע מס לספק. Flow B הוא מכירה ישירה של PetWash™ — אין ספק, אין נאמנות, אין הסבר מס לספק.'
                                : 'The two financial flows are never mixed. Flow A includes provider, escrow, and provider tax info. Flow B is a direct PetWash™ sale — no provider, no escrow, no provider tax explanation.'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </Layout>
  );
}