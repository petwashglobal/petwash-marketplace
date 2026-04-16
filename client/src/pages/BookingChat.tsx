import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import type { BookingConversation, BookingMessage } from "@shared/schema";
import {
  Send, Lock, AlertTriangle, CheckCheck, Check,
  ArrowLeft, ShieldCheck, Flag, MessageSquare,
  Wifi, WifiOff, Sparkles, MapPin, Navigation,
  PlayCircle, CheckCircle2, HelpCircle, AlertOctagon,
  X, Image as ImageIcon, MoreVertical, Ban, Phone,
  FileText, Bot, ChevronDown, ChevronUp,
  Timer, Dog, Cat, PawPrint, BookOpen, Calendar,
  Reply, Heart, ClipboardList, Camera, Smile, Edit2,
  Mic, MicOff, StopCircle, Play, Pause, CreditCard, Wallet,
  Globe, Languages
} from "lucide-react";
import { formatDistance } from "date-fns";
import { sanitizeUrl } from "@/lib/utils";

// ─── Platform labels ──────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<string, string> = {
  walk_my_pet:  "Dog Walker",
  sitter_suite: "Pet Sitter",
  petwash:      "PetWash",
  academy:      "Academy",
};

// ─── Provider quick actions ───────────────────────────────────────────────────
const PROVIDER_QUICK_ACTIONS = [
  { id: "on_my_way",  label: "On my way",    icon: Navigation,    color: "#0B57D0" },
  { id: "arrived",    label: "Arrived",       icon: MapPin,        color: "#059669" },
  { id: "starting",   label: "Starting now",  icon: PlayCircle,    color: "#7C3AED" },
  { id: "completed",  label: "Done",          icon: CheckCircle2,  color: "#059669" },
  { id: "need_help",  label: "Need help",     icon: HelpCircle,    color: "#D97706" },
  { id: "issue",      label: "Report issue",  icon: AlertOctagon,  color: "#DC2626" },
];

const QUICK_ACTION_MESSAGES: Record<string, string> = {
  on_my_way:  "I'm on my way to you! 🐾",
  arrived:    "I have arrived!",
  starting:   "Starting the session now.",
  completed:  "Session completed! Thank you 🐾",
  need_help:  "I need some assistance. Please respond when you can.",
  issue:      "There is an issue that needs your attention.",
};

// ─── Typing dots animation ────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300"
          style={{ animation: "chat-bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
      ))}
      <span className="ml-2 text-[11px] text-gray-400">typing…</span>
    </div>
  );
}

// ─── Full-screen image viewer ─────────────────────────────────────────────────
function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-5 right-5 text-white/60 hover:text-white" onClick={onClose}>
        <X className="w-7 h-7" />
      </button>
      <img
        src={sanitizeUrl(url)}
        className="rounded-lg object-contain"
        style={{ maxWidth: "92vw", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
        alt="Full size"
      />
    </div>
  );
}

// ─── Block user bottom sheet ──────────────────────────────────────────────────
function BlockUserSheet({
  open, onClose, onConfirm, isPending
}: { open: boolean; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}
        style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.12)" }}>
        <div className="w-10 h-1 rounded-full bg-white mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <Ban className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Block this user</h3>
            <p className="text-xs text-gray-400">They won't be able to contact you again</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Blocking will prevent this user from sending you any future messages. This action is logged and reviewed by our safety team.
        </p>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="w-full py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors mb-3"
        >
          {isPending ? "Blocking…" : "Yes, block this user"}
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── AI Summary panel ─────────────────────────────────────────────────────────
function SummaryPanel({ summary, onClose }: { summary: string; onClose: () => void }) {
  return (
    <div className="mx-4 mb-3 bg-white border border-blue-100 rounded-2xl p-4 shadow-sm"
      style={{ boxShadow: "0 2px 12px rgba(11,87,208,0.08)" }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-blue-700">AI Summary</span>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
      <p className="text-[10px] text-gray-300 mt-2">Generated by Gemini · For reference only</p>
    </div>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "read_only") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium">
        <Lock className="w-3 h-3" /> Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 uppercase">
      <Lock className="w-3 h-3" /> {status}
    </span>
  );
}

// ─── Session timer formatter ──────────────────────────────────────────────────
function formatElapsed(startedAt: Date): string {
  const secs = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Session timer chip (Wave 1 #3) ──────────────────────────────────────────
function SessionTimerChip({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt));
  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(124,58,237,0.08)", color: "#7C3AED", border: "1px solid rgba(124,58,237,0.15)" }}>
      <Timer className="w-3 h-3" />
      {elapsed}
    </span>
  );
}

// ─── Contextual empty states (Wave 1 #2) ─────────────────────────────────────
const PLATFORM_EMPTY: Record<string, {
  Icon: any; color: string; title: string; body: string; cta?: string;
}> = {
  walk_my_pet: {
    Icon: Dog, color: "#4F7942",
    title: "Introduce yourself to your walker",
    body: "Share your dog's name, any special needs, and the best spot for pickup. Your walker is ready to listen.",
    cta: "Say hello 👋",
  },
  sitter_suite: {
    Icon: Cat, color: "#7B5EA7",
    title: "Tell your sitter about your pet",
    body: "Their routine, favourite toys, feeding schedule — the more you share, the better the care.",
    cta: "Start the conversation",
  },
  petwash: {
    Icon: PawPrint, color: "#0B57D0",
    title: "Questions before your wash?",
    body: "Ask about the station, product options, or how to book extra services. We're here.",
    cta: "Ask anything",
  },
  academy: {
    Icon: BookOpen, color: "#B45309",
    title: "Connect with your trainer",
    body: "Share your training goals, your pet's experience level, and any concerns before your first session.",
    cta: "Introduce your pet",
  },
};

