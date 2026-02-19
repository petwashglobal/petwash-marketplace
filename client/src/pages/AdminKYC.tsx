import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, XCircle, Eye, FileText, Calendar, X, Shield, Users, Clock, Ban, Search, Filter } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { trackKYCApproved, trackKYCRejected } from '@/lib/analytics';
import { logger } from "@/lib/logger";
import { getApiUrl } from '@/lib/apiConfig';

const ADMIN_EMAIL = 'nirhadad1@gmail.com';

interface KYCSubmission {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  type: 'disability' | 'senior';
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  docPaths: string[];
  nameOnDoc?: string;
  dob?: string;
  rejectionReason?: string;
}

export default function AdminKYC() {
  const { user: firebaseUser } = useFirebaseAuth();
  const language = 'en'; // Admin pages use English
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [expiryYears, setExpiryYears] = useState('5');
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // Helper to get Firebase ID token
  const getAuthHeaders = async () => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const token = await (firebaseUser as any).getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      title: { he: 'ניהול אימות KYC', en: 'KYC Compliance Control Center' },
      description: { he: 'בדיקה ואישור מסמכי אימות', en: 'Premium verification and approval dashboard' },
      pendingSubmissions: { he: 'בקשות ממתינות', en: 'Pending Verifications' },
      noSubmissions: { he: 'אין בקשות ממתינות', en: 'No pending submissions' },
      type: { he: 'סוג', en: 'Type' },
      disability: { he: 'נכה', en: 'Disability Verification' },
      senior: { he: 'אזרח ותיק', en: 'Senior Citizen' },
      submitted: { he: 'הוגש', en: 'Submitted' },
      viewDocuments: { he: 'צפה במסמכים', en: 'Review' },
      approve: { he: 'אשר', en: 'Approve' },
      reject: { he: 'דחה', en: 'Reject' },
      loading: { he: 'טוען...', en: 'Loading...' },
      nameOnDoc: { he: 'שם במסמך', en: 'Name on Document' },
      dob: { he: 'תאריך לידה', en: 'Date of Birth' },
      approveKYC: { he: 'אישור KYC', en: 'Approve KYC' },
      rejectKYC: { he: 'דחיית KYC', en: 'Reject KYC' },
      expiryYears: { he: 'שנים עד פקיעה', en: 'Years Until Expiry' },
      rejectionReason: { he: 'סיבת דחייה', en: 'Rejection Reason' },
      cancel: { he: 'ביטול', en: 'Cancel' },
      confirmApprove: { he: 'אשר ואפשר הנחה', en: 'Approve and Enable Discount' },
      confirmReject: { he: 'דחה בקשה', en: 'Reject Submission' },
      accessDenied: { he: 'גישה נדחתה - נדרשות הרשאות מנהל', en: 'Access Denied - Admin permissions required' },
      approveSuccess: { he: 'KYC אושר בהצלחה', en: 'KYC approved successfully' },
      rejectSuccess: { he: 'KYC נדחה', en: 'KYC rejected' },
      error: { he: 'שגיאה', en: 'Error' },
      documents: { he: 'מסמכים', en: 'Verification Documents' },
      closeDocuments: { he: 'סגור', en: 'Close' },
      totalSubmissions: { he: 'סה״כ בקשות', en: 'Total Submissions' },
      pendingReview: { he: 'ממתין לבדיקה', en: 'Pending Review' },
      approved: { he: 'אושר', en: 'Approved' },
      rejected: { he: 'נדחה', en: 'Rejected' },
      searchPlaceholder: { he: 'חיפוש...', en: 'Search by name or email...' },
      filterByStatus: { he: 'סנן לפי סטטוס', en: 'Filter by Status' },
      all: { he: 'הכל', en: 'All' },
      pending: { he: 'ממתין', en: 'Pending' }
    };
    return translations[key]?.[language] || key;
  };

  // Check if user is admin
  const isAdmin = firebaseUser?.email === ADMIN_EMAIL;

  // Fetch pending submissions
  const { data: submissions, isLoading } = useQuery<{ submissions: KYCSubmission[] }>({
    queryKey: ['/api/kyc/admin/pending'],
    enabled: isAdmin && !!firebaseUser,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/api/kyc/admin/pending'), { headers });
      if (!response.ok) throw new Error('Failed to fetch pending submissions');
      return response.json();
    }
  });

  // Fetch document URLs
  const fetchDocuments = async (uid: string) => {
    const headers = await getAuthHeaders();
    const response = await fetch(getApiUrl(`/api/kyc/admin/document/${uid}`), { headers });
    if (!response.ok) throw new Error('Failed to fetch documents');
    const data = await response.json();
    return data.urls;
  };

  // View documents
  const handleViewDocuments = async (submission: KYCSubmission) => {
    try {
      const urls = await fetchDocuments(submission.uid);
      setDocumentUrls(urls);
      setSelectedSubmission(submission);
    } catch (error) {
      logger.error('Error fetching documents', error);
    }
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ uid, expiryYears }: { uid: string; expiryYears: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/api/kyc/admin/approve'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid,
          reviewerUid: firebaseUser?.uid,
          expiryYears: parseInt(expiryYears)
        })
      });
      if (!response.ok) throw new Error('Failed to approve');
      return response.json();
    },
    onSuccess: () => {
      // Track KYC approval in GA4
      if (selectedSubmission) {
        trackKYCApproved(selectedSubmission.uid, true);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/kyc/admin/pending'] });
      setShowApproveDialog(false);
      setSelectedSubmission(null);
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ uid, reason }: { uid: string; reason: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/api/kyc/admin/reject'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid,
          reviewerUid: firebaseUser?.uid,
          reason
        })
      });
      if (!response.ok) throw new Error('Failed to reject');
      return response.json();
    },
    onSuccess: () => {
      // Track KYC rejection in GA4
      if (selectedSubmission) {
        trackKYCRejected(selectedSubmission.uid, rejectionReason);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/kyc/admin/pending'] });
      setShowRejectDialog(false);
      setSelectedSubmission(null);
      setRejectionReason('');
    }
  });

  // Calculate statistics
  const stats = {
    total: submissions?.submissions.length || 0,
    pending: submissions?.submissions.filter(s => s.status === 'pending').length || 0,
    approved: submissions?.submissions.filter(s => s.status === 'approved').length || 0,
    rejected: submissions?.submissions.filter(s => s.status === 'rejected').length || 0
  };

  // Filter submissions
  const filteredSubmissions = submissions?.submissions.filter(submission => {
    const matchesSearch = searchQuery === '' || 
      submission.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  if (!isAdmin) {
    return (
      <div className="min-h-screen luxury-bg-mesh p-6">
        <div className="luxury-glass-card luxury-shadow-xl max-w-2xl mx-auto p-8">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="h-6 w-6" />
            <p className="luxury-heading-sm">{t('accessDenied')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="luxury-animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-lg luxury-text-gradient">{t('title')}</h1>
              <p className="luxury-text-small">{t('description')}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="luxury-grid-4 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-lift p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="luxury-heading-lg luxury-text-gradient">{stats.total}</p>
                <p className="luxury-text-small">{t('totalSubmissions')}</p>
              </div>
            </div>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="luxury-heading-lg luxury-text-gradient">{stats.pending}</p>
                <p className="luxury-text-small">{t('pendingReview')}</p>
              </div>
            </div>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="luxury-heading-lg luxury-text-gradient">{stats.approved}</p>
                <p className="luxury-text-small">{t('approved')}</p>
              </div>
            </div>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <Ban className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="luxury-heading-lg luxury-text-gradient">{stats.rejected}</p>
                <p className="luxury-text-small">{t('rejected')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="luxury-glass-minimal w-full pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="input-search"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="luxury-glass-minimal w-full pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-status-filter"
              >
                <option value="all">{t('all')}</option>
                <option value="pending">{t('pending')}</option>
                <option value="approved">{t('approved')}</option>
                <option value="rejected">{t('rejected')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pending Verifications Grid */}
        <div>
          <h3 className="luxury-heading-sm mb-4 luxury-animate-fade-in luxury-delay-3">{t('pendingSubmissions')}</h3>
          
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="luxury-spinner"></div>
            </div>
          )}

          {!isLoading && filteredSubmissions.length === 0 && (
            <div className="luxury-glass-card p-12 text-center">
              <p className="luxury-text-body text-gray-500">{t('noSubmissions')}</p>
            </div>
          )}

          <div className="luxury-grid-3">
            {filteredSubmissions.map((submission, index) => (
              <div 
                key={submission.uid} 
                className="luxury-glass-card luxury-shadow-lg luxury-hover-lift p-6 luxury-animate-scale-in"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                {/* User Avatar */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-0.5">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                      <span className="luxury-heading-md luxury-text-gradient">
                        {submission.firstName[0]}{submission.lastName[0]}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="luxury-heading-sm">{submission.firstName} {submission.lastName}</p>
                    <p className="luxury-text-small">{submission.email}</p>
                  </div>
                </div>

                {/* Document Type & Status */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`luxury-badge ${submission.type === 'disability' ? 'luxury-badge-gold' : ''}`}>
                    {t(submission.type)}
                  </span>
                  <span className={`luxury-badge ${
                    submission.status === 'approved' ? 'luxury-badge-success' : ''
                  }`}>
                    {submission.status}
                  </span>
                </div>

                {/* Submission Date */}
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="luxury-text-small">
                    {new Date(submission.submittedAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>

                {/* Additional Info */}
                {submission.nameOnDoc && (
                  <p className="luxury-text-small mb-1">
                    <span className="font-medium">{t('nameOnDoc')}:</span> {submission.nameOnDoc}
                  </p>
                )}
                {submission.dob && (
                  <p className="luxury-text-small mb-4">
                    <span className="font-medium">{t('dob')}:</span> {submission.dob}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 mt-4">
                  <Button
                    onClick={() => handleViewDocuments(submission)}
                    className="luxury-btn-secondary text-sm py-2"
                    data-testid={`button-view-documents-${submission.uid}`}
                  >
                    <Eye className="h-4 w-4 mr-2 inline" />
                    {t('viewDocuments')}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setSelectedSubmission(submission);
                        setShowApproveDialog(true);
                      }}
                      className="luxury-btn-primary flex-1 text-sm py-2"
                      data-testid={`button-approve-${submission.uid}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-1 inline" />
                      {t('approve')}
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedSubmission(submission);
                        setShowRejectDialog(true);
                      }}
                      className="luxury-btn-secondary flex-1 text-sm py-2 !bg-red-50 !text-red-600 !border-red-200 hover:!bg-red-100"
                      data-testid={`button-reject-${submission.uid}`}
                    >
                      <XCircle className="h-4 w-4 mr-1 inline" />
                      {t('reject')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Document Viewer Dialog */}
        <Dialog open={documentUrls.length > 0} onOpenChange={() => setDocumentUrls([])}>
          <DialogContent className="luxury-glass-card luxury-shadow-xl max-w-4xl max-h-[90vh] overflow-auto">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="luxury-heading-sm luxury-text-gradient flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('documents')}
              </DialogTitle>
              {selectedSubmission && (
                <DialogDescription className="luxury-text-small">
                  {selectedSubmission.firstName} {selectedSubmission.lastName}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {documentUrls.map((url, index) => (
                <div key={index} className="luxury-glass-minimal p-4 luxury-shadow-md overflow-hidden">
                  <img 
                    src={url} 
                    alt={`Document ${index + 1}`} 
                    className="w-full rounded-lg" 
                    data-testid={`img-document-${index}`} 
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="mt-6">
              <Button
                onClick={() => setDocumentUrls([])}
                className="luxury-btn-secondary"
                data-testid="button-close-documents"
              >
                {t('closeDocuments')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="luxury-glass-card luxury-shadow-xl">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="luxury-heading-sm luxury-text-gradient flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {t('approveKYC')}
              </DialogTitle>
              <DialogDescription className="luxury-text-small">
                {selectedSubmission?.firstName} {selectedSubmission?.lastName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="expiryYears" className="luxury-text-small font-medium mb-2 block">
                  {t('expiryYears')}
                </Label>
                <input
                  id="expiryYears"
                  type="number"
                  value={expiryYears}
                  onChange={(e) => setExpiryYears(e.target.value)}
                  min="1"
                  max="10"
                  className="luxury-glass-minimal w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  data-testid="input-expiry-years"
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-3">
              <Button
                onClick={() => setShowApproveDialog(false)}
                className="luxury-btn-secondary"
                data-testid="button-cancel-approve"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (selectedSubmission) {
                    approveMutation.mutate({ uid: selectedSubmission.uid, expiryYears });
                  }
                }}
                disabled={approveMutation.isPending}
                className="luxury-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-confirm-approve"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />}
                {t('confirmApprove')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="luxury-glass-card luxury-shadow-xl">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="luxury-heading-sm luxury-text-gradient flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                {t('rejectKYC')}
              </DialogTitle>
              <DialogDescription className="luxury-text-small">
                {selectedSubmission?.firstName} {selectedSubmission?.lastName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="rejectionReason" className="luxury-text-small font-medium mb-2 block">
                  {t('rejectionReason')}
                </Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="luxury-glass-minimal w-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  data-testid="textarea-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-3">
              <Button
                onClick={() => setShowRejectDialog(false)}
                className="luxury-btn-secondary"
                data-testid="button-cancel-reject"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (selectedSubmission && rejectionReason.trim()) {
                    rejectMutation.mutate({ uid: selectedSubmission.uid, reason: rejectionReason });
                  }
                }}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="luxury-btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />}
                {t('confirmReject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
