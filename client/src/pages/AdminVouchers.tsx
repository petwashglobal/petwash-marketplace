/**
 * 🌟 PET WASH™ ADMIN VOUCHERS - 7-STAR LUXURY DASHBOARD
 * Premium Voucher Management Control Center
 */

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/languageStore';
import { getApiUrl } from "@/lib/apiConfig";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Gift, 
  Download, 
  Ban, 
  Search, 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Calendar,
  Copy,
  Eye,
  Filter,
  Plus,
  Users,
  Activity,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trackVoucherIssued } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG as QRCode } from 'qrcode.react';

interface VoucherStats {
  total: number;
  active: number;
  redeemed: number;
  totalValue: number;
}

interface Voucher {
  id: string;
  code: string;
  amount: number;
  status: 'active' | 'used' | 'expired';
  recipientEmail?: string;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
  usedBy?: string;
}

interface RecentRedemption {
  id: string;
  voucherCode: string;
  amount: number;
  redeemedBy: string;
  redeemedAt: string;
}

export default function AdminVouchers() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Form state
  const [amount, setAmount] = useState('100');
  const [email, setEmail] = useState('');
  const [expirationDays, setExpirationDays] = useState('365');
  const [bulkCount, setBulkCount] = useState('10');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Data state
  const [stats, setStats] = useState<VoucherStats>({
    total: 0,
    active: 0,
    redeemed: 0,
    totalValue: 0
  });
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [recentRedemptions, setRecentRedemptions] = useState<RecentRedemption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadStats();
    loadVouchers();
    loadRecentRedemptions();
  }, []);

  const loadStats = async () => {
    // Mock stats - replace with actual API call
    setStats({
      total: 247,
      active: 189,
      redeemed: 58,
      totalValue: 24750
    });
  };

  const loadVouchers = async () => {
    // Mock vouchers - replace with actual API call
    const mockVouchers: Voucher[] = [
      {
        id: '1',
        code: 'PETWASH-2025-GIFT-ABC123',
        amount: 100,
        status: 'active',
        recipientEmail: 'customer@example.com',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        code: 'PETWASH-2025-GIFT-DEF456',
        amount: 250,
        status: 'used',
        recipientEmail: 'vip@example.com',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        usedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        usedBy: 'John Doe'
      },
      {
        id: '3',
        code: 'PETWASH-2025-GIFT-GHI789',
        amount: 500,
        status: 'active',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    setVouchers(mockVouchers);
  };

  const loadRecentRedemptions = async () => {
    // Mock redemptions - replace with actual API call
    const mockRedemptions: RecentRedemption[] = [
      {
        id: '1',
        voucherCode: 'PETWASH-2025-GIFT-XYZ',
        amount: 150,
        redeemedBy: 'Sarah Cohen',
        redeemedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        voucherCode: 'PETWASH-2025-GIFT-ABC',
        amount: 200,
        redeemedBy: 'David Levy',
        redeemedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
      }
    ];
    setRecentRedemptions(mockRedemptions);
  };

  const handleGenerateTest = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(getApiUrl('/api/admin/vouchers/generate-test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(amount),
          recipientEmail: email || undefined,
          expirationDays: parseInt(expirationDays)
        })
      });

      if (!response.ok) throw new Error('Failed to generate voucher');

      const data = await response.json();
      setGeneratedCode(data.code);
      
      // Track GA4 event
      trackVoucherIssued(
        data.voucherId,
        parseFloat(amount),
        'ILS',
        user?.uid,
        email || undefined
      );
      
      toast({
        title: '✅ Voucher Generated',
        description: `Created successfully: ${data.code.slice(0, 8)}...`
      });

      // Reload data
      loadStats();
      loadVouchers();
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: error.message || 'Failed to generate voucher',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    setIsGenerating(true);
    try {
      toast({
        title: '⏳ Generating Bulk Vouchers',
        description: `Creating ${bulkCount} vouchers...`
      });

      // Mock bulk generation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: '✅ Bulk Generation Complete',
        description: `Successfully created ${bulkCount} vouchers`
      });

      loadStats();
      loadVouchers();
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: 'Failed to generate bulk vouchers',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(getApiUrl('/api/admin/vouchers/export'), {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vouchers-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: '✅ Export Complete',
        description: 'Vouchers exported successfully'
      });
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: error.message || 'Failed to export vouchers',
        variant: 'destructive'
      });
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast({
      title: '✅ Copied',
      description: 'Voucher code copied to clipboard'
    });
  };

  const handleViewDetails = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setIsModalOpen(true);
  };

  const handleDeactivate = async (voucherId: string) => {
    try {
      // Mock API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: '✅ Voucher Deactivated',
        description: 'The voucher has been successfully deactivated'
      });

      loadVouchers();
      loadStats();
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: 'Failed to deactivate voucher',
        variant: 'destructive'
      });
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         v.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="luxury-badge-success">Active</Badge>;
      case 'used':
        return <Badge className="luxury-badge" variant="secondary">Redeemed</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen luxury-bg-mesh py-8 px-4">
      <div className="luxury-container">
        {/* Header */}
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-lg luxury-text-gradient mb-2">
            Voucher Management
          </h1>
          <p className="luxury-text-body">
            Premium gift card control center - Create, manage, and track all vouchers
          </p>
        </div>

        {/* Stats Grid */}
        <div className="luxury-grid-4 mb-8">
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-1">
              {stats.total}
            </div>
            <div className="luxury-text-small">Total Vouchers</div>
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-1">
              {stats.active}
            </div>
            <div className="luxury-text-small">Active Vouchers</div>
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-1">
              {stats.redeemed}
            </div>
            <div className="luxury-text-small">Redeemed</div>
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-1">
              ₪{stats.totalValue.toLocaleString()}
            </div>
            <div className="luxury-text-small">Value Distributed</div>
          </div>
        </div>

        {/* Create Voucher Panel */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 mb-8 luxury-animate-fade-in luxury-delay-5">
          <h2 className="luxury-heading-md mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-purple-600" />
            Create New Voucher
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Single Voucher Generation */}
            <div className="space-y-4">
              <h3 className="luxury-heading-sm mb-4">Single Voucher</h3>
              
              <div>
                <Label htmlFor="amount" className="luxury-heading-sm text-sm mb-2 block">
                  Amount (₪)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="luxury-glass-minimal text-lg font-semibold"
                  data-testid="input-voucher-amount"
                />
              </div>

              <div>
                <Label htmlFor="email" className="luxury-heading-sm text-sm mb-2 block">
                  Recipient Email (optional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="luxury-glass-minimal"
                  data-testid="input-recipient-email"
                />
              </div>

              <div>
                <Label htmlFor="expiration" className="luxury-heading-sm text-sm mb-2 block">
                  Expiration (days)
                </Label>
                <Input
                  id="expiration"
                  type="number"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  placeholder="365"
                  className="luxury-glass-minimal"
                  data-testid="input-expiration-days"
                />
              </div>

              <Button 
                onClick={handleGenerateTest} 
                disabled={isGenerating}
                className="luxury-btn-primary luxury-shadow-xl w-full"
                data-testid="button-generate-voucher"
              >
                {isGenerating ? 'Generating...' : 'Generate Voucher'}
              </Button>

              {generatedCode && (
                <div className="luxury-glass-minimal p-4 rounded-xl">
                  <p className="luxury-heading-sm mb-2">Generated Code:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 luxury-text-gradient font-mono text-sm break-all">
                      {generatedCode}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCode(generatedCode)}
                      className="luxury-btn-ghost"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="luxury-text-small mt-2">
                    Share this code to test the claim flow
                  </p>
                </div>
              )}
            </div>

            {/* Bulk Generation */}
            <div className="space-y-4">
              <h3 className="luxury-heading-sm mb-4">Bulk Generation</h3>
              
              <div>
                <Label htmlFor="bulkCount" className="luxury-heading-sm text-sm mb-2 block">
                  Number of Vouchers
                </Label>
                <Input
                  id="bulkCount"
                  type="number"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                  placeholder="10"
                  className="luxury-glass-minimal text-lg font-semibold"
                  data-testid="input-bulk-count"
                />
              </div>

              <div>
                <Label className="luxury-heading-sm text-sm mb-2 block">
                  Amount per Voucher
                </Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="luxury-glass-minimal"
                />
              </div>

              <Button 
                onClick={handleBulkGenerate} 
                disabled={isGenerating}
                className="luxury-btn-secondary w-full mt-auto"
                data-testid="button-bulk-generate"
              >
                Generate {bulkCount} Vouchers
              </Button>

              <div className="luxury-glass-minimal p-4 rounded-xl">
                <p className="luxury-text-small">
                  <strong>Bulk Generation:</strong> Creates multiple vouchers with the same value and expiration. Useful for promotional campaigns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="luxury-glass-panel luxury-shadow-md p-4 mb-6 luxury-animate-fade-in luxury-delay-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by code or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="luxury-glass-minimal pl-10"
                  data-testid="input-search-vouchers"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? 'luxury-badge' : 'luxury-btn-ghost'}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('active')}
                className={statusFilter === 'active' ? 'luxury-badge-success' : 'luxury-btn-ghost'}
                size="sm"
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'used' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('used')}
                className={statusFilter === 'used' ? 'luxury-badge' : 'luxury-btn-ghost'}
                size="sm"
              >
                Redeemed
              </Button>
              <Button
                variant={statusFilter === 'expired' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('expired')}
                size="sm"
              >
                Expired
              </Button>
            </div>

            <Button
              onClick={handleExport}
              className="luxury-btn-secondary"
              data-testid="button-export-vouchers"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Vouchers Grid */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 mb-8 luxury-animate-fade-in luxury-delay-7">
          <h2 className="luxury-heading-md mb-6">All Vouchers ({filteredVouchers.length})</h2>
          
          <div className="luxury-grid-3">
            {filteredVouchers.map((voucher, index) => (
              <div 
                key={voucher.id}
                className={`luxury-glass-minimal luxury-hover-lift p-5 rounded-xl luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="luxury-text-gradient font-mono text-sm font-semibold">
                        {voucher.code.substring(0, 20)}...
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(voucher.code)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {getStatusBadge(voucher.status)}
                  </div>
                </div>

                <div className="luxury-heading-sm luxury-text-gradient mb-3">
                  ₪{voucher.amount}
                </div>

                {voucher.recipientEmail && (
                  <p className="luxury-text-small mb-2 truncate">
                    📧 {voucher.recipientEmail}
                  </p>
                )}

                <p className="luxury-text-small mb-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {voucher.expiresAt 
                    ? `Expires ${new Date(voucher.expiresAt).toLocaleDateString()}`
                    : 'No expiration'}
                </p>

                {voucher.usedAt && (
                  <p className="luxury-text-small mb-3 flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    Used {new Date(voucher.usedAt).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDetails(voucher)}
                    className="luxury-btn-ghost flex-1"
                    data-testid={`button-view-${voucher.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Details
                  </Button>
                  {voucher.status === 'active' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeactivate(voucher.id)}
                      className="flex-1"
                      data-testid={`button-deactivate-${voucher.id}`}
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredVouchers.length === 0 && (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="luxury-text-body text-gray-500">
                No vouchers found matching your criteria
              </p>
            </div>
          )}
        </div>

        {/* Recent Redemptions */}
        <div className="luxury-glass-panel p-6 luxury-animate-fade-in luxury-delay-8">
          <h2 className="luxury-heading-md mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-600" />
            Recent Redemptions
          </h2>

          <div className="space-y-3">
            {recentRedemptions.map((redemption, index) => (
              <div 
                key={redemption.id}
                className={`luxury-glass-minimal luxury-hover-lift p-4 rounded-xl flex items-center justify-between luxury-animate-fade-in luxury-delay-${index + 1}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <code className="luxury-text-gradient font-mono text-sm font-semibold">
                      {redemption.voucherCode}
                    </code>
                    <p className="luxury-text-small flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" />
                      {redemption.redeemedBy}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="luxury-heading-sm luxury-text-gradient">
                    ₪{redemption.amount}
                  </div>
                  <p className="luxury-text-small flex items-center gap-1 justify-end mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(redemption.redeemedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {recentRedemptions.length === 0 && (
            <div className="text-center py-8">
              <Activity className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="luxury-text-small text-gray-500">
                No recent redemptions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Voucher Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="luxury-glass-card luxury-shadow-xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="luxury-heading-md">Voucher Details</DialogTitle>
          </DialogHeader>

          {selectedVoucher && (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="luxury-glass-minimal p-6 rounded-xl inline-block">
                  <QRCode
                    value={selectedVoucher.code}
                    size={200}
                    level="H"
                    includeMargin
                  />
                </div>
              </div>

              {/* Voucher Info */}
              <div className="luxury-glass-minimal p-5 rounded-xl space-y-3">
                <div>
                  <p className="luxury-text-small mb-1">Voucher Code</p>
                  <code className="luxury-text-gradient font-mono text-base font-semibold">
                    {selectedVoucher.code}
                  </code>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="luxury-text-small mb-1">Amount</p>
                    <p className="luxury-heading-sm luxury-text-gradient">
                      ₪{selectedVoucher.amount}
                    </p>
                  </div>

                  <div>
                    <p className="luxury-text-small mb-1">Status</p>
                    {getStatusBadge(selectedVoucher.status)}
                  </div>
                </div>

                {selectedVoucher.recipientEmail && (
                  <div>
                    <p className="luxury-text-small mb-1">Recipient</p>
                    <p className="luxury-text-body">{selectedVoucher.recipientEmail}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="luxury-text-small mb-1">Created</p>
                    <p className="luxury-text-body">
                      {new Date(selectedVoucher.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {selectedVoucher.expiresAt && (
                    <div>
                      <p className="luxury-text-small mb-1">Expires</p>
                      <p className="luxury-text-body">
                        {new Date(selectedVoucher.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {selectedVoucher.usedAt && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="luxury-text-small mb-1">Redeemed</p>
                    <p className="luxury-text-body">
                      {new Date(selectedVoucher.usedAt).toLocaleDateString()} by {selectedVoucher.usedBy}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => window.print()}
                  className="luxury-btn-primary flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Print Voucher
                </Button>
                <Button
                  onClick={() => handleCopyCode(selectedVoucher.code)}
                  className="luxury-btn-secondary flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Code
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
