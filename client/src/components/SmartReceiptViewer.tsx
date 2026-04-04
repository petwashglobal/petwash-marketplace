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
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center luxury-animate-scale-in">
          <div className="luxury-spinner"></div>
          <p className="luxury-text-small mt-4">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center luxury-glass-card luxury-shadow-lg p-12 rounded-2xl luxury-animate-slide-up">
          <Receipt className="h-16 w-16 text-amber-300 mx-auto mb-4" />
          <h2 className="luxury-heading-md mb-2">Receipt Not Found</h2>
          <p className="luxury-text-small">The receipt you're looking for doesn't exist or has been removed.</p>
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
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'gold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver':
        return 'bg-white text-gray-800 border-gray-200';
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
    <div className="min-h-screen luxury-bg-mesh py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 luxury-animate-fade-in">
          <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-3">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <h1 className="luxury-heading-lg">⁦Pet Wash™⁩ Receipt</h1>
            </div>
            <p className="text-lg font-mono luxury-text-gradient">#{receipt.transactionId}</p>
          </div>
        </div>

        {/* Receipt Details */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Transaction Details
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="luxury-text-small">Date & Time</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  {format(new Date(receipt.washDateTime), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="luxury-text-small">Location</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <MapPin className="h-4 w-4 text-amber-500" />
                  {receipt.locationName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="luxury-text-small">Wash Type</p>
                <p className="font-semibold text-gray-900">{receipt.washType}</p>
              </div>
              <div>
                <p className="luxury-text-small">Duration</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <Clock className="h-4 w-4 text-amber-500" />
                  {receipt.washDuration} minutes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="luxury-text-small">Customer ID</p>
                <p className="font-semibold text-gray-900">{receipt.customerIdMasked}</p>
              </div>
              <div>
                <p className="luxury-text-small">Payment Method</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <CreditCard className="h-4 w-4 text-amber-500" />
                  {receipt.paymentMethod}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-2">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Summary
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex justify-between">
              <span className="luxury-text-small">Original Amount:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(receipt.originalAmount)}</span>
            </div>
            
            {parseFloat(receipt.discountApplied) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount Applied:</span>
                <span className="font-semibold">-{formatCurrency(receipt.discountApplied)}</span>
              </div>
            )}
            
            <div className="border-t border-amber-100 pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-gray-900">Final Total:</span>
                <span className="luxury-text-gradient">{formatCurrency(receipt.finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loyalty Program */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-3">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <Star className="h-5 w-5" />
              Loyalty Program
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="luxury-text-small">Points Earned:</span>
              <span className="luxury-badge bg-green-100 text-green-700">
                +{receipt.loyaltyPointsEarned} points
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="luxury-text-small">Current Tier:</span>
              <span className={`luxury-badge ${getTierColor(receipt.currentTier)}`}>
                {getTierIcon(receipt.currentTier)}
                <span className="ml-1">{receipt.currentTier}</span>
              </span>
            </div>

            {receipt.currentTier !== receipt.nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="luxury-text-small">Progress to {receipt.nextTier}:</span>
                  <span className="font-semibold text-gray-900">
                    {receipt.currentTierPoints} / {receipt.nextTierPoints} pts
                  </span>
                </div>
                <div className="w-full luxury-glass-minimal rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <p className="luxury-text-small text-center">
                  {receipt.nextTierPoints - receipt.currentTierPoints} points to {receipt.nextTier}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-4">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Receipt QR Code
            </h2>
          </div>
          <div className="px-6 py-6 text-center">
            <div className="luxury-glass-minimal p-4 rounded-xl inline-block">
              <img 
                src={receipt.receiptQrCode} 
                alt="Receipt QR Code" 
                className="w-32 h-32 mx-auto"
              />
            </div>
            <p className="luxury-text-small mt-2">
              Scan to view this receipt or share with friends
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 luxury-animate-slide-up luxury-delay-5">
          <Button 
            className="luxury-btn-primary w-full"
            onClick={() => window.open(`/rate/${receipt.transactionId}`, '_blank')}
          >
            <Star className="h-4 w-4 mr-2" />
            Rate Your Experience
          </Button>

          <Button 
            className="luxury-btn-secondary w-full"
            onClick={() => window.open(`/?package=${receipt.packageId}`, '_blank')}
          >
            <Gift className="h-4 w-4 mr-2" />
            Book Next Wash
          </Button>

          {receipt.userId && (
            <Button 
              className="luxury-btn-secondary w-full"
              onClick={() => window.open(`/?ref=${receipt.userId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Share & Earn Rewards
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 luxury-text-small luxury-animate-fade-in luxury-delay-6">
          <p>
            Thank you for choosing ⁦Pet Wash™⁩ Premium Services
          </p>
          <p className="mt-2">
            Questions? Contact us at <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient font-semibold">Support@PetWash.co.il</a>
          </p>
        </div>
      </div>
    </div>
  );
}