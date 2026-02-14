import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Award,
  Clock,
  Star,
  FileText,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardData {
  contractorId: string;
  trustScores: {
    publicScore: number;
    internalRiskScore: number;
    breakdown: {
      vetting: {
        criminalCheck: boolean;
        biometricVerified: boolean;
        certificationsValid: boolean;
        insuranceValid: boolean;
      };
      reviews: {
        averageRating: number;
        totalReviews: number;
        flaggedReviews: number;
      };
      violations: {
        totalViolations: number;
        criticalViolations: number;
        severeViolations: number;
        moderateViolations: number;
        minorViolations: number;
      };
    };
  };
  earnings: {
    totalNet: number;
    inEscrow: number;
    pendingPayout: number;
    recentTransactions: any[];
  };
  violations: {
    total: number;
    critical: number;
    underReview: number;
  };
  badges: {
    total: number;
    badges: any[];
  };
  reviews: {
    total: number;
    averageRating: number;
    recent: any[];
  };
}

export default function ContractorDashboard() {
  const { user } = useAuth();

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: [`/api/contractor/${user?.uid}/dashboard`],
    enabled: !!user?.uid,
  });

  if (isLoading) {
    return (
      <div className="luxury-bg-mesh min-h-screen">
        <div className="luxury-container py-8 space-y-6">
          <div className="luxury-skeleton h-12 w-64" />
          <div className="luxury-grid-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="luxury-skeleton h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="luxury-bg-mesh min-h-screen">
        <div className="luxury-container py-8">
          <div className="luxury-glass-card luxury-shadow-lg p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>Failed to load dashboard data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { trustScores, earnings, violations, badges, reviews } = dashboardData;

  // Calculate trust score percentage (convert 4.0-5.0 to 0-100%)
  const trustScorePercent = ((trustScores.publicScore - 4.0) / 1.0) * 100;

  return (
    <div className="luxury-bg-mesh min-h-screen">
      <div className="luxury-container py-8 space-y-8">
        {/* Header */}
        <div className="luxury-animate-fade-in flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="luxury-heading-lg">Provider Dashboard</h1>
              <span className="px-2.5 py-1 text-[9px] tracking-[0.15em] uppercase font-semibold bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200/60 rounded-sm">
                Contractor
              </span>
            </div>
            <p className="luxury-text-body mt-2">Track your performance, earnings, and reputation</p>
          </div>
          <div className={`luxury-badge ${trustScores.publicScore >= 4.7 ? 'luxury-badge-gold' : ''} text-lg`}>
            <Star className="h-5 w-5 fill-current" />
            {trustScores.publicScore.toFixed(2)} Trust Score
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="luxury-grid-4">
          <div 
            className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-scale-in luxury-delay-1 p-6"
            data-testid="card-earnings-total"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Earnings</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">₪{earnings.totalNet.toFixed(2)}</div>
            <p className="luxury-text-small mt-1">All-time net earnings</p>
          </div>

          <div 
            className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-scale-in luxury-delay-2 p-6"
            data-testid="card-escrow-pending"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">In Escrow</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">₪{earnings.inEscrow.toFixed(2)}</div>
            <p className="luxury-text-small mt-1">Releases in 72h after completion</p>
          </div>

          <div 
            className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-scale-in luxury-delay-3 p-6"
            data-testid="card-payout-ready"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Ready for Payout</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">₪{earnings.pendingPayout.toFixed(2)}</div>
            <p className="luxury-text-small mt-1">Available for withdrawal</p>
          </div>

          <div 
            className="luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-scale-in luxury-delay-4 p-6"
            data-testid="card-violations"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Violations</h3>
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-pink-500/10">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{violations.total}</div>
            <p className="luxury-text-small mt-1">
              {violations.critical > 0 ? `${violations.critical} critical` : 'No critical issues'}
            </p>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="luxury-animate-slide-up luxury-delay-5">
          <TabsList className="luxury-glass-panel mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="earnings" data-testid="tab-earnings">Earnings</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
            <TabsTrigger value="badges" data-testid="tab-badges">Badges</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Trust Score Breakdown */}
            <div className="luxury-glass-card luxury-shadow-lg" data-testid="card-trust-score-breakdown">
              <div className="p-6 border-b border-purple-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                    <Shield className="h-6 w-6 text-purple-600" />
                  </div>
                  <h2 className="luxury-heading-md">Trust Score Breakdown</h2>
                </div>
                <p className="luxury-text-small">
                  Your trust score is calculated from vetting, reviews, and violation history
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Overall Trust Score</span>
                    <span className="luxury-text-gradient text-lg font-bold">
                      {trustScores.publicScore.toFixed(2)} / 5.0
                    </span>
                  </div>
                  <div className="luxury-glass-minimal p-2 rounded-full">
                    <Progress value={trustScorePercent} className="h-3" />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="luxury-glass-minimal p-5 rounded-xl">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Vetting Status
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Criminal Check</span>
                        <span className={`luxury-badge ${trustScores.breakdown.vetting.criminalCheck ? 'luxury-badge-success' : ''}`}>
                          {trustScores.breakdown.vetting.criminalCheck ? 'Passed' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Biometric Verified</span>
                        <span className={`luxury-badge ${trustScores.breakdown.vetting.biometricVerified ? 'luxury-badge-success' : ''}`}>
                          {trustScores.breakdown.vetting.biometricVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Certifications Valid</span>
                        <span className={`luxury-badge ${trustScores.breakdown.vetting.certificationsValid ? 'luxury-badge-success' : ''}`}>
                          {trustScores.breakdown.vetting.certificationsValid ? 'Valid' : 'Expired'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Insurance Active</span>
                        <span className={`luxury-badge ${trustScores.breakdown.vetting.insuranceValid ? 'luxury-badge-success' : ''}`}>
                          {trustScores.breakdown.vetting.insuranceValid ? 'Active' : 'Expired'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal p-5 rounded-xl">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      Performance Metrics
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Average Rating</span>
                        <span className="font-semibold text-gray-900">
                          {trustScores.breakdown.reviews.averageRating.toFixed(1)} ⭐
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Total Reviews</span>
                        <span className="font-semibold text-gray-900">{trustScores.breakdown.reviews.totalReviews}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Flagged Reviews</span>
                        <span className="font-semibold text-red-600">
                          {trustScores.breakdown.reviews.flaggedReviews}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="luxury-text-small">Total Violations</span>
                        <span className="font-semibold text-red-600">
                          {trustScores.breakdown.violations.totalViolations}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Earnings */}
            <div className="luxury-glass-card luxury-shadow-lg" data-testid="card-recent-earnings">
              <div className="p-6 border-b border-purple-100">
                <h2 className="luxury-heading-md">Recent Earnings</h2>
                <p className="luxury-text-small mt-1">Your latest completed bookings</p>
              </div>
              <div className="p-6">
                {earnings.recentTransactions.length === 0 ? (
                  <p className="luxury-text-small text-center py-8">No recent earnings</p>
                ) : (
                  <div className="space-y-1">
                    {earnings.recentTransactions.slice(0, 5).map((transaction: any, index: number) => (
                      <div
                        key={transaction.earningId}
                        className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-900">{transaction.bookingType}</p>
                            <p className="luxury-text-small">
                              {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="luxury-text-gradient text-xl font-bold">₪{parseFloat(transaction.netEarnings).toFixed(2)}</p>
                            <p className="luxury-text-small capitalize">
                              {transaction.payoutStatus.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-lg" data-testid="card-earnings-history">
              <div className="p-6 border-b border-purple-100">
                <h2 className="luxury-heading-md">Earnings History</h2>
                <p className="luxury-text-small mt-1">Complete transaction history and tax information</p>
              </div>
              <div className="p-6">
                <div className="luxury-glass-minimal p-8 rounded-xl text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                  <p className="luxury-text-body mb-4">
                    View detailed earnings breakdown, tax summaries, and payout history.
                  </p>
                  <button className="luxury-btn-primary">
                    Download Full Report
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-lg" data-testid="card-reviews-received">
              <div className="p-6 border-b border-purple-100">
                <h2 className="luxury-heading-md">Reviews Received</h2>
                <p className="luxury-text-small mt-1">
                  {reviews.total} reviews · {reviews.averageRating.toFixed(1)} average rating
                </p>
              </div>
              <div className="p-6 space-y-4">
                {reviews.recent.length === 0 ? (
                  <div className="luxury-glass-minimal p-8 rounded-xl text-center">
                    <Star className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="luxury-text-body">No reviews yet</p>
                  </div>
                ) : (
                  reviews.recent.map((review: any) => (
                    <div 
                      key={review.reviewId} 
                      className="luxury-glass-minimal luxury-hover-lift p-5 rounded-xl" 
                      data-testid={`review-${review.reviewId}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{review.reviewerName}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.overallRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="luxury-text-small">
                          {format(new Date(review.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {review.reviewText && (
                        <p className="luxury-text-body">{review.reviewText}</p>
                      )}
                      {review.isFlagged && (
                        <div className="luxury-badge mt-3" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                          <AlertTriangle className="h-3 w-3" />
                          Flagged
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="badges" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-lg" data-testid="card-badges-earned">
              <div className="p-6 border-b border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/10 to-amber-500/10">
                    <Award className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="luxury-heading-md">Badges & Certifications ({badges.total})</h2>
                    <p className="luxury-text-small mt-1">Your achievements and certifications</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {badges.badges.length === 0 ? (
                  <div className="luxury-glass-minimal p-8 rounded-xl text-center">
                    <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="luxury-text-body">No badges earned yet</p>
                  </div>
                ) : (
                  <div className="luxury-grid-3">
                    {badges.badges.map((badge: any) => (
                      <div
                        key={badge.badgeId}
                        className="luxury-glass-minimal luxury-hover-lift p-5 rounded-xl flex items-center gap-4"
                        data-testid={`badge-${badge.badgeType}`}
                      >
                        <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10">
                          <Award className="h-8 w-8 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{badge.badgeName}</p>
                          <p className="luxury-text-small">{badge.badgeDescription}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
