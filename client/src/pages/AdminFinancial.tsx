import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { type Language } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Download,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";

interface AdminFinancialProps {
  language: Language;
}

export default function AdminFinancial({ language }: AdminFinancialProps) {
  const isHebrew = language === 'he';
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Fetch dashboard summary
  const { data: dashboardData } = useQuery({
    queryKey: ['/api/accounting/dashboard'],
  });

  // Fetch VAT declarations
  const { data: vatDeclarations } = useQuery({
    queryKey: ['/api/accounting/vat/declarations', selectedYear],
  });

  // Fetch expenses
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header language={language} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {isHebrew ? 'מערכת הנהלת חשבונות' : 'Financial Management System'}
          </h1>
          <p className="text-gray-600">
            {isHebrew 
              ? 'מערכת הנהלת חשבונות ישראלית מלאה - מע"מ, מס הכנסה, ביטוח לאומי' 
              : 'Complete Israeli accounting system - VAT, Income Tax, National Insurance'}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'הכנסות YTD' : 'YTD Revenue'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₪{dashboardData?.yearToDate?.totalRevenue?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isHebrew ? 'סה"כ הכנסות שנתי' : 'Total year-to-date revenue'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'מע"מ לתשלום' : 'VAT Payable'}
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₪{dashboardData?.currentMonth?.vatDeclaration?.netVatPayable || '0'}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isHebrew ? 'חודש שוטף' : 'Current month'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'הוצאות ממתינות' : 'Pending Expenses'}
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.pendingExpensesCount || 0}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isHebrew ? 'לאישור' : 'Awaiting approval'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? 'עסקאות' : 'Transactions'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.yearToDate?.count || 0}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isHebrew ? 'סה"כ עסקאות' : 'Total transactions'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Period Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{isHebrew ? 'בחירת תקופת דיווח' : 'Reporting Period'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border rounded px-3 py-2"
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border rounded px-3 py-2"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2025, month - 1).toLocaleString(isHebrew ? 'he-IL' : 'en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="vat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vat">{isHebrew ? 'מע"מ' : 'VAT'}</TabsTrigger>
            <TabsTrigger value="income">{isHebrew ? 'מס הכנסה' : 'Income Tax'}</TabsTrigger>
            <TabsTrigger value="insurance">{isHebrew ? 'ביטוח לאומי' : 'National Insurance'}</TabsTrigger>
            <TabsTrigger value="expenses">{isHebrew ? 'הוצאות' : 'Expenses'}</TabsTrigger>
            <TabsTrigger value="reports">{isHebrew ? 'דוחות' : 'Reports'}</TabsTrigger>
          </TabsList>

          {/* VAT Tab */}
          <TabsContent value="vat">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? 'דוחות מע"מ' : 'VAT Declarations'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => generateReport('vat')}
                  className="mb-4"
                  data-testid="button-generate-vat"
                >
                  {isHebrew ? 'צור דוח מע"מ חודשי' : 'Generate Monthly VAT Report'}
                </Button>

                <div className="space-y-4">
                  {vatDeclarations?.map((decl: any) => (
                    <div key={decl.id} className="border rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold">
                            {decl.declarationId}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {new Date(decl.periodStart).toLocaleDateString()} - {new Date(decl.periodEnd).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded text-sm ${
                          decl.status === 'filed' ? 'bg-green-100 text-green-800' :
                          decl.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {decl.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">{isHebrew ? 'הכנסות' : 'Revenue'}</p>
                          <p className="font-semibold">₪{Number(decl.totalRevenue).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">{isHebrew ? 'הוצאות' : 'Expenses'}</p>
                          <p className="font-semibold">₪{Number(decl.totalExpenses).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">{isHebrew ? 'מע"מ פלט' : 'Output VAT'}</p>
                          <p className="font-semibold">₪{Number(decl.totalOutputVat).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">{isHebrew ? 'מע"מ לתשלום' : 'VAT Payable'}</p>
                          <p className="font-semibold text-red-600">₪{Number(decl.netVatPayable).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Income Tax Tab */}
          <TabsContent value="income">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? 'דוחות מס הכנסה' : 'Income Tax Declarations'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => generateReport('income-tax')}
                  data-testid="button-generate-income-tax"
                >
                  {isHebrew ? 'צור דוח מס הכנסה' : 'Generate Income Tax Report'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* National Insurance Tab */}
          <TabsContent value="insurance">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? 'דוחות ביטוח לאומי' : 'National Insurance Declarations'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => generateReport('national-insurance')}
                  data-testid="button-generate-insurance"
                >
                  {isHebrew ? 'צור דוח ביטוח לאומי' : 'Generate National Insurance Report'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? 'ניהול הוצאות' : 'Expense Management'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expenses?.map((expense: any) => (
                    <div key={expense.id} className="border rounded p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{expense.description}</h4>
                          <p className="text-sm text-gray-600">{expense.vendor}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {expense.category} • {expense.expenseId}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">₪{Number(expense.totalAmount).toLocaleString()}</p>
                          <span className={`text-xs px-2 py-1 rounded ${
                            expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                            expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {expense.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? 'חבילות דיווח חודשיות' : 'Monthly Financial Packages'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">
                      {isHebrew ? 'חבילה מלאה לרואה חשבון' : 'Complete Package for Accountant'}
                    </h4>
                    <p className="text-sm text-blue-800 mb-4">
                      {isHebrew 
                        ? 'כולל מע"מ, מס הכנסה, ביטוח לאומי + קבצי Excel ו-PDF'
                        : 'Includes VAT, Income Tax, National Insurance + Excel & PDF files'}
                    </p>
                    <Button variant="outline" className="w-full" data-testid="button-generate-package">
                      <Download className="mr-2 h-4 w-4" />
                      {isHebrew ? 'צור חבילה מלאה' : 'Generate Complete Package'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded p-4 text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                      <h4 className="font-semibold mb-1">{isHebrew ? 'דוח מע"מ' : 'VAT Report'}</h4>
                      <p className="text-sm text-gray-600">{isHebrew ? 'טופס 1206' : 'Form 1206'}</p>
                    </div>

                    <div className="border rounded p-4 text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                      <h4 className="font-semibold mb-1">{isHebrew ? 'מס הכנסה' : 'Income Tax'}</h4>
                      <p className="text-sm text-gray-600">{isHebrew ? 'דיווח חודשי' : 'Monthly Report'}</p>
                    </div>

                    <div className="border rounded p-4 text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                      <h4 className="font-semibold mb-1">{isHebrew ? 'ביטוח לאומי' : 'National Ins.'}</h4>
                      <p className="text-sm text-gray-600">{isHebrew ? 'דיווח חודשי' : 'Monthly Report'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
