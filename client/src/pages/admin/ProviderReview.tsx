import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Shield,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  AlertTriangle,
  Eye,
  Download,
  RefreshCw,
  Loader2,
  ArrowRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Applicant {
  id: number;
  firebaseUid: string;
  stage: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  serviceTypes: string[];
  submittedAt: string;
  lastUpdatedAt: string;
}

interface ApplicantDetails extends Applicant {
  dateOfBirth: string;
  nationalId: string;
  streetAddress: string;
  postalCode: string;
  preferredPetTypes: string[];
  languagesSpoken: string[];
  yearsExperience: number;
  bio: string;
  serviceRadius: number;
  maxPetsAtOnce: number;
  hasTransportation: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  rejectionReason: string | null;
  documents: Array<{
    id: number;
    documentType: string;
    fileName: string;
    fileUrl: string;
    verificationStatus: string;
    rejectionReason: string | null;
    uploadedAt: string;
  }>;
  backgroundChecks: Array<{
    id: number;
    checkType: string;
    status: string;
    resultStatus: string | null;
    notes: string;
    initiatedAt: string;
    completedAt: string | null;
  }>;
  stageTransitions: Array<{
    id: number;
    fromStage: string | null;
    toStage: string;
    transitionedAt: string;
    performedBy: string;
    notes: string;
  }>;
}

const stageLabels: Record<string, { en: string; he: string }> = {
  application_submitted: { en: 'Application Submitted', he: 'בקשה הוגשה' },
  documents_pending: { en: 'Documents Pending', he: 'ממתין למסמכים' },
  documents_under_review: { en: 'Documents Under Review', he: 'מסמכים בבדיקה' },
  background_check_pending: { en: 'Background Check Pending', he: 'בדיקת רקע ממתינה' },
  background_check_complete: { en: 'Background Check Complete', he: 'בדיקת רקע הושלמה' },
  admin_final_review: { en: 'Admin Final Review', he: 'בדיקה סופית' },
  approved: { en: 'Approved', he: 'אושר' },
  rejected: { en: 'Rejected', he: 'נדחה' },
  withdrawn: { en: 'Withdrawn', he: 'נמשך' },
};

const stageColors: Record<string, string> = {
  application_submitted: 'bg-blue-100 text-blue-700',
  documents_pending: 'bg-yellow-100 text-yellow-700',
  documents_under_review: 'bg-purple-100 text-purple-700',
  background_check_pending: 'bg-orange-100 text-orange-700',
  background_check_complete: 'bg-teal-100 text-teal-700',
  admin_final_review: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-700',
};

