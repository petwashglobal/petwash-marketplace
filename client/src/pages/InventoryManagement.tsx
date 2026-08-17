import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Droplet,
  Sparkles,
  ShieldAlert,
  FileSpreadsheet,
  Bell,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

/**
 * Row as returned by the canonical inventory owner:
 *   GET /api/inventory/station-supplies  (server/routes/inventory.ts)
 * NOTE: `station_supplies` has no "max capacity" column, so this screen shows
 * the level against the REORDER THRESHOLD — the number the data actually has.
 * The previous generation invented a `maxCapacity` and a `%-full` bar from a
 * `/api/k9000/inventory` route that never existed.
 */
interface StationSupplyRow {
  stationSupplyId: number;
  stationId: number;
  currentLevel: number | null;
  reorderThreshold: number | null;
  lastRefillAt: string | null;
  lastRefillAmount: number | null;
  stationCode: string | null;
  stationName: string | null;
  city: string | null;
  supply: {
    id: number;
    sku: string;
    name: string;
    category: string;
    unitType: string;
    supplier: string | null;
  } | null;
}

type StockStatus = 'ok' | 'low' | 'critical' | 'empty';

/** Shape of GET /api/inventory/purchase-order (InventoryService.generatePurchaseOrder). */
interface PurchaseOrderLine {
  stationId: number;
  stationCode: string | null;
  stationName: string | null;
  sku: string | null;
  name: string | null;
  unitType: string | null;
  currentLevel: number | null;
  reorderThreshold: number | null;
  quantityNeeded: number;
}
interface PurchaseOrder {
  generatedAt: string;
  totalSuppliers: number;
  totalItems: number;
  suppliers: Record<string, PurchaseOrderLine[]>;
}

interface InventoryItem {
  id: number;
  stationId: number;
  stationCode: string;
  stationName: string;
  city: string;
  itemType: string;
  currentLevel: number;
  minThreshold: number;
  unit: string;
  lastRestocked: string | null;
  supplier: string | null;
  status: StockStatus;
}

/**
 * Bar width relative to the reorder threshold (capped at 100%). Purely a visual
 * scale of two real numbers — NOT a "% of capacity", which we do not store.
 */
function levelVsThresholdPct(item: { currentLevel: number; minThreshold: number }): number {
  if (item.minThreshold <= 0) return item.currentLevel > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((item.currentLevel / item.minThreshold) * 100)));
}

/** Derived from real numbers only — nothing invented. */
function deriveStatus(currentLevel: number, threshold: number): StockStatus {
  if (currentLevel <= 0) return 'empty';
  if (threshold > 0 && currentLevel <= threshold / 2) return 'critical';
  if (threshold > 0 && currentLevel < threshold) return 'low';
  return 'ok';
}

function toInventoryItem(row: StationSupplyRow): InventoryItem {
  const currentLevel = row.currentLevel ?? 0;
  const minThreshold = row.reorderThreshold ?? 0;
  return {
    id: row.stationSupplyId,
    stationId: row.stationId,
    stationCode: row.stationCode ?? '—',
    stationName: row.stationName ?? '—',
    city: row.city ?? '',
    itemType: row.supply?.name ?? row.supply?.category ?? '—',
    currentLevel,
    minThreshold,
    unit: row.supply?.unitType ?? '',
    lastRestocked: row.lastRefillAt,
    supplier: row.supply?.supplier ?? null,
    status: deriveStatus(currentLevel, minThreshold),
  };
}

