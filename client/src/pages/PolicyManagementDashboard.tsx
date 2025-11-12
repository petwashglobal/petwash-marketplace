import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    queryFn: () => fetch('/api/enterprise/policy/certifications/expiring?days=30').then(r => r.json())
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
    <div className="min-h-screen bg-white p-6" data-testid="policy-management-dashboard">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-metallic-gold via-metallic-rose to-metallic-platinum bg-clip-text text-transparent mb-2" data-testid="text-page-title">
              Policy Management & Compliance
            </h1>
            <p className="text-muted-foreground">Document versioning, acknowledgments, and compliance tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-metallic-gold text-metallic-gold hover:bg-metallic-gold/10" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-create-policy">
              <Plus className="w-4 h-4 mr-2" />
              New Policy
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="diamond-card border-metallic-gold hover-glow-gold" data-testid="card-total-policies">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Policies</CardTitle>
            <FileText className="w-4 h-4 text-metallic-gold icon-glow-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-metallic-gold" data-testid="text-total-policies">
              {Array.isArray(allPolicies) ? allPolicies.length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activePolicies} active
            </p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-metallic-rose hover-glow-rose" data-testid="card-pending-acks">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Acknowledgments</CardTitle>
            <AlertTriangle className="w-4 h-4 text-metallic-rose icon-glow-rose" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-metallic-rose" data-testid="text-pending-acks">
              {pendingAcknowledgments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Require employee sign-off</p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-metallic-platinum hover-glow-blue" data-testid="card-certifications">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Certifications</CardTitle>
            <Award className="w-4 h-4 text-metallic-platinum icon-glow-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-metallic-platinum" data-testid="text-total-certifications">
              {Array.isArray(certifications) ? certifications.length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Array.isArray(certifications) ? certifications.filter(c => c.status === 'active').length : 0} active
            </p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-red-500 hover-glow-red" data-testid="card-expiring">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
            <Clock className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-expiring-count">
              {expiringCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Next 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search policies by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 luxury-input"
            data-testid="input-search-policies"
          />
        </div>
        <Button variant="outline" className="border-metallic-silver" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
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
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'bg-metallic-gold text-white' : ''}
              data-testid="filter-category-all"
            >
              All ({Array.isArray(allPolicies) ? allPolicies.length : 0})
            </Button>
            {Object.entries(categories).map(([category, count]) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'bg-metallic-gold text-white' : ''}
                data-testid={`filter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category} ({count})
              </Button>
            ))}
          </div>

          {/* Policies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {policiesLoading ? (
              <p className="text-muted-foreground col-span-full text-center py-8">Loading policies...</p>
            ) : filteredPolicies.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8" data-testid="text-no-policies">
                No policies found
              </p>
            ) : (
              filteredPolicies.map((policy) => (
                <Card key={policy.id} className="glass-card border-metallic-gold hover-glow-gold transition-all" data-testid={`card-policy-${policy.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{policy.policyId}</Badge>
                          {policy.isActive ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg text-metallic-gold">{policy.title}</CardTitle>
                        <CardDescription className="mt-1">{policy.category}</CardDescription>
                      </div>
                      <Shield className="w-5 h-5 text-metallic-gold" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Version:</span>
                        <span className="font-medium">{policy.version}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Effective:</span>
                        <span className="font-medium">
                          {new Date(policy.effectiveDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Audience:</span>
                        <Badge variant="secondary" className="text-xs">{policy.targetAudience}</Badge>
                      </div>
                      {policy.requiresAcknowledgment && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            Requires acknowledgment
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" data-testid={`button-view-policy-${policy.id}`}>
                          View
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-edit-policy-${policy.id}`}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
  );
}
