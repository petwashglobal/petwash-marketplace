/**
 * UserCoupons — My Coupons Page
 * RTL Hebrew, ILS
 * Shows issued coupons (active + expired), redemption history, and coupon details.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tag,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  ChevronRight,
  Percent,
  ShoppingBag,
  Gift,
  MapPin,
  CalendarDays,
  Info,
  ReceiptText,
} from 'lucide-react';

interface IssuedCoupon {
  issuance_id: number;
  coupon_id: number;
  code: string;
  campaign_name: string;
  description: string | null;
  discount_type: string;
  discount_percent: string | null;
  discount_amount: string | null;
  currency: string;
  scope_type: string;
  scope_value: string | null;
  valid_until: string | null;
  expires_at: string | null;
  min_spend_cents: number | null;
  stackable: boolean;
  redeemed_at: string | null;
  is_active: boolean;
}

interface Redemption {
  id: number;
  coupon_id: number;
  code: string;
  campaign_name: string;
  order_type: string;
  order_id: string | null;
  amount_before_cents: number;
  discount_amount_cents: number;
  amount_after_cents: number;
  currency: string;
  redeemed_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

interface CouponDetails {
  code: string;
  campaignName: string;
  description: string | null;
  discountType: string;
  discountPercent: string | null;
  discountAmount: string | null;
  currency: string;
  minSpendCents: number | null;
  validUntil: string | null;
  scopeType: string;
  stackable: boolean;
  termsHe: string;
}

function discountLabel(c: IssuedCoupon): string {
  if (c.discount_type === 'percent')    return `${c.discount_percent ?? 0}%`;
  if (c.discount_type === 'fixed')      return `₪${c.discount_amount ?? 0}`;
  if (c.discount_type === 'free_wash')  return 'שטיפה חינם';
  if (c.discount_type === 'free_service') return 'שירות חינם';
  if (c.discount_type === 'package_credit') return 'זיכוי חבילה';
  return c.discount_type;
}

function scopeLabel(scopeType: string): string {
  const labels: Record<string, string> = {
    global:               'כל הזמנה',
    kiosk:                'קיוסק שטיפה',
    loyalty_club:         'מועדון נאמנות',
    sitter:               'סיטר',
    walker:               'מטייל',
    trainer:              'מדריך',
    provider_marketplace: 'שוק ספקים',
    booking:              'הזמנות',
    wallet_topup:         'טעינת ארנק',
    first_order:          'הזמנה ראשונה',
    package:              'חבילות',
    city:                 'עיר ספציפית',
    country:              'מדינה ספציפית',
    station:              'תחנה ספציפית',
    franchise:            'זכיינות ספציפית',
  };
  return labels[scopeType] ?? scopeType;
}

function orderTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    kiosk_wash:          'שטיפת קיוסק',
    sitter_booking:      'הזמנת סיטר',
    walker_booking:      'הזמנת מטייל',
    trainer_booking:     'הזמנת מדריך',
    provider_marketplace:'שוק ספקים',
    wallet_topup:        'טעינת ארנק',
    loyalty_reward:      'תגמול נאמנות',
    package_purchase:    'חבילה',
  };
  return labels[t] ?? t;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCents(n: number): string {
  return `₪${(n / 100).toFixed(2)}`;
}

function CouponCard({ coupon, active, onDetails }: { coupon: IssuedCoupon; active: boolean; onDetails: () => void }) {
  const { toast } = useToast();
  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    toast({ title: `קוד ${coupon.code} הועתק` });
  };
  const expiry = coupon.expires_at || coupon.valid_until;

  return (
    <Card className={`relative overflow-hidden transition-all ${active ? 'border-purple-200 dark:border-purple-800 shadow-sm' : 'opacity-60 border-gray-200 dark:border-gray-700'}`}>
      {/* Color stripe */}
      <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${active ? 'bg-purple-500' : 'bg-gray-300'}`} />

      <CardContent className="p-4 pr-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {coupon.discount_type === 'percent' ? (
                <Percent className="w-4 h-4 text-purple-500 flex-shrink-0" />
              ) : coupon.discount_type === 'free_wash' || coupon.discount_type === 'free_service' ? (
                <Gift className="w-4 h-4 text-purple-500 flex-shrink-0" />
              ) : (
                <Tag className="w-4 h-4 text-purple-500 flex-shrink-0" />
              )}
              <span className="font-bold text-lg text-purple-700 dark:text-purple-300">{discountLabel(coupon)}</span>
              {active ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">פעיל</Badge>
              ) : coupon.redeemed_at ? (
                <Badge variant="secondary" className="text-xs">נוצל</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">פג תוקף</Badge>
              )}
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-black mb-0.5">{coupon.campaign_name}</div>
            {coupon.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{coupon.description}</div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                {scopeLabel(coupon.scope_type)}{coupon.scope_value ? ` (${coupon.scope_value})` : ''}
              </div>
              {expiry && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {active ? 'בתוקף עד' : 'פג:'} {fmtDate(expiry)}
                </div>
              )}
              {coupon.min_spend_cents && coupon.min_spend_cents > 0 && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  מינ׳ {fmtCents(coupon.min_spend_cents)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm bg-white dark:bg-white px-2 py-0.5 rounded">{coupon.code}</span>
              {active && (
                <button onClick={copyCode} className="text-gray-400 hover:text-purple-600 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={onDetails}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
            >
              <Info className="w-3 h-3" />
              פרטים ותנאים
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RedemptionRow({ r }: { r: Redemption }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 border-b last:border-0 border-gray-100 dark:border-gray-700 ${r.cancelled_at ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-white dark:bg-white px-1.5 py-0.5 rounded">{r.code}</span>
          <span className="text-sm text-gray-600 dark:text-black">{r.campaign_name}</span>
          {r.cancelled_at && (
            <Badge variant="secondary" className="text-xs">בוטל</Badge>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {orderTypeLabel(r.order_type)} · {fmtDate(r.redeemed_at)}
          {r.cancel_reason && ` · ${r.cancel_reason}`}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-medium text-green-600 dark:text-green-400">-{fmtCents(r.discount_amount_cents)}</div>
        <div className="text-xs text-gray-400">{fmtCents(r.amount_after_cents)} לתשלום</div>
      </div>
    </div>
  );
}

export default function UserCoupons() {
  const { dir } = useLanguage();
  const [detailsCode, setDetailsCode] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: issuedData, isLoading: issuedLoading } = useQuery<{ active: IssuedCoupon[]; expired: IssuedCoupon[] }>({
    queryKey: ['/api/coupons/my-coupons'],
  });

  const { data: redemptionsData, isLoading: redemptionsLoading } = useQuery<{ redemptions: Redemption[] }>({
    queryKey: ['/api/coupons/my-redemptions'],
  });

  const { data: detailsData } = useQuery<CouponDetails>({
    queryKey: ['/api/coupons/details', detailsCode],
    enabled: detailsCode !== null,
  });

  const active  = issuedData?.active  ?? [];
  const expired = issuedData?.expired ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];

  const activeRedemptions   = redemptions.filter(r => !r.cancelled_at);
  const cancelledRedemptions = redemptions.filter(r => r.cancelled_at);

  return (
    <div className="min-h-screen bg-white dark:bg-white p-4" dir={dir}>
      <div className="max-w-xl mx-auto space-y-5">

        <div className="flex items-center gap-3 pt-2">
          <div className="p-2 bg-purple-600 rounded-xl">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-black">הקופונים שלי</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">PetWash™</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-purple-600">{active.length}</div>
              <div className="text-xs text-gray-500">פעילים</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{activeRedemptions.length}</div>
              <div className="text-xs text-gray-500">מומשו</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-green-600">
                {fmtCents(activeRedemptions.reduce((s, r) => s + r.discount_amount_cents, 0))}
              </div>
              <div className="text-xs text-gray-500">נחסך</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active" dir={dir as any}>
          <TabsList className="w-full">
            <TabsTrigger value="active"   className="flex-1">פעילים ({active.length})</TabsTrigger>
            <TabsTrigger value="history"  className="flex-1">היסטוריה ({activeRedemptions.length})</TabsTrigger>
            <TabsTrigger value="expired"  className="flex-1">לא פעיל ({expired.length})</TabsTrigger>
          </TabsList>

          {/* Active coupons */}
          <TabsContent value="active" className="space-y-3 mt-4">
            {issuedLoading ? (
              <div className="py-8 text-center text-gray-400">טוען...</div>
            ) : active.length === 0 ? (
              <div className="py-10 text-center">
                <Tag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <div className="text-gray-500 font-medium">אין קופונים פעילים</div>
                <div className="text-xs text-gray-400 mt-1">קופונים שיונפקו עבורך יופיעו כאן</div>
              </div>
            ) : (
              active.map(c => (
                <CouponCard
                  key={c.issuance_id}
                  coupon={c}
                  active
                  onDetails={() => setDetailsCode(c.code)}
                />
              ))
            )}
          </TabsContent>

          {/* Redemption history */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-blue-500" />
                  היסטוריית מימוש
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {redemptionsLoading ? (
                  <div className="py-4 text-center text-gray-400">טוען...</div>
                ) : activeRedemptions.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-sm">לא מימשת קופונים עדיין</div>
                ) : (
                  activeRedemptions.map(r => <RedemptionRow key={r.id} r={r} />)
                )}

                {cancelledRedemptions.length > 0 && (
                  <>
                    <div className="text-xs text-gray-400 font-medium mt-4 mb-2">בוטלו / שוחזרו</div>
                    {cancelledRedemptions.map(r => <RedemptionRow key={r.id} r={r} />)}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expired / used */}
          <TabsContent value="expired" className="space-y-3 mt-4">
            {issuedLoading ? (
              <div className="py-8 text-center text-gray-400">טוען...</div>
            ) : expired.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">אין קופונים לא פעילים</div>
            ) : (
              expired.map(c => (
                <CouponCard
                  key={c.issuance_id}
                  coupon={c}
                  active={false}
                  onDetails={() => setDetailsCode(c.code)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Coupon details dialog */}
      <Dialog open={detailsCode !== null} onOpenChange={open => !open && setDetailsCode(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-600" />
              פרטי קופון
            </DialogTitle>
          </DialogHeader>

          {!detailsData ? (
            <div className="py-6 text-center text-gray-400">טוען...</div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="font-mono text-lg bg-white dark:bg-white rounded px-3 py-1.5 inline-block mb-1">
                  {detailsData.code}
                </div>
                <div className="font-bold text-gray-900 dark:text-black">{detailsData.campaignName}</div>
                {detailsData.description && (
                  <div className="text-sm text-gray-500 mt-1">{detailsData.description}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-purple-50 dark:bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">הטבה</div>
                  <div className="font-bold text-purple-700 dark:text-purple-300">
                    {detailsData.discountType === 'percent'   ? `${detailsData.discountPercent}%`  :
                     detailsData.discountType === 'fixed'     ? `₪${detailsData.discountAmount}`   :
                     detailsData.discountType === 'free_wash' ? 'שטיפה חינם'                        : 'שירות חינם'}
                  </div>
                </div>
                <div className="bg-white dark:bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">תקף עבור</div>
                  <div className="font-medium text-gray-700 dark:text-black text-xs">{scopeLabel(detailsData.scopeType)}</div>
                </div>
                {detailsData.minSpendCents && detailsData.minSpendCents > 0 && (
                  <div className="bg-white dark:bg-white rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">מינימום רכישה</div>
                    <div className="font-medium">{fmtCents(detailsData.minSpendCents)}</div>
                  </div>
                )}
                {detailsData.validUntil && (
                  <div className="bg-white dark:bg-white rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">תוקף</div>
                    <div className="font-medium text-xs">{fmtDate(detailsData.validUntil)}</div>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">תנאים והגבלות</div>
                <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{detailsData.termsHe}</div>
              </div>

              {!detailsData.stackable && (
                <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3 text-orange-500" />
                  לא ניתן לצבירה עם הטבות אחרות
                </div>
              )}
              {detailsData.stackable && (
                <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  ניתן לשימוש יחד עם הטבות אחרות
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
