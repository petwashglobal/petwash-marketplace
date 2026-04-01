/**
 * AdminCoupons — Coupon Engine Admin Dashboard
 * RTL Hebrew, ILS, VAT 18%
 * Backend-only discount logic. No discount calculations on this page.
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
} from 'lucide-react';

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
  channel_source: string | null;
  stackable: boolean;
  max_total_redemptions: number | null;
  max_redemptions_per_user: number;
  total_redemptions: number;
  redemption_count: string;
  rule_count: string;
  created_at: string;
}

interface CouponStats {
  coupon: Coupon;
  stats: {
    total_redemptions: string;
    unique_users: string;
    total_discount_cents: string;
    avg_discount_cents: string;
    first_redeemed_at: string | null;
    last_redeemed_at: string | null;
  };
  delivery: Array<{
    channel: string;
    sent: string;
    delivered: string;
    opened: string;
    clicked: string;
    redeemed: string;
  }>;
  rules: Array<{ rule_type: string; rule_value: string | null }>;
}

const SCOPE_OPTIONS = [
  { value: 'global', label: 'גלובלי (כל הזמנה)' },
  { value: 'kiosk', label: 'קיוסק שטיפה' },
  { value: 'booking', label: 'הזמנות (סיטר + מטייל)' },
  { value: 'sitter', label: 'סיטר בלבד' },
  { value: 'walker', label: 'מטייל בלבד' },
  { value: 'wallet_topup', label: 'טעינת ארנק' },
  { value: 'loyalty', label: 'תגמול נאמנות' },
  { value: 'first_order', label: 'הזמנה ראשונה' },
];

const DISCOUNT_TYPES = [
  { value: 'fixed', label: 'הנחה קבועה (₪)' },
  { value: 'percent', label: 'הנחה באחוזים (%)' },
  { value: 'free_service', label: 'שירות חינם' },
  { value: 'free_wash', label: 'שטיפה חינם' },
  { value: 'package_credit', label: 'זיכוי חבילה' },
];

const CHANNEL_OPTIONS = [
  { value: 'admin', label: 'מנהל (ידני)' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'אימייל' },
  { value: 'push', label: 'התראת Push' },
  { value: 'app_banner', label: 'באנר אפליקציה' },
  { value: 'qr', label: 'QR קוד' },
  { value: 'referral', label: 'הפניה' },
];

function fmtCents(cents: string | number | null | undefined): string {
  const n = parseInt(String(cents ?? 0), 10);
  return `₪${(n / 100).toFixed(2)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function discountLabel(c: Coupon): string {
  if (c.discount_type === 'percent') return `${c.discount_percent ?? 0}%`;
  if (c.discount_type === 'fixed') return `₪${c.discount_amount ?? 0}`;
  if (c.discount_type === 'free_service') return 'שירות חינם';
  if (c.discount_type === 'free_wash') return 'שטיפה חינם';
  if (c.discount_type === 'package_credit') return 'זיכוי חבילה';
  return c.discount_type;
}

export default function AdminCoupons() {
  const { dir } = useLanguage();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [statsId, setStatsId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    code: '',
    campaignName: '',
    description: '',
    discountType: 'fixed',
    discountValue: '',
    minSpendCents: '0',
    startsAt: '',
    endsAt: '',
    channelSource: 'admin',
    scopeType: 'global',
    maxTotalRedemptions: '',
    maxRedemptionsPerUser: '1',
    stackable: false,
  });

  const { data, isLoading, refetch } = useQuery<{ coupons: Coupon[] }>({
    queryKey: ['/api/admin/coupons'],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<CouponStats>({
    queryKey: ['/api/admin/coupons', statsId, 'stats'],
    enabled: statsId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiRequest('POST', '/api/admin/coupons', {
        ...body,
        discountValue: parseFloat(body.discountValue) || 0,
        minSpendCents: parseInt(body.minSpendCents, 10) || 0,
        maxTotalRedemptions: body.maxTotalRedemptions ? parseInt(body.maxTotalRedemptions, 10) : undefined,
        maxRedemptionsPerUser: parseInt(body.maxRedemptionsPerUser, 10) || 1,
        eligibilityRules: [],
      }),
    onSuccess: () => {
      toast({ title: 'קופון נוצר בהצלחה ✅' });
      setShowCreate(false);
      setForm({ code: '', campaignName: '', description: '', discountType: 'fixed', discountValue: '', minSpendCents: '0', startsAt: '', endsAt: '', channelSource: 'admin', scopeType: 'global', maxTotalRedemptions: '', maxRedemptionsPerUser: '1', stackable: false });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
    },
    onError: (e: any) => {
      toast({ title: 'שגיאה ביצירת קופון', description: e?.message ?? 'שגיאה לא ידועה', variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/coupons/${id}`),
    onSuccess: () => {
      toast({ title: 'קופון בוטל ✅' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
    },
    onError: () => {
      toast({ title: 'שגיאה בביטול קופון', variant: 'destructive' });
    },
  });

  const coupons = (data?.coupons ?? []).filter(c =>
    search === '' ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
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
              <p className="text-sm text-gray-500 dark:text-gray-400">PetWash™ Coupon Engine</p>
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

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{coupons.length}</div>
              <div className="text-xs text-gray-500 mt-1">סה״כ קופונים</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{activeCoupons}</div>
              <div className="text-xs text-gray-500 mt-1">קופונים פעילים</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{totalRedemptions}</div>
              <div className="text-xs text-gray-500 mt-1">מימושים (כלל)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{coupons.length - activeCoupons}</div>
              <div className="text-xs text-gray-500 mt-1">מבוטלים / פגו תוקף</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="חיפוש לפי קוד או שם קמפיין..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Coupons Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">רשימת קופונים ({coupons.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">טוען...</div>
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
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-purple-700 dark:text-purple-400 text-sm">
                                {coupon.code}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); copyCode(coupon.code); }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate text-sm">{coupon.campaign_name}</TableCell>
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
                          <TableCell className="text-xs text-gray-500">
                            {fmtDate(coupon.valid_until)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{coupon.redemption_count}</span>
                              {coupon.max_total_redemptions && (
                                <span className="text-gray-400"> / {coupon.max_total_redemptions}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {coupon.is_active ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs gap-1">
                                <CheckCircle className="w-3 h-3" />פעיל
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <XCircle className="w-3 h-3" />מבוטל
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={e => { e.stopPropagation(); setStatsId(coupon.id); }}
                              >
                                <BarChart2 className="w-3 h-3 ml-1" />
                                סטטס
                              </Button>
                              {coupon.is_active && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={e => { e.stopPropagation(); deactivateMutation.mutate(coupon.id); }}
                                  disabled={deactivateMutation.isPending}
                                >
                                  <Ban className="w-3 h-3 ml-1" />
                                  בטל
                                </Button>
                              )}
                              {expandedId === coupon.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedId === coupon.id && (
                          <TableRow key={`${coupon.id}-detail`} className="bg-gray-50 dark:bg-gray-800/50">
                            <TableCell colSpan={8} className="py-3 px-6">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">מינימום רכישה</div>
                                  <div>{fmtCents(coupon.min_spend_cents)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">מקסימום מימושים (למשתמש)</div>
                                  <div>{coupon.max_redemptions_per_user}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">ערוץ חלוקה</div>
                                  <div>{coupon.channel_source ?? '—'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">ניתן לצבירה</div>
                                  <div>{coupon.stackable ? 'כן' : 'לא'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">תאריך התחלה</div>
                                  <div>{fmtDate(coupon.valid_from)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">תאריך סיום</div>
                                  <div>{fmtDate(coupon.valid_until)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">כללי זכאות</div>
                                  <div>{coupon.rule_count} כללים</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">תיאור</div>
                                  <div className="truncate">{coupon.description ?? '—'}</div>
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
      </div>

      {/* Create Coupon Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
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
                <Input
                  placeholder="SUMMER25"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>שם קמפיין *</Label>
                <Input
                  placeholder="קיץ 2026"
                  value={form.campaignName}
                  onChange={e => setForm(f => ({ ...f, campaignName: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>תיאור (אופציונלי)</Label>
              <Input
                placeholder="הנחה לקיץ עבור לקוחות נאמנים"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>סוג הנחה *</Label>
                <Select value={form.discountType} onValueChange={v => setForm(f => ({ ...f, discountType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPES.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {form.discountType === 'percent' ? 'אחוז הנחה *' : 'סכום הנחה (₪) *'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={form.discountType === 'percent' ? '10' : '15.00'}
                  value={form.discountValue}
                  onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                  disabled={['free_service', 'free_wash', 'package_credit'].includes(form.discountType)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>היקף שימוש</Label>
                <Select value={form.scopeType} onValueChange={v => setForm(f => ({ ...f, scopeType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ערוץ חלוקה</Label>
                <Select value={form.channelSource} onValueChange={v => setForm(f => ({ ...f, channelSource: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>מינימום רכישה (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={(parseInt(form.minSpendCents, 10) / 100).toFixed(2)}
                  onChange={e => setForm(f => ({ ...f, minSpendCents: String(Math.round(parseFloat(e.target.value) * 100) || 0) }))}
                />
              </div>
              <div>
                <Label>מקסימום מימושים כולל</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="ללא הגבלה"
                  value={form.maxTotalRedemptions}
                  onChange={e => setForm(f => ({ ...f, maxTotalRedemptions: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>מקסימום למשתמש</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maxRedemptionsPerUser}
                  onChange={e => setForm(f => ({ ...f, maxRedemptionsPerUser: e.target.value }))}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.stackable}
                    onChange={e => setForm(f => ({ ...f, stackable: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">ניתן לצבירה עם קופונים אחרים</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>תאריך התחלה</Label>
                <Input
                  type="date"
                  value={form.startsAt}
                  onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label>תאריך סיום</Label>
                <Input
                  type="date"
                  value={form.endsAt}
                  onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                />
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

      {/* Stats Dialog */}
      <Dialog open={statsId !== null} onOpenChange={open => !open && setStatsId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              סטטיסטיקות קופון
              {statsData && <span className="font-mono text-purple-600 text-sm">({statsData.coupon.code})</span>}
            </DialogTitle>
          </DialogHeader>

          {statsLoading ? (
            <div className="py-8 text-center text-gray-400">טוען...</div>
          ) : statsData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">{statsData.stats.total_redemptions ?? 0}</div>
                    <div className="text-xs text-gray-500">מימושים</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-green-600">{statsData.stats.unique_users ?? 0}</div>
                    <div className="text-xs text-gray-500">משתמשים ייחודיים</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-orange-600">{fmtCents(statsData.stats.total_discount_cents)}</div>
                    <div className="text-xs text-gray-500">סה״כ הנחות</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-purple-600">{fmtCents(statsData.stats.avg_discount_cents)}</div>
                    <div className="text-xs text-gray-500">ממוצע להנחה</div>
                  </CardContent>
                </Card>
              </div>

              {statsData.delivery.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">ביצועי ערוצי חלוקה</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right text-xs">ערוץ</TableHead>
                          <TableHead className="text-right text-xs">נשלח</TableHead>
                          <TableHead className="text-right text-xs">נמסר</TableHead>
                          <TableHead className="text-right text-xs">נפתח</TableHead>
                          <TableHead className="text-right text-xs">נלחץ</TableHead>
                          <TableHead className="text-right text-xs">מומש</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statsData.delivery.map(row => (
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

              {statsData.rules.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">כללי זכאות</div>
                  <div className="flex flex-wrap gap-2">
                    {statsData.rules.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {r.rule_type}{r.rule_value ? `: ${r.rule_value}` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400 space-y-1">
                {statsData.stats.first_redeemed_at && (
                  <div>מימוש ראשון: {fmtDate(statsData.stats.first_redeemed_at)}</div>
                )}
                {statsData.stats.last_redeemed_at && (
                  <div>מימוש אחרון: {fmtDate(statsData.stats.last_redeemed_at)}</div>
                )}
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
