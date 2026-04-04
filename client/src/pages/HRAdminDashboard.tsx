import { useState } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileText,
  MapPin,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Users,
  TrendingUp,
  Shield,
  Eye,
  Phone,
  Mail,
  Filter,
  RefreshCw,
  Search,
  ChevronDown,
  Loader2,
  AlertCircle,
  Zap,
  Brain,
  Settings
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const statusConfig: Record<string, { color: string; bgColor: string; icon: any; label: string; labelHe: string }> = {
  draft: { color: 'text-gray-600', bgColor: 'bg-white', icon: FileText, label: 'Draft', labelHe: 'טיוטה' },
  pending: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Clock, label: 'Pending', labelHe: 'ממתין' },
  under_review: { color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Eye, label: 'Under Review', labelHe: 'בבדיקה' },
  documents_required: { color: 'text-orange-600', bgColor: 'bg-orange-100', icon: FileText, label: 'Docs Required', labelHe: 'נדרשים מסמכים' },
  background_check: { color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: Shield, label: 'Background Check', labelHe: 'בדיקת רקע' },
  interview_scheduled: { color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Calendar, label: 'Interview', labelHe: 'ראיון' },
  approved: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircle2, label: 'Approved', labelHe: 'אושר' },
  rejected: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle, label: 'Rejected', labelHe: 'נדחה' },
  withdrawn: { color: 'text-gray-500', bgColor: 'bg-white', icon: XCircle, label: 'Withdrawn', labelHe: 'נמשך' },
};

const roleColors: Record<string, string> = {
  walker: 'from-pink-500 to-rose-600',
  driver: 'from-blue-500 to-indigo-600',
  sitter: 'from-purple-500 to-violet-600',
  host: 'from-amber-500 to-orange-600',
  supplier: 'from-emerald-500 to-teal-600',
  admin: 'from-slate-500 to-gray-600',
  trainer: 'from-yellow-500 to-amber-600',
};

interface Application {
  id: number;
  applicationId: string;
  positionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  applicationType: string;
  status: string;
  reviewStage: string | null;
  fraudRiskScore: number | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  positionTitle: string;
  positionTitleHe: string | null;
  positionLocation: string;
}

interface Stats {
  total: number;
  recentCount: number;
  highRiskCount: number;
  statusBreakdown: Record<string, number>;
  roleTypeBreakdown: Record<string, number>;
}

interface ApplicationsResponse {
  applications: Application[];
  total: number;
  statusCounts: Record<string, number>;
}

