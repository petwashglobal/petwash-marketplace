import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Download, 
  RefreshCw, 
  Filter,
  CreditCard,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";

interface NayaxTransaction {
  id: string;
  uid?: string;
  userEmail?: string;
  stationId?: string;
  terminalId?: string;
  type: 'payment' | 'redeem' | 'webhook';
  amount?: number;
  currency?: string;
  voucherId?: string;
  status: 'pending' | 'completed' | 'failed' | 'processing';
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
  rawPayload?: any;
}

export default function NayaxMonitoring() {
  const [selectedTransaction, setSelectedTransaction] = useState<NayaxTransaction | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    station: '',
    user: '',
    type: '',
    status: ''
  });

  const { data: transactions, isLoading, refetch } = useQuery<NayaxTransaction[]>({
    queryKey: ['/api/admin/nayax/transactions', filters],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch Nayax configuration (merchant fee rate, VAT rate)
  const { data: nayaxConfig } = useQuery<{ merchantFeeRate: number; vatRate: number }>({
    queryKey: ['/api/admin/nayax/config'],
  });

  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) return;

    // CSV header with rate badges
    const vatRate = nayaxConfig?.vatRate || 0.18;
    const merchantFeeRate = nayaxConfig?.merchantFeeRate || 0.055;
    const csvTitle = `"Nayax Transactions Export - VAT Rate: ${(vatRate * 100).toFixed(0)}% | Merchant Fee Rate: ${(merchantFeeRate * 100).toFixed(2)}%"\n`;
    
    // Column headers (strict order per compliance requirements)
    const headers = [
      'Date', 
      'Station', 
      'Type', 
      'Status',
      'Gross (ILS)', 
      'VAT Rate Used (%)', 
      'VAT Amount (ILS)', 
      'Net Before Fees (ILS)',
      'Merchant Fee Rate Used (%)',
      'Merchant Fee (ILS)',
      'Net After Fees (ILS)',
      'Payment Method',
      'Voucher ID', 
      'Terminal ID', 
      'UID/Email'
    ];
    
    const rows = transactions.map(t => {
      const tx = t as any;
      
      // Use persisted values from backend (NEVER recalculate)
      const vatRateUsed = tx.vatRateUsed !== undefined ? (tx.vatRateUsed * 100).toFixed(2) : ((vatRate * 100).toFixed(2));
      const merchantFeeRateUsed = tx.merchantFeeRateUsed !== undefined ? (tx.merchantFeeRateUsed * 100).toFixed(2) : ((merchantFeeRate * 100).toFixed(2));
      
      return [
        t.createdAt,
        t.stationId || '-',
        t.type,
        t.status,
        (t.amount || 0).toFixed(2),
        vatRateUsed,
        (tx.vatAmount || 0).toFixed(2),
        (tx.netBeforeFees || 0).toFixed(2),
        merchantFeeRateUsed,
        (tx.merchantFee || 0).toFixed(2),
        (tx.netAfterFees || 0).toFixed(2),
        t.paymentMethod || '-',
        t.voucherId || '-',
        t.terminalId || '-',
        t.userEmail || t.uid || '-'
      ];
    });

    const csv = csvTitle + [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayax-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500 text-white"><RefreshCw className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'payment':
        return <Badge variant="outline" className="border-blue-500 text-blue-700"><CreditCard className="w-3 h-3 mr-1" />Payment</Badge>;
      case 'redeem':
        return <Badge variant="outline" className="border-green-500 text-green-700"><QrCode className="w-3 h-3 mr-1" />Redeem</Badge>;
      case 'webhook':
        return <Badge variant="outline" className="border-purple-500 text-purple-700">Webhook</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Calculate summary stats using backend-persisted values (NO client math)
  const summaryStats = transactions?.reduce((acc, t) => {
    if (t.status === 'completed' && t.amount) {
      const tx = t as any;
      
      // Use ONLY persisted backend-calculated values
      acc.grossRevenue += t.amount || 0;
      acc.vat += tx.vatAmount || 0;
      acc.netBeforeFees += tx.netBeforeFees || 0;
      acc.merchantFees += tx.merchantFee || 0;
      acc.netAfterFees += tx.netAfterFees || 0;
    }
    return acc;
  }, {
    grossRevenue: 0,
    vat: 0,
    netBeforeFees: 0,
    merchantFees: 0,
    netAfterFees: 0
  });

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      {summaryStats && summaryStats.grossRevenue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Gross Revenue</CardDescription>
              <CardTitle className="text-2xl">₪{summaryStats.grossRevenue.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader className="pb-3">
              <CardDescription className="text-amber-800">Nayax Merchant Fees</CardDescription>
              <CardTitle className="text-2xl text-amber-900">₪{summaryStats.merchantFees.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardHeader className="pb-3">
              <CardDescription className="text-emerald-800">Net After Fees</CardDescription>
              <CardTitle className="text-2xl text-emerald-900">₪{summaryStats.netAfterFees.toFixed(2)}</CardTitle>
              <CardDescription className="text-xs text-emerald-700 mt-1">After VAT (18%) & merchant fees</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Nayax Payment Monitoring</span>
          </CardTitle>
          <CardDescription>Monitor transactions, redemptions, and payment terminal activity</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="dateFrom" className="text-xs">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dateTo" className="text-xs">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="station" className="text-xs">Station</Label>
                <Input
                  id="station"
                  placeholder="Station ID"
                  value={filters.station}
                  onChange={(e) => setFilters({ ...filters, station: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="user" className="text-xs">User</Label>
                <Input
                  id="user"
                  placeholder="Email or UID"
                  value={filters.user}
                  onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="type" className="text-xs">Type</Label>
                <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                  <SelectTrigger id="type" className="mt-1">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="redeem">Redeem</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status" className="text-xs">Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger id="status" className="mt-1">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={!transactions || transactions.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <div className="text-sm text-slate-600">
              {transactions?.length || 0} transactions
            </div>
          </div>

          {/* Transaction Table */}
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-slate-600">Loading transactions...</p>
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-xs">
                        {format(new Date(transaction.createdAt), 'MMM dd, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {transaction.stationId || '-'}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm">
                        {transaction.userEmail || transaction.uid?.substring(0, 8) || '-'}
                      </TableCell>
                      <TableCell>{getTypeBadge(transaction.type)}</TableCell>
                      <TableCell className="font-semibold">
                        {transaction.amount ? `₪${transaction.amount}` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {transaction.voucherId?.substring(0, 12) || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {transaction.terminalId?.substring(0, 12) || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm">Try adjusting your filters or check back later</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Drawer */}
      <Sheet open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transaction Details</SheetTitle>
            <SheetDescription>
              {selectedTransaction && format(new Date(selectedTransaction.createdAt), 'PPpp')}
            </SheetDescription>
          </SheetHeader>
          
          {selectedTransaction && (
            <div className="mt-6 space-y-6">
              {/* Status and Type */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedTransaction.status)}
                {getTypeBadge(selectedTransaction.type)}
              </div>

              {/* Transaction Info */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-500">Transaction ID</Label>
                  <p className="font-mono text-sm mt-1 bg-slate-100 p-2 rounded">{selectedTransaction.id}</p>
                </div>

                {selectedTransaction.uid && (
                  <div>
                    <Label className="text-xs text-slate-500">User ID</Label>
                    <p className="font-mono text-sm mt-1">{selectedTransaction.uid}</p>
                  </div>
                )}

                {selectedTransaction.userEmail && (
                  <div>
                    <Label className="text-xs text-slate-500">User Email</Label>
                    <p className="text-sm mt-1">{selectedTransaction.userEmail}</p>
                  </div>
                )}

                {selectedTransaction.stationId && (
                  <div>
                    <Label className="text-xs text-slate-500">Station ID</Label>
                    <p className="font-mono text-sm mt-1">{selectedTransaction.stationId}</p>
                  </div>
                )}

                {selectedTransaction.terminalId && (
                  <div>
                    <Label className="text-xs text-slate-500">Terminal ID</Label>
                    <p className="font-mono text-sm mt-1">{selectedTransaction.terminalId}</p>
                  </div>
                )}

                {selectedTransaction.amount !== undefined && (
                  <div>
                    <Label className="text-xs text-slate-500">Amount</Label>
                    <p className="text-lg font-bold mt-1">
                      ₪{selectedTransaction.amount} {selectedTransaction.currency || 'ILS'}
                    </p>
                  </div>
                )}

                {selectedTransaction.voucherId && (
                  <div>
                    <Label className="text-xs text-slate-500">Voucher ID</Label>
                    <p className="font-mono text-sm mt-1">{selectedTransaction.voucherId}</p>
                  </div>
                )}

                {selectedTransaction.errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <Label className="text-xs text-red-700 font-semibold">Error</Label>
                    <p className="text-sm text-red-800 mt-1">{selectedTransaction.errorMessage}</p>
                    {selectedTransaction.errorCode && (
                      <p className="text-xs text-red-600 mt-1">Code: {selectedTransaction.errorCode}</p>
                    )}
                  </div>
                )}

                {selectedTransaction.rawPayload && (
                  <div>
                    <Label className="text-xs text-slate-500">Raw Payload (Sanitized)</Label>
                    <pre className="text-xs mt-1 bg-slate-100 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedTransaction.rawPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedTransaction.status === 'pending' && (
                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Transaction
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
