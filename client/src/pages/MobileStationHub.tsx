import { useState } from 'react';
import { useLocation } from 'wouter';
import { Search, MapPin, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { designTokens } from '@/lib/designTokens';

interface Station {
  id: string;
  serialNumber: string;
  name: string;
  status: string;
  address: {
    line1: string;
    city: string;
    postcode: string;
  };
  lowStockItems?: string[];
}

export default function MobileStationHub() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);

  const { data, isLoading, refetch } = useQuery<{ stations: Station[] }>({
    queryKey: ['/api/admin/stations', statusFilter !== 'all' ? statusFilter : null],
  });

  // Pull to refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touchY = e.touches[0].clientY;
    const pullDistance = touchY - touchStart;
    
    if (pullDistance > 100 && window.scrollY === 0 && !isPullRefreshing) {
      setIsPullRefreshing(true);
      refetch().finally(() => {
        setTimeout(() => setIsPullRefreshing(false), 500);
      });
    }
  };

  const stations = data?.stations || [];
  
  // Client-side filtering
  const filteredStations = stations.filter(station => {
    const matchesSearch = search === '' || 
      station.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      station.name?.toLowerCase().includes(search.toLowerCase()) ||
      station.address.city.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || station.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return designTokens.colors.accent.success;
      case 'installing': return designTokens.colors.accent.info;
      case 'maintenance': return designTokens.colors.accent.warning;
      case 'offline': return designTokens.colors.accent.error;
      default: return designTokens.colors.status.neutral;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div 
      className="min-h-screen pb-20"
      style={{ backgroundColor: designTokens.colors.background.primary }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 border-b" style={{
        backgroundColor: designTokens.colors.background.primary,
        borderColor: designTokens.colors.border.default
      }}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[15px] font-medium" style={{ color: designTokens.colors.text.primary }}>
              Station Hub
            </h1>
            <button
              onClick={() => setLocation('/ops/today')}
              className="px-3 py-1.5 rounded border text-[13px] font-medium transition-colors duration-100"
              style={{
                backgroundColor: designTokens.colors.background.secondary,
                borderColor: designTokens.colors.border.default,
                color: designTokens.colors.text.primary
              }}
              data-testid="button-today"
            >
              Low Stock
            </button>
          </div>
          
          {/* Pull to refresh indicator */}
          {isPullRefreshing && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded flex items-center gap-2 text-[13px]" style={{
              backgroundColor: designTokens.colors.accent.info,
              color: designTokens.colors.background.primary
            }}>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Refreshing...
            </div>
          )}
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ 
              color: designTokens.colors.text.secondary 
            }} />
            <input
              type="search"
              placeholder="Search serial, city, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded border text-[13px] transition-colors duration-100"
              style={{
                backgroundColor: designTokens.colors.background.secondary,
                borderColor: designTokens.colors.border.default,
                color: designTokens.colors.text.primary
              }}
              data-testid="input-search-stations"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 hide-scrollbar">
            {['all', 'active', 'installing', 'maintenance', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className="px-3 py-1.5 rounded whitespace-nowrap text-[12px] font-medium transition-colors duration-100"
                style={{
                  backgroundColor: statusFilter === status 
                    ? designTokens.colors.accent.success 
                    : designTokens.colors.background.secondary,
                  color: statusFilter === status 
                    ? designTokens.colors.background.primary 
                    : designTokens.colors.text.secondary,
                  borderWidth: '1px',
                  borderColor: statusFilter === status 
                    ? designTokens.colors.accent.success 
                    : designTokens.colors.border.default
                }}
                data-testid={`button-filter-${status}`}
              >
                {status === 'all' ? 'All' : getStatusText(status)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Station List */}
      <div className="divide-y" style={{ borderColor: designTokens.colors.border.default }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{
              borderColor: designTokens.colors.border.default,
              borderTopColor: 'transparent'
            }}></div>
            <p className="text-[13px]" style={{ color: designTokens.colors.text.secondary }}>Loading stations...</p>
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Package className="w-12 h-12 mb-3" style={{ color: designTokens.colors.text.tertiary }} />
            <p className="text-[14px] mb-1" style={{ color: designTokens.colors.text.secondary }}>No stations found</p>
            <p className="text-[13px]" style={{ color: designTokens.colors.text.tertiary }}>
              {search ? 'Try a different search' : 'Add your first station'}
            </p>
          </div>
        ) : (
          filteredStations.map((station) => (
            <div
              key={station.id}
              className="px-4 py-3 cursor-pointer hover:bg-[#151515] transition-colors duration-100"
              onClick={() => setLocation(`/s/${station.id}`)}
              data-testid={`card-station-${station.id}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getStatusColor(station.status) }}
                      data-testid={`badge-status-${station.id}`}
                      aria-label={getStatusText(station.status)}
                    />
                    <h3 className="text-[14px] font-medium" style={{ color: designTokens.colors.text.primary }}>
                      {station.serialNumber}
                    </h3>
                    <span className="text-[12px]" style={{ color: designTokens.colors.text.tertiary }}>
                      {getStatusText(station.status)}
                    </span>
                  </div>
                  {station.name && (
                    <p className="text-[13px]" style={{ color: designTokens.colors.text.secondary }}>{station.name}</p>
                  )}
                </div>
                
                {/* Low Stock Badge */}
                {station.lowStockItems && station.lowStockItems.length > 0 && (
                  <div 
                    className="ml-2 px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: `${designTokens.colors.accent.warning}15`,
                      color: designTokens.colors.accent.warning
                    }}
                    data-testid={`badge-low-stock-${station.id}`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Low
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 text-[13px]" style={{ color: designTokens.colors.text.secondary }}>
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p>{station.address.line1}</p>
                  <p>{station.address.city}, {station.address.postcode}</p>
                </div>
              </div>

              {/* Quick Info */}
              {station.lowStockItems && station.lowStockItems.length > 0 && (
                <div className="mt-2 pt-2 border-t" style={{ borderColor: designTokens.colors.border.default }}>
                  <p className="text-[12px]" style={{ color: designTokens.colors.accent.warning }}>
                    {station.lowStockItems.join(', ')} running low
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t px-4 py-3" style={{
        backgroundColor: designTokens.colors.background.primary,
        borderColor: designTokens.colors.border.default
      }}>
        <div className="flex items-center justify-between text-[13px]">
          <span style={{ color: designTokens.colors.text.secondary }}>
            {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => refetch()}
            className="px-2 py-1 transition-colors duration-100 flex items-center gap-1"
            style={{ color: designTokens.colors.accent.info }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