export default function InventoryManagement() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);

  // CONTRACT FIX: this page used to call `/api/k9000/inventory`,
  // `/api/k9000/inventory/summary` and `/api/k9000/restock-request` — three
  // routes that have never existed on any `/api/k9000` mount. The canonical
  // owner of station inventory is `server/routes/inventory.ts` +
  // `server/services/InventoryService.ts`, mounted at `/api/inventory`.
  const { data: stationSupplyData, isLoading } = useQuery<{ items: StationSupplyRow[] }>({
    queryKey: ['/api/inventory/station-supplies'],
    refetchInterval: 60000,
  });

  // Canonical restock mechanism: a purchase order for everything under its
  // reorder threshold, grouped by supplier. There is no per-item
  // "restock request" write anywhere in the platform, so the page no longer
  // pretends to send one.
  const purchaseOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/inventory/purchase-order');
      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      setPurchaseOrder(data);
      toast({
        title: isHebrew ? 'הזמנת רכש נוצרה' : 'Purchase order generated',
        description: isHebrew
          ? `${data.totalItems ?? 0} פריטים מ-${data.totalSuppliers ?? 0} ספקים`
          : `${data.totalItems ?? 0} item(s) across ${data.totalSuppliers ?? 0} supplier(s)`,
      });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'נכשל ליצור הזמנת רכש' : 'Failed to generate purchase order',
        variant: 'destructive',
      });
    },
  });

  const getItemIcon = (itemType: string) => {
    switch (itemType?.toLowerCase()) {
      case 'shampoo':
        return <Droplet className="w-5 h-5 text-[#B8932F]" />;
      case 'conditioner':
        return <Sparkles className="w-5 h-5 text-[#B8932F]" />;
      case 'disinfectant':
        return <ShieldAlert className="w-5 h-5 text-red-600" />;
      case 'fragrance':
        return <Sparkles className="w-5 h-5 text-[#B8932F]" />;
      default:
        return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {isHebrew ? 'תקין' : 'OK'}
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {isHebrew ? 'נמוך' : 'Low'}
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-[#D4AF37] text-black border-[#D4AF37]">
            <TrendingDown className="w-3 h-3 mr-1" />
            {isHebrew ? 'קריטי' : 'Critical'}
          </Badge>
        );
      case 'empty':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            {isHebrew ? 'ריק' : 'Empty'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-500';
      case 'low':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-[#D4AF37]';
      case 'empty':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return isHebrew ? 'לא תועד' : 'never recorded';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return isHebrew ? 'לא תועד' : 'never recorded';
    return date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const allItems = (stationSupplyData?.items ?? []).map(toInventoryItem);
  const cities = Array.from(new Set(allItems.map(item => item.city).filter(Boolean)));

  // Summary is derived from the same real rows the table renders — no second,
  // divergent endpoint, and no fabricated counts.
  const summary = {
    totalItems: allItems.length,
    okCount: allItems.filter(i => i.status === 'ok').length,
    lowCount: allItems.filter(i => i.status === 'low').length,
    criticalCount: allItems.filter(i => i.status === 'critical').length,
    emptyCount: allItems.filter(i => i.status === 'empty').length,
  };
  const items = allItems.filter((item: InventoryItem) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.stationName?.toLowerCase().includes(q) && !item.itemType?.toLowerCase().includes(q) && !item.city?.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (cityFilter !== 'all' && item.city !== cityFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl mb-8 luxury-animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-lg" data-testid="text-inventory-title">
                {isHebrew ? 'ניהול מלאי' : 'Inventory Management'}
              </h1>
              <p className="luxury-text-small mt-1">
                {isHebrew ? 'מעקב אחר מלאי בזמן אמת בכל התחנות' : 'Real-time stock tracking across all stations'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {!isLoading && (
          <div className="luxury-grid-4 gap-4 mb-6 luxury-animate-fade-in luxury-delay-1">
            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'סה"כ פריטים' : 'Total Items'}
                  </p>
                  <p className="text-3xl font-bold luxury-text-gradient" data-testid="text-total-items">
                    {summary.totalItems}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'מלאי תקין' : 'OK Stock'}
                  </p>
                  <p className="text-3xl font-bold text-green-600" data-testid="text-ok-stock">
                    {summary.okCount}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'מלאי נמוך' : 'Low Stock'}
                  </p>
                  <p className="text-3xl font-bold text-yellow-600" data-testid="text-low-stock">
                    {summary.lowCount}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-[#D4AF37] flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'דחוף' : 'Critical'}
                  </p>
                  <p className="text-3xl font-bold text-red-600" data-testid="text-critical-stock">
                    {summary.criticalCount + summary.emptyCount}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-[#B8932F] flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl mb-6 luxury-animate-fade-in luxury-delay-2">
          <h2 className="font-bold mb-4 luxury-text-gradient flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {isHebrew ? 'סינון' : 'Filters'}
          </h2>
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder={isHebrew ? 'חפש תחנה...' : 'Search station...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="luxury-glass-minimal"
                data-testid="input-search-inventory"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="luxury-glass-minimal" data-testid="select-status-filter">
                  <SelectValue placeholder={isHebrew ? 'כל הסטטוסים' : 'All Statuses'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHebrew ? 'כל הסטטוסים' : 'All Statuses'}</SelectItem>
                  <SelectItem value="ok">{isHebrew ? 'תקין' : 'OK'}</SelectItem>
                  <SelectItem value="low">{isHebrew ? 'נמוך' : 'Low'}</SelectItem>
                  <SelectItem value="critical">{isHebrew ? 'קריטי' : 'Critical'}</SelectItem>
                  <SelectItem value="empty">{isHebrew ? 'ריק' : 'Empty'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="luxury-glass-minimal" data-testid="select-city-filter">
                  <SelectValue placeholder={isHebrew ? 'כל הערים' : 'All Cities'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHebrew ? 'כל הערים' : 'All Cities'}</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Restock — canonical purchase order (GET /api/inventory/purchase-order).
            Replaces a per-item "Request Restock" button that POSTed to a route
            that never existed and toasted success on failure. */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl mb-6 luxury-animate-fade-in luxury-delay-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {isHebrew ? 'הזמנת רכש' : 'Purchase Order'}
              </h2>
              <p className="luxury-text-small mt-1">
                {isHebrew
                  ? 'מרכז את כל הפריטים מתחת לסף ההזמנה לפי ספק'
                  : 'Collects every item below its reorder threshold, grouped by supplier'}
              </p>
            </div>
            <Button
              onClick={() => purchaseOrderMutation.mutate()}
              disabled={purchaseOrderMutation.isPending}
              data-testid="button-generate-purchase-order"
            >
              <RefreshCw className={`w-4 h-4 me-2 ${purchaseOrderMutation.isPending ? 'animate-spin' : ''}`} />
              {isHebrew ? 'צור הזמנת רכש' : 'Generate Purchase Order'}
            </Button>
          </div>

          {purchaseOrder && (
            <div className="mt-4 space-y-3" data-testid="purchase-order-result">
              <p className="text-xs text-gray-500">
                {isHebrew ? 'נוצר' : 'Generated'}: {formatDate(purchaseOrder.generatedAt)} •{' '}
                {purchaseOrder.totalItems} {isHebrew ? 'פריטים' : 'items'} •{' '}
                {purchaseOrder.totalSuppliers} {isHebrew ? 'ספקים' : 'suppliers'}
              </p>
              {purchaseOrder.totalItems === 0 ? (
                <p className="luxury-text-small">
                  {isHebrew ? 'אין פריטים מתחת לסף — אין מה להזמין' : 'Nothing below threshold — no order needed'}
                </p>
              ) : (
                Object.entries(purchaseOrder.suppliers).map(([supplierName, lines]) => (
                  <div key={supplierName} className="luxury-glass-minimal rounded-xl p-4">
                    <h3 className="font-semibold mb-2">{supplierName}</h3>
                    <ul className="text-sm space-y-1">
                      {lines.map((line, i) => (
                        <li key={`${line.stationId}-${line.sku}-${i}`} className="flex justify-between gap-4">
                          <span>
                            {line.stationName ?? line.stationCode ?? `#${line.stationId}`} • {line.name ?? line.sku}
                          </span>
                          <span className="font-medium whitespace-nowrap">
                            {line.quantityNeeded} {line.unitType ?? ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Inventory Table */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden luxury-animate-slide-up luxury-delay-3">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {isHebrew ? 'פריטי מלאי' : 'Inventory Items'}
            </h2>
            <p className="luxury-text-small mt-1">
              {isHebrew ? 'עדכון אוטומטי כל דקה' : 'Auto-refreshes every minute'}
            </p>
          </div>
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="luxury-spinner luxury-animate-scale-in"></div>
                <p className="luxury-text-small mt-4">{isHebrew ? 'טוען מלאי...' : 'Loading inventory...'}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
                <p className="luxury-text-small">{isHebrew ? 'לא נמצאו פריטים' : 'No items found'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="luxury-glass-minimal luxury-hover-lift rounded-xl p-4 transition-all duration-300 luxury-animate-slide-up"
                    data-testid={`inventory-item-${item.id}`}
                    style={{ animationDelay: `${(index + 4) * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getItemIcon(item.itemType)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-black">
                              {item.stationName}
                            </h3>
                            <Badge variant="outline">{item.stationCode}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.city} • {item.itemType}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {isHebrew ? 'מילוי אחרון' : 'Last restocked'}: {formatDate(item.lastRestocked)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(item.status)}
                        <div className="mt-2">
                          <span className="text-2xl font-bold text-gray-900 dark:text-black">
                            {item.currentLevel}
                          </span>
                          <span className="text-sm text-gray-500"> {item.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Level vs reorder threshold — station_supplies has no
                        capacity column, so we never claim a "% full". */}
                    <div className="mb-1">
                      <div className="h-3 bg-white dark:bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getProgressColor(item.status)}`}
                          style={{ width: `${levelVsThresholdPct(item)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{isHebrew ? 'סף הזמנה מחדש' : 'Reorder threshold'}: {item.minThreshold} {item.unit}</span>
                        <span>{item.supplier || (isHebrew ? 'ספק לא ידוע' : 'Unknown supplier')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
