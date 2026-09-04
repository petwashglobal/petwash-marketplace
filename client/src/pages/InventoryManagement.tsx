import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { queryClient, apiRequest } from '@/lib/queryClient';
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

interface InventoryItem {
  id: number;
  stationId: number;
  stationCode: string;
  stationName: string;
  city: string;
  itemType: string;
  currentLevel: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  lastRestocked: string;
  status: 'ok' | 'low' | 'critical' | 'empty';
}

/** Raw row from GET /api/inventory/station-supplies (InventoryService.getAllStationSupplies). */
interface StationSupplyRow {
  id: number;
  stationId: number;
  currentLevel: number | null;
  reorderThreshold: number | null;
  lastRefillAt: string | null;
  stationCode: string | null;
  stationName: string | null;
  city: string | null;
  supply: { id: number; sku: string; name: string; category: string; unitType: string; supplier: string } | null;
}

/**
 * Status is derived here rather than read off the row: `station_supplies` stores
 * a level and a reorder threshold, not a status column. Same COALESCE'd
 * threshold the server uses for low-stock and purchase orders.
 */
function deriveStatus(level: number, threshold: number): InventoryItem['status'] {
  if (level <= 0) return 'empty';
  if (level < threshold * 0.5) return 'critical';
  if (level < threshold) return 'low';
  return 'ok';
}

