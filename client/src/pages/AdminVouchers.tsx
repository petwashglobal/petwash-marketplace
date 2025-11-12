import { useState } from 'react';
import { useLanguage } from '@/lib/languageStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Gift, Download, Ban, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trackVoucherIssued } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

export default function AdminVouchers() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [amount, setAmount] = useState('100');
  const [email, setEmail] = useState('');
  const [expirationDays, setExpirationDays] = useState('365');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTest = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/vouchers/generate-test', {
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
        title: '✅ Test Voucher Generated',
        description: `Voucher code: ${data.code.slice(0, 4)}-****-****-${data.code.slice(-4)}`
      });
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: error.message || 'Failed to generate test voucher',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/vouchers/export', {
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Voucher Management</h1>
        <p className="text-muted-foreground">Generate test vouchers and export voucher data</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Generate Test Voucher */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Generate Test Voucher</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (ILS)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                data-testid="input-voucher-amount"
              />
            </div>

            <div>
              <Label htmlFor="email">Recipient Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
                data-testid="input-recipient-email"
              />
            </div>

            <div>
              <Label htmlFor="expiration">Expiration (days)</Label>
              <Input
                id="expiration"
                type="number"
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value)}
                placeholder="365"
                data-testid="input-expiration-days"
              />
            </div>

            <Button 
              onClick={handleGenerateTest} 
              disabled={isGenerating}
              className="w-full"
              data-testid="button-generate-voucher"
            >
              {isGenerating ? 'Generating...' : 'Generate Test Voucher'}
            </Button>

            {generatedCode && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium mb-2">Generated Code:</p>
                <code className="text-lg font-mono break-all">{generatedCode}</code>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this code to test the claim flow
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Quick Actions</h2>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleExport} 
              variant="outline" 
              className="w-full justify-start"
              data-testid="button-export-vouchers"
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Vouchers (CSV)
            </Button>

            <div className="pt-4">
              <h3 className="text-sm font-medium mb-3">Testing Checklist</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">1</Badge>
                  <span>Generate test voucher above</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">2</Badge>
                  <span>Go to /claim-voucher or Dashboard</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">3</Badge>
                  <span>Enter code to claim voucher</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">4</Badge>
                  <span>View in wallet, check GA4 events</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card className="mt-6 p-6">
        <h2 className="text-xl font-semibold mb-4">API Endpoints Reference</h2>
        <div className="grid gap-3 text-sm font-mono">
          <div className="flex justify-between items-center p-2 bg-muted rounded">
            <span>POST /api/admin/vouchers/generate-test</span>
            <Badge>Generate</Badge>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted rounded">
            <span>GET /api/admin/vouchers?search=</span>
            <Badge>Search</Badge>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted rounded">
            <span>GET /api/admin/vouchers/export</span>
            <Badge>Export</Badge>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted rounded">
            <span>POST /api/admin/vouchers/:id/void</span>
            <Badge variant="destructive">Void</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
