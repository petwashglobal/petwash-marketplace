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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Mail, 
  MessageSquare,
  Clock,
  Send,
  Calendar,
  Users,
  TrendingUp,
  Activity,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Bell,
  Phone,
  User,
  FileText,
  CheckCircle,
  AlertTriangle,
  Star,
  Heart,
  Target,
  BarChart3,
  PieChart,
  Sparkles,
  Crown,
  Award,
  ArrowRight,
  Copy,
  ExternalLink,
  Zap,
  MousePointer,
  Building
} from "lucide-react";
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
  Legend
} from "recharts";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Type definitions
interface CommunicationStats {
  totalCommunications: number;
  emailsSent: number;
  smsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  smsDelivered: number;
  totalTemplatesUsed: number;
  activeReminders: number;
  completedReminders: number;
}

interface EmailTemplate {
  id: number;
  name: string;
  category: string;
  subject: string;
  content: string;
  isDefault: boolean;
  isActive: boolean;
  timesUsed: number;
  lastUsed?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SmsTemplate {
  id: number;
  name: string;
  category: string;
  content: string;
  characterCount: number;
  isDefault: boolean;
  isActive: boolean;
  timesUsed: number;
  lastUsed?: string;
  estimatedCost?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentReminder {
  id: number;
  customerId?: number;
  userId?: string;
  appointmentDate: string;
  reminderType: 'email' | 'sms' | 'both';
  scheduledSendTime: string;
  status: 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  isScheduled: boolean;
  isCancelled: boolean;
  templateId?: number;
  scheduledBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CommunicationLog {
  id: number;
  communicationId: number;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  opened: boolean;
  clicked: boolean;
  openedAt?: string;
  clickedAt?: string;
  openCount: number;
  clickCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// Form schemas
const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z.string().min(1, "Category is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  isDefault: z.boolean().optional(),
});

const smsTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z.string().min(1, "Category is required"),
  content: z.string().min(1, "Content is required").max(160, "SMS content cannot exceed 160 characters"),
  estimatedCost: z.string().optional(),
});

const appointmentReminderSchema = z.object({
  customerId: z.number().optional(),
  userId: z.string().optional(),
  appointmentDate: z.string().min(1, "Appointment date is required"),
  reminderType: z.enum(['email', 'sms', 'both']),
  scheduledSendTime: z.string().min(1, "Send time is required"),
  templateId: z.number().optional(),
});

const bulkEmailSchema = z.object({
  templateId: z.number().min(1, "Template is required"),
  recipients: z.array(z.object({
    email: z.string().email({ message: "Please enter a valid email address" }),
    leadId: z.number().optional(),
    customerId: z.number().optional(),
    userId: z.string().optional(),
  })).min(1, "At least one recipient required"),
  customData: z.record(z.any()).optional(),
});

export default function CommunicationCenter() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'email-templates' | 'sms-templates' | 'reminders' | 'history'>('dashboard');
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<EmailTemplate | null>(null);
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState<SmsTemplate | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<AppointmentReminder | null>(null);
  const [isCreateEmailDialogOpen, setIsCreateEmailDialogOpen] = useState(false);
  const [isCreateSmsDialogOpen, setIsCreateSmsDialogOpen] = useState(false);
  const [isCreateReminderDialogOpen, setIsCreateReminderDialogOpen] = useState(false);
  const [isBulkEmailDialogOpen, setIsBulkEmailDialogOpen] = useState(false);
  const [isBulkSmsDialogOpen, setIsBulkSmsDialogOpen] = useState(false);
  
  // Filters
  const [emailFilter, setEmailFilter] = useState({ category: '', isActive: '', search: '' });
  const [smsFilter, setSmsFilter] = useState({ category: '', isActive: '', search: '' });
  const [reminderFilter, setReminderFilter] = useState({ status: '', reminderType: '', search: '' });

  const { admin, isAuthenticated } = useAdminAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  // Auth check
  if (!isAuthenticated) {
    setLocation('/admin/login');
    return null;
  }

  // Data queries
  const { data: stats, isLoading: statsLoading } = useQuery<CommunicationStats>({
    queryKey: ['/api/crm/communications/stats'],
    refetchInterval: 30000,
  });

