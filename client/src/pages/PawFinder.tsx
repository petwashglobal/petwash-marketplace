/**
 * Paw Finder™‎ — Lost & Found Pet Platform
 * PostgreSQL-backed | Gemini-moderated | Loyalty-gated posting
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AuthGateCard } from '@/components/AuthGateCard';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { type Language } from '@/lib/i18n';
import {
  Search, MapPin, Heart, AlertCircle, CheckCircle2,
  Gift, Loader2, Plus, ChevronRight, Phone, MessageSquare,
  Dog, Cat, Bird, Footprints, Star, Clock, Eye,
  Upload, Camera, Bell, BellDot, X, Filter,
  Share2, Palette, ChevronLeft, ChevronDown, Map as MapIcon, PawPrint, User as UserIcon, Users, ClipboardList, Home as HomeIcon,
} from 'lucide-react';
import {
  EditorialHeader, PillarRow, StepsBand, ClosingBand, SideNav, Chip, placeLine, GOLD, GOLD_INK, HAIRLINE, PAPER, SERIF, INK,
} from '@/components/pet-community/Editorial';
import { ExamplePreview, pawFinderExamples } from '@/components/pet-community/ExamplePreview';
import { apiRequest, getFirebaseBearerToken } from '@/lib/queryClient';
import { sanitizeUrl } from '@/lib/utils';
import { PetWashIcon } from '@/components/PetWashIcon';
import { SocialShare } from '@/components/SocialShare';
import { useSEO, pageSEO } from '@/lib/seo';

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
  /** Owner's phone — present ONLY when they chose 'public_phone' (max-reach). Anyone can ring. */
  public_phone?: string | null;
  contact_preference?: string;
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
  /** Deep link /paw-finder/:id — opens that post's detail on load (2026-09-12). */
  initialPostId?: number;
}