export default function ProviderReview() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantDetails | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Management Approval Checklist (2026 Spec)
  const [checkIdVerified, setCheckIdVerified] = useState(false);
  const [checkDocumentsReviewed, setCheckDocumentsReviewed] = useState(false);
  const [checkDeclarationsComplete, setCheckDeclarationsComplete] = useState(false);
  const [checkInsuranceValid, setCheckInsuranceValid] = useState(false);
  const [checkLicenseValid, setCheckLicenseValid] = useState(false);
  const [checkCertificationsValid, setCheckCertificationsValid] = useState(false);
  const [checkBackgroundClear, setCheckBackgroundClear] = useState(false);
  const [checkApprovalNotes, setCheckApprovalNotes] = useState('');
  
  // Reset checklist when applicant changes
  const resetApprovalChecklist = () => {
    setCheckIdVerified(false);
    setCheckDocumentsReviewed(false);
    setCheckDeclarationsComplete(false);
    setCheckInsuranceValid(false);
    setCheckLicenseValid(false);
    setCheckCertificationsValid(false);
    setCheckBackgroundClear(false);
    setCheckApprovalNotes('');
  };

  const { data: listResponse, isLoading } = useQuery<{ applications: Applicant[]; counts: Record<string, number>; pagination: { limit: number; offset: number } }>({
    queryKey: ['/api/provider-applications/admin/list', filterStage],
  });
  const applicants: Applicant[] = listResponse?.applications || [];

  const detailUrl = selectedApplicant ? `/api/provider-applications/admin/${selectedApplicant.id}` : '';
  const { data: detailResponse, isLoading: isLoadingDetails } = useQuery<{ application: ApplicantDetails; documents: any[]; tasks: any[]; backgroundChecks: any[]; transitions: any[] }>({
    queryKey: [detailUrl],
    enabled: !!selectedApplicant && !!detailUrl,
  });
  const applicantDetails: ApplicantDetails | null = detailResponse ? {
    ...detailResponse.application,
    documents: detailResponse.documents || [],
    backgroundChecks: detailResponse.backgroundChecks || [],
    stageTransitions: detailResponse.transitions || [],
  } as ApplicantDetails : null;

  const advanceStageMutation = useMutation({
    mutationFn: async (applicantId: number) => {
      const response = await apiRequest('POST', `/api/provider-applications/admin/${applicantId}/advance-stage`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-applications/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-applications/admin'] });
      toast({
        title: isHebrew ? 'השלב עודכן' : 'Stage Advanced',
        description: isHebrew ? 'המועמד הועבר לשלב הבא.' : 'Applicant moved to next stage.',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (applicantId: number) => {
      const response = await apiRequest('POST', `/api/provider-applications/admin/${applicantId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-applications/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-applications/admin'] });
      setSelectedApplicant(null);
      toast({
        title: isHebrew ? 'מועמד אושר!' : 'Applicant Approved!',
        description: isHebrew ? 'הזמנה תישלח למועמד.' : 'An invitation will be sent to the applicant.',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ applicantId, reason }: { applicantId: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/provider-applications/admin/${applicantId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-applications/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-applications/admin'] });
      setSelectedApplicant(null);
      setShowRejectDialog(false);
      setRejectionReason('');
      toast({
        title: isHebrew ? 'מועמד נדחה' : 'Applicant Rejected',
        description: isHebrew ? 'המועמד קיבל הודעה על הדחייה.' : 'The applicant has been notified.',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredApplicants = applicants.filter(a => {
    const matchesSearch = 
      a.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = filterStage === 'all' || a.stage === filterStage;
    return matchesSearch && matchesStage;
  });

  const pendingReviewCount = applicants.filter(a => 
    ['documents_under_review', 'admin_final_review'].includes(a.stage)
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isHebrew ? 'ניהול בקשות ספקים' : 'Provider Applications'}
            </h1>
            <p className="text-gray-500 mt-1">
              {isHebrew ? 'סקור ואשר מועמדים חדשים' : 'Review and approve new applicants'}
            </p>
          </div>
          {pendingReviewCount > 0 && (
            <Badge className="bg-red-500 text-white px-3 py-1.5 text-sm">
              {pendingReviewCount} {isHebrew ? 'ממתינים לבדיקה' : 'Pending Review'}
            </Badge>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{applicants.filter(a => a.status === 'pending').length}</p>
                  <p className="text-sm text-gray-500">{isHebrew ? 'ממתינים' : 'Pending'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{applicants.filter(a => a.status === 'approved').length}</p>
                  <p className="text-sm text-gray-500">{isHebrew ? 'אושרו' : 'Approved'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{applicants.filter(a => a.status === 'rejected').length}</p>
                  <p className="text-sm text-gray-500">{isHebrew ? 'נדחו' : 'Rejected'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{applicants.filter(a => a.stage.includes('background')).length}</p>
                  <p className="text-sm text-gray-500">{isHebrew ? 'בדיקת רקע' : 'Background Check'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={isHebrew ? 'חפש לפי שם או אימייל...' : 'Search by name or email...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Tabs value={filterStage} onValueChange={setFilterStage} className="w-full md:w-auto">
                <TabsList className="grid grid-cols-4 w-full md:w-auto">
                  <TabsTrigger value="all" data-testid="tab-all">
                    {isHebrew ? 'הכל' : 'All'}
                  </TabsTrigger>
                  <TabsTrigger value="documents_under_review" data-testid="tab-docs">
                    {isHebrew ? 'מסמכים' : 'Docs'}
                  </TabsTrigger>
                  <TabsTrigger value="background_check_pending" data-testid="tab-bg">
                    {isHebrew ? 'רקע' : 'BG'}
                  </TabsTrigger>
                  <TabsTrigger value="admin_final_review" data-testid="tab-final">
                    {isHebrew ? 'סופי' : 'Final'}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Applicants List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{isHebrew ? 'רשימת מועמדים' : 'Applicant List'}</span>
              <span className="text-sm font-normal text-gray-500">
                {filteredApplicants.length} {isHebrew ? 'תוצאות' : 'results'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : filteredApplicants.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {isHebrew ? 'לא נמצאו מועמדים' : 'No applicants found'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApplicants.map((applicant) => (
                  <div
                    key={applicant.id}
                    className="p-4 rounded-xl border hover:border-purple-300 cursor-pointer transition-all bg-white dark:bg-gray-800"
                    onClick={() => setSelectedApplicant(applicant as any)}
                    data-testid={`applicant-row-${applicant.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {applicant.firstName[0]}{applicant.lastName[0]}
                        </div>
                        <div>
                          <h3 className="font-semibold">{applicant.firstName} {applicant.lastName}</h3>
                          <p className="text-sm text-gray-500">{applicant.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-400">{applicant.city}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-gray-400">
                              {applicant.serviceTypes.slice(0, 2).join(', ')}
                              {applicant.serviceTypes.length > 2 && ` +${applicant.serviceTypes.length - 2}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={stageColors[applicant.stage] || 'bg-gray-100'}>
                          {stageLabels[applicant.stage]?.[isHebrew ? 'he' : 'en'] || applicant.stage}
                        </Badge>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Applicant Detail Dialog */}
        <Dialog open={!!selectedApplicant} onOpenChange={() => setSelectedApplicant(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] p-0">
            <ScrollArea className="max-h-[90vh]">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : applicantDetails ? (
                <div className="p-6 space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                        {applicantDetails.firstName[0]}{applicantDetails.lastName[0]}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">
                          {applicantDetails.firstName} {applicantDetails.lastName}
                        </h2>
                        <Badge className={stageColors[applicantDetails.stage] || 'bg-gray-100'}>
                          {stageLabels[applicantDetails.stage]?.[isHebrew ? 'he' : 'en']}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{applicantDetails.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{applicantDetails.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{applicantDetails.streetAddress}, {applicantDetails.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{isHebrew ? 'הוגש:' : 'Submitted:'} {new Date(applicantDetails.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Services & Experience */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">{isHebrew ? 'שירותים' : 'Services'}</h4>
                      <div className="flex flex-wrap gap-2">
                        {applicantDetails.serviceTypes.map((s) => (
                          <Badge key={s} variant="outline">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">{isHebrew ? 'ניסיון' : 'Experience'}</h4>
                      <p className="text-sm">{applicantDetails.yearsExperience} {isHebrew ? 'שנים' : 'years'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">{isHebrew ? 'חיות מחמד' : 'Pet Types'}</h4>
                      <div className="flex flex-wrap gap-2">
                        {applicantDetails.preferredPetTypes.map((p) => (
                          <Badge key={p} variant="outline">{p}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">{isHebrew ? 'שפות' : 'Languages'}</h4>
                      <div className="flex flex-wrap gap-2">
                        {applicantDetails.languagesSpoken.map((l) => (
                          <Badge key={l} variant="outline">{l}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {applicantDetails.bio && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold mb-2">{isHebrew ? 'אודות' : 'Bio'}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{applicantDetails.bio}</p>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Documents */}
                  <div>
                    <h4 className="font-semibold mb-3">{isHebrew ? 'מסמכים' : 'Documents'}</h4>
                    <div className="space-y-2">
                      {applicantDetails.documents.length === 0 ? (
                        <p className="text-sm text-gray-500">{isHebrew ? 'לא הועלו מסמכים' : 'No documents uploaded'}</p>
                      ) : (
                        applicantDetails.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <div>
                                <p className="text-sm font-medium">{doc.documentType}</p>
                                <p className="text-xs text-gray-500">{doc.fileName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={
                                doc.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                                doc.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }>
                                {doc.verificationStatus}
                              </Badge>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Background Checks */}
                  <div>
                    <h4 className="font-semibold mb-3">{isHebrew ? 'בדיקות רקע' : 'Background Checks'}</h4>
                    <div className="space-y-2">
                      {applicantDetails.backgroundChecks.length === 0 ? (
                        <p className="text-sm text-gray-500">{isHebrew ? 'לא בוצעו בדיקות' : 'No checks performed'}</p>
                      ) : (
                        applicantDetails.backgroundChecks.map((check) => (
                          <div key={check.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-3">
                              <Shield className="w-4 h-4 text-purple-500" />
                              <span className="text-sm capitalize">{check.checkType.replace('_', ' ')}</span>
                            </div>
                            <Badge className={
                              check.resultStatus === 'clear' ? 'bg-green-100 text-green-700' :
                              check.resultStatus === 'flagged' ? 'bg-red-100 text-red-700' :
                              check.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            }>
                              {check.resultStatus || check.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Stage History */}
                  <div>
                    <h4 className="font-semibold mb-3">{isHebrew ? 'היסטוריית שלבים' : 'Stage History'}</h4>
                    <div className="space-y-2">
                      {applicantDetails.stageTransitions.map((t, idx) => (
                        <div key={t.id} className="flex items-start gap-3 text-sm">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${idx === 0 ? 'bg-purple-500' : 'bg-gray-300'}`} />
                          <div>
                            <p>
                              {t.fromStage ? `${stageLabels[t.fromStage]?.[isHebrew ? 'he' : 'en']} → ` : ''}
                              {stageLabels[t.toStage]?.[isHebrew ? 'he' : 'en']}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(t.transitionedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Management Approval Checklist - 2026 Spec */}
                  {applicantDetails.stage === 'admin_final_review' && applicantDetails.status === 'pending' && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2 text-purple-700">
                          <Shield className="w-5 h-5" />
                          {isHebrew ? 'רשימת אישור ניהולית' : 'Management Approval Checklist'}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {isHebrew 
                            ? 'יש לסמן את כל הפריטים לפני אישור המועמד. כל מקרה נבדק לפי הכישורים שלו.'
                            : 'Check all items before approving. Each case is reviewed on its own merit.'}
                        </p>
                        
                        <div className="grid gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200">
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkIdVerified} onCheckedChange={(checked) => setCheckIdVerified(!!checked)} className="w-4 h-4" data-testid="check-id-verified" />
                            <span className="text-sm">{isHebrew ? '✅ זהות אומתה (ת.ז./דרכון)' : '✅ ID Verified (National ID/Passport)'}</span>
                          </label>
                          
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkDocumentsReviewed} onCheckedChange={(checked) => setCheckDocumentsReviewed(!!checked)} className="w-4 h-4" data-testid="check-docs-reviewed" />
                            <span className="text-sm">{isHebrew ? '📄 מסמכים נבדקו וקבילים' : '📄 Documents Reviewed & Acceptable'}</span>
                          </label>
                          
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkDeclarationsComplete} onCheckedChange={(checked) => setCheckDeclarationsComplete(!!checked)} className="w-4 h-4" data-testid="check-declarations" />
                            <span className="text-sm">{isHebrew ? '📋 הצהרות עצמיות הושלמו' : '📋 Self-Declarations Complete'}</span>
                          </label>
                          
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkInsuranceValid} onCheckedChange={(checked) => setCheckInsuranceValid(!!checked)} className="w-4 h-4" data-testid="check-insurance" />
                            <span className="text-sm">{isHebrew ? '🛡️ ביטוח בתוקף (אם נדרש)' : '🛡️ Insurance Valid (if required)'}</span>
                          </label>
                          
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkLicenseValid} onCheckedChange={(checked) => setCheckLicenseValid(!!checked)} className="w-4 h-4" data-testid="check-license" />
                            <span className="text-sm">{isHebrew ? '🚗 רישיון נהיגה בתוקף (לנהגים)' : '🚗 Driving License Valid (for drivers)'}</span>
                          </label>
                          
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkCertificationsValid} onCheckedChange={(checked) => setCheckCertificationsValid(!!checked)} className="w-4 h-4" data-testid="check-certs" />
                            <span className="text-sm">{isHebrew ? '🎓 תעודות הכשרה תקינות (למאמנים)' : '🎓 Training Certifications Valid (for trainers)'}</span>
                          </label>
                          
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 p-2 rounded">
                            <Checkbox checked={checkBackgroundClear} onCheckedChange={(checked) => setCheckBackgroundClear(!!checked)} className="w-4 h-4" data-testid="check-background" />
                            <span className="text-sm">{isHebrew ? '🔍 בדיקת רקע תקינה/הצהרה מתאימה' : '🔍 Background Check Clear / Declaration Acceptable'}</span>
                          </label>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">
                            {isHebrew ? 'הערות אישור (אופציונלי)' : 'Approval Notes (Optional)'}
                          </label>
                          <Textarea
                            value={checkApprovalNotes}
                            onChange={(e) => setCheckApprovalNotes(e.target.value)}
                            placeholder={isHebrew ? 'הערות נוספות לתיק המועמד...' : 'Additional notes for applicant file...'}
                            className="mt-1"
                            rows={2}
                            data-testid="input-approval-notes"
                          />
                        </div>
                        
                        {/* Legal Note */}
                        <div className="p-2 bg-white dark:bg-amber-900/20 rounded border border-amber-200 text-xs text-amber-800 dark:text-amber-300">
                          {isHebrew 
                            ? '⚖️ הערה: בהתאם לחוק הישראלי, כל מקרה נבדק לגופו. החלטות מבוססות על מסמכים והצהרות, לא על מידע פלילי ישיר.'
                            : '⚖️ Note: Per Israeli law, each case is reviewed on its own merit. Decisions are based on documents and declarations, not direct criminal records.'}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Action Buttons */}
                  {applicantDetails.status === 'pending' && (
                    <>
                      <Separator />
                      <div className="flex gap-3">
                        {applicantDetails.stage !== 'admin_final_review' && applicantDetails.stage !== 'approved' && (
                          <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => advanceStageMutation.mutate(applicantDetails.id)}
                            disabled={advanceStageMutation.isPending}
                            data-testid="button-advance-stage"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            {isHebrew ? 'העבר לשלב הבא' : 'Advance Stage'}
                          </Button>
                        )}
                        {applicantDetails.stage === 'admin_final_review' && (
                          <>
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approveMutation.mutate(applicantDetails.id)}
                              disabled={
                                approveMutation.isPending ||
                                !checkIdVerified ||
                                !checkDocumentsReviewed ||
                                !checkDeclarationsComplete ||
                                !checkInsuranceValid ||
                                !checkLicenseValid ||
                                !checkCertificationsValid ||
                                !checkBackgroundClear
                              }
                              data-testid="button-approve"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {isHebrew ? 'אשר מועמד' : 'Approve'}
                            </Button>
                          </>
                        )}
                        <Button
                          className="flex-1"
                          variant="destructive"
                          onClick={() => setShowRejectDialog(true)}
                          data-testid="button-reject"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {isHebrew ? 'דחה' : 'Reject'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isHebrew ? 'דחה מועמד' : 'Reject Applicant'}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium">
                {isHebrew ? 'סיבת הדחייה' : 'Rejection Reason'} *
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={isHebrew ? 'נא לציין את סיבת הדחייה...' : 'Please provide a reason for rejection...'}
                className="mt-2"
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                {isHebrew ? 'ביטול' : 'Cancel'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedApplicant && rejectionReason) {
                    rejectMutation.mutate({
                      applicantId: selectedApplicant.id,
                      reason: rejectionReason,
                    });
                  }
                }}
                disabled={!rejectionReason || rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  isHebrew ? 'אשר דחייה' : 'Confirm Rejection'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
