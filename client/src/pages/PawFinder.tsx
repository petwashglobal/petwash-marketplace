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
  Upload, Camera, Bell, BellDot, X, Filter,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { sanitizeUrl } from '@/lib/utils';

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
  const isDemo = post.post_key?.startsWith('demo-');

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${isLost ? 'border-rose-100' : 'border-emerald-100'} ${isDemo ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}>
      {isDemo && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1 flex items-center gap-1.5 text-xs text-amber-700 font-medium">
          <span>⚠️</span>
          <span>דוגמה להמחשה בלבד — DEMO ONLY</span>
        </div>
      )}
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
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-1 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> 🎉 נפתר! הסר פוסט
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
          placeholder={'תאר מה ראית, היכן, מתי, ומה מצב הבע"ח...'}
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

  // Real file upload state
  const [uploadedFilePath, setUploadedFilePath] = useState('');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location state
  const [locLoading, setLocLoading] = useState(false);

  const set = (k: keyof typeof EMPTY_FORM) => (e: any) =>
    setForm(prev => ({ ...prev, [k]: e.target?.value ?? e }));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'קובץ לא תקין', description: 'יש להעלות תמונה בלבד (JPEG/PNG/WebP/HEIC).' });
      return;
    }
    // Validate size (15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'קובץ גדול מדי', description: 'הגודל המקסימלי הוא 15MB.' });
      return;
    }

    // Show local preview immediately
    setUploadPreviewUrl(URL.createObjectURL(file));
    setUploadProgress('uploading');

    try {
      const fd = new FormData();
      fd.append('photo', file);

      const r = await fetch('/api/paw-finder/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const j = await r.json();

      if (!r.ok) {
        setUploadProgress('error');
        toast({ variant: 'destructive', title: 'העלאה נכשלה', description: j.message || 'נסה שוב.' });
        return;
      }

      if (j.duplicate) {
        toast({ title: '⚠️ תמונה כפולה', description: `תמונה זו כבר בשימוש בפוסט ${j.duplicate.post_key}. ניתן להמשיך.` });
      }

      setUploadedFilePath(j.filePath);
      setUploadProgress('done');
      toast({ title: '✅ תמונה הועלתה בהצלחה' });
    } catch {
      setUploadProgress('error');
      toast({ variant: 'destructive', title: 'שגיאת רשת', description: 'ההעלאה נכשלה. בדוק חיבור לאינטרנט ונסה שוב.' });
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'GPS לא נתמך', description: 'הדפדפן שלך לא תומך במיקום.' });
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocLoading(false);
        toast({ title: '📍 מיקום נלכד', description: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` });
      },
      err => {
        setLocLoading(false);
        const msg = err.code === 1 ? 'אישור מיקום נדחה. אנא הזן עיר ידנית.' :
                    err.code === 3 ? 'פסק זמן - אנא הזן עיר ידנית.' :
                    'לא ניתן לאחזר מיקום.';
        toast({ variant: 'destructive', title: 'שגיאת מיקום', description: msg });
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

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
    if (!uploadedFilePath) {
      toast({ variant: 'destructive', title: 'תמונה חסרה', description: 'יש להעלות תמונה של החיה.' });
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
        mediaFiles: [{ filePath: uploadedFilePath, mediaRole: 'primary' }],
      };

      const r = await fetch('/api/paw-finder/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await r.json();

      if (!r.ok) {
        if (j.error === 'loyalty_membership_required' || j.error === 'club_membership_required') {
          toast({ variant: 'destructive', title: '🔐 נדרשת חברות מועדון מאומתת', description: 'כדי לפרסם ב-Paw Finder יש להיות חבר מועדון PetWash™ מאומת.' });
        } else if (j.error === 'phone_verification_required') {
          toast({ variant: 'destructive', title: '📱 נדרש אימות SMS', description: 'יש לאמת את מספר הטלפון לפני פרסום. גש להגדרות החשבון.' });
        } else if (j.error === 'DAILY_LIMIT_REACHED') {
          toast({ variant: 'destructive', title: 'הגעת למגבלה היומית', description: 'ניתן לפרסם עד 5 פוסטים ביום.' });
        } else if (j.error === 'DUPLICATE_IMAGE') {
          toast({ variant: 'destructive', title: 'תמונה כפולה', description: `תמונה זו כבר בשימוש בפוסט ${j.existingPostKey}.` });
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
      setUploadedFilePath('');
      setUploadPreviewUrl('');
      setUploadProgress('idle');
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
          <div className="flex gap-2">
            <input value={form.city} onChange={set('city')} placeholder="תל אביב" className={`${inputCls} flex-1`} required />
            <button
              type="button"
              onClick={requestLocation}
              disabled={locLoading}
              title="זיהוי מיקום GPS"
              className="flex-shrink-0 flex items-center justify-center w-11 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {locLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <MapPin className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
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
        <label className={labelCls}>תמונת החיה *</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="space-y-3">
          {/* Upload buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" /> בחר מהגלריה
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              <Camera className="w-4 h-4" /> צלם עכשיו
            </button>
          </div>

          {/* Upload status */}
          {uploadProgress === 'uploading' && (
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> מעלה תמונה...
            </div>
          )}
          {uploadProgress === 'error' && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4" /> העלאה נכשלה —
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="underline font-medium"
              >
                נסה שוב
              </button>
            </div>
          )}
          {uploadProgress === 'done' && uploadPreviewUrl && (
            <div className="flex items-center gap-3">
              <img src={sanitizeUrl(uploadPreviewUrl)} alt="preview" className="h-24 w-24 object-cover rounded-xl border border-slate-200" />
              <div className="flex-1">
                <div className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> תמונה הועלתה
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFilePath('');
                    setUploadPreviewUrl('');
                    setUploadProgress('idle');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-slate-400 hover:text-slate-700 mt-1 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> החלף תמונה
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">JPEG/PNG/WebP/HEIC · מקסימום 15MB · נדחס אוטומטית</p>
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

      {/* ── Point-of-collection consent disclosure (Israeli Privacy Law §11) ── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5" dir="rtl">
        <p className="font-semibold text-slate-700 text-sm">הודעת עיבוד מידע — Paw Finder™</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>תמונות:</strong> הקובץ שהעלת מועבר לשרתי PetWash, נדחס אוטומטית ונבדק ע"י AI לאיתור תוכן פוגעני לפני פרסום. לא מועבר לגורמים חיצוניים.</li>
          <li><strong>מיקום GPS:</strong> אם לחצת על כפתור המיקום — המיקום המדויק <em>אינו נשמר</em>; נשמרת קירוב ברדיוס ~1.1 ק"מ בלבד.</li>
          <li><strong>טלפון:</strong> אינו מוצג בפומבי. ייחשף רק לאחר אישורך המפורש לבקשת קשר ספציפית.</li>
          <li><strong>מחיקה:</strong> ניתן למחוק את הפוסט בכל עת מ"האזור שלי".</li>
        </ul>
        <p>
          בלחיצה על "פרסם פוסט" אתה מסכים לעיבוד המידע כמתואר ב
          <a href="/privacy-policy#paw-finder" target="_blank" rel="noopener noreferrer" className="underline mr-1 font-medium text-slate-800">
            מדיניות הפרטיות
          </a>
          — סעיף 12 (Paw Finder).
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting || uploadProgress === 'uploading'}
        className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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

  const allRows: any[] = data?.rows ?? [];
  // hide resolved posts — they're done, no need to keep showing them
  const rows = allRows.filter(p => p.status !== 'resolved');

  if (!allRows.length) return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
      <Footprints className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="font-medium">אין לך פוסטים עדיין.</p>
      <p className="text-sm mt-1">עבור ל"הגשת פוסט" כדי לפרסם.</p>
    </div>
  );

  if (!rows.length) return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-10 text-center">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
      <p className="font-semibold text-emerald-800">כל הפוסטים שלך נפתרו 🎉</p>
      <p className="text-sm text-emerald-600 mt-1">שמחנו לעזור! ניתן לפרסם פוסט חדש בכל עת.</p>
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

function NotificationsTab({ user }: { user: any }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ rows: any[]; unreadCount: number }>({
    queryKey: ['/api/paw-finder/my/notifications'],
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: () => apiRequest('POST', '/api/paw-finder/my/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/paw-finder/my/notifications'] }),
  });

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="font-medium">עליך להתחבר כדי לצפות בהתראות.</p>
      </div>
    );
  }

  const notifs = data?.rows ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {unread > 0 ? <BellDot className="w-5 h-5 text-amber-500" /> : <Bell className="w-5 h-5 text-slate-400" />}
          התראות
          {unread > 0 && <span className="text-sm font-normal text-amber-600">({unread} לא נקראו)</span>}
        </h2>
        {unread > 0 && (
          <button
            onClick={() => markRead.mutate()}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            סמן הכל כנקרא
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : notifs.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          <Bell className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>אין התראות חדשות</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n: any) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-4 transition-colors ${n.read ? 'bg-white border-slate-200' : 'bg-amber-50 border-amber-200'}`}
            >
              <div className="font-medium text-sm">{n.title}</div>
              <div className="text-sm text-slate-600 mt-0.5">{n.body}</div>
              <div className="text-xs text-slate-400 mt-1">
                {new Date(n.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactsTab({ user }: { user: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ rows: any[] }>({
    queryKey: ['/api/paw-finder/my/contacts'],
    enabled: !!user,
  });

  const acceptMut = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/paw-finder/my/contacts/${id}/accept`),
    onSuccess: () => {
      toast({ title: '✅ קשר התקבל' });
      qc.invalidateQueries({ queryKey: ['/api/paw-finder/my/contacts'] });
    },
  });

  const declineMut = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/paw-finder/my/contacts/${id}/decline`),
    onSuccess: () => {
      toast({ title: 'בקשה נדחתה' });
      qc.invalidateQueries({ queryKey: ['/api/paw-finder/my/contacts'] });
    },
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center py-6 text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-400 text-sm">
          <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
          אין בקשות קשר
        </div>
      ) : (
        rows.map((cr: any) => (
          <div key={cr.id} className={`rounded-2xl border p-4 ${cr.status === 'pending' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-xs text-slate-500 mb-1">
                  {cr.post_type === 'lost' ? '🔴' : '🟢'} {cr.pet_name || cr.pet_type} · {cr.city}
                </div>
                <div className="text-sm font-medium text-slate-800">{cr.message_text}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(cr.created_at).toLocaleDateString('he-IL')}
                  {cr.contact_phone && (
                    <span className="mr-2 text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <Phone className="w-3.5 h-3.5" /> {cr.contact_phone}
                    </span>
                  )}
                </div>
              </div>
              {cr.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => acceptMut.mutate(cr.id)}
                    disabled={acceptMut.isPending}
                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    קבל
                  </button>
                  <button
                    onClick={() => declineMut.mutate(cr.id)}
                    disabled={declineMut.isPending}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    דחה
                  </button>
                </div>
              )}
              {cr.status !== 'pending' && (
                <span className={`text-xs px-2 py-1 rounded-lg ${cr.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {cr.status === 'accepted' ? 'התקבל' : 'נדחה'}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function PawFinder({ language }: PawFinderProps) {
  const isHe = language === 'he';
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    if (p === 'report' || p === 'post' || p === 'new' || p === 'ad') return 'report';
    if (p === 'my') return 'my';
    return 'browse';
  });
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [filterCity, setFilterCity] = useState('');
  const [filterPet, setFilterPet] = useState('');
  const [filterBreed, setFilterBreed] = useState('');
  const [filterReward, setFilterReward] = useState(false);
  const [contactPost, setContactPost] = useState<PawPost | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mySubTab, setMySubTab] = useState<'posts' | 'contacts' | 'notifications'>('posts');

  const { data, isLoading, isFetching } = useQuery<{ rows: PawPost[] }>({
    queryKey: ['/api/paw-finder/posts', filterType, filterCity, filterPet, filterBreed, filterReward],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (filterType !== 'all') q.set('postType', filterType);
      if (filterCity.trim()) q.set('city', filterCity.trim());
      if (filterPet) q.set('petType', filterPet);
      if (filterBreed.trim()) q.set('breed', filterBreed.trim());
      if (filterReward) q.set('hasReward', 'true');
      const r = await fetch(`/api/paw-finder/posts?${q}`);
      return r.json();
    },
  });

  // Notification count badge
  const notifQ = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/paw-finder/my/notifications'],
    enabled: !!user,
    refetchInterval: 30_000,
    select: d => ({ unreadCount: (d as any).unreadCount ?? 0 }),
  });
  const unreadCount = notifQ.data?.unreadCount ?? 0;

  const posts: PawPost[] = data?.rows ?? [];
  const selectedPost = selectedId ? posts.find(p => p.id === selectedId) : null;

  const handleMapSelect = useCallback((id: number) => setSelectedId(id), []);

  const TAB_ITEMS: { key: Tab; label: string; icon: any }[] = [
    { key: 'browse', label: 'גלה פוסטים', icon: Search },
    { key: 'report', label: 'הגשת פוסט', icon: Plus },
    { key: 'my',     label: 'האזור שלי', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir={isHe ? 'rtl' : 'ltr'}>
      {contactPost && <ContactModal post={contactPost} onClose={() => setContactPost(null)} />}

      {/* ===================== HERO ===================== */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #ff8e53 40%, #00C9A7 100%)' }}
      >
        {/* decorative paw prints */}
        <div className="absolute inset-0 opacity-10 select-none pointer-events-none overflow-hidden" aria-hidden>
          {['top-4 left-8 text-7xl rotate-12','bottom-6 right-12 text-8xl -rotate-12',
            'top-1/2 left-1/4 text-6xl rotate-6','top-8 right-1/3 text-5xl -rotate-6',
            'bottom-4 left-1/2 text-9xl rotate-3'].map((cls, i) => (
            <span key={i} className={`absolute ${cls}`}>🐾</span>
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-8">
          {/* Top label */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">PetWash™ · שירות קהילתי חינמי</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            {/* Headline block */}
            <div className="flex-1">
              <h1 className="text-5xl md:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-sm">
                🐾 Paw Finder
              </h1>
              <p className="text-white/90 text-xl md:text-2xl font-semibold mt-2 leading-snug">
                הפלטפורמה הקהילתית לחיות אבודות ונמצאות
              </p>
              <p className="text-white/75 text-base mt-2 max-w-xl leading-relaxed">
                אנחנו מאמינים שכל חיית מחמד ראויה לחזור הביתה. Paw Finder הוא שירות חינמי לחלוטין עבור כל חברי הקהילה שלנו — פרסמו, גלו, ועזרו לחיות אבודות למצוא את הדרך הביתה.
              </p>
              <p className="text-white/60 text-sm mt-1">
                Free community service · Serving Tel Aviv, Ramat Gan & all Israel · Powered by PetWash™
              </p>

              {/* Live stats */}
              <div className="flex items-center gap-4 mt-5 flex-wrap">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2.5">
                  <Heart className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">{posts.filter(p => p.post_type === 'lost').length} חיות אבודות</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">{posts.filter(p => p.post_type === 'found').length} נמצאו</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2.5">
                  <MapPin className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">תל אביב, רמת גן וסביבה</span>
                </div>
              </div>
            </div>

            {/* CTA card */}
            <div className="flex-shrink-0 bg-white/95 backdrop-blur-sm rounded-3xl p-6 shadow-2xl w-full lg:w-80">
              <div className="text-center mb-4">
                <div className="text-3xl mb-1">🆓</div>
                <div className="font-bold text-slate-900 text-lg leading-tight">פרסום מודעה — חינמי לגמרי</div>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                  חבר קהילה? פרסם מיד. אבדה לך חיית מחמד? פרסם בחינם תוך דקה.
                </p>
              </div>
              <button
                onClick={() => setTab('report')}
                className="w-full py-3 rounded-2xl font-bold text-white text-base shadow-lg hover:opacity-90 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #ff8e53)' }}
              >
                📢 פרסם מודעה עכשיו
              </button>
              <button
                onClick={() => setTab('browse')}
                className="w-full py-3 rounded-2xl font-semibold text-slate-700 text-sm mt-2 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                🗺️ חפש בפוסטים הפעילים
              </button>
            </div>
          </div>
        </div>

        {/* How it works strip */}
        <div className="relative bg-white/10 backdrop-blur-sm border-t border-white/20">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '📸', title: 'צלם ופרסם', desc: 'העלה תמונה, תאר את החיה ואת המיקום — הפוסט עולה לאוויר תוך שניות.' },
                { icon: '🗺️', title: 'מפה חיה', desc: 'כל הפוסטים מופיעים על מפה אינטראקטיבית. ראה מיד מה קורה בסביבתך.' },
                { icon: '🤝', title: 'קישור קהילתי', desc: 'המערכת מתאימה אוטומטית בין דיווחי "אבוד" ו"נמצא" ומחברת בין האנשים הנכונים.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 text-white">
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div>
                    <div className="font-bold text-sm">{title}</div>
                    <div className="text-white/70 text-xs mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===================== TABS BAR ===================== */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  tab === key
                    ? 'border-rose-500 text-rose-600'
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

              <div className="flex items-center gap-2 min-w-[140px] bg-white border border-slate-200 rounded-2xl px-3">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  value={filterBreed}
                  onChange={e => setFilterBreed(e.target.value)}
                  placeholder="גזע..."
                  className="flex-1 py-2 text-sm outline-none bg-transparent"
                />
              </div>

              <button
                onClick={() => setFilterReward(!filterReward)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-sm font-medium transition-colors ${
                  filterReward
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Gift className="w-3.5 h-3.5" /> עם גמול
              </button>

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
                    זמין לחברי מועדון PetWash™ מאומתי SMS. כל פוסט עובר בדיקה אוטומטית לפני פרסום.
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

        {/* -------- MY TAB -------- */}
        {tab === 'my' && (
          <div className="max-w-3xl mx-auto">
            {!user ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">עליך להתחבר כדי לצפות באזור האישי שלך.</p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-2xl font-bold">האזור שלי</h2>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1 mb-5 border-b border-slate-100">
                  {([ 
                    { key: 'posts' as const, label: 'הפוסטים שלי', icon: Star },
                    { key: 'contacts' as const, label: 'בקשות קשר', icon: MessageSquare },
                    { key: 'notifications' as const, label: 'התראות', icon: unreadCount > 0 ? BellDot : Bell, badge: unreadCount },
                  ]).map(({ key, label, icon: Icon, badge }) => (
                    <button
                      key={key}
                      onClick={() => setMySubTab(key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        mySubTab === key
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${key === 'notifications' && unreadCount > 0 ? 'text-amber-500' : ''}`} />
                      {label}
                      {badge ? (
                        <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                {mySubTab === 'posts' && <MyPosts />}
                {mySubTab === 'contacts' && <ContactsTab user={user} />}
                {mySubTab === 'notifications' && <NotificationsTab user={user} />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
