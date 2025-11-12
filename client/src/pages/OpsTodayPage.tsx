import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Download, Check, AlertTriangle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { designTokens } from '@/lib/designTokens';

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
    <div className="min-h-screen" style={{ backgroundColor: designTokens.colors.background.primary }}>
      {/* Header */}
      <div className="sticky top-0 z-50 border-b" style={{ 
        backgroundColor: designTokens.colors.background.primary, 
        borderColor: designTokens.colors.border.default 
      }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/m')}
              className="p-2 rounded hover:bg-[#1F1F1F] transition-colors duration-100"
              data-testid="button-back"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" style={{ color: designTokens.colors.text.primary }} />
            </button>
            <h1 className="text-[15px] font-medium" style={{ color: designTokens.colors.text.primary }}>
              Low Stock Monitor
            </h1>
            {filteredItems.length > 0 && (
              <div className="px-2 py-1 rounded text-[12px] font-medium" style={{
                backgroundColor: `${designTokens.colors.accent.warning}15`,
                color: designTokens.colors.accent.warning
              }}>
                {filteredItems.length} items
              </div>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded text-[13px] font-medium border transition-colors duration-100"
            style={{
              backgroundColor: designTokens.colors.background.secondary,
              borderColor: designTokens.colors.border.default,
              color: designTokens.colors.text.primary
            }}
            disabled={filteredItems.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="w-3.5 h-3.5 inline mr-1" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-4 py-3 flex gap-2" style={{ borderColor: designTokens.colors.border.default }}>
        <select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="px-3 py-1.5 rounded text-[13px] border"
          style={{
            backgroundColor: designTokens.colors.background.secondary,
            borderColor: designTokens.colors.border.default,
            color: designTokens.colors.text.primary
          }}
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
          className="px-3 py-1.5 rounded text-[13px] border"
          style={{
            backgroundColor: designTokens.colors.background.secondary,
            borderColor: designTokens.colors.border.default,
            color: designTokens.colors.text.primary
          }}
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
            className="ml-auto px-3 py-1.5 rounded text-[13px] font-medium transition-colors duration-100"
            style={{
              backgroundColor: designTokens.colors.accent.success,
              color: '#0B0B0B'
            }}
            data-testid="button-bulk-add"
          >
            <Check className="w-3.5 h-3.5 inline mr-1" />
            Add +5 to {selectedItems.size} items
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{
            borderColor: designTokens.colors.border.default,
            borderTopColor: 'transparent'
          }}></div>
          <p className="text-[13px]" style={{ color: designTokens.colors.text.secondary }}>Loading...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{
            backgroundColor: `${designTokens.colors.accent.success}15`
          }}>
            <Check className="w-6 h-6" style={{ color: designTokens.colors.accent.success }} />
          </div>
          <h2 className="text-[15px] font-semibold mb-1" style={{ color: designTokens.colors.text.primary }}>
            {lowStockItems.length === 0 ? 'All Stocked' : 'No matches'}
          </h2>
          <p className="text-[13px]" style={{ color: designTokens.colors.text.secondary }}>
            {lowStockItems.length === 0 ? 'No low-stock items across all stations' : 'Try adjusting filters'}
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: designTokens.colors.border.default }}>
          {/* Table Header */}
          <div className="px-4 py-2 flex items-center text-[12px] font-medium sticky top-[57px] z-40" style={{
            backgroundColor: designTokens.colors.background.secondary,
            color: designTokens.colors.text.secondary
          }}>
            <div className="w-8">
              <input
                type="checkbox"
                checked={selectedItems.size === filteredItems.length}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded accent-green-500"
                data-testid="checkbox-select-all"
                aria-label="Select all items"
              />
            </div>
            <div className="flex-1 min-w-[120px]">Station</div>
            <div className="flex-1 min-w-[100px]">Item</div>
            <div className="w-20 text-right">Current</div>
            <div className="w-20 text-right">Min</div>
            <div className="w-16 text-center">Status</div>
            <div className="w-20 text-right">Action</div>
          </div>

          {/* Table Rows */}
          {filteredItems.map((item) => {
            const key = `${item.stationId}-${item.sku}`;
            const isSelected = selectedItems.has(key);
            const isEmpty = item.qty === 0;

            return (
              <div
                key={key}
                className="px-4 py-2 flex items-center text-[13px] hover:bg-[#151515] transition-colors duration-100"
                style={{ backgroundColor: isSelected ? '#1A1A1A' : 'transparent' }}
              >
                <div className="w-8">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(item.stationId, item.sku)}
                    className="w-4 h-4 rounded accent-green-500"
                    data-testid={`checkbox-${item.stationId}-${item.sku}`}
                    aria-label={`Select ${item.itemName}`}
                  />
                </div>
                <div className="flex-1 min-w-[120px] truncate">
                  <button
                    onClick={() => setLocation(`/s/${item.stationId}`)}
                    className="text-left hover:underline"
                    style={{ color: designTokens.colors.text.primary }}
                    data-testid={`link-station-${item.stationId}`}
                  >
                    {item.stationName}
                  </button>
                </div>
                <div className="flex-1 min-w-[100px] truncate flex items-center gap-1" style={{ color: designTokens.colors.text.primary }}>
                  <Package className="w-3 h-3 flex-shrink-0" style={{ color: designTokens.colors.text.secondary }} />
                  {item.itemName}
                </div>
                <div className="w-20 text-right font-medium tabular-nums" style={{
                  color: isEmpty ? designTokens.colors.accent.error : designTokens.colors.text.primary
                }}>
                  {item.qty}
                </div>
                <div className="w-20 text-right tabular-nums" style={{ color: designTokens.colors.text.secondary }}>
                  {item.reorderLevel}
                </div>
                <div className="w-16 flex justify-center">
                  {isEmpty ? (
                    <div className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{
                      backgroundColor: `${designTokens.colors.accent.error}15`,
                      color: designTokens.colors.accent.error
                    }}>
                      EMPTY
                    </div>
                  ) : (
                    <div className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{
                      backgroundColor: `${designTokens.colors.accent.warning}15`,
                      color: designTokens.colors.accent.warning
                    }}>
                      LOW
                    </div>
                  )}
                </div>
                <div className="w-20 flex justify-end">
                  <button
                    onClick={() => quickAddMutation.mutate({ stationId: item.stationId, sku: item.sku })}
                    disabled={quickAddMutation.isPending}
                    className="px-2 py-1 rounded text-[12px] font-medium border transition-colors duration-100 hover:bg-[#252525]"
                    style={{
                      backgroundColor: designTokens.colors.background.secondary,
                      borderColor: designTokens.colors.border.default,
                      color: designTokens.colors.text.primary
                    }}
                    data-testid={`button-add5-${item.stationId}-${item.sku}`}
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
