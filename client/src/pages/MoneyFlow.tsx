import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ArrowDown, ArrowRight, CreditCard, Landmark, Wallet, Gift,
  Users, ShieldCheck, Banknote, Receipt, AlertCircle, CheckCircle,
  Building2, TrendingUp, BarChart2, Info, RefreshCw, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { type Language } from '@/lib/i18n';
import { ISRAELI_TAX_2026 } from '../../../shared/finance-flow-types';

interface MoneyFlowProps { language: Language; }

// ── Flow Step Component ───────────────────────────────────────────────────────

function FlowStep({
  icon: Icon, title, subtitle, color, badge, last = false,
}: {
  icon: any; title: string; subtitle: string; color: string; badge?: string; last?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`relative flex flex-col items-center p-4 rounded-xl border-2 w-44 text-center shadow-sm ${color}`}>
        {badge && (
          <span className="absolute -top-2.5 text-xs bg-white border rounded-full px-2 py-0.5 font-medium text-gray-600">{badge}</span>
        )}
        <Icon className="w-6 h-6 mb-2" />
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs opacity-70 mt-1 leading-tight">{subtitle}</p>
      </div>
      {!last && <ArrowDown className="w-5 h-5 text-gray-300 my-1" />}
    </div>
  );
}

// ── Formula Box ───────────────────────────────────────────────────────────────

function FormulaBox({ title, lines, accent = 'blue' }: { title: string; lines: string[]; accent?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-60">{title}</p>
      {lines.map((line, i) => (
        <p key={i} className="text-sm font-mono leading-relaxed">{line}</p>
      ))}
    </div>
  );
}

// ── Flow A: Marketplace Diagram ───────────────────────────────────────────────

