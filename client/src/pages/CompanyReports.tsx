import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  BarChart, Download, FileText, TrendingUp, TrendingDown, 
  DollarSign, ShoppingCart, Users, Percent, Eye, Calendar,
  FileSpreadsheet, FileBarChart, PieChart, BarChart3,
  Building2, Megaphone, UserCheck, Briefcase, Settings
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function CompanyReports() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-01-31');
  const [exportFormat, setExportFormat] = useState('pdf');

  const downloadReport = async (language: 'hebrew' | 'english') => {
    try {
      const response = await fetch(`/api/company-reports/${language}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const filename = language === 'hebrew' 
        ? 'PetWash_Company_Report_Hebrew.md'
        : 'PetWash_Company_Report_English.md';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download report. Please try again.');
    }
  };

  const keyMetrics = [
    {
      label: 'Total Revenue',
      value: '₪2,458,320',
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'from-blue-500 to-purple-500'
    },
    {
      label: 'Total Orders',
      value: '18,492',
      change: '+8.3%',
      trend: 'up',
      icon: ShoppingCart,
      color: 'from-purple-500 to-pink-500'
    },
    {
      label: 'Active Customers',
      value: '12,847',
      change: '+15.2%',
      trend: 'up',
      icon: Users,
      color: 'from-green-500 to-teal-500'
    },
    {
      label: 'Growth Rate',
      value: '24.8%',
      change: '+3.1%',
      trend: 'up',
      icon: Percent,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const reportCategories = [
    {
      name: 'Financial Reports',
      description: 'Revenue, expenses, profit margins, and financial forecasts',
      icon: DollarSign,
      color: 'from-blue-500 to-purple-500'
    },
    {
      name: 'Operations Reports',
      description: 'Station performance, service efficiency, and operational metrics',
      icon: Settings,
      color: 'from-purple-500 to-pink-500'
    },
    {
      name: 'Marketing Analytics',
      description: 'Campaign performance, customer acquisition, and engagement',
      icon: Megaphone,
      color: 'from-green-500 to-teal-500'
    },
    {
      name: 'Customer Insights',
      description: 'Behavior patterns, satisfaction scores, and retention rates',
      icon: UserCheck,
      color: 'from-orange-500 to-yellow-500'
    },
    {
      name: 'HR & Team Reports',
      description: 'Employee performance, attendance, and team analytics',
      icon: Briefcase,
      color: 'from-red-500 to-pink-500'
    },
    {
      name: 'Business Intelligence',
      description: 'Comprehensive insights, trends, and strategic analytics',
      icon: BarChart3,
      color: 'from-indigo-500 to-blue-500'
    }
  ];

  const recentReports = [
    {
      id: 1,
      name: 'Monthly Revenue Analysis',
      type: 'Financial',
      date: '2025-01-15',
      status: 'completed'
    },
    {
      id: 2,
      name: 'Customer Satisfaction Survey',
      type: 'Customer',
      date: '2025-01-14',
      status: 'completed'
    },
    {
      id: 3,
      name: 'Operations Performance Q1',
      type: 'Operations',
      date: '2025-01-13',
      status: 'completed'
    },
    {
      id: 4,
      name: 'Marketing Campaign ROI',
      type: 'Marketing',
      date: '2025-01-12',
      status: 'completed'
    },
    {
      id: 5,
      name: 'Team Productivity Report',
      type: 'HR',
      date: '2025-01-11',
      status: 'completed'
    }
  ];

  const revenueData = [
    { month: 'Jul', revenue: 145000, orders: 1200 },
    { month: 'Aug', revenue: 168000, orders: 1350 },
    { month: 'Sep', revenue: 182000, orders: 1480 },
    { month: 'Oct', revenue: 195000, orders: 1620 },
    { month: 'Nov', revenue: 210000, orders: 1750 },
    { month: 'Dec', revenue: 225000, orders: 1890 },
    { month: 'Jan', revenue: 245000, orders: 2050 }
  ];

  const customerData = [
    { month: 'Jul', new: 320, returning: 880 },
    { month: 'Aug', new: 410, returning: 940 },
    { month: 'Sep', new: 380, returning: 1100 },
    { month: 'Oct', new: 450, returning: 1170 },
    { month: 'Nov', new: 520, returning: 1230 },
    { month: 'Dec', new: 580, returning: 1310 },
    { month: 'Jan', new: 640, returning: 1410 }
  ];

  const scheduledReports = [
    {
      id: 1,
      name: 'Weekly Revenue Summary',
      frequency: 'Weekly',
      nextRun: '2025-01-22'
    },
    {
      id: 2,
      name: 'Monthly Operations Review',
      frequency: 'Monthly',
      nextRun: '2025-02-01'
    },
    {
      id: 3,
      name: 'Quarterly Business Analysis',
      frequency: 'Quarterly',
      nextRun: '2025-04-01'
    }
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        
        {/* Header & Overview */}
        <div className="luxury-glass-card luxury-shadow-xl p-8 mb-8 luxury-animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <BarChart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="luxury-heading-lg luxury-text-gradient">Business Intelligence</h1>
                <p className="luxury-text-small">Comprehensive analytics and reporting center</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="input-start-date"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="input-end-date"
                />
              </div>
              
              <button className="luxury-btn-primary luxury-shadow-xl" data-testid="button-generate-report">
                <FileBarChart className="w-4 h-4 mr-2" />
                Generate Report
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="luxury-grid-4 mb-12">
          {keyMetrics.map((metric, index) => (
            <div
              key={index}
              className={`luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-${index + 1}`}
              data-testid={`card-metric-${index}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${metric.color} flex items-center justify-center`}>
                  <metric.icon className="w-6 h-6 text-white" />
                </div>
                <div className={`flex items-center gap-1 ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-semibold">{metric.change}</span>
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient mb-1">{metric.value}</div>
              <div className="luxury-text-small">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Report Categories */}
        <div className="mb-12">
          <h2 className="luxury-heading-md mb-6 luxury-animate-fade-in luxury-delay-5">Report Categories</h2>
          <div className="luxury-grid-3">
            {reportCategories.map((category, index) => (
              <div
                key={index}
                className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl p-6 luxury-animate-scale-in luxury-delay-${index + 6}`}
                data-testid={`card-category-${index}`}
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center mb-4`}>
                  <category.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="luxury-heading-md mb-2">{category.name}</h3>
                <p className="luxury-text-body mb-6">{category.description}</p>
                <button className="luxury-btn-primary w-full" data-testid={`button-view-${index}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Reports
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Revenue Chart */}
          <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-fade-in luxury-delay-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="luxury-heading-md">Revenue Trends</h3>
              <div className="flex gap-2">
                {['Week', 'Month', 'Quarter', 'Year'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period.toLowerCase())}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      selectedPeriod === period.toLowerCase()
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        : 'luxury-btn-ghost'
                    }`}
                    data-testid={`button-period-${period.toLowerCase()}`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#667eea" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Customer Chart */}
          <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-fade-in luxury-delay-2">
            <h3 className="luxury-heading-md mb-6">Customer Acquisition</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={customerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="new" stroke="#667eea" strokeWidth={2} name="New Customers" />
                <Line type="monotone" dataKey="returning" stroke="#764ba2" strokeWidth={2} name="Returning Customers" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Reports Table */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 mb-12 luxury-animate-fade-in luxury-delay-3">
          <h2 className="luxury-heading-md mb-6">Recent Reports</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4">
                    <span className="luxury-heading-sm luxury-text-gradient">Report Name</span>
                  </th>
                  <th className="text-left py-4 px-4">
                    <span className="luxury-heading-sm luxury-text-gradient">Type</span>
                  </th>
                  <th className="text-left py-4 px-4">
                    <span className="luxury-heading-sm luxury-text-gradient">Generated</span>
                  </th>
                  <th className="text-right py-4 px-4">
                    <span className="luxury-heading-sm luxury-text-gradient">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((report, index) => (
                  <tr
                    key={report.id}
                    className="luxury-glass-minimal luxury-hover-lift border-b border-gray-100"
                    data-testid={`row-report-${index}`}
                  >
                    <td className="py-4 px-4">
                      <span className="luxury-heading-sm">{report.name}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`luxury-badge ${
                        report.type === 'Financial' ? 'luxury-badge-gold' : 
                        report.type === 'Customer' ? 'luxury-badge-success' : ''
                      }`}>
                        {report.type}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="luxury-text-small">{report.date}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="luxury-btn-ghost" data-testid={`button-view-report-${index}`}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="luxury-btn-ghost" data-testid={`button-download-report-${index}`}>
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Options Panel */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-4">
            <h3 className="luxury-heading-md mb-6">Export Options</h3>
            
            <div className="mb-6">
              <label className="luxury-heading-sm mb-3 block">Export Format</label>
              <div className="flex gap-4">
                {[
                  { value: 'pdf', label: 'PDF Document', icon: FileText },
                  { value: 'excel', label: 'Excel Spreadsheet', icon: FileSpreadsheet },
                  { value: 'csv', label: 'CSV Data', icon: FileBarChart }
                ].map((format) => (
                  <label
                    key={format.value}
                    className={`flex-1 luxury-glass-minimal p-4 rounded-lg cursor-pointer transition-all ${
                      exportFormat === format.value ? 'ring-2 ring-purple-500' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      value={format.value}
                      checked={exportFormat === format.value}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="sr-only"
                      data-testid={`radio-${format.value}`}
                    />
                    <div className="flex items-center gap-3">
                      <format.icon className="w-5 h-5 text-purple-600" />
                      <span className="luxury-text-small font-semibold">{format.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="luxury-heading-sm mb-3 block">Include Data Fields</label>
              <div className="grid grid-cols-2 gap-3">
                {['Revenue Metrics', 'Customer Data', 'Operations Stats', 'Marketing Analytics', 'Team Performance', 'Growth Indicators'].map((field, index) => (
                  <label key={index} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      data-testid={`checkbox-field-${index}`}
                    />
                    <span className="luxury-text-small">{field}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="luxury-btn-primary w-full" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </button>
          </div>

          {/* Scheduled Reports */}
          <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-5">
            <h3 className="luxury-heading-md mb-6">Scheduled Reports</h3>
            <div className="space-y-3">
              {scheduledReports.map((schedule, index) => (
                <div
                  key={schedule.id}
                  className="luxury-glass-minimal p-4 rounded-lg"
                  data-testid={`schedule-${index}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="luxury-heading-sm text-sm">{schedule.name}</span>
                    <button className="luxury-btn-ghost p-1" data-testid={`button-edit-schedule-${index}`}>
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="luxury-badge text-xs">{schedule.frequency}</span>
                    <span className="luxury-text-small text-xs">Next: {schedule.nextRun}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Company Documentation Downloads */}
        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-6">
          <h2 className="luxury-heading-md mb-6 text-center">Company Documentation</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* English Report */}
            <div className="luxury-glass-panel p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="luxury-heading-sm text-center mb-2">English Report</h3>
              <p className="luxury-text-small text-center mb-4">Complete company documentation</p>
              <button
                className="luxury-btn-primary w-full"
                onClick={() => downloadReport('english')}
                data-testid="button-download-english"
              >
                <Download className="w-4 h-4 mr-2" />
                Download English
              </button>
            </div>

            {/* Hebrew Report */}
            <div className="luxury-glass-panel p-6" dir="rtl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="luxury-heading-sm text-center mb-2">דוח בעברית</h3>
              <p className="luxury-text-small text-center mb-4">תיעוד מלא של החברה</p>
              <button
                className="luxury-btn-primary w-full"
                onClick={() => downloadReport('hebrew')}
                data-testid="button-download-hebrew"
              >
                <Download className="w-4 h-4 mr-2" />
                הורד דוח בעברית
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
