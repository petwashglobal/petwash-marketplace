import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { logger } from "@/lib/logger";

export default function TestPurchase() {
  const [loading, setLoading] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('nirhadad1@gmail.com');
  const [customerName, setCustomerName] = useState('Nir Hadad');
  const [phone, setPhone] = useState('+614197773360');
  const [packageId, setPackageId] = useState('1');
  const [isGiftCard, setIsGiftCard] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleTestPurchase = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      logger.debug('Starting test purchase');
      
      const response = await apiRequest('POST', '/api/test-purchase', {
        packageId: parseInt(packageId),
        customerEmail,
        customerName,
        phone,
        isGiftCard
      });
      
      setResult(response);
      
      toast({
        title: "Test Purchase Success",
        description: `Purchase confirmation sent to ${customerEmail}`,
        variant: "default"
      });
      
    } catch (error) {
      logger.error('Test purchase failed', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Purchase System</h1>
          <p className="text-gray-600">Test the Pet Wash purchase flow up to Nayax payment</p>
        </div>

        {/* Test Form */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Test Configuration</CardTitle>
            <CardDescription>
              Configure test purchase details. This will simulate the complete purchase flow
              except for the actual Nayax payment processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Customer Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="name">Customer Name</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+972501234567"
              />
            </div>

            {/* Package Selection */}
            <div>
              <Label htmlFor="package">Wash Package</Label>
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Single Wash - ₪55</SelectItem>
                  <SelectItem value="2">Triple Wash - ₪150</SelectItem>
                  <SelectItem value="3">Five Wash Pack - ₪220</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gift Card Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="giftCard"
                checked={isGiftCard}
                onCheckedChange={(checked) => setIsGiftCard(checked as boolean)}
              />
              <Label htmlFor="giftCard">This is a gift card purchase</Label>
            </div>

            {/* Test Button */}
            <Button 
              onClick={handleTestPurchase} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Processing Test Purchase...' : 'Test Purchase Flow'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Test Purchase Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-700">Transaction Details</h3>
                    <p><strong>Transaction ID:</strong> {result.data.transactionId}</p>
                    <p><strong>Invoice Number:</strong> {result.data.invoiceNumber}</p>
                    <p><strong>Customer:</strong> {result.data.customerName}</p>
                    <p><strong>Email:</strong> {result.data.customerEmail}</p>
                    <p><strong>Phone:</strong> {result.data.customerPhone}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Package Details</h3>
                    <p><strong>Package:</strong> {result.data.package.name}</p>
                    <p><strong>Hebrew Name:</strong> {result.data.package.nameHe}</p>
                    <p><strong>Wash Count:</strong> {result.data.package.washCount}</p>
                    <p><strong>Price:</strong> ₪{result.data.package.price}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Voucher Information</h3>
                  <p><strong>Voucher Code:</strong> {result.data.voucherCode}</p>
                  <p><strong>QR Code Generated:</strong> {result.data.qrCode ? 'Yes' : 'No'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Tax Calculation</h3>
                  <p><strong>Subtotal:</strong> ₪{result.data.taxCalculation.subtotal}</p>
                  <p><strong>VAT ({result.data.taxCalculation.vatRate}):</strong> ₪{result.data.taxCalculation.vatAmount}</p>
                  <p><strong>Processing Fee:</strong> ₪{result.data.taxCalculation.processingFee}</p>
                  <p><strong>Total:</strong> ₪{result.data.taxCalculation.totalAmount}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">System Status</h3>
                  <p><strong>Email Sent:</strong> {result.data.emailSent ? 'Yes' : 'No'}</p>
                  <p><strong>Next Step:</strong> {result.data.nextSteps.nayaxPayment}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800">What happens next:</h3>
                  <ol className="list-decimal list-inside text-blue-700 mt-2 space-y-1">
                    <li>Customer receives purchase confirmation email</li>
                    <li>Customer would be redirected to Nayax payment page</li>
                    <li>After successful payment, Nayax sends webhook to update transaction</li>
                    <li>Customer receives final voucher with QR code</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}