function MarketplaceFlowDiagram() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Flow A — Marketplace Booking (with Provider)</h3>
        <Badge className="bg-blue-100 text-blue-700">ספק קיים</Badge>
      </div>
      <p className="text-sm text-gray-500">
        לקוח מזמין שירות מספק דרך הפלטפורמה (הליכות, שמירה, טיפוח). PetWash™ גובה עמלה ומחזיקה בנאמנות.
      </p>

      {/* Flow diagram */}
      <div className="flex flex-col items-center gap-0 md:hidden">
        <FlowStep icon={CreditCard} title="תשלום לקוח" subtitle="מחיר בסיס + עמלה + מע״מ" color="bg-blue-50 border-blue-300 text-blue-900" badge="Step 1" />
        <FlowStep icon={Landmark} title="Nayax / מעבד" subtitle="עמלת עיבוד מנוכה" color="bg-gray-50 border-gray-300 text-gray-800" badge="Step 2" />
        <FlowStep icon={Receipt} title="מע״מ 18%" subtitle="על עמלת הפלטפורמה בלבד" color="bg-amber-50 border-amber-300 text-amber-900" badge="Step 3" />
        <FlowStep icon={Building2} title="עמלת פלטפורמה" subtitle="15% עמלת PetWash™" color="bg-purple-50 border-purple-300 text-purple-900" badge="Step 4" />
        <FlowStep icon={ShieldCheck} title="נאמנות (Escrow)" subtitle="מוחזק 72 שעות" color="bg-indigo-50 border-indigo-300 text-indigo-900" badge="Step 5" />
        <FlowStep icon={Banknote} title="תשלום לספק" subtitle="85% לספק לאחר שחרור" color="bg-green-50 border-green-300 text-green-900" badge="Step 6" last />
      </div>

      {/* Desktop horizontal flow */}
      <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { icon: CreditCard, title: 'תשלום לקוח', sub: 'בסיס + עמלה + מע״מ', color: 'bg-blue-50 border-blue-300 text-blue-900', badge: '1' },
          { icon: Landmark, title: 'Nayax', sub: 'עמלת עיבוד', color: 'bg-gray-50 border-gray-300 text-gray-800', badge: '2' },
          { icon: Receipt, title: 'מע״מ 18%', sub: 'על עמלה בלבד', color: 'bg-amber-50 border-amber-300 text-amber-900', badge: '3' },
          { icon: Building2, title: 'עמלת פלטפורמה', sub: '15% PetWash™', color: 'bg-purple-50 border-purple-300 text-purple-900', badge: '4' },
          { icon: ShieldCheck, title: 'נאמנות 72ש׳', sub: 'מוחזק בבטחה', color: 'bg-indigo-50 border-indigo-300 text-indigo-900', badge: '5' },
          { icon: Banknote, title: 'תשלום לספק', sub: '85% לספק', color: 'bg-green-50 border-green-300 text-green-900', badge: '6' },
        ].map((step, i, arr) => (
          <div key={step.title} className="flex items-center gap-2">
            <div className={`flex flex-col items-center p-3 rounded-xl border-2 w-36 text-center shadow-sm ${step.color} relative`}>
              <span className="absolute -top-2.5 text-xs bg-white border rounded-full w-5 h-5 flex items-center justify-center font-bold text-gray-600">{step.badge}</span>
              <step.icon className="w-5 h-5 mb-1" />
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-xs opacity-60 mt-0.5">{step.sub}</p>
            </div>
            {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Formulas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormulaBox accent="blue" title="מה הלקוח משלם" lines={[
          'מחיר בסיס:          ₪100',
          'עמלת פלטפורמה (15%): ₪15',
          'מע״מ על עמלה (18%):  ₪2.70',
          '─────────────────────────',
          'סה״כ חיוב לקוח:      ₪117.70',
        ]} />
        <FormulaBox accent="green" title="מה הספק מקבל" lines={[
          'מחיר בסיס:           ₪100',
          'עמלת ספק (15%):     -₪15',
          '─────────────────────────',
          'תשלום לספק:          ₪85',
          '(לאחר שחרור נאמנות 72ש׳)',
        ]} />
        <FormulaBox accent="purple" title="הכנסת הפלטפורמה" lines={[
          'עמלת פלטפורמה:       ₪15',
          'מע״מ שנגבה:         +₪2.70',
          'עמלת עיבוד (Nayax): -₪X',
          '─────────────────────────',
          'הכנסה נטו PetWash™:  ₪15 - עמלות',
        ]} />
        <FormulaBox accent="amber" title="המע״מ (18%)" lines={[
          'מע״מ חל על: עמלת הפלטפורמה בלבד',
          'לא על מחיר הבסיס של הספק.',
          '',
          'מע״מ = עמלה × 0.18',
          'מע״מ = ₪15 × 0.18 = ₪2.70',
          'PetWash™ מעביר מע״מ לרשות המסים.',
        ]} />
      </div>

      {/* Provider tax info — only in marketplace flow */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
            <Info className="w-4 h-4" />
            מידע לספק — מסים עצמאיים (לא גובה הפלטפורמה)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-900 space-y-2">
          <p>הספק אחראי בעצמו למסים הבאים. הפלטפורמה <strong>אינה</strong> גובה אותם:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="font-semibold text-xs mb-1">מס הכנסה — לפי מדרגות</p>
              {ISRAELI_TAX_2026.INCOME_TAX_BRACKETS.map(b => (
                <div key={b.label} className="flex justify-between text-xs text-gray-600">
                  <span>{b.to === Infinity ? `₪${b.from.toLocaleString()}+` : `₪${b.from.toLocaleString()}–₪${b.to.toLocaleString()}`}</span>
                  <span className="font-medium">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="font-semibold text-xs mb-2">ביטוח לאומי + בריאות</p>
              <p className="text-xs text-gray-600">~9%–17% מההכנסה</p>
              <p className="text-xs text-gray-500 mt-1">(תלוי גובה ההכנסה)</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="font-semibold text-xs mb-2">מע״מ לספק (אם רלוונטי)</p>
              <p className="text-xs text-gray-600">עוסק מורשה: חייב גביית מע״מ 18%</p>
              <p className="text-xs text-gray-600 mt-1">עוסק פטור: פטור מגביית מע״מ</p>
            </div>
          </div>
          <p className="text-xs text-amber-700 mt-2">* PetWash™ אינה מספקת ייעוץ מס. מומלץ להתייעץ עם רואה חשבון.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Flow B: Direct Sale Diagram ───────────────────────────────────────────────

function DirectSaleFlowDiagram() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-gray-900">Flow B — מכירה ישירה של PetWash™ (ללא ספק)</h3>
        <Badge className="bg-emerald-100 text-emerald-700">ללא ספק</Badge>
      </div>
      <p className="text-sm text-gray-500">
        לקוח רוכש גיפט קארד / קרדיט ארנק / חבילת שטיפה ישירות מ-PetWash™ דרך Nayax. אין ספק מעורב.
      </p>

      {/* Flow diagram */}
      <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { icon: CreditCard, title: 'תשלום לקוח', sub: 'מחיר מוצר כולל מע״מ', color: 'bg-emerald-50 border-emerald-300 text-emerald-900', badge: '1' },
          { icon: Landmark, title: 'Nayax', sub: 'עמלת עיבוד', color: 'bg-gray-50 border-gray-300 text-gray-800', badge: '2' },
          { icon: Receipt, title: 'מע״מ 18%', sub: 'על כל המכירה', color: 'bg-amber-50 border-amber-300 text-amber-900', badge: '3' },
          { icon: Building2, title: 'הכנסת PetWash™', sub: 'מחיר נטו', color: 'bg-emerald-50 border-emerald-400 text-emerald-900', badge: '4' },
        ].map((step, i, arr) => (
          <div key={step.title} className="flex items-center gap-2">
            <div className={`flex flex-col items-center p-3 rounded-xl border-2 w-36 text-center shadow-sm ${step.color} relative`}>
              <span className="absolute -top-2.5 text-xs bg-white border rounded-full w-5 h-5 flex items-center justify-center font-bold text-gray-600">{step.badge}</span>
              <step.icon className="w-5 h-5 mb-1" />
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-xs opacity-60 mt-0.5">{step.sub}</p>
            </div>
            {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="flex flex-col items-center gap-0 md:hidden">
        <FlowStep icon={CreditCard} title="תשלום לקוח" subtitle="מחיר מוצר כולל מע״מ" color="bg-emerald-50 border-emerald-300 text-emerald-900" badge="Step 1" />
        <FlowStep icon={Landmark} title="Nayax" subtitle="עמלת עיבוד מנוכה" color="bg-gray-50 border-gray-300 text-gray-800" badge="Step 2" />
        <FlowStep icon={Receipt} title="מע״מ 18%" subtitle="על כל המכירה" color="bg-amber-50 border-amber-300 text-amber-900" badge="Step 3" />
        <FlowStep icon={Building2} title="הכנסת PetWash™" subtitle="מחיר נטו" color="bg-emerald-50 border-emerald-400 text-emerald-900" badge="Step 4" last />
      </div>

      {/* What does NOT happen */}
      <Card className="border-red-100 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            מה שלא קורה במכירה ישירה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              'אין תשלום לספק',
              'אין עמלת ספק',
              'אין נאמנות (Escrow)',
              'אין מידע מס לספק',
              'אין ביטוח לאומי לספק',
              'אין חלוקת הכנסה',
            ].map(item => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-red-700">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormulaBox accent="green" title="דוגמה — גיפט קארד ₪100" lines={[
          'מחיר ברוטו (כולל מע״מ):  ₪118',
          'מע״מ (18/118 × ₪118):    ₪18',
          'הכנסה לפני עמלת עיבוד:   ₪100',
          'עמלת Nayax:             -₪X',
          '─────────────────────────',
          'הכנסה נטו PetWash™:       ₪100 - עמלות',
        ]} />
        <FormulaBox accent="amber" title="מע״מ — מכירה ישירה" lines={[
          'PetWash™ היא המוכר.',
          'מע״מ חל על כל מחיר המכירה.',
          '',
          'מחיר ללא מע״מ × 1.18 = מחיר ללקוח',
          'או: מחיר ÷ 1.18 = בסיס מע״מ',
          '',
          'PetWash™ מעבירה מע״מ לרשות המסים.',
        ]} />
      </div>

      {/* Wallet stages */}
      <Card className="border-0 shadow-sm bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            שלבי ארנק / גיפט קארד — 2 שלבי חשבונאות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 bg-white rounded-lg p-3 border border-blue-200">
              <p className="font-semibold text-xs text-blue-700 mb-1">שלב 1 — רכישה</p>
              <p className="text-xs text-gray-600">לקוח משלם → רשום כהתחייבות (liability)</p>
              <p className="text-xs text-gray-600">יתרת ארנק נוצרת בחשבון הלקוח</p>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-300 self-center hidden md:block" />
            <div className="flex-1 bg-white rounded-lg p-3 border border-blue-200">
              <p className="font-semibold text-xs text-blue-700 mb-1">שלב 2 — מימוש</p>
              <p className="text-xs text-gray-600">אם שירות עם ספק → הופך ל-Flow A (marketplace)</p>
              <p className="text-xs text-gray-600">אם שירות PetWash™ → נשאר Flow B (direct sale)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{label}</span>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

export default function MoneyFlow({ language }: MoneyFlowProps) {
  const isHebrew = language === 'he';

  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ['/api/finance/money-flow-summary'],
  });

  const pieData = summary ? [
    { name: 'הזמנות מרקטפלייס', value: summary.totalMarketplaceGrossILS || 0 },
    { name: 'מכירות ישירות', value: summary.totalDirectSalesGrossILS || 0 },
    { name: 'גיפט קארד', value: summary.totalEGiftValueILS || 0 },
    { name: 'ארנק', value: summary.totalWalletTopupValueILS || 0 },
    { name: 'מימושי ארנק', value: summary.totalWalletRedemptionValueILS || 0 },
  ].filter(d => d.value > 0) : [];

  const barData = summary ? [
    { name: 'עמלות פלטפורמה', amount: summary.totalPlatformFeesILS || 0 },
    { name: 'תשלומים לספקים', amount: summary.totalProviderPayoutsILS || 0 },
    { name: 'מע״מ שנגבה', amount: summary.totalVATAllFlowsILS || 0 },
    { name: 'עמלות עיבוד', amount: summary.totalProcessorFeesILS || 0 },
    { name: 'החזרים', amount: summary.totalRefundsILS || 0 },
  ] : [];

  return (
    <Layout language={language}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {isHebrew ? 'תרשים זרימת כסף — PetWash™' : 'Money Flow Architecture — PetWash™'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isHebrew
              ? 'שני זרמי תשלום מופרדים: הזמנות מרקטפלייס עם ספק | מכירות ישירות ללא ספק'
              : 'Two separated financial flows: Marketplace bookings with provider | Direct PetWash™ sales without provider'}
          </p>
        </div>

        <Tabs defaultValue="diagrams">
          <TabsList className="mb-6">
            <TabsTrigger value="diagrams">תרשימי זרימה</TabsTrigger>
            <TabsTrigger value="kpis">מדדים פיננסיים</TabsTrigger>
            <TabsTrigger value="types">סוגי עסקאות</TabsTrigger>
            <TabsTrigger value="vat">מדריך מע״מ</TabsTrigger>
          </TabsList>

          {/* ── Diagrams ── */}
          <TabsContent value="diagrams" className="space-y-10">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Flow A — הזמנת מרקטפלייס (עם ספק)</CardTitle>
                <CardDescription>לקוח מזמין שירות מספק דרך PetWash™</CardDescription>
              </CardHeader>
              <CardContent><MarketplaceFlowDiagram /></CardContent>
            </Card>

            <Separator />

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Flow B — מכירה ישירה של PetWash™ (ללא ספק)</CardTitle>
                <CardDescription>גיפט קארד, ארנק, חבילות — PetWash™ היא המוכר</CardDescription>
              </CardHeader>
              <CardContent><DirectSaleFlowDiagram /></CardContent>
            </Card>
          </TabsContent>

          {/* ── KPIs ── */}
          <TabsContent value="kpis" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : (
              <>
                {/* Flow A KPIs */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Flow A — מרקטפלייס</h3>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">עם ספק</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={BarChart2} label="הזמנות מרקטפלייס" value={(summary?.totalMarketplaceBookings ?? '—').toString()} color="text-blue-500" />
                    <KpiCard icon={TrendingUp} label="מחזור ברוטו (₪)" value={`₪${(summary?.totalMarketplaceGrossILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="כל ההזמנות" color="text-blue-500" />
                    <KpiCard icon={Building2} label="עמלות פלטפורמה (₪)" value={`₪${(summary?.totalPlatformFeesILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="15% עמלה" color="text-purple-500" />
                    <KpiCard icon={Banknote} label="תשלומים לספקים (₪)" value={`₪${(summary?.totalProviderPayoutsILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="85% לספקים" color="text-green-500" />
                    <KpiCard icon={ShieldCheck} label="נאמנות מוחזקת (₪)" value={`₪${(summary?.totalEscrowHeldILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-indigo-500" />
                    <KpiCard icon={CheckCircle} label="נאמנות שוחררה (₪)" value={`₪${(summary?.totalEscrowReleasedILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-green-500" />
                    <KpiCard icon={Receipt} label='מע"מ Flow A (₪)' value={`₪${(summary?.totalVATMarketplaceILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="על עמלה" color="text-amber-500" />
                  </div>
                </div>

                <Separator />

                {/* Flow B KPIs */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Flow B — מכירות ישירות</h3>
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">ללא ספק</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={Building2} label="מכירות ישירות" value={(summary?.totalDirectPlatformSales ?? '—').toString()} color="text-emerald-500" />
                    <KpiCard icon={TrendingUp} label="מחזור מכירות (₪)" value={`₪${(summary?.totalDirectSalesGrossILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-emerald-500" />
                    <KpiCard icon={Gift} label="גיפט קארד נמכרו" value={(summary?.totalEGiftSales ?? '—').toString()} sub={`₪${(summary?.totalEGiftValueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })} שווי`} color="text-pink-500" />
                    <KpiCard icon={Wallet} label="טעינות ארנק" value={(summary?.totalWalletTopups ?? '—').toString()} sub={`₪${(summary?.totalWalletTopupValueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-blue-500" />
                    <KpiCard icon={RefreshCw} label="מימושי ארנק" value={(summary?.totalWalletRedemptions ?? '—').toString()} sub={`₪${(summary?.totalWalletRedemptionValueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })} מומשו`} color="text-violet-500" />
                    <KpiCard icon={Receipt} label='מע"מ Flow B (₪)' value={`₪${(summary?.totalVATDirectSalesILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="על מכירה ישירה" color="text-amber-500" />
                  </div>
                </div>

                <Separator />

                {/* Shared */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">משותף לשני הזרמים</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={Landmark} label="עמלות עיבוד (Nayax)" value={`₪${(summary?.totalProcessorFeesILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-gray-500" />
                    <KpiCard icon={Receipt} label='סה"כ מע"מ (VAT)' value={`₪${(summary?.totalVATAllFlowsILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="שני הזרמים — totalVATByFlow" color="text-amber-500" />
                    <KpiCard icon={TrendingUp} label="הכנסת פלטפורמה (₪)" value={`₪${(summary?.totalPlatformRevenue ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} sub="עמלות + מכירות נטו" color="text-green-600" />
                    <KpiCard icon={TrendingUp} label="הכנסה נטו PetWash™" value={`₪${(summary?.totalNetRevenueILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-green-600" />
                    <KpiCard icon={AlertCircle} label="החזרים" value={`₪${(summary?.totalRefundsILS ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} color="text-red-500" />
                    <KpiCard icon={AlertCircle} label="Chargebacks" value={(summary?.totalChargebacks ?? 0).toString()} sub="ערעורי כרטיס אשראי" color="text-red-600" />
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">חלוקת מחזור לפי סוג</CardTitle></CardHeader>
                    <CardContent>
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => `₪${parseFloat(v).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <p className="text-center text-sm text-gray-400 py-8">אין נתונים עדיין</p>}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">פירוט הוצאות והכנסות</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={barData} margin={{ left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: any) => `₪${parseFloat(v).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} />
                          <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Transaction Types ── */}
          <TabsContent value="types">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">סוגי עסקאות — מיון מלא</CardTitle>
                <CardDescription>כל עסקה במערכת חייבת להיות מסווגת לאחד מסוגים אלה</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-blue-100 text-blue-700">Flow A — מרקטפלייס</Badge>
                    </div>
                    <div className="space-y-2">
                      {[
                        { type: 'marketplace_booking', desc: 'הזמנת שירות עם ספק', note: 'יש ספק, יש נאמנות' },
                        { type: 'provider_payout', desc: 'תשלום לספק לאחר שחרור נאמנות', note: 'חייב providerId' },
                        { type: 'escrow_hold', desc: 'כספים מוחזקים בנאמנות', note: 'מקושר ל-bookingId' },
                        { type: 'escrow_release', desc: 'שחרור נאמנות לספק (72 שעות)', note: 'לאחר אישור שירות' },
                        { type: 'escrow_refund', desc: 'החזר מנאמנות (מחלוקת / ביטול)', note: 'admin decision' },
                        { type: 'platform_fee', desc: 'עמלת פלטפורמה (15%)', note: 'כניסה כספית לחברה' },
                      ].map(item => (
                        <div key={item.type} className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg">
                          <code className="text-xs font-mono text-blue-700 min-w-40">{item.type}</code>
                          <div>
                            <p className="text-xs font-medium">{item.desc}</p>
                            <p className="text-xs text-gray-500">{item.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-emerald-100 text-emerald-700">Flow B — מכירה ישירה</Badge>
                    </div>
                    <div className="space-y-2">
                      {[
                        { type: 'direct_platform_sale', desc: 'מכירת חבילה / מוצר ישירות', note: 'PetWash™ המוכר, אין ספק' },
                        { type: 'egift_sale', desc: 'מכירת גיפט קארד / stored value', note: 'ללא ספק — התחייבות כספית לחברה' },
                        { type: 'wallet_topup', desc: 'טעינת ארנק לקוח', note: 'ללא ספק — stored value liability' },
                        { type: 'wallet_redemption', desc: 'מימוש ארנק / גיפט קארד', note: 'מפעיל זרם חדש — A או B לפי השימוש' },
                      ].map(item => (
                        <div key={item.type} className="flex items-start gap-2 p-2.5 bg-emerald-50 rounded-lg">
                          <code className="text-xs font-mono text-emerald-700 min-w-40">{item.type}</code>
                          <div>
                            <p className="text-xs font-medium">{item.desc}</p>
                            <p className="text-xs text-gray-500">{item.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-4 mb-3">
                      <Badge className="bg-gray-100 text-gray-700">משותף — שני הזרמים</Badge>
                    </div>
                    <div className="space-y-2">
                      {[
                        { type: 'processing_fee', desc: 'עמלת מעבד תשלומים (Nayax)', note: 'שני הזרמים' },
                        { type: 'vat_entry', desc: 'רשומת מע״מ', note: '18% — מסווג לפי זרם' },
                        { type: 'refund', desc: 'החזר כספי', note: 'שני הזרמים' },
                        { type: 'adjustment', desc: 'תיקון ידני', note: 'admin only' },
                        { type: 'chargeback', desc: 'חיוב חוזר / ערעור', note: 'רשת כרטיסי אשראי' },
                      ].map(item => (
                        <div key={item.type} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
                          <code className="text-xs font-mono text-gray-600 min-w-40">{item.type}</code>
                          <div>
                            <p className="text-xs font-medium">{item.desc}</p>
                            <p className="text-xs text-gray-500">{item.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── VAT Guide ── */}
          <TabsContent value="vat">
            {/* eGift VAT mode advisory — Section 5 */}
            <div className="mb-6 p-4 bg-orange-50 border border-orange-300 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-orange-900 text-sm">⚠️ מע״מ על eGift / Wallet / Stored Value — דרוש אישור רו״ח</p>
                  <p className="text-orange-800 text-xs mt-1 leading-relaxed">
                    <strong>חשוב:</strong> לפני קיבוע סופי של לוגיקת מע״מ על eGift / wallet / stored value,
                    יש ליישם את הארכיטקטורה כך שתתמוך גם במודל <strong>deferred liability</strong> וגם במודל <strong>taxable sale</strong>,
                    ולסגור את ברירת המחדל הסופית עם רו״ח/יועץ מע״מ של החברה.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded-lg p-3 border border-orange-200">
                      <p className="font-semibold text-xs text-orange-800">מודל 1 — Deferred Liability (ברירת מחדל נוכחית)</p>
                      <p className="text-xs text-gray-600 mt-1">אירוע מע״מ = בעת <strong>מימוש</strong> הגיפט קארד / ארנק</p>
                      <p className="text-xs text-gray-500">רכישת התו = התחייבות, לא הכנסה סופית</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-orange-200">
                      <p className="font-semibold text-xs text-orange-800">מודל 2 — Taxable Sale</p>
                      <p className="text-xs text-gray-600 mt-1">אירוע מע״מ = בעת <strong>רכישת</strong> הגיפט קארד / ארנק</p>
                      <p className="text-xs text-gray-500">PetWash™ היא המוכרת הישירה של ה-stored value</p>
                    </div>
                  </div>
                  <p className="text-xs text-orange-700 mt-2 font-medium">
                    המערכת תומכת בשני המודלים — vatMode מאוחסן בכל עסקת egift/wallet. סגרו עם רו״ח לפני go-live.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    מע״מ בישראל 2026 — 18%
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-semibold text-amber-800">מע״מ = מס ערך מוסף</p>
                    <p className="text-amber-700 text-xs mt-1">זהו מס על שירותים ומוצרים. אינו קשור למס הכנסה.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-xs text-gray-500 uppercase">Flow A — מרקטפלייס</p>
                    <p className="text-gray-700">מע״מ מחושב על <strong>עמלת הפלטפורמה בלבד</strong> (15%).</p>
                    <code className="block text-xs bg-gray-50 p-2 rounded">מע״מ = עמלה × 18%</code>
                    <p className="text-xs text-gray-500">דוגמה: עמלה ₪15 → מע״מ ₪2.70</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-xs text-gray-500 uppercase">Flow B — מכירה ישירה</p>
                    <p className="text-gray-700">מע״מ מחושב על <strong>כל מחיר המכירה</strong>.</p>
                    <code className="block text-xs bg-gray-50 p-2 rounded">מע״מ = (מחיר ÷ 1.18) × 18%</code>
                    <p className="text-xs text-gray-500">דוגמה: גיפט קארד ₪118 → מע״מ ₪18</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">⚠️ מה מע״מ אינו</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="font-semibold text-red-800 text-sm">מע״מ 18% ≠ מס הכנסה</p>
                    <p className="text-red-700 text-xs mt-1">
                      מס הכנסה הוא מס נפרד לחלוטין.<br />
                      הוא מחושב לפי מדרגות, לא אחוז קבוע.<br />
                      הפלטפורמה אינה גובה מס הכנסה מספקים.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">מס חברות PetWash™</p>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">מס חברות (Israel 2026)</span>
                      <Badge className="bg-gray-200 text-gray-700">23%</Badge>
                    </div>
                    <p className="text-xs text-gray-500">PetWash™ משלמת 23% מס חברות על הרווחים הנקיים.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
