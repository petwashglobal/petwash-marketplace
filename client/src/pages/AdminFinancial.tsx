import { useState } from "react";
import { Layout } from "@/components/Layout";
import { type Language } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Filter
} from "lucide-react";

interface AdminFinancialProps {
  language: Language;
}

export default function AdminFinancial({ language }: AdminFinancialProps) {
  const isHebrew = language === 'he';
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const { data: dashboardData } = useQuery({
    queryKey: ['/api/accounting/dashboard'],
  });

  const { data: vatDeclarations } = useQuery({
    queryKey: ['/api/accounting/vat/declarations', selectedYear],
  });

  const { data: expenses } = useQuery({
    queryKey: ['/api/accounting/expenses', selectedYear, selectedMonth],
  });

  const generateReport = async (type: string) => {
    try {
      const response = await fetch(`/api/accounting/${type}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to generate report');
        return;
      }

      alert(`${type} report generated successfully!`);
      window.location.reload();
    } catch (error) {
      alert('Failed to generate report');
    }
  };

  const revenueGrowth = dashboardData?.yearToDate?.growth || 0;

  return (
    <Layout language={language} onLanguageChange={() => {}}>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="luxury-container py-12">
          
          {/* Header */}
          <div className="mb-12 luxury-animate-fade-in">
            <h1 className="luxury-heading-lg luxury-text-gradient mb-4">
              {isHebrew ? 'מערכת הנהלת חשבונות' : 'Financial Management System'}
            </h1>
            <p className="luxury-text-body max-w-2xl">
              {isHebrew 
                ? 'מערכת הנהלת חשבונות ישראלית מלאה - מע"מ, מס הכנסה, ביטוח לאומי' 
                : 'Complete Israeli accounting system - VAT, Income Tax, National Insurance'}
            </p>
          </div>

          {/* Revenue Overview Card */}
          <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-8 mb-8 luxury-animate-slide-up luxury-delay-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="luxury-text-small mb-2">{isHebrew ? 'סה"כ הכנסות שנתי' : 'Total Year-to-Date Revenue'}</p>
                <h2 className="luxury-heading-xl luxury-text-gradient">
                  ₪{dashboardData?.yearToDate?.totalRevenue?.toLocaleString() || '0'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={`${revenueGrowth >= 0 ? 'luxury-badge-success' : 'luxury-badge'} flex items-center gap-1`}>
                  {revenueGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(revenueGrowth)}%
                </span>
              </div>
            </div>
            
            {/* Period Selector */}
            <div className="flex gap-4">
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="luxury-glass-minimal px-4 py-3 rounded-xl luxury-text-body border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="luxury-glass-minimal px-4 py-3 rounded-xl luxury-text-body border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2025, month - 1).toLocaleString(isHebrew ? 'he-IL' : 'en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Financial Stats Grid */}
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
                ₪{dashboardData?.yearToDate?.totalRevenue?.toLocaleString() || '0'}
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
                ₪{dashboardData?.yearToDate?.totalExpenses?.toLocaleString() || '0'}
              </h3>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-4">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <ArrowUpRight className="h-5 w-5 text-purple-600" />
              </div>
              <p className="luxury-text-small mb-2">{isHebrew ? 'רווח נקי' : 'Net Profit'}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient">
                ₪{((dashboardData?.yearToDate?.totalRevenue || 0) - (dashboardData?.yearToDate?.totalExpenses || 0)).toLocaleString()}
              </h3>
            </div>

            <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <span className="luxury-badge">{dashboardData?.yearToDate?.count || 0}</span>
              </div>
              <p className="luxury-text-small mb-2">{isHebrew ? 'עסקאות' : 'Transactions'}</p>
              <h3 className="luxury-heading-lg luxury-text-gradient">
                {dashboardData?.yearToDate?.count || 0}
              </h3>
            </div>
          </div>

          {/* Filters & Export Panel */}
          <div className="luxury-glass-panel luxury-shadow-md p-6 mb-8 luxury-animate-fade-in luxury-delay-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input 
                    type="text"
                    placeholder={isHebrew ? 'חיפוש עסקאות...' : 'Search transactions...'}
                    className="luxury-glass-minimal w-full pl-10 pr-4 py-3 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <button className="luxury-glass-minimal px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-purple-50 transition-colors">
                  <Filter className="h-5 w-5" />
                  <span className="luxury-text-body">{isHebrew ? 'סינון' : 'Filter'}</span>
                </button>
              </div>
              <button className="luxury-btn-secondary flex items-center gap-2">
                <Download className="h-5 w-5" />
                {isHebrew ? 'ייצא' : 'Export'}
              </button>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="vat" className="space-y-6">
            <TabsList className="luxury-glass-panel p-2">
              <TabsTrigger value="vat" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'מע"מ' : 'VAT'}</TabsTrigger>
              <TabsTrigger value="income" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'מס הכנסה' : 'Income Tax'}</TabsTrigger>
              <TabsTrigger value="insurance" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'ביטוח לאומי' : 'National Insurance'}</TabsTrigger>
              <TabsTrigger value="expenses" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'הוצאות' : 'Expenses'}</TabsTrigger>
              <TabsTrigger value="payments" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'אמצעי תשלום' : 'Payments'}</TabsTrigger>
              <TabsTrigger value="reports" className="data-[state=active]:luxury-glass-card">{isHebrew ? 'דוחות' : 'Reports'}</TabsTrigger>
            </TabsList>

            {/* VAT Tab */}
            <TabsContent value="vat">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <h2 className="luxury-heading-md mb-6">{isHebrew ? 'דוחות מע"מ' : 'VAT Declarations'}</h2>
                
                <button 
                  onClick={() => generateReport('vat')}
                  className="luxury-btn-primary mb-6"
                  data-testid="button-generate-vat"
                >
                  {isHebrew ? 'צור דוח מע"מ חודשי' : 'Generate Monthly VAT Report'}
                </button>

                <div className="space-y-4">
                  {vatDeclarations?.map((decl: any, idx: number) => (
                    <div key={decl.id} className={`luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl luxury-animate-fade-in luxury-delay-${Math.min(idx + 1, 10)}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="luxury-heading-sm font-mono">
                            {decl.declarationId}
                          </h4>
                          <p className="luxury-text-small mt-1">
                            {new Date(decl.periodStart).toLocaleDateString()} - {new Date(decl.periodEnd).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`${
                          decl.status === 'filed' || decl.status === 'approved' ? 'luxury-badge-success' :
                          decl.status === 'pending' ? 'luxury-badge-gold' :
                          'luxury-badge'
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

            {/* Income Tax Tab */}
            <TabsContent value="income">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <h2 className="luxury-heading-md mb-6">{isHebrew ? 'דוחות מס הכנסה' : 'Income Tax Declarations'}</h2>
                <button 
                  onClick={() => generateReport('income-tax')}
                  className="luxury-btn-primary"
                  data-testid="button-generate-income-tax"
                >
                  {isHebrew ? 'צור דוח מס הכנסה' : 'Generate Income Tax Report'}
                </button>
              </div>
            </TabsContent>

            {/* National Insurance Tab */}
            <TabsContent value="insurance">
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <h2 className="luxury-heading-md mb-6">{isHebrew ? 'דוחות ביטוח לאומי' : 'National Insurance Declarations'}</h2>
                <button 
                  onClick={() => generateReport('national-insurance')}
                  className="luxury-btn-primary"
                  data-testid="button-generate-insurance"
                >
                  {isHebrew ? 'צור דוח ביטוח לאומי' : 'Generate National Insurance Report'}
                </button>
              </div>
            </TabsContent>

            {/* Expenses Tab - Transactions Table */}
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
                          <p className="luxury-heading-lg luxury-text-gradient mb-2">
                            ₪{Number(expense.totalAmount).toLocaleString()}
                          </p>
                          <span className={`${
                            expense.status === 'approved' ? 'luxury-badge-success' :
                            expense.status === 'rejected' ? 'luxury-badge text-red-600' :
                            'luxury-badge-gold'
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

            {/* Payment Methods Breakdown */}
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
                    <p className="luxury-text-body">₪{((dashboardData?.yearToDate?.totalRevenue || 0) * 0.45).toLocaleString()}</p>
                  </div>

                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-4">
                      <FileText className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">{isHebrew ? 'Nayax' : 'Nayax'}</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">35%</h3>
                    <p className="luxury-text-body">₪{((dashboardData?.yearToDate?.totalRevenue || 0) * 0.35).toLocaleString()}</p>
                  </div>

                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-4">
                      <Wallet className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">{isHebrew ? 'ארנק דיגיטלי' : 'Digital Wallet'}</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">15%</h3>
                    <p className="luxury-text-body">₪{((dashboardData?.yearToDate?.totalRevenue || 0) * 0.15).toLocaleString()}</p>
                  </div>

                  <div className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mb-4">
                      <Gift className="h-7 w-7 text-white" />
                    </div>
                    <p className="luxury-text-small mb-2">{isHebrew ? 'כרטיס מתנה' : 'Gift Card'}</p>
                    <h3 className="luxury-heading-lg luxury-text-gradient mb-1">5%</h3>
                    <p className="luxury-text-body">₪{((dashboardData?.yearToDate?.totalRevenue || 0) * 0.05).toLocaleString()}</p>
                  </div>
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
                    <button className="luxury-btn-secondary w-full flex items-center justify-center gap-2" data-testid="button-generate-package">
                      <Download className="h-5 w-5" />
                      {isHebrew ? 'צור חבילה מלאה' : 'Generate Complete Package'}
                    </button>
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
          </Tabs>

          {/* Recent Activity Feed */}
          <div className="luxury-glass-panel p-8 mt-8 luxury-animate-slide-up luxury-delay-7">
            <h2 className="luxury-heading-md mb-6">{isHebrew ? 'פעילות אחרונה' : 'Recent Activity'}</h2>
            <div className="space-y-3">
              {[1, 2, 3].map((item, idx) => (
                <div key={item} className={`luxury-glass-minimal p-4 rounded-xl flex items-center justify-between luxury-animate-fade-in luxury-delay-${idx + 8}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="luxury-text-body">{isHebrew ? 'עסקה חדשה התקבלה' : 'New transaction received'}</p>
                      <p className="luxury-text-small">{new Date().toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="luxury-heading-sm luxury-text-gradient">₪150</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
