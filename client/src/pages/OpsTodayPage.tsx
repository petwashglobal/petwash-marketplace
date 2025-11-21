import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Download, Check, AlertTriangle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface LowStockItem {
  stationId: string;
  stationName: string;
  sku: string;
  itemName: string;
  qty: number;
  reorderLevel: number;
}

export default function OpsTodayPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'empty' | 'low'>('all');

  const { data, isLoading } = useQuery<{ lowStockItems: LowStockItem[] }>({
    queryKey: ['/api/admin/stations/low-stock'],
  });

  const quickAddMutation = useMutation({
    mutationFn: async ({ stationId, sku }: { stationId: string; sku: string }) => {
      return apiRequest('POST', `/api/admin/stations/${stationId}/inventory/adjust`, { sku, delta: 5 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stations/low-stock'] });
      toast({ title: 'Inventory updated' });
    },
    onError: () => {
      toast({ title: 'Update failed', variant: 'destructive' });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (items: { stationId: string; sku: string }[]) => {
      const promises = items.map(item =>
        apiRequest('POST', `/api/admin/stations/${item.stationId}/inventory/adjust`, { sku: item.sku, delta: 5 })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stations/low-stock'] });
      setSelectedItems(new Set());
      toast({ title: `${selectedItems.size} items updated` });
    },
    onError: () => {
      toast({ title: 'Bulk update failed', variant: 'destructive' });
    },
  });

  const lowStockItems = data?.lowStockItems || [];
  
  const uniqueStations = useMemo(() => {
    const stations = new Map<string, string>();
    lowStockItems.forEach(item => stations.set(item.stationId, item.stationName));
    return Array.from(stations.entries()).map(([id, name]) => ({ id, name }));
  }, [lowStockItems]);

  const filteredItems = useMemo(() => {
    return lowStockItems.filter(item => {
      const matchesStation = stationFilter === 'all' || item.stationId === stationFilter;
      const matchesSeverity = 
        severityFilter === 'all' ||
        (severityFilter === 'empty' && item.qty === 0) ||
        (severityFilter === 'low' && item.qty > 0);
      return matchesStation && matchesSeverity;
    });
  }, [lowStockItems, stationFilter, severityFilter]);

  const handleExportCSV = () => {
    const headers = ['Station', 'Item', 'Current Qty', 'Reorder Level', 'Status'];
    const rows = filteredItems.map(item => [
      item.stationName,
      item.itemName,
      item.qty.toString(),
      item.reorderLevel.toString(),
      item.qty === 0 ? 'EMPTY' : 'LOW'
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `low-stock-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported' });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => `${item.stationId}-${item.sku}`)));
    }
  };

  const handleBulkAdd = () => {
    const items = filteredItems
      .filter(item => selectedItems.has(`${item.stationId}-${item.sku}`))
      .map(item => ({ stationId: item.stationId, sku: item.sku }));
    bulkAddMutation.mutate(items);
  };

  const toggleSelection = (stationId: string, sku: string) => {
    const key = `${stationId}-${sku}`;
    const newSelection = new Set(selectedItems);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedItems(newSelection);
  };

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Header */}
      <div className="luxury-glass-card luxury-shadow-lg sticky top-0 z-50 rounded-none md:rounded-t-2xl">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation('/m')}
              className="p-2 rounded-xl luxury-hover-lift transition-all duration-300"
              data-testid="button-back"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-purple-600" />
            </button>
            <div>
              <h1 className="luxury-heading-md">Low Stock Monitor</h1>
              {filteredItems.length > 0 && (
                <span className="luxury-badge luxury-badge-gold">
                  <AlertTriangle className="w-3 h-3" />
                  {filteredItems.length} items
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="luxury-btn-secondary"
            disabled={filteredItems.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="luxury-glass-panel mx-4 mt-4 p-4 luxury-animate-fade-in luxury-delay-1">
        <div className="flex gap-3 flex-wrap">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="luxury-glass-minimal px-4 py-2.5 rounded-xl text-sm font-medium"
            data-testid="select-station-filter"
          >
            <option value="all">All Stations ({uniqueStations.length})</option>
            {uniqueStations.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'empty' | 'low')}
            className="luxury-glass-minimal px-4 py-2.5 rounded-xl text-sm font-medium"
            data-testid="select-severity-filter"
          >
            <option value="all">All Severities</option>
            <option value="empty">Empty Only</option>
            <option value="low">Low Stock Only</option>
          </select>

          {selectedItems.size > 0 && (
            <button
              onClick={handleBulkAdd}
              disabled={bulkAddMutation.isPending}
              className="luxury-btn-primary ml-auto"
              data-testid="button-bulk-add"
            >
              <Check className="w-4 h-4 inline mr-2" />
              Add +5 to {selectedItems.size} items
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="luxury-spinner luxury-animate-scale-in"></div>
          <p className="luxury-text-small mt-4">Loading...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="luxury-glass-card luxury-shadow-lg p-8 text-center luxury-animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-4 mx-auto">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h2 className="luxury-heading-sm mb-2">
              {lowStockItems.length === 0 ? 'All Stocked' : 'No matches'}
            </h2>
            <p className="luxury-text-small">
              {lowStockItems.length === 0 ? 'No low-stock items across all stations' : 'Try adjusting filters'}
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-4 mt-4 mb-8">
          {/* Table Header */}
          <div className="luxury-glass-card luxury-shadow-lg overflow-hidden rounded-2xl luxury-animate-slide-up luxury-delay-2">
            <div className="luxury-glass-panel px-6 py-3 flex items-center text-xs font-semibold text-purple-900 uppercase tracking-wider">
              <div className="w-10">
                <input
                  type="checkbox"
                  checked={selectedItems.size === filteredItems.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded accent-purple-600"
                  data-testid="checkbox-select-all"
                  aria-label="Select all items"
                />
              </div>
              <div className="flex-1 min-w-[120px]">Station</div>
              <div className="flex-1 min-w-[100px]">Item</div>
              <div className="w-24 text-right">Current</div>
              <div className="w-24 text-right">Min</div>
              <div className="w-20 text-center">Status</div>
              <div className="w-24 text-right">Action</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-purple-100">
              {filteredItems.map((item, index) => {
                const key = `${item.stationId}-${item.sku}`;
                const isSelected = selectedItems.has(key);
                const isEmpty = item.qty === 0;

                return (
                  <div
                    key={key}
                    className={`luxury-glass-minimal luxury-hover-lift px-6 py-4 flex items-center text-sm transition-all duration-300 ${
                      isSelected ? 'bg-purple-50 bg-opacity-50' : ''
                    }`}
                    style={{ animationDelay: `${(index + 3) * 0.05}s` }}
                  >
                    <div className="w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(item.stationId, item.sku)}
                        className="w-4 h-4 rounded accent-purple-600"
                        data-testid={`checkbox-${item.stationId}-${item.sku}`}
                        aria-label={`Select ${item.itemName}`}
                      />
                    </div>
                    <div className="flex-1 min-w-[120px] truncate">
                      <button
                        onClick={() => setLocation(`/s/${item.stationId}`)}
                        className="luxury-text-gradient font-semibold hover:underline"
                        data-testid={`link-station-${item.stationId}`}
                      >
                        {item.stationName}
                      </button>
                    </div>
                    <div className="flex-1 min-w-[100px] truncate flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="font-medium">{item.itemName}</span>
                    </div>
                    <div className={`w-24 text-right font-bold tabular-nums ${
                      isEmpty ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {item.qty}
                    </div>
                    <div className="w-24 text-right tabular-nums text-gray-500">
                      {item.reorderLevel}
                    </div>
                    <div className="w-20 flex justify-center">
                      {isEmpty ? (
                        <span className="luxury-badge bg-red-100 text-red-700 border-red-300">
                          EMPTY
                        </span>
                      ) : (
                        <span className="luxury-badge-gold">
                          LOW
                        </span>
                      )}
                    </div>
                    <div className="w-24 flex justify-end">
                      <button
                        onClick={() => quickAddMutation.mutate({ stationId: item.stationId, sku: item.sku })}
                        disabled={quickAddMutation.isPending}
                        className="luxury-btn-secondary text-xs px-3 py-1.5"
                        data-testid={`button-add5-${item.stationId}-${item.sku}`}
                      >
                        +5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
