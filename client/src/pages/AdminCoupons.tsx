/**
 * AdminCoupons — Complete Phase 2 Admin Dashboard
 * RTL Hebrew, ILS, VAT 18%
 * Tabs: Coupons | Audit Trail | Reports
 * Features: create, clone, deactivate-with-reason, stats, export, issue-to-user, finance report
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tag,
  Plus,
  Ban,
  BarChart2,
  Search,
  Copy,
  CheckCircle,
  XCircle,
  RefreshCw,
  Percent,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Download,
  ClipboardList,
  SendHorizonal,
  Copy as CopyIcon,
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Coupon {
  id: number;
  code: string;
  campaign_name: string;
  description: string | null;
  discount_type: string;
  discount_percent: string | null;
  discount_amount: string | null;
  currency: string;
  min_spend_cents: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  scope_type: string;
  scope_value: string | null;
  channel_source: string | null;
  stackable: boolean;
  stackable_with: Record<string, boolean> | null;
  coupon_type: string;
  max_total_redemptions: number | null;
  max_redemptions_per_user: number;
  total_redemptions: number;
  audience_estimate: number | null;
  deactivate_reason: string | null;
  clone_of_coupon_id: number | null;
  redemption_count: string;
  rule_count: string;
  issuance_count: string;
  created_at: string;
}

interface AuditEntry {
  id: number;
  coupon_id: number | null;
  admin_user_id: string;
  action: string;
  details: any;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────
const SCOPE_OPTIONS = [
  { value: 'global',               label: 'גלובלי (כל הזמנה)' },
  { value: 'kiosk',                label: 'קיוסק שטיפה' },
  { value: 'loyalty_club',         label: 'מועדון נאמנות' },
  { value: 'sitter',               label: 'סיטר' },
  { value: 'walker',               label: 'מטייל' },
  { value: 'trainer',              label: 'מדריך' },
  { value: 'provider_marketplace', label: 'שוק ספקים' },
  { value: 'booking',              label: 'הזמנות (כלל)' },
  { value: 'wallet_topup',         label: 'טעינת ארנק' },
  { value: 'first_order',          label: 'הזמנה ראשונה' },
  { value: 'package',              label: 'חבילות' },
  { value: 'city',                 label: 'עיר ספציפית' },
  { value: 'country',              label: 'מדינה ספציפית' },
  { value: 'station',              label: 'תחנה ספציפית' },
  { value: 'franchise',            label: 'זכיינות ספציפית' },
];

const DISCOUNT_TYPES = [
  { value: 'fixed',          label: 'הנחה קבועה (₪)' },
  { value: 'percent',        label: 'הנחה באחוזים (%)' },
  { value: 'free_service',   label: 'שירות חינם' },
  { value: 'free_wash',      label: 'שטיפה חינם' },
  { value: 'package_credit', label: 'זיכוי חבילה' },
];

const CHANNEL_OPTIONS = [
  { value: 'admin',      label: 'מנהל (ידני)' },
  { value: 'sms',        label: 'SMS' },
  { value: 'email',      label: 'אימייל' },
  { value: 'push',       label: 'Push' },
  { value: 'app_banner', label: 'באנר אפליקציה' },
  { value: 'qr',         label: 'QR קוד' },
  { value: 'referral',   label: 'הפניה' },
];

const COUPON_TYPES = [
  { value: 'campaign', label: 'קמפיין (קוד משותף)' },
  { value: 'issued',   label: 'אישי (קוד למשתמש ספציפי)' },
];

const STACKABILITY_FIELDS = [
  { key: 'loyalty_5_pct',  label: 'נאמנות 5%' },
  { key: 'special_10_pct', label: 'מבצע 10%' },
  { key: 'wallet_credit',  label: 'אשראי ארנק' },
  { key: 'egift_balance',  label: 'מתנת e-Gift' },
  { key: 'package_credit', label: 'זיכוי חבילה' },
  { key: 'admin_discount', label: 'הנחה ידנית מנהל' },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function fmtCents(cents: string | number | null | undefined): string {
  const n = parseInt(String(cents ?? 0), 10);
  return `₪${(n / 100).toFixed(2)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function discountLabel(c: Coupon): string {
  if (c.discount_type === 'percent')       return `${c.discount_percent ?? 0}%`;
  if (c.discount_type === 'fixed')         return `₪${c.discount_amount ?? 0}`;
  if (c.discount_type === 'free_service')  return 'שירות חינם';
  if (c.discount_type === 'free_wash')     return 'שטיפה חינם';
  if (c.discount_type === 'package_credit') return 'זיכוי חבילה';
  return c.discount_type;
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    created:         'נוצר',
    updated:         'עודכן',
    deactivated:     'בוטל',
    cloned:          'שוכפל',
    exported:        'יוצא',
    issued_to_user:  'הונפק למשתמש',
    restored_redemption: 'מימוש שוחזר',
  };
  return labels[action] ?? action;
}

function actionColor(action: string): string {
  if (action === 'created')    return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (action === 'deactivated') return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  if (action === 'cloned')     return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FORM STATE
// ─────────────────────────────────────────────────────────────
const defaultForm = {
  code:                  '',
  campaignName:          '',
  description:           '',
  couponType:            'campaign',
  discountType:          'fixed',
  discountValue:         '',
  minSpendCents:         '0',
  startsAt:              '',
  endsAt:                '',
  channelSource:         'admin',
  scopeType:             'global',
  scopeValue:            '',
  maxTotalRedemptions:   '',
  maxRedemptionsPerUser: '1',
  stackable:             false,
  audienceEstimate:      '',
  stackableWith: {
    loyalty_5_pct:  false,
    special_10_pct: false,
    wallet_credit:  true,
    egift_balance:  true,
    package_credit: false,
    admin_discount: false,
  } as Record<string, boolean>,
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AdminCoupons() {
  const { dir } = useLanguage();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [statsId, setStatsId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Coupon | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [cloneTarget, setCloneTarget] = useState<Coupon | null>(null);
  const [cloneCode, setCloneCode] = useState('');
  const [issueTarget, setIssueTarget] = useState<Coupon | null>(null);
  const [issueUserId, setIssueUserId] = useState('');
  const [issueExpiresAt, setIssueExpiresAt] = useState('');
  const [form, setForm] = useState({ ...defaultForm, stackableWith: { ...defaultForm.stackableWith } });

  // ─── Queries ───
  const { data, isLoading, refetch } = useQuery<{ coupons: Coupon[] }>({
    queryKey: ['/api/admin/coupons'],
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<{ auditLog: AuditEntry[] }>({
    queryKey: ['/api/admin/coupons/audit-log'],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/admin/coupons', statsId, 'stats'],
    enabled: statsId !== null,
  });

  // ─── Mutations ───
  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiRequest('POST', '/api/admin/coupons', {
        ...body,
        discountValue:         parseFloat(body.discountValue) || 0,
        minSpendCents:         parseInt(body.minSpendCents, 10) || 0,
        maxTotalRedemptions:   body.maxTotalRedemptions ? parseInt(body.maxTotalRedemptions, 10) : undefined,
        maxRedemptionsPerUser: parseInt(body.maxRedemptionsPerUser, 10) || 1,
        audienceEstimate:      body.audienceEstimate ? parseInt(body.audienceEstimate, 10) : undefined,
        stackableWith:         body.stackableWith,
        eligibilityRules:      [],
      }),
    onSuccess: () => {
      toast({ title: 'קופון נוצר בהצלחה ✅' });
      setShowCreate(false);
      setForm({ ...defaultForm, stackableWith: { ...defaultForm.stackableWith } });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
    },
    onError: (e: any) => {
      toast({ title: 'שגיאה ביצירת קופון', description: e?.message ?? '', variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest('POST', `/api/admin/coupons/${id}/deactivate`, { reason }),
    onSuccess: () => {
      toast({ title: 'קופון בוטל ✅' });
      setDeactivateTarget(null);
      setDeactivateReason('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons/audit-log'] });
    },
    onError: () => toast({ title: 'שגיאה בביטול קופון', variant: 'destructive' }),
  });

  const cloneMutation = useMutation({
    mutationFn: ({ id, newCode }: { id: number; newCode: string }) =>
      apiRequest('POST', `/api/admin/coupons/${id}/clone`, { newCode }),
    onSuccess: () => {
      toast({ title: 'קמפיין שוכפל ✅' });
      setCloneTarget(null);
      setCloneCode('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
    },
    onError: () => toast({ title: 'שגיאה בשכפול', variant: 'destructive' }),
  });

  const issueMutation = useMutation({
    mutationFn: ({ id, userId, expiresAt }: { id: number; userId: string; expiresAt?: string }) =>
      apiRequest('POST', `/api/admin/coupons/${id}/issue-to-user`, { userId, expiresAt: expiresAt || undefined }),
    onSuccess: () => {
      toast({ title: 'קופון הונפק למשתמש ✅' });
      setIssueTarget(null);
      setIssueUserId('');
      setIssueExpiresAt('');
    },
    onError: () => toast({ title: 'שגיאה בהנפקה', variant: 'destructive' }),
  });

  const exportCsv = (couponId: number, code: string) => {
    window.open(`/api/admin/coupons/${couponId}/export`, '_blank');
    toast({ title: `מייצא נתוני ${code}...` });
  };

  const coupons = (data?.coupons ?? []).filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.campaign_name?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCoupons = coupons.filter(c => c.is_active).length;
  const totalRedemptions = coupons.reduce((s, c) => s + parseInt(c.redemption_count ?? '0', 10), 0);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: `קוד ${code} הועתק` });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-xl">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">מנהל קופונים</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">PetWash™ Coupon Engine — Phase 2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 ml-1" />
              רענון
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="w-4 h-4 ml-1" />
              קופון חדש
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'סה״כ קופונים', value: coupons.length, color: 'text-purple-600', icon: Tag },
            { label: 'פעילים',       value: activeCoupons,  color: 'text-green-600',  icon: CheckCircle },
            { label: 'מימושים',      value: totalRedemptions, color: 'text-blue-600', icon: TrendingUp },
            { label: 'מבוטלים',      value: coupons.length - activeCoupons, color: 'text-gray-500', icon: XCircle },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-7 h-7 ${s.color} opacity-70`} />
                <div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="coupons" dir={dir as any}>
          <TabsList>
            <TabsTrigger value="coupons">קופונים ({coupons.length})</TabsTrigger>
            <TabsTrigger value="audit">לוג ביקורת ({auditData?.auditLog?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* ─── COUPONS TAB ─── */}
          <TabsContent value="coupons" className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי קוד או שם קמפיין..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-400">טוען...</div>
                ) : coupons.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <div>לא נמצאו קופונים</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">קוד</TableHead>
                          <TableHead className="text-right">קמפיין</TableHead>
                          <TableHead className="text-right">סוג</TableHead>
                          <TableHead className="text-right">הנחה</TableHead>
                          <TableHead className="text-right">היקף</TableHead>
                          <TableHead className="text-right">תוקף</TableHead>
                          <TableHead className="text-right">מימושים</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coupons.map(coupon => (
                          <>
                            <TableRow
                              key={coupon.id}
                              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                              onClick={() => setExpandedId(expandedId === coupon.id ? null : coupon.id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-purple-700 dark:text-purple-400 text-sm">{coupon.code}</span>
                                  <button onClick={e => { e.stopPropagation(); copyCode(coupon.code); }} className="text-gray-400 hover:text-gray-600">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  {coupon.clone_of_coupon_id && <Badge variant="outline" className="text-xs">שוכפל</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[120px] truncate text-sm">{coupon.campaign_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {coupon.coupon_type === 'issued' ? 'אישי' : 'קמפיין'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {coupon.discount_type === 'percent' ? <Percent className="w-3 h-3 text-gray-400" /> : <ShoppingBag className="w-3 h-3 text-gray-400" />}
                                  <span className="text-sm font-medium">{discountLabel(coupon)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {SCOPE_OPTIONS.find(o => o.value === coupon.scope_type)?.label ?? coupon.scope_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-gray-500">{fmtDate(coupon.valid_until)}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <span className="font-medium">{coupon.redemption_count}</span>
                                  {coupon.max_total_redemptions && <span className="text-gray-400">/{coupon.max_total_redemptions}</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                {coupon.is_active ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs gap-1">
                                    <CheckCircle className="w-3 h-3" />פעיל
                                  </Badge>
                                ) : (
                                  <div>
                                    <Badge variant="secondary" className="text-xs gap-1 mb-0.5">
                                      <XCircle className="w-3 h-3" />מבוטל
                                    </Badge>
                                    {coupon.deactivate_reason && (
                                      <div className="text-xs text-gray-400 truncate max-w-[80px]">{coupon.deactivate_reason}</div>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); setStatsId(coupon.id); }}>
                                    <BarChart2 className="w-3 h-3 ml-1" />סטטס
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); exportCsv(coupon.id, coupon.code); }}>
                                    <Download className="w-3 h-3 ml-1" />CSV
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); setCloneTarget(coupon); setCloneCode(coupon.code + '_COPY'); }}>
                                    <CopyIcon className="w-3 h-3 ml-1" />שכפל
                                  </Button>
                                  {coupon.coupon_type === 'issued' && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); setIssueTarget(coupon); }}>
                                      <SendHorizonal className="w-3 h-3 ml-1" />הנפק
                                    </Button>
                                  )}
                                  {coupon.is_active && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={e => { e.stopPropagation(); setDeactivateTarget(coupon); }}>
                                      <Ban className="w-3 h-3 ml-1" />בטל
                                    </Button>
                                  )}
                                  {expandedId === coupon.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>
                              </TableCell>
                            </TableRow>

                            {expandedId === coupon.id && (
                              <TableRow key={`${coupon.id}-detail`} className="bg-gray-50 dark:bg-gray-800/40">
                                <TableCell colSpan={9} className="py-3 px-6">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                    <div><div className="text-gray-400 text-xs mb-1">מינ׳ רכישה</div><div>{fmtCents(coupon.min_spend_cents)}</div></div>
                                    <div><div className="text-gray-400 text-xs mb-1">מקס׳ למשתמש</div><div>{coupon.max_redemptions_per_user}</div></div>
                                    <div><div className="text-gray-400 text-xs mb-1">ערוץ חלוקה</div><div>{coupon.channel_source ?? '—'}</div></div>
                                    <div><div className="text-gray-400 text-xs mb-1">הנפקות</div><div>{coupon.issuance_count}</div></div>
                                    <div><div className="text-gray-400 text-xs mb-1">תחילה</div><div>{fmtDate(coupon.valid_from)}</div></div>
                                    <div><div className="text-gray-400 text-xs mb-1">קהל משוער</div><div>{coupon.audience_estimate ?? '—'}</div></div>
                                    <div><div className="text-gray-400 text-xs mb-1">כללי זכאות</div><div>{coupon.rule_count}</div></div>
                                    <div className="col-span-2">
                                      <div className="text-gray-400 text-xs mb-1">ניתן לצבירה עם</div>
                                      <div className="flex flex-wrap gap-1">
                                        {coupon.stackable_with ? Object.entries(coupon.stackable_with).filter(([, v]) => v).map(([k]) => (
                                          <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                                        )) : <span className="text-gray-400">—</span>}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── AUDIT LOG TAB ─── */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-gray-500" />
                  לוג פעולות מנהל
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {auditLoading ? (
                  <div className="p-6 text-center text-gray-400">טוען...</div>
                ) : !auditData?.auditLog?.length ? (
                  <div className="p-6 text-center text-gray-400">אין רשומות לוג</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">פעולה</TableHead>
                          <TableHead className="text-right">קופון</TableHead>
                          <TableHead className="text-right">מנהל</TableHead>
                          <TableHead className="text-right">פרטים</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditData.auditLog.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs text-gray-500">{fmtDateTime(entry.created_at)}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${actionColor(entry.action)}`}>
                                {actionLabel(entry.action)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">{entry.coupon_id ?? '—'}</TableCell>
                            <TableCell className="text-xs font-mono text-gray-500 max-w-[100px] truncate">{entry.admin_user_id}</TableCell>
                            <TableCell className="text-xs text-gray-500 max-w-[160px] truncate">
                              {typeof entry.details === 'object' ? JSON.stringify(entry.details) : String(entry.details ?? '')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── CREATE DIALOG ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              יצירת קופון חדש
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>קוד קופון *</Label>
                <Input placeholder="SUMMER25" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="font-mono" />
              </div>
              <div>
                <Label>שם קמפיין *</Label>
                <Input placeholder="קיץ 2026" value={form.campaignName} onChange={e => setForm(f => ({ ...f, campaignName: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>סוג קופון</Label>
                <Select value={form.couponType} onValueChange={v => setForm(f => ({ ...f, couponType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUPON_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>ערוץ חלוקה</Label>
                <Select value={form.channelSource} onValueChange={v => setForm(f => ({ ...f, channelSource: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>תיאור</Label>
              <Input placeholder="תיאור הקמפיין" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>סוג הנחה *</Label>
                <Select value={form.discountType} onValueChange={v => setForm(f => ({ ...f, discountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISCOUNT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.discountType === 'percent' ? 'אחוז (%)' : 'סכום (₪)'}</Label>
                <Input type="number" min="0" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                  disabled={['free_service', 'free_wash', 'package_credit'].includes(form.discountType)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>היקף שימוש</Label>
                <Select value={form.scopeType} onValueChange={v => setForm(f => ({ ...f, scopeType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {['city', 'country', 'station', 'franchise'].includes(form.scopeType) && (
                <div>
                  <Label>ערך היקף (עיר / מדינה / תחנה)</Label>
                  <Input value={form.scopeValue} onChange={e => setForm(f => ({ ...f, scopeValue: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>מינ׳ רכישה (₪)</Label>
                <Input type="number" min="0" value={(parseInt(form.minSpendCents, 10) / 100 || 0).toFixed(2)}
                  onChange={e => setForm(f => ({ ...f, minSpendCents: String(Math.round(parseFloat(e.target.value) * 100) || 0) }))} />
              </div>
              <div>
                <Label>מקס׳ מימושים</Label>
                <Input type="number" min="1" placeholder="ללא הגבלה" value={form.maxTotalRedemptions} onChange={e => setForm(f => ({ ...f, maxTotalRedemptions: e.target.value }))} />
              </div>
              <div>
                <Label>מקס׳ למשתמש</Label>
                <Input type="number" min="1" value={form.maxRedemptionsPerUser} onChange={e => setForm(f => ({ ...f, maxRedemptionsPerUser: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>תאריך התחלה</Label>
                <Input type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div>
                <Label>תאריך סיום</Label>
                <Input type="date" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
              </div>
              <div>
                <Label>קהל משוער</Label>
                <Input type="number" min="1" placeholder="1000" value={form.audienceEstimate} onChange={e => setForm(f => ({ ...f, audienceEstimate: e.target.value }))} />
              </div>
            </div>

            {/* Stackability matrix */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.stackable} onChange={e => setForm(f => ({ ...f, stackable: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium">ניתן לצבירה כללית</span>
                </label>
              </div>
              <div className="border rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-800">
                <div className="text-xs font-semibold text-gray-500 mb-2">מטריצת ניתן לצבירה עם:</div>
                <div className="grid grid-cols-2 gap-2">
                  {STACKABILITY_FIELDS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={form.stackableWith[f.key] ?? false}
                        onChange={e => setForm(prev => ({ ...prev, stackableWith: { ...prev.stackableWith, [f.key]: e.target.checked } }))}
                        className="w-3.5 h-3.5 rounded"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>ביטול</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.code || !form.campaignName}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {createMutation.isPending ? 'יוצר...' : 'צור קופון'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DEACTIVATE DIALOG ─── */}
      <Dialog open={deactivateTarget !== null} onOpenChange={open => !open && setDeactivateTarget(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ביטול קופון
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              ביטול קמפיין <span className="font-mono font-bold">{deactivateTarget?.code}</span>.
              פעולה זו תירשם בלוג הביקורת.
            </div>
            <div>
              <Label>סיבת הביטול *</Label>
              <Input
                placeholder="למשל: קמפיין הסתיים / שימוש לרעה / שגיאה טכנית"
                value={deactivateReason}
                onChange={e => setDeactivateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>ביטול</Button>
            <Button
              variant="destructive"
              onClick={() => deactivateTarget && deactivateMutation.mutate({ id: deactivateTarget.id, reason: deactivateReason })}
              disabled={deactivateMutation.isPending || !deactivateReason.trim()}
            >
              {deactivateMutation.isPending ? 'מבטל...' : 'אשר ביטול'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CLONE DIALOG ─── */}
      <Dialog open={cloneTarget !== null} onOpenChange={open => !open && setCloneTarget(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CopyIcon className="w-5 h-5 text-blue-600" />
              שכפול קמפיין
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-gray-500">מבוסס על: <span className="font-mono font-bold">{cloneTarget?.code}</span></div>
            <div>
              <Label>קוד קמפיין חדש *</Label>
              <Input className="font-mono" value={cloneCode} onChange={e => setCloneCode(e.target.value.toUpperCase())} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloneTarget(null)}>ביטול</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => cloneTarget && cloneMutation.mutate({ id: cloneTarget.id, newCode: cloneCode })}
              disabled={cloneMutation.isPending || !cloneCode.trim()}
            >
              {cloneMutation.isPending ? 'משכפל...' : 'שכפל קמפיין'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ISSUE TO USER DIALOG ─── */}
      <Dialog open={issueTarget !== null} onOpenChange={open => !open && setIssueTarget(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SendHorizonal className="w-5 h-5 text-purple-600" />
              הנפקה אישית למשתמש
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-gray-500">קופון: <span className="font-mono font-bold">{issueTarget?.code}</span></div>
            <div>
              <Label>מזהה משתמש (Firebase UID) *</Label>
              <Input placeholder="firebase_uid" value={issueUserId} onChange={e => setIssueUserId(e.target.value)} />
            </div>
            <div>
              <Label>תאריך פקיעה (אופציונלי)</Label>
              <Input type="date" value={issueExpiresAt} onChange={e => setIssueExpiresAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIssueTarget(null)}>ביטול</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => issueTarget && issueMutation.mutate({ id: issueTarget.id, userId: issueUserId, expiresAt: issueExpiresAt || undefined })}
              disabled={issueMutation.isPending || !issueUserId.trim()}
            >
              {issueMutation.isPending ? 'מנפיק...' : 'הנפק קופון'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── STATS DIALOG ─── */}
      <Dialog open={statsId !== null} onOpenChange={open => !open && setStatsId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              סטטיסטיקות + דו״ח פיננסי
              {statsData?.coupon && <span className="font-mono text-purple-600 text-sm">({statsData.coupon.code})</span>}
            </DialogTitle>
          </DialogHeader>

          {statsLoading ? (
            <div className="py-8 text-center text-gray-400">טוען...</div>
          ) : statsData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'מימושים', value: statsData.stats?.total_redemptions ?? 0, color: 'text-blue-600', icon: TrendingUp },
                  { label: 'בוטלו',   value: statsData.stats?.cancelled_count ?? 0,   color: 'text-red-600',  icon: XCircle },
                  { label: 'משתמשים ייחודיים', value: statsData.stats?.unique_users ?? 0, color: 'text-green-600', icon: Users },
                  { label: 'סה״כ הנחות', value: `₪${((parseInt(String(statsData.stats?.net_discount_cents ?? 0), 10)) / 100).toFixed(2)}`, color: 'text-orange-600', icon: DollarSign },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-3 text-center">
                      <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color} opacity-70`} />
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-500">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {statsData.issuances && (
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">הנפקות אישיות</div>
                    <div className="flex gap-4 text-sm">
                      <span>סה״כ: <strong>{statsData.issuances.total}</strong></span>
                      <span>זמינות: <strong className="text-green-600">{statsData.issuances.available}</strong></span>
                      <span>מומשו: <strong className="text-blue-600">{statsData.issuances.redeemed}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {statsData.delivery?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">ביצועי ערוצי חלוקה</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {['ערוץ', 'נשלח', 'נמסר', 'נפתח', 'נלחץ', 'מומש'].map(h => (
                            <TableHead key={h} className="text-right text-xs">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statsData.delivery.map((row: any) => (
                          <TableRow key={row.channel}>
                            <TableCell className="text-xs">{row.channel}</TableCell>
                            <TableCell className="text-xs">{row.sent}</TableCell>
                            <TableCell className="text-xs">{row.delivered}</TableCell>
                            <TableCell className="text-xs">{row.opened}</TableCell>
                            <TableCell className="text-xs">{row.clicked}</TableCell>
                            <TableCell className="text-xs font-medium text-green-600">{row.redeemed}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {statsData.rules?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">כללי זכאות</div>
                  <div className="flex flex-wrap gap-2">
                    {statsData.rules.map((r: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {r.rule_type}{r.rule_value ? `: ${r.rule_value}` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => statsId && exportCsv(statsId, statsData?.coupon?.code ?? '')}>
                  <Download className="w-3.5 h-3.5 ml-1" />
                  ייצוא CSV
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsId(null)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
