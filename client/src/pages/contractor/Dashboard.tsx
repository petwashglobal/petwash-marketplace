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
  Shield
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
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>Failed to load dashboard data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { trustScores, earnings, violations, badges, reviews } = dashboardData;

  // Calculate trust score percentage (convert 4.0-5.0 to 0-100%)
  const trustScorePercent = ((trustScores.publicScore - 4.0) / 1.0) * 100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contractor Dashboard</h1>
          <p className="text-muted-foreground">Track your performance, earnings, and reputation</p>
        </div>
        <Badge variant={trustScores.publicScore >= 4.7 ? 'default' : 'secondary'} className="text-lg px-4 py-2">
          <Star className="h-4 w-4 mr-1 fill-current" />
          {trustScores.publicScore.toFixed(2)} Trust Score
        </Badge>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-earnings-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{earnings.totalNet.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All-time net earnings</p>
          </CardContent>
        </Card>

        <Card data-testid="card-escrow-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Escrow</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{earnings.inEscrow.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Releases in 72h after completion</p>
          </CardContent>
        </Card>

        <Card data-testid="card-payout-ready">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Payout</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{earnings.pendingPayout.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Available for withdrawal</p>
          </CardContent>
        </Card>

        <Card data-testid="card-violations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{violations.total}</div>
            <p className="text-xs text-muted-foreground">
              {violations.critical > 0 ? `${violations.critical} critical` : 'No critical issues'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="earnings" data-testid="tab-earnings">Earnings</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
          <TabsTrigger value="badges" data-testid="tab-badges">Badges</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Trust Score Breakdown */}
          <Card data-testid="card-trust-score-breakdown">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Trust Score Breakdown
              </CardTitle>
              <CardDescription>
                Your trust score is calculated from vetting, reviews, and violation history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Trust Score</span>
                  <span className="text-sm text-muted-foreground">
                    {trustScores.publicScore.toFixed(2)} / 5.0
                  </span>
                </div>
                <Progress value={trustScorePercent} className="h-2" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Vetting Status</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Criminal Check</span>
                      <Badge variant={trustScores.breakdown.vetting.criminalCheck ? 'default' : 'secondary'}>
                        {trustScores.breakdown.vetting.criminalCheck ? 'Passed' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Biometric Verified</span>
                      <Badge variant={trustScores.breakdown.vetting.biometricVerified ? 'default' : 'secondary'}>
                        {trustScores.breakdown.vetting.biometricVerified ? 'Verified' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Certifications Valid</span>
                      <Badge variant={trustScores.breakdown.vetting.certificationsValid ? 'default' : 'secondary'}>
                        {trustScores.breakdown.vetting.certificationsValid ? 'Valid' : 'Expired'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Insurance Active</span>
                      <Badge variant={trustScores.breakdown.vetting.insuranceValid ? 'default' : 'secondary'}>
                        {trustScores.breakdown.vetting.insuranceValid ? 'Active' : 'Expired'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Performance Metrics</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Average Rating</span>
                      <span className="font-medium">
                        {trustScores.breakdown.reviews.averageRating.toFixed(1)} ⭐
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Reviews</span>
                      <span className="font-medium">{trustScores.breakdown.reviews.totalReviews}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Flagged Reviews</span>
                      <span className="font-medium text-destructive">
                        {trustScores.breakdown.reviews.flaggedReviews}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Violations</span>
                      <span className="font-medium text-destructive">
                        {trustScores.breakdown.violations.totalViolations}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Earnings */}
          <Card data-testid="card-recent-earnings">
            <CardHeader>
              <CardTitle>Recent Earnings</CardTitle>
              <CardDescription>Your latest completed bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {earnings.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent earnings</p>
              ) : (
                <div className="space-y-4">
                  {earnings.recentTransactions.slice(0, 5).map((transaction: any) => (
                    <div
                      key={transaction.earningId}
                      className="flex items-center justify-between border-b pb-4 last:border-0"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{transaction.bookingType}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">₪{parseFloat(transaction.netEarnings).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {transaction.payoutStatus.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          <Card data-testid="card-earnings-history">
            <CardHeader>
              <CardTitle>Earnings History</CardTitle>
              <CardDescription>Complete transaction history and tax information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View detailed earnings breakdown, tax summaries, and payout history.
              </p>
              {/* TODO: Add detailed earnings table */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          <Card data-testid="card-reviews-received">
            <CardHeader>
              <CardTitle>Reviews Received</CardTitle>
              <CardDescription>
                {reviews.total} reviews · {reviews.averageRating.toFixed(1)} average rating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet</p>
              ) : (
                reviews.recent.map((review: any) => (
                  <div key={review.reviewId} className="border-b pb-4 last:border-0" data-testid={`review-${review.reviewId}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{review.reviewerName}</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < review.overallRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {review.reviewText && (
                      <p className="text-sm text-muted-foreground">{review.reviewText}</p>
                    )}
                    {review.isFlagged && (
                      <Badge variant="destructive" className="mt-2">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Flagged
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges" className="space-y-6">
          <Card data-testid="card-badges-earned">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Badges & Certifications ({badges.total})
              </CardTitle>
              <CardDescription>Your achievements and certifications</CardDescription>
            </CardHeader>
            <CardContent>
              {badges.badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">No badges earned yet</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {badges.badges.map((badge: any) => (
                    <div
                      key={badge.badgeId}
                      className="flex items-center gap-3 p-4 border rounded-lg"
                      data-testid={`badge-${badge.badgeType}`}
                    >
                      <Award className="h-8 w-8 text-yellow-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{badge.badgeName}</p>
                        <p className="text-xs text-muted-foreground">{badge.badgeDescription}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
