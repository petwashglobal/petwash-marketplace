import { useState } from 'react';
import { logger } from "@/lib/logger";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Receipt, 
  QrCode, 
  Star, 
  CreditCard, 
  MapPin, 
  Clock, 
  Calendar,
  User,
  Award,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export function SmartReceiptDemo() {
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateTestReceipt = async () => {
    setLoading(true);
    try {
      const testData = {
        packageId: 1,
        customerEmail: 'demo@petwash.co.il',
        customerName: 'Demo Customer',
        paymentMethod: 'Nayax Card Payment',
        originalAmount: 55.00,
        discountApplied: 5.50,
        finalTotal: 49.50,
        nayaxTransactionId: `NYX_${Date.now()}`,
        locationName: 'Pet Wash™ Tel Aviv Premium Station',
        washDuration: 15
      };

      const response = await apiRequest('POST', '/api/smart-receipts', testData);
      const result = await response.json();
      
      // Get the full receipt details
      const receiptResponse = await apiRequest('GET', `/api/receipts/${result.receipt.transactionId}`);
      const receiptData = await receiptResponse.json();
      
      setReceipt(receiptData);
    } catch (error) {
      logger.error('Error generating test receipt', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const progressPercentage = receipt?.nextTierPoints > 0 
    ? Math.min(100, (receipt.currentTierPoints / receipt.nextTierPoints) * 100)
    : 100;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-600" />
          Smart Receipt System Demo
        </h2>
        <p className="text-gray-600 mb-4">
          Experience the complete Smart Wash Receipt functionality with all features included
        </p>
        <Button 
          onClick={generateTestReceipt}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Generating Receipt...' : 'Generate Test Receipt'}
        </Button>
      </div>

      {receipt && (
        <div className="space-y-6">
          {/* Receipt Header */}
          <Card className="border-2 border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Receipt className="h-6 w-6 text-blue-600" />
                Pet Wash™ Smart Receipt
              </CardTitle>
              <p className="text-lg font-mono text-blue-800">#{receipt.transactionId}</p>
            </CardHeader>
          </Card>

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Transaction Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Date & Time</p>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(receipt.washDateTime).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Location</p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {receipt.locationName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Wash Type</p>
                  <p className="font-semibold">{receipt.washType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Duration</p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {receipt.washDuration} minutes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Customer ID</p>
                  <p className="font-mono">{receipt.customerIdMasked}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Payment Method</p>
                  <p className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {receipt.paymentMethod}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Original Amount:</span>
                <span className="font-semibold">{formatCurrency(receipt.originalAmount)}</span>
              </div>
              
              {parseFloat(receipt.discountApplied) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount Applied:</span>
                  <span className="font-semibold">-{formatCurrency(receipt.discountApplied)}</span>
                </div>
              )}
              
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Final Total:</span>
                  <span className="text-blue-600">{formatCurrency(receipt.finalTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loyalty Program */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Loyalty Program
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Points Earned:</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  +{receipt.loyaltyPointsEarned} points
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Current Tier:</span>
                <Badge className={getTierColor(receipt.currentTier)}>
                  <Award className="h-4 w-4 mr-1" />
                  {receipt.currentTier}
                </Badge>
              </div>

              {receipt.currentTier !== receipt.nextTier && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress to {receipt.nextTier}:</span>
                    <span className="font-semibold">
                      {receipt.currentTierPoints} / {receipt.nextTierPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    {receipt.nextTierPoints - receipt.currentTierPoints} points to {receipt.nextTier}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Receipt QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="bg-white p-4 rounded-lg border-2 border-dashed border-gray-300 inline-block">
                {receipt.receiptQrCode ? (
                  <img 
                    src={receipt.receiptQrCode} 
                    alt="Receipt QR Code" 
                    className="w-32 h-32 mx-auto"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center bg-gray-100 rounded">
                    <QrCode className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Scan to view receipt at: {receipt.receiptUrl}
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => window.open(receipt.receiptUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View Receipt
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => window.open(`/rate/${receipt.transactionId}`, '_blank')}
            >
              <Star className="h-4 w-4" />
              Rate Experience
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => window.open(`/?package=${receipt.packageId}`, '_blank')}
            >
              <Receipt className="h-4 w-4" />
              Book Next Wash
            </Button>
          </div>

          {/* System Features */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800">Smart Receipt Features Included</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Unique TX-XXXXXXX transaction ID
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Complete date/time tracking
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Location and wash details
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Masked customer privacy
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Payment method tracking
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Discount calculations
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Loyalty points earned
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Tier progress tracking
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  QR code generation
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Receipt URL sharing
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Rate experience link
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">✓</Badge>
                  Book next wash button
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}