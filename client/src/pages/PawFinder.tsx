/**
 * Paw Finder™ — Lost & Found Pet Platform
 * PostgreSQL-backed | Gemini-moderated | Loyalty-gated posting
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { type Language } from '@/lib/i18n';
import {
  Search, MapPin, Heart, AlertCircle, CheckCircle2,
  Gift, Loader2, Plus, ChevronRight, Phone, MessageSquare,
  Dog, Cat, Bird, Footprints, Star, Clock, Eye,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

/* -------------------------------------------------------------------------
   TYPES
------------------------------------------------------------------------- */

interface PawPost {
  id: number;
  post_key: string;
  post_type: 'lost' | 'found';
  pet_type: 'dog' | 'cat' | 'bird' | 'other';
  pet_name?: string;
  breed?: string;
  color_primary?: string;
  size_category?: string;
  sex?: string;
  city: string;
  area?: string;
  description: string;
  reward_amount?: string;
  event_date: string;
  status: string;
  matched_post_count: number;
  latitude?: string;
  longitude?: string;
  primary_media?: string;
  published_at?: string;
}

interface PawFinderProps {
  language: Language;
}

/* -------------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  published:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  matched:        'bg-sky-50 text-sky-700 border-sky-200',
  resolved:       'bg-slate-50 text-slate-500 border-slate-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected:       'bg-rose-50 text-rose-700 border-rose-200',
  draft:          'bg-slate-50 text-slate-500 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  published:      'פעיל',
  matched:        'נמצאה התאמה',
  resolved:       'נפתר',
  pending_review: 'בבדיקה',
  rejected:       'נדחה',
  draft:          'טיוטה',
};

const PET_ICON: Record<string, any> = { dog: Dog, cat: Cat, bird: Bird, other: Footprints };

function PetIcon({ type, className = '' }: { type: string; className?: string }) {
  const Icon = PET_ICON[type] || Footprints;
  return <Icon className={className} />;
}

function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* -------------------------------------------------------------------------
   LEAFLET MAP
------------------------------------------------------------------------- */

