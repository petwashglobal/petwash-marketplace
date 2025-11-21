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
  Wrench,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Truck,
  Calendar,
  DollarSign,
  Box,
} from 'lucide-react';

interface SparePart {
  id: number;
  partNumber: string;
  name: string;
  category: string;
  compatibleModels: string[];
  stockLevel: number;
  minStockLevel: number;
  reorderPoint: number;
  unitCost: number;
  currency: string;
  supplier: string;
  leadTimeDays: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  lastRestocked?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  partId: number;
  partNumber: string;
  partName: string;
  quantity: number;
  status: 'pending' | 'approved' | 'ordered' | 'shipped' | 'delivered' | 'cancelled';
  requestedBy: string;
  requestedAt: string;
  expectedDelivery?: string;
}

export default function SparePartsManagement() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState<'catalog' | 'orders'>('catalog');

  // Fetch spare parts catalog
  const { data: partsData, isLoading: partsLoading } = useQuery<{ parts: SparePart[] }>({
    queryKey: ['/api/k9000/spare-parts', { search: searchQuery, status: statusFilter !== 'all' ? statusFilter : undefined, category: categoryFilter !== 'all' ? categoryFilter : undefined }],
    refetchInterval: 60000,
  });

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: Order[] }>({
    queryKey: ['/api/k9000/spare-parts/orders'],
    refetchInterval: 30000,
    enabled: selectedTab === 'orders',
  });

  // Fetch summary stats
  const { data: summaryData } = useQuery<any>({
    queryKey: ['/api/k9000/spare-parts/summary'],
    refetchInterval: 60000,
  });

  // Order part mutation
  const orderPartMutation = useMutation({
    mutationFn: async (data: { partId: number; quantity: number; stationId?: number }) => {
      const response = await fetch('/api/k9000/spare-parts/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to order spare part');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/k9000/spare-parts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/k9000/spare-parts/orders'] });
      toast({
        title: isHebrew ? 'הזמנה נשלחה' : 'Order Placed',
        description: isHebrew ? 'הזמנת חלק חילוף נשלחה לספק' : 'Spare part order sent to supplier',
      });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'נכשל להזמין חלק חילוף' : 'Failed to order spare part',
        variant: 'destructive',
      });
    },
  });

  const handleOrderPart = (part: SparePart) => {
    const quantity = part.reorderPoint - part.stockLevel;
    orderPartMutation.mutate({
      partId: part.id,
      quantity: Math.max(quantity, 1),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {isHebrew ? 'במלאי' : 'In Stock'}
          </Badge>
        );
      case 'low_stock':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            {isHebrew ? 'מלאי נמוך' : 'Low Stock'}
          </Badge>
        );
      case 'out_of_stock':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            {isHebrew ? 'אזל מהמלאי' : 'Out of Stock'}
          </Badge>
        );
      case 'discontinued':
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-300">
            {isHebrew ? 'מופסק' : 'Discontinued'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">{isHebrew ? 'ממתין' : 'Pending'}</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-700">{isHebrew ? 'אושר' : 'Approved'}</Badge>;
      case 'ordered':
        return <Badge className="bg-purple-100 text-purple-700">{isHebrew ? 'הוזמן' : 'Ordered'}</Badge>;
      case 'shipped':
        return <Badge className="bg-cyan-100 text-cyan-700">{isHebrew ? 'נשלח' : 'Shipped'}</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-700">{isHebrew ? 'נמסר' : 'Delivered'}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700">{isHebrew ? 'בוטל' : 'Cancelled'}</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(isHebrew ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: currency || 'ILS',
    }).format(amount);
  };

  const parts = partsData?.parts || [];
  const orders = ordersData?.orders || [];
  const categories = Array.from(new Set(parts.map(part => part.category)));

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl mb-8 luxury-animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-lg" data-testid="text-spare-parts-title">
                {isHebrew ? 'ניהול חלקי חילוף' : 'Spare Parts Management'}
              </h1>
              <p className="luxury-text-small mt-1">
                {isHebrew ? 'קטלוג חלקי חילוף K9000 ומעקב הזמנות' : 'K9000 spare parts catalog and order tracking'}
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
                      {isHebrew ? 'סה"כ חלקים' : 'Total Parts'}
                    </p>
                    <p className="text-3xl font-bold luxury-text-gradient" data-testid="text-total-parts">
                      {summaryData.totalParts || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <Box className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'במלאי' : 'In Stock'}
                  </p>
                  <p className="text-3xl font-bold text-green-600" data-testid="text-in-stock">
                    {summaryData.inStockCount || 0}
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
                  <p className="text-3xl font-bold text-yellow-600" data-testid="text-low-stock-parts">
                    {summaryData.lowStockCount || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'הזמנות פתוחות' : 'Open Orders'}
                  </p>
                  <p className="text-3xl font-bold luxury-text-gradient" data-testid="text-open-orders">
                    {summaryData.openOrders || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-3 mb-6 luxury-animate-fade-in luxury-delay-2">
          <button
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 luxury-hover-lift flex items-center gap-2 ${
              selectedTab === 'catalog' ? 'luxury-btn-primary' : 'luxury-glass-minimal'
            }`}
            onClick={() => setSelectedTab('catalog')}
            data-testid="button-tab-catalog"
          >
            <Package className="w-4 h-4" />
            {isHebrew ? 'קטלוג חלקים' : 'Parts Catalog'}
          </button>
          <button
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 luxury-hover-lift flex items-center gap-2 ${
              selectedTab === 'orders' ? 'luxury-btn-primary' : 'luxury-glass-minimal'
            }`}
            onClick={() => setSelectedTab('orders')}
            data-testid="button-tab-orders"
          >
            <ShoppingCart className="w-4 h-4" />
            {isHebrew ? 'הזמנות' : 'Orders'}
            {summaryData?.openOrders > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-lg bg-red-500 text-white text-xs font-bold">{summaryData.openOrders}</span>
            )}
          </button>
        </div>

        {/* Catalog Tab */}
        {selectedTab === 'catalog' && (
          <>
            {/* Filters */}
            <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl mb-6 luxury-animate-slide-up luxury-delay-3">
              <h2 className="font-bold mb-4 luxury-text-gradient flex items-center gap-2">
                <Filter className="w-5 h-5" />
                {isHebrew ? 'סינון' : 'Filters'}
              </h2>
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder={isHebrew ? 'חפש חלק...' : 'Search part...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="luxury-glass-minimal"
                    data-testid="input-search-parts"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="luxury-glass-minimal" data-testid="select-status-filter">
                      <SelectValue placeholder={isHebrew ? 'כל הסטטוסים' : 'All Statuses'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isHebrew ? 'כל הסטטוסים' : 'All Statuses'}</SelectItem>
                      <SelectItem value="in_stock">{isHebrew ? 'במלאי' : 'In Stock'}</SelectItem>
                      <SelectItem value="low_stock">{isHebrew ? 'מלאי נמוך' : 'Low Stock'}</SelectItem>
                      <SelectItem value="out_of_stock">{isHebrew ? 'אזל מהמלאי' : 'Out of Stock'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="luxury-glass-minimal" data-testid="select-category-filter">
                      <SelectValue placeholder={isHebrew ? 'כל הקטגוריות' : 'All Categories'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isHebrew ? 'כל הקטגוריות' : 'All Categories'}</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Parts List */}
            <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden luxury-animate-slide-up luxury-delay-4">
              <div className="luxury-glass-panel px-6 py-4">
                <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  {isHebrew ? 'קטלוג חלקי חילוף' : 'Spare Parts Catalog'}
                </h2>
                <p className="luxury-text-small mt-1">
                  {isHebrew ? 'כל חלקי החילוף התואמים למכונות K9000' : 'All compatible K9000 machine spare parts'}
                </p>
              </div>
              <div className="px-6 py-4">
                {partsLoading ? (
                  <div className="text-center py-12">
                    <div className="luxury-spinner luxury-animate-scale-in"></div>
                    <p className="luxury-text-small mt-4">{isHebrew ? 'טוען חלקים...' : 'Loading parts...'}</p>
                  </div>
                ) : parts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                    <p className="luxury-text-small">{isHebrew ? 'לא נמצאו חלקים' : 'No parts found'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parts.map((part, index) => (
                      <div
                        key={part.id}
                        className="luxury-glass-minimal luxury-hover-lift rounded-xl p-4 transition-all duration-300 luxury-animate-slide-up"
                        data-testid={`spare-part-${part.id}`}
                        style={{ animationDelay: `${(index + 5) * 0.05}s` }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <Wrench className="w-5 h-5 text-orange-600" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">{part.name}</h3>
                                <Badge variant="outline">{part.partNumber}</Badge>
                                {getStatusBadge(part.status)}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                {part.category} • {part.supplier}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>{isHebrew ? 'תואם ל' : 'Compatible'}: {part.compatibleModels.join(', ')}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {part.leadTimeDays} {isHebrew ? 'ימים' : 'days lead time'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                              {part.stockLevel}
                            </div>
                            <p className="text-xs text-gray-500">
                              {isHebrew ? 'מינימום' : 'Min'}: {part.minStockLevel}
                            </p>
                            <p className="text-sm font-semibold text-blue-600 mt-1">
                              {formatCurrency(part.unitCost, part.currency)}
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        {(part.status === 'low_stock' || part.status === 'out_of_stock') && (
                          <button
                            className="luxury-btn-primary w-full text-sm"
                            onClick={() => handleOrderPart(part)}
                            disabled={orderPartMutation.isPending}
                            data-testid={`button-order-${part.id}`}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {isHebrew ? 'הזמן חלק' : 'Order Part'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Orders Tab */}
        {selectedTab === 'orders' && (
          <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden luxury-animate-slide-up luxury-delay-3">
            <div className="luxury-glass-panel px-6 py-4">
              <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {isHebrew ? 'הזמנות חלקי חילוף' : 'Spare Parts Orders'}
              </h2>
              <p className="luxury-text-small mt-1">
                {isHebrew ? 'מעקב אחר כל ההזמנות' : 'Track all spare parts orders'}
              </p>
            </div>
            <div className="px-6 py-4">
              {ordersLoading ? (
                <div className="text-center py-12">
                  <div className="luxury-spinner luxury-animate-scale-in"></div>
                  <p className="luxury-text-small mt-4">{isHebrew ? 'טוען הזמנות...' : 'Loading orders...'}</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                  <p className="luxury-text-small">{isHebrew ? 'אין הזמנות' : 'No orders found'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order, index) => (
                    <div
                      key={order.id}
                      className="luxury-glass-minimal luxury-hover-lift rounded-xl p-4 transition-all duration-300 luxury-animate-slide-up"
                      data-testid={`order-${order.id}`}
                      style={{ animationDelay: `${(index + 4) * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {order.orderNumber}
                            </h3>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {order.partName} ({order.partNumber}) • Qty: {order.quantity}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                            <span>{isHebrew ? 'הוזמן על ידי' : 'Requested by'}: {order.requestedBy}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(order.requestedAt)}
                            </span>
                            {order.expectedDelivery && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Truck className="w-3 h-3" />
                                  {isHebrew ? 'צפוי' : 'Expected'}: {formatDate(order.expectedDelivery)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