export default function HRAdminDashboard() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['/api/careers/admin/stats'],
  });
  
  const { data: applicationsData, isLoading: appsLoading, refetch } = useQuery<ApplicationsResponse>({
    queryKey: ['/api/careers/admin/applications', statusFilter, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (roleFilter !== 'all') params.append('roleType', roleFilter);
      const response = await fetch(getApiUrl(`/api/careers/admin/applications?${params}`));
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json();
    },
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest('PATCH', `/api/careers/admin/applications/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isRTL ? 'סטטוס עודכן' : 'Status Updated',
        description: isRTL ? 'סטטוס המועמדות עודכן בהצלחה' : 'Application status updated successfully',
      });
      setShowDetails(false);
      setSelectedApplication(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/careers/admin/stats'] });
    },
    onError: () => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: isRTL ? 'עדכון הסטטוס נכשל' : 'Failed to update status',
        variant: 'destructive',
      });
    },
  });
  
  const bulkShortlistMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/careers/admin/applications/bulk-shortlist', {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: isRTL ? 'סינון חכם הושלם' : 'Smart Shortlisting Complete',
        description: isRTL 
          ? `עובדו ${data.processed} מועמדויות: ${data.shortlisted} ברשימה מקוצרת, ${data.rejected} נדחו, ${data.manualReview} לבדיקה ידנית`
          : `Processed ${data.processed} applications: ${data.shortlisted} shortlisted, ${data.rejected} rejected, ${data.manualReview} for manual review`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/careers/admin/stats'] });
    },
    onError: () => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: isRTL ? 'הסינון החכם נכשל' : 'Failed to run smart shortlisting',
        variant: 'destructive',
      });
    },
  });
  
  const shortlistSingleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/careers/admin/applications/${id}/shortlist`, {});
      return response.json();
    },
    onSuccess: (data: any) => {
      const recommendation = data.recommendation === 'shortlist' 
        ? (isRTL ? 'ברשימה מקוצרת' : 'Shortlisted')
        : data.recommendation === 'reject'
        ? (isRTL ? 'נדחה' : 'Rejected')
        : (isRTL ? 'נדרשת בדיקה ידנית' : 'Manual Review Required');
      
      toast({
        title: isRTL ? 'סינון הושלם' : 'Shortlisting Complete',
        description: `${recommendation} (${isRTL ? 'ציון' : 'Score'}: ${data.score}%)`,
      });
      setShowDetails(false);
      refetch();
    },
    onError: () => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: isRTL ? 'הסינון נכשל' : 'Failed to process shortlisting',
        variant: 'destructive',
      });
    },
  });
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const handleViewDetails = (app: Application) => {
    setSelectedApplication(app);
    setNewStatus(app.status);
    setShowDetails(true);
  };
  
  const handleUpdateStatus = () => {
    if (!selectedApplication || !newStatus) return;
    updateStatusMutation.mutate({ id: selectedApplication.id, status: newStatus });
  };

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isRTL ? 'לוח בקרה HR' : 'HR Admin Dashboard'}
              </h1>
              <p className="text-gray-600 text-sm">
                {isRTL ? 'ניהול מועמדויות ⁦Pet Wash™⁩' : '⁦Pet Wash™⁩ Application Management'}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin/jobs">
                <Button variant="outline" data-testid="button-manage-jobs">
                  <Settings className="w-4 h-4 me-2" />
                  {isRTL ? 'ניהול משרות' : 'Manage Jobs'}
                </Button>
              </Link>
              <Button 
                onClick={() => bulkShortlistMutation.mutate()}
                disabled={bulkShortlistMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                data-testid="button-bulk-shortlist"
              >
                {bulkShortlistMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                ) : (
                  <Brain className="w-4 h-4 me-2" />
                )}
                {isRTL ? 'סינון חכם' : 'Smart Shortlist'}
              </Button>
              <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh-all">
                <RefreshCw className="w-4 h-4 me-2" />
                {isRTL ? 'רענן' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Stats Cards */}
      <section className="py-6">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-stat-total">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{isRTL ? 'סה"כ מועמדויות' : 'Total Applications'}</p>
                    <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-stat-recent">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{isRTL ? '7 ימים אחרונים' : 'Last 7 Days'}</p>
                    <p className="text-3xl font-bold text-gray-900">{stats?.recentCount || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-stat-pending">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{isRTL ? 'ממתינים לבדיקה' : 'Pending Review'}</p>
                    <p className="text-3xl font-bold text-gray-900">{stats?.statusBreakdown?.pending || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-stat-high-risk">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{isRTL ? 'סיכון גבוה' : 'High Risk'}</p>
                    <p className="text-3xl font-bold text-red-600">{stats?.highRiskCount || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Filters & Applications Table */}
      <section className="pb-12">
        <div className="container mx-auto px-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle>{isRTL ? 'כל המועמדויות' : 'All Applications'}</CardTitle>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40" data-testid="select-status-filter">
                      <Filter className="w-4 h-4 me-2" />
                      <SelectValue placeholder={isRTL ? 'סטטוס' : 'Status'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? 'כל הסטטוסים' : 'All Statuses'}</SelectItem>
                      <SelectItem value="pending">{isRTL ? 'ממתין' : 'Pending'}</SelectItem>
                      <SelectItem value="under_review">{isRTL ? 'בבדיקה' : 'Under Review'}</SelectItem>
                      <SelectItem value="approved">{isRTL ? 'אושר' : 'Approved'}</SelectItem>
                      <SelectItem value="rejected">{isRTL ? 'נדחה' : 'Rejected'}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-40" data-testid="select-role-filter">
                      <Briefcase className="w-4 h-4 me-2" />
                      <SelectValue placeholder={isRTL ? 'תפקיד' : 'Role'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? 'כל התפקידים' : 'All Roles'}</SelectItem>
                      <SelectItem value="walker">{isRTL ? 'מטייל' : 'Walker'}</SelectItem>
                      <SelectItem value="driver">{isRTL ? 'נהג' : 'Driver'}</SelectItem>
                      <SelectItem value="sitter">{isRTL ? 'שומר חיות' : 'Sitter'}</SelectItem>
                      <SelectItem value="host">{isRTL ? 'מארח' : 'Host'}</SelectItem>
                      <SelectItem value="supplier">{isRTL ? 'ספק' : 'Supplier'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {appsLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
                  <p className="text-gray-600">{isRTL ? 'טוען מועמדויות...' : 'Loading applications...'}</p>
                </div>
              ) : !applicationsData?.applications?.length ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">{isRTL ? 'לא נמצאו מועמדויות' : 'No applications found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 text-sm font-medium text-gray-500">{isRTL ? 'מועמד' : 'Applicant'}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{isRTL ? 'משרה' : 'Position'}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{isRTL ? 'סטטוס' : 'Status'}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{isRTL ? 'סיכון' : 'Risk'}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{isRTL ? 'תאריך' : 'Date'}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{isRTL ? 'פעולות' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {applicationsData.applications.map((app, index) => {
                          const status = statusConfig[app.status] || statusConfig.pending;
                          const StatusIcon = status.icon;
                          const riskLevel = app.fraudRiskScore !== null 
                            ? app.fraudRiskScore >= 50 ? 'high' : app.fraudRiskScore >= 25 ? 'medium' : 'low'
                            : 'low';
                          
                          return (
                            <motion.tr
                              key={app.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b hover:bg-white"
                              data-testid={`row-application-${app.id}`}
                            >
                              <td className="py-4">
                                <div>
                                  <p className="font-medium text-gray-900">{app.firstName} {app.lastName}</p>
                                  <p className="text-sm text-gray-500">{app.email}</p>
                                </div>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${roleColors[app.applicationType] || 'from-gray-400 to-gray-500'}`} />
                                  <span className="text-sm">{isRTL ? app.positionTitleHe || app.positionTitle : app.positionTitle}</span>
                                </div>
                              </td>
                              <td className="py-4">
                                <Badge className={`${status.bgColor} ${status.color} border-0`}>
                                  <StatusIcon className="w-3 h-3 me-1" />
                                  {isRTL ? status.labelHe : status.label}
                                </Badge>
                              </td>
                              <td className="py-4">
                                <Badge 
                                  variant="outline"
                                  className={
                                    riskLevel === 'high' ? 'border-red-300 text-red-600 bg-red-50' :
                                    riskLevel === 'medium' ? 'border-amber-300 text-amber-600 bg-white' :
                                    'border-green-300 text-green-600 bg-green-50'
                                  }
                                >
                                  {riskLevel === 'high' ? (isRTL ? 'גבוה' : 'High') :
                                   riskLevel === 'medium' ? (isRTL ? 'בינוני' : 'Medium') :
                                   (isRTL ? 'נמוך' : 'Low')}
                                </Badge>
                              </td>
                              <td className="py-4 text-sm text-gray-600">
                                {formatDate(app.submittedAt || app.createdAt)}
                              </td>
                              <td className="py-4">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleViewDetails(app)}
                                  data-testid={`button-view-${app.id}`}
                                >
                                  <Eye className="w-4 h-4 me-1" />
                                  {isRTL ? 'צפה' : 'View'}
                                </Button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
              
              {applicationsData && (
                <div className="mt-4 text-sm text-gray-500 text-center">
                  {isRTL 
                    ? `מציג ${applicationsData.applications.length} מתוך ${applicationsData.total} מועמדויות`
                    : `Showing ${applicationsData.applications.length} of ${applicationsData.total} applications`}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      
      {/* Application Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isRTL ? 'פרטי מועמדות' : 'Application Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedApplication?.applicationId}
            </DialogDescription>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">{isRTL ? 'שם מלא' : 'Full Name'}</Label>
                  <p className="font-medium">{selectedApplication.firstName} {selectedApplication.lastName}</p>
                </div>
                <div>
                  <Label className="text-gray-500">{isRTL ? 'משרה' : 'Position'}</Label>
                  <p className="font-medium">{isRTL ? selectedApplication.positionTitleHe || selectedApplication.positionTitle : selectedApplication.positionTitle}</p>
                </div>
                <div>
                  <Label className="text-gray-500">{isRTL ? 'אימייל' : 'Email'}</Label>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {selectedApplication.email}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">{isRTL ? 'טלפון' : 'Phone'}</Label>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {selectedApplication.phone}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">{isRTL ? 'עיר' : 'City'}</Label>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedApplication.city}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">{isRTL ? 'ציון סיכון' : 'Risk Score'}</Label>
                  <p className={`font-medium ${
                    (selectedApplication.fraudRiskScore || 0) >= 50 ? 'text-red-600' :
                    (selectedApplication.fraudRiskScore || 0) >= 25 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {selectedApplication.fraudRiskScore || 0}%
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-gray-500">{isRTL ? 'סינון חכם' : 'Smart Shortlisting'}</Label>
                  <Button
                    onClick={() => shortlistSingleMutation.mutate(selectedApplication.id)}
                    disabled={shortlistSingleMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    data-testid="button-shortlist-single"
                  >
                    {shortlistSingleMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <Brain className="w-4 h-4 me-2" />
                    )}
                    {isRTL ? 'הפעל סינון חכם' : 'Run Smart Shortlist'}
                  </Button>
                </div>
                
                <Label className="text-gray-500 mb-2 block">{isRTL ? 'עדכן סטטוס' : 'Update Status'}</Label>
                <div className="flex gap-3">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="flex-1" data-testid="select-new-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{isRTL ? 'ממתין' : 'Pending'}</SelectItem>
                      <SelectItem value="under_review">{isRTL ? 'בבדיקה' : 'Under Review'}</SelectItem>
                      <SelectItem value="documents_required">{isRTL ? 'נדרשים מסמכים' : 'Documents Required'}</SelectItem>
                      <SelectItem value="background_check">{isRTL ? 'בדיקת רקע' : 'Background Check'}</SelectItem>
                      <SelectItem value="interview_scheduled">{isRTL ? 'ראיון נקבע' : 'Interview Scheduled'}</SelectItem>
                      <SelectItem value="approved">{isRTL ? 'אושר' : 'Approved'}</SelectItem>
                      <SelectItem value="rejected">{isRTL ? 'נדחה' : 'Rejected'}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={handleUpdateStatus}
                    disabled={updateStatusMutation.isPending || newStatus === selectedApplication.status}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-update-status"
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      isRTL ? 'עדכן' : 'Update'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
