import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { getAuth } from 'firebase/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  RefreshCw,
  MessageSquare,
  History,
  SendHorizonal,
  Clock,
  Info,
  ZoomIn,
  Download,
  X,
  Maximize2,
  UserCheck,
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
  internalId?: number;
  priority?: string;
  assignedTo?: string | null;
  unreadCount?: number;
  queueStatus?: string | null;
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

interface Message {
  id: number;
  direction: string;
  body: string;
  sent_by: string;
  provider_visible: boolean;
  created_at: string;
  channel: string;
}

interface AuditEvent {
  id: number;
  event_type: string;
  actor_user_id: string;
  actor_role: string;
  payload: Record<string, any> | null;
  created_at: string;
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
  if (status === 'pending_resubmission') return 'text-orange-600';
  return 'text-gray-500';
}

const RESUBMISSION_REASONS = [
  'Selfie photo is blurry or unclear',
  'Government ID photo is blurry or unclear',
  'ID document is expired',
  'Face does not match ID photo',
  'ID details are not legible',
  'Document is partially obscured or cropped',
  'Wrong document type uploaded',
  'Suspected tampered or digitally altered document',
];

function formatEventType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProviderKycReview() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Decision panel state
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Resubmit panel state
  const [showResubmitPanel, setShowResubmitPanel] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  // Message composer state
  const [msgBody, setMsgBody] = useState('');
  const [msgVisible, setMsgVisible] = useState<'internal' | 'provider'>('internal');

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ application: KycApplication; kycDetail: KycDetail | null }>({
    queryKey: ['/api/provider-onboarding/admin/applications', applicationId],
    queryFn: () => apiRequest('GET', `/api/provider-onboarding/admin/applications/${applicationId}`).then(r => r.json()),
    enabled: !!applicationId,
  });

  // Derive numeric ID from the application object for the new routes
  const numericId = (data?.application as any)?.internalId || (data?.application as any)?.id;

  const { data: messagesData, refetch: refetchMessages } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/provider-onboarding/admin/applications/messages', numericId],
    queryFn: () => apiRequest('GET', `/api/provider-onboarding/admin/applications/${numericId}/messages`).then(r => r.json()),
    enabled: !!numericId,
  });

  const { data: auditData, refetch: refetchAudit } = useQuery<{ events: AuditEvent[] }>({
    queryKey: ['/api/provider-onboarding/admin/applications/audit', numericId],
    queryFn: () => apiRequest('GET', `/api/provider-onboarding/admin/applications/${numericId}/audit`).then(r => r.json()),
    enabled: !!numericId,
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
    onError: (err: any) => toast({ title: 'Approval failed', description: err.message, variant: 'destructive' }),
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
    onError: (err: any) => toast({ title: 'Rejection failed', description: err.message, variant: 'destructive' }),
  });

  const resubmitMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/provider-onboarding/admin/applications/${numericId}/resubmit-request`, {
        reasons: selectedReasons,
      }).then(r => r.json()),
    onSuccess: (result) => {
      toast({ title: 'Resubmission requested', description: `Link expires: ${new Date(result.expiresAt).toLocaleDateString('he-IL')}` });
      setShowResubmitPanel(false);
      setSelectedReasons([]);
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications', applicationId] });
    },
    onError: (err: any) => toast({ title: 'Request failed', description: err.message, variant: 'destructive' }),
  });

  const messageMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/provider-onboarding/admin/applications/${numericId}/message`, {
        body: msgBody,
        direction: msgVisible === 'provider' ? 'outbound' : 'internal_note',
        channel: msgVisible === 'provider' ? 'email' : 'internal_note',
        providerVisible: msgVisible === 'provider',
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: msgVisible === 'provider' ? 'Message sent to applicant' : 'Internal note saved' });
      setMsgBody('');
      refetchMessages();
      refetchAudit();
    },
    onError: (err: any) => toast({ title: 'Send failed', description: err.message, variant: 'destructive' }),
  });

  const assignMutation = useMutation({
    mutationFn: (assignedTo: string) =>
      apiRequest('POST', `/api/provider-onboarding/admin/applications/${numericId}/assign`, { assignedTo }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'Assigned', description: 'Review assigned to you' });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications/pending-review'] });
    },
    onError: (err: any) => toast({ title: 'Assign failed', description: err.message, variant: 'destructive' }),
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
  const isPendingResubmission = app.status === 'pending_resubmission';
  const canDecide = !isDecided;
  const canResubmit = ['pending_review', 'pending_resubmission'].includes(app.status);
  const queuePriority = app.priority ?? 'normal';
  const PRIORITY_STYLE: Record<string, string> = {
    urgent: 'bg-red-600 text-white',
    high:   'bg-orange-500 text-white',
    normal: 'bg-slate-100 text-slate-600',
    low:    'bg-slate-100 text-slate-400',
  };
  const faceScore = parseFloat(app.biometricMatchScore || '0');
  const livenessScore = parseFloat(app.kycLivenessScore || '0');
  const ocrConfidence = parseFloat(app.kycOcrConfidence || '0');
  const messages = messagesData?.messages || [];
  const auditEvents = auditData?.events || [];

  function toggleReason(reason: string) {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Lightbox overlay ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            {/* Controls bar */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-white font-medium text-sm">{lightbox.label}</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <a
                  href={lightbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Open tab
                </a>
                <button
                  onClick={() => setLightbox(null)}
                  className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Image */}
            <img
              src={lightbox.url}
              alt={lightbox.label}
              className="w-full rounded-lg object-contain"
              style={{ maxHeight: '80vh' }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/provider-review')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to queue
        </Button>
        <div className="flex items-center gap-2">
          {/* Priority badge */}
          <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${PRIORITY_STYLE[queuePriority] ?? PRIORITY_STYLE.normal}`}>
            {queuePriority}
          </span>

          {/* Assign-to-me button */}
          {!app.assignedTo && numericId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={assignMutation.isPending}
              onClick={() => {
                const currentUser = getAuth().currentUser;
                const identity = currentUser?.email ?? currentUser?.uid ?? 'admin';
                assignMutation.mutate(identity);
              }}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              Assign to me
            </Button>
          )}
          {app.assignedTo && (
            <Badge variant="outline" className="text-xs border-slate-300 text-slate-600 gap-1">
              <UserCheck className="h-3 w-3" />
              {app.assignedTo}
            </Badge>
          )}

          {isPendingResubmission && (
            <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50">
              RESUBMISSION PENDING
            </Badge>
          )}
          <Badge
            variant={
              app.status === 'pending_review' ? 'outline' :
              app.status === 'approved' ? 'default' :
              app.status === 'pending_resubmission' ? 'outline' :
              'destructive'
            }
            className={app.status === 'pending_resubmission' ? 'border-orange-400 text-orange-700' : ''}
          >
            {app.status?.replace(/_/g, ' ').toUpperCase()}
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
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

      <Tabs defaultValue="review">
        <TabsList className="mb-4">
          <TabsTrigger value="review" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" /> Review
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Messages
            {messages.length > 0 && (
              <span className="ml-1 bg-blue-100 text-blue-700 rounded-full text-xs px-1.5">{messages.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <History className="h-4 w-4" /> Audit Trail
            {auditEvents.length > 0 && (
              <span className="ml-1 bg-slate-100 text-slate-600 rounded-full text-xs px-1.5">{auditEvents.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── REVIEW TAB ── */}
        <TabsContent value="review">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: images */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <User className="h-4 w-4" /> Selfie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {app.selfieSignedUrl ? (
                    <div className="relative group cursor-pointer" onClick={() => setLightbox({ url: app.selfieSignedUrl!, label: 'Selfie' })}>
                      <img src={app.selfieSignedUrl} alt="Applicant selfie"
                        className="w-full rounded-lg object-cover border border-slate-200 transition-opacity group-hover:opacity-90" style={{ maxHeight: 280 }} />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/50 rounded-full p-2">
                          <ZoomIn className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
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
                    <div className="relative group cursor-pointer" onClick={() => setLightbox({ url: app.idSignedUrl!, label: 'Government ID' })}>
                      <img src={app.idSignedUrl} alt="Government ID"
                        className="w-full rounded-lg object-cover border border-slate-200 transition-opacity group-hover:opacity-90" style={{ maxHeight: 280 }} />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/50 rounded-full p-2">
                          <ZoomIn className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                      <Eye className="h-5 w-5 mr-2" /> Not available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: data + actions */}
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
                          value ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />
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

              {/* Engine decision */}
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
                      : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
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

              {/* ── Resubmission panel (inline if pending_resubmission) ── */}
              {isPendingResubmission && !showResubmitPanel && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-orange-800">
                      <Clock className="h-4 w-4 shrink-0" />
                      Waiting for applicant to upload updated documents.
                    </div>
                    <Button size="sm" variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-100"
                      onClick={() => setShowResubmitPanel(true)}>
                      Request again
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* ── Resubmit request form ── */}
              {showResubmitPanel && (
                <Card className="border-orange-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-800 uppercase tracking-wide flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Request Document Resubmission
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Select the reasons to include in the applicant email (max 3 resubmission requests total).
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {RESUBMISSION_REASONS.map(reason => (
                        <div key={reason} className="flex items-center gap-2">
                          <Checkbox
                            id={`reason-${reason}`}
                            checked={selectedReasons.includes(reason)}
                            onCheckedChange={() => toggleReason(reason)}
                          />
                          <Label htmlFor={`reason-${reason}`} className="text-sm font-normal cursor-pointer">{reason}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-1">
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        disabled={selectedReasons.length === 0 || resubmitMutation.isPending}
                        onClick={() => resubmitMutation.mutate()}
                      >
                        {resubmitMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Send request to applicant
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowResubmitPanel(false); setSelectedReasons([]); }}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Admin decision panel ── */}
              {canDecide && !showResubmitPanel && (
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
                          <Button variant="ghost" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="bg-green-700 hover:bg-green-800 text-white"
                          onClick={() => approveMutation.mutate()}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve Provider
                        </Button>
                        <Button variant="destructive" onClick={() => setShowRejectForm(true)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        {canResubmit && (
                          <Button
                            variant="outline"
                            className="border-orange-400 text-orange-700 hover:bg-orange-50"
                            onClick={() => setShowResubmitPanel(true)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Request Resubmission
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── MESSAGES TAB ── */}
        <TabsContent value="messages">
          <div className="space-y-4">
            {/* Composer */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">New Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 items-center">
                  <span className="text-sm font-medium">Type:</span>
                  <Select value={msgVisible} onValueChange={(v) => setMsgVisible(v as any)}>
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal note (admin only)</SelectItem>
                      <SelectItem value="provider">Visible to applicant (email)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder={msgVisible === 'provider'
                    ? 'Message to send to the applicant by email…'
                    : 'Internal note (not visible to applicant)…'}
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  rows={4}
                  className={msgVisible === 'provider' ? 'border-blue-200' : ''}
                />
                <Button
                  size="sm"
                  disabled={!msgBody.trim() || messageMutation.isPending || !numericId}
                  onClick={() => messageMutation.mutate()}
                  className={msgVisible === 'provider' ? 'bg-blue-700 hover:bg-blue-800 text-white' : ''}
                >
                  {messageMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <SendHorizonal className="h-4 w-4 mr-2" />
                  {msgVisible === 'provider' ? 'Send to applicant' : 'Save note'}
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* Thread */}
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p>No messages yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => {
                  const isInternal = msg.direction === 'internal_note' || !msg.provider_visible;
                  return (
                    <div key={msg.id}
                      className={`rounded-lg p-4 text-sm border ${isInternal
                        ? 'bg-slate-50 border-slate-200'
                        : msg.direction === 'outbound'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-green-50 border-green-200'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${isInternal ? 'text-slate-500 border-slate-300' : 'text-blue-700 border-blue-300'}`}>
                            {isInternal ? 'Internal note' : msg.direction === 'outbound' ? 'Sent to applicant' : 'From applicant'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{msg.sent_by}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── AUDIT TRAIL TAB ── */}
        <TabsContent value="audit">
          {!numericId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p>Audit trail not available for this application.</p>
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p>No audit events yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-4 pl-10">
                {auditEvents.map((event, i) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-10 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-medium text-slate-800 text-sm">{formatEventType(event.event_type)}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs text-slate-500">{event.actor_role}</Badge>
                            <span className="text-xs text-muted-foreground font-mono">{event.actor_user_id}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(event.created_at).toLocaleDateString('he-IL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-slate-600">
                            View payload
                          </summary>
                          <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto max-h-32 text-slate-600">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