function ContextualEmptyState({
  platform, chatStatus, closedReason, isReadOnly
}: { platform: string; chatStatus: string; closedReason?: string | null; isReadOnly: boolean }) {

  // ── Status-aware branching (architect recommendation) ──────────────────────
  if (chatStatus === "locked" || isReadOnly) {
    const reasonLabel: Record<string, string> = {
      completed:  "Booking complete — great service delivered!",
      cancelled:  "Booking was cancelled before it started.",
      refunded:   "Booking was refunded. No charges apply.",
      disputed:   "This booking is under review by our team.",
      expired:    "Booking expired without confirmation.",
    };
    const label = closedReason ? reasonLabel[closedReason] ?? `Closed — ${closedReason}` : "This booking is archived.";
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-base font-bold text-gray-700 mb-2">Read-only archive</h3>
        <p className="text-sm text-gray-400 leading-relaxed max-w-xs">{label}</p>
        <p className="text-xs text-gray-300 mt-3">Messages are preserved for 7 years.</p>
      </div>
    );
  }

  if (chatStatus === "pending" || chatStatus === "awaiting_confirmation") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
          <Calendar className="w-7 h-7 text-blue-400" />
        </div>
        <h3 className="text-base font-bold text-gray-800 mb-2">Booking pending confirmation</h3>
        <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
          Once your booking is confirmed you can chat with your provider here. Check back soon!
        </p>
      </div>
    );
  }

  // ── Active chat: platform-specific prompt ─────────────────────────────────
  const cfg = PLATFORM_EMPTY[platform] ?? {
    Icon: MessageSquare, color: "#6B7280",
    title: "Start the conversation",
    body: "Say hello to your service provider. Ask any questions before your booking.",
    cta: "Send your first message",
  };
  const Icon = cfg.Icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: cfg.color + "12", border: `1.5px solid ${cfg.color}22` }}>
        <Icon className="w-7 h-7" style={{ color: cfg.color }} />
      </div>
      <h3 className="text-base font-bold text-gray-800 mb-2">{cfg.title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-5">{cfg.body}</p>
      {cfg.cta && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ color: cfg.color, background: cfg.color + "10", border: `1px solid ${cfg.color}25` }}>
          {cfg.cta}
        </div>
      )}
    </div>
  );
}

// ─── Seen popup (Wave 1 #1) ───────────────────────────────────────────────────
function SeenPopup({ readAt }: { readAt: Date | string | null }) {
  if (!readAt) {
    return (
      <div className="absolute -bottom-7 right-0 bg-gray-800/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm z-10">
        Delivered
      </div>
    );
  }
  const date = typeof readAt === "string" ? new Date(readAt) : readAt;
  if (isNaN(date.getTime())) return null;
  const timeStr = format(date, "HH:mm");
  const dateStr = formatDistance(date, new Date(), { addSuffix: true });
  return (
    <div className="absolute -bottom-7 right-0 bg-gray-800/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm z-10">
      Seen at {timeStr} · {dateStr}
    </div>
  );
}