function PawFinderMap({ posts, onSelect }: { posts: PawPost[]; onSelect: (id: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    let L: any;
    import('leaflet').then(mod => {
      L = mod.default;

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (!mapRef.current || leafletRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([32.0853, 34.7818], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      leafletRef.current = map;
    });

    return () => {
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!leafletRef.current) return;
    import('leaflet').then(mod => {
      const L = mod.default;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const postsWithCoords = posts.filter(p => p.latitude && p.longitude);

      postsWithCoords.forEach(post => {
        const lat = Number(post.latitude);
        const lng = Number(post.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const color = post.post_type === 'lost' ? '#e11d48' : '#059669';
        const icon = L.divIcon({
          html: `<div style="
            width:28px;height:28px;border-radius:50% 50% 50% 0;
            background:${color};transform:rotate(-45deg);
            border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          className: '',
        });

        const marker = L.marker([lat, lng], { icon })
          .bindPopup(`<div style="font-size:13px;min-width:180px">
            <strong>${post.post_type === 'lost' ? '🔴 אבוד' : '🟢 נמצא'}</strong>
            ${post.pet_name ? ` — ${post.pet_name}` : ''}<br>
            <span style="color:#64748b">${post.city}${post.area ? `, ${post.area}` : ''}</span><br>
            <span style="color:#94a3b8;font-size:11px">${formatDate(post.event_date)}</span>
          </div>`)
          .addTo(leafletRef.current)
          .on('click', () => onSelect(post.id));
        markersRef.current.push(marker);
      });

      if (postsWithCoords.length > 0) {
        const bounds = L.latLngBounds(postsWithCoords.map(p => [Number(p.latitude), Number(p.longitude)]));
        leafletRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    });
  }, [posts, onSelect]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-100">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} className="w-full h-full" />
      {posts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm bg-slate-50">
          <MapPin className="w-4 h-4 mr-1" /> אין פוסטים על המפה
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   POST CARD
------------------------------------------------------------------------- */

function PostCard({ post, onContact, onResolve, isOwner = false, showResolve = false }: {
  post: PawPost;
  onContact?: () => void;
  onResolve?: () => void;
  isOwner?: boolean;
  showResolve?: boolean;
}) {
  const isLost = post.post_type === 'lost';

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${isLost ? 'border-rose-100' : 'border-emerald-100'}`}>
      <div className="flex gap-0">
        <div className="w-[120px] flex-shrink-0">
          {post.primary_media ? (
            <img src={post.primary_media} alt={post.pet_name || ''} className="w-full h-full object-cover min-h-[120px]" />
          ) : (
            <div className={`w-full min-h-[120px] flex items-center justify-center ${isLost ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              <PetIcon type={post.pet_type} className={`w-8 h-8 ${isLost ? 'text-rose-300' : 'text-emerald-300'}`} />
            </div>
          )}
        </div>

        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isLost ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {isLost ? '🔴 אבוד' : '🟢 נמצא'}
              </span>
              {post.status !== 'published' && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[post.status] || 'bg-slate-50 text-slate-500'}`}>
                  {STATUS_LABELS[post.status] || post.status}
                </span>
              )}
              {post.matched_post_count > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  {post.matched_post_count} התאמות
                </span>
              )}
            </div>
          </div>

          <div className="font-semibold text-slate-900 truncate">
            {post.pet_name ? post.pet_name : <span className="text-slate-400 font-normal">ללא שם</span>}
            {post.breed ? <span className="font-normal text-slate-500 text-sm ml-1">· {post.breed}</span> : null}
          </div>

          <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{post.city}{post.area ? `, ${post.area}` : ''}</span>
            <span className="mx-1 text-slate-300">·</span>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{formatDate(post.event_date)}</span>
          </div>

          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{post.description}</p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {post.reward_amount && Number(post.reward_amount) > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Gift className="w-3 h-3" /> ₪{Number(post.reward_amount).toLocaleString('he-IL')} גמול
              </span>
            )}
            {onContact && !isOwner && post.status !== 'resolved' && (
              <button
                onClick={onContact}
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" /> צור קשר
              </button>
            )}
            {showResolve && onResolve && post.status !== 'resolved' && (
              <button
                onClick={onResolve}
                className="text-xs font-medium px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" /> סמן כנפתר
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   CONTACT MODAL
------------------------------------------------------------------------- */

function ContactModal({ post, onClose }: { post: PawPost; onClose: () => void }) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (message.trim().length < 5) {
      toast({ variant: 'destructive', title: 'הודעה קצרה מדי', description: 'נא לכתוב לפחות 5 תווים' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/paw-finder/posts/${post.id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageText: message.trim() }),
      });
      if (!r.ok) throw new Error('failed');
      toast({ title: '✅ הבקשה נשלחה', description: 'בעל הפוסט יקבל את הודעתך.' });
      onClose();
    } catch {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא הצלחנו לשלוח את הבקשה. נסה שוב.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">
          {post.post_type === 'lost' ? '📣 יצירת קשר עם בעל הכלב' : '📣 יצירת קשר עם המוצא'}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          כתוב הודעה. פרטי הקשר יחשפו רק אם הבעלים יאשר.
        </p>
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="תאר מה ראית, היכן, מתי, ומה מצב הבע"ח..."
          rows={4}
          className="rounded-2xl mb-4"
          dir="rtl"
        />
        <div className="flex gap-3">
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-2xl">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח הודעה'}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-2xl">ביטול</Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   REPORT FORM
------------------------------------------------------------------------- */

const EMPTY_FORM = {
  postType: 'lost' as 'lost' | 'found',
  petType: 'dog' as 'dog' | 'cat' | 'bird' | 'other',
  petName: '',
  breed: '',
  colorPrimary: '',
  sizeCategory: 'unknown' as string,
  sex: 'unknown' as string,
  description: '',
  city: '',
  area: '',
  eventDate: '',
  rewardAmount: '',
  contactPreference: 'inbox_first' as string,
  contactPhone: '',
};

function ReportForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const set = (k: keyof typeof EMPTY_FORM) => (e: any) =>
    setForm(prev => ({ ...prev, [k]: e.target?.value ?? e }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || form.description.length < 10) {
      toast({ variant: 'destructive', title: 'תיאור חסר', description: 'נא לכתוב לפחות 10 תווים.' });
      return;
    }
    if (!form.city.trim()) {
      toast({ variant: 'destructive', title: 'עיר חסרה', description: 'יש לציין עיר.' });
      return;
    }
    if (!form.eventDate) {
      toast({ variant: 'destructive', title: 'תאריך חסר', description: 'יש לציין תאריך האירוע.' });
      return;
    }
    if (!imageUrl.trim()) {
      toast({ variant: 'destructive', title: 'תמונה חסרה', description: 'יש לצרף כתובת URL של תמונת החיה.' });
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        postType: form.postType,
        petType: form.petType,
        petName: form.petName || undefined,
        breed: form.breed || undefined,
        colorPrimary: form.colorPrimary || undefined,
        sizeCategory: form.sizeCategory,
        sex: form.sex,
        description: form.description,
        city: form.city,
        area: form.area || undefined,
        eventDate: form.eventDate,
        rewardAmount: form.rewardAmount ? Number(form.rewardAmount) : undefined,
        contactPreference: form.contactPreference,
        contactPhone: form.contactPhone || undefined,
        mediaFiles: [{ filePath: imageUrl.trim(), mediaRole: 'primary' }],
      };

      const r = await fetch('/api/paw-finder/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await r.json();

      if (!r.ok) {
        if (j.error === 'loyalty_membership_required') {
          toast({ variant: 'destructive', title: 'נדרש חברות לויאלטי', description: 'רק חברי לויאלטי פעילים יכולים לפרסם פוסטים.' });
        } else {
          toast({ variant: 'destructive', title: 'שגיאה', description: j.error || 'הפרסום נכשל.' });
        }
        return;
      }

      const { status } = j;
      if (status === 'published') {
        toast({ title: '✅ הפוסט פורסם!', description: 'הפוסט עלה לאוויר ויחשף לכולם.' });
      } else if (status === 'pending_review') {
        toast({ title: '⏳ הפוסט בבדיקה', description: 'הפוסט נשלח לבדיקה ידנית לפני פרסום.' });
      } else {
        toast({ variant: 'destructive', title: 'פוסט נדחה', description: 'הפוסט לא עמד בקריטריוני הבטיחות.' });
      }

      setForm(EMPTY_FORM);
      setImageUrl('');
      onSuccess();
    } catch {
      toast({ variant: 'destructive', title: 'שגיאת רשת', description: 'נסה שוב מאוחר יותר.' });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'rounded-2xl border border-slate-200 px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-slate-300';
  const labelCls = 'text-xs font-medium text-slate-500 mb-1 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>סוג פוסט</label>
          <select value={form.postType} onChange={set('postType')} className={inputCls}>
            <option value="lost">🔴 אבד לי חיית מחמד</option>
            <option value="found">🟢 מצאתי חיית מחמד</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>סוג חיה</label>
          <select value={form.petType} onChange={set('petType')} className={inputCls}>
            <option value="dog">🐕 כלב</option>
            <option value="cat">🐈 חתול</option>
            <option value="bird">🐦 ציפור</option>
            <option value="other">🐾 אחר</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>שם החיה (אופציונלי)</label>
          <input value={form.petName} onChange={set('petName')} placeholder="למשל: בוקסר" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>גזע (אופציונלי)</label>
          <input value={form.breed} onChange={set('breed')} placeholder="למשל: לברדור" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>צבע עיקרי</label>
          <input value={form.colorPrimary} onChange={set('colorPrimary')} placeholder="שחור" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>גודל</label>
          <select value={form.sizeCategory} onChange={set('sizeCategory')} className={inputCls}>
            <option value="unknown">לא ידוע</option>
            <option value="tiny">קטנטן</option>
            <option value="small">קטן</option>
            <option value="medium">בינוני</option>
            <option value="large">גדול</option>
            <option value="giant">ענק</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>מין</label>
          <select value={form.sex} onChange={set('sex')} className={inputCls}>
            <option value="unknown">לא ידוע</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>עיר *</label>
          <input value={form.city} onChange={set('city')} placeholder="תל אביב" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>שכונה / אזור</label>
          <input value={form.area} onChange={set('area')} placeholder="הצפון הישן" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>תאריך האירוע *</label>
        <input type="date" value={form.eventDate} onChange={set('eventDate')} className={inputCls} required />
      </div>

      <div>
        <label className={labelCls}>תיאור מפורט *</label>
        <Textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="תאר את החיה בפירוט: צבע, עצים מיוחדים, פציעות, קולר, מה בדיוק קרה..."
          rows={5}
          className="rounded-2xl"
          required
        />
        <div className="text-xs text-slate-400 mt-1 text-left">{form.description.length}/2000</div>
      </div>

      <div>
        <label className={labelCls}>קישור לתמונה (URL) *</label>
        <input
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className={inputCls}
          required
        />
        {imageUrl && (
          <img src={imageUrl} alt="preview" className="mt-2 h-24 w-24 object-cover rounded-xl border border-slate-200" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>סכום גמול (₪) — אופציונלי</label>
          <input
            type="number" min="0" max="10000"
            value={form.rewardAmount}
            onChange={set('rewardAmount')}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>העדפת יצירת קשר</label>
          <select value={form.contactPreference} onChange={set('contactPreference')} className={inputCls}>
            <option value="inbox_first">הודעה פנימית תחילה</option>
            <option value="reveal_phone_after_accept">חשוף טלפון לאחר אישור</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>מספר טלפון ליצירת קשר (לא יוצג ישירות)</label>
        <input value={form.contactPhone} onChange={set('contactPhone')} placeholder="050-..." className={inputCls} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> פרסם פוסט</>}
      </button>

      <p className="text-xs text-slate-400 text-center">
        הפוסט עובר בדיקת בטיחות אוטומטית לפני פרסום. פרסום חינמי לחברי לויאלטי פעילים.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------
   MY POSTS TAB
------------------------------------------------------------------------- */

function MyPosts() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ rows: any[] }>({
    queryKey: ['/api/paw-finder/my/posts'],
  });

  const resolve = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/paw-finder/my/posts/${id}/resolve`),
    onSuccess: () => {
      toast({ title: '✅ הפוסט סומן כנפתר', description: 'תודה שעדכנת את הקהילה!' });
      qc.invalidateQueries({ queryKey: ['/api/paw-finder/my/posts'] });
    },
    onError: () => toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לסמן כנפתר.' }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> טוען...
    </div>
  );

  const rows: any[] = data?.rows ?? [];

  if (!rows.length) return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
      <Footprints className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="font-medium">אין לך פוסטים עדיין.</p>
      <p className="text-sm mt-1">עבור ל"הגשת פוסט" כדי לפרסם.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rows.map(post => (
        <PostCard
          key={post.id}
          post={post}
          isOwner
          showResolve
          onResolve={() => resolve.mutate(post.id)}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
   MAIN PAGE
------------------------------------------------------------------------- */

type Tab = 'browse' | 'report' | 'my';

export default function PawFinder({ language }: PawFinderProps) {
  const isHe = language === 'he';
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('browse');
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [filterCity, setFilterCity] = useState('');
  const [filterPet, setFilterPet] = useState('');
  const [contactPost, setContactPost] = useState<PawPost | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, isFetching } = useQuery<{ rows: PawPost[] }>({
    queryKey: ['/api/paw-finder/posts', filterType, filterCity, filterPet],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (filterType !== 'all') q.set('postType', filterType);
      if (filterCity.trim()) q.set('city', filterCity.trim());
      if (filterPet) q.set('petType', filterPet);
      const r = await fetch(`/api/paw-finder/posts?${q}`);
      return r.json();
    },
  });

  const posts: PawPost[] = data?.rows ?? [];
  const selectedPost = selectedId ? posts.find(p => p.id === selectedId) : null;

  const handleMapSelect = useCallback((id: number) => setSelectedId(id), []);

  const TAB_ITEMS: { key: Tab; label: string; icon: any }[] = [
    { key: 'browse', label: 'גלה פוסטים', icon: Search },
    { key: 'report', label: 'הגשת פוסט', icon: Plus },
    { key: 'my',     label: 'הפוסטים שלי', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir={isHe ? 'rtl' : 'ltr'}>
      {contactPost && <ContactModal post={contactPost} onClose={() => setContactPost(null)} />}

      {/* Hero */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">
                Pet Wash™
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                🐾 Paw Finder
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {isHe
                  ? 'עוזרים לחיות אבודות למצוא את הדרך הביתה. חינמי לחברי לויאלטי.'
                  : 'Helping lost pets find their way home. Free for loyalty members.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-full">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>{posts.filter(p => p.post_type === 'lost').length} אבודים</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{posts.filter(p => p.post_type === 'found').length} נמצאו</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 border-b border-slate-100 overflow-x-auto">
            {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === key
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* -------- BROWSE TAB -------- */}
        {tab === 'browse' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {(['all', 'lost', 'found'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'all' ? 'הכל' : t === 'lost' ? '🔴 אבודים' : '🟢 נמצאו'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs bg-white border border-slate-200 rounded-2xl px-3">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                  placeholder="סנן לפי עיר..."
                  className="flex-1 py-2 text-sm outline-none bg-transparent"
                />
              </div>

              <div className="flex items-center gap-2 min-w-[150px] bg-white border border-slate-200 rounded-2xl px-3">
                <Footprints className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <select
                  value={filterPet}
                  onChange={e => setFilterPet(e.target.value)}
                  className="flex-1 py-2 text-sm outline-none bg-transparent"
                >
                  <option value="">כל החיות</option>
                  <option value="dog">🐕 כלב</option>
                  <option value="cat">🐈 חתול</option>
                  <option value="bird">🐦 ציפור</option>
                  <option value="other">🐾 אחר</option>
                </select>
              </div>

              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400 self-center" />}
            </div>

            {/* Map + List */}
            <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
              {/* Map */}
              <div className="h-[520px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-100">
                <PawFinderMap posts={posts} onSelect={handleMapSelect} />
              </div>

              {/* List */}
              <div className="overflow-y-auto max-h-[520px] space-y-3 pr-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> טוען...
                  </div>
                ) : posts.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
                    <Footprints className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">לא נמצאו פוסטים</p>
                    <p className="text-sm mt-1">נסה לשנות את הפילטרים.</p>
                  </div>
                ) : (
                  posts.map(post => (
                    <div
                      key={post.id}
                      id={`post-${post.id}`}
                      className={`transition-all ${selectedId === post.id ? 'ring-2 ring-slate-900 rounded-2xl' : ''}`}
                      onClick={() => setSelectedId(post.id === selectedId ? null : post.id)}
                    >
                      <PostCard
                        post={post}
                        onContact={user ? () => setContactPost(post) : undefined}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected Post Detail */}
            {selectedPost && (
              <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${selectedPost.post_type === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {selectedPost.post_type === 'lost' ? '🔴 אבוד' : '🟢 נמצא'}
                      </span>
                      {selectedPost.status !== 'published' && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedPost.status] || ''}`}>
                          {STATUS_LABELS[selectedPost.status] || selectedPost.status}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold">{selectedPost.pet_name || 'ללא שם'}</h3>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {selectedPost.city}{selectedPost.area ? `, ${selectedPost.area}` : ''} · {formatDate(selectedPost.event_date)}
                    </div>
                    <p className="text-sm text-slate-700 mt-3 leading-relaxed">{selectedPost.description}</p>
                    {selectedPost.matched_post_count > 0 && (
                      <div className="mt-3 rounded-xl bg-sky-50 border border-sky-200 px-4 py-2 text-sm text-sky-700 font-medium">
                        ✨ נמצאו {selectedPost.matched_post_count} התאמות אפשריות לפוסט זה
                      </div>
                    )}
                  </div>
                  {selectedPost.primary_media && (
                    <img src={selectedPost.primary_media} alt="" className="w-28 h-28 object-cover rounded-2xl flex-shrink-0" />
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  {user && selectedPost.status !== 'resolved' && (
                    <button
                      onClick={() => setContactPost(selectedPost)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" /> צור קשר עם הבעלים
                    </button>
                  )}
                  {!user && (
                    <div className="text-sm text-slate-500 flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
                      <AlertCircle className="w-4 h-4" /> עליך להתחבר כדי ליצור קשר
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* -------- REPORT TAB -------- */}
        {tab === 'report' && (
          <div className="max-w-2xl mx-auto">
            {!user ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                <h3 className="font-semibold text-amber-900">נדרשת התחברות</h3>
                <p className="text-sm text-amber-700 mt-1">עליך להתחבר כדי לפרסם פוסט ב-Paw Finder.</p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">פוסט חדש</div>
                  <h2 className="text-2xl font-bold">הגשת דיווח</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    חינמי לחברי לויאלטי פעילים. כל פוסט עובר בדיקה אוטומטית לפני פרסום.
                  </p>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <ReportForm onSuccess={() => {
                    qc.invalidateQueries({ queryKey: ['/api/paw-finder/posts'] });
                    setTab('my');
                  }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------- MY POSTS TAB -------- */}
        {tab === 'my' && (
          <div className="max-w-3xl mx-auto">
            {!user ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">עליך להתחבר כדי לצפות בפוסטים שלך.</p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-2xl font-bold">הפוסטים שלי</h2>
                  <p className="text-slate-500 text-sm mt-1">נהל את הפוסטים שלך — אשר, סמן כנפתר ועוד.</p>
                </div>
                <MyPosts />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
