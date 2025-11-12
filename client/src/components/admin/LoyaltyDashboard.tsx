import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Star, Award, TrendingUp, Users, DollarSign, Calendar } from "lucide-react";
import { useState } from "react";

interface LoyaltyCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  loyaltyTier: string;
  totalSpent: number;
  washCount: number;
  lastWash: string;
  joinDate: string;
  lifetimeValue: number;
  averageSpend: number;
  phoneNumber?: string;
  isVerifiedSenior?: boolean;
  isVerifiedDisability?: boolean;
}

interface LoyaltyStats {
  totalCustomers: number;
  activeCustomers: number;
  averageLifetimeValue: number;
  totalRevenue: number;
  tierDistribution: {
    new: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
  };
  monthlyGrowth: number;
  retentionRate: number;
}

const getTierIcon = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'diamond':
      return <Crown className="h-4 w-4 text-blue-500" />;
    case 'platinum':
      return <Crown className="h-4 w-4 text-purple-500" />;
    case 'gold':
      return <Award className="h-4 w-4 text-yellow-500" />;
    case 'silver':
      return <Star className="h-4 w-4 text-gray-500" />;
    case 'new':
      return <TrendingUp className="h-4 w-4 text-slate-500" />;
    default:
      return <TrendingUp className="h-4 w-4" />;
  }
};

const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'diamond':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'platinum':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'gold':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'silver':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'new':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

export function LoyaltyDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState("lifetimeValue");

  const { data: loyaltyStats, isLoading: statsLoading } = useQuery<LoyaltyStats>({
    queryKey: ["/api/admin/loyalty/stats"],
    refetchInterval: 30000,
  });

  const { data: customers, isLoading: customersLoading } = useQuery<LoyaltyCustomer[]>({
    queryKey: ["/api/admin/loyalty/customers", searchTerm, tierFilter, sortBy],
    refetchInterval: 30000,
  });

  const filteredCustomers = customers?.filter(customer => {
    const matchesSearch = searchTerm === "" || 
      customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTier = tierFilter === "all" || customer.loyaltyTier.toLowerCase() === tierFilter.toLowerCase();
    
    return matchesSearch && matchesTier;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loyalty Program Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loyaltyStats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {loyaltyStats?.activeCustomers || 0} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average LTV</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(loyaltyStats?.averageLifetimeValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              +{loyaltyStats?.monthlyGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(loyaltyStats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              From loyalty program members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loyaltyStats?.retentionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Customer retention rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">Customer Management</TabsTrigger>
          <TabsTrigger value="tiers">Tier Analytics</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Management</CardTitle>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search Customers</Label>
                  <Input
                    id="search"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor="tier-filter">Filter by Tier</Label>
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Tiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="diamond">Diamond</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor="sort-by">Sort by</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lifetimeValue">Lifetime Value</SelectItem>
                      <SelectItem value="totalSpent">Total Spent</SelectItem>
                      <SelectItem value="washCount">Wash Count</SelectItem>
                      <SelectItem value="joinDate">Join Date</SelectItem>
                      <SelectItem value="lastWash">Last Wash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>LTV</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Wash Count</TableHead>
                        <TableHead>Last Wash</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers?.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {customer.firstName} {customer.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {customer.email}
                              </div>
                              {customer.phoneNumber && (
                                <div className="text-sm text-muted-foreground">
                                  {customer.phoneNumber}
                                </div>
                              )}
                              <div className="flex gap-1">
                                {customer.isVerifiedSenior && (
                                  <Badge variant="outline" className="text-xs">
                                    Senior
                                  </Badge>
                                )}
                                {customer.isVerifiedDisability && (
                                  <Badge variant="outline" className="text-xs">
                                    Disability
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTierColor(customer.loyaltyTier)}>
                              {getTierIcon(customer.loyaltyTier)}
                              <span className="ml-1">{customer.loyaltyTier}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(customer.lifetimeValue)}
                          </TableCell>
                          <TableCell>{formatCurrency(customer.totalSpent)}</TableCell>
                          <TableCell>{customer.washCount}</TableCell>
                          <TableCell>{formatDate(customer.lastWash)}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              View Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(loyaltyStats?.tierDistribution || {}).map(([tier, count]) => (
              <Card key={tier}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{tier} Tier</CardTitle>
                  {getTierIcon(tier)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground">
                    {loyaltyStats?.totalCustomers ? 
                      Math.round((count / loyaltyStats.totalCustomers) * 100) : 0}% of customers
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Top Performing Segment</h3>
                    <p className="text-sm text-muted-foreground">
                      Gold tier customers have the highest average transaction value
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Retention Opportunity</h3>
                    <p className="text-sm text-muted-foreground">
                      New tier customers show 85% retention with targeted offers
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Growth Trend</h3>
                    <p className="text-sm text-muted-foreground">
                      Monthly new customer acquisition up 23% this quarter
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Seasonal Pattern</h3>
                    <p className="text-sm text-muted-foreground">
                      Peak usage during summer months (May-September)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}