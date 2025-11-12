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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white" data-testid="text-spare-parts-title">
                {isHebrew ? 'ניהול חלקי חילוף' : 'Spare Parts Management'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {isHebrew ? 'קטלוג חלקי חילוף K9000 ומעקב הזמנות' : 'K9000 spare parts catalog and order tracking'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {summaryData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'סה"כ חלקים' : 'Total Parts'}
                    </p>
                    <p className="text-3xl font-bold text-blue-600" data-testid="text-total-parts">
                      {summaryData.totalParts || 0}
                    </p>
                  </div>
                  <Box className="w-12 h-12 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'במלאי' : 'In Stock'}
                    </p>
                    <p className="text-3xl font-bold text-green-600" data-testid="text-in-stock">
                      {summaryData.inStockCount || 0}
                    </p>
                  </div>
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'מלאי נמוך' : 'Low Stock'}
                    </p>
                    <p className="text-3xl font-bold text-yellow-600" data-testid="text-low-stock-parts">
                      {summaryData.lowStockCount || 0}
                    </p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'הזמנות פתוחות' : 'Open Orders'}
                    </p>
                    <p className="text-3xl font-bold text-purple-600" data-testid="text-open-orders">
                      {summaryData.openOrders || 0}
                    </p>
                  </div>
                  <ShoppingCart className="w-12 h-12 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={selectedTab === 'catalog' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('catalog')}
            data-testid="button-tab-catalog"
          >
            <Package className="w-4 h-4 mr-2" />
            {isHebrew ? 'קטלוג חלקים' : 'Parts Catalog'}
          </Button>
          <Button
            variant={selectedTab === 'orders' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('orders')}
            data-testid="button-tab-orders"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isHebrew ? 'הזמנות' : 'Orders'}
            {summaryData?.openOrders > 0 && (
              <Badge className="ml-2 bg-red-500">{summaryData.openOrders}</Badge>
            )}
          </Button>
        </div>

        {/* Catalog Tab */}
        {selectedTab === 'catalog' && (
          <>
            {/* Filters */}
            <Card className="mb-6 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  {isHebrew ? 'סינון' : 'Filters'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder={isHebrew ? 'חפש חלק...' : 'Search part...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-parts"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status-filter">
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
                    <SelectTrigger data-testid="select-category-filter">
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
              </CardContent>
            </Card>

            {/* Parts List */}
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  {isHebrew ? 'קטלוג חלקי חילוף' : 'Spare Parts Catalog'}
                </CardTitle>
                <CardDescription>
                  {isHebrew ? 'כל חלקי החילוף התואמים למכונות K9000' : 'All compatible K9000 machine spare parts'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {partsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">{isHebrew ? 'טוען חלקים...' : 'Loading parts...'}</p>
                  </div>
                ) : parts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">{isHebrew ? 'לא נמצאו חלקים' : 'No parts found'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parts.map((part) => (
                      <div
                        key={part.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        data-testid={`spare-part-${part.id}`}
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
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleOrderPart(part)}
                            disabled={orderPartMutation.isPending}
                            data-testid={`button-order-${part.id}`}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {isHebrew ? 'הזמן חלק' : 'Order Part'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Orders Tab */}
        {selectedTab === 'orders' && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {isHebrew ? 'הזמנות חלקי חילוף' : 'Spare Parts Orders'}
              </CardTitle>
              <CardDescription>
                {isHebrew ? 'מעקב אחר כל ההזמנות' : 'Track all spare parts orders'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">{isHebrew ? 'טוען הזמנות...' : 'Loading orders...'}</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">{isHebrew ? 'אין הזמנות' : 'No orders found'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      data-testid={`order-${order.id}`}
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
