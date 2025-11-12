import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { 
  Users, 
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Crown,
  Star,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Heart,
  Award,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  UserPlus,
  Download,
  Upload,
  RefreshCw,
  MapPin,
  PawPrint,
  Activity,
  TrendingUp,
  Gift,
  Settings,
  Bell,
  Send,
  Calendar as CalendarIcon,
  User,
  Info,
  History,
  Building,
  Sparkles
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Type definitions for customer data
interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  country?: string;
  gender?: string;
  petType?: string;
  profilePictureUrl?: string;
  loyaltyProgram: boolean;
  loyaltyTier: 'new' | 'silver' | 'gold' | 'platinum' | 'diamond';
  totalSpent: string;
  washBalance: number;
  lastLogin?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerWashHistory {
  id: number;
  packageId: number;
  packageName: string;
  washCount: number;
  originalPrice: string;
  discountApplied: string;
  finalPrice: string;
  paymentMethod?: string;
  status: string;
  createdAt: string;
}

interface CustomerCommunication {
  id: number;
  customerId: number;
  userId?: string;
  communicationType: 'email' | 'phone' | 'sms' | 'note' | 'meeting';
  direction: 'inbound' | 'outbound';
  subject?: string;
  summary: string;
  outcome?: string;
  createdBy: string;
  createdAt: string;
}

interface PetInfo {
  id: number;
  customerId: number;
  name: string;
  breed: string;
  age?: number;
  weight?: string;
  specialRequirements?: string;
  allergies?: string;
  notes?: string;
}

// Customer filters interface
interface CustomerFilters {
  loyaltyTier: string;
  lastWashDate: string;
  customerValue: string;
  verificationStatus: string;
  location: string;
  petType: string;
}

export default function CustomerManagement() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<CustomerFilters>({
    loyaltyTier: '',
    lastWashDate: '',
    customerValue: '',
    verificationStatus: '',
    location: '',
    petType: ''
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [newCommunication, setNewCommunication] = useState({
    type: 'note',
    subject: '',
    summary: '',
    outcome: ''
  });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Admin authentication check
  const { isAuthenticated: isAdminAuthenticated, isLoading: isAdminLoading } = useAdminAuth();
  
  // Redirect if not authenticated
  if (!isAdminLoading && !isAdminAuthenticated) {
    setLocation('/admin/login');
    return null;
  }

  // Fetch customers with pagination and filters
  const { data: customersData, isLoading: customersLoading, isError: customersError, refetch: refetchCustomers } = useQuery({
    queryKey: [`/api/admin/customers?page=${currentPage}&pageSize=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(searchTerm)}&loyaltyTier=${filters.loyaltyTier}&verificationStatus=${filters.verificationStatus}&location=${filters.location}&petType=${filters.petType}`],
    enabled: isAdminAuthenticated,
  });

  // Fetch customer wash history
  const { data: customerWashHistory, isLoading: historyLoading } = useQuery({
    queryKey: [`/api/admin/customers/${selectedCustomer?.id}/wash-history`],
    enabled: !!selectedCustomer && isAdminAuthenticated,
  });

  // Fetch customer communications
  const { data: customerCommunications, isLoading: communicationsLoading } = useQuery({
    queryKey: [`/api/admin/customers/${selectedCustomer?.id}/communications`],
    enabled: !!selectedCustomer && isAdminAuthenticated,
  });

  // Fetch customer pet information
  const { data: customerPets, isLoading: petsLoading } = useQuery({
    queryKey: [`/api/admin/customers/${selectedCustomer?.id}/pets`],
    enabled: !!selectedCustomer && isAdminAuthenticated,
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: { customerId: number; updates: Partial<Customer> }) => {
      return await apiRequest(`/api/admin/customers/${data.customerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers?page=${currentPage}&pageSize=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(searchTerm)}&loyaltyTier=${filters.loyaltyTier}&verificationStatus=${filters.verificationStatus}&location=${filters.location}&petType=${filters.petType}`] });
      toast({
        title: t('customers.toast.updated.title'),
        description: t('customers.toast.updated.description'),
      });
      setEditMode(false);
    },
    onError: (error) => {
      toast({
        title: t('customers.toast.updateFailed.title'),
        description: t('customers.toast.updateFailed.description'),
        variant: "destructive",
      });
    },
  });

  // Add communication mutation
  const addCommunicationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/admin/customers/${selectedCustomer?.id}/communications`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/customers/${selectedCustomer?.id}/communications`] });
      toast({
        title: t('customers.toast.communicationAdded.title'),
        description: t('customers.toast.communicationAdded.description'),
      });
      setNewCommunication({ type: 'note', subject: '', summary: '', outcome: '' });
    },
    onError: (error) => {
      toast({
        title: t('customers.toast.addFailed.title'),
        description: t('customers.toast.addFailed.description'),
        variant: "destructive",
      });
    },
  });

  const customers = (customersData as any)?.customers || [];
  const totalCustomers = (customersData as any)?.total || 0;
  const totalPages = Math.ceil(totalCustomers / pageSize);

  // Loyalty tier color mapping (NEW 5-TIER SYSTEM)
  const getLoyaltyTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'platinum': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'silver': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'new': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Customer value calculation
  const getCustomerValueTier = (totalSpent: string) => {
    const spent = parseFloat(totalSpent);
    if (spent >= 5000) return { tier: t('customers.value.vip'), color: 'bg-purple-100 text-purple-800' };
    if (spent >= 2000) return { tier: t('customers.value.highValue'), color: 'bg-blue-100 text-blue-800' };
    if (spent >= 500) return { tier: t('customers.value.regular'), color: 'bg-green-100 text-green-800' };
    return { tier: t('customers.value.new'), color: 'bg-gray-100 text-gray-800' };
  };

  // Handle customer detail view
  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerDetailOpen(true);
    setActiveTab('overview');
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof CustomerFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      loyaltyTier: '',
      lastWashDate: '',
      customerValue: '',
      verificationStatus: '',
      location: '',
      petType: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (customersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-800">Loading Customer Data</h3>
            <p className="text-gray-600">Fetching your customer database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Luxury Header */}
      <header className="bg-white border-b border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Customer Management
                </h1>
                <p className="text-sm text-slate-600 font-medium">Comprehensive customer relationship management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchCustomers()}
                className="border-blue-200 hover:bg-blue-50"
                data-testid="refresh-customers"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="add-customer"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
              <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">Live Data</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-6 shadow-lg border-0 bg-white">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">Customer Database</CardTitle>
                <CardDescription>Search, filter, and manage your customers</CardDescription>
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <Users className="w-4 h-4" />
                <span className="font-medium">{totalCustomers.toLocaleString()} customers</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('customers.search.placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-customers"
                />
              </div>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="whitespace-nowrap"
                data-testid="clear-filters"
              >
                Clear All
              </Button>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Loyalty Tier</Label>
                <Select value={filters.loyaltyTier} onValueChange={(value) => handleFilterChange('loyaltyTier', value)}>
                  <SelectTrigger data-testid="filter-loyalty-tier">
                    <SelectValue placeholder={t('customers.filters.allTiers')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Tiers</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Customer Value</Label>
                <Select value={filters.customerValue} onValueChange={(value) => handleFilterChange('customerValue', value)}>
                  <SelectTrigger data-testid="filter-customer-value">
                    <SelectValue placeholder={t('customers.filters.allValues')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Values</SelectItem>
                    <SelectItem value="vip">VIP (₪5,000+)</SelectItem>
                    <SelectItem value="high">High Value (₪2,000+)</SelectItem>
                    <SelectItem value="regular">Regular (₪500+)</SelectItem>
                    <SelectItem value="new">New (&lt; ₪500)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Verification</Label>
                <Select value={filters.verificationStatus} onValueChange={(value) => handleFilterChange('verificationStatus', value)}>
                  <SelectTrigger data-testid="filter-verification">
                    <SelectValue placeholder={t('customers.filters.allStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Location</Label>
                <Select value={filters.location} onValueChange={(value) => handleFilterChange('location', value)}>
                  <SelectTrigger data-testid="filter-location">
                    <SelectValue placeholder={t('customers.filters.allLocations')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Locations</SelectItem>
                    <SelectItem value="israel">Israel</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Pet Type</Label>
                <Select value={filters.petType} onValueChange={(value) => handleFilterChange('petType', value)}>
                  <SelectTrigger data-testid="filter-pet-type">
                    <SelectValue placeholder={t('customers.filters.allPets')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Pets</SelectItem>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Page Size</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">Customers</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" data-testid="export-customers">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" data-testid="import-customers">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Customer Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Loyalty Tier</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Wash Balance</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer: Customer) => {
                      const valueInfo = getCustomerValueTier(customer.totalSpent);
                      return (
                        <TableRow 
                          key={customer.id} 
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleCustomerClick(customer)}
                          data-testid={`customer-row-${customer.id}`}
                        >
                          <TableCell>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={customer.profilePictureUrl} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs">
                                {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900">
                                {customer.firstName} {customer.lastName}
                              </div>
                              <div className="flex items-center space-x-2">
                                {customer.petType && (
                                  <Badge variant="secondary" className="text-xs">
                                    <PawPrint className="w-3 h-3 mr-1" />
                                    {customer.petType}
                                  </Badge>
                                )}
                                <Badge className={`text-xs ${valueInfo.color}`}>
                                  {valueInfo.tier}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center space-x-1 text-slate-600">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[200px]">{customer.email}</span>
                              </div>
                              {customer.phone && (
                                <div className="flex items-center space-x-1 text-slate-600">
                                  <Phone className="w-3 h-3" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getLoyaltyTierColor(customer.loyaltyTier)} border`}>
                              <Crown className="w-3 h-3 mr-1" />
                              {customer.loyaltyTier.charAt(0).toUpperCase() + customer.loyaltyTier.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              ₪{parseFloat(customer.totalSpent).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Gift className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">{customer.washBalance}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-600">
                              {customer.lastLogin ? new Date(customer.lastLogin).toLocaleDateString() : t('customers.lastLogin.never')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {customer.isVerified ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                              )}
                              <span className={`text-xs font-medium ${customer.isVerified ? 'text-green-700' : 'text-orange-700'}`}>
                                {customer.isVerified ? t('customers.status.verified') : t('customers.status.pending')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" data-testid={`customer-actions-${customer.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCustomers)} of {totalCustomers} customers
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {totalPages > 5 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Customer Detail Modal */}
      <Dialog open={customerDetailOpen} onOpenChange={setCustomerDetailOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedCustomer?.profilePictureUrl} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                  {selectedCustomer?.firstName.charAt(0)}{selectedCustomer?.lastName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl font-bold">
                  {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                </div>
                <div className="text-sm text-slate-600 font-normal">
                  Customer ID: {selectedCustomer?.id}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>
              Complete customer profile, service history, and communication tracking
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50">
                  <User className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-green-50">
                  <History className="w-4 h-4 mr-2" />
                  Service History
                </TabsTrigger>
                <TabsTrigger value="communications" className="data-[state=active]:bg-purple-50">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Communications
                </TabsTrigger>
                <TabsTrigger value="pets" className="data-[state=active]:bg-orange-50">
                  <PawPrint className="w-4 h-4 mr-2" />
                  Pet Information
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-cyan-50">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* Customer Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Personal Information</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditMode(!editMode)}
                        data-testid="edit-customer-info"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        {editMode ? t('customers.actions.cancel') : t('customers.actions.edit')}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          {editMode ? (
                            <Input
                              value={selectedCustomer.firstName}
                              onChange={(e) => setSelectedCustomer(prev => prev ? {...prev, firstName: e.target.value} : null)}
                              data-testid="edit-first-name"
                            />
                          ) : (
                            <div className="font-medium">{selectedCustomer.firstName}</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          {editMode ? (
                            <Input
                              value={selectedCustomer.lastName}
                              onChange={(e) => setSelectedCustomer(prev => prev ? {...prev, lastName: e.target.value} : null)}
                              data-testid="edit-last-name"
                            />
                          ) : (
                            <div className="font-medium">{selectedCustomer.lastName}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">{selectedCustomer.email}</span>
                          {selectedCustomer.isVerified && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>

                      {selectedCustomer.phone && (
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <span className="font-medium">{selectedCustomer.phone}</span>
                            <Button variant="outline" size="sm" data-testid="call-customer">
                              <Phone className="w-3 h-3 mr-1" />
                              Call
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedCustomer.dateOfBirth && (
                        <div className="space-y-2">
                          <Label>Date of Birth</Label>
                          <div className="font-medium">{new Date(selectedCustomer.dateOfBirth).toLocaleDateString()}</div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Country</Label>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">{selectedCustomer.country || t('customers.country.notSpecified')}</span>
                        </div>
                      </div>

                      {editMode && (
                        <div className="pt-4">
                          <Button
                            onClick={() => {
                              updateCustomerMutation.mutate({
                                customerId: selectedCustomer.id,
                                updates: {
                                  firstName: selectedCustomer.firstName,
                                  lastName: selectedCustomer.lastName,
                                }
                              });
                            }}
                            disabled={updateCustomerMutation.isPending}
                            data-testid="save-customer-changes"
                          >
                            {updateCustomerMutation.isPending ? t('customers.actions.saving') : t('customers.actions.saveChanges')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Loyalty & Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Loyalty & Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Loyalty Tier</Label>
                        <Badge className={`${getLoyaltyTierColor(selectedCustomer.loyaltyTier)} border text-sm`}>
                          <Crown className="w-4 h-4 mr-2" />
                          {selectedCustomer.loyaltyTier.charAt(0).toUpperCase() + selectedCustomer.loyaltyTier.slice(1)}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <Label>Total Spent</Label>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="text-2xl font-bold text-green-600">
                            ₪{parseFloat(selectedCustomer.totalSpent).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Wash Balance</Label>
                        <div className="flex items-center space-x-2">
                          <Gift className="w-4 h-4 text-blue-500" />
                          <span className="text-xl font-bold text-blue-600">
                            {selectedCustomer.washBalance} washes
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Loyalty Program</Label>
                          <Switch
                            checked={selectedCustomer.loyaltyProgram}
                            onCheckedChange={(checked) => {
                              updateCustomerMutation.mutate({
                                customerId: selectedCustomer.id,
                                updates: { loyaltyProgram: checked }
                              });
                            }}
                            data-testid="toggle-loyalty-program"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Email Verified</Label>
                          <div className="flex items-center space-x-2">
                            {selectedCustomer.isVerified ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-orange-500" />
                            )}
                            <span className={`text-sm font-medium ${selectedCustomer.isVerified ? 'text-green-700' : 'text-orange-700'}`}>
                              {selectedCustomer.isVerified ? t('customers.status.verified') : t('customers.status.unverified')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="schedule-appointment">
                        <Calendar className="w-6 h-6" />
                        <span>Schedule Wash</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="send-email">
                        <Mail className="w-6 h-6" />
                        <span>Send Email</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="send-promotion">
                        <Gift className="w-6 h-6" />
                        <span>Send Promotion</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="mark-vip">
                        <Star className="w-6 h-6" />
                        <span>Mark as VIP</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Service History Tab */}
              <TabsContent value="history" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Service History</CardTitle>
                    <CardDescription>Complete wash package history and satisfaction ratings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading service history...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {((customerWashHistory as any) || [])?.map((wash: CustomerWashHistory) => (
                          <div key={wash.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{wash.packageName}</h4>
                                <p className="text-sm text-slate-600">
                                  {new Date(wash.createdAt).toLocaleDateString()} • {wash.washCount} wash{wash.washCount > 1 ? 'es' : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">₪{parseFloat(wash.finalPrice).toLocaleString()}</div>
                                {parseFloat(wash.discountApplied) > 0 && (
                                  <div className="text-sm text-orange-600">
                                    {parseFloat(wash.discountApplied).toFixed(1)}% discount
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <Badge variant={wash.status === 'completed' ? 'default' : 'secondary'}>
                                {wash.status}
                              </Badge>
                              {wash.paymentMethod && (
                                <span className="text-slate-600">Paid via {wash.paymentMethod}</span>
                              )}
                            </div>
                          </div>
                        )) || (
                          <div className="text-center py-8 text-slate-600">
                            No service history found
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Communications Tab */}
              <TabsContent value="communications" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Communication History</CardTitle>
                    <CardDescription>Track all interactions and add new communications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Add New Communication */}
                    <div className="border rounded-lg p-4 bg-slate-50">
                      <h4 className="font-medium mb-4">Add New Communication</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={newCommunication.type}
                            onValueChange={(value) => setNewCommunication(prev => ({ ...prev, type: value }))}
                          >
                            <SelectTrigger data-testid="communication-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="note">Note</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone">Phone Call</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="meeting">Meeting</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input
                            value={newCommunication.subject}
                            onChange={(e) => setNewCommunication(prev => ({ ...prev, subject: e.target.value }))}
                            placeholder={t('customers.communication.subject.placeholder')}
                            data-testid="communication-subject"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label>Summary</Label>
                        <Textarea
                          value={newCommunication.summary}
                          onChange={(e) => setNewCommunication(prev => ({ ...prev, summary: e.target.value }))}
                          placeholder={t('customers.communication.summary.placeholder')}
                          rows={3}
                          data-testid="communication-summary"
                        />
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label>Outcome</Label>
                        <Input
                          value={newCommunication.outcome}
                          onChange={(e) => setNewCommunication(prev => ({ ...prev, outcome: e.target.value }))}
                          placeholder={t('customers.communication.outcome.placeholder')}
                          data-testid="communication-outcome"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          addCommunicationMutation.mutate({
                            communicationType: newCommunication.type,
                            direction: 'outbound',
                            subject: newCommunication.subject,
                            summary: newCommunication.summary,
                            outcome: newCommunication.outcome,
                          });
                        }}
                        disabled={!newCommunication.summary || addCommunicationMutation.isPending}
                        className="mt-4"
                        data-testid="add-communication"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {addCommunicationMutation.isPending ? t('customers.actions.adding') : t('customers.actions.addCommunication')}
                      </Button>
                    </div>

                    {/* Communication History */}
                    {communicationsLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading communications...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {((customerCommunications as any) || [])?.map((comm: CustomerCommunication) => (
                          <div key={comm.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  comm.direction === 'inbound' ? 'bg-blue-500' : 'bg-green-500'
                                }`}></div>
                                <Badge variant="outline">
                                  {comm.communicationType}
                                </Badge>
                                <span className="text-sm text-slate-600">
                                  {new Date(comm.createdAt).toLocaleDateString()} at {new Date(comm.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              <span className="text-sm text-slate-500">by {comm.createdBy}</span>
                            </div>
                            {comm.subject && (
                              <h4 className="font-medium mb-2">{comm.subject}</h4>
                            )}
                            <p className="text-slate-700 mb-2">{comm.summary}</p>
                            {comm.outcome && (
                              <div className="text-sm text-slate-600 italic">
                                Outcome: {comm.outcome}
                              </div>
                            )}
                          </div>
                        )) || (
                          <div className="text-center py-8 text-slate-600">
                            No communications found
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Pet Information Tab */}
              <TabsContent value="pets" className="space-y-6 mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Pet Information</CardTitle>
                      <CardDescription>Manage pet details, special requirements, and allergies</CardDescription>
                    </div>
                    <Button data-testid="add-pet">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Pet
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {petsLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading pet information...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {((customerPets as any) || [])?.map((pet: PetInfo) => (
                          <div key={pet.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <PawPrint className="w-5 h-5 text-orange-500" />
                                <div>
                                  <h4 className="font-medium">{pet.name}</h4>
                                  <p className="text-sm text-slate-600">{pet.breed}</p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" data-testid={`edit-pet-${pet.id}`}>
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              {pet.age && (
                                <div>
                                  <span className="text-slate-500">Age:</span>
                                  <span className="ml-2 font-medium">{pet.age} years</span>
                                </div>
                              )}
                              {pet.weight && (
                                <div>
                                  <span className="text-slate-500">Weight:</span>
                                  <span className="ml-2 font-medium">{pet.weight}</span>
                                </div>
                              )}
                            </div>
                            {pet.specialRequirements && (
                              <div className="mt-3">
                                <span className="text-sm text-slate-500">Special Requirements:</span>
                                <p className="text-sm text-slate-700 mt-1">{pet.specialRequirements}</p>
                              </div>
                            )}
                            {pet.allergies && (
                              <div className="mt-3">
                                <span className="text-sm text-slate-500">Allergies:</span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {pet.allergies.split(',').map((allergy, index) => (
                                    <Badge key={index} variant="destructive" className="text-xs">
                                      {allergy.trim()}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )) || (
                          <div className="text-center py-8 text-slate-600">
                            <PawPrint className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                            <p>No pet information found</p>
                            <Button className="mt-4" data-testid="add-first-pet">
                              <Plus className="w-4 h-4 mr-2" />
                              Add Pet Information
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Customer Lifetime Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ₪{parseFloat(selectedCustomer.totalSpent).toLocaleString()}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        Since {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Visit Frequency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {((customerWashHistory as any) || []).length || 0}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">Total visits</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Average Order Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        ₪{((customerWashHistory as any) || []).length ? 
                          (parseFloat(selectedCustomer.totalSpent) / ((customerWashHistory as any) || []).length).toFixed(0) : 
                          '0'
                        }
                      </div>
                      <p className="text-sm text-slate-600 mt-1">Per visit</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Customer Journey</CardTitle>
                    <CardDescription>Timeline of customer interactions and milestones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4 p-3 bg-blue-50 rounded-lg">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <div>
                          <div className="font-medium">Customer Registration</div>
                          <div className="text-sm text-slate-600">
                            {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      {selectedCustomer.isVerified && (
                        <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">Email Verified</div>
                            <div className="text-sm text-slate-600">Account verification completed</div>
                          </div>
                        </div>
                      )}

                      {((customerWashHistory as any) || []).length > 0 && (
                        <div className="flex items-center space-x-4 p-3 bg-purple-50 rounded-lg">
                          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">First Service</div>
                            <div className="text-sm text-slate-600">
                              {new Date(((customerWashHistory as any) || [])[((customerWashHistory as any) || []).length - 1]?.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedCustomer.loyaltyTier !== 'new' && (
                        <div className="flex items-center space-x-4 p-3 bg-yellow-50 rounded-lg">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">Loyalty Tier Upgraded</div>
                            <div className="text-sm text-slate-600">
                              Reached {selectedCustomer.loyaltyTier} status
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}