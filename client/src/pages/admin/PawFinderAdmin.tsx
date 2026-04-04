/**
 * Paw Finder™ Admin Moderation Dashboard
 * Real moderation queue | Approve / Reject / Archive | Event trail | Analytics
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  CheckCircle2, XCircle, Archive, RefreshCw, Eye,
  AlertTriangle, Dog, Cat, Bird, Footprints, Clock,
  ChevronLeft, Filter, BarChart3,
} from 'lucide-react';

/* -----------------------------------------------------------------------
   TYPES
----------------------------------------------------------------------- */

interface AdminPost {
  id: number;
  post_key: string;
  user_id: string;
  post_type: 'lost' | 'found';
  pet_type: string;
  pet_name?: string;
  breed?: string;
  city: string;
  description: string;
  status: string;
  moderation_status: string;
  moderation_confidence?: number;
  moderation_reason?: string;
  reward_amount?: string;
  event_date: string;
  created_at: string;
  updated_at: string;
  primary_media?: string;
  moderation_history?: ModerationEvent[];
}

interface ModerationEvent {
  id: number;
  stage: string;
  verdict: string;
  confidence: number;
  flags: string[];
  actor_user_id?: string;
  created_at: string;
}

interface Analytics {
  total_posts: number;
  published: number;
  matched: number;
  resolved: number;
  pending_review: number;
  rejected: number;
  lost_posts: number;
  found_posts: number;
  flagged: number;
  posts_last_7d: number;
}

/* -----------------------------------------------------------------------
   CONSTANTS
----------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  published:      'bg-emerald-100 text-emerald-800 border-emerald-200',
  matched:        'bg-sky-100 text-sky-800 border-sky-200',
  resolved:       'bg-white text-slate-600 border-slate-200',
  pending_review: 'bg-amber-100 text-amber-800 border-amber-200',
  rejected:       'bg-rose-100 text-rose-800 border-rose-200',
  draft:          'bg-white text-slate-500 border-slate-200',
  archived:       'bg-white text-zinc-500 border-zinc-200',
};

const MOD_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  flagged:  'bg-amber-100 text-amber-700',
  blocked:  'bg-rose-100 text-rose-700',
  pending:  'bg-white text-slate-600',
};

const PET_ICON: Record<string, any> = { dog: Dog, cat: Cat, bird: Bird };

function PetIcon({ type }: { type: string }) {
  const Icon = PET_ICON[type] || Footprints;
  return <Icon className="w-4 h-4" />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* -----------------------------------------------------------------------
   ANALYTICS CARDS
----------------------------------------------------------------------- */

