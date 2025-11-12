import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { t } from "@/lib/i18n";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Users, 
  TrendingUp,
  TrendingDown,
  Target,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  Activity,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  UserPlus,
  Download,
  Upload,
  RefreshCw,
  Send,
  Calendar as CalendarIcon,
  User,
  Building,
  Sparkles,
  Crown,
  Award,
  Zap,
  ArrowRight,
  X,
  Check,
  PhoneCall,
  Video,
  FileText,
  Settings,
  BarChart,
  LineChart,
  Copy,
  ExternalLink
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Funnel,
  FunnelChart,
  LabelList
} from "recharts";

// Import shared schema types and validation schemas
import {
  type CrmLead,
  type CrmOpportunity,
  type CrmCommunication,
  type CrmTask,
  crmLeadCreationSchema,
  crmOpportunityCreationSchema,
  insertCrmCommunicationSchema,
  insertCrmTaskSchema,
  updateCrmLeadSchema,
  updateCrmOpportunitySchema
} from "@shared/schema";

// Use shared types instead of local interfaces
type Lead = CrmLead;
type Opportunity = CrmOpportunity;
type Communication = CrmCommunication;
type Task = CrmTask;

interface LeadAnalytics {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  sourceDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  scoreDistribution: Record<string, number>;
  averageEstimatedValue: number;
  totalEstimatedValue: number;
}

interface DealStage {
  id: number;
  name: string;
  description?: string;
  sortOrder: number;
  winProbability?: string;
  isActive: boolean;
}

// Use shared form schemas instead of local ones
const leadFormSchema = crmLeadCreationSchema;
const communicationFormSchema = insertCrmCommunicationSchema;
const taskFormSchema = insertCrmTaskSchema.extend({
  reminderEnabled: z.boolean().default(true),
  reminderTime: z.string().optional(),
});
const opportunityFormSchema = crmOpportunityCreationSchema;

// Lead status options
const leadStatuses = [
  { value: 'new', label: t('leads.status.new') },
  { value: 'contacted', label: t('leads.status.contacted') },
  { value: 'qualified', label: t('leads.status.qualified') },
  { value: 'nurturing', label: t('leads.status.nurturing') },
  { value: 'converted', label: t('leads.status.converted') },
  { value: 'lost', label: t('leads.status.lost') },
];

const leadSources = [
  { value: 'website', label: t('leads.source.website') },
  { value: 'referral', label: t('leads.source.referral') },
  { value: 'social_media', label: t('leads.source.socialMedia') },
  { value: 'google_ads', label: t('leads.source.googleAds') },
  { value: 'facebook_ads', label: t('leads.source.facebookAds') },
  { value: 'trade_show', label: t('leads.source.tradeShow') },
  { value: 'cold_call', label: t('leads.source.coldCall') },
  { value: 'other', label: t('leads.source.other') },
];

const petTypes = [
  { value: 'dog', label: t('leads.petType.dog') },
  { value: 'cat', label: t('leads.petType.cat') },
  { value: 'other', label: t('leads.petType.other') },
];

const priorityLevels = [
  { value: 'low', label: t('leads.priority.low') },
  { value: 'medium', label: t('leads.priority.medium') },
  { value: 'high', label: t('leads.priority.high') },
  { value: 'urgent', label: t('leads.priority.urgent') },
];

const communicationTypes = [
  { value: 'email', label: t('communications.type.email') },
  { value: 'phone_call', label: t('communications.type.phoneCall') },
  { value: 'sms', label: t('communications.type.sms') },
  { value: 'in_person', label: t('communications.type.inPerson') },
  { value: 'whatsapp', label: t('communications.type.whatsapp') },
  { value: 'video_call', label: t('communications.type.videoCall') },
];

const taskTypes = [
  { value: 'call', label: t('tasks.type.call') },
  { value: 'email', label: t('tasks.type.email') },
  { value: 'meeting', label: t('tasks.type.meeting') },
  { value: 'demo', label: t('tasks.type.demo') },
  { value: 'follow_up', label: t('tasks.type.followUp') },
  { value: 'research', label: t('tasks.type.research') },
  { value: 'proposal', label: t('tasks.type.proposal') },
];

