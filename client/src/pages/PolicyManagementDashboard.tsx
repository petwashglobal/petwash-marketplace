import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { getApiUrl } from "@/lib/apiConfig";
import { 
  FileText, 
  Plus, 
  Shield, 
  AlertTriangle, 
  CheckCircle2,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  Award,
  Clock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PolicyDocument {
  id: number;
  policyId: string;
  title: string;
  titleHe?: string;
  category: string;
  description?: string;
  documentUrl: string;
  version: string;
  effectiveDate: string;
  expiryDate?: string;
  requiresAcknowledgment: boolean;
  targetAudience: string;
  department?: string;
  isActive: boolean;
  createdBy?: number;
  approvedBy?: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceCertification {
  id: number;
  employeeId: number;
  certificationType: string;
  certificateNumber?: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  certificateUrl?: string;
  status: string;
  reminderSent: boolean;
  createdAt: string;
}

export default function PolicyManagementDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();

  // Fetch policy documents
  const { data: allPolicies, isLoading: policiesLoading, isError: policiesError } = useQuery<PolicyDocument[]>({ 
    queryKey: ['/api/enterprise/policy/documents'] 
  });

  // Fetch compliance certifications
  const { data: certifications, isLoading: certsLoading, isError: certsError } = useQuery<ComplianceCertification[]>({ 
    queryKey: ['/api/enterprise/policy/certifications'] 
  });

  // Fetch expiring certifications
  const { data: expiringCerts } = useQuery<ComplianceCertification[]>({ 
    queryKey: ['/api/enterprise/policy/certifications/expiring'], 
    queryFn: () => fetch(getApiUrl('/api/enterprise/policy/certifications/expiring?days=30')).then(r => r.json())
  });

  // Filter policies by category and search
  const filteredPolicies = Array.isArray(allPolicies) 
    ? allPolicies.filter(policy => {
        const matchesCategory = selectedCategory === 'all' || policy.category === selectedCategory;
        const matchesSearch = !searchQuery || 
          policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          policy.policyId.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
    : [];

  // Get category counts
  const categories = Array.isArray(allPolicies)
    ? allPolicies.reduce((acc: Record<string, number>, policy) => {
        acc[policy.category] = (acc[policy.category] || 0) + 1;
        return acc;
      }, {})
    : {};

  const activePolicies = Array.isArray(allPolicies) ? allPolicies.filter(p => p.isActive).length : 0;
  const pendingAcknowledgments = Array.isArray(allPolicies) ? allPolicies.filter(p => p.requiresAcknowledgment && p.isActive).length : 0;
  const expiringCount = Array.isArray(expiringCerts) ? expiringCerts.length : 0;

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="Policy Management & Compliance"
      subtitle="Document versioning, acknowledgments, and compliance tracking"
    >
      <div className="min-h-screen p-6" data-testid="policy-management-dashboard">
      {/* Header */}
      <div className="mb-8 luxury-animate-fade-in">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <button className="luxury-btn-secondary px-4 py-2" data-testid="button-export">
              <Download className="w-4 h-4 mr-2 inline" />
              Export
            </button>
            <button className="luxury-btn-primary luxury-shadow-xl px-4 py-2" data-testid="button-create-policy">
              <Plus className="w-4 h-4 mr-2 inline" />
              New Policy
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 luxury-animate-slide-up luxury-delay-1">
        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2" data-testid="card-total-policies">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">Total Policies</h3>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-policies">
              {Array.isArray(allPolicies) ? allPolicies.length : 0}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">
              {activePolicies} active
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3" data-testid="card-pending-acks">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">Pending Acknowledgments</h3>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-pending-acks">
              {pendingAcknowledgments}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">Require employee sign-off</p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4" data-testid="card-certifications">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">Certifications</h3>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600" data-testid="text-total-certifications">
              {Array.isArray(certifications) ? certifications.length : 0}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">
              {Array.isArray(certifications) ? certifications.filter(c => c.status === 'active').length : 0} active
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-5" data-testid="card-expiring">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">Expiring Soon</h3>
            <Clock className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600" data-testid="text-expiring-count">
              {expiringCount}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">Next 30 days</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-4 luxury-animate-fade-in luxury-delay-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search policies by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="luxury-glass-minimal pl-10 w-full"
            data-testid="input-search-policies"
          />
        </div>
        <button className="luxury-btn-secondary px-4 py-2" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4 mr-2 inline" />
          Filters
        </button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="policies" className="space-y-6">
        <TabsList className="bg-gradient-to-r from-gray-100 to-gray-50 p-1">
          <TabsTrigger value="policies" className="data-[state=active]:bg-metallic-gold/20 data-[state=active]:text-metallic-gold" data-testid="tab-policies">
            <FileText className="w-4 h-4 mr-2" />
            Policy Documents
          </TabsTrigger>
          <TabsTrigger value="certifications" className="data-[state=active]:bg-metallic-platinum/20 data-[state=active]:text-metallic-platinum" data-testid="tab-certifications">
            <Award className="w-4 h-4 mr-2" />
            Compliance Certifications
          </TabsTrigger>
        </TabsList>

        {/* Policies Tab */}
        <TabsContent value="policies" data-testid="content-policies">
          {policiesError && (
            <Alert variant="destructive" data-testid="alert-policies-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load policy documents. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Category Filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'luxury-badge-primary px-4 py-2' : 'luxury-badge-secondary px-4 py-2'}
              data-testid="filter-category-all"
            >
              All ({Array.isArray(allPolicies) ? allPolicies.length : 0})
            </button>
            {Object.entries(categories).map(([category, count]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'luxury-badge-primary px-4 py-2' : 'luxury-badge-secondary px-4 py-2'}
                data-testid={`filter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category} ({count})
              </button>
            ))}
          </div>

          {/* Policies Grid */}
          <div className="luxury-grid-3">
            {policiesLoading ? (
              <p className="luxury-text-body opacity-70 col-span-full text-center py-8">Loading policies...</p>
            ) : filteredPolicies.length === 0 ? (
              <p className="luxury-text-body opacity-70 col-span-full text-center py-8" data-testid="text-no-policies">
                No policies found
              </p>
            ) : (
              filteredPolicies.map((policy, idx) => (
                <div key={policy.id} className={`luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-${idx % 6 + 7}`} data-testid={`card-policy-${policy.id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="luxury-badge-secondary px-2 py-1 text-xs">{policy.policyId}</span>
                        {policy.isActive ? (
                          <span className="luxury-badge-verified px-2 py-1 text-xs">Active</span>
                        ) : (
                          <span className="luxury-badge-secondary px-2 py-1 text-xs">Inactive</span>
                        )}
                      </div>
                      <h3 className="luxury-heading-sm text-blue-600 mb-1">{policy.title}</h3>
                      <p className="luxury-text-small opacity-70">{policy.category}</p>
                    </div>
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between luxury-text-small">
                      <span className="opacity-70">Version:</span>
                      <span className="font-medium">{policy.version}</span>
                    </div>
                    <div className="flex items-center justify-between luxury-text-small">
                      <span className="opacity-70">Effective:</span>
                      <span className="font-medium">
                        {new Date(policy.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between luxury-text-small">
                      <span className="opacity-70">Audience:</span>
                      <span className="luxury-badge-secondary px-2 py-1 text-xs">{policy.targetAudience}</span>
                    </div>
                    {policy.requiresAcknowledgment && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 luxury-text-small text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          Requires acknowledgment
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button className="luxury-btn-secondary flex-1 py-2" data-testid={`button-view-policy-${policy.id}`}>
                        View
                      </button>
                      <button className="luxury-btn-secondary py-2 px-4" data-testid={`button-edit-policy-${policy.id}`}>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" data-testid="content-certifications">
          {certsError && (
            <Alert variant="destructive" data-testid="alert-certifications-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load certifications. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Expiring Certifications Alert */}
          {expiringCount > 0 && (
            <Alert className="mb-6 border-amber-300 bg-amber-50" data-testid="alert-expiring-certs">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <span className="font-semibold">{expiringCount} certification(s)</span> expiring in the next 30 days. Review and renew to maintain compliance.
              </AlertDescription>
            </Alert>
          )}

          {/* Certifications List */}
          <div className="space-y-4">
            {certsLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading certifications...</p>
            ) : !Array.isArray(certifications) || certifications.length === 0 ? (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-certifications">
                No certifications found
              </p>
            ) : (
              certifications.map((cert) => (
                <Card key={cert.id} className="glass-card hover-glow-blue" data-testid={`card-cert-${cert.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Award className="w-5 h-5 text-metallic-platinum" />
                          <div>
                            <h3 className="font-semibold text-lg text-metallic-platinum">
                              {cert.certificationType.replace(/_/g, ' ').toUpperCase()}
                            </h3>
                            <p className="text-sm text-muted-foreground">Employee ID: {cert.employeeId}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-1">Issued By</span>
                            <span className="font-medium">{cert.issuedBy}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Issued Date</span>
                            <span className="font-medium">{new Date(cert.issuedDate).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Expiry Date</span>
                            <span className={`font-medium ${new Date(cert.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-red-600' : ''}`}>
                              {new Date(cert.expiryDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Status</span>
                            <Badge className={cert.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700'}>
                              {cert.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid={`button-view-cert-${cert.id}`}>
                          View
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-renew-cert-${cert.id}`}>
                          Renew
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </LuxuryPageWrapper>
  );
}
