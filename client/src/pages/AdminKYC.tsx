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
import { AlertCircle, CheckCircle, XCircle, Eye, FileText, Calendar, X } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { trackKYCApproved, trackKYCRejected } from '@/lib/analytics';
import { logger } from "@/lib/logger";

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
      title: { he: 'ניהול אימות KYC', en: 'KYC Verification Management' },
      description: { he: 'בדיקה ואישור מסמכי אימות', en: 'Review and approve verification documents' },
      pendingSubmissions: { he: 'בקשות ממתינות', en: 'Pending Submissions' },
      noSubmissions: { he: 'אין בקשות ממתינות', en: 'No pending submissions' },
      type: { he: 'סוג', en: 'Type' },
      disability: { he: 'נכה', en: 'Disability' },
      senior: { he: 'אזרח ותיק', en: 'Senior' },
      submitted: { he: 'הוגש', en: 'Submitted' },
      viewDocuments: { he: 'צפה במסמכים', en: 'View Documents' },
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
      documents: { he: 'מסמכים', en: 'Documents' },
      closeDocuments: { he: 'סגור', en: 'Close' }
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
      const response = await fetch('/api/kyc/admin/pending', { headers });
      if (!response.ok) throw new Error('Failed to fetch pending submissions');
      return response.json();
    }
  });

  // Fetch document URLs
  const fetchDocuments = async (uid: string) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/kyc/admin/document/${uid}`, { headers });
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
      const response = await fetch('/api/kyc/admin/approve', {
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
      const response = await fetch('/api/kyc/admin/reject', {
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <p className="text-lg font-semibold">{t('accessDenied')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">{t('pendingSubmissions')}</h3>
            
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            )}

            {!isLoading && submissions?.submissions.length === 0 && (
              <p className="text-gray-500 text-center py-8">{t('noSubmissions')}</p>
            )}

            <div className="space-y-4">
              {submissions?.submissions.map((submission) => (
                <Card key={submission.uid} className="border-l-4 border-l-yellow-500">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold">{submission.firstName} {submission.lastName}</p>
                        <p className="text-sm text-gray-600">{submission.email}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={submission.type === 'disability' ? 'destructive' : 'secondary'}>
                            {t(submission.type)}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(submission.submittedAt).toLocaleDateString('en-US')}
                          </Badge>
                        </div>
                        {submission.nameOnDoc && (
                          <p className="text-sm mt-2">
                            <span className="font-medium">{t('nameOnDoc')}:</span> {submission.nameOnDoc}
                          </p>
                        )}
                        {submission.dob && (
                          <p className="text-sm">
                            <span className="font-medium">{t('dob')}:</span> {submission.dob}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocuments(submission)}
                          data-testid={`button-view-documents-${submission.uid}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {t('viewDocuments')}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setShowApproveDialog(true);
                          }}
                          data-testid={`button-approve-${submission.uid}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {t('approve')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setShowRejectDialog(true);
                          }}
                          data-testid={`button-reject-${submission.uid}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {t('reject')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Document Viewer Dialog */}
        <Dialog open={documentUrls.length > 0} onOpenChange={() => setDocumentUrls([])}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>{t('documents')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {documentUrls.map((url, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <img src={url} alt={`Document ${index + 1}`} className="w-full" data-testid={`img-document-${index}`} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setDocumentUrls([])} data-testid="button-close-documents">
                {t('closeDocuments')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>{t('approveKYC')}</DialogTitle>
              <DialogDescription>
                {selectedSubmission?.firstName} {selectedSubmission?.lastName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="expiryYears">{t('expiryYears')}</Label>
                <Input
                  id="expiryYears"
                  type="number"
                  value={expiryYears}
                  onChange={(e) => setExpiryYears(e.target.value)}
                  min="1"
                  max="10"
                  data-testid="input-expiry-years"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)} data-testid="button-cancel-approve">
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (selectedSubmission) {
                    approveMutation.mutate({ uid: selectedSubmission.uid, expiryYears });
                  }
                }}
                disabled={approveMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('confirmApprove')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <DialogHeader>
              <DialogTitle>{t('rejectKYC')}</DialogTitle>
              <DialogDescription>
                {selectedSubmission?.firstName} {selectedSubmission?.lastName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejectionReason">{t('rejectionReason')}</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)} data-testid="button-cancel-reject">
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedSubmission && rejectionReason.trim()) {
                    rejectMutation.mutate({ uid: selectedSubmission.uid, reason: rejectionReason });
                  }
                }}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('confirmReject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