// ─── WaveformPlayer ───────────────────────────────────────────────────────────
function WaveformPlayer({ audioUrl, transcript, isMe }: { audioUrl: string; transcript?: string | null; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]     = useState(false);
  const [current, setCurrent]     = useState(0);
  const [duration, setDuration]   = useState(0);
  const [showTx, setShowTx]       = useState(false);

  // Deterministic pseudo-waveform bars seeded from URL chars
  const bars = Array.from({ length: 32 }, (_, i) => {
    const seed = audioUrl.charCodeAt(i % audioUrl.length) + i * 17;
    return 20 + (seed % 60);
  });

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onLoad = () => setDuration(el.duration);
    const onEnd  = () => { setPlaying(false); setCurrent(0); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoad);
    el.addEventListener('ended', onEnd);
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('loadedmetadata', onLoad); el.removeEventListener('ended', onEnd); };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const progress = duration ? current / duration : 0;

  return (
    <div className="w-52 select-none">
      <audio ref={audioRef} src={sanitizeUrl(audioUrl)} preload="metadata" />
      <div className="flex items-center gap-2">
        <button onClick={toggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${isMe ? "bg-white/20 hover:bg-white/30" : "bg-blue-50 hover:bg-blue-100"}`}>
          {playing
            ? <Pause className={`w-3.5 h-3.5 ${isMe ? "text-white" : "text-blue-600"}`} />
            : <Play  className={`w-3.5 h-3.5 ${isMe ? "text-white" : "text-blue-600"}`} />
          }
        </button>
        {/* Waveform bars + seek */}
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-px h-8 cursor-pointer" onClick={seek}>
            {bars.map((h, i) => {
              const barProgress = i / bars.length;
              const active = barProgress <= progress;
              return (
                <div key={i}
                  style={{ height: `${h}%`, minHeight: 3 }}
                  className={`flex-1 rounded-full transition-colors ${active
                    ? (isMe ? "bg-white" : "bg-blue-500")
                    : (isMe ? "bg-white/35" : "bg-white")
                  }`}
                />
              );
            })}
          </div>
          <div className={`text-[9px] ${isMe ? "text-white/60" : "text-gray-400"}`}>
            {fmtTime(current)} / {fmtTime(duration || 0)}
          </div>
        </div>
      </div>
      {transcript && (
        <button onClick={() => setShowTx(t => !t)}
          className={`mt-1 text-[10px] underline underline-offset-2 ${isMe ? "text-white/60" : "text-gray-400"}`}>
          {showTx ? "Hide transcript" : "Show transcript"}
        </button>
      )}
      {showTx && transcript && (
        <p className={`mt-1 text-[11px] leading-snug italic ${isMe ? "text-white/80" : "text-gray-500"}`}>{transcript}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BookingChat() {
  const [, params]    = useRoute("/booking-chat/:bookingId");
  const [, setLocation] = useLocation();
  const { user }      = useFirebaseAuth();
  const { toast }     = useToast();
  const bookingId     = params?.bookingId;

  // State
  const [inputText, setInputText]         = useState("");
  const [wsConnected, setWsConnected]     = useState(false);
  const [wsAuthed, setWsAuthed]           = useState(false);
  const [messages, setMessages]           = useState<BookingMessage[]>([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isProvider, setIsProvider]       = useState(false);
  const [platform, setPlatform]           = useState<string>("");

  // Dialogs / sheets / panels
  const [reportingMsg, setReportingMsg]   = useState<BookingMessage | null>(null);
  const [reportReason, setReportReason]   = useState("");
  const [showBlockSheet, setShowBlockSheet] = useState(false);
  const [viewingImage, setViewingImage]   = useState<string | null>(null);
  const [aiSummary, setAiSummary]         = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Wave 1: Seen popup (#1) — which message has seen tooltip open
  const [seenPopupId, setSeenPopupId]     = useState<string | null>(null);
  const [replyingTo, setReplyingTo]       = useState<BookingMessage | null>(null);
  const [swipeOffsets, setSwipeOffsets]   = useState<Record<string, number>>({});
  const swipeTouchStart                   = useRef<Record<string, number>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const longPressTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Session photo: pending photo to send (with optional AI caption)
  const [pendingPhoto, setPendingPhoto]   = useState<{ imageUrl: string; aiCaption: string | null } | null>(null);
  const [photoCaption, setPhotoCaption]   = useState("");
  // T007: Voice recorder
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef                  = useRef<MediaRecorder | null>(null);
  const audioChunksRef                    = useRef<Blob[]>([]);
  const recordingTimerRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  // T009: dismissed payment CTAs (local state, not persisted)
  const [dismissedCtaIds, setDismissedCtaIds] = useState<Set<string>>(new Set());
  // T010: in-chat translations (messageId → translated text)
  const [translations, setTranslations]   = useState<Record<string, string>>({});
  const [showOriginal, setShowOriginal]   = useState<Set<string>>(new Set());
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  // Wave 1: Session timer (#3)
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  // Refs
  const socketRef         = useRef<WebSocket | null>(null);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const reconnectRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherTypingRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);

  // ── 1. Open conversation ───────────────────────────────────────────────────
  const openMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/open`);
      return res.json() as Promise<{ conversationId: string }>;
    },
    onSuccess: (data) => setConversationId(data.conversationId),
    onError: (err: any) => {
      toast({ title: "Cannot open chat", description: err.message || "Chat is not available yet.", variant: "destructive" });
    },
  });

  // ── 2. Fetch conversation ─────────────────────────────────────────────────
  const { data: chatData, isLoading, error, refetch } = useQuery<{
    conversation: BookingConversation;
    messages: BookingMessage[];
  }>({
    queryKey: [`/api/booking-chat/${bookingId}`],
    enabled: !!conversationId,
  });

  // ── 3. Send message ───────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async ({ content, messageType, metadata, replyToMessageId }: { content: string; messageType: string; metadata?: any; replyToMessageId?: string | null }) => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/send`, { content, messageType, metadata, replyToMessageId });
      return res.json();
    },
    onSuccess: () => { setInputText(""); setReplyingTo(null); },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.userMessage || "Please try again.", variant: "destructive" });
    },
  });

  // ── 4. Mark read ──────────────────────────────────────────────────────────
  // Only invalidate inbox (unread counts) — NOT the chat query itself.
  // Invalidating the chat query would re-trigger chatData → useEffect → markRead (loop).
  const markReadMutation = useMutation({
    mutationFn: async () => { await apiRequest("PUT", `/api/booking-chat/${bookingId}/read`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-chat/inbox"] });
    },
  });

  // ── 5. Provider quick action ──────────────────────────────────────────────
  const quickActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const content = QUICK_ACTION_MESSAGES[actionId];
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/send`, { content, messageType: "text" });
      return res.json();
    },
    onError: () => toast({ title: "Failed to send action", variant: "destructive" }),
  });

  // ── 6. AI draft ───────────────────────────────────────────────────────────
  const aiDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/ai-draft`, {});
      return res.json() as Promise<{ draft: string }>;
    },
    onSuccess: (data) => { if (data.draft) setInputText(data.draft); },
    onError: () => toast({ title: "AI draft unavailable", variant: "destructive" }),
  });

  // ── 7. AI summarize ───────────────────────────────────────────────────────
  const aiSummarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/ai-summarize`, {});
      return res.json() as Promise<{ summary: string }>;
    },
    onSuccess: (data) => { if (data.summary) setAiSummary(data.summary); },
    onError: () => toast({ title: "Summary unavailable", variant: "destructive" }),
  });

  // ── 8. Report message ─────────────────────────────────────────────────────
  const reportMutation = useMutation({
    mutationFn: async ({ messageId, reason, block }: { messageId: string; reason: string; block: boolean }) => {
      await apiRequest("POST", `/api/booking-chat/${bookingId}/report`, { messageId, reason, blockUser: block });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Our team will review this." });
      setReportingMsg(null); setReportReason("");
    },
    onError: () => toast({ title: "Failed to report", variant: "destructive" }),
  });

  // ── 9. Block user ─────────────────────────────────────────────────────────
  const blockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/booking-chat/${bookingId}/report`, {
        reason: "Blocked by user",
        blockUser: true,
      });
    },
    onSuccess: () => {
      toast({ title: "User blocked", description: "This user can no longer contact you." });
      setShowBlockSheet(false);
    },
    onError: () => toast({ title: "Failed to block user", variant: "destructive" }),
  });

  // ── 10. Image upload with Gemini caption (providers get caption dialog) ─────
  const handleImageSelect = async (file: File) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const token = await user!.getIdToken();
      const res = await fetch(`/api/booking-chat/${bookingId}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const { imageUrl, aiCaption } = await res.json();
      if (isProvider && aiCaption) {
        // Show caption preview dialog for providers
        setPendingPhoto({ imageUrl, aiCaption });
        setPhotoCaption(aiCaption);
      } else {
        // Customers or no AI caption: send immediately
        sendMutation.mutate({ content: aiCaption || "", messageType: "image", metadata: { imageUrl } });
      }
    } catch (err: any) {
      toast({ title: "Image upload failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendPendingPhoto = () => {
    if (!pendingPhoto) return;
    sendMutation.mutate({
      content: photoCaption.trim(),
      messageType: "session_photo",
      metadata: { imageUrl: pendingPhoto.imageUrl, caption: photoCaption.trim() },
    });
    setPendingPhoto(null);
    setPhotoCaption("");
  };

  // ── 11. Voice recorder (T007) ─────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        await uploadAudioBlob(blob, mr.mimeType);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSecs(s => {
          if (s >= 59) { stopRecording(); return 59; }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSecs(0);
  };

  const uploadAudioBlob = async (blob: Blob, mimeType: string) => {
    setUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, `voice.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
      const token = await user!.getIdToken();
      const res = await fetch(`/api/booking-chat/${bookingId}/upload-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { audioUrl, transcript } = await res.json();
      sendMutation.mutate({
        content: transcript || "",
        messageType: "voice_message",
        metadata: { audioUrl, transcript, durationSeconds: recordingSecs },
      });
    } catch {
      toast({ title: "Voice message failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploadingAudio(false);
    }
  };

  // ── 12. Translate message (T010) ──────────────────────────────────────────
  const translateMessage = async (msg: BookingMessage) => {
    if (translatingId) return;
    if (translations[msg.messageId]) {
      // Toggle "show original" if already translated
      setShowOriginal(prev => {
        const next = new Set(prev);
        if (next.has(msg.messageId)) next.delete(msg.messageId);
        else next.add(msg.messageId);
        return next;
      });
      return;
    }
    setTranslatingId(msg.messageId);
    try {
      const targetLang = document.documentElement.lang === 'he' ? 'en' : 'he';
      const res = await apiRequest('POST', `/api/booking-chat/${bookingId}/messages/${msg.messageId}/translate`, { targetLang });
      const { translated } = await res.json();
      setTranslations(prev => ({ ...prev, [msg.messageId]: translated }));
    } catch {
      toast({ title: "Translation failed", variant: "destructive" });
    } finally {
      setTranslatingId(null);
    }
  };

  // ── 13. Reaction toggle ────────────────────────────────────────────────────
  const reactMutation = useMutation({
    mutationFn: async ({ messageId, reaction }: { messageId: string; reaction: string }) => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/messages/${messageId}/react`, { reaction });
      return res.json() as Promise<{ counts: Record<string, number> }>;
    },
    onSuccess: (data, { messageId }) => {
      setReactionCounts(prev => ({ ...prev, [messageId]: data.counts }));
    },
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bookingId && user) openMutation.mutate();
  }, [bookingId, user?.uid]);

  useEffect(() => {
    if (chatData?.messages) {
      setMessages(chatData.messages);
      const conv = chatData.conversation;
      const providerUid = conv.providerId;
      setIsProvider(providerUid === user?.uid);
      setPlatform(conv.platform || "");
      markReadMutation.mutate();

      // Wave 1 #3: detect session start via constant (avoid brittle literal matching)
      // Use .filter + last match so multiple "start" sends don't pick the wrong one
      const SESSION_START_TEXT = QUICK_ACTION_MESSAGES["starting"];
      const startMsgs = chatData.messages.filter(
        m => m.senderUid === providerUid && m.content === SESSION_START_TEXT
      );
      const latestStart = startMsgs[startMsgs.length - 1];
      if (latestStart?.createdAt) {
        setSessionStartedAt(new Date(latestStart.createdAt));
      }
    }
  }, [chatData?.messages]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (!user || !conversationId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/realtime`);
    socketRef.current = socket;

    socket.onopen = async () => {
      setWsConnected(true);
      try {
        const token = await user.getIdToken();
        socket.send(JSON.stringify({ type: "auth_messaging", payload: { firebaseToken: token } }));
      } catch {}
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "messaging_auth_success") {
          setWsAuthed(true);
          socket.send(JSON.stringify({ type: "subscribe_booking_chat", payload: { conversationId } }));
        }
        if (data.type === "booking_chat_message" && data.conversationId === conversationId) {
          setMessages(prev => {
            const exists = prev.some(m => m.messageId === data.message.messageId);
            return exists ? prev : [...prev, data.message];
          });
          setIsOtherTyping(false);
          markReadMutation.mutate();
          // Wave 1 #3: detect session start from incoming WS message (use constant)
          if (data.message.content === QUICK_ACTION_MESSAGES["starting"] && data.message.createdAt) {
            setSessionStartedAt(new Date(data.message.createdAt));
          }
        }
        if (data.type === "chat_typing_presence" && data.conversationId === conversationId && data.senderUid !== user.uid) {
          setIsOtherTyping(data.isTyping);
          if (otherTypingRef.current) clearTimeout(otherTypingRef.current);
          if (data.isTyping) {
            otherTypingRef.current = setTimeout(() => setIsOtherTyping(false), 6000);
          }
        }
        if (data.type === "booking_chat_status" && data.conversationId === conversationId) {
          queryClient.setQueryData([`/api/booking-chat/${bookingId}`], (old: any) => {
            if (!old) return old;
            return { ...old, conversation: { ...old.conversation, chatStatus: data.chatStatus } };
          });
        }
        if (data.type === "chat_reaction" && data.conversationId === conversationId) {
          setReactionCounts(prev => ({ ...prev, [data.messageId]: data.counts }));
        }
      } catch {}
    };

    socket.onclose = () => {
      setWsConnected(false); setWsAuthed(false);
      reconnectRef.current = setTimeout(connectWebSocket, 5000);
    };
    socket.onerror = () => socket.close();
  }, [user, conversationId, bookingId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (otherTypingRef.current) clearTimeout(otherTypingRef.current);
      const s = socketRef.current;
      if (s?.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify({ type: "unsubscribe_booking_chat", payload: { conversationId } }));
        s.close();
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  // ── Typing events ─────────────────────────────────────────────────────────
  const sendTyping = useCallback((isTyping: boolean) => {
    const s = socketRef.current;
    if (s?.readyState !== WebSocket.OPEN || !conversationId) return;
    s.send(JSON.stringify({
      type: isTyping ? "chat_typing_start" : "chat_typing_stop",
      payload: { conversationId },
    }));
  }, [conversationId]);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (val.trim()) {
      sendTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTyping(false), 3000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      sendTyping(false);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || sendMutation.isPending) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTyping(false);
    sendMutation.mutate({ content: inputText, messageType: "text", replyToMessageId: replyingTo?.messageId ?? null });
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (openMutation.isPending || (!conversationId && !openMutation.isError)) {
    return (
      <div className="flex flex-col bg-white" style={{ height: "100dvh" }}>
        <div className="p-4 border-b flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-300">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p className="text-sm">Opening conversation…</p>
          </div>
        </div>
      </div>
    );
  }

  if (openMutation.isError) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 text-center" style={{ height: "100dvh" }}>
        <div className="w-16 h-16 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-gray-300" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Chat not available</h2>
        <p className="text-sm text-gray-400 mb-6">Chat opens once the booking is confirmed.</p>
        <button onClick={() => setLocation(-1)} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col bg-white" style={{ height: "100dvh" }}>
        <div className="p-4 border-b flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className={`flex ${i%2===0?"justify-end":"justify-start"}`}>
              <Skeleton className={`h-10 rounded-2xl ${i%2===0?"w-48":"w-56"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-8 text-center" style={{ height: "100dvh" }}>
        <AlertTriangle className="w-10 h-10 text-red-300 mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-3">Unable to load chat</h2>
        <button onClick={() => refetch()} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Try again</button>
      </div>
    );
  }

  const { conversation } = chatData;
  const isReadOnly    = conversation.chatStatus === "read_only" || conversation.chatStatus === "locked";
  const otherPartyLabel = isProvider ? "Customer" : "Service Provider";
  const platformLabel = PLATFORM_LABELS[platform] || platform.replace(/_/g, " ");

  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes chat-bounce {
          0%,80%,100%{transform:translateY(0);opacity:.4}
          40%{transform:translateY(-5px);opacity:1}
        }
      `}</style>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleImageSelect(file);
        }}
      />

      <div className="flex flex-col bg-white text-gray-900 overflow-hidden" style={{ height: "100dvh" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3 bg-white sticky top-0 z-10"
          style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
          <button onClick={() => setLocation(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-white transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-gray-400">{otherPartyLabel.charAt(0)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 truncate">{otherPartyLabel}</h3>
              {platformLabel && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                  style={{ color: "#0B57D0", background: "#EEF3FD", borderColor: "#D0E2FB" }}>
                  {platformLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <StatusChip status={conversation.chatStatus} />
              {/* Wave 1 #3: session timer chip — live elapsed since "Starting now" */}
              {sessionStartedAt && !isReadOnly && (
                <SessionTimerChip startedAt={sessionStartedAt} />
              )}
              <span className="text-[10px] text-gray-300 font-mono">#{bookingId?.slice(-6).toUpperCase()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {wsConnected && wsAuthed
              ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              : <WifiOff className="w-3.5 h-3.5 text-gray-200" />
            }

            {/* ── Overflow menu (§8: Header must include overflow menu for report/help) ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-white transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white shadow-xl rounded-xl border border-gray-100">
                <DropdownMenuItem
                  className="flex items-center gap-2.5 text-sm cursor-pointer py-2.5"
                  onClick={() => aiSummarizeMutation.mutate()}
                >
                  <Bot className="w-4 h-4 text-blue-500" />
                  {aiSummarizeMutation.isPending ? "Summarizing…" : "AI Summarize chat"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2.5 text-sm cursor-pointer py-2.5"
                  onClick={() => setReportingMsg({ messageId: "", senderUid: "", content: "" } as any)}
                >
                  <Flag className="w-4 h-4 text-amber-500" />
                  Report this conversation
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-2.5 text-sm text-red-500 cursor-pointer py-2.5"
                  onClick={() => setShowBlockSheet(true)}
                >
                  <Ban className="w-4 h-4" />
                  Block this user
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2.5 text-sm cursor-pointer py-2.5 text-gray-400">
                  <Phone className="w-4 h-4" />
                  Contact Support
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2.5 text-sm cursor-pointer py-2.5 text-gray-400">
                  <FileText className="w-4 h-4" />
                  View booking details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Read-only banner ────────────────────────────────────────────── */}
        {isReadOnly && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[12px] text-amber-700">
              Conversation closed — {conversation.closedReason || "booking complete"}. Messages are read-only.
            </p>
          </div>
        )}

        {/* ── Safety notice ────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] text-gray-400">Keep conversations on-platform for your safety.</span>
        </div>

        {/* ── Provider quick actions bar (§11) ────────────────────────────── */}
        {isProvider && !isReadOnly && (
          <div className="shrink-0 border-b border-gray-100 bg-white">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setShowQuickActions(v => !v)}
            >
              <span className="font-semibold">Provider Quick Actions</span>
              {showQuickActions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showQuickActions && (
              <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
                {PROVIDER_QUICK_ACTIONS.map(action => {
                  const Icon = action.icon;
                  return (
                    <button key={action.id} onClick={() => quickActionMutation.mutate(action.id)}
                      disabled={quickActionMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all active:scale-95 shrink-0 disabled:opacity-50"
                      style={{ color: action.color, borderColor: action.color + "40", background: action.color + "08" }}>
                      <Icon size={12} />{action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AI Summary panel (§14) ───────────────────────────────────────── */}
        {aiSummary && (
          <SummaryPanel summary={aiSummary} onClose={() => setAiSummary(null)} />
        )}

        {/* ── Message list ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {/* Wave 1 #2: Contextual empty state */}
            {messages.length === 0 && (
              <ContextualEmptyState
                platform={platform}
                chatStatus={conversation.chatStatus}
                closedReason={conversation.closedReason}
                isReadOnly={isReadOnly}
              />
            )}

            {messages.map((msg) => {
              const isMe     = msg.senderUid === user?.uid;
              const isSystem = msg.senderRole === "system";
              const isImage  = msg.messageType === "image" && msg.metadata && (msg.metadata as any).imageUrl;
              const isCare   = msg.messageType === "care_summary";
              const swipeX   = swipeOffsets[msg.messageId] || 0;

              // Swipe-to-reply touch handlers (right swipe → reply)
              const onTouchStart = (e: React.TouchEvent) => {
                swipeTouchStart.current[msg.messageId] = e.touches[0].clientX;
              };
              const onTouchMove = (e: React.TouchEvent) => {
                const delta = e.touches[0].clientX - (swipeTouchStart.current[msg.messageId] ?? 0);
                if (delta > 0 && delta < 80) {
                  setSwipeOffsets(p => ({ ...p, [msg.messageId]: delta }));
                }
              };
              const onTouchEnd = () => {
                const delta = swipeOffsets[msg.messageId] || 0;
                if (delta >= 55) setReplyingTo(msg);
                setSwipeOffsets(p => ({ ...p, [msg.messageId]: 0 }));
              };

              if (msg.messageType === "payment_cta" && !dismissedCtaIds.has(msg.messageId)) {
                const meta = (msg.metadata as any) || {};
                const ctaType = meta.ctaType as string | undefined;
                const ctaLabel = ctaType === 'tip' ? 'Leave a Tip' : ctaType === 'upgrade' ? 'Upgrade Service' : 'View Packages';
                return (
                  <div key={msg.messageId} className="flex justify-center my-2">
                    <div className="bg-white border border-amber-100 rounded-2xl px-4 py-3 max-w-[85%] relative"
                      style={{ boxShadow: "0 2px 14px rgba(245,158,11,0.10)" }}>
                      <button onClick={() => setDismissedCtaIds(s => new Set([...s, msg.messageId]))}
                        className="absolute top-2 right-2 text-gray-200 hover:text-gray-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Payment Suggestion</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-3">{msg.content}</p>
                      <a href="/wallet"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg,#D97706,#F59E0B)" }}>
                        <CreditCard className="w-3.5 h-3.5" />
                        {ctaLabel}
                      </a>
                    </div>
                  </div>
                );
              }

              if (msg.messageType === "gps_card") {
                const meta = (msg.metadata as any) || {};
                const mapsUrl = `https://maps.google.com/?q=${meta.lat},${meta.lng}`;
                return (
                  <div key={msg.messageId} className="flex justify-center my-2">
                    <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden max-w-[85%]"
                      style={{ boxShadow: "0 2px 14px rgba(11,87,208,0.10)" }}>
                      {/* Map visual */}
                      <div className="relative bg-blue-50 h-28 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAwaDYwdjYwSDB6IiBmaWxsPSIjRTdFRkZGIi8+PHBhdGggZD0iTTMwIDMwbTMwIDBhMzAgMzAgMCAxIDEtNjAgMCAzMCAzMCAwIDAgMSA2MCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNDN0Q3RjgiIHN0cm9rZS13aWR0aD0iMC41Ii8+PHBhdGggZD0iTTAgMzBoNjBNMzAgMHYzMCIgc3Ryb2tlPSIjQzdEN0Y4IiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvc3ZnPg==')] opacity-60" />
                        <div className="relative flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                          <div className="w-2 h-2 rounded-full bg-blue-200 mt-0.5" />
                        </div>
                      </div>
                      {/* Info */}
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Provider On the Way</span>
                          <span className="text-[9px] text-gray-300">{msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{msg.content}</p>
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors">
                          <MapPin className="w-3 h-3" /> View on Map
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isSystem && isCare) {
                const meta = (msg.metadata as any) || {};
                return (
                  <div key={msg.messageId} className="flex justify-center my-2">
                    <div className="bg-white border border-emerald-100 rounded-2xl px-4 py-3 max-w-[85%]"
                      style={{ boxShadow: "0 2px 12px rgba(5,150,105,0.08)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
                          <ClipboardList className="w-4 h-4 text-emerald-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Care Summary</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                      {meta.mood && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400">
                          <span>Mood: {meta.mood}</span>
                          {meta.energyLevel && <span>Energy: {meta.energyLevel}/5</span>}
                        </div>
                      )}
                      <div className="mt-1 text-[9px] text-gray-300">{msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}</div>
                    </div>
                  </div>
                );
              }

              if (isSystem) {
                return (
                  <div key={msg.messageId} className="flex justify-center my-1">
                    <div className="bg-white border border-gray-100 rounded-full px-4 py-1.5 flex items-center gap-2 text-[11px] text-gray-500"
                      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="font-medium">{msg.content}</span>
                      <span className="text-[9px] text-gray-300">{msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}</span>
                    </div>
                  </div>
                );
              }

              const quotedMsg = msg.replyToMessageId ? messages.find(m => m.messageId === msg.replyToMessageId) : null;
              const isSessionPhoto = msg.messageType === "session_photo" && msg.metadata && (msg.metadata as any).imageUrl;
              const msgReactions = reactionCounts[msg.messageId] || {};
              const hasReactions = Object.keys(msgReactions).length > 0;

              const startLongPress = () => {
                longPressTimer.current = setTimeout(() => setReactionPickerMsgId(msg.messageId), 480);
              };
              const cancelLongPress = () => {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
              };

              return (
                <div key={msg.messageId} className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}>
                  <div className="relative">
                  {/* Reaction picker popup */}
                  {reactionPickerMsgId === msg.messageId && (
                    <div className={`absolute z-20 bottom-full mb-1 ${isMe ? "right-0" : "left-0"}`}>
                      <div className="bg-white border border-gray-100 rounded-full px-3 py-2 flex items-center gap-1.5 shadow-xl"
                        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                        {["❤️", "🐾", "👍", "⭐", "✅", "🎉"].map(r => (
                          <button key={r}
                            onClick={() => { reactMutation.mutate({ messageId: msg.messageId, reaction: r }); setReactionPickerMsgId(null); }}
                            className="text-xl hover:scale-125 transition-transform active:scale-110 p-0.5 rounded-full hover:bg-white">
                            {r}
                          </button>
                        ))}
                        <button onClick={() => setReactionPickerMsgId(null)}
                          className="ml-1 text-gray-300 hover:text-gray-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div
                    onTouchStart={(e) => { onTouchStart(e); startLongPress(); }}
                    onTouchMove={(e) => { onTouchMove(e); cancelLongPress(); }}
                    onTouchEnd={() => { cancelLongPress(); onTouchEnd(); }}
                    onMouseDown={startLongPress}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    className={`max-w-[82%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 transition-transform ${isMe ? "rounded-tr-sm text-white" : "rounded-tl-sm bg-white text-gray-900 border border-gray-100"}`}
                    style={Object.assign(
                      isMe
                        ? { background: "linear-gradient(135deg,#0B57D0,#4E8DF7)", boxShadow: "0 2px 10px rgba(11,87,208,0.2)" }
                        : { boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
                      swipeX > 0 ? { transform: `translateX(${swipeX}px)` } : {}
                    )}
                  >
                    {/* Quoted reply preview */}
                    {quotedMsg && (
                      <div className={`mb-2 rounded-lg px-2.5 py-1.5 text-[11px] border-l-2 ${isMe ? "border-white/50 bg-white/15" : "border-blue-300 bg-blue-50"}`}>
                        <div className={`font-semibold mb-0.5 ${isMe ? "text-white/80" : "text-blue-600"}`}>
                          {quotedMsg.senderUid === user?.uid ? "You" : "Them"}
                        </div>
                        <div className={`truncate ${isMe ? "text-white/70" : "text-gray-500"}`}>
                          {quotedMsg.isDeleted ? "[Deleted]" : quotedMsg.content.slice(0, 80)}
                        </div>
                      </div>
                    )}

                    {/* T010: Translation display */}
                    {translations[msg.messageId] && !showOriginal.has(msg.messageId) && !msg.isDeleted && (
                      <div className={`mb-1.5 rounded-lg px-2 py-1 text-[11px] border-l-2 ${isMe ? "border-white/40 bg-white/10" : "border-blue-200 bg-blue-50/50"}`}>
                        <div className={`flex items-center gap-1 mb-0.5 ${isMe ? "text-white/60" : "text-blue-500"}`}>
                          <Globe className="w-2.5 h-2.5" />
                          <span className="font-semibold text-[9px] uppercase tracking-wide">Translated</span>
                        </div>
                        <p className={`text-xs leading-snug ${isMe ? "text-white/85" : "text-gray-600"}`}>{translations[msg.messageId]}</p>
                        <button onClick={() => setShowOriginal(p => { const n = new Set(p); n.add(msg.messageId); return n; })}
                          className={`mt-0.5 text-[9px] underline underline-offset-2 ${isMe ? "text-white/50" : "text-gray-400"}`}>
                          Show original
                        </button>
                      </div>
                    )}

                    {msg.isDeleted ? (
                      <span className="italic text-sm opacity-60">[Message removed]</span>
                    ) : msg.messageType === "voice_message" && (msg.metadata as any)?.audioUrl ? (
                      <WaveformPlayer
                        audioUrl={sanitizeUrl((msg.metadata as any).audioUrl)}
                        transcript={(msg.metadata as any).transcript}
                        isMe={isMe}
                      />
                    ) : isSessionPhoto ? (
                      <div className="rounded-xl overflow-hidden -mx-1">
                        <button onClick={() => setViewingImage(sanitizeUrl((msg.metadata as any).imageUrl))} className="block w-full">
                          <img src={sanitizeUrl((msg.metadata as any).imageUrl)} className="w-full object-cover" style={{ maxHeight: 240 }} alt="Session photo" />
                        </button>
                        {(msg.metadata as any).caption && (
                          <div className={`px-2 py-1.5 text-xs leading-snug ${isMe ? "text-white/85" : "text-gray-600"}`}>
                            {(msg.metadata as any).caption}
                          </div>
                        )}
                      </div>
                    ) : isImage ? (
                      <button onClick={() => setViewingImage(sanitizeUrl((msg.metadata as any).imageUrl))} className="block rounded-lg overflow-hidden">
                        <img src={sanitizeUrl((msg.metadata as any).imageUrl)} className="max-w-full rounded-lg" style={{ maxHeight: 220, objectFit: "cover" }} alt="Chat image" />
                      </button>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {/* Wave 1 #1: tappable read receipt — shows "Seen at HH:mm" */}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMe ? "text-white/60 justify-end" : "text-gray-300"}`}>
                      {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                      {isMe && (() => {
                        const readAt = isProvider ? msg.readByCustomerAt : msg.readByProviderAt;
                        const isRead = !!readAt;
                        return (
                          <button
                            className="ml-0.5 relative outline-none"
                            onClick={() => setSeenPopupId(seenPopupId === msg.messageId ? null : msg.messageId)}
                            title={isRead ? "Seen" : "Delivered"}
                          >
                            {isRead
                              ? <CheckCheck className="w-3 h-3" style={{ color: isMe ? "rgba(255,255,255,0.9)" : "#0B57D0" }} />
                              : <Check className="w-3 h-3" />
                            }
                            {seenPopupId === msg.messageId && (
                              <SeenPopup readAt={readAt ?? null} />
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                  </div>{/* close relative */}

                  {/* Reaction counts */}
                  {hasReactions && (
                    <div className={`flex flex-wrap gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                      {Object.entries(msgReactions).map(([emoji, count]) => count > 0 && (
                        <button key={emoji}
                          onClick={() => reactMutation.mutate({ messageId: msg.messageId, reaction: emoji })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-100 text-[11px] font-medium text-gray-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.isFlagged && !msg.isDeleted && (
                    <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-amber-500 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Under review
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    {!msg.isDeleted && (
                      <button onClick={() => setReplyingTo(msg)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5 px-1 text-[10px] text-gray-300 hover:text-blue-400 flex items-center gap-1 transition-opacity">
                        <Reply className="w-3 h-3" /> Reply
                      </button>
                    )}
                    {!msg.isDeleted && (
                      <button onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.messageId ? null : msg.messageId)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5 px-1 text-[10px] text-gray-300 hover:text-yellow-400 flex items-center gap-1 transition-opacity">
                        <Smile className="w-3 h-3" />
                      </button>
                    )}
                    {!msg.isDeleted && msg.messageType === 'text' && msg.content.length > 2 && (
                      <button onClick={() => translateMessage(msg)}
                        disabled={translatingId === msg.messageId}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5 px-1 text-[10px] text-gray-300 hover:text-indigo-400 flex items-center gap-1 transition-opacity disabled:opacity-30"
                        title={translations[msg.messageId] ? (showOriginal.has(msg.messageId) ? "Show translation" : "Show original") : "Translate"}>
                        {translatingId === msg.messageId
                          ? <span className="w-2.5 h-2.5 border border-gray-300 border-t-indigo-400 rounded-full animate-spin" />
                          : <Globe className="w-3 h-3" />
                        }
                      </button>
                    )}
                    {!isMe && !msg.isDeleted && (
                      <button onClick={() => setReportingMsg(msg)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5 px-1 text-[10px] text-gray-300 hover:text-red-400 flex items-center gap-1 transition-opacity">
                        <Flag className="w-3 h-3" /> Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isOtherTyping && (
              <div className="flex items-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* ── Composer ─────────────────────────────────────────────────────── */}
        {!isReadOnly && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="max-w-2xl mx-auto">
              {/* Reply preview bar */}
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 px-1 py-1.5 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-0.5 h-8 bg-blue-400 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                      <Reply className="w-3 h-3" />
                      Replying to {replyingTo.senderUid === user?.uid ? "yourself" : "them"}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">{replyingTo.content.slice(0, 80)}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-gray-300 hover:text-gray-500 transition-colors p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* AI assist row (§14) */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button onClick={() => aiDraftMutation.mutate()}
                  disabled={aiDraftMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
                  <Sparkles className="w-3 h-3" />
                  {aiDraftMutation.isPending ? "Drafting…" : "AI Draft"}
                </button>
                <button onClick={() => aiSummarizeMutation.mutate()}
                  disabled={aiSummarizeMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-purple-600 border border-purple-100 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50">
                  <Bot className="w-3 h-3" />
                  {aiSummarizeMutation.isPending ? "Summarizing…" : "Summarize"}
                </button>
              </div>

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-sm font-semibold text-red-600 flex-1">Recording…</span>
                  <span className="text-sm text-red-400 tabular-nums">{recordingSecs}s / 60s</span>
                  <button onClick={stopRecording} className="text-red-400 hover:text-red-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2">
                {/* Image attach */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || sendMutation.isPending || isRecording}
                  className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-colors shrink-0 disabled:opacity-40"
                  title="Attach image"
                >
                  {uploadingImage ? (
                    <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </button>

                {/* Mic button (T007) */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={uploadingAudio || uploadingImage || sendMutation.isPending}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${
                    isRecording
                      ? "border-red-300 bg-red-50 text-red-500 animate-pulse"
                      : "border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200"
                  }`}
                  title={isRecording ? `Stop recording (${recordingSecs}s)` : "Voice message"}
                >
                  {uploadingAudio ? (
                    <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-red-400 rounded-full animate-spin" />
                  ) : isRecording ? (
                    <StopCircle className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1 relative">
                  <textarea
                    value={inputText}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder="Type a message…"
                    rows={1}
                    className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:bg-white transition-colors"
                    style={{ minHeight: 44, maxHeight: 120 }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  {inputText.length > 1800 && (
                    <div className="absolute right-3 bottom-2 text-[9px] text-gray-400">{inputText.length}/2000</div>
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sendMutation.isPending}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30"
                  style={{
                    background: inputText.trim() ? "linear-gradient(135deg,#0B57D0,#4E8DF7)" : "#E5E7EB",
                    boxShadow: inputText.trim() ? "0 2px 8px rgba(11,87,208,0.3)" : "none",
                  }}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Read-only placeholder ────────────────────────────────────────── */}
        {isReadOnly && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Lock className="w-4 h-4" /> Conversation closed — read only
            </div>
          </div>
        )}
      </div>

      {/* Backdrop to dismiss reaction picker */}
      {reactionPickerMsgId && (
        <div className="fixed inset-0 z-10" onClick={() => setReactionPickerMsgId(null)} />
      )}

      {/* ── Session photo caption dialog ─────────────────────────────────── */}
      {pendingPhoto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            {/* Image preview */}
            <div className="relative">
              <img src={sanitizeUrl(pendingPhoto.imageUrl)} className="w-full object-cover" style={{ maxHeight: 220 }} alt="Preview" />
              <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
                <Camera className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-semibold">Session Photo</span>
              </div>
            </div>
            {/* Caption editor */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-start gap-2 mb-1">
                <Edit2 className="w-3.5 h-3.5 text-blue-400 mt-1 shrink-0" />
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">AI Caption — edit before sending</span>
              </div>
              <textarea
                value={photoCaption}
                onChange={e => setPhotoCaption(e.target.value)}
                rows={3}
                className="w-full text-sm text-gray-700 border border-gray-100 rounded-xl p-2.5 resize-none focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
                placeholder="Add a caption…"
              />
            </div>
            {/* Actions */}
            <div className="flex gap-2 px-4 pb-4">
              <button onClick={() => { setPendingPhoto(null); setPhotoCaption(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-white transition-colors">
                Discard
              </button>
              <button onClick={sendPendingPhoto} disabled={sendMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)" }}>
                {sendMutation.isPending ? "Sending…" : "Send Photo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen image viewer (§15 #3: ImageViewerScreen) ──────────── */}
      {viewingImage && <ImageViewer url={viewingImage} onClose={() => setViewingImage(null)} />}

      {/* ── Block User Sheet (§15 #5: BlockUserSheet) ─────────────────────── */}
      <BlockUserSheet
        open={showBlockSheet}
        onClose={() => setShowBlockSheet(false)}
        onConfirm={() => blockMutation.mutate()}
        isPending={blockMutation.isPending}
      />

      {/* ── Report Message Dialog (§15 #4: ReportMessageModal) ────────────── */}
      <Dialog
        open={!!reportingMsg}
        onOpenChange={open => { if (!open) { setReportingMsg(null); setReportReason(""); } }}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Flag className="w-4 h-4 text-red-400" /> Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inappropriate_content">Inappropriate content</SelectItem>
                  <SelectItem value="contact_info">Sharing contact information</SelectItem>
                  <SelectItem value="harassment">Harassment or threats</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="also-block" onCheckedChange={c => c === true && setShowBlockSheet(true)} />
              <Label htmlFor="also-block" className="text-sm font-normal cursor-pointer text-gray-600">
                Also block this user
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => { setReportingMsg(null); setReportReason(""); }}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-white transition-colors">
              Cancel
            </button>
            <button
              disabled={!reportReason || reportMutation.isPending}
              onClick={() => {
                if (reportingMsg && reportReason) {
                  reportMutation.mutate({ messageId: reportingMsg.messageId, reason: reportReason, block: false });
                }
              }}
              className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors"
            >
              {reportMutation.isPending ? "Submitting…" : "Submit Report"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
