import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export default function FranchiseManagementDashboard() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
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

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="Franchise Management"
      subtitle="Global franchise network oversight and royalty tracking"
    >
      <div className="min-h-screen luxury-bg-mesh p-8" data-testid="franchise-management-dashboard">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <button className="luxury-btn-secondary flex items-center gap-2" data-testid="button-export">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="luxury-btn-primary flex items-center gap-2" data-testid="button-create-franchisee">
              <Plus className="w-4 h-4" />
              New Franchisee
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards - Luxury Grid */}
      <div className="luxury-grid-4 mb-8">
        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-1" data-testid="card-total-franchisees">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-500"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Franchisees</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 p-2.5 shadow-lg">
                <Building2 className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-total-franchisees">
              {Array.isArray(allFranchisees) ? allFranchisees.length : 0}
            </div>
            <p className="luxury-text-small mt-1">
              {activeFranchisees} active
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-lg luxury-hover-glow luxury-animate-fade-in luxury-delay-2" data-testid="card-total-stations">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-pink-500"></div>
          <div className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="luxury-heading-sm">Total Stations</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 p-2.5 shadow-lg">
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
              <h3 className="luxury-heading-sm">Monthly Revenue</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 p-2.5 shadow-lg">
                <TrendingUp className="w-full h-full text-white" />
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mt-2" data-testid="text-monthly-revenue">
              ₪{totalMonthlyRevenue.toLocaleString()}
            </div>
            <p className="luxury-text-small mt-1">Combined network</p>
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
            placeholder="Search franchisees by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 luxury-glass-minimal border-none"
            data-testid="input-search-franchisees"
          />
        </div>
        <button className="luxury-btn-secondary flex items-center gap-2" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="franchisees" className="space-y-6">
        <TabsList className="luxury-glass-panel">
          <TabsTrigger value="franchisees" data-testid="tab-franchisees">
            <Building2 className="w-4 h-4 mr-2" />
            Franchisees
          </TabsTrigger>
          <TabsTrigger value="royalty" data-testid="tab-royalty">
            <DollarSign className="w-4 h-4 mr-2" />
            Royalty Payments
          </TabsTrigger>
        </TabsList>

        {/* Franchisees Tab */}
        <TabsContent value="franchisees" data-testid="content-franchisees">
          {franchiseesError && (
            <Alert variant="destructive" data-testid="alert-franchisees-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load franchisees. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Country Filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              className={selectedCountry === 'all' ? 'luxury-btn-primary text-sm px-4 py-2' : 'luxury-btn-secondary text-sm px-4 py-2'}
              onClick={() => setSelectedCountry('all')}
              data-testid="filter-country-all"
            >
              All ({Array.isArray(allFranchisees) ? allFranchisees.length : 0})
            </button>
            {Object.entries(countries).map(([country, count]) => (
              <button
                key={country}
                className={selectedCountry === country ? 'luxury-btn-primary text-sm px-4 py-2' : 'luxury-btn-secondary text-sm px-4 py-2'}
                onClick={() => setSelectedCountry(country)}
                data-testid={`filter-country-${country.toLowerCase()}`}
              >
                {country} ({count})
              </button>
            ))}
          </div>

          {/* Franchisees Grid */}
          <div className="luxury-grid-3">
            {franchiseesLoading ? (
              <p className="text-muted-foreground col-span-full text-center py-8">Loading franchisees...</p>
            ) : filteredFranchisees.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8" data-testid="text-no-franchisees">
                No franchisees found
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
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg">
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
                        <span className="text-muted-foreground">Monthly Rev:</span>
                        <span className="luxury-heading-sm luxury-text-gradient">
                          ₪{parseFloat(franchisee.monthlyRevenue || '0').toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Royalty:</span>
                        <span className="font-medium">{franchisee.royaltyPercent || '0'}%</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button className="luxury-btn-primary flex-1 text-sm px-4 py-2" data-testid={`button-view-franchisee-${franchisee.id}`}>
                          View
                        </button>
                        <button className="luxury-btn-secondary text-sm px-4 py-2" data-testid={`button-edit-franchisee-${franchisee.id}`}>
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Royalty Payments Tab */}
        <TabsContent value="royalty" data-testid="content-royalty">
          {paymentsError && (
            <Alert variant="destructive" data-testid="alert-payments-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load royalty payments. Please try again.
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
              <p className="text-muted-foreground text-center py-8">Loading royalty payments...</p>
            ) : !Array.isArray(royaltyPayments) || royaltyPayments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-payments">
                No royalty payments found
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
                              Franchisee ID: {payment.franchiseeId}
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
                              payment.paymentStatus === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }>
                              {payment.paymentStatus || 'pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {payment.paymentStatus === 'pending' && (
                          <button className="luxury-btn-primary flex items-center gap-2 text-sm px-4 py-2" data-testid={`button-record-payment-${payment.id}`}>
                            <CreditCard className="w-4 h-4" />
                            Record Payment
                          </button>
                        )}
                        <button className="luxury-btn-secondary text-sm px-4 py-2" data-testid={`button-view-payment-${payment.id}`}>
                          View
                        </button>
                      </div>
                    </div>
                  </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </LuxuryPageWrapper>
  );
}