function toInventoryItem(row: StationSupplyRow): InventoryItem {
  const currentLevel = row.currentLevel ?? 0;
  const minThreshold = row.reorderThreshold ?? 10;
  return {
    id: row.id,
    stationId: row.stationId,
    stationCode: row.stationCode ?? '—',
    stationName: row.stationName ?? `Station ${row.stationId}`,
    city: row.city ?? '—',
    itemType: row.supply?.name ?? row.supply?.category ?? '—',
    currentLevel,
    minThreshold,
    // `station_supplies` has no capacity column. Treat "full" as twice the
    // reorder threshold so the progress bar and the top-up amount are at least
    // derived from a real number instead of an invented one.
    maxCapacity: minThreshold * 2,
    unit: row.supply?.unitType ?? '',
    lastRestocked: row.lastRefillAt ?? '',
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

  // CONTRACT FIX (Lane E D14): this page queried `/api/k9000/inventory` and
  // `/api/k9000/inventory/summary`. Neither has ever existed — `/api/k9000`
  // mounts the IoT, supplier and dashboard routers, none of which expose
  // `/inventory` — so BOTH queries 404'd and the whole screen sat on a
  // permanent skeleton loader.
  // The canonical owner of `station_supplies` is InventoryService, mounted at
  // `/api/inventory`. Reading the network-wide list from it (new read-only
  // sibling of the existing per-station route; no new write authority).
  const { data: rawInventoryData, isLoading } = useQuery<{ items: StationSupplyRow[] }>({
    queryKey: ['/api/inventory/station-supplies'],
    refetchInterval: 60000,
  });

  // The summary cards used to be a SECOND request to a second phantom endpoint.
  // They are now derived from the very same rows the table renders, so the
  // headline counts can never disagree with the list beneath them.

  // CONTRACT FIX (Lane E D1): "Request Restock" POSTed to
  // `/api/k9000/restock-request`, which no router serves — every click 404'd
  // and the ops team never received a signal.
  // There is no canonical "ask the supplier for stock" operation reachable from
  // this screen. The nearest one, `POST /api/k9000/orders`
  // (franchise_order_requests), requires a NOT NULL `franchiseeId` plus
  // requester name/email, and its `stationId` points at `pet_wash_stations` —
  // a different table from the `stations` rows behind `station_supplies`. There
  // is no safe mapping from here, and it emails the supplier, so inventing one
  // would be a guess with real-world consequences.
  // What the canonical service DOES own is recording a refill that actually
  // happened: POST /api/inventory/station-supplies/:id/refill, which writes an
  // `inventory_refills` row, raises the level and emits INVENTORY_REFILLED.
  // The button is therefore relabelled to what it really does — see the confirm
  // gate in `handleRecordRefill`. Supplier ordering is flagged as a product gap
  // rather than faked here.
  const recordRefillMutation = useMutation({
    mutationFn: async ({ stationSupplyId, amount }: { stationSupplyId: number; amount: number }) => {
      const response = await apiRequest(
        'POST',
        `/api/inventory/station-supplies/${stationSupplyId}/refill`,
        { amount, notes: 'Recorded from the admin Inventory screen' },
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/station-supplies'] });
      toast({
        title: isHebrew ? 'המילוי נרשם' : 'Refill Recorded',
        description: isHebrew ? 'רמת המלאי עודכנה' : 'Stock level updated',
      });
    },
    onError: (e: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: e?.message ?? (isHebrew ? 'נכשל לרשום מילוי' : 'Failed to record refill'),
        variant: 'destructive',
      });
    },
  });

  const handleRecordRefill = (item: InventoryItem) => {
    const amount = Math.max(item.maxCapacity - item.currentLevel, 1);
    // This WRITES the stock level — it is not a request to somebody else.
    // Make the operator confirm that the refill physically happened, so the
    // button cannot quietly fabricate inventory.
    const question = isHebrew
      ? `לרשום מילוי של ${amount} ${item.unit} עבור ${item.itemType} ב${item.stationName}? רשמו זאת רק אם המילוי בוצע בפועל.`
      : `Record a refill of ${amount} ${item.unit} for ${item.itemType} at ${item.stationName}? Only record this if the refill actually happened.`;
    if (!window.confirm(question)) return;
    recordRefillMutation.mutate({ stationSupplyId: item.id, amount });
  };

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

  const formatDate = (dateString: string): string => {
    // `last_refill_at` is null until a supply has been refilled at least once —
    // say "never" rather than rendering "Invalid Date".
    if (!dateString) return isHebrew ? 'מעולם לא' : 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return isHebrew ? 'מעולם לא' : 'Never';
    return date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const allItems: InventoryItem[] = (rawInventoryData?.items || []).map(toInventoryItem);
  // Derived from the same rows as the table (see the query above).
  const summaryData = {
    totalItems: allItems.length,
    okCount: allItems.filter(i => i.status === 'ok').length,
    lowCount: allItems.filter(i => i.status === 'low').length,
    criticalCount: allItems.filter(i => i.status === 'critical').length,
    emptyCount: allItems.filter(i => i.status === 'empty').length,
  };
  const cities = Array.from(new Set(allItems.map(item => item.city)));
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
        {summaryData && (
          <div className="luxury-grid-4 gap-4 mb-6 luxury-animate-fade-in luxury-delay-1">
            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'סה"כ פריטים' : 'Total Items'}
                  </p>
                  <p className="text-3xl font-bold luxury-text-gradient" data-testid="text-total-items">
                    {summaryData.totalItems || 0}
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
                    {summaryData.okCount || 0}
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
                    {summaryData.lowCount || 0}
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
                    {(summaryData.criticalCount || 0) + (summaryData.emptyCount || 0)}
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
                          <span className="text-sm text-gray-500">/{item.maxCapacity} {item.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="h-3 bg-white dark:bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getProgressColor(item.status)}`}
                          style={{ width: `${(item.currentLevel / item.maxCapacity) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{isHebrew ? 'סף מינימום' : 'Min threshold'}: {item.minThreshold} {item.unit}</span>
                        <span>{Math.round((item.currentLevel / item.maxCapacity) * 100)}%</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    {(item.status === 'low' || item.status === 'critical' || item.status === 'empty') && (
                      <button
                        className="luxury-btn-primary w-full text-sm"
                        onClick={() => handleRecordRefill(item)}
                        disabled={recordRefillMutation.isPending}
                        data-testid={`button-restock-${item.id}`}
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        {isHebrew ? 'רישום מילוי' : 'Record Refill'}
                      </button>
                    )}
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
