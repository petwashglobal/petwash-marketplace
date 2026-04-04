import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Upload,
  LogOut,
  Loader2,
  ChevronRight,
  FileText,
  Shield,
  Info,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { getAuth } from 'firebase/auth';

interface ApplicationStatus {
  id: number;
  application_id: string;
  status: string;
  sub_status: string | null;
  provider_type: string;
  first_name: string;
  last_name: string;
  biometric_status: string | null;
  biometric_match_score: string | null;
  kyc_fraud_risk_level: string | null;
  kyc_decision_flags: string | null;
  resubmission_count: number;
  last_requested_resubmission_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  approved_as_provider_id: string | null;
  created_at: string;
}

interface Message {
  id: number;
  direction: string;
  channel: string;
  body: string;
  sent_by: string;
  created_at: string;
}

const STATUS_STEPS = [
  { key: 'submitted', label: 'Submitted', icon: FileText },
  { key: 'processing', label: 'Processing', icon: Shield },
  { key: 'pending_review', label: 'Under Review', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
];

function getStepIndex(status: string) {
  if (status === 'draft') return -1;
  if (status === 'processing') return 1;
  if (status === 'pending_review') return 2;
  if (status === 'pending_resubmission') return 2;
  if (status === 'approved') return 3;
  if (status === 'rejected') return -2;
  if (status === 'withdrawn') return -2;
  return 0; // submitted
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary'; className?: string }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Submitted', variant: 'outline', className: 'border-blue-400 text-blue-700 bg-blue-50' },
    processing: { label: 'Processing', variant: 'outline', className: 'border-violet-400 text-violet-700 bg-violet-50' },
    pending_review: { label: 'Under Review', variant: 'outline', className: 'border-amber-400 text-amber-700 bg-amber-50' },
    pending_resubmission: { label: 'Resubmission Needed', variant: 'outline', className: 'border-orange-400 text-orange-700 bg-orange-50' },
    approved: { label: 'Approved', variant: 'default', className: 'bg-green-600 text-white' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    withdrawn: { label: 'Withdrawn', variant: 'secondary' },
  };
  const config = map[status] || { label: status, variant: 'secondary' as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

async function getBearerToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken();
}

export default function ProviderApplicationStatus() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isRtl = language === 'he';
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{
    application: ApplicationStatus;
    resubmissionToken: string | null;
    resubmitUrl: string | null;
  }>({
    queryKey: ['/api/provider-onboarding/my/status'],
    queryFn: async () => {
      const token = await getBearerToken();
      const res = await fetch('/api/provider-onboarding/my/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: messagesData } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/provider-onboarding/my/messages'],
    queryFn: async () => {
      const token = await getBearerToken();
      const res = await fetch('/api/provider-onboarding/my/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { messages: [] };
      return res.json();
    },
    enabled: showMessages,
  });

  const replyMutation = useMutation({
    mutationFn: async (body: string) => {
      const token = await getBearerToken();
      const res = await fetch('/api/provider-onboarding/my/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Send failed');
      }
      return res.json();
    },
    onSuccess: () => {
      setReplyBody('');
      toast({ title: 'Message sent to support' });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/my/messages'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to send message', description: err.message, variant: 'destructive' });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const token = await getBearerToken();
      const res = await apiRequest('POST', '/api/provider-onboarding/withdraw', {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Withdraw failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Application withdrawn' });
      setWithdrawConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/provider-onboarding/my/status'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to withdraw', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Info className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No provider application found for your account.</p>
            <Button asChild>
              <a href="/provider-application">Apply to become a provider</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { application: app, resubmissionToken, resubmitUrl } = data;
  const stepIndex = getStepIndex(app.status);
  const isTerminal = app.status === 'approved' || app.status === 'rejected' || app.status === 'withdrawn';
  const canWithdraw = ['submitted', 'processing', 'pending_review'].includes(app.status);
  const kycFlags: string[] = (() => { try { return JSON.parse(app.kyc_decision_flags || '[]'); } catch { return []; } })();
  const messages = messagesData?.messages || [];

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Provider Application</h1>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{app.application_id}</p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* Status progress (non-terminal) */}
        {!isTerminal && app.status !== 'pending_resubmission' && (
          <Card>
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between relative">
                {/* connector line */}
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200" />
                {STATUS_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-2 z-10">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                          ${done ? 'bg-green-600 border-green-600 text-white' :
                            active ? 'bg-amber-500 border-amber-500 text-white' :
                            'bg-white border-slate-200 text-slate-400'}`}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`text-xs font-medium ${done ? 'text-green-700' : active ? 'text-amber-700' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approved */}
        {app.status === 'approved' && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 pb-6 flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-green-800 text-lg">You're approved!</p>
                <p className="text-sm text-green-700">
                  Welcome to the PetWash provider network. Your provider ID is:
                </p>
                <p className="font-mono font-bold text-green-900 text-base">{app.approved_as_provider_id}</p>
                {app.reviewed_at && (
                  <p className="text-xs text-green-600">
                    Approved on {new Date(app.reviewed_at).toLocaleDateString('he-IL')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejected */}
        {app.status === 'rejected' && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 pb-6 flex items-start gap-4">
              <XCircle className="h-8 w-8 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-800 text-lg">Application not approved</p>
                {app.rejection_reason && (
                  <p className="text-sm text-red-700">{app.rejection_reason}</p>
                )}
                <p className="text-xs text-red-600 pt-1">
                  Questions? Email <a href="mailto:support@petwash.co.il" className="underline">support@petwash.co.il</a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Withdrawn */}
        {app.status === 'withdrawn' && (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
              <LogOut className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p>You withdrew this application.</p>
              <Button asChild className="mt-4">
                <a href="/provider-application">Submit a new application</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Resubmission needed */}
        {app.status === 'pending_resubmission' && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="h-5 w-5" />
                Updated documents required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-orange-700">
                Our team reviewed your application and needs clearer copies of your documents.
                This is attempt {app.resubmission_count} of 3.
              </p>
              {kycFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {kycFlags.map((flag: string) => (
                    <Badge key={flag} variant="outline" className="border-orange-400 text-orange-800 bg-white text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              )}
              {resubmitUrl ? (
                <Button asChild className="bg-orange-600 hover:bg-orange-700 text-white w-full">
                  <a href={resubmitUrl}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Updated Documents
                  </a>
                </Button>
              ) : (
                <div className="text-sm text-orange-600 bg-orange-100 rounded p-3 flex items-start gap-2">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>A secure upload link is being generated. You'll receive it by email shortly.</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending review status */}
        {app.status === 'pending_review' && (
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-slate-800">Your application is being reviewed</p>
                  <p className="text-sm text-muted-foreground">
                    Our team typically completes reviews within 1–2 business days.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing status */}
        {app.status === 'processing' && (
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 text-violet-500 shrink-0 animate-spin" />
                <div>
                  <p className="font-medium text-slate-800">Running identity checks</p>
                  <p className="text-sm text-muted-foreground">
                    Our automated system is processing your documents. This usually takes a few minutes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Application Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Name', value: `${app.first_name} ${app.last_name}` },
              { label: 'Provider type', value: app.provider_type?.replace('_', ' ') || '—' },
              { label: 'Submitted', value: app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('he-IL') : '—' },
              { label: 'Resubmissions', value: `${app.resubmission_count || 0} / 3` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded p-3">
                <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                <div className="font-medium capitalize">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Messages toggle */}
        <Card>
          <CardHeader className="pb-0">
            <button
              className="w-full flex items-center justify-between text-sm font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setShowMessages(v => !v)}
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
                {messages.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 rounded-full text-xs px-1.5 font-normal">
                    {messages.length}
                  </span>
                )}
              </span>
              <ChevronRight className={`h-4 w-4 transition-transform ${showMessages ? 'rotate-90' : ''}`} />
            </button>
          </CardHeader>
          {showMessages && (
            <CardContent className="pt-3 space-y-4">
              {/* Thread */}
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No messages yet.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map(msg => {
                    const isFromMe = msg.direction === 'inbound';
                    return (
                      <div
                        key={msg.id}
                        className={`rounded p-3 text-sm ${isFromMe
                          ? 'bg-green-50 border border-green-100 ml-4'
                          : 'bg-blue-50 border border-blue-100 mr-4'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${isFromMe ? 'text-green-700' : 'text-blue-700'}`}>
                            {isFromMe ? 'You' : 'PetWash Support'}
                          </span>
                          <span className={`text-xs ${isFromMe ? 'text-green-500' : 'text-blue-400'}`}>
                            {new Date(msg.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={isFromMe ? 'text-green-900' : 'text-blue-900'}>{msg.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply composer */}
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Reply to support</p>
                <Textarea
                  placeholder="Write a message to our support team…"
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{replyBody.length}/2000</span>
                  <Button
                    size="sm"
                    disabled={!replyBody.trim() || replyMutation.isPending}
                    onClick={() => replyMutation.mutate(replyBody)}
                  >
                    {replyMutation.isPending
                      ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      : <MessageSquare className="h-3.5 w-3.5 mr-1.5" />}
                    Send message
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Refresh + Withdraw */}
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh status
          </Button>

          {canWithdraw && !withdrawConfirm && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setWithdrawConfirm(true)}
            >
              Withdraw application
            </Button>
          )}

          {withdrawConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-700">Are you sure?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => withdrawMutation.mutate()}
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Yes, withdraw
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWithdrawConfirm(false)}>Cancel</Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Need help? <a href="mailto:support@petwash.co.il" className="underline hover:text-slate-800">support@petwash.co.il</a>
        </p>
      </div>
    </div>
  );
}
