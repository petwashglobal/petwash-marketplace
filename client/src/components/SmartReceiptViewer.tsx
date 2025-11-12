import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Receipt, 
  MapPin, 
  Clock, 
  CreditCard, 
  Gift, 
  Star, 
  QrCode,
  ExternalLink,
  Calendar,
  User,
  Award
} from 'lucide-react';
import { format } from 'date-fns';
import type { SmartWashReceipt } from '@shared/schema';

export function SmartReceiptViewer() {
  const { transactionId } = useParams<{ transactionId: string }>();

  const { data: receipt, isLoading, error } = useQuery<SmartWashReceipt>({
    queryKey: ['/api/receipts', transactionId],
    enabled: !!transactionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Receipt Not Found</h2>
          <p className="text-gray-600">The receipt you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum':
        return <Award className="h-4 w-4" />;
      case 'gold':
        return <Award className="h-4 w-4" />;
      case 'silver':
        return <Star className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const progressPercentage = receipt.nextTierPoints > 0 
    ? Math.min(100, (receipt.currentTierPoints / receipt.nextTierPoints) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Pet Wash™ Receipt</h1>
            </div>
            <p className="text-lg font-mono text-gray-600">#{receipt.transactionId}</p>
          </div>
        </div>

        {/* Receipt Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Transaction Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Date & Time</p>
                <p className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(receipt.washDateTime), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {receipt.locationName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Wash Type</p>
                <p className="font-semibold">{receipt.washType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {receipt.washDuration} minutes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Customer ID</p>
                <p className="font-semibold">{receipt.customerIdMasked}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {receipt.paymentMethod}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="mb-6">
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
        <Card className="mb-6">
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
                {getTierIcon(receipt.currentTier)}
                <span className="ml-1">{receipt.currentTier}</span>
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Receipt QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block">
              <img 
                src={receipt.receiptQrCode} 
                alt="Receipt QR Code" 
                className="w-32 h-32 mx-auto"
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Scan to view this receipt or share with friends
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => window.open(`/rate/${receipt.transactionId}`, '_blank')}
          >
            <Star className="h-4 w-4 mr-2" />
            Rate Your Experience
          </Button>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open(`/?package=${receipt.packageId}`, '_blank')}
          >
            <Gift className="h-4 w-4 mr-2" />
            Book Next Wash
          </Button>

          {receipt.userId && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open(`/?ref=${receipt.userId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Share & Earn Rewards
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500">
          <p className="text-sm">
            Thank you for choosing Pet Wash™ Premium Services
          </p>
          <p className="text-xs mt-2">
            Questions? Contact us at Support@PetWash.co.il
          </p>
        </div>
      </div>
    </div>
  );
}