function AnalyticsBar({ analytics }: { analytics: Analytics }) {
  const cards = [
    { label: 'Total Posts',    value: analytics.total_posts,   color: 'bg-white  border-slate-200' },
    { label: 'Published',      value: analytics.published,     color: 'bg-emerald-50 border-emerald-200' },
    { label: 'Matched',        value: analytics.matched,       color: 'bg-sky-50    border-sky-200' },
    { label: 'Pending Review', value: analytics.pending_review,color: 'bg-amber-50  border-amber-200' },
    { label: 'Rejected',       value: analytics.rejected,      color: 'bg-rose-50   border-rose-200' },
    { label: 'Last 7 Days',    value: analytics.posts_last_7d, color: 'bg-purple-50 border-purple-200' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border p-3 text-center ${c.color}`}>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/* -----------------------------------------------------------------------
   POST DETAIL MODAL
----------------------------------------------------------------------- */

function PostDetailModal({
  post,
  onClose,
  onApprove,
  onReject,
  onArchive,
  isPending,
}: {
  post: AdminPost;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  onArchive: (id: number) => void;
  isPending: boolean;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <PetIcon type={post.pet_type} />
            <span className="font-semibold text-slate-800">
              {post.pet_name || 'Unknown'} — {post.post_type === 'lost' ? 'Lost' : 'Found'} {post.pet_type}
            </span>
            <Badge className={`text-xs border ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image */}
          {post.primary_media && (
            <img
              src={post.primary_media}
              alt="Pet photo"
              className="w-full max-h-60 object-cover rounded-xl border border-slate-200"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">City:</span> <strong>{post.city}</strong></div>
            <div><span className="text-slate-500">Date:</span> <strong>{formatDate(post.event_date)}</strong></div>
            {post.breed && <div><span className="text-slate-500">Breed:</span> <strong>{post.breed}</strong></div>}
            {post.reward_amount && <div><span className="text-slate-500">Reward:</span> <strong>₪{post.reward_amount}</strong></div>}
            <div><span className="text-slate-500">Posted by:</span> <code className="text-xs bg-white px-1 rounded">{post.user_id.slice(0, 12)}…</code></div>
            <div><span className="text-slate-500">Post key:</span> <code className="text-xs bg-white px-1 rounded">{post.post_key}</code></div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap">
            {post.description}
          </div>

          {/* Moderation status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${MOD_COLORS[post.moderation_status] || 'bg-white text-slate-600'}`}>
              {post.moderation_status}
            </span>
            {post.moderation_confidence != null && (
              <span className="text-xs text-slate-500">confidence: {post.moderation_confidence}%</span>
            )}
            {post.moderation_reason && (
              <span className="text-xs text-slate-500 italic">{post.moderation_reason}</span>
            )}
          </div>

          {/* Moderation event trail */}
          {post.moderation_history && post.moderation_history.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Moderation Trail</div>
              <div className="space-y-1">
                {post.moderation_history.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-white rounded-lg px-3 py-2">
                    <span className="font-medium text-slate-700">{ev.stage}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${MOD_COLORS[ev.verdict] || 'bg-white'}`}>{ev.verdict}</span>
                    {ev.confidence != null && <span className="text-slate-400">{ev.confidence}%</span>}
                    {ev.flags?.length > 0 && (
                      <span className="text-rose-600">{ev.flags.join(', ')}</span>
                    )}
                    {ev.actor_user_id && <span className="text-slate-400 ml-auto">by {ev.actor_user_id.slice(0, 10)}…</span>}
                    <span className="text-slate-400">{formatDate(ev.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {['pending_review', 'draft', 'rejected'].includes(post.status) || post.moderation_status === 'flagged' ? (
            <div className="flex flex-col gap-3 pt-2 border-t">
              {!showRejectForm ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onApprove(post.id)}
                    disabled={isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Publish
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => setShowRejectForm(true)}
                    disabled={isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-600"
                    onClick={() => onArchive(post.id)}
                    disabled={isPending}
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Rejection reason (optional)"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                      onClick={() => { onReject(post.id, rejectReason); setShowRejectForm(false); }}
                      disabled={isPending}
                    >
                      Confirm Reject
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
   POST ROW
----------------------------------------------------------------------- */

function PostRow({ post, onSelect }: { post: AdminPost; onSelect: () => void }) {
  const hasFlag = post.moderation_status === 'flagged' || post.moderation_status === 'blocked';
  return (
    <div
      className={`flex items-center gap-3 p-4 border-b last:border-0 hover:bg-white cursor-pointer transition-colors ${hasFlag ? 'bg-amber-50/30' : ''}`}
      onClick={onSelect}
    >
      {post.primary_media ? (
        <img
          src={post.primary_media}
          alt=""
          className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
          <PetIcon type={post.pet_type} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-800 text-sm">{post.pet_name || `Unknown ${post.pet_type}`}</span>
          <Badge className="text-xs capitalize">{post.post_type}</Badge>
          <Badge className={`text-xs border ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
          {hasFlag && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">{post.city} · {formatDate(post.event_date)}</div>
        <div className="text-xs text-slate-500 truncate">{post.description.slice(0, 80)}…</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className={`text-xs px-2 py-0.5 rounded-lg ${MOD_COLORS[post.moderation_status] || 'bg-white text-slate-500'}`}>
          {post.moderation_status}
        </div>
        {post.moderation_confidence != null && (
          <div className="text-xs text-slate-400 mt-0.5">{post.moderation_confidence}%</div>
        )}
      </div>

      <Eye className="w-4 h-4 text-slate-300" />
    </div>
  );
}

/* -----------------------------------------------------------------------
   MAIN COMPONENT
----------------------------------------------------------------------- */

type TabType = 'queue' | 'all';

export default function PawFinderAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab]       = useState<TabType>('queue');
  const [selected, setSelected] = useState<AdminPost | null>(null);
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterCity,   setFilterCity]     = useState('');
  const [filterType,   setFilterType]     = useState('');

  // Queue query
  const queueQ = useQuery<{ rows: AdminPost[]; count: number }>({
    queryKey: ['/api/admin/paw-finder/queue'],
    refetchInterval: 30_000,
  });

  // All posts query
  const allPostsQ = useQuery<{ rows: AdminPost[]; count: number }>({
    queryKey: ['/api/admin/paw-finder/posts', filterStatus, filterCity, filterType],
    enabled: tab === 'all',
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterCity)   params.set('city', filterCity);
      if (filterType)   params.set('postType', filterType);
      params.set('limit', '200');
      const r = await fetch(`/api/admin/paw-finder/posts?${params}`);
      return r.json();
    },
  });

  // Analytics query
  const analyticsQ = useQuery<{ summary: Analytics }>({
    queryKey: ['/api/admin/paw-finder/analytics'],
    refetchInterval: 60_000,
  });

  // Mutations
  const approveMut = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/admin/paw-finder/posts/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/queue'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/posts'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/analytics'] });
      setSelected(null);
      toast({ title: 'Post approved and published' });
    },
    onError: () => toast({ title: 'Approve failed', variant: 'destructive' }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest('POST', `/api/admin/paw-finder/posts/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/queue'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/posts'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/analytics'] });
      setSelected(null);
      toast({ title: 'Post rejected' });
    },
    onError: () => toast({ title: 'Reject failed', variant: 'destructive' }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/admin/paw-finder/posts/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/queue'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/posts'] });
      setSelected(null);
      toast({ title: 'Post archived' });
    },
    onError: () => toast({ title: 'Archive failed', variant: 'destructive' }),
  });

  const isPending = approveMut.isPending || rejectMut.isPending || archiveMut.isPending;

  const analytics = analyticsQ.data?.summary;
  const queueRows = queueQ.data?.rows ?? [];
  const allRows   = allPostsQ.data?.rows ?? [];
  const displayRows = tab === 'queue' ? queueRows : allRows;

  return (
    <div className="min-h-screen bg-white" dir="ltr">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin/dashboard" className="text-slate-400 hover:text-slate-700">
              <ChevronLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">Paw Finder™ Moderation</h1>
              <p className="text-xs text-slate-400">Lost & Found Pet Platform</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/queue'] });
              qc.invalidateQueries({ queryKey: ['/api/admin/paw-finder/analytics'] });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Analytics */}
        {analytics && <AnalyticsBar analytics={analytics} />}

        {/* Tabs */}
        <div className="flex gap-1 bg-white p-1 rounded-xl w-fit">
          {(['queue', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'queue' ? (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Moderation Queue {queueRows.length > 0 && `(${queueRows.length})`}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> All Posts
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters (All posts tab) */}
        {tab === 'all' && (
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="City"
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
                className="pl-8 h-8 text-sm w-36"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 text-sm px-2 bg-white"
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="matched">Matched</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 text-sm px-2 bg-white"
            >
              <option value="">Lost &amp; Found</option>
              <option value="lost">Lost only</option>
              <option value="found">Found only</option>
            </select>
          </div>
        )}

        {/* Post list */}
        <Card className="shadow-sm border-slate-200">
          {(tab === 'queue' ? queueQ.isLoading : allPostsQ.isLoading) ? (
            <CardContent className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading…
            </CardContent>
          ) : displayRows.length === 0 ? (
            <CardContent className="py-12 text-center text-slate-400">
              {tab === 'queue' ? (
                <>
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="font-medium">Queue is clear</p>
                  <p className="text-xs mt-1">No posts pending moderation</p>
                </>
              ) : (
                <p>No posts found</p>
              )}
            </CardContent>
          ) : (
            <div>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm text-slate-600">
                  {displayRows.length} post{displayRows.length !== 1 ? 's' : ''}
                  {tab === 'queue' && ' pending review'}
                </CardTitle>
              </CardHeader>
              {displayRows.map(post => (
                <PostRow key={post.id} post={post} onSelect={() => setSelected(post)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Post detail modal */}
      {selected && (
        <PostDetailModal
          post={selected}
          onClose={() => setSelected(null)}
          onApprove={id => approveMut.mutate(id)}
          onReject={(id, reason) => rejectMut.mutate({ id, reason })}
          onArchive={id => archiveMut.mutate(id)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