/* -------------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  published:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  matched:        'bg-[#D4AF37] text-black border-[#D4AF37]',
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
  // The map loads asynchronously; posts usually arrive first. Without this the
  // marker effect bailed out on first render and the map opened with NO pins.
  const [ready, setReady] = useState(false);

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
      setReady(true);
    });

    return () => {
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !leafletRef.current) return;
    import('leaflet').then(mod => {
      const L = mod.default;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const postsWithCoords = posts.filter(p => p.latitude && p.longitude);

      postsWithCoords.forEach(post => {
        const lat = Number(post.latitude);
        const lng = Number(post.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const color = post.post_type === 'lost' ? '#D64545' : '#2E8B57';
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
  }, [posts, onSelect, ready]);

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
  const [imageFailed, setImageFailed] = useState(false);
  const mediaUrl = sanitizeUrl(post.primary_media);

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${isLost ? 'border-rose-100' : 'border-emerald-100'}`}>
      <div className="flex gap-0">
        <div className="w-[120px] flex-shrink-0">
          {mediaUrl && !imageFailed ? (
            <img
              src={mediaUrl}
              alt={post.pet_name || ''}
              className="w-full h-full object-cover min-h-[120px]"
              onError={() => setImageFailed(true)}
            />
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
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#D4AF37] text-black border border-[#D4AF37]">
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
    // Demo/featured cards seeded with id=-1/-2/-3 have no server row. Contacting
    // them used to POST /api/paw-finder/posts/-1/contact → 404 POST_NOT_FOUND
    // with a generic error toast (audit F7). Give the user a clear message
    // instead of a broken button.
    if (typeof post.id === 'number' && post.id < 0) {
      toast({
        variant: 'destructive',
        title: 'זו דוגמה בלבד',
        description: 'הפוסט הזה מוצג להמחשה. אנא בחר פוסט אמיתי כדי לשלוח הודעה.',
      });
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      const bt = await getFirebaseBearerToken(); // Bearer → CSRF-exempt (cookie-only POST was 403'ing in prod)
      const r = await fetch(`/api/paw-finder/posts/${post.id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(bt ? { Authorization: `Bearer ${bt}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ messageText: message.trim() }),
      });
      if (!r.ok) {
        // Surface the real server error instead of a generic "failed" — auth
        // failures, rate limits, and validation errors all deserve a real message.
        let serverMsg = '';
        try {
          const body = await r.json();
          serverMsg = String(body?.message || body?.error || '');
        } catch { /* ignore */ }
        throw new Error(serverMsg || `HTTP ${r.status}`);
      }
      toast({ title: '✅ הבקשה נשלחה', description: 'בעל הפוסט יקבל את הודעתך.' });
      onClose();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: err?.message ? String(err.message) : 'לא הצלחנו לשלוח את הבקשה. נסה שוב.',
      });
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
  // PawFinder™‎ is LOST ↔ FOUND only. Adoption has its own flow at /adoption/new.
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
  // The sha256 hash returned by /api/paw-finder/upload — passed back on
  // /posts so dedupe survives multi-instance Cloud Run (the /posts container
  // may not be the same as the /upload container, so a disk-only lookup
  // silently no-ops). Kept in sync with uploadedFilePath.
  const [uploadedHash, setUploadedHash] = useState('');
  // Record what the photo actually is: adoption/paw_finder media.mime_type was
  // NULL on every live post because the client had nothing to send (2026-09-16).
  const [uploadedMime, setUploadedMime] = useState('');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location state
  const [locLoading, setLocLoading] = useState(false);
  // Captured GPS coords — were toasted but never stored/sent, so every post saved
  // NULL coords → missing from the Leaflet map + lost the proximity match. (2026-07-27)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

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

      const bt = await getFirebaseBearerToken(); // Bearer → CSRF-exempt
      const r = await fetch('/api/paw-finder/upload', {
        method: 'POST',
        headers: bt ? { Authorization: `Bearer ${bt}` } : {},
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
      setUploadedHash(j.hash || '');
      setUploadedMime(j.mimeType || '');
      setUploadProgress('done');
      toast({ title: '✅ תמונה הועלתה בהצלחה' });

      // 2026-08-19 COMPETITIVE (WhatIDog gap): Gemini identified this photo
      // for us. Auto-fill species / breed / primary color where the user hasn't
      // typed anything yet, so a distraught owner gets a pre-filled report
      // instead of a blank form. Preserve any manual edits — we ONLY set
      // fields that are still their EMPTY_FORM default. Skip degraded results
      // (no key / not a pet / gemini_error) — the user just types manually.
      const ident = j.identification;
      if (ident && !ident.degraded && (ident.confidence ?? 0) >= 0.35) {
        setForm((prev) => {
          const next = { ...prev };
          // Only overwrite defaults, never overwrite what the user typed.
          if (ident.species && (['dog', 'cat', 'bird'].includes(ident.species) || ident.species === 'other')) {
            if (prev.petType === EMPTY_FORM.petType) next.petType = ident.species as typeof prev.petType;
          }
          if (ident.breedGuess && !prev.breed.trim()) {
            next.breed = String(ident.breedGuess).slice(0, 100);
          }
          if (ident.primaryColor && !prev.colorPrimary.trim()) {
            next.colorPrimary = String(ident.primaryColor).slice(0, 60);
          }
          return next;
        });
        // Only show a nudge toast if we actually filled something.
        if (ident.breedGuess || ident.primaryColor || ident.species) {
          toast({ title: '🤖 זיהוי אוטומטי', description: 'מילאנו את הפרטים שזיהינו. ניתן לערוך.' });
        }
      }
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
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
        // Include the captured GPS so the post shows on the map + scores proximity
        // (server also accepts these optionally). (2026-07-27)
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
        mediaFiles: [{
          filePath: uploadedFilePath,
          mediaRole: 'primary',
          ...(uploadedMime ? { mimeType: uploadedMime } : {}),
          ...(uploadedHash ? { hash: uploadedHash } : {}),
        }],
      };

      const bt = await getFirebaseBearerToken(); // Bearer → CSRF-exempt
      const r = await fetch('/api/paw-finder/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(bt ? { Authorization: `Bearer ${bt}` } : {}) },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await r.json();

      if (!r.ok) {
        if (j.error === 'loyalty_membership_required' || j.error === 'club_membership_required') {
          toast({ variant: 'destructive', title: '🔐 נדרשת חברות מועדון מאומתת', description: 'כדי לפרסם ב-Paw Finder יש להיות חבר מועדון PetWash™‎ מאומת.' });
        } else if (j.error === 'phone_verification_required') {
          toast({ variant: 'destructive', title: '📱 נדרש אימות SMS', description: 'יש לאמת את מספר הטלפון לפני פרסום. גש להגדרות החשבון.' });
        } else if (j.error === 'DAILY_LIMIT_REACHED') {
          toast({ variant: 'destructive', title: 'הגעת למגבלה היומית', description: 'ניתן לפרסם עד 5 פוסטים ביום.' });
        } else if (j.error === 'DUPLICATE_IMAGE') {
          toast({ variant: 'destructive', title: 'תמונה כפולה', description: `תמונה זו כבר בשימוש בפוסט ${j.existingPostKey}.` });
        } else if (j.status === 'rejected' || /reject/i.test(String(j.error || ''))) {
          // A safety-rejected post returns 422 (!r.ok), so it landed here instead of
          // the success-branch 'rejected' case — show the real reason, not "failed".
          toast({ variant: 'destructive', title: 'פוסט נדחה', description: j.message || j.reason || 'הפוסט לא עמד בקריטריוני הבטיחות.' });
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
      setUploadedFilePath(''); setUploadedHash(''); setUploadedMime('');
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
          {/* Rehoming is not a lost/found notice — it has its own service. */}
          <a href="/adoption/new" className="mt-1.5 inline-block text-xs text-slate-500 underline" data-testid="link-adoption-instead">
            מחפשים בית חדש לחיה? לשירות האימוץ ←
          </a>
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
                    setUploadedFilePath(''); setUploadedHash(''); setUploadedMime('');
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
            <option value="inbox_first">הודעה פנימית תחילה (פרטי)</option>
            <option value="reveal_phone_after_accept">חשוף טלפון לאחר אישור</option>
            <option value="public_phone">הצג טלפון לכולם — חשיפה מקסימלית 📣</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">לחיה אבודה — "הצג טלפון לכולם" מאפשר לכל אחד להתקשר ישירות, גם בלי חשבון. כמו מודעה על עץ, רק עם הרבה יותר טווח.</p>
        </div>
      </div>

      <div>
        <label className={labelCls}>מספר טלפון ליצירת קשר (לא יוצג ישירות)</label>
        <input value={form.contactPhone} onChange={set('contactPhone')} placeholder="050-..." className={inputCls} />
      </div>

      {/* ── Point-of-collection consent disclosure (Israeli Privacy Law §11) ── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5" dir="rtl">
        <p className="font-semibold text-slate-700 text-sm">הודעת עיבוד מידע — Paw Finder™‎</p>
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

/* -------------------------------------------------------------------------
   CANONICAL BOARD (CEO mockup 2026-09-13) — Live Map · alerts · matches
------------------------------------------------------------------------- */

type BoardView = 'map' | 'lost' | 'found' | 'matches' | 'alerts' | 'messages' | 'profile' | 'report';
type TimeWindow = 'any' | '24h' | '3d' | '7d' | '30d';

const WINDOW_MS: Record<TimeWindow, number> = { any: 0, '24h': 864e5, '3d': 3 * 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 };

const SIZE_LABEL: Record<string, [string, string]> = {
  tiny: ['זעיר', 'Tiny'], small: ['קטן', 'Small'], medium: ['בינוני', 'Medium'], large: ['גדול', 'Large'], giant: ['ענק', 'Giant'],
};

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** "Last seen today / 3 days ago" from the event date (date only), honest about precision. */
function seenAgo(isHe: boolean, post: PawPost): string {
  const d = new Date(`${post.event_date}T12:00:00`);
  if (isNaN(d.getTime())) return '';
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 864e5));
  const lost = post.post_type === 'lost';
  if (isHe) {
    const when = days === 0 ? 'היום' : days === 1 ? 'אתמול' : `לפני ${days} ימים`;
    return `${lost ? 'נראה לאחרונה' : 'נמצא'} ${when}`;
  }
  const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `${lost ? 'Last seen' : 'Found'} ${when}`;
}

const SAVED_KEY = 'pw_pawfinder_saved_alerts';
function readSaved(): number[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}

async function shareAlert(post: PawPost, isHe: boolean, toast: (t: any) => void) {
  const url = `${window.location.origin}/paw-finder/${post.id}`;
  const title = post.post_type === 'lost'
    ? (isHe ? `עזרו למצוא את ${post.pet_name || 'החיה האבודה'} | PawFinder™‎` : `Help find ${post.pet_name || 'this lost pet'} | PawFinder™‎`)
    : (isHe ? `נמצאה חיה ב${post.city} — מכירים? | PawFinder™‎` : `Pet found in ${post.city} — know them? | PawFinder™‎`);
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    toast({ title: isHe ? 'הקישור הועתק' : 'Link copied', description: isHe ? 'הדביקו בוואטסאפ או ברשתות.' : 'Paste it in WhatsApp or social.' });
  } catch { /* share sheet dismissed */ }
}

function TypePill({ isHe, type }: { isHe: boolean; type: string }) {
  const lost = type === 'lost';
  return (
    <span className="rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white" style={{ background: lost ? '#D64545' : '#2E8B57' }}>
      {lost ? (isHe ? 'אבד' : 'LOST') : (isHe ? 'נמצא' : 'FOUND')}
    </span>
  );
}

function RewardPill({ post }: { post: PawPost }) {
  const n = post.reward_amount ? Number(post.reward_amount) : 0;
  if (!n) return null;
  return (
    <span className="rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ background: '#F4E7C3', color: '#7A5B12' }}>
      ₪{n.toLocaleString('he-IL')} {''}
    </span>
  );
}

function AlertActions({ post, isHe, user, onContact, toast, big = false }: {
  post: PawPost; isHe: boolean; user: any; onContact: () => void; toast: (t: any) => void; big?: boolean;
}) {
  const cls = big ? 'py-3 text-sm' : 'py-2 text-[12px]';
  const primary = post.public_phone ? (
    <a href={`tel:${post.public_phone}`} className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-black font-medium text-white ${cls}`} data-testid={`alert-call-${post.id}`}>
      <Phone className="h-3.5 w-3.5" /> {isHe ? (big ? 'התקשרו עכשיו' : 'התקשרו') : 'Call Now'}
    </a>
  ) : (
    <button
      type="button"
      onClick={() => (user ? onContact() : (window.location.href = `/sign-in?redirect=${encodeURIComponent(`/paw-finder/${post.id}`)}`))}
      className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-black font-medium text-white ${cls}`}
      data-testid={`alert-message-${post.id}`}
    >
      <MessageSquare className="h-3.5 w-3.5" /> {isHe ? (big ? 'שליחת הודעה' : 'הודעה') : 'Message'}
    </button>
  );
  return (
    <div className={`flex gap-2 ${big ? 'flex-col' : ''}`}>
      {primary}
      <button
        type="button"
        onClick={() => shareAlert(post, isHe, toast)}
        className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white font-medium text-black ${cls}`}
        style={{ border: `1px solid ${INK}` }}
        data-testid={`alert-share-${post.id}`}
      >
        <Share2 className="h-3.5 w-3.5" /> {isHe ? (big ? 'שיתוף ההתראה' : 'שיתוף') : 'Share Alert'}
      </button>
    </div>
  );
}

function AlertCard({ post, isHe, user, saved, onToggleSave, onOpen, onContact, toast }: {
  post: PawPost; isHe: boolean; user: any; saved: boolean; onToggleSave: () => void; onOpen: () => void; onContact: () => void; toast: (t: any) => void;
}) {
  const [failed, setFailed] = useState(false);
  const img = sanitizeUrl(post.primary_media);
  const size = post.size_category && SIZE_LABEL[post.size_category] ? SIZE_LABEL[post.size_category][isHe ? 0 : 1] : '';
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white" style={{ border: `1px solid ${HAIRLINE}` }} data-testid={`alert-card-${post.id}`}>
      <div className="relative aspect-[4/3.4] overflow-hidden" style={{ background: PAPER }}>
        <button type="button" onClick={onOpen} className="absolute inset-0 block" aria-label={post.pet_name || (isHe ? 'לפרטים' : 'Details')}>
          {img && !failed
            ? <img src={img} alt={post.pet_name || ''} className="h-full w-full object-cover" onError={() => setFailed(true)} loading="lazy" />
            : <span className="flex h-full items-center justify-center"><PetIcon type={post.pet_type} className="h-10 w-10 text-black/25" /></span>}
        </button>
        <span className="pointer-events-none absolute top-2.5" style={{ insetInlineStart: 10 }}><TypePill isHe={isHe} type={post.post_type} /></span>
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={isHe ? 'שמירה' : 'Save'}
          data-testid={`alert-save-${post.id}`}
          className="absolute top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/85"
          style={{ insetInlineEnd: 10 }}
        >
          <Heart className="h-[18px] w-[18px]" style={{ color: saved ? '#C0392B' : INK }} fill={saved ? '#C0392B' : 'none'} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onOpen} className="truncate text-[20px] leading-tight text-black" style={{ fontFamily: SERIF }}>
            {post.pet_name || (post.post_type === 'found' ? (isHe ? 'חיה שנמצאה' : 'Found pet') : (isHe ? 'ללא שם' : 'No name'))}
          </button>
          <RewardPill post={post} />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-black/60"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{placeLine(post.city, post.area)}</span></div>
        <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-black/60"><Clock className="h-3.5 w-3.5 shrink-0" />{seenAgo(isHe, post)}</div>
        {post.breed && <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-black/60"><Footprints className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{post.breed}</span></div>}
        {(post.color_primary || size) && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-black/60"><Palette className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{[post.color_primary, size].filter(Boolean).join(' | ')}</span></div>
        )}
        <div className="mt-auto pt-3">
          <AlertActions post={post} isHe={isHe} user={user} onContact={onContact} toast={toast} />
        </div>
      </div>
    </article>
  );
}

/** Detail sheet — the mockup's phone view, for one alert. */
function AlertDetail({ post, isHe, user, onClose, onContact, toast }: {
  post: PawPost; isHe: boolean; user: any; onClose: () => void; onContact: () => void; toast: (t: any) => void;
}) {
  const img = sanitizeUrl(post.primary_media);
  const size = post.size_category && SIZE_LABEL[post.size_category] ? SIZE_LABEL[post.size_category][isHe ? 0 : 1] : '';
  const Back = isHe ? ChevronRight : ChevronLeft;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose} data-testid={`alert-detail-${post.id}`}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()} dir={isHe ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={onClose} className="flex items-center gap-1 text-lg" style={{ fontFamily: SERIF }}>
            <Back className="h-5 w-5" /> PawFinder™‎
          </button>
          <button type="button" onClick={() => shareAlert(post, isHe, toast)} aria-label={isHe ? 'שיתוף' : 'Share'}><Share2 className="h-5 w-5" /></button>
        </div>
        <div className="relative mx-4 aspect-[4/3.2] overflow-hidden rounded-2xl" style={{ background: PAPER }}>
          {img ? <img src={img} alt={post.pet_name || ''} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><PetIcon type={post.pet_type} className="h-12 w-12 text-black/25" /></span>}
          <span className="absolute top-3" style={{ insetInlineStart: 12 }}><TypePill isHe={isHe} type={post.post_type} /></span>
        </div>
        <div className="px-5 pb-6 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-3xl" style={{ fontFamily: SERIF }}>{post.pet_name || (isHe ? 'ללא שם' : 'No name')}</h2>
            <RewardPill post={post} />
          </div>
          <div className="mt-3 space-y-2 text-sm text-black/70">
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{placeLine(post.city, post.area)}</div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{seenAgo(isHe, post)} · {formatDate(post.event_date)}</div>
            {post.breed && <div className="flex items-center gap-2"><Footprints className="h-4 w-4" />{post.breed}</div>}
            {(post.color_primary || size) && <div className="flex items-center gap-2"><Palette className="h-4 w-4" />{[post.color_primary, size].filter(Boolean).join(' | ')}</div>}
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-black/75">{post.description}</p>
          {post.latitude && post.longitude && (
            <div className="mt-4 h-40 overflow-hidden rounded-2xl" style={{ border: `1px solid ${HAIRLINE}` }}>
              <PawFinderMap posts={[post]} onSelect={() => {}} />
            </div>
          )}
          {post.matched_post_count > 0 && (
            <div className="mt-4 rounded-xl px-4 py-2.5 text-sm" style={{ border: `1px solid ${GOLD}`, color: GOLD_INK }}>
              {isHe ? `✨ ${post.matched_post_count} התאמות אפשריות` : `✨ ${post.matched_post_count} possible matches`}
            </div>
          )}
          <div className="mt-5"><AlertActions post={post} isHe={isHe} user={user} onContact={onContact} toast={toast} big /></div>
        </div>
      </div>
    </div>
  );
}

interface MatchRow {
  id: number; similarity_score: number; distance_km: string | null; date_gap_days: number | null;
  lost_id: number; lost_pet_name: string | null; lost_city: string; lost_date: string;
  found_id: number; found_pet_name: string | null; found_city: string; found_date: string;
}

/** Possible Matches — every suggested lost↔found pair on the member's own notices. */
function PossibleMatches({ isHe, onOpen }: { isHe: boolean; onOpen: (id: number) => void }) {
  const mine = useQuery<{ rows: PawPost[] }>({
    queryKey: ['/api/paw-finder/my/posts'],
    queryFn: async () => { const r = await apiRequest('/api/paw-finder/my/posts'); if (!r.ok) throw new Error(String(r.status)); return r.json(); },
  });
  const ids = (mine.data?.rows ?? []).filter((p) => ['published', 'matched'].includes(p.status)).map((p) => p.id);
  const details = useQuery<{ own: number; matches: MatchRow[] }[]>({
    queryKey: ['/api/paw-finder/my/matches', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => Promise.all(ids.map(async (id) => {
      const r = await apiRequest(`/api/paw-finder/posts/${id}`);
      const j = r.ok ? await r.json() : { matches: [] };
      return { own: id, matches: j.matches ?? [] };
    })),
  });
  const rows = (details.data ?? []).flatMap((d) => d.matches.map((m) => ({ ...m, own: d.own })));
  if (mine.isLoading || details.isLoading) return <div className="py-16 text-sm text-black/45" style={{ textAlign: 'center' }}>{isHe ? 'טוען…' : 'Loading…'}</div>;
  if (!rows.length) {
    return (
      <div className="py-16 text-sm text-black/60" style={{ textAlign: 'center' }}>
        {isHe ? 'אין כרגע התאמות אפשריות לדיווחים שלכם. נודיע ברגע שתופיע התאמה.' : 'No possible matches for your notices yet. We will alert you the moment one appears.'}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((m) => {
        const otherId = m.own === m.lost_id ? m.found_id : m.lost_id;
        return (
          <div key={`${m.own}-${m.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ border: `1px solid ${HAIRLINE}` }} data-testid={`match-${m.id}`}>
            <div>
              <div className="text-lg" style={{ fontFamily: SERIF }}>
                {isHe ? 'התאמה אפשרית' : 'Possible match'} — {m.lost_pet_name || (isHe ? 'אבוד' : 'Lost')} ↔ {m.found_pet_name || (isHe ? 'נמצא' : 'Found')}
              </div>
              <div className="mt-1 text-[13px] text-black/60">
                {[
                  m.distance_km != null ? (isHe ? `${Number(m.distance_km).toFixed(1)} ק״מ` : `${Number(m.distance_km).toFixed(1)} km away`) : null,
                  m.date_gap_days != null ? (isHe ? `הפרש ${m.date_gap_days} ימים` : `${m.date_gap_days} days apart`) : null,
                  `${m.lost_city} / ${m.found_city}`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => onOpen(m.lost_id)} className="rounded-full px-3 py-1.5 text-[12px]" style={{ border: `1px solid ${HAIRLINE}` }}>{isHe ? 'דיווח האובדן' : 'Lost notice'}</button>
              <button type="button" onClick={() => onOpen(otherId === m.lost_id ? m.found_id : otherId)} className="rounded-full bg-black px-3 py-1.5 text-[12px] text-white">{isHe ? 'לצפייה בהתאמה' : 'View match'}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PawFinder({ language, initialPostId }: PawFinderProps) {
  useSEO(pageSEO.pawFinder);
  const isHe = language === 'he';
  const L = (he: string, en: string) => (isHe ? he : en);
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<BoardView>(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    if (p === 'report' || p === 'post' || p === 'new' || p === 'ad') return 'report';
    if (p === 'my') return 'profile';
    return 'map';
  });
  const [typeChip, setTypeChip] = useState<'all' | 'lost' | 'found'>('all');
  const [petChip, setPetChip] = useState<'' | 'dog' | 'cat'>('');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [rewardOnly, setRewardOnly] = useState(false);
  const [windowSel, setWindowSel] = useState<TimeWindow>('any');
  const [nearbyKm, setNearbyKm] = useState(0);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [contactPost, setContactPost] = useState<PawPost | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saved, setSaved] = useState<number[]>(() => readSaved());

  const effectiveType = view === 'lost' ? 'lost' : view === 'found' ? 'found' : typeChip;

  const { data, isLoading } = useQuery<{ rows: PawPost[] }>({
    queryKey: ['/api/paw-finder/posts', effectiveType, petChip, rewardOnly],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (effectiveType !== 'all') q.set('postType', effectiveType);
      if (petChip) q.set('petType', petChip);
      if (rewardOnly) q.set('hasReward', 'true');
      const r = await apiRequest(`/api/paw-finder/posts?${q}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const notifQ = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/paw-finder/my/notifications'],
    enabled: !!user,
    refetchInterval: 30_000,
    select: d => ({ unreadCount: (d as any).unreadCount ?? 0 }),
  });
  const unreadCount = notifQ.data?.unreadCount ?? 0;

  const allPosts: PawPost[] = data?.rows ?? [];
  const cities = useMemo(() => Array.from(new Set(allPosts.map((p) => p.city).filter(Boolean))).sort(), [allPosts]);
  const posts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const since = WINDOW_MS[windowSel] ? Date.now() - WINDOW_MS[windowSel] : 0;
    return allPosts.filter((p) => {
      if (city && p.city !== city) return false;
      if (q && ![p.pet_name, p.breed, p.area, p.city, p.color_primary].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      if (since && new Date(p.published_at || `${p.event_date}T12:00:00`).getTime() < since) return false;
      if (nearbyKm && here) {
        if (!p.latitude || !p.longitude) return false;
        if (kmBetween(here, { lat: Number(p.latitude), lng: Number(p.longitude) }) > nearbyKm) return false;
      }
      return true;
    });
  }, [allPosts, search, city, windowSel, nearbyKm, here]);

  // Deep link (2026-09-12): /paw-finder/:id selects that post once the list
  // is in; a post outside the current filter is fetched on its own.
  useEffect(() => {
    if (initialPostId && Number.isFinite(initialPostId)) setSelectedId(initialPostId);
  }, [initialPostId]);
  const deepLinkedMissing = !!selectedId && !isLoading && !allPosts.some(p => p.id === selectedId);
  const singleQ = useQuery<{ post: PawPost; media?: { file_path: string }[] }>({
    queryKey: ['/api/paw-finder/posts', 'single', selectedId],
    queryFn: async () => {
      const r = await apiRequest(`/api/paw-finder/posts/${selectedId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: deepLinkedMissing,
    retry: false,
  });
  const selectedPost = selectedId
    ? (allPosts.find(p => p.id === selectedId)
      ?? (singleQ.data?.post?.id === selectedId ? { ...singleQ.data.post, primary_media: singleQ.data.media?.[0]?.file_path } as PawPost : null))
    : null;

  const handleMapSelect = useCallback((id: number) => setSelectedId(id), []);

  const toggleSave = (id: number) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  const requireMember = () => {
    if (user) return true;
    window.location.href = `/sign-in?redirect=${encodeURIComponent('/paw-finder')}`;
    return false;
  };

  const selectView = (k: string) => {
    if (['matches', 'alerts', 'messages', 'profile', 'report'].includes(k) && !requireMember()) return;
    setView(k as BoardView);
  };

  const askLocation = (km: number) => {
    if (!km) { setNearbyKm(0); return; }
    if (here) { setNearbyKm(km); return; }
    if (!navigator.geolocation) { toast({ variant: 'destructive', title: L('המיקום לא זמין', 'Location unavailable') }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearbyKm(km); },
      () => toast({ variant: 'destructive', title: L('לא אישרתם מיקום', 'Location not allowed'), description: L('בחרו עיר במקום.', 'Pick a city instead.') }),
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  const navItems = [
    { key: 'map', label: L('מפה חיה', 'Live Map'), icon: <MapIcon className="h-4 w-4" /> },
    { key: 'lost', label: L('חיות אבודות', 'Lost Pets'), icon: <Search className="h-4 w-4" /> },
    { key: 'found', label: L('חיות שנמצאו', 'Found Pets'), icon: <PawPrint className="h-4 w-4" /> },
    { key: 'matches', label: L('התאמות אפשריות', 'Possible Matches'), icon: <Heart className="h-4 w-4" /> },
    { key: 'alerts', label: L('ההתראות שלי', 'My Alerts'), icon: unreadCount > 0 ? <BellDot className="h-4 w-4" /> : <Bell className="h-4 w-4" />, badge: unreadCount || undefined },
    { key: 'messages', label: L('הודעות', 'Messages'), icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'profile', label: L('הפרופיל שלי', 'My Profile'), icon: <UserIcon className="h-4 w-4" /> },
  ];

  const showBoard = view === 'map' || view === 'lost' || view === 'found';
  const recent = view === 'map' ? posts.slice(0, 8) : posts;

  return (
    <div className="min-h-screen bg-white text-black" dir={isHe ? 'rtl' : 'ltr'}>
      {contactPost && <ContactModal post={contactPost} onClose={() => setContactPost(null)} />}
      {selectedPost && (
        <AlertDetail
          post={selectedPost}
          isHe={isHe}
          user={user}
          toast={toast}
          onClose={() => setSelectedId(null)}
          onContact={() => { setContactPost(selectedPost); setSelectedId(null); }}
        />
      )}

      <EditorialHeader
        isHe={isHe}
        cornerStart={isHe ? ['מפה חיה', 'התראות באזור', 'כל השכונה איתכם'] : ['Live map', 'Smart alerts', 'Community-powered']}
        cornerEnd={isHe ? ['שכנים', 'שעוזרים', 'לשכנים'] : ['People', 'Pets', 'Kinder', 'Communities']}
        title="PawFinder"
        titleMark="™‎"
        subtitle={L('חיה נעלמה? מצאתם חיה? שירות חינם לחברי PetWash.', 'A free members service for lost & found pets.')}
        italic={L('כל השכונה מחפשת איתכם.', 'Find faster. Reunite sooner.')}
      />

      <main className="mx-auto max-w-6xl px-3 sm:px-5">
        <div className="rounded-[28px] bg-white p-4 sm:p-6" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: '0 30px 60px -40px rgba(0,0,0,0.25)' }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: HAIRLINE }}>
            <div className="text-[13px] tracking-[0.2em] uppercase text-black/60">PawFinder™‎</div>
            <button
              type="button"
              onClick={() => selectView('report')}
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ background: GOLD_INK }}
              data-testid="button-report-pet"
            >
              {L('דיווח על חיה', 'Report a Pet')}
            </button>
          </div>

          <div className="flex gap-6">
            <SideNav
              icon={<MapPin className="h-6 w-6" />}
              title={<>PawFinder<sup style={{ fontSize: '0.45em' }}>™‎</sup></>}
              subtitle={L('אבדו ונמצאו', 'Lost & Found')}
              items={navItems}
              active={view}
              onSelect={selectView}
              note={isHe ? ['כל עין', 'ברחוב', 'עוזרת'] : ['Stronger', 'Communities', 'Happier Pets', 'Brighter', 'Tomorrows']}
            />

            <div className="min-w-0 flex-1">
              <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
                {navItems.map((it) => <Chip key={it.key} active={view === it.key} onClick={() => selectView(it.key)}>{it.label}{it.badge ? ` · ${it.badge}` : ''}</Chip>)}
              </div>

              {showBoard && (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-[30px] leading-tight" style={{ fontFamily: SERIF }}>
                        {view === 'found' ? L('חיות שנמצאו', 'Found Pets Near You') : view === 'lost' ? L('חיות אבודות', 'Lost Pets Near You') : L('אבדו ונמצאו באזור שלכם', 'Find Lost Pets Near You')}
                      </h2>
                      <p className="text-[13px] text-black/55">{L('דיווחים של שכנים אמיתיים, בזמן אמת.', 'Real people. Real alerts. Real reunions.')}</p>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row md:max-w-md">
                      <label className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3" style={{ border: `1px solid ${HAIRLINE}` }}>
                        <Search className="h-4 w-4 text-black/45" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L('חיפוש לפי שם, גזע, שכונה…', 'Search by name, breed, suburb…')} className="w-full bg-transparent py-2.5 text-base outline-none" data-testid="input-pawfinder-search" />
                      </label>
                      <label className="flex items-center gap-2 rounded-xl bg-white px-3 sm:w-44" style={{ border: `1px solid ${HAIRLINE}` }}>
                        <MapPin className="h-4 w-4 text-black/45" />
                        <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-transparent py-2.5 text-base outline-none" data-testid="select-pawfinder-city">
                          <option value="">{L('כל הערים', 'All cities')}</option>
                          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {view === 'map' && <>
                      <Chip active={typeChip === 'lost'} onClick={() => setTypeChip(typeChip === 'lost' ? 'all' : 'lost')} testId="chip-lost">{L('אבודים', 'Lost')}</Chip>
                      <Chip active={typeChip === 'found'} onClick={() => setTypeChip(typeChip === 'found' ? 'all' : 'found')} testId="chip-found">{L('נמצאו', 'Found')}</Chip>
                    </>}
                    <Chip active={petChip === 'dog'} onClick={() => setPetChip(petChip === 'dog' ? '' : 'dog')} testId="chip-dogs">{L('כלבים', 'Dogs')}</Chip>
                    <Chip active={petChip === 'cat'} onClick={() => setPetChip(petChip === 'cat' ? '' : 'cat')} testId="chip-cats">{L('חתולים', 'Cats')}</Chip>
                    <span className="relative inline-flex items-center"><select value={nearbyKm} onChange={(e) => askLocation(Number(e.target.value))} className="appearance-none rounded-full bg-white py-1.5 text-[13px]"  style={{ paddingInlineStart: 12, paddingInlineEnd: 28, border: `1px solid ${nearbyKm ? INK : HAIRLINE}` }} data-testid="select-nearby">
                      <option value={0}>{L('בקרבתי', 'Nearby')}</option>
                      {[2, 5, 10, 25].map((k) => <option key={k} value={k}>{L(`עד ${k} ק״מ`, `Within ${k} km`)}</option>)}
                    </select><ChevronDown aria-hidden className="pointer-events-none absolute h-3.5 w-3.5 text-black/55" style={{ insetInlineEnd: 10 }} /></span>
                    <span className="relative inline-flex items-center"><select value={windowSel} onChange={(e) => setWindowSel(e.target.value as TimeWindow)} className="appearance-none rounded-full bg-white py-1.5 text-[13px]"  style={{ paddingInlineStart: 12, paddingInlineEnd: 28, border: `1px solid ${windowSel !== 'any' ? INK : HAIRLINE}` }} data-testid="select-window">
                      <option value="any">{L('כל הזמנים', 'Any time')}</option>
                      <option value="24h">{L('24 השעות האחרונות', 'Last 24 Hours')}</option>
                      <option value="3d">{L('3 ימים', 'Last 3 days')}</option>
                      <option value="7d">{L('שבוע', 'Last 7 days')}</option>
                      <option value="30d">{L('חודש', 'Last 30 days')}</option>
                    </select><ChevronDown aria-hidden className="pointer-events-none absolute h-3.5 w-3.5 text-black/55" style={{ insetInlineEnd: 10 }} /></span>
                    <Chip active={rewardOnly} onClick={() => setRewardOnly(!rewardOnly)} testId="chip-reward">{L('עם פרס למוצא', 'Reward')}</Chip>
                  </div>

                  {view === 'map' && (
                    <div className="relative mt-4 h-[340px] overflow-hidden rounded-2xl sm:h-[420px]" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <PawFinderMap posts={posts} onSelect={handleMapSelect} />
                      <div className="pointer-events-none absolute bottom-3 z-[400] flex items-center gap-3 rounded-full bg-white px-3 py-1.5 text-[12px] shadow" style={{ insetInlineStart: 12 }}>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#D64545' }} />{L('אבד', 'Lost')}</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2E8B57' }} />{L('נמצא', 'Found')}</span>
                      </div>
                      <div className="pointer-events-none absolute bottom-3 z-[400] rounded-xl bg-white px-3 py-1.5 text-[12px] shadow" style={{ insetInlineEnd: 12 }} data-testid="alerts-nearby-count">
                        <MapPin className="inline h-3.5 w-3.5" style={{ color: '#2E8B57' }} /> {L(`${posts.length} התראות`, `${posts.length} alerts`)}{city ? ` · ${city}` : ''}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between">
                    <h3 className="text-2xl" style={{ fontFamily: SERIF }}>{view === 'map' ? L('דיווחים אחרונים', 'Recent Alerts') : L(`${posts.length} התראות`, `${posts.length} alerts`)}</h3>
                    {view === 'map' && posts.length > recent.length && (
                      <button type="button" onClick={() => setView(typeChip === 'found' ? 'found' : 'lost')} className="text-[13px] underline">{L('לכל הדיווחים', 'View All')}</button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="py-16 text-sm text-black/45" style={{ textAlign: 'center' }}><Loader2 className="inline h-4 w-4 animate-spin" /> {L('טוען…', 'Loading…')}</div>
                  ) : recent.length === 0 ? (
                    <div className="py-6">
                      <p className="text-sm text-black/60" style={{ textAlign: 'center' }}>
                        {L('אין כרגע דיווחים שמתאימים לחיפוש.', 'No matching alerts right now.')}
                      </p>
                      {/* Nothing real to show → show what a real alert looks like,
                          labelled EXAMPLE. A fabricated missing pet is never OK. */}
                      <ExamplePreview
                        isHe={isHe}
                        title={L('כך ייראה הדיווח שלכם ב-PawFinder', 'This is what a PawFinder alert looks like')}
                        subtitle={L('אלה דוגמאות בלבד — לא חיות אמיתיות.', 'Three examples for illustration — no real pets are missing here.')}
                        cards={pawFinderExamples(isHe)}
                        cta={{ href: '/paw-finder?tab=report', label: isHe ? 'דיווח על חיה ←' : 'Report a pet →' }}
                        note={L('הדוגמאות נעלמות ברגע שמתפרסם דיווח אמיתי אחד.', 'The examples disappear the moment one real notice is published.')}
                      />
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {recent.map((post) => (
                        <AlertCard
                          key={post.id}
                          post={post}
                          isHe={isHe}
                          user={user}
                          toast={toast}
                          saved={saved.includes(post.id)}
                          onToggleSave={() => toggleSave(post.id)}
                          onOpen={() => setSelectedId(post.id)}
                          onContact={() => setContactPost(post)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {view === 'matches' && user && <><h2 className="mb-4 text-[30px]" style={{ fontFamily: SERIF }}>{L('התאמות אפשריות', 'Possible Matches')}</h2><PossibleMatches isHe={isHe} onOpen={(id) => setSelectedId(id)} /></>}
              {view === 'alerts' && user && <><h2 className="mb-4 text-[30px]" style={{ fontFamily: SERIF }}>{L('ההתראות שלי', 'My Alerts')}</h2><NotificationsTab user={user} /></>}
              {view === 'messages' && user && <><h2 className="mb-4 text-[30px]" style={{ fontFamily: SERIF }}>{L('הודעות', 'Messages')}</h2><ContactsTab user={user} /></>}
              {view === 'profile' && user && <><h2 className="mb-4 text-[30px]" style={{ fontFamily: SERIF }}>{L('הדיווחים שלי', 'My Notices')}</h2><MyPosts /></>}

              {view === 'report' && (
                <div className="mx-auto max-w-2xl">
                  {!user ? (
                    <AuthGateCard
                      language={language}
                      message={isHe
                        ? 'התחברו או הצטרפו ל-PetWash כדי לפרסם דיווח ב-PawFinder ולעזור להחזיר חיות אבודות הביתה — תחזרו לכאן מיד אחרי ההתחברות.'
                        : 'Sign in or join PetWash to post on PawFinder and help reunite lost pets — you’ll come right back here.'}
                    />
                  ) : (
                    <>
                      <h2 className="text-[30px]" style={{ fontFamily: SERIF }}>{L('דיווח על חיה שאבדה או נמצאה', 'Report a lost or found pet')}</h2>
                      <p className="mt-1 text-sm text-black/60">
                        {isHe
                          ? 'בטוח ומאושר — לחברי PetWash מחוברים. כל דיווח עובר סריקת בטיחות ואישור אנושי לפני פרסום.'
                          : 'Safe & approved — For signed-in PetWash members. Every notice passes a safety scan and a human approval before it goes live.'}
                      </p>
                      <div className="mt-5 rounded-3xl bg-white p-6" style={{ border: `1px solid ${HAIRLINE}` }}>
                        <ReportForm onSuccess={() => {
                          qc.invalidateQueries({ queryKey: ['/api/paw-finder/posts'] });
                          qc.invalidateQueries({ queryKey: ['/api/paw-finder/my/posts'] });
                          setView('profile');
                        }} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <PillarRow pillars={[
        { icon: <MapPin className="h-6 w-6" />, title: L('מפה חיה', 'Live Map'), body: L('כל דיווח באזור שלכם מופיע על המפה ברגע שהוא עולה.', 'See real-time lost and found pet alerts near you.') },
        { icon: <Bell className="h-6 w-6" />, title: L('תדעו מיד', 'Instant Alerts'), body: L('דיווח חדש באזור או התאמה אפשרית — מקבלים התראה.', 'Get notified about new alerts in your area.') },
        { icon: <Heart className="h-6 w-6" />, title: L('אולי זה הוא?', 'Possible Matches'), body: L('המערכת משווה כל "אבד" מול כל "נמצא" — סוג, צבע, מקום ותאריך — ומראה לכם.', 'Our smart matching helps reunite pets faster.') },
        { icon: <Users className="h-6 w-6" />, title: L('מדברים ישירות', 'Direct Contact'), body: L('שולחים הודעה למוצא או לבעלים, ואתם מחליטים מתי לתת טלפון.', 'Message or call pet finders and owners directly.') },
      ]} />

      <StepsBand
        isHe={isHe}
        lead={L('מהרגע שנעלמו — ועד שחוזרים הביתה.', 'A faster path home.')}
        steps={[
          { icon: <ClipboardList className="h-5 w-5" />, title: L('מדווחים', 'Report'), body: L('תמונה, מקום ושעה — וזהו.', 'Report a lost or found pet.') },
          { icon: <MapIcon className="h-5 w-5" />, title: L('על המפה', 'Map'), body: L('כל מי שבאזור רואה את הדיווח.', 'Your alert appears on the live map.') },
          { icon: <Heart className="h-5 w-5" />, title: L('התאמה', 'Match'), body: L('מישהו דיווח על חיה דומה? תדעו.', 'Get notified of possible matches.') },
          { icon: <MessageSquare className="h-5 w-5" />, title: L('יוצרים קשר', 'Contact'), body: L('מאמתים פרט מזהה ומדברים.', 'Speak directly and share details.') },
          { icon: <HomeIcon className="h-5 w-5" />, title: L('חוזרים הביתה', 'Reunite'), body: L('וכולם נושמים לרווחה.', 'Happy pets. Happier families.') },
        ]}
      />

      <ClosingBand
        isHe={isHe}
        image="/community/closing-cat.jpg"
        imageAlt=""
        heading={isHe ? ['כשכולם מחפשים,', 'מוצאים.'] : ['Same communities.', 'Stronger together.']}
        caption={isHe ? ['PawFinder מחבר', 'בין מי שאיבד', 'למי שמצא.'] : ['PawFinder helps reunite', 'lost pets with their', 'existing families.']}
        seal={isHe ? ['מחזירים', 'אותם', 'הביתה.'] : ['Lost & found', 'is separate', 'from', 'adoption.']}
        footer={<>PawFinder™‎ {L('מחזיר חיות אבודות הביתה — חינם לחברי PetWash.', 'helps reunite lost pets with their existing families.')}</>}
      />
    </div>
  );
}