  const { data: emailTemplates = [], isLoading: emailTemplatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/crm/communications/email-templates', emailFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (emailFilter.category) params.append('category', emailFilter.category);
      if (emailFilter.isActive) params.append('isActive', emailFilter.isActive);
      
      const response = await fetch(`/api/crm/communications/email-templates?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch email templates');
      const data = await response.json();
      return data.templates || [];
    },
  });

  const { data: smsTemplates = [], isLoading: smsTemplatesLoading } = useQuery<SmsTemplate[]>({
    queryKey: ['/api/crm/communications/sms-templates', smsFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (smsFilter.category) params.append('category', smsFilter.category);
      if (smsFilter.isActive) params.append('isActive', smsFilter.isActive);
      
      const response = await fetch(`/api/crm/communications/sms-templates?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch SMS templates');
      const data = await response.json();
      return data.templates || [];
    },
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery<AppointmentReminder[]>({
    queryKey: ['/api/crm/communications/appointment-reminders', reminderFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (reminderFilter.status) params.append('status', reminderFilter.status);
      if (reminderFilter.reminderType) params.append('reminderType', reminderFilter.reminderType);
      
      const response = await fetch(`/api/crm/communications/appointment-reminders?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch appointment reminders');
      const data = await response.json();
      return data.reminders || [];
    },
  });

  // Form hooks
  const emailTemplateForm = useForm<z.infer<typeof emailTemplateSchema>>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: '',
      category: '',
      subject: '',
      content: '',
      isDefault: false,
    },
  });

  const smsTemplateForm = useForm<z.infer<typeof smsTemplateSchema>>({
    resolver: zodResolver(smsTemplateSchema),
    defaultValues: {
      name: '',
      category: '',
      content: '',
      estimatedCost: '',
    },
  });

  const appointmentReminderForm = useForm<z.infer<typeof appointmentReminderSchema>>({
    resolver: zodResolver(appointmentReminderSchema),
    defaultValues: {
      appointmentDate: '',
      reminderType: 'email',
      scheduledSendTime: '',
    },
  });

  const bulkEmailForm = useForm<z.infer<typeof bulkEmailSchema>>({
    resolver: zodResolver(bulkEmailSchema),
    defaultValues: {
      templateId: 0,
      recipients: [],
      customData: {},
    },
  });

  // Mutations
  const createEmailTemplateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailTemplateSchema>) => {
      const response = await apiRequest('POST', '/api/crm/communications/email-templates', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Email template created successfully" });
      setIsCreateEmailDialogOpen(false);
      emailTemplateForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications/email-templates'] });
    },
    onError: (error: any) => {
      toast({ title: "Error creating email template", description: error.message, variant: "destructive" });
    },
  });

  const createSmsTemplateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof smsTemplateSchema>) => {
      const response = await apiRequest('POST', '/api/crm/communications/sms-templates', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "SMS template created successfully" });
      setIsCreateSmsDialogOpen(false);
      smsTemplateForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications/sms-templates'] });
    },
    onError: (error: any) => {
      toast({ title: "Error creating SMS template", description: error.message, variant: "destructive" });
    },
  });

  const createAppointmentReminderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof appointmentReminderSchema>) => {
      const response = await apiRequest('POST', '/api/crm/communications/appointment-reminders', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment reminder scheduled successfully" });
      setIsCreateReminderDialogOpen(false);
      appointmentReminderForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications/appointment-reminders'] });
    },
    onError: (error: any) => {
      toast({ title: "Error scheduling appointment reminder", description: error.message, variant: "destructive" });
    },
  });

  const sendBulkEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bulkEmailSchema>) => {
      const response = await apiRequest('POST', '/api/crm/communications/bulk/send-email', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Bulk email campaign completed", 
        description: `${data.totalSent} emails sent, ${data.totalFailed} failed`
      });
      setIsBulkEmailDialogOpen(false);
      bulkEmailForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications/stats'] });
    },
    onError: (error: any) => {
      toast({ title: "Error sending bulk emails", description: error.message, variant: "destructive" });
    },
  });

  // Handler functions
  const handleCreateEmailTemplate = emailTemplateForm.handleSubmit((data) => {
    createEmailTemplateMutation.mutate(data);
  });

  const handleCreateSmsTemplate = smsTemplateForm.handleSubmit((data) => {
    createSmsTemplateMutation.mutate(data);
  });

  const handleCreateAppointmentReminder = appointmentReminderForm.handleSubmit((data) => {
    createAppointmentReminderMutation.mutate(data);
  });

  const handleSendBulkEmail = bulkEmailForm.handleSubmit((data) => {
    sendBulkEmailMutation.mutate(data);
  });

  // Chart data
  const communicationTrendData = [
    { month: 'Jan', emails: 150, sms: 80 },
    { month: 'Feb', emails: 200, sms: 120 },
    { month: 'Mar', emails: 180, sms: 100 },
    { month: 'Apr', emails: 250, sms: 140 },
    { month: 'May', emails: 220, sms: 160 },
    { month: 'Jun', emails: 300, sms: 200 },
  ];

  const engagementData = [
    { name: 'Opened', value: stats?.emailsOpened || 0, color: '#22c55e' },
    { name: 'Clicked', value: stats?.emailsClicked || 0, color: '#3b82f6' },
    { name: 'Unopened', value: (stats?.emailsSent || 0) - (stats?.emailsOpened || 0), color: '#e5e7eb' },
  ];

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{t('communication.title', 'Communication Center')}</h1>
                <p className="text-sm text-slate-600">{t('communication.subtitle', 'Manage communications, templates & reminders')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries()}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('common.refresh', 'Refresh')}
              </Button>
              <Button onClick={() => setLocation('/admin/dashboard')} variant="outline" data-testid="button-back">
                {t('common.back', 'Back to Admin')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-4xl" data-testid="tabs-communication-center">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">{t('communication.tabs.dashboard', 'Dashboard')}</TabsTrigger>
            <TabsTrigger value="email-templates" data-testid="tab-email-templates">{t('communication.tabs.emailTemplates', 'Email Templates')}</TabsTrigger>
            <TabsTrigger value="sms-templates" data-testid="tab-sms-templates">{t('communication.tabs.smsTemplates', 'SMS Templates')}</TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">{t('communication.tabs.reminders', 'Reminders')}</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">{t('communication.tabs.history', 'History')}</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card data-testid="card-total-communications">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('communication.stats.total', 'Total Communications')}</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-communications">{stats?.totalCommunications || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.emailsSent || 0} emails, {stats?.smsSent || 0} SMS
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-email-engagement">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('communication.stats.emailEngagement', 'Email Engagement')}</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-email-opened">{stats?.emailsOpened || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(((stats?.emailsOpened || 0) / (stats?.emailsSent || 1)) * 100)}% open rate
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-active-reminders">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('communication.stats.activeReminders', 'Active Reminders')}</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-active-reminders">{stats?.activeReminders || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.completedReminders || 0} completed this month
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-templates-used">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('communication.stats.templatesUsed', 'Templates Used')}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-templates-used">{stats?.totalTemplatesUsed || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all categories
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-communication-trends">
                <CardHeader>
                  <CardTitle>{t('communication.charts.trends', 'Communication Trends')}</CardTitle>
                  <CardDescription>Monthly email and SMS volumes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={communicationTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="emails" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="sms" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card data-testid="card-email-engagement-chart">
                <CardHeader>
                  <CardTitle>{t('communication.charts.engagement', 'Email Engagement')}</CardTitle>
                  <CardDescription>Open and click rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Tooltip />
                      <Legend />
                      <RechartsPieChart data={engagementData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5}>
                        {engagementData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </RechartsPieChart>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card data-testid="card-quick-actions">
              <CardHeader>
                <CardTitle>{t('communication.quickActions.title', 'Quick Actions')}</CardTitle>
                <CardDescription>Common communication tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    onClick={() => setIsBulkEmailDialogOpen(true)}
                    className="h-16 flex flex-col items-center justify-center space-y-2"
                    data-testid="button-send-bulk-email"
                  >
                    <Send className="w-5 h-5" />
                    <span>{t('communication.quickActions.sendBulkEmail', 'Send Bulk Email')}</span>
                  </Button>
                  <Button 
                    onClick={() => setIsBulkSmsDialogOpen(true)}
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center space-y-2"
                    data-testid="button-send-bulk-sms"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>{t('communication.quickActions.sendBulkSms', 'Send Bulk SMS')}</span>
                  </Button>
                  <Button 
                    onClick={() => setIsCreateReminderDialogOpen(true)}
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center space-y-2"
                    data-testid="button-create-reminder"
                  >
                    <Bell className="w-5 h-5" />
                    <span>{t('communication.quickActions.scheduleReminder', 'Schedule Reminder')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="email-templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{t('communication.emailTemplates.title', 'Email Templates')}</h2>
                <p className="text-slate-600">{t('communication.emailTemplates.subtitle', 'Manage email templates for different communication types')}</p>
              </div>
              <Button onClick={() => setIsCreateEmailDialogOpen(true)} data-testid="button-create-email-template">
                <Plus className="w-4 h-4 mr-2" />
                {t('communication.emailTemplates.create', 'Create Template')}
              </Button>
            </div>

            {/* Email Template Filters */}
            <Card data-testid="card-email-filters">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="email-search">{t('common.search', 'Search')}</Label>
                    <Input
                      id="email-search"
                      placeholder={t('communication.emailTemplates.searchPlaceholder', 'Search templates...')}
                      value={emailFilter.search}
                      onChange={(e) => setEmailFilter(prev => ({ ...prev, search: e.target.value }))}
                      data-testid="input-email-search"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-category">{t('common.category', 'Category')}</Label>
                    <Select 
                      value={emailFilter.category} 
                      onValueChange={(value) => setEmailFilter(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger data-testid="select-email-category">
                        <SelectValue placeholder={t('common.allCategories', 'All Categories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Categories</SelectItem>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="promotion">Promotion</SelectItem>
                        <SelectItem value="follow-up">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="email-status">{t('common.status', 'Status')}</Label>
                    <Select 
                      value={emailFilter.isActive} 
                      onValueChange={(value) => setEmailFilter(prev => ({ ...prev, isActive: value }))}
                    >
                      <SelectTrigger data-testid="select-email-status">
                        <SelectValue placeholder={t('common.allStatuses', 'All Statuses')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Templates Table */}
            <Card data-testid="card-email-templates-table">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name', 'Name')}</TableHead>
                      <TableHead>{t('common.category', 'Category')}</TableHead>
                      <TableHead>{t('communication.templates.subject', 'Subject')}</TableHead>
                      <TableHead>{t('communication.templates.timesUsed', 'Times Used')}</TableHead>
                      <TableHead>{t('common.status', 'Status')}</TableHead>
                      <TableHead>{t('common.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailTemplates
                      .filter(template => 
                        template.name.toLowerCase().includes(emailFilter.search.toLowerCase()) ||
                        template.subject.toLowerCase().includes(emailFilter.search.toLowerCase())
                      )
                      .map((template) => (
                      <TableRow key={template.id} data-testid={`row-email-template-${template.id}`}>
                        <TableCell className="font-medium">
                          {template.name}
                          {template.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                        <TableCell>{template.timesUsed}</TableCell>
                        <TableCell>
                          <Badge variant={template.isActive ? "default" : "secondary"}>
                            {template.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEmailTemplate(template)}
                              data-testid={`button-view-email-template-${template.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEmailTemplate(template);
                                toast({ 
                                  title: t('common.success', 'Success'),
                                  description: t('communication.emailTemplates.editMode', 'Template loaded for editing')
                                });
                              }}
                              data-testid={`button-edit-email-template-${template.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {emailTemplatesLoading && (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">{t('common.loading', 'Loading...')}</p>
                  </div>
                )}
                {!emailTemplatesLoading && emailTemplates.length === 0 && (
                  <div className="text-center py-8">
                    <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">{t('communication.emailTemplates.noTemplates', 'No email templates found')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Templates Tab */}
          <TabsContent value="sms-templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{t('communication.smsTemplates.title', 'SMS Templates')}</h2>
                <p className="text-slate-600">{t('communication.smsTemplates.subtitle', 'Manage SMS templates for different communication types')}</p>
              </div>
              <Button onClick={() => setIsCreateSmsDialogOpen(true)} data-testid="button-create-sms-template">
                <Plus className="w-4 h-4 mr-2" />
                {t('communication.smsTemplates.create', 'Create Template')}
              </Button>
            </div>

            {/* SMS Template Filters */}
            <Card data-testid="card-sms-filters">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="sms-search">{t('common.search', 'Search')}</Label>
                    <Input
                      id="sms-search"
                      placeholder={t('communication.smsTemplates.searchPlaceholder', 'Search templates...')}
                      value={smsFilter.search}
                      onChange={(e) => setSmsFilter(prev => ({ ...prev, search: e.target.value }))}
                      data-testid="input-sms-search"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sms-category">{t('common.category', 'Category')}</Label>
                    <Select 
                      value={smsFilter.category} 
                      onValueChange={(value) => setSmsFilter(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger data-testid="select-sms-category">
                        <SelectValue placeholder={t('common.allCategories', 'All Categories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Categories</SelectItem>
                        <SelectItem value="reminder">Reminder</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="promotion">Promotion</SelectItem>
                        <SelectItem value="notification">Notification</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sms-status">{t('common.status', 'Status')}</Label>
                    <Select 
                      value={smsFilter.isActive} 
                      onValueChange={(value) => setSmsFilter(prev => ({ ...prev, isActive: value }))}
                    >
                      <SelectTrigger data-testid="select-sms-status">
                        <SelectValue placeholder={t('common.allStatuses', 'All Statuses')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SMS Templates Table */}
            <Card data-testid="card-sms-templates-table">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name', 'Name')}</TableHead>
                      <TableHead>{t('common.category', 'Category')}</TableHead>
                      <TableHead>{t('communication.smsTemplates.content', 'Content')}</TableHead>
                      <TableHead>{t('communication.smsTemplates.characters', 'Characters')}</TableHead>
                      <TableHead>{t('communication.templates.timesUsed', 'Times Used')}</TableHead>
                      <TableHead>{t('common.status', 'Status')}</TableHead>
                      <TableHead>{t('common.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsTemplates
                      .filter(template => 
                        template.name.toLowerCase().includes(smsFilter.search.toLowerCase()) ||
                        template.content.toLowerCase().includes(smsFilter.search.toLowerCase())
                      )
                      .map((template) => (
                      <TableRow key={template.id} data-testid={`row-sms-template-${template.id}`}>
                        <TableCell className="font-medium">
                          {template.name}
                          {template.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{template.content}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm ${template.characterCount > 160 ? 'text-red-600' : 'text-slate-600'}`}>
                              {template.characterCount}/160
                            </span>
                            {template.characterCount > 160 && (
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{template.timesUsed}</TableCell>
                        <TableCell>
                          <Badge variant={template.isActive ? "default" : "secondary"}>
                            {template.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSmsTemplate(template)}
                              data-testid={`button-view-sms-template-${template.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSmsTemplate(template);
                                toast({ 
                                  title: t('common.success', 'Success'),
                                  description: t('communication.smsTemplates.editMode', 'SMS template loaded for editing')
                                });
                              }}
                              data-testid={`button-edit-sms-template-${template.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {smsTemplatesLoading && (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">{t('common.loading', 'Loading...')}</p>
                  </div>
                )}
                {!smsTemplatesLoading && smsTemplates.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">{t('communication.smsTemplates.noTemplates', 'No SMS templates found')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointment Reminders Tab */}
          <TabsContent value="reminders" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{t('communication.reminders.title', 'Appointment Reminders')}</h2>
                <p className="text-slate-600">{t('communication.reminders.subtitle', 'Manage automated appointment reminders')}</p>
              </div>
              <Button onClick={() => setIsCreateReminderDialogOpen(true)} data-testid="button-create-reminder">
                <Plus className="w-4 h-4 mr-2" />
                {t('communication.reminders.create', 'Schedule Reminder')}
              </Button>
            </div>

            {/* Reminder Filters */}
            <Card data-testid="card-reminder-filters">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="reminder-search">{t('common.search', 'Search')}</Label>
                    <Input
                      id="reminder-search"
                      placeholder={t('communication.reminders.searchPlaceholder', 'Search reminders...')}
                      value={reminderFilter.search}
                      onChange={(e) => setReminderFilter(prev => ({ ...prev, search: e.target.value }))}
                      data-testid="input-reminder-search"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reminder-status">{t('common.status', 'Status')}</Label>
                    <Select 
                      value={reminderFilter.status} 
                      onValueChange={(value) => setReminderFilter(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger data-testid="select-reminder-status">
                        <SelectValue placeholder={t('common.allStatuses', 'All Statuses')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reminder-type">{t('communication.reminders.type', 'Type')}</Label>
                    <Select 
                      value={reminderFilter.reminderType} 
                      onValueChange={(value) => setReminderFilter(prev => ({ ...prev, reminderType: value }))}
                    >
                      <SelectTrigger data-testid="select-reminder-type">
                        <SelectValue placeholder={t('communication.reminders.allTypes', 'All Types')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Types</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reminders Table */}
            <Card data-testid="card-reminders-table">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('communication.reminders.appointmentDate', 'Appointment Date')}</TableHead>
                      <TableHead>{t('communication.reminders.scheduledFor', 'Scheduled For')}</TableHead>
                      <TableHead>{t('communication.reminders.type', 'Type')}</TableHead>
                      <TableHead>{t('common.status', 'Status')}</TableHead>
                      <TableHead>{t('communication.reminders.customer', 'Customer')}</TableHead>
                      <TableHead>{t('common.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminders.map((reminder) => (
                      <TableRow key={reminder.id} data-testid={`row-reminder-${reminder.id}`}>
                        <TableCell className="font-medium">
                          {new Date(reminder.appointmentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(reminder.scheduledSendTime).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reminder.reminderType.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              reminder.status === 'delivered' ? 'default' :
                              reminder.status === 'failed' ? 'destructive' :
                              reminder.status === 'cancelled' ? 'secondary' : 'outline'
                            }
                          >
                            {reminder.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {reminder.customerId ? `Customer #${reminder.customerId}` : 
                           reminder.userId ? `User ${reminder.userId}` : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReminder(reminder)}
                              data-testid={`button-view-reminder-${reminder.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {reminder.status === 'scheduled' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/communication/reminders/${reminder.id}`, {
                                      method: 'DELETE',
                                    });
                                    toast({ 
                                      title: t('common.success', 'Success'),
                                      description: t('communication.reminders.cancelled', 'Reminder cancelled successfully')
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['/api/communication/reminders'] });
                                  } catch (error) {
                                    toast({ 
                                      title: t('common.error', 'Error'),
                                      description: t('communication.reminders.cancelError', 'Failed to cancel reminder'),
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                data-testid={`button-cancel-reminder-${reminder.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {remindersLoading && (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">{t('common.loading', 'Loading...')}</p>
                  </div>
                )}
                {!remindersLoading && reminders.length === 0 && (
                  <div className="text-center py-8">
                    <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">{t('communication.reminders.noReminders', 'No appointment reminders found')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{t('communication.history.title', 'Communication History')}</h2>
              <p className="text-slate-600">{t('communication.history.subtitle', 'View all communication interactions and logs')}</p>
            </div>

            <Card data-testid="card-communication-history">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">{t('communication.history.comingSoon', 'Communication history functionality coming soon')}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Email Template Dialog */}
      <Dialog open={isCreateEmailDialogOpen} onOpenChange={setIsCreateEmailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-create-email-template">
          <DialogHeader>
            <DialogTitle>{t('communication.emailTemplates.create', 'Create Email Template')}</DialogTitle>
            <DialogDescription>
              Create a new email template for your communication campaigns.
            </DialogDescription>
          </DialogHeader>
          <Form {...emailTemplateForm}>
            <form onSubmit={handleCreateEmailTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={emailTemplateForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name', 'Name')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('communication.emailTemplates.namePlaceholder', 'Template name...')} 
                          {...field} 
                          data-testid="input-email-template-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailTemplateForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.category', 'Category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-email-template-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="welcome">Welcome</SelectItem>
                          <SelectItem value="appointment">Appointment</SelectItem>
                          <SelectItem value="promotion">Promotion</SelectItem>
                          <SelectItem value="follow-up">Follow-up</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={emailTemplateForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.emailTemplates.subject', 'Subject')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('communication.emailTemplates.subjectPlaceholder', 'Email subject...')} 
                        {...field} 
                        data-testid="input-email-template-subject"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={emailTemplateForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.emailTemplates.content', 'Content')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('communication.emailTemplates.contentPlaceholder', 'Email content...')}
                        className="min-h-[150px]"
                        {...field}
                        data-testid="textarea-email-template-content"
                      />
                    </FormControl>
                    <FormDescription>
                      Use placeholders like {`{{customerName}}, {{petName}}, {{appointmentDate}}`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={emailTemplateForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('communication.templates.setAsDefault', 'Set as Default Template')}
                      </FormLabel>
                      <FormDescription>
                        This template will be used as the default for this category.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-email-template-default"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateEmailDialogOpen(false)}
                  data-testid="button-cancel-email-template"
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEmailTemplateMutation.isPending}
                  data-testid="button-save-email-template"
                >
                  {createEmailTemplateMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create SMS Template Dialog */}
      <Dialog open={isCreateSmsDialogOpen} onOpenChange={setIsCreateSmsDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-create-sms-template">
          <DialogHeader>
            <DialogTitle>{t('communication.smsTemplates.create', 'Create SMS Template')}</DialogTitle>
            <DialogDescription>
              Create a new SMS template for your communication campaigns.
            </DialogDescription>
          </DialogHeader>
          <Form {...smsTemplateForm}>
            <form onSubmit={handleCreateSmsTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={smsTemplateForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name', 'Name')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('communication.smsTemplates.namePlaceholder', 'Template name...')} 
                          {...field} 
                          data-testid="input-sms-template-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={smsTemplateForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.category', 'Category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-sms-template-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="reminder">Reminder</SelectItem>
                          <SelectItem value="appointment">Appointment</SelectItem>
                          <SelectItem value="promotion">Promotion</SelectItem>
                          <SelectItem value="notification">Notification</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={smsTemplateForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.smsTemplates.content', 'Content')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('communication.smsTemplates.contentPlaceholder', 'SMS content...')}
                        className="min-h-[100px]"
                        maxLength={160}
                        {...field}
                        data-testid="textarea-sms-template-content"
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/160 characters. Use placeholders like {`{{customerName}}, {{appointmentTime}}`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={smsTemplateForm.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.smsTemplates.estimatedCost', 'Estimated Cost')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0.05" 
                        {...field} 
                        data-testid="input-sms-template-cost"
                      />
                    </FormControl>
                    <FormDescription>
                      Cost per SMS in your local currency
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateSmsDialogOpen(false)}
                  data-testid="button-cancel-sms-template"
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createSmsTemplateMutation.isPending}
                  data-testid="button-save-sms-template"
                >
                  {createSmsTemplateMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Appointment Reminder Dialog */}
      <Dialog open={isCreateReminderDialogOpen} onOpenChange={setIsCreateReminderDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-create-reminder">
          <DialogHeader>
            <DialogTitle>{t('communication.reminders.create', 'Schedule Appointment Reminder')}</DialogTitle>
            <DialogDescription>
              Schedule an automatic reminder for an upcoming appointment.
            </DialogDescription>
          </DialogHeader>
          <Form {...appointmentReminderForm}>
            <form onSubmit={handleCreateAppointmentReminder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={appointmentReminderForm.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('communication.reminders.customerId', 'Customer ID')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          placeholder="123" 
                          value={field.value || ''} 
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-reminder-customer-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={appointmentReminderForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('communication.reminders.userId', 'User ID')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="user123" 
                          {...field} 
                          data-testid="input-reminder-user-id"
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty if using Customer ID
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={appointmentReminderForm.control}
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.reminders.appointmentDate', 'Appointment Date')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local"
                        {...field} 
                        data-testid="input-reminder-appointment-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={appointmentReminderForm.control}
                name="scheduledSendTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.reminders.scheduledSendTime', 'Send Reminder At')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local"
                        {...field} 
                        data-testid="input-reminder-send-time"
                      />
                    </FormControl>
                    <FormDescription>
                      When should the reminder be sent?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={appointmentReminderForm.control}
                name="reminderType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communication.reminders.type', 'Reminder Type')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-reminder-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">Email Only</SelectItem>
                        <SelectItem value="sms">SMS Only</SelectItem>
                        <SelectItem value="both">Both Email & SMS</SelectItem>
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
                  onClick={() => setIsCreateReminderDialogOpen(false)}
                  data-testid="button-cancel-reminder"
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAppointmentReminderMutation.isPending}
                  data-testid="button-save-reminder"
                >
                  {createAppointmentReminderMutation.isPending ? t('common.scheduling', 'Scheduling...') : t('communication.reminders.schedule', 'Schedule')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Email Dialog */}
      <Dialog open={isBulkEmailDialogOpen} onOpenChange={setIsBulkEmailDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-bulk-email">
          <DialogHeader>
            <DialogTitle>{t('communication.bulkEmail.title', 'Send Bulk Email Campaign')}</DialogTitle>
            <DialogDescription>
              Send emails to multiple recipients using a template.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <Send className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">{t('communication.bulkEmail.comingSoon', 'Bulk email functionality coming soon')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk SMS Dialog */}
      <Dialog open={isBulkSmsDialogOpen} onOpenChange={setIsBulkSmsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-bulk-sms">
          <DialogHeader>
            <DialogTitle>{t('communication.bulkSms.title', 'Send Bulk SMS Campaign')}</DialogTitle>
            <DialogDescription>
              Send SMS messages to multiple recipients using a template.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">{t('communication.bulkSms.comingSoon', 'Bulk SMS functionality coming soon')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Template Preview Dialog */}
      <Dialog open={!!selectedEmailTemplate} onOpenChange={() => setSelectedEmailTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-preview-email-template">
          <DialogHeader>
            <DialogTitle>{t('communication.emailTemplates.preview', 'Email Template Preview')}</DialogTitle>
          </DialogHeader>
          {selectedEmailTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('common.name', 'Name')}</Label>
                <p className="text-slate-900" data-testid="text-preview-email-name">{selectedEmailTemplate.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('common.category', 'Category')}</Label>
                <Badge variant="outline" className="ml-2">{selectedEmailTemplate.category}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.emailTemplates.subject', 'Subject')}</Label>
                <p className="text-slate-900" data-testid="text-preview-email-subject">{selectedEmailTemplate.subject}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.emailTemplates.content', 'Content')}</Label>
                <div className="mt-2 p-4 border rounded-lg bg-slate-50 text-slate-900 whitespace-pre-wrap" data-testid="text-preview-email-content">
                  {selectedEmailTemplate.content}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Used {selectedEmailTemplate.timesUsed} times</span>
                <span>Created {new Date(selectedEmailTemplate.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SMS Template Preview Dialog */}
      <Dialog open={!!selectedSmsTemplate} onOpenChange={() => setSelectedSmsTemplate(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-preview-sms-template">
          <DialogHeader>
            <DialogTitle>{t('communication.smsTemplates.preview', 'SMS Template Preview')}</DialogTitle>
          </DialogHeader>
          {selectedSmsTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('common.name', 'Name')}</Label>
                <p className="text-slate-900" data-testid="text-preview-sms-name">{selectedSmsTemplate.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('common.category', 'Category')}</Label>
                <Badge variant="outline" className="ml-2">{selectedSmsTemplate.category}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.smsTemplates.content', 'Content')}</Label>
                <div className="mt-2 p-4 border rounded-lg bg-slate-50 text-slate-900" data-testid="text-preview-sms-content">
                  {selectedSmsTemplate.content}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>{selectedSmsTemplate.characterCount}/160 characters</span>
                <span>Used {selectedSmsTemplate.timesUsed} times</span>
              </div>
              {selectedSmsTemplate.estimatedCost && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t('communication.smsTemplates.estimatedCost', 'Estimated Cost')}</Label>
                  <p className="text-slate-900">{selectedSmsTemplate.estimatedCost} per SMS</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder Preview Dialog */}
      <Dialog open={!!selectedReminder} onOpenChange={() => setSelectedReminder(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-preview-reminder">
          <DialogHeader>
            <DialogTitle>{t('communication.reminders.preview', 'Appointment Reminder Details')}</DialogTitle>
          </DialogHeader>
          {selectedReminder && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.reminders.appointmentDate', 'Appointment Date')}</Label>
                <p className="text-slate-900" data-testid="text-preview-reminder-appointment-date">
                  {new Date(selectedReminder.appointmentDate).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.reminders.scheduledFor', 'Scheduled Send Time')}</Label>
                <p className="text-slate-900" data-testid="text-preview-reminder-send-time">
                  {new Date(selectedReminder.scheduledSendTime).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.reminders.type', 'Reminder Type')}</Label>
                <Badge variant="outline" className="ml-2">{selectedReminder.reminderType.toUpperCase()}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('common.status', 'Status')}</Label>
                <Badge 
                  variant={
                    selectedReminder.status === 'delivered' ? 'default' :
                    selectedReminder.status === 'failed' ? 'destructive' :
                    selectedReminder.status === 'cancelled' ? 'secondary' : 'outline'
                  }
                  className="ml-2"
                >
                  {selectedReminder.status}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t('communication.reminders.customer', 'Target')}</Label>
                <p className="text-slate-900">
                  {selectedReminder.customerId ? `Customer #${selectedReminder.customerId}` : 
                   selectedReminder.userId ? `User ${selectedReminder.userId}` : 'Unknown'}
                </p>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Created {new Date(selectedReminder.createdAt).toLocaleDateString()}</span>
                {selectedReminder.isCancelled && <span className="text-red-600">Cancelled</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}