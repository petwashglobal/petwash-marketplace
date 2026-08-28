import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
// Firebase-audit 2026-08-19 SEV-2 #4: prefer shared `auth` (see
// client/src/lib/firebase.ts:143 initializeAuth). Raw getAuth() risks a
// second Auth instance without persistence/resolver on lazy-loaded pages.
import { auth } from '@/lib/firebase';
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
  country?: string | null;
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
  // Personal (was hidden — Lane A audit 2026-08-22)
  dateOfBirth?: string | null;
  // Tax / business (was hidden)
  taxStatus?: string | null;
  // Insurance (was hidden)
  insurancePolicyNumber?: string | null;
  insuranceProvider?: string | null;
  insuranceExpiresAt?: string | null;
  insuranceCoverageAmount?: string | null;
  insuranceLastVerified?: string | null;
  // Trust / background (was hidden)
  residentialHistory?: string | null;      // JSON string
  criminalCheckConsent?: boolean | null;
  criminalCheckConsentDate?: string | null;
  selfDeclarationNoRelevantConvictions?: boolean | null;
  selfDeclarationAt?: string | null;
  selfDeclarationIp?: string | null;
  requiresEnhancedVerification?: boolean | null;
  enhancedVerificationReasons?: string[] | null;
  // Declaration attestation (was hidden)
  declarationAttestation?: unknown | null;
  declarationSignatureSha256?: string | null;
  // Onboarding-form declarations JSON blob (was hidden — 14 checkboxes)
  internalNotes?: string | null;           // JSON string containing declarations + providerTypes[]
  // Animal safety (Lane A audit 2026-08-26): pet-first-aid cert row was
  // persisted at intake but never surfaced. Serial number lives in
  // internalNotes.petFirstAidNumber because the schema column was
  // mis-titled pet_first_aid_provider; expiry is a real column below.
  petFirstAidExpiresAt?: string | null;
  petFirstAidCertUrl?: string | null;
  // CEO §73 #16 (2026-08-28): three more blind fields the wizard writes
  // but the review surface never rendered.
  //   • ageConfirmed18Plus — legal 18+ attestation (separate from DOB —
  //     the applicant explicitly ticked it, or refused to);
  //   • kycDocumentExpiry — a real column, distinct from OCR-detected;
  //   • drivingRecordNotes — JSON blob with licenseNumber/licenseClass/
  //     expiryDate (walker + driver approval blocker if the licence is
  //     absent or lapsed).
  ageConfirmed18Plus?: boolean | null;
  kycDocumentExpiry?: string | null;
  drivingRecordNotes?: string | null;      // JSON string
  drivingRecordUrl?: string | null;
  // CEO §73 #12 (2026-08-28): bank / payout target. Migration 0133.
  // Approvals used to write a payout row with a null IBAN — every
  // approved provider needed a manual DB touch to become payable.
  bankName?: string | null;
  bankBranchCode?: string | null;
  bankIban?: string | null;
  bankAccountHolder?: string | null;
  bankDetailsAt?: string | null;
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
  if (status === 'pending_resubmission') return 'text-[#B8932F]';
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

// Pretty-print JSON safely — returns the input as-is when it's not JSON so
// admin still sees SOMETHING instead of an empty box. Used for
// residentialHistory (JSON array) and declaration blobs.
function safePretty(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// Friendly Hebrew + English labels for the onboarding-form declaration keys
// stashed inside internal_notes.declarations. Keys come from the wizard's
// `declarations` object in ProviderOnboarding.tsx (see the FormData block
// around line 578). This is a display-only map — DeclarationList still
// passes every key through, mapped or not, so a NEW declaration key added
// to the wizard shows up here immediately as its raw name (never silently
// dropped) and only its label is missing until this dictionary catches up.
// Lane A audit 2026-08-26 — pure UI, no schema change, no key allow-list.
const DECLARATION_LABELS: Record<string, { he: string; en: string }> = {
  // Universal
  declarationAccurateInfo:            { he: 'הפרטים שמסרתי מדויקים ומלאים',              en: 'Information provided is accurate and complete' },
  declarationAcceptTerms:             { he: 'קראתי ואני מסכים/ה לתנאי השירות',          en: 'I have read and accept the Terms of Service' },
  // Driver (PetTrek)
  declarationValidLicense:            { he: 'רישיון נהיגה בתוקף',                        en: 'Valid driving licence' },
  declarationNoSuspension:            { he: 'רישיון הנהיגה לא הוגבל / הותלה',            en: 'No licence suspension or restriction' },
  declarationUnderPointsLimit:        { he: 'מספר הנקודות ברישיון מתחת לתקרה',           en: 'Under the demerit-points limit' },
  declarationNoDrugsAlcohol:          { he: 'לא נהיגה תחת השפעת סמים או אלכוהול',        en: 'No driving under influence of drugs or alcohol' },
  declarationValidVehicleInsurance:   { he: 'ביטוח רכב בתוקף',                           en: 'Valid vehicle insurance' },
  declarationVehicleInspection:       { he: 'רכב עם רישוי / טסט בתוקף',                  en: 'Vehicle roadworthy / current inspection' },
  // Trainer (Academy)
  declarationTrainingCertification:   { he: 'תעודת מאלף בתוקף',                          en: 'Valid trainer certification' },
  declarationAccreditedCourses:       { he: 'קורסים מוכרים בלבד',                        en: 'Only accredited courses offered' },
  declarationLiabilityInsurance:      { he: 'ביטוח אחריות מקצועית בתוקף',                en: 'Valid professional liability insurance' },
  // Sitter / Walker
  declarationPhysicallyFit:           { he: 'כשירות גופנית לטיפול בכלבים',               en: 'Physically fit to handle dogs' },
  declarationAnimalExperience:        { he: 'ניסיון קודם עם בעלי חיים',                  en: 'Prior experience working with animals' },
  declarationFirstAidTraining:        { he: 'הכשרת עזרה ראשונה לבעלי חיים',              en: 'Pet first-aid training completed' },
  // Israel-safe self-declaration (some wizards write it into the same blob)
  selfDeclarationNoRelevantConvictions: { he: 'אין רישום פלילי רלוונטי לתפקיד',          en: 'No relevant criminal convictions' },
};

// Turn a raw camelCase key into a readable fallback: "declarationValidLicense"
// -> "Declaration valid license". Keeps unmapped keys visible instead of
// hiding them; the mapping table above is only for polish.
function humanizeDeclarationKey(k: string): string {
  const spaced = k.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Render the role-specific onboarding-form declaration checkboxes from
// `internal_notes` JSON. Server stores them as { declarations: {key: bool} }
// (with additional keys like providerTypes[] we skip). Displays each key
// with a ✓ / ✗ and a friendly bilingual label. Unknown keys render with a
// humanized fallback label so a NEW declaration added to the wizard is
// never silently dropped from admin review. Falls back to raw JSON block
// if the shape isn't what we expect.
function DeclarationList({ raw }: { raw: string }) {
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch { /* fall through */ }
  const decl = parsed && typeof parsed === 'object' ? parsed.declarations : null;
  if (!decl || typeof decl !== 'object') {
    return <pre className="text-xs whitespace-pre-wrap font-mono max-h-40 overflow-y-auto bg-white rounded px-3 py-2">{safePretty(raw)}</pre>;
  }
  const keys = Object.keys(decl);
  if (keys.length === 0) {
    return <div className="text-xs text-muted-foreground bg-white rounded px-3 py-2">No declarations captured</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 text-sm">
      {keys.map((k) => {
        const mapped = DECLARATION_LABELS[k];
        const en = mapped?.en ?? humanizeDeclarationKey(k);
        const he = mapped?.he ?? null;
        return (
          <div key={k} className="flex items-center justify-between bg-white rounded px-3 py-2 gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-800 truncate">{en}</div>
              {he && <div dir="rtl" className="text-xs text-muted-foreground truncate">{he}</div>}
              <div className="text-[10px] text-muted-foreground/70 font-mono truncate">{k}</div>
            </div>
            {decl[k]
              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

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

  const promoteTraineeMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/provider-onboarding/admin/applications/${numericId}/promote-trainee`, {}).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'Promoted!', description: 'Trainee has been upgraded to full provider.' });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/admin/applications', applicationId] });
    },
    onError: (err: any) => toast({ title: 'Promote failed', description: err.message, variant: 'destructive' }),
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
    high:   'bg-[#D4AF37] text-white',
    normal: 'bg-white text-slate-600',
    low:    'bg-white text-slate-400',
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
                const currentUser = auth.currentUser;
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
            <Badge variant="outline" className="border-[#D4AF37] text-black bg-[#D4AF37]">
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
            className={app.status === 'pending_resubmission' ? 'border-[#D4AF37] text-[#B8932F]' : ''}
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
              <span className="ml-1 bg-[#D4AF37] text-black rounded-full text-xs px-1.5">{messages.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <History className="h-4 w-4" /> Audit Trail
            {auditEvents.length > 0 && (
              <span className="ml-1 bg-white text-slate-600 rounded-full text-xs px-1.5">{auditEvents.length}</span>
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
                    <div className="w-full h-40 bg-white rounded-lg flex items-center justify-center text-sm text-muted-foreground">
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
                    <div className="w-full h-40 bg-white rounded-lg flex items-center justify-center text-sm text-muted-foreground">
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
                      {/* Lane A audit 2026-08-26: date digits in an he-IL string
                          can flip inside an RTL page (dd/mm/yyyy → yyyy/mm/dd).
                          Force LTR on the numeric span so the day/month/year
                          ordering is stable regardless of the page direction.
                          No shared formatDate helper exists in client/src/lib. */}
                      <span dir="ltr">{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('he-IL') : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="font-medium">Provider type:</span>
                    <Badge variant="outline" className="capitalize">{app.providerType?.replace('_', ' ')}</Badge>
                    {/* Lane A audit follow-up: applicant may have selected
                        multiple provider types in Step 5. The scalar
                        providerType stores ONLY the first one; the full
                        array lives in internal_notes.providerTypes.
                        Surface every type so approval knows what capabilities
                        the applicant claimed — a wizard that picked
                        {sitter, walker, trainer} but shows only 'sitter'
                        here has lost information the reviewer needs. */}
                    {(() => {
                      try {
                        const notes = app.internalNotes ? JSON.parse(app.internalNotes) : null;
                        const types: unknown = notes?.providerTypes;
                        if (!Array.isArray(types) || types.length <= 1) return null;
                        const extras = types.filter((t) => typeof t === 'string' && t !== app.providerType);
                        if (extras.length === 0) return null;
                        return extras.map((t) => (
                          <Badge key={String(t)} variant="secondary" className="capitalize">
                            {String(t).replace('_', ' ')}
                          </Badge>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
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
                    <div className="p-3 bg-white rounded-lg">
                      <div className={`text-2xl font-bold ${faceScore >= 78 ? 'text-green-600' : faceScore >= 55 ? 'text-amber-600' : 'text-red-600'}`}>
                        {faceScore.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Face Match / 100</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <div className={`text-2xl font-bold ${livenessScore >= 70 ? 'text-green-600' : livenessScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {livenessScore.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Liveness</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
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
                      // CEO §73 #16: kyc_document_expiry is a real column
                      // populated at intake — distinct from the OCR-inferred
                      // "expiry detected" boolean. Reviewer needs the actual
                      // date to know when the ID lapses (approving someone
                      // whose ID expires in 3 days is a KYC gap).
                      { label: 'Document expiry', value: app.kycDocumentExpiry ? new Date(app.kycDocumentExpiry).toLocaleDateString() : '—' },
                      { label: 'Name detected', value: kycDetail?.ocr?.nameDetected },
                      { label: 'DOB detected', value: kycDetail?.ocr?.birthDateDetected },
                      { label: 'Expiry detected', value: kycDetail?.ocr?.expiryDateDetected },
                      { label: 'ID number detected', value: kycDetail?.ocr?.idNumberDetected },
                      { label: 'Country detected', value: kycDetail?.ocr?.issuingCountryDetected },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between bg-white rounded px-3 py-2">
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

              {/* Personal + tax + insurance + trust + declarations
                  (Lane A audit 2026-08-22: these 20+ fields were persisted
                  but never displayed to admin — pure additive UI, no server
                  change; the /admin/applications/:id endpoint already
                  returned the whole providerApplications row.) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Personal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Date of birth</span>
                      <span className="font-medium">{app.dateOfBirth || '—'}</span>
                    </div>
                    {/* CEO §73 #16 (2026-08-28): the applicant's explicit 18+
                        attestation is separate from DOB — an unticked box +
                        a DOB in the future = fraud smell the reviewer must
                        see. Column exists on the schema; column-not-migrated
                        renders as an em-dash, not a crash. */}
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">18+ confirmed</span>
                      {app.ageConfirmed18Plus === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : app.ageConfirmed18Plus === false ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <span className="font-medium">—</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Country</span>
                      <span className="font-medium">{app.country || '—'}</span>
                    </div>
                    {/* Lane A audit 2026-08-26: phone-verified visibility.
                        The status DTO from /api/provider-onboarding/application/status
                        does NOT carry a `phoneVerified` scalar — that's a
                        schema-adjacent add. If the wizard stashed the
                        verified flag inside internal_notes.phoneVerified we
                        surface it; otherwise render an em-dash so the
                        reviewer knows it is unknown, not false. Pure UI. */}
                    {(() => {
                      let verified: boolean | null = null;
                      try {
                        const notes = app.internalNotes ? JSON.parse(app.internalNotes) : null;
                        if (typeof notes?.phoneVerified === 'boolean') verified = notes.phoneVerified;
                      } catch { /* fall through */ }
                      return (
                        <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                          <span className="text-muted-foreground">Phone verified</span>
                          {verified === true ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : verified === false ? (
                            <XCircle className="h-4 w-4 text-red-400" />
                          ) : (
                            <span className="font-medium">—</span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Lane A audit follow-up: pet-first-aid serial (Step 6)
                        is captured in internal_notes.petFirstAidNumber
                        because the schema column was mis-titled
                        pet_first_aid_provider. Surfacing the serial + expiry
                        here so admin can verify insurer traceability without
                        opening the raw JSON blob. Schema rename is a
                        CEO-approval item; UI extraction is safe today. */}
                    {(() => {
                      let serial: string | null = null;
                      try {
                        const notes = app.internalNotes ? JSON.parse(app.internalNotes) : null;
                        const raw = notes?.petFirstAidNumber;
                        if (typeof raw === 'string' && raw.trim()) serial = raw.trim();
                      } catch { /* fall through */ }
                      return (
                        <>
                          <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                            <span className="text-muted-foreground">Pet first-aid serial</span>
                            <span className="font-medium">{serial || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                            <span className="text-muted-foreground">Pet first-aid expires</span>
                            <span className="font-medium">
                              {app.petFirstAidExpiresAt ? new Date(app.petFirstAidExpiresAt).toLocaleDateString() : '—'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Tax / Business</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Tax status</span>
                      <span className="font-medium">{app.taxStatus || '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Insurance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="font-medium">{app.insuranceProvider || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Policy number</span>
                      <span className="font-medium">{app.insurancePolicyNumber || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Expires</span>
                      {/* Lane A audit 2026-08-26: countdown badge so a reviewer
                          sees at a glance whether the applicant's insurance is
                          still valid — approving a provider whose policy lapses
                          next week is a payout-eligibility landmine. Pure UI. */}
                      {(() => {
                        if (!app.insuranceExpiresAt) {
                          return <span className="font-medium">—</span>;
                        }
                        const expiry = new Date(app.insuranceExpiresAt);
                        const nowMs = Date.now();
                        const days = Math.floor((expiry.getTime() - nowMs) / 86_400_000);
                        const dateLabel = expiry.toLocaleDateString();
                        let badgeClass = 'bg-green-100 text-green-800 border-green-300';
                        let label = `${dateLabel} · ${days}d left`;
                        if (days < 0) {
                          badgeClass = 'bg-red-100 text-red-800 border-red-300';
                          label = `${dateLabel} · expired ${Math.abs(days)}d ago`;
                        } else if (days <= 30) {
                          badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                        }
                        return (
                          <span dir="ltr" className={`text-xs font-medium border rounded px-2 py-0.5 ${badgeClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className="font-medium">{app.insuranceCoverageAmount || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Last verified</span>
                      <span className="font-medium">{app.insuranceLastVerified ? new Date(app.insuranceLastVerified).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CEO §73 #12 (2026-08-28): Bank / Payout target. Populated
                  at intake via /apply; super_app_payouts.provider_bank_iban
                  /provider_bank_name derive from these. Absent-fields show
                  as em-dashes so reviewers can quickly see who is missing
                  bank details and cannot yet be paid out. */}
              {(app.bankIban || app.bankName || app.bankBranchCode || app.bankAccountHolder) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Bank / Payout</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">{app.bankName || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                        <span className="text-muted-foreground">Branch code</span>
                        <span className="font-medium">{app.bankBranchCode || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 col-span-2">
                        <span className="text-muted-foreground">IBAN</span>
                        <span dir="ltr" className="font-mono text-xs">{app.bankIban || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 col-span-2">
                        <span className="text-muted-foreground">Account holder</span>
                        <span className="font-medium">{app.bankAccountHolder || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 col-span-2">
                        <span className="text-muted-foreground">Submitted</span>
                        <span className="font-medium">{app.bankDetailsAt ? new Date(app.bankDetailsAt).toLocaleString() : '—'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CEO §73 #16 (2026-08-28): driving-license card. Blob lives
                  in driving_record_notes as {licenseNumber, licenseClass,
                  expiryDate} and drivingRecordUrl points at the scan.
                  Only render when at least one field is present so the
                  card doesn't stub out sitter-type applicants who don't
                  drive. Walker + driver approval blocker if it's empty
                  or lapsed — the reviewer needs the date, not "detected". */}
              {(app.drivingRecordNotes || app.drivingRecordUrl) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Driving License</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      let licenseNumber: string | null = null;
                      let licenseClass: string | null = null;
                      let expiryDate: string | null = null;
                      try {
                        const parsed = app.drivingRecordNotes ? JSON.parse(app.drivingRecordNotes) : null;
                        if (parsed && typeof parsed === 'object') {
                          if (typeof parsed.licenseNumber === 'string') licenseNumber = parsed.licenseNumber;
                          if (typeof parsed.licenseClass  === 'string') licenseClass  = parsed.licenseClass;
                          if (typeof parsed.expiryDate    === 'string') expiryDate    = parsed.expiryDate;
                        }
                      } catch { /* ignore — render em-dashes */ }
                      const expiryLabel = (() => {
                        if (!expiryDate) return '—';
                        const d = new Date(expiryDate);
                        if (isNaN(d.getTime())) return expiryDate;
                        const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
                        const dateLabel = d.toLocaleDateString();
                        if (days < 0)      return `${dateLabel} · expired ${Math.abs(days)}d ago`;
                        if (days <= 30)    return `${dateLabel} · ${days}d left`;
                        return `${dateLabel} · ${days}d left`;
                      })();
                      const expiryClass = (() => {
                        if (!expiryDate) return '';
                        const d = new Date(expiryDate);
                        if (isNaN(d.getTime())) return '';
                        const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
                        if (days < 0)   return 'text-red-700';
                        if (days <= 30) return 'text-amber-700';
                        return '';
                      })();
                      return (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                            <span className="text-muted-foreground">License number</span>
                            <span className="font-medium font-mono text-xs">{licenseNumber || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                            <span className="text-muted-foreground">Class</span>
                            <span className="font-medium">{licenseClass || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                            <span className="text-muted-foreground">Expiry</span>
                            <span className={`font-medium ${expiryClass}`}>{expiryLabel}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                            <span className="text-muted-foreground">Document</span>
                            {app.drivingRecordUrl ? (
                              <Badge variant="outline" className="text-xs">on file</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Trust &amp; Background</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Self-declaration (no relevant convictions)</span>
                      {app.selfDeclarationNoRelevantConvictions ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Declared at</span>
                      <span className="font-medium">{app.selfDeclarationAt ? new Date(app.selfDeclarationAt).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Criminal-check consent</span>
                      {app.criminalCheckConsent ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <span className="text-muted-foreground">Consent date</span>
                      <span className="font-medium">{app.criminalCheckConsentDate ? new Date(app.criminalCheckConsentDate).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2 col-span-2">
                      <span className="text-muted-foreground">Enhanced verification</span>
                      {app.requiresEnhancedVerification ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-800 bg-white text-xs">
                          REQUIRED
                        </Badge>
                      ) : <span className="text-muted-foreground">no</span>}
                    </div>
                    {app.enhancedVerificationReasons && app.enhancedVerificationReasons.length > 0 && (
                      <div className="col-span-2 flex flex-wrap gap-2 bg-white rounded px-3 py-2">
                        <span className="text-muted-foreground text-xs">Reasons:</span>
                        {app.enhancedVerificationReasons.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    )}
                    {app.residentialHistory && (
                      <div className="col-span-2 bg-white rounded px-3 py-2">
                        <div className="text-muted-foreground text-xs mb-1">Residential history (last 10 years)</div>
                        <pre className="text-xs whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{safePretty(app.residentialHistory)}</pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Onboarding-form declarations (14 role-specific checkboxes) —
                  persisted only inside internal_notes JSON per Lane A audit
                  (SAVED-BUT-NOT-READBACK). Surface them so admin can verify
                  each check was actually ticked. Server never re-validated
                  these; we're only reading, not gating. */}
              {app.internalNotes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Onboarding Declarations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DeclarationList raw={app.internalNotes} />
                  </CardContent>
                </Card>
              )}

              {app.declarationSignatureSha256 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Declaration Attestation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono break-all bg-white rounded px-3 py-2 text-slate-700">
                      SHA-256: {app.declarationSignatureSha256}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                    <p className="text-sm text-slate-700 font-mono bg-white p-3 rounded">{app.biometricFailureReason}</p>
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

              {/* Trainee → Provider promotion (visible when status=approved) */}
              {app.status === 'approved' && numericId && (
                <Card className="border-[#D4AF37] bg-[#D4AF37]">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm text-[#B8932F] flex items-center gap-2">
                      <UserCheck className="h-4 w-4 shrink-0" />
                      <span>If this provider is a <strong>trainee</strong>, you can promote them to a full provider role here.</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#B8932F] hover:bg-[#B8932F] text-white shrink-0"
                      onClick={() => promoteTraineeMutation.mutate()}
                      disabled={promoteTraineeMutation.isPending || promoteTraineeMutation.isSuccess}
                    >
                      {promoteTraineeMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                      {promoteTraineeMutation.isSuccess ? '✓ Promoted' : 'Promote to Full Provider'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* ── Resubmission panel (inline if pending_resubmission) ── */}
              {isPendingResubmission && !showResubmitPanel && (
                <Card className="border-[#D4AF37] bg-[#D4AF37]">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-[#B8932F]">
                      <Clock className="h-4 w-4 shrink-0" />
                      Waiting for applicant to upload updated documents.
                    </div>
                    <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#B8932F] hover:bg-[#D4AF37] hover:text-black"
                      onClick={() => setShowResubmitPanel(true)}>
                      Request again
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* ── Resubmit request form ── */}
              {showResubmitPanel && (
                <Card className="border-[#D4AF37]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[#B8932F] uppercase tracking-wide flex items-center gap-2">
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
                        className="bg-[#B8932F] hover:bg-[#B8932F] text-white"
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
                            className="border-[#D4AF37] text-[#B8932F] hover:bg-[#D4AF37] hover:text-black"
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
                  className={msgVisible === 'provider' ? 'border-[#D4AF37]' : ''}
                />
                <Button
                  size="sm"
                  disabled={!msgBody.trim() || messageMutation.isPending || !numericId}
                  onClick={() => messageMutation.mutate()}
                  className={msgVisible === 'provider' ? 'bg-[#B8932F] hover:bg-[#B8932F] text-white' : ''}
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
                        ? 'bg-white border-slate-200'
                        : msg.direction === 'outbound'
                          ? 'bg-[#D4AF37] border-[#D4AF37]'
                          : 'bg-green-50 border-green-200'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${isInternal ? 'text-slate-500 border-slate-300' : 'text-[#B8932F] border-[#D4AF37]'}`}>
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
                          <pre className="mt-1 text-xs bg-white p-2 rounded overflow-auto max-h-32 text-slate-600">
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
