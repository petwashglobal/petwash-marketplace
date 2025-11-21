import { useState } from 'react';
import { useLocation } from 'wouter';
import { Search, MapPin, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

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
      case 'active': return 'bg-green-500';
      case 'installing': return 'bg-blue-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div 
      className="min-h-screen luxury-bg-mesh pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Fixed Header */}
      <div className="luxury-glass-card luxury-shadow-lg sticky top-0 z-50 rounded-none md:rounded-t-2xl">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="luxury-heading-md">Station Hub</h1>
            <button
              onClick={() => setLocation('/ops/today')}
              className="luxury-btn-secondary text-sm"
              data-testid="button-today"
            >
              Low Stock
            </button>
          </div>
          
          {/* Pull to refresh indicator */}
          {isPullRefreshing && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 luxury-glass-card px-4 py-2 rounded-xl flex items-center gap-2 text-sm luxury-animate-scale-in">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
              <span className="luxury-text-gradient font-semibold">Refreshing...</span>
            </div>
          )}
          
          {/* Search */}
          <div className="relative luxury-animate-fade-in luxury-delay-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
            <input
              type="search"
              placeholder="Search serial, city, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="luxury-glass-minimal w-full pl-11 pr-4 py-3 rounded-xl text-sm"
              data-testid="input-search-stations"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 hide-scrollbar luxury-animate-fade-in luxury-delay-2">
            {['all', 'active', 'installing', 'maintenance', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl whitespace-nowrap text-xs font-semibold transition-all duration-300 luxury-hover-lift ${
                  statusFilter === status 
                    ? 'luxury-btn-primary' 
                    : 'luxury-glass-minimal'
                }`}
                data-testid={`button-filter-${status}`}
              >
                {status === 'all' ? 'All' : getStatusText(status)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Station List */}
      <div className="px-4 mt-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="luxury-spinner luxury-animate-scale-in"></div>
            <p className="luxury-text-small mt-4">Loading stations...</p>
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="luxury-glass-card luxury-shadow-lg p-8 text-center luxury-animate-slide-up">
            <Package className="w-16 h-16 mx-auto mb-4 text-purple-300" />
            <p className="luxury-heading-sm mb-2">No stations found</p>
            <p className="luxury-text-small">
              {search ? 'Try a different search' : 'Add your first station'}
            </p>
          </div>
        ) : (
          filteredStations.map((station, index) => (
            <div
              key={station.id}
              className="luxury-glass-card luxury-shadow-lg luxury-hover-lift p-4 rounded-2xl cursor-pointer transition-all duration-300 luxury-animate-slide-up"
              onClick={() => setLocation(`/s/${station.id}`)}
              data-testid={`card-station-${station.id}`}
              style={{ animationDelay: `${(index + 3) * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className={`w-2.5 h-2.5 rounded-full ${getStatusColor(station.status)} flex-shrink-0 shadow-lg`}
                      data-testid={`badge-status-${station.id}`}
                      aria-label={getStatusText(station.status)}
                    />
                    <h3 className="luxury-heading-sm">{station.serialNumber}</h3>
                    <span className="luxury-badge text-xs">
                      {getStatusText(station.status)}
                    </span>
                  </div>
                  {station.name && (
                    <p className="luxury-text-small ml-3.5">{station.name}</p>
                  )}
                </div>
                
                {/* Low Stock Badge */}
                {station.lowStockItems && station.lowStockItems.length > 0 && (
                  <span className="luxury-badge-gold flex items-center gap-1 text-xs ml-2">
                    <AlertTriangle className="w-3 h-3" />
                    Low
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2 luxury-text-small ml-3.5">
                <MapPin className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p>{station.address.line1}</p>
                  <p>{station.address.city}, {station.address.postcode}</p>
                </div>
              </div>

              {/* Quick Info */}
              {station.lowStockItems && station.lowStockItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-100">
                  <p className="text-xs font-medium text-yellow-700">
                    {station.lowStockItems.join(', ')} running low
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="fixed bottom-0 left-0 right-0 luxury-glass-card luxury-shadow-lg px-4 py-3 rounded-none md:rounded-b-2xl">
        <div className="flex items-center justify-between text-sm">
          <span className="luxury-text-small font-medium">
            {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => refetch()}
            className="luxury-btn-ghost flex items-center gap-2 text-xs"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
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
