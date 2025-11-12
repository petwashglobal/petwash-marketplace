import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Clock
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
    <div className="min-h-screen bg-white p-6" data-testid="franchise-management-dashboard">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-metallic-gold via-metallic-rose to-metallic-platinum bg-clip-text text-transparent mb-2" data-testid="text-page-title">
              Franchise Management
            </h1>
            <p className="text-muted-foreground">Global franchise network oversight and royalty tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-metallic-gold text-metallic-gold hover:bg-metallic-gold/10" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-create-franchisee">
              <Plus className="w-4 h-4 mr-2" />
              New Franchisee
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="diamond-card border-metallic-gold hover-glow-gold" data-testid="card-total-franchisees">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Franchisees</CardTitle>
            <Building2 className="w-4 h-4 text-metallic-gold icon-glow-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-metallic-gold" data-testid="text-total-franchisees">
              {Array.isArray(allFranchisees) ? allFranchisees.length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeFranchisees} active
            </p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-metallic-platinum hover-glow-blue" data-testid="card-total-stations">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stations</CardTitle>
            <MapPin className="w-4 h-4 text-metallic-platinum icon-glow-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-metallic-platinum" data-testid="text-total-stations">
              {totalStations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all locations</p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-green-500 hover-glow-green" data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-monthly-revenue">
              ₪{totalMonthlyRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Combined network</p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-amber-500 hover-glow-amber" data-testid="card-pending-payments">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <Clock className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-pending-payments">
              {pendingPayments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting settlement</p>
          </CardContent>
        </Card>

        <Card className="diamond-card border-red-500 hover-glow-red" data-testid="card-overdue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-overdue-count">
              {overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requires action</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search franchisees by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 luxury-input"
            data-testid="input-search-franchisees"
          />
        </div>
        <Button variant="outline" className="border-metallic-silver" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="franchisees" className="space-y-6">
        <TabsList className="bg-gradient-to-r from-gray-100 to-gray-50 p-1">
          <TabsTrigger value="franchisees" className="data-[state=active]:bg-metallic-gold/20 data-[state=active]:text-metallic-gold" data-testid="tab-franchisees">
            <Building2 className="w-4 h-4 mr-2" />
            Franchisees
          </TabsTrigger>
          <TabsTrigger value="royalty" className="data-[state=active]:bg-metallic-platinum/20 data-[state=active]:text-metallic-platinum" data-testid="tab-royalty">
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
            <Button
              variant={selectedCountry === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCountry('all')}
              className={selectedCountry === 'all' ? 'bg-metallic-gold text-white' : ''}
              data-testid="filter-country-all"
            >
              All ({Array.isArray(allFranchisees) ? allFranchisees.length : 0})
            </Button>
            {Object.entries(countries).map(([country, count]) => (
              <Button
                key={country}
                variant={selectedCountry === country ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCountry(country)}
                className={selectedCountry === country ? 'bg-metallic-gold text-white' : ''}
                data-testid={`filter-country-${country.toLowerCase()}`}
              >
                {country} ({count})
              </Button>
            ))}
          </div>

          {/* Franchisees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {franchiseesLoading ? (
              <p className="text-muted-foreground col-span-full text-center py-8">Loading franchisees...</p>
            ) : filteredFranchisees.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8" data-testid="text-no-franchisees">
                No franchisees found
              </p>
            ) : (
              filteredFranchisees.map((franchisee) => (
                <Card key={franchisee.id} className="glass-card border-metallic-gold hover-glow-gold transition-all" data-testid={`card-franchisee-${franchisee.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{franchisee.franchiseeId}</Badge>
                          {franchisee.status === 'active' ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                          ) : (
                            <Badge variant="outline">{franchisee.status}</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg text-metallic-gold">{franchisee.companyName}</CardTitle>
                        <CardDescription className="mt-1">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {franchisee.country || 'Unknown'}
                        </CardDescription>
                      </div>
                      <Building2 className="w-5 h-5 text-metallic-gold" />
                    </div>
                  </CardHeader>
                  <CardContent>
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
                        <span className="font-medium text-green-600">
                          ₪{parseFloat(franchisee.monthlyRevenue || '0').toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Royalty:</span>
                        <span className="font-medium">{franchisee.royaltyPercent || '0'}%</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" data-testid={`button-view-franchisee-${franchisee.id}`}>
                          View
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-edit-franchisee-${franchisee.id}`}>
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
              royaltyPayments.map((payment) => (
                <Card key={payment.id} className="glass-card hover-glow-blue" data-testid={`card-payment-${payment.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <DollarSign className="w-5 h-5 text-metallic-gold" />
                          <div>
                            <h3 className="font-semibold text-lg text-metallic-gold">
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
                          <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90" data-testid={`button-record-payment-${payment.id}`}>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Record Payment
                          </Button>
                        )}
                        <Button size="sm" variant="outline" data-testid={`button-view-payment-${payment.id}`}>
                          View
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
