import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  FileText,
  Shield,
  Eye,
  ArrowLeft,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar,
} from 'lucide-react';

interface KycApplication {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  providerType: string;
  city: string;
  status: string;
  biometricMatchScore: string | null;
  biometricFailureReason: string | null;
  kycDocumentType: string | null;
  kycIdLastFour: string | null;
  kycOcrConfidence: string | null;
  kycLivenessScore: string | null;
  kycDecisionFlags: string | null;
  kycFraudRiskLevel: string | null;
  selfieSignedUrl: string | null;
  idSignedUrl: string | null;
  submittedAt: string | null;
  createdAt: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface KycDetail {
  faceMatch?: { score: number; verdict: string };
  liveness?: { passed: boolean; confidence: number; failureReasons: string[] };
  ocr?: {
    confidence: number;
    nameDetected: boolean;
    idNumberDetected: boolean;
    idNumberLastFour: string;
    birthDateDetected: boolean;
    expiryDateDetected: boolean;
    documentTypeInferred: string;
    issuingCountryDetected: boolean;
  };
  fraud?: {
    riskLevel: string;
    riskScore: number;
    anomalies: { type: string; severity: string; score: number }[];
  };
  decision?: { status: string; reason: string; forceReviewFlags: string[] };
}

function fraudBadgeColor(level: string | null) {
  if (!level) return 'secondary';
  if (level === 'low') return 'default';
  if (level === 'medium') return 'outline';
  return 'destructive';
}

function statusColor(status: string) {
  if (status === 'approved') return 'text-green-600';
  if (status === 'rejected') return 'text-red-600';
  if (status === 'pending_review') return 'text-amber-600';
  return 'text-gray-500';
}

export default function ProviderKycReview() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data, isLoading, error } = useQuery<{ application: KycApplication; kycDetail: KycDetail | null }>({
    queryKey: ['/api/provider-onboarding/admin/applications', applicationId],
    queryFn: () => apiRequest('GET', `/api/provider-onboarding/admin/applications/${applicationId}`).then(r => r.json()),
    enabled: !!applicationId,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/provider-onboarding/admin/applications/approve', {
        applicationId,
        internalNotes: notes || undefined,
      }).then(r => r.json()),
    onSuccess: (result) => {
      toast({ title: 'Application approved', description: `Provider ID: ${result.providerId}` });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications/pending-review'] });
    },
    onError: (err: any) => {
      toast({ title: 'Approval failed', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/provider-onboarding/admin/applications/reject', {
        applicationId,
        rejectionReason: rejectReason,
        internalNotes: notes || undefined,
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'Application rejected' });
      setShowRejectForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications/pending-review'] });
    },
    onError: (err: any) => {
      toast({ title: 'Rejection failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <XCircle className="h-10 w-10 mx-auto mb-3 text-red-400" />
        <p>Application not found or access denied.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/admin/provider-review')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to queue
        </Button>
      </div>
    );
  }

  const { application: app, kycDetail } = data;
  const flags: string[] = app.kycDecisionFlags ? JSON.parse(app.kycDecisionFlags) : [];
  const isDecided = app.status === 'approved' || app.status === 'rejected';
  const faceScore = parseFloat(app.biometricMatchScore || '0');
  const livenessScore = parseFloat(app.kycLivenessScore || '0');
  const ocrConfidence = parseFloat(app.kycOcrConfidence || '0');

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/provider-review')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to queue
        </Button>
        <Badge
          variant={app.status === 'pending_review' ? 'outline' : app.status === 'approved' ? 'default' : 'destructive'}
          className="text-sm px-3 py-1"
        >
          {app.status?.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="flex items-start gap-3">
        <Shield className="h-7 w-7 text-slate-700 mt-1 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Provider KYC Review — {app.firstName} {app.lastName}
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">{app.applicationId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: images */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" /> Selfie
              </CardTitle>
            </CardHeader>
            <CardContent>
              {app.selfieSignedUrl ? (
                <img
                  src={app.selfieSignedUrl}
                  alt="Applicant selfie"
                  className="w-full rounded-lg object-cover border border-slate-200"
                  style={{ maxHeight: 280 }}
                />
              ) : (
                <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                  <Eye className="h-5 w-5 mr-2" /> Not available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" /> Government ID
              </CardTitle>
            </CardHeader>
            <CardContent>
              {app.idSignedUrl ? (
                <img
                  src={app.idSignedUrl}
                  alt="Government ID document"
                  className="w-full rounded-lg object-cover border border-slate-200"
                  style={{ maxHeight: 280 }}
                />
              ) : (
                <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                  <Eye className="h-5 w-5 mr-2" /> Not available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: data */}
        <div className="lg:col-span-2 space-y-4">
          {/* Applicant info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Applicant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{app.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{app.phoneNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{app.city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('he-IL') : '—'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="font-medium">Provider type:</span>
                <Badge variant="outline" className="capitalize">{app.providerType?.replace('_', ' ')}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* KYC Scores */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">KYC Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold ${faceScore >= 78 ? 'text-green-600' : faceScore >= 55 ? 'text-amber-600' : 'text-red-600'}`}>
                    {faceScore.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Face Match / 100</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold ${livenessScore >= 70 ? 'text-green-600' : livenessScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {livenessScore.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Liveness</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold ${ocrConfidence >= 70 ? 'text-green-600' : ocrConfidence >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {ocrConfidence.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">OCR Confidence</div>
                </div>
              </div>

              {/* Fraud risk */}
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">Fraud risk:</span>
                <Badge variant={fraudBadgeColor(app.kycFraudRiskLevel) as any} className="uppercase text-xs">
                  {app.kycFraudRiskLevel || 'unknown'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* OCR Fields */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">OCR Extracted Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: 'Document type', value: app.kycDocumentType || '—' },
                  { label: 'ID last four', value: app.kycIdLastFour ? `••••${app.kycIdLastFour}` : '—' },
                  { label: 'Name detected', value: kycDetail?.ocr?.nameDetected },
                  { label: 'DOB detected', value: kycDetail?.ocr?.birthDateDetected },
                  { label: 'Expiry detected', value: kycDetail?.ocr?.expiryDateDetected },
                  { label: 'ID number detected', value: kycDetail?.ocr?.idNumberDetected },
                  { label: 'Country detected', value: kycDetail?.ocr?.issuingCountryDetected },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2">
                    <span className="text-muted-foreground">{label}</span>
                    {typeof value === 'boolean' ? (
                      value
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <span className="font-medium">{value}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Review flags */}
          {flags.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-800 uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Review Flags ({flags.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {flags.map(flag => (
                    <Badge key={flag} variant="outline" className="border-amber-400 text-amber-800 bg-white text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fraud anomalies */}
          {kycDetail?.fraud && kycDetail.fraud.anomalies.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-800 uppercase tracking-wide flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Fraud Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kycDetail.fraud.anomalies.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm border border-red-100">
                    <span className="font-medium text-red-900">{a.type}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-red-300 text-red-700">{a.severity}</Badge>
                      <span className="text-red-600 font-mono text-xs">+{a.score}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Decision reason */}
          {app.biometricFailureReason && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Engine Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 font-mono bg-slate-50 p-3 rounded">{app.biometricFailureReason}</p>
              </CardContent>
            </Card>
          )}

          {/* Already decided */}
          {isDecided && (
            <Card className={app.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="pt-4 flex items-center gap-3">
                {app.status === 'approved'
                  ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  : <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                }
                <div className="text-sm">
                  <span className={`font-semibold ${statusColor(app.status)}`}>
                    {app.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  {' by '}
                  <span className="font-mono">{app.reviewedBy || 'system'}</span>
                  {app.reviewedAt && ` on ${new Date(app.reviewedAt).toLocaleDateString('he-IL')}`}
                  {app.rejectionReason && (
                    <p className="text-muted-foreground mt-1">{app.rejectionReason}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action panel */}
          {!isDecided && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Admin Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Internal notes (optional, visible to admins only)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                />

                {showRejectForm ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Rejection reason (required, sent to applicant in generic form)"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                      className="border-red-200"
                    />
                    <div className="flex gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate()}
                        disabled={!rejectReason.trim() || rejectMutation.isPending}
                      >
                        {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirm Rejection
                      </Button>
                      <Button variant="ghost" onClick={() => setShowRejectForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      className="bg-green-700 hover:bg-green-800 text-white"
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve Provider
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectForm(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
