import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/lib/languageStore";
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
  const { language } = useLanguage();
  
  // Admin authentication check
  const { isAuthenticated: isAdminAuthenticated, isLoading: isAdminLoading } = useAdminAuth();
  
  // Redirect if not authenticated
  if (!isAdminLoading && !isAdminAuthenticated) {
    setLocation('/signin');
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
        title: t('customers.toast.updated.title', language),
        description: t('customers.toast.updated.description', language),
      });
      setEditMode(false);
    },
    onError: (error) => {
      toast({
        title: t('customers.toast.updateFailed.title', language),
        description: t('customers.toast.updateFailed.description', language),
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
        title: t('customers.toast.communicationAdded.title', language),
        description: t('customers.toast.communicationAdded.description', language),
      });
      setNewCommunication({ type: 'note', subject: '', summary: '', outcome: '' });
    },
    onError: (error) => {
      toast({
        title: t('customers.toast.addFailed.title', language),
        description: t('customers.toast.addFailed.description', language),
        variant: "destructive",
      });
    },
  });

  const customers = (customersData as any)?.customers || [];
  const totalCustomers = (customersData as any)?.total || 0;
  const totalPages = Math.ceil(totalCustomers / pageSize);

  // Loyalty tier color mapping (7-TIER LUXURY SYSTEM: Bronze→Royal)
  const getLoyaltyTierColor = (tier: string) => {
    switch (tier) {
      case 'royal': return 'bg-[#D4AF37] text-black border-[#D4AF37]';
      case 'emerald': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'diamond': return 'bg-[#D4AF37] text-black border-[#D4AF37]';
      case 'platinum': return 'bg-[#D4AF37] text-black border-[#D4AF37]';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'silver': return 'bg-white text-gray-800 border-gray-300';
      case 'bronze': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'new': return 'bg-white text-slate-800 border-slate-300'; // Legacy support
      default: return 'bg-white text-slate-800 border-slate-300';
    }
  };

  // Customer value calculation
  const getCustomerValueTier = (totalSpent: string) => {
    const spent = parseFloat(totalSpent);
    if (spent >= 5000) return { tier: t('customers.value.vip', language), color: 'bg-[#D4AF37] text-black' };
    if (spent >= 2000) return { tier: t('customers.value.highValue', language), color: 'bg-[#D4AF37] text-black' };
    if (spent >= 500) return { tier: t('customers.value.regular', language), color: 'bg-green-100 text-green-800' };
    return { tier: t('customers.value.new', language), color: 'bg-white text-gray-800' };
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
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center" dir="rtl">
        <div className="text-center luxury-animate-fade-in">
          <div className="luxury-spinner mx-auto mb-6"></div>
          <div className="space-y-2">
            <h3 className="luxury-heading-sm">טוען נתוני לקוחות</h3>
            <p className="luxury-text-body">מושך את מאגר הלקוחות שלך...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh" dir="rtl">
      {/* Luxury Header */}
      <header className="luxury-glass-card rounded-none border-b luxury-shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#B8932F] to-[#B8932F] rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#B8932F] to-[#B8932F] bg-clip-text text-transparent">
                  ניהול לקוחות
                </h1>
                <p className="text-sm text-slate-600 font-medium">ניהול קשרי לקוחות מקצה לקצה</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchCustomers()}
                className="border-[#D4AF37] hover:bg-[#D4AF37]"
                data-testid="refresh-customers"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                רענון
              </Button>
              <Button
                className="luxury-btn-primary text-sm px-4 py-2"
                data-testid="add-customer"
              >
                <UserPlus className="w-4 h-4 ml-2 inline" />
                לקוח חדש
              </Button>
              <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">נתונים חיים</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-6 luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-1">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">מאגר לקוחות</CardTitle>
                <CardDescription>חיפוש, סינון וניהול הלקוחות שלך</CardDescription>
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <Users className="w-4 h-4" />
                <span className="font-medium">{totalCustomers.toLocaleString()} לקוחות</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('customers.search.placeholder', language)}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                  data-testid="search-customers"
                />
              </div>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="whitespace-nowrap"
                data-testid="clear-filters"
              >
                ניקוי הכול
              </Button>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">דרגת מועדון</Label>
                <Select value={filters.loyaltyTier || 'all'} onValueChange={(value) => handleFilterChange('loyaltyTier', value === 'all' ? '' : value)}>
                  <SelectTrigger data-testid="filter-loyalty-tier">
                    <SelectValue placeholder={t('customers.filters.allTiers', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הדרגות</SelectItem>
                    <SelectItem value="diamond">יהלום</SelectItem>
                    <SelectItem value="platinum">פלטינה</SelectItem>
                    <SelectItem value="gold">זהב</SelectItem>
                    <SelectItem value="silver">כסף</SelectItem>
                    <SelectItem value="new">חדש</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">ערך לקוח</Label>
                <Select value={filters.customerValue || 'all'} onValueChange={(value) => handleFilterChange('customerValue', value === 'all' ? '' : value)}>
                  <SelectTrigger data-testid="filter-customer-value">
                    <SelectValue placeholder={t('customers.filters.allValues', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הערכים</SelectItem>
                    <SelectItem value="vip">VIP (₪5,000+)</SelectItem>
                    <SelectItem value="high">ערך גבוה (₪2,000+)</SelectItem>
                    <SelectItem value="regular">רגיל (₪500+)</SelectItem>
                    <SelectItem value="new">חדש (&lt; ₪500)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">אימות</Label>
                <Select value={filters.verificationStatus || 'all'} onValueChange={(value) => handleFilterChange('verificationStatus', value === 'all' ? '' : value)}>
                  <SelectTrigger data-testid="filter-verification">
                    <SelectValue placeholder={t('customers.filters.allStatus', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="verified">מאומת</SelectItem>
                    <SelectItem value="unverified">לא מאומת</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">מיקום</Label>
                <Select value={filters.location || 'all'} onValueChange={(value) => handleFilterChange('location', value === 'all' ? '' : value)}>
                  <SelectTrigger data-testid="filter-location">
                    <SelectValue placeholder={t('customers.filters.allLocations', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל המיקומים</SelectItem>
                    <SelectItem value="israel">ישראל</SelectItem>
                    <SelectItem value="us">ארצות הברית</SelectItem>
                    <SelectItem value="uk">בריטניה</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">סוג חיה</Label>
                <Select value={filters.petType || 'all'} onValueChange={(value) => handleFilterChange('petType', value === 'all' ? '' : value)}>
                  <SelectTrigger data-testid="filter-pet-type">
                    <SelectValue placeholder={t('customers.filters.allPets', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל החיות</SelectItem>
                    <SelectItem value="dog">כלב</SelectItem>
                    <SelectItem value="cat">חתול</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">שורות בעמוד</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 בעמוד</SelectItem>
                    <SelectItem value="25">25 בעמוד</SelectItem>
                    <SelectItem value="50">50 בעמוד</SelectItem>
                    <SelectItem value="100">100 בעמוד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">לקוחות</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" data-testid="export-customers">
                  <Download className="w-4 h-4 ml-2" />
                  ייצוא
                </Button>
                <Button variant="outline" size="sm" data-testid="import-customers">
                  <Upload className="w-4 h-4 ml-2" />
                  ייבוא
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
                      <TableHead>לקוח</TableHead>
                      <TableHead>פרטי קשר</TableHead>
                      <TableHead>דרגת מועדון</TableHead>
                      <TableHead>סה״כ הוצאה</TableHead>
                      <TableHead>יתרת שטיפות</TableHead>
                      <TableHead>פעילות אחרונה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer: Customer) => {
                      const valueInfo = getCustomerValueTier(customer.totalSpent);
                      return (
                        <TableRow 
                          key={customer.id} 
                          className="cursor-pointer hover:bg-white"
                          onClick={() => handleCustomerClick(customer)}
                          data-testid={`customer-row-${customer.id}`}
                        >
                          <TableCell>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={customer.profilePictureUrl} />
                              <AvatarFallback className="bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] text-white text-xs">
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
                              <Gift className="w-4 h-4 text-[#D4AF37]" />
                              <span className="font-medium">{customer.washBalance}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-600">
                              {customer.lastLogin ? new Date(customer.lastLogin).toLocaleDateString() : t('customers.lastLogin.never', language)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {customer.isVerified ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
                              )}
                              <span className={`text-xs font-medium ${customer.isVerified ? 'text-green-700' : 'text-[#B8932F]'}`}>
                                {customer.isVerified ? t('customers.status.verified', language) : t('customers.status.pending', language)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {/* Opens the full Control Tower detail page (overview/consents/notifications/payments). */}
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`customer-actions-${customer.id}`}
                              title={language === 'he' ? 'פרופיל מלא' : 'Full profile'}
                              onClick={(e) => { e.stopPropagation(); setLocation(`/admin/customers/${customer.id}`); }}
                            >
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
                <AvatarFallback className="bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] text-white">
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
                <TabsTrigger value="overview" className="data-[state=active]:bg-[#D4AF37]">
                  <User className="w-4 h-4 ml-2" />
                  סקירה
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-green-50">
                  <History className="w-4 h-4 ml-2" />
                  היסטוריית שירות
                </TabsTrigger>
                <TabsTrigger value="communications" className="data-[state=active]:bg-[#D4AF37]">
                  <MessageSquare className="w-4 h-4 ml-2" />
                  תקשורת
                </TabsTrigger>
                <TabsTrigger value="pets" className="data-[state=active]:bg-white">
                  <PawPrint className="w-4 h-4 ml-2" />
                  פרטי חיה
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-[#D4AF37]">
                  <TrendingUp className="w-4 h-4 ml-2" />
                  אנליטיקה
                </TabsTrigger>
              </TabsList>

              {/* Customer Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">פרטים אישיים</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditMode(!editMode)}
                        data-testid="edit-customer-info"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        {editMode ? t('customers.actions.cancel', language) : t('customers.actions.edit', language)}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>שם פרטי</Label>
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
                          <Label>שם משפחה</Label>
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
                        <Label>אימייל</Label>
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
                          <Label>טלפון</Label>
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <span className="font-medium">{selectedCustomer.phone}</span>
                            <Button variant="outline" size="sm" data-testid="call-customer">
                              <Phone className="w-3 h-3 ml-1" />
                              התקשר
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedCustomer.dateOfBirth && (
                        <div className="space-y-2">
                          <Label>תאריך לידה</Label>
                          <div className="font-medium">{new Date(selectedCustomer.dateOfBirth).toLocaleDateString()}</div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>מדינה</Label>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">{selectedCustomer.country || t('customers.country.notSpecified', language)}</span>
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
                            {updateCustomerMutation.isPending ? t('customers.actions.saving', language) : t('customers.actions.saveChanges', language)}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Loyalty & Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">מועדון וסטטוס</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>דרגת מועדון</Label>
                        <Badge className={`${getLoyaltyTierColor(selectedCustomer.loyaltyTier)} border text-sm`}>
                          <Crown className="w-4 h-4 mr-2" />
                          {selectedCustomer.loyaltyTier.charAt(0).toUpperCase() + selectedCustomer.loyaltyTier.slice(1)}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <Label>סה״כ הוצאה</Label>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="text-2xl font-bold text-green-600">
                            ₪{parseFloat(selectedCustomer.totalSpent).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>יתרת שטיפות</Label>
                        <div className="flex items-center space-x-2">
                          <Gift className="w-4 h-4 text-[#D4AF37]" />
                          <span className="text-xl font-bold text-[#B8932F]">
                            {selectedCustomer.washBalance} שטיפות
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>תוכנית נאמנות</Label>
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
                          <Label>אימייל מאומת</Label>
                          <div className="flex items-center space-x-2">
                            {selectedCustomer.isVerified ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-[#D4AF37]" />
                            )}
                            <span className={`text-sm font-medium ${selectedCustomer.isVerified ? 'text-green-700' : 'text-[#B8932F]'}`}>
                              {selectedCustomer.isVerified ? t('customers.status.verified', language) : t('customers.status.unverified', language)}
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
                    <CardTitle className="text-lg">פעולות מהירות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="view-bay-status">
                        <Calendar className="w-6 h-6" />
                        <span>סטטוס עמדה</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="send-email">
                        <Mail className="w-6 h-6" />
                        <span>שליחת אימייל</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="send-promotion">
                        <Gift className="w-6 h-6" />
                        <span>שליחת מבצע</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col space-y-2" data-testid="mark-vip">
                        <Star className="w-6 h-6" />
                        <span>סימון כ-VIP</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Service History Tab */}
              <TabsContent value="history" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">היסטוריית שירות</CardTitle>
                    <CardDescription>היסטוריית חבילות שטיפה ודירוגי שביעות רצון</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-[#B8932F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">טוען היסטוריית שירות...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {((customerWashHistory as any) || [])?.map((wash: CustomerWashHistory) => (
                          <div key={wash.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{wash.packageName}</h4>
                                <p className="text-sm text-slate-600">
                                  {new Date(wash.createdAt).toLocaleDateString("he-IL")} • {wash.washCount} שטיפות
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">₪{parseFloat(wash.finalPrice).toLocaleString()}</div>
                                {parseFloat(wash.discountApplied) > 0 && (
                                  <div className="text-sm text-[#B8932F]">
                                    {parseFloat(wash.discountApplied).toFixed(1)}% הנחה
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <Badge variant={wash.status === 'completed' ? 'default' : 'secondary'}>
                                {wash.status}
                              </Badge>
                              {wash.paymentMethod && (
                                <span className="text-slate-600">שולם ב-{wash.paymentMethod}</span>
                              )}
                            </div>
                          </div>
                        )) || (
                          <div className="text-center py-8 text-slate-600">
                            לא נמצאה היסטוריית שירות
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
                    <CardTitle className="text-lg">היסטוריית תקשורת</CardTitle>
                    <CardDescription>מעקב אחר כל האינטראקציות והוספת תקשורת חדשה</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Add New Communication */}
                    <div className="border rounded-lg p-4 bg-white">
                      <h4 className="font-medium mb-4">הוספת תקשורת</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>סוג</Label>
                          <Select
                            value={newCommunication.type}
                            onValueChange={(value) => setNewCommunication(prev => ({ ...prev, type: value }))}
                          >
                            <SelectTrigger data-testid="communication-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="note">הערה</SelectItem>
                              <SelectItem value="email">אימייל</SelectItem>
                              <SelectItem value="phone">שיחת טלפון</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="meeting">פגישה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>נושא</Label>
                          <Input
                            value={newCommunication.subject}
                            onChange={(e) => setNewCommunication(prev => ({ ...prev, subject: e.target.value }))}
                            placeholder={t('customers.communication.subject.placeholder', language)}
                            data-testid="communication-subject"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label>סיכום</Label>
                        <Textarea
                          value={newCommunication.summary}
                          onChange={(e) => setNewCommunication(prev => ({ ...prev, summary: e.target.value }))}
                          placeholder={t('customers.communication.summary.placeholder', language)}
                          rows={3}
                          data-testid="communication-summary"
                        />
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label>תוצאה</Label>
                        <Input
                          value={newCommunication.outcome}
                          onChange={(e) => setNewCommunication(prev => ({ ...prev, outcome: e.target.value }))}
                          placeholder={t('customers.communication.outcome.placeholder', language)}
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
                        <Send className="w-4 h-4 ml-2" />
                        {addCommunicationMutation.isPending ? t('customers.actions.adding', language) : t('customers.actions.addCommunication', language)}
                      </Button>
                    </div>

                    {/* Communication History */}
                    {communicationsLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-[#B8932F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">טוען תקשורות...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {((customerCommunications as any) || [])?.map((comm: CustomerCommunication) => (
                          <div key={comm.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  comm.direction === 'inbound' ? 'bg-[#D4AF37]' : 'bg-green-500'
                                }`}></div>
                                <Badge variant="outline">
                                  {comm.communicationType}
                                </Badge>
                                <span className="text-sm text-slate-600">
                                  {new Date(comm.createdAt).toLocaleDateString("he-IL")} בשעה {new Date(comm.createdAt).toLocaleTimeString("he-IL")}
                                </span>
                              </div>
                              <span className="text-sm text-slate-500">ע״י {comm.createdBy}</span>
                            </div>
                            {comm.subject && (
                              <h4 className="font-medium mb-2">{comm.subject}</h4>
                            )}
                            <p className="text-slate-700 mb-2">{comm.summary}</p>
                            {comm.outcome && (
                              <div className="text-sm text-slate-600 italic">
                                תוצאה: {comm.outcome}
                              </div>
                            )}
                          </div>
                        )) || (
                          <div className="text-center py-8 text-slate-600">
                            לא נמצאו תקשורות
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
                      <CardTitle className="text-lg">פרטי חיה</CardTitle>
                      <CardDescription>ניהול פרטי חיה, דרישות מיוחדות ואלרגיות</CardDescription>
                    </div>
                    <Button data-testid="add-pet">
                      <Plus className="w-4 h-4 ml-2" />
                      הוספת חיה
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {petsLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-[#B8932F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">טוען פרטי חיה...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {((customerPets as any) || [])?.map((pet: PetInfo) => (
                          <div key={pet.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <PawPrint className="w-5 h-5 text-[#D4AF37]" />
                                <div>
                                  <h4 className="font-medium">{pet.name}</h4>
                                  <p className="text-sm text-slate-600">{pet.breed}</p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" data-testid={`edit-pet-${pet.id}`}>
                                <Edit className="w-3 h-3 ml-1" />
                                עריכה
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              {pet.age && (
                                <div>
                                  <span className="text-slate-500">גיל:</span>
                                  <span className="mr-2 font-medium">{pet.age} שנים</span>
                                </div>
                              )}
                              {pet.weight && (
                                <div>
                                  <span className="text-slate-500">משקל:</span>
                                  <span className="mr-2 font-medium">{pet.weight}</span>
                                </div>
                              )}
                            </div>
                            {pet.specialRequirements && (
                              <div className="mt-3">
                                <span className="text-sm text-slate-500">דרישות מיוחדות:</span>
                                <p className="text-sm text-slate-700 mt-1">{pet.specialRequirements}</p>
                              </div>
                            )}
                            {pet.allergies && (
                              <div className="mt-3">
                                <span className="text-sm text-slate-500">אלרגיות:</span>
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
                            <p>לא נמצאו פרטי חיה</p>
                            <Button className="mt-4" data-testid="add-first-pet">
                              <Plus className="w-4 h-4 ml-2" />
                              הוספת פרטי חיה
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
                      <CardTitle className="text-sm font-medium text-slate-600">ערך לקוח לאורך זמן</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ₪{parseFloat(selectedCustomer.totalSpent).toLocaleString()}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        מאז {new Date(selectedCustomer.createdAt).toLocaleDateString("he-IL")}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">תדירות ביקורים</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-[#B8932F]">
                        {((customerWashHistory as any) || []).length || 0}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">סה״כ ביקורים</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">שווי הזמנה ממוצע</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-[#B8932F]">
                        ₪{((customerWashHistory as any) || []).length ? 
                          (parseFloat(selectedCustomer.totalSpent) / ((customerWashHistory as any) || []).length).toFixed(0) : 
                          '0'
                        }
                      </div>
                      <p className="text-sm text-slate-600 mt-1">לביקור</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">מסע הלקוח</CardTitle>
                    <CardDescription>ציר זמן של אינטראקציות ואבני דרך</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4 p-3 bg-[#D4AF37] rounded-lg">
                        <div className="w-3 h-3 bg-[#D4AF37] rounded-full"></div>
                        <div>
                          <div className="font-medium">הרשמת לקוח</div>
                          <div className="text-sm text-slate-600">
                            {new Date(selectedCustomer.createdAt).toLocaleDateString("he-IL")}
                          </div>
                        </div>
                      </div>
                      
                      {selectedCustomer.isVerified && (
                        <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">אימייל מאומת</div>
                            <div className="text-sm text-slate-600">אימות החשבון הושלם</div>
                          </div>
                        </div>
                      )}

                      {((customerWashHistory as any) || []).length > 0 && (
                        <div className="flex items-center space-x-4 p-3 bg-[#D4AF37] rounded-lg">
                          <div className="w-3 h-3 bg-[#D4AF37] rounded-full"></div>
                          <div>
                            <div className="font-medium">שירות ראשון</div>
                            <div className="text-sm text-slate-600">
                              {new Date(((customerWashHistory as any) || [])[((customerWashHistory as any) || []).length - 1]?.createdAt).toLocaleDateString("he-IL")}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedCustomer.loyaltyTier !== 'new' && (
                        <div className="flex items-center space-x-4 p-3 bg-white rounded-lg">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">עלייה בדרגת מועדון</div>
                            <div className="text-sm text-slate-600">
                              הגיע לדרגת {selectedCustomer.loyaltyTier}
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