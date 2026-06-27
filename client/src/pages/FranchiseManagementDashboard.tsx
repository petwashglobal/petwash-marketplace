import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { 
  Building2, 
  Plus, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp,
  Search,
  Filter,
  MapPin,
  Users,
  Calendar,
  CreditCard,
  Clock,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Franchisee {
  id: number;
  franchiseeId: string;
  companyName: string;
  legalName?: string;
  country?: string;
  primaryContact: string;
  email: string;
  phone?: string;
  contractStartDate: string;
  contractEndDate?: string;
  franchiseFee?: string;
  royaltyPercent?: string;
  numberOfStations?: number;
  monthlyRevenue?: string;
  totalRevenue?: string;
  status?: string;
  performanceRating?: string;
}

interface RoyaltyPayment {
  id: number;
  franchiseeId: number;
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  royaltyPercent: string;
  royaltyAmount: string;
  currency?: string;
  paymentStatus?: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
}

const EMPTY_FRANCHISEE_FORM = {
  franchiseeId: "",
  companyName: "",
  legalName: "",
  country: "IL",
  primaryContact: "",
  email: "",
  phone: "",
  contractStartDate: "",
};

export default function FranchiseManagementDashboard() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FRANCHISEE_FORM });
  const { toast } = useToast();

  // Fetch franchisees
  const { data: allFranchisees, isLoading: franchiseesLoading, isError: franchiseesError } = useQuery<Franchisee[]>({ 
    queryKey: ['/api/enterprise/franchise/franchisees'] 
  });

  // Fetch royalty payments
  const { data: royaltyPayments, isLoading: paymentsLoading, isError: paymentsError } = useQuery<RoyaltyPayment[]>({ 
    queryKey: ['/api/enterprise/franchise/royalty-payments'] 
  });

  // Fetch overdue payments
  const { data: overduePayments } = useQuery<RoyaltyPayment[]>({ 
    queryKey: ['/api/enterprise/franchise/royalty-payments/overdue'] 
  });

  // Filter franchisees
  const filteredFranchisees = Array.isArray(allFranchisees)
    ? allFranchisees.filter(franchisee => {
        const matchesCountry = selectedCountry === 'all' || franchisee.country === selectedCountry;
        const matchesSearch = !searchQuery || 
          franchisee.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          franchisee.franchiseeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          franchisee.email.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCountry && matchesSearch;
      })
    : [];

  // Get country counts
  const countries = Array.isArray(allFranchisees)
    ? allFranchisees.reduce((acc: Record<string, number>, franchisee) => {
        const country = franchisee.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {})
    : {};

  const activeFranchisees = Array.isArray(allFranchisees) ? allFranchisees.filter(f => f.status === 'active').length : 0;
  const totalStations = Array.isArray(allFranchisees) ? allFranchisees.reduce((sum, f) => sum + (f.numberOfStations || 0), 0) : 0;
  const pendingPayments = Array.isArray(royaltyPayments) ? royaltyPayments.filter(p => p.paymentStatus === 'pending').length : 0;
  const overdueCount = Array.isArray(overduePayments) ? overduePayments.length : 0;
  const totalMonthlyRevenue = Array.isArray(allFranchisees)
    ? allFranchisees.reduce((sum, f) => sum + parseFloat(f.monthlyRevenue || '0'), 0)
    : 0;

  // Create a new franchisee/partner via the existing endpoint.
  const createFranchiseeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/enterprise/franchise/franchisees', {
        franchiseeId: form.franchiseeId.trim(),
        companyName: form.companyName.trim(),
        legalName: form.legalName.trim() || undefined,
        country: form.country.trim() || undefined,
        primaryContact: form.primaryContact.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        contractStartDate: form.contractStartDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/franchise/franchisees'] });
      toast({ title: "Partner created", description: "The franchise partner was added." });
      setForm({ ...EMPTY_FRANCHISEE_FORM });
      setCreateOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Could not create partner", description: err?.message || "Please check the fields and try again.", variant: "destructive" });
    },
  });

  const handleCreateFranchisee = () => {
    if (!form.franchiseeId.trim() || !form.companyName.trim() || !form.primaryContact.trim() || !form.email.trim() || !form.contractStartDate) {
      toast({ title: "Missing required fields", description: "Partner ID, Company, Primary Contact, Email and Contract Start Date are required.", variant: "destructive" });
      return;
    }
    createFranchiseeMutation.mutate();
  };

  // Client-side CSV export of the franchisees currently loaded.
  const handleExport = () => {
    const rows = Array.isArray(allFranchisees) ? allFranchisees : [];
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No partners are loaded.", variant: "destructive" });
      return;
    }
    const headers = ["franchiseeId", "companyName", "country", "primaryContact", "email", "phone", "numberOfStations", "monthlyRevenue", "status"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map(f => headers.map(h => esc((f as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `franchise-partners-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="Partner & Site Controls"
      subtitle="Approved partner, site, support, supply, and settlement controls"
    >
      <div className="min-h-screen luxury-bg-mesh p-8" data-testid="franchise-management-dashboard">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <Button className="luxury-btn-secondary flex items-center gap-2" data-testid="button-export" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button className="luxury-btn-primary flex items-center gap-2" data-testid="button-create-franchisee" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              New Partner Review
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards - Luxury Grid */}
      <div className="luxury-grid-4 mb-8">
        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-1" data-testid="card-total-franchisees">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] to-[#D4AF37]"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Partners</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] p-2.5 shadow-lg">
                <Building2 className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-total-franchisees">
              {Array.isArray(allFranchisees) ? allFranchisees.length : 0}
            </div>
            <p className="luxury-text-small mt-1">
              {activeFranchisees} active / approved
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-2" data-testid="card-total-stations">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] to-[#D4AF37]"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Total Stations</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] p-2.5 shadow-lg">
                <MapPin className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-total-stations">
              {totalStations}
            </div>
            <p className="luxury-text-small mt-1">Across all locations</p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-3" data-testid="card-monthly-revenue">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Monthly Reported Sales</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 p-2.5 shadow-lg">
                <TrendingUp className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-monthly-revenue">
              ₪{totalMonthlyRevenue.toLocaleString()}
            </div>
            <p className="luxury-text-small mt-1">Requires finance review</p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-4" data-testid="card-pending-payments">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Pending Payments</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 p-2.5 shadow-lg">
                <Clock className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-pending-payments">
              {pendingPayments}
            </div>
            <p className="luxury-text-small mt-1">Awaiting settlement</p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-5" data-testid="card-overdue">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-rose-500"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Overdue</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-rose-500 p-2.5 shadow-lg">
                <AlertTriangle className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-overdue-count">
              {overdueCount}
            </div>
            <p className="luxury-text-small mt-1">Requires action</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search partners by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 luxury-glass-minimal border-none"
            data-testid="input-search-franchisees"
          />
        </div>
        <Button className="luxury-btn-secondary flex items-center gap-2" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="franchisees" className="space-y-6">
        <TabsList className="luxury-glass-panel">
          <TabsTrigger value="franchisees" data-testid="tab-franchisees">
            <Building2 className="w-4 h-4 mr-2" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="royalty" data-testid="tab-royalty">
            <DollarSign className="w-4 h-4 mr-2" />
            Partner Settlements
          </TabsTrigger>
        </TabsList>

        {/* Partners Tab */}
        <TabsContent value="franchisees" data-testid="content-franchisees">
          {franchiseesError && (
            <Alert variant="destructive" data-testid="alert-franchisees-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load partners. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Country Filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <Button
              className={selectedCountry === 'all' ? 'luxury-btn-primary text-sm px-4 py-2' : 'luxury-btn-secondary text-sm px-4 py-2'}
              onClick={() => setSelectedCountry('all')}
              data-testid="filter-country-all"
            >
              All ({Array.isArray(allFranchisees) ? allFranchisees.length : 0})
            </Button>
            {Object.entries(countries).map(([country, count]) => (
              <Button
                key={country}
                className={selectedCountry === country ? 'luxury-btn-primary text-sm px-4 py-2' : 'luxury-btn-secondary text-sm px-4 py-2'}
                onClick={() => setSelectedCountry(country)}
                data-testid={`filter-country-${country.toLowerCase()}`}
              >
                {country} ({count})
              </Button>
            ))}
          </div>

          {/* Partners Grid */}
          <div className="luxury-grid-3">
            {franchiseesLoading ? (
              <p className="text-muted-foreground col-span-full text-center py-8">Loading partners...</p>
            ) : filteredFranchisees.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8" data-testid="text-no-franchisees">
                No partners found
              </p>
            ) : (
              filteredFranchisees.map((franchisee, idx) => (
                <div key={franchisee.id} className={`luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-slide-up luxury-delay-${(idx % 3) + 1}`} data-testid={`card-franchisee-${franchisee.id}`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{franchisee.franchiseeId}</Badge>
                          {franchisee.status === 'active' ? (
                            <span className="luxury-badge-success text-xs px-2 py-1 rounded-full">Active</span>
                          ) : (
                            <Badge variant="outline">{franchisee.status}</Badge>
                          )}
                        </div>
                        <h3 className="luxury-heading-md luxury-text-gradient">{franchisee.companyName}</h3>
                        <p className="luxury-text-small mt-1">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {franchisee.country || 'Unknown'}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] flex items-center justify-center shadow-lg">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Contact:</span>
                        <span className="font-medium">{franchisee.primaryContact}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Stations:</span>
                        <Badge variant="secondary">{franchisee.numberOfStations || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Reported Sales:</span>
                        <span className="luxury-heading-sm luxury-text-gradient">
                          ₪{parseFloat(franchisee.monthlyRevenue || '0').toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Settlement %:</span>
                        <span className="font-medium">{franchisee.royaltyPercent || '0'}%</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button className="luxury-btn-primary flex-1 text-sm px-4 py-2" data-testid={`button-view-franchisee-${franchisee.id}`}>
                          View
                        </Button>
                        <Button className="luxury-btn-secondary text-sm px-4 py-2" data-testid={`button-edit-franchisee-${franchisee.id}`}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Partner Settlements Tab */}
        <TabsContent value="royalty" data-testid="content-royalty">
          {paymentsError && (
            <Alert variant="destructive" data-testid="alert-payments-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load partner settlements. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Overdue Alert */}
          {overdueCount > 0 && (
            <Alert className="mb-6 border-red-300 bg-red-50" data-testid="alert-overdue">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <span className="font-semibold">{overdueCount} payment(s)</span> overdue. Review and collect immediately.
              </AlertDescription>
            </Alert>
          )}

          {/* Payments List */}
          <div className="space-y-4">
            {paymentsLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading partner settlements...</p>
            ) : !Array.isArray(royaltyPayments) || royaltyPayments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-payments">
                No partner settlements found
              </p>
            ) : (
              royaltyPayments.map((payment, idx) => (
                <div key={payment.id} className={`luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in luxury-delay-${(idx % 3) + 1}`} data-testid={`card-payment-${payment.id}`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="luxury-heading-lg luxury-text-gradient">
                              {payment.currency || 'ILS'} {parseFloat(payment.royaltyAmount).toLocaleString()}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Partner ID: {payment.franchiseeId}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-1">Period</span>
                            <span className="font-medium">
                              {new Date(payment.periodStart).toLocaleDateString()} - {new Date(payment.periodEnd).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Gross Revenue</span>
                            <span className="font-medium">₪{parseFloat(payment.grossRevenue).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Due Date</span>
                            <span className={`font-medium ${new Date(payment.dueDate) < new Date() && payment.paymentStatus === 'pending' ? 'text-red-600' : ''}`}>
                              {new Date(payment.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Status</span>
                            <Badge className={
                              payment.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 
                              payment.paymentStatus === 'pending' ? 'bg-white text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }>
                              {payment.paymentStatus || 'pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {payment.paymentStatus === 'pending' && (
                          <Button className="luxury-btn-primary flex items-center gap-2 text-sm px-4 py-2" data-testid={`button-record-payment-${payment.id}`}>
                            <CreditCard className="w-4 h-4" />
                            Record Payment
                          </Button>
                        )}
                        <Button className="luxury-btn-secondary text-sm px-4 py-2" data-testid={`button-view-payment-${payment.id}`}>
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create partner dialog — wired to POST /api/enterprise/franchise/franchisees */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-franchisee">
          <DialogHeader>
            <DialogTitle>New Partner</DialogTitle>
            <DialogDescription>Register a new franchise / joint-venture partner.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="fr-id">Partner ID *</Label>
              <Input id="fr-id" placeholder="FR-IL-001" value={form.franchiseeId} onChange={(e) => setForm(f => ({ ...f, franchiseeId: e.target.value }))} data-testid="input-franchisee-id" />
            </div>
            <div>
              <Label htmlFor="fr-country">Country</Label>
              <Input id="fr-country" placeholder="IL" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} data-testid="input-franchisee-country" />
            </div>
            <div>
              <Label htmlFor="fr-company">Company Name *</Label>
              <Input id="fr-company" value={form.companyName} onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))} data-testid="input-franchisee-company" />
            </div>
            <div>
              <Label htmlFor="fr-legal">Legal Name</Label>
              <Input id="fr-legal" value={form.legalName} onChange={(e) => setForm(f => ({ ...f, legalName: e.target.value }))} data-testid="input-franchisee-legal" />
            </div>
            <div>
              <Label htmlFor="fr-contact">Primary Contact *</Label>
              <Input id="fr-contact" value={form.primaryContact} onChange={(e) => setForm(f => ({ ...f, primaryContact: e.target.value }))} data-testid="input-franchisee-contact" />
            </div>
            <div>
              <Label htmlFor="fr-email">Email *</Label>
              <Input id="fr-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-franchisee-email" />
            </div>
            <div>
              <Label htmlFor="fr-phone">Phone</Label>
              <Input id="fr-phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-franchisee-phone" />
            </div>
            <div>
              <Label htmlFor="fr-start">Contract Start Date *</Label>
              <Input id="fr-start" type="date" value={form.contractStartDate} onChange={(e) => setForm(f => ({ ...f, contractStartDate: e.target.value }))} data-testid="input-franchisee-start" />
            </div>
          </div>
          <DialogFooter>
            <Button className="luxury-btn-ghost" onClick={() => setCreateOpen(false)} data-testid="button-cancel-franchisee">Cancel</Button>
            <Button className="luxury-btn-primary" onClick={handleCreateFranchisee} disabled={createFranchiseeMutation.isPending} data-testid="button-submit-franchisee">
              {createFranchiseeMutation.isPending ? "Creating…" : "Create Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </LuxuryPageWrapper>
  );
}