// Color schemes for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Status color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'contacted': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'qualified': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'nurturing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'converted': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    case 'lost': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'low': return 'text-green-600';
    case 'medium': return 'text-yellow-600';
    case 'high': return 'text-orange-600';
    case 'urgent': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

export default function LeadManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [communicationFormOpen, setCommunicationFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [opportunityFormOpen, setOpportunityFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Admin authentication check
  const { isAuthenticated: isAdminAuthenticated, isLoading: isAdminLoading } = useAdminAuth();
  
  // Redirect if not authenticated
  if (!isAdminLoading && !isAdminAuthenticated) {
    setLocation('/admin/login');
    return null;
  }

  // Forms
  const leadForm = useForm({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      jobTitle: '',
      leadSource: '',
      sourceDetails: '',
      interestedServices: [],
      petType: '',
      estimatedMonthlyValue: '',
      notes: '',
      assignedTo: '',
    }
  });

  const communicationForm = useForm({
    resolver: zodResolver(communicationFormSchema),
    defaultValues: {
      communicationType: '',
      direction: 'outbound',
      subject: '',
      summary: '',
      outcome: '',
      nextAction: '',
      nextActionDate: '',
      duration: '',
    }
  });

  const taskForm = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      taskType: '',
      priority: 'medium',
      assignedTo: '',
      dueDate: '',
      reminderEnabled: true,
      reminderTime: '',
    }
  });

  const opportunityForm = useForm({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      name: '',
      description: '',
      dealStageId: '',
      estimatedValue: '',
      winProbability: '',
      expectedCloseDate: '',
      serviceType: '',
      assignedTo: '',
    }
  });

  // API Queries
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['/api/crm/leads', searchTerm, statusFilter, sourceFilter, assigneeFilter, currentPage, pageSize, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder,
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (assigneeFilter) params.append('assignedTo', assigneeFilter);

      const response = await fetch(`/api/crm/leads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      return response.json();
    }
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/crm/leads/analytics'],
    queryFn: async () => {
      const response = await fetch('/api/crm/leads/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  const { data: dealStagesData } = useQuery({
    queryKey: ['/api/crm/deal-stages'],
    queryFn: async () => {
      const response = await fetch('/api/crm/deal-stages');
      if (!response.ok) throw new Error('Failed to fetch deal stages');
      return response.json();
    }
  });

  const { data: leadDetailsData, isLoading: leadDetailsLoading } = useQuery({
    queryKey: ['/api/crm/leads', selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return null;
      const response = await fetch(`/api/crm/leads/${selectedLead.id}`);
      if (!response.ok) throw new Error('Failed to fetch lead details');
      return response.json();
    },
    enabled: !!selectedLead?.id
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/leads', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: t('messages.leadCreated'), variant: "default" });
      leadForm.reset();
      setLeadFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads/analytics'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.saveFailed'),
        variant: "destructive" 
      });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/crm/leads/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      toast({ title: t('messages.leadUpdated'), variant: "default" });
      setEditMode(false);
      setLeadDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads/analytics'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.saveFailed'),
        variant: "destructive" 
      });
    }
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/leads/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({ title: t('messages.leadDeleted'), variant: "default" });
      setLeadDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads/analytics'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.deleteFailed'),
        variant: "destructive" 
      });
    }
  });

  const convertLeadMutation = useMutation({
    mutationFn: async ({ id, customerData }: { id: number; customerData: any }) => {
      return apiRequest(`/api/crm/leads/${id}/convert`, 'POST', { customerData });
    },
    onSuccess: () => {
      toast({ title: t('messages.leadConverted'), variant: "default" });
      setLeadDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads/analytics'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.conversionFailed'),
        variant: "destructive" 
      });
    }
  });

  const createCommunicationMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedLead?.id) throw new Error('No lead selected');
      return apiRequest(`/api/crm/leads/${selectedLead.id}/communications`, 'POST', data);
    },
    onSuccess: () => {
      toast({ title: t('messages.communicationLogged'), variant: "default" });
      communicationForm.reset();
      setCommunicationFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads', selectedLead?.id] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.saveFailed'),
        variant: "destructive" 
      });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedLead?.id) throw new Error('No lead selected');
      return apiRequest(`/api/crm/leads/${selectedLead.id}/tasks`, 'POST', data);
    },
    onSuccess: () => {
      toast({ title: t('messages.taskCreated'), variant: "default" });
      taskForm.reset();
      setTaskFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads', selectedLead?.id] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.saveFailed'),
        variant: "destructive" 
      });
    }
  });

  const createOpportunityMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedLead?.id) throw new Error('No lead selected');
      return apiRequest(`/api/crm/leads/${selectedLead.id}/opportunities`, 'POST', data);
    },
    onSuccess: () => {
      toast({ title: t('messages.opportunityCreated'), variant: "default" });
      opportunityForm.reset();
      setOpportunityFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads', selectedLead?.id] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('errors.saveFailed'),
        variant: "destructive" 
      });
    }
  });

  // Handlers
  const handleCreateLead = (data: any) => {
    createLeadMutation.mutate(data);
  };

  const handleUpdateLead = (data: any) => {
    if (!selectedLead?.id) return;
    updateLeadMutation.mutate({ id: selectedLead.id, data });
  };

  const handleDeleteLead = () => {
    if (!selectedLead?.id) return;
    deleteLeadMutation.mutate(selectedLead.id);
  };

  const handleConvertLead = () => {
    if (!selectedLead?.id) return;
    convertLeadMutation.mutate({ 
      id: selectedLead.id, 
      customerData: { 
        password: 'temporary123',
        loyaltyProgram: true,
        termsAccepted: true 
      } 
    });
  };

  const handleCreateCommunication = (data: any) => {
    createCommunicationMutation.mutate(data);
  };

  const handleCreateTask = (data: any) => {
    createTaskMutation.mutate(data);
  };

  const handleCreateOpportunity = (data: any) => {
    createOpportunityMutation.mutate({
      ...data,
      dealStageId: parseInt(data.dealStageId),
    });
  };

  const handleLeadSelect = (lead: Lead) => {
    setSelectedLead(lead);
    setLeadDetailOpen(true);
    setEditMode(false);
  };

  const handleEditLead = () => {
    if (!selectedLead) return;
    
    leadForm.reset({
      firstName: selectedLead.firstName,
      lastName: selectedLead.lastName,
      email: selectedLead.email,
      phone: selectedLead.phone || '',
      company: selectedLead.company || '',
      jobTitle: selectedLead.jobTitle || '',
      leadSource: selectedLead.leadSource,
      sourceDetails: selectedLead.sourceDetails || '',
      interestedServices: selectedLead.interestedServices || [],
      petType: selectedLead.petType || '',
      estimatedMonthlyValue: selectedLead.estimatedMonthlyValue || '',
      notes: selectedLead.notes || '',
      assignedTo: selectedLead.assignedTo || '',
    });
    
    setEditMode(true);
    setLeadFormOpen(true);
  };

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS' 
    }).format(num || 0);
  };

  const getLeadScore = (lead: Lead) => {
    return lead.leadScore || 0;
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  if (isAdminLoading || leadsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('leads.title')}</h2>
          <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const leads: Lead[] = leadsData?.leads || [];
  const analytics: LeadAnalytics = analyticsData || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800" data-testid="lead-management-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2" data-testid="page-title">
              {t('leads.title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('leads.subtitle')}
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-4 lg:mt-0">
            <Button 
              onClick={() => {
                leadForm.reset();
                setEditMode(false);
                setLeadFormOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="add-lead-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('actions.addLead')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refetchLeads()}
              data-testid="refresh-button"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('crm.dashboard.refresh')}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" data-testid="dashboard-tab">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t('leads.dashboard')}
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="leads-tab">
              <Users className="w-4 h-4 mr-2" />
              {t('leads.list.title')}
            </TabsTrigger>
            <TabsTrigger value="pipeline" data-testid="pipeline-tab">
              <Target className="w-4 h-4 mr-2" />
              {t('leads.pipeline')}
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab">
              <PieChart className="w-4 h-4 mr-2" />
              {t('leads.analytics')}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('metrics.totalLeads')}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="total-leads-metric">
                    {analytics.totalLeads || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.convertedLeads || 0} {t('metrics.convertedLeads').toLowerCase()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('metrics.conversionRate')}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="conversion-rate-metric">
                    {analytics.conversionRate || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('period.thisMonth').toLowerCase()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('metrics.averageDealSize')}</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="avg-deal-size-metric">
                    {formatCurrency(analytics.averageEstimatedValue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('period.thisMonth').toLowerCase()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('metrics.pipelineValue')}</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="pipeline-value-metric">
                    {formatCurrency(analytics.totalEstimatedValue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('period.thisMonth').toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lead Source Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.sourcePerformance')}</CardTitle>
                  <CardDescription>
                    {t('leads.list.allSources')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={Object.entries(analytics.sourceDistribution || {}).map(([key, value]) => ({
                            name: leadSources.find(s => s.value === key)?.label || key,
                            value,
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label
                        >
                          {Object.entries(analytics.sourceDistribution || {}).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Lead Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.conversionFunnel')}</CardTitle>
                  <CardDescription>
                    {t('leads.list.allStatuses')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(analytics.statusDistribution || {}).map(([key, value]) => ({
                        name: leadStatuses.find(s => s.value === key)?.label || key,
                        value,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8">
                          {Object.entries(analytics.statusDistribution || {}).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>{t('leads.details.activities')}</CardTitle>
                <CardDescription>
                  Recent lead activities and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leads.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex items-center space-x-4 p-4 rounded-lg border">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lead.company} • {formatDate(lead.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className={getStatusColor(lead.leadStatus)}>
                        {leadStatuses.find(s => s.value === lead.leadStatus)?.label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leads List Tab */}
          <TabsContent value="leads" className="space-y-6">
            {/* Filters and Search */}
            <Card>
              <CardHeader>
                <CardTitle>{t('leads.list.filterBy')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">{t('common.search')}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="search"
                        placeholder={t('leads.list.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="search-leads-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status-filter">{t('leads.status.new')}</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger data-testid="status-filter">
                        <SelectValue placeholder={t('leads.list.allStatuses')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('leads.list.allStatuses')}</SelectItem>
                        {leadStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="source-filter">{t('leads.form.leadSource')}</Label>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger data-testid="source-filter">
                        <SelectValue placeholder={t('leads.list.allSources')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('leads.list.allSources')}</SelectItem>
                        {leadSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sort-by">{t('leads.list.sortBy')}</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger data-testid="sort-by-filter">
                        <SelectValue placeholder={t('leads.list.sortBy')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt">{t('leads.list.createdDate')}</SelectItem>
                        <SelectItem value="name">{t('register.firstName')}</SelectItem>
                        <SelectItem value="leadScore">{t('leads.list.leadScore')}</SelectItem>
                        <SelectItem value="estimatedValue">{t('leads.list.estimatedValue')}</SelectItem>
                        <SelectItem value="lastContactedAt">{t('leads.list.lastContact')}</SelectItem>
                        <SelectItem value="nextFollowUpAt">{t('leads.list.nextFollowUp')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-4 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                      setSourceFilter('');
                      setAssigneeFilter('');
                    }}
                    data-testid="clear-filters-button"
                  >
                    {t('leads.list.clearFilters')}
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    {leads.length} {t('leads.list.title').toLowerCase()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leads Table */}
            <Card>
              <CardHeader>
                <CardTitle>{t('leads.list.title')}</CardTitle>
                <CardDescription>
                  {t('leads.management')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <div className="text-center py-12" data-testid="no-leads-message">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {t('leads.list.noLeads')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {t('leads.list.createFirst')}
                    </p>
                    <Button 
                      onClick={() => {
                        leadForm.reset();
                        setEditMode(false);
                        setLeadFormOpen(true);
                      }}
                      data-testid="create-first-lead-button"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('actions.addLead')}
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('register.firstName')}</TableHead>
                          <TableHead>{t('register.email')}</TableHead>
                          <TableHead>{t('leads.form.company')}</TableHead>
                          <TableHead>{t('leads.form.leadSource')}</TableHead>
                          <TableHead>{t('leads.status.new')}</TableHead>
                          <TableHead>{t('leads.list.leadScore')}</TableHead>
                          <TableHead>{t('leads.list.estimatedValue')}</TableHead>
                          <TableHead>{t('leads.list.createdDate')}</TableHead>
                          <TableHead className="text-right">{t('actions.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((lead) => (
                          <TableRow 
                            key={lead.id} 
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => handleLeadSelect(lead)}
                            data-testid={`lead-row-${lead.id}`}
                          >
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold">{lead.firstName} {lead.lastName}</div>
                                {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
                              </div>
                            </TableCell>
                            <TableCell>{lead.email}</TableCell>
                            <TableCell>{lead.company || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {leadSources.find(s => s.value === lead.leadSource)?.label || lead.leadSource}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(lead.leadStatus)}>
                                {leadStatuses.find(s => s.value === lead.leadStatus)?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span className={`font-medium ${getScoreColor(getLeadScore(lead))}`}>
                                  {getLeadScore(lead)}
                                </span>
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${getLeadScore(lead)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {lead.estimatedMonthlyValue ? formatCurrency(lead.estimatedMonthlyValue) : '-'}
                            </TableCell>
                            <TableCell>{formatDate(lead.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLeadSelect(lead);
                                }}
                                data-testid={`view-lead-${lead.id}`}
                              >
                                <Eye className="w-4 h-4" />
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

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('leads.pipeline')}</CardTitle>
                <CardDescription>
                  {t('pipeline.stages.newLead')} → {t('pipeline.stages.qualified')} → {t('pipeline.stages.proposalSent')} → {t('pipeline.stages.negotiating')} → {t('pipeline.stages.won')}/{t('pipeline.stages.lost')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Pipeline Visualization
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Interactive pipeline with drag-and-drop functionality coming soon
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Lead Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>{t('leads.list.leadScore')} Distribution</CardTitle>
                <CardDescription>
                  Lead quality scoring breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(analytics.scoreDistribution || {}).map(([key, value]) => ({
                      name: key,
                      value,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Additional Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Source ROI</CardTitle>
                  <CardDescription>
                    Return on investment by lead source
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(analytics.sourceDistribution || {}).map(([source, count]) => {
                      const label = leadSources.find(s => s.value === source)?.label || source;
                      const percentage = analytics.totalLeads > 0 ? (count / analytics.totalLeads) * 100 : 0;
                      
                      return (
                        <div key={source} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{label}</span>
                            <span>{count} leads ({percentage.toFixed(1)}%)</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Metrics</CardTitle>
                  <CardDescription>
                    Key performance indicators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Overall Conversion Rate</span>
                      <span className="text-2xl font-bold text-green-600">
                        {analytics.conversionRate || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Average Deal Value</span>
                      <span className="text-2xl font-bold">
                        {formatCurrency(analytics.averageEstimatedValue || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Pipeline Value</span>
                      <span className="text-2xl font-bold">
                        {formatCurrency(analytics.totalEstimatedValue || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Lead Form Dialog */}
        <Dialog open={leadFormOpen} onOpenChange={setLeadFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>
                {editMode ? t('leads.details.edit') : t('leads.form.title')}
              </DialogTitle>
              <DialogDescription>
                {editMode ? 'Update lead information' : 'Capture new lead information'}
              </DialogDescription>
            </DialogHeader>

            <Form {...leadForm}>
              <form onSubmit={leadForm.handleSubmit(editMode ? handleUpdateLead : handleCreateLead)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={leadForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.firstName')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('leads.form.firstName')} {...field} data-testid="lead-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.lastName')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('leads.form.lastName')} {...field} data-testid="lead-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.email')}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={t('leads.form.email')} {...field} data-testid="lead-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.phone')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('leads.form.phone')} {...field} data-testid="lead-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.company')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('leads.form.company')} {...field} data-testid="lead-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.jobTitle')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('leads.form.jobTitle')} {...field} data-testid="lead-job-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="leadSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.leadSource')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="lead-source-select">
                              <SelectValue placeholder={t('leads.form.leadSource')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {leadSources.map((source) => (
                              <SelectItem key={source.value} value={source.value}>
                                {source.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="petType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.petType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="lead-pet-type-select">
                              <SelectValue placeholder={t('leads.form.petType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {petTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={leadForm.control}
                    name="estimatedMonthlyValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('leads.form.estimatedValue')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="lead-estimated-value" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={leadForm.control}
                  name="sourceDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('leads.form.sourceDetails')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('leads.form.sourceDetails')} {...field} data-testid="lead-source-details" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={leadForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('leads.form.notes')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('leads.form.notes')} 
                          className="min-h-[100px]" 
                          {...field} 
                          data-testid="lead-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLeadFormOpen(false)}
                    data-testid="cancel-lead-form"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createLeadMutation.isPending || updateLeadMutation.isPending}
                    data-testid="submit-lead-form"
                  >
                    {createLeadMutation.isPending || updateLeadMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {editMode ? t('leads.form.updateLead') : t('leads.form.createLead')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Lead Details Dialog */}
        <Dialog open={leadDetailOpen} onOpenChange={setLeadDetailOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{t('leads.details.title')}</span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditLead}
                    data-testid="edit-lead-button"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t('leads.details.edit')}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="delete-lead-button">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('leads.details.delete')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirm.deleteLead')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. The lead will be marked as lost.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteLead}
                          className="bg-red-600 hover:bg-red-700"
                          data-testid="confirm-delete-lead"
                        >
                          {t('leads.details.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogTitle>
            </DialogHeader>

            {selectedLead && (
              <div className="space-y-6">
                {/* Lead Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedLead.firstName} {selectedLead.lastName}</span>
                      <Badge className={getStatusColor(selectedLead.leadStatus)}>
                        {leadStatuses.find(s => s.value === selectedLead.leadStatus)?.label}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {selectedLead.company && `${selectedLead.company} • `}
                      {selectedLead.jobTitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-500">{t('register.email')}</p>
                        <p className="text-sm">{selectedLead.email}</p>
                      </div>
                      {selectedLead.phone && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-500">{t('register.phone')}</p>
                          <p className="text-sm">{selectedLead.phone}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-500">{t('leads.form.leadSource')}</p>
                        <p className="text-sm">
                          {leadSources.find(s => s.value === selectedLead.leadSource)?.label}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-500">{t('leads.details.leadScore')}</p>
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${getScoreColor(getLeadScore(selectedLead))}`}>
                            {getLeadScore(selectedLead)}
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${getLeadScore(selectedLead)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      {selectedLead.estimatedMonthlyValue && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-500">{t('leads.list.estimatedValue')}</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(selectedLead.estimatedMonthlyValue)}
                          </p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-500">{t('leads.details.createdOn')}</p>
                        <p className="text-sm">{formatDate(selectedLead.createdAt)}</p>
                      </div>
                    </div>

                    {selectedLead.notes && (
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-medium text-gray-500">{t('leads.form.notes')}</p>
                        <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          {selectedLead.notes}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCommunicationFormOpen(true)}
                        data-testid="log-communication-button"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {t('leads.details.logCommunication')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTaskFormOpen(true)}
                        data-testid="create-task-button"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        {t('actions.createTask')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpportunityFormOpen(true)}
                        data-testid="create-opportunity-button"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        {t('leads.details.createOpportunity')}
                      </Button>
                      {selectedLead.leadStatus !== 'converted' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              data-testid="convert-lead-button"
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              {t('leads.details.convertToCustomer')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('confirm.convertLead')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will create a new customer account and mark the lead as converted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={handleConvertLead}
                                data-testid="confirm-convert-lead"
                              >
                                {t('leads.details.convertToCustomer')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Lead Details Tabs */}
                <Tabs defaultValue="communications" className="w-full">
                  <TabsList>
                    <TabsTrigger value="communications">{t('leads.details.communications')}</TabsTrigger>
                    <TabsTrigger value="activities">{t('leads.details.activities')}</TabsTrigger>
                    <TabsTrigger value="tasks">{t('leads.details.tasks')}</TabsTrigger>
                    <TabsTrigger value="opportunities">{t('leads.details.opportunities')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="communications" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('leads.details.communications')}</CardTitle>
                        <CardDescription>
                          Communication history and interactions
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {leadDetailsData?.communications?.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                              <p>No communications recorded yet</p>
                            </div>
                          ) : (
                            leadDetailsData?.communications?.map((comm: Communication) => (
                              <div key={comm.id} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">
                                      {communicationTypes.find(t => t.value === comm.communicationType)?.label}
                                    </Badge>
                                    <Badge variant={comm.direction === 'inbound' ? 'default' : 'secondary'}>
                                      {comm.direction === 'inbound' ? t('communications.direction.inbound') : t('communications.direction.outbound')}
                                    </Badge>
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {formatDate(comm.createdAt)}
                                  </span>
                                </div>
                                {comm.subject && (
                                  <h4 className="font-medium mb-2">{comm.subject}</h4>
                                )}
                                <p className="text-sm text-gray-600 mb-2">{comm.summary}</p>
                                {comm.outcome && (
                                  <p className="text-xs text-gray-500">
                                    <strong>Outcome:</strong> {comm.outcome}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="activities" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('leads.details.activities')}</CardTitle>
                        <CardDescription>
                          Activity timeline and history
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {leadDetailsData?.activities?.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                              <p>No activities recorded yet</p>
                            </div>
                          ) : (
                            leadDetailsData?.activities?.map((activity: any) => (
                              <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">{activity.title}</h4>
                                  <span className="text-sm text-gray-500">
                                    {formatDate(activity.activityDate)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{activity.description}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="tasks" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('leads.details.tasks')}</CardTitle>
                        <CardDescription>
                          Scheduled tasks and follow-ups
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {leadDetailsData?.tasks?.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                              <p>No tasks scheduled yet</p>
                            </div>
                          ) : (
                            leadDetailsData?.tasks?.map((task: Task) => (
                              <div key={task.id} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium">{task.title}</h4>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">
                                      {taskTypes.find(t => t.value === task.taskType)?.label}
                                    </Badge>
                                    <Badge className={`${getPriorityColor(task.priority)} bg-opacity-10`}>
                                      {priorityLevels.find(p => p.value === task.priority)?.label}
                                    </Badge>
                                  </div>
                                </div>
                                {task.description && (
                                  <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                                )}
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>Assigned to: {task.assignedTo}</span>
                                  {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="opportunities" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('leads.details.opportunities')}</CardTitle>
                        <CardDescription>
                          Sales opportunities and deals
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {leadDetailsData?.opportunities?.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Target className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                              <p>No opportunities created yet</p>
                            </div>
                          ) : (
                            leadDetailsData?.opportunities?.map((opportunity: Opportunity) => (
                              <div key={opportunity.id} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium">{opportunity.name}</h4>
                                  <Badge className={getStatusColor(opportunity.status)}>
                                    {opportunity.status}
                                  </Badge>
                                </div>
                                {opportunity.description && (
                                  <p className="text-sm text-gray-600 mb-2">{opportunity.description}</p>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Estimated Value:</span>
                                    <span className="ml-2 font-medium">
                                      {formatCurrency(opportunity.estimatedValue)}
                                    </span>
                                  </div>
                                  {opportunity.expectedCloseDate && (
                                    <div>
                                      <span className="text-gray-500">Expected Close:</span>
                                      <span className="ml-2">{formatDate(opportunity.expectedCloseDate)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Communication Form Dialog */}
        <Dialog open={communicationFormOpen} onOpenChange={setCommunicationFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>{t('communications.log')}</DialogTitle>
              <DialogDescription>
                Record communication with {selectedLead?.firstName} {selectedLead?.lastName}
              </DialogDescription>
            </DialogHeader>

            <Form {...communicationForm}>
              <form onSubmit={communicationForm.handleSubmit(handleCreateCommunication)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={communicationForm.control}
                    name="communicationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('communications.type')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="communication-type-select">
                              <SelectValue placeholder={t('communications.type')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {communicationTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={communicationForm.control}
                    name="direction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('communications.direction')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="communication-direction-select">
                              <SelectValue placeholder={t('communications.direction')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inbound">{t('communications.direction.inbound')}</SelectItem>
                            <SelectItem value="outbound">{t('communications.direction.outbound')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={communicationForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('communications.subject')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('communications.subject')} {...field} data-testid="communication-subject" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={communicationForm.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('communications.summary')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('communications.summary')} 
                          className="min-h-[100px]" 
                          {...field} 
                          data-testid="communication-summary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={communicationForm.control}
                    name="outcome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('communications.outcome')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('communications.outcome')} {...field} data-testid="communication-outcome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={communicationForm.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('communications.duration')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="communication-duration"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={communicationForm.control}
                  name="nextAction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('communications.nextAction')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('communications.nextAction')} {...field} data-testid="communication-next-action" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={communicationForm.control}
                  name="nextActionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('communications.nextActionDate')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          data-testid="communication-next-action-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCommunicationFormOpen(false)}
                    data-testid="cancel-communication-form"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createCommunicationMutation.isPending}
                    data-testid="submit-communication-form"
                  >
                    {createCommunicationMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {t('communications.log')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Task Form Dialog */}
        <Dialog open={taskFormOpen} onOpenChange={setTaskFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>{t('tasks.create')}</DialogTitle>
              <DialogDescription>
                Create task for {selectedLead?.firstName} {selectedLead?.lastName}
              </DialogDescription>
            </DialogHeader>

            <Form {...taskForm}>
              <form onSubmit={taskForm.handleSubmit(handleCreateTask)} className="space-y-4">
                <FormField
                  control={taskForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.taskTitle')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('tasks.taskTitle')} {...field} data-testid="task-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.taskDescription')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('tasks.taskDescription')} 
                          className="min-h-[100px]" 
                          {...field} 
                          data-testid="task-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="taskType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tasks.taskType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="task-type-select">
                              <SelectValue placeholder={t('tasks.taskType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {taskTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tasks.priority')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="task-priority-select">
                              <SelectValue placeholder={t('tasks.priority')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priorityLevels.map((priority) => (
                              <SelectItem key={priority.value} value={priority.value}>
                                {priority.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={taskForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.dueDate')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          data-testid="task-due-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setTaskFormOpen(false)}
                    data-testid="cancel-task-form"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTaskMutation.isPending}
                    data-testid="submit-task-form"
                  >
                    {createTaskMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {t('tasks.create')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Opportunity Form Dialog */}
        <Dialog open={opportunityFormOpen} onOpenChange={setOpportunityFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>{t('opportunities.create')}</DialogTitle>
              <DialogDescription>
                Create opportunity for {selectedLead?.firstName} {selectedLead?.lastName}
              </DialogDescription>
            </DialogHeader>

            <Form {...opportunityForm}>
              <form onSubmit={opportunityForm.handleSubmit(handleCreateOpportunity)} className="space-y-4">
                <FormField
                  control={opportunityForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('opportunities.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('opportunities.name')} {...field} data-testid="opportunity-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={opportunityForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('opportunities.description')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('opportunities.description')} 
                          className="min-h-[100px]" 
                          {...field} 
                          data-testid="opportunity-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={opportunityForm.control}
                    name="dealStageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('opportunities.stage')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="opportunity-stage-select">
                              <SelectValue placeholder={t('opportunities.stage')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dealStagesData?.map((stage: DealStage) => (
                              <SelectItem key={stage.id} value={stage.id.toString()}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={opportunityForm.control}
                    name="estimatedValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('opportunities.estimatedValue')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="opportunity-estimated-value"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={opportunityForm.control}
                    name="winProbability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('opportunities.winProbability')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0-100" 
                            {...field} 
                            data-testid="opportunity-win-probability"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={opportunityForm.control}
                    name="expectedCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('opportunities.expectedCloseDate')}</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder={t('opportunities.expectedCloseDate')}
                            testId="opportunity-expected-close-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={opportunityForm.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('opportunities.serviceType')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="opportunity-service-type-select">
                            <SelectValue placeholder={t('opportunities.serviceType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="individual">{t('opportunities.serviceType.individual')}</SelectItem>
                          <SelectItem value="corporate">{t('opportunities.serviceType.corporate')}</SelectItem>
                          <SelectItem value="franchise">{t('opportunities.serviceType.franchise')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setOpportunityFormOpen(false)}
                    data-testid="cancel-opportunity-form"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createOpportunityMutation.isPending}
                    data-testid="submit-opportunity-form"
                  >
                    {createOpportunityMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {t('opportunities.create')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}