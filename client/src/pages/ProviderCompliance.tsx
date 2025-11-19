import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  ShieldCheck, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

export default function ProviderCompliance() {
  const { toast } = useToast();
  const [providerId, setProviderId] = useState('WALKER-001');
  const [providerType, setProviderType] = useState<'walker' | 'sitter' | 'driver'>('walker');

  // Fetch compliance status
  const { data: compliance, isLoading } = useQuery({
    queryKey: ['/api/israeli-compliance/compliance-status', providerId],
    enabled: !!providerId,
  });

  // Submit tax registration
  const submitTaxMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/israeli-compliance/submit-tax-registration', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Tax registration submitted',
        description: 'Your registration is being verified',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/israeli-compliance/compliance-status'] });
    },
  });

  // Calculate independence score
  const calculateIndependenceMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/israeli-compliance/calculate-independence', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Independence score updated',
        description: 'Your contractor status has been recalculated',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/israeli-compliance/compliance-status'] });
    },
  });

  const handleTestTaxSubmission = () => {
    submitTaxMutation.mutate({
      providerId,
      providerType,
      taxIdType: 'osek_patur',
      taxId: '123456789',
      nationalInsuranceNumber: '987654321',
      isVatRegistered: false,
    });
  };

  const handleTestIndependenceScore = () => {
    calculateIndependenceMutation.mutate({
      providerId,
      providerType,
      metrics: {
        totalClients: 3,
        petwashRevenuePercent: 60,
        hasOwnEquipment: true,
        canRefuseGigs: true,
        setOwnRates: true,
        hasSubstitutes: false,
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      verified: { variant: 'default', icon: CheckCircle2 },
      pending: { variant: 'secondary', icon: Clock },
      rejected: { variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getRiskBadge = (riskLevel: string) => {
    const variants: Record<string, any> = {
      low: 'default',
      medium: 'secondary',
      high: 'destructive',
    };
    
    return (
      <Badge variant={variants[riskLevel] || 'secondary'}>
        {riskLevel} risk
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          🇮🇱 Israeli Contractor Compliance
        </h1>
        <p className="text-muted-foreground">
          Tax verification, commission tracking, and independence scoring for marketplace providers
        </p>
      </div>

      {/* Provider Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Provider Information</CardTitle>
          <CardDescription>Select a provider to view compliance status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="providerId">Provider ID</Label>
              <Input
                id="providerId"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                placeholder="WALKER-001"
                data-testid="input-provider-id"
              />
            </div>
            <div>
              <Label htmlFor="providerType">Provider Type</Label>
              <select
                id="providerType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value as any)}
                data-testid="select-provider-type"
              >
                <option value="walker">Dog Walker</option>
                <option value="sitter">Pet Sitter</option>
                <option value="driver">PetTrek Driver</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleTestTaxSubmission}
              disabled={submitTaxMutation.isPending}
              data-testid="button-test-tax"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Test Tax Registration
            </Button>
            <Button 
              onClick={handleTestIndependenceScore}
              disabled={calculateIndependenceMutation.isPending}
              variant="outline"
              data-testid="button-test-independence"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Test Independence Score
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center py-8">Loading compliance data...</div>
      )}

      {compliance && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tax">Tax Compliance</TabsTrigger>
            <TabsTrigger value="independence">Independence Score</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Tax Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {compliance.compliance.taxCompliance ? (
                    <div className="space-y-2">
                      {getStatusBadge(compliance.compliance.taxCompliance.verificationStatus)}
                      <p className="text-2xl font-bold">
                        {compliance.compliance.taxCompliance.isCompliant ? '✅ Compliant' : '⚠️ Non-Compliant'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tax data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Independence Risk</CardTitle>
                </CardHeader>
                <CardContent>
                  {compliance.compliance.independenceScore ? (
                    <div className="space-y-2">
                      {getRiskBadge(compliance.compliance.independenceScore.riskLevel)}
                      <p className="text-2xl font-bold">
                        {parseFloat(compliance.compliance.independenceScore.employeeRiskScore).toFixed(1)}/100
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No score calculated</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      ₪{compliance.compliance.commissionStats.totalEarnings?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {compliance.compliance.commissionStats.total || 0} transactions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tax Compliance Tab */}
          <TabsContent value="tax">
            <Card>
              <CardHeader>
                <CardTitle>Tax Registration Details</CardTitle>
                <CardDescription>Israeli tax authority compliance</CardDescription>
              </CardHeader>
              <CardContent>
                {compliance.compliance.taxCompliance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Tax ID Type</p>
                        <p className="text-sm text-muted-foreground">
                          {compliance.compliance.taxCompliance.taxIdType === 'osek_patur' 
                            ? 'עוסק פטור (Osek Patur)' 
                            : 'עוסק מורשה (Osek Murshe)'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">VAT Registered</p>
                        <p className="text-sm text-muted-foreground">
                          {compliance.compliance.taxCompliance.isVatRegistered ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Risk Level</p>
                        <p className="text-sm text-muted-foreground">
                          {getRiskBadge(compliance.compliance.taxCompliance.riskLevel)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Status</p>
                        <p className="text-sm text-muted-foreground">
                          {getStatusBadge(compliance.compliance.taxCompliance.verificationStatus)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
                    <p className="text-lg font-medium">No Tax Registration</p>
                    <p className="text-sm text-muted-foreground">
                      Submit tax registration to get verified
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Independence Score Tab */}
          <TabsContent value="independence">
            <Card>
              <CardHeader>
                <CardTitle>Contractor Independence Score</CardTitle>
                <CardDescription>
                  Prevents employee misclassification per Israeli Labor Law
                </CardDescription>
              </CardHeader>
              <CardContent>
                {compliance.compliance.independenceScore ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">
                          Employee Risk: {parseFloat(compliance.compliance.independenceScore.employeeRiskScore).toFixed(1)}/100
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Lower is better (0 = safe contractor, 100 = high employee risk)
                        </p>
                      </div>
                      {getRiskBadge(compliance.compliance.independenceScore.riskLevel)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm font-medium">Total Clients</p>
                        <p className="text-2xl font-bold">
                          {compliance.compliance.independenceScore.totalClients}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">PetWash Revenue %</p>
                        <p className="text-2xl font-bold">
                          {parseFloat(compliance.compliance.independenceScore.petwashRevenuePercent).toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <p className="font-medium">Independence Factors:</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Own Equipment</span>
                          {compliance.compliance.independenceScore.hasOwnEquipment ? '✅' : '❌'}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Can Refuse Gigs</span>
                          {compliance.compliance.independenceScore.canRefuseGigs ? '✅' : '❌'}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Set Own Rates</span>
                          {compliance.compliance.independenceScore.setOwnRates ? '✅' : '❌'}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Has Substitutes</span>
                          {compliance.compliance.independenceScore.hasSubstitutes ? '✅' : '❌'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p>No independence score calculated</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <CardTitle>Commission Summary</CardTitle>
                <CardDescription>15-25% marketplace broker fee</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium">Total Earnings</p>
                      <p className="text-2xl font-bold text-green-600">
                        ₪{compliance.compliance.commissionStats.totalEarnings?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Commissions</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ₪{compliance.compliance.commissionStats.totalCommissions?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Transactions</p>
                      <p className="text-2xl font-bold">
                        {compliance.compliance.commissionStats.total || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Audit Logs</CardTitle>
                <CardDescription>SHA-256 verified compliance history</CardDescription>
              </CardHeader>
              <CardContent>
                {compliance.compliance.recentLogs && compliance.compliance.recentLogs.length > 0 ? (
                  <div className="space-y-2">
                    {compliance.compliance.recentLogs.map((log: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{log.verificationType}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={
                          log.checkStatus === 'passed' ? 'default' : 
                          log.checkStatus === 'warning' ? 'secondary' : 'destructive'
                        }>
                          {log.checkStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No audit logs</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
