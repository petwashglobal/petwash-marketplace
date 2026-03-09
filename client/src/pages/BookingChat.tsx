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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import type { BookingConversation, BookingMessage } from "@shared/schema";
import {
  Send,
  Lock,
  AlertTriangle,
  CheckCheck,
  Check,
  ArrowLeft,
  ShieldCheck,
  Flag,
  MessageSquare,
  Wifi,
  WifiOff,
  Sparkles,
  MapPin,
  Navigation,
  PlayCircle,
  CheckCircle2,
  HelpCircle,
  AlertOctagon,
  X,
  Image as ImageIcon
} from "lucide-react";

// ─── Provider quick actions ──────────────────────────────────────────────────
const PROVIDER_QUICK_ACTIONS = [
  { id: "on_my_way", label: "On my way", icon: Navigation, color: "#0B57D0" },
  { id: "arrived",   label: "Arrived",   icon: MapPin,      color: "#059669" },
  { id: "starting",  label: "Starting",  icon: PlayCircle,  color: "#7C3AED" },
  { id: "completed", label: "Done",      icon: CheckCircle2,color: "#059669" },
  { id: "need_help", label: "Need help", icon: HelpCircle,  color: "#D97706" },
  { id: "issue",     label: "Issue",     icon: AlertOctagon,color: "#DC2626" },
];

const QUICK_ACTION_MESSAGES: Record<string, string> = {
  on_my_way: "I'm on my way to you! 🐾",
  arrived:   "I have arrived!",
  starting:  "Starting the session now.",
  completed: "Session completed! Thank you 🐾",
  need_help: "I need some assistance. Please respond when you can.",
  issue:     "There is an issue that needs your attention.",
};

// ─── Typing indicator dots ───────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-end gap-[3px]">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-300"
            style={{
              animation: "typing-bounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
      <span className="text-[11px] text-gray-400">typing…</span>
    </div>
  );
}

// ─── Image viewer modal ───────────────────────────────────────────────────────
function ImageViewerModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-7 h-7" />
      </button>
      <img
        src={url}
        className="max-w-full max-h-full object-contain rounded-lg"
        style={{ maxWidth: "90vw", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
        alt="Full-screen preview"
      />
    </div>
  );
}

// ─── Status chip ─────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 uppercase">
      <Lock className="w-3 h-3" />
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BookingChat() {
  const [, params] = useRoute("/booking-chat/:bookingId");
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const bookingId = params?.bookingId;

  const [inputText, setInputText]       = useState("");
  const [wsConnected, setWsConnected]   = useState(false);
  const [wsAuthed, setWsAuthed]         = useState(false);
  const [messages, setMessages]         = useState<BookingMessage[]>([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isProvider, setIsProvider]     = useState(false);
  const [reportingMsg, setReportingMsg] = useState<BookingMessage | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [blockUser, setBlockUser]       = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const socketRef    = useRef<WebSocket | null>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 1. Open conversation ────────────────────────────────────────────────
  const openMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/open`);
      return res.json() as Promise<{ conversationId: string }>;
    },
    onSuccess: (data) => setConversationId(data.conversationId),
    onError: (err: any) => {
      toast({
        title: "Cannot open chat",
        description: err.message || "Chat is not available for this booking yet.",
        variant: "destructive",
      });
    },
  });

  // ─── 2. Fetch conversation + messages ────────────────────────────────────
  const { data: chatData, isLoading, error, refetch } = useQuery<{
    conversation: BookingConversation;
    messages: BookingMessage[];
  }>({
    queryKey: [`/api/booking-chat/${bookingId}`],
    enabled: !!conversationId,
  });

  // ─── 3. Send message ──────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/send`, {
        content,
        messageType: "text",
      });
      return res.json();
    },
    onSuccess: () => setInputText(""),
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.userMessage || "Please try again.", variant: "destructive" });
    },
  });

  // ─── 4. Mark read ─────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: async () => { await apiRequest("PUT", `/api/booking-chat/${bookingId}/read`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-chat/inbox"] });
      queryClient.invalidateQueries({ queryKey: [`/api/booking-chat/${bookingId}`] });
    },
  });

  // ─── 5. Quick action (system message) ────────────────────────────────────
  const quickActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const content = QUICK_ACTION_MESSAGES[actionId];
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/send`, {
        content,
        messageType: "text",
      });
      return res.json();
    },
    onError: () => toast({ title: "Failed to send action", variant: "destructive" }),
  });

  // ─── 6. AI draft ──────────────────────────────────────────────────────────
  const aiDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/ai-draft`, {});
      return res.json() as Promise<{ draft: string }>;
    },
    onSuccess: (data) => {
      if (data.draft) setInputText(data.draft);
    },
    onError: () => toast({ title: "AI draft unavailable", variant: "destructive" }),
  });

  // ─── 7. Report message ────────────────────────────────────────────────────
  const reportMutation = useMutation({
    mutationFn: async ({ messageId, reason, block }: { messageId: string; reason: string; block: boolean }) => {
      await apiRequest("POST", `/api/booking-chat/${bookingId}/report`, { messageId, reason, blockUser: block });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Our team will review this." });
      setReportingMsg(null); setReportReason(""); setBlockUser(false);
    },
    onError: () => toast({ title: "Failed to report", variant: "destructive" }),
  });

  // ─── Lifecycle: open on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (bookingId && user) openMutation.mutate();
  }, [bookingId, user?.uid]);

  // ─── Populate messages from fetch ─────────────────────────────────────────
  useEffect(() => {
    if (chatData?.messages) {
      setMessages(chatData.messages);
      const conv = chatData.conversation;
      setIsProvider(conv.providerId === user?.uid);
      markReadMutation.mutate();
    }
  }, [chatData?.messages]);

  // ─── WebSocket ────────────────────────────────────────────────────────────
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
          // Clear other-party typing when they send
          setIsOtherTyping(false);
          markReadMutation.mutate();
        }

        if (data.type === "chat_typing_presence" && data.conversationId === conversationId) {
          if (data.senderUid !== user.uid) {
            setIsOtherTyping(data.isTyping);
            // Auto-clear after 6s if no stop event
            if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
            if (data.isTyping) {
              otherTypingTimerRef.current = setTimeout(() => setIsOtherTyping(false), 6000);
            }
          }
        }

        if (data.type === "booking_chat_status" && data.conversationId === conversationId) {
          queryClient.setQueryData([`/api/booking-chat/${bookingId}`], (old: any) => {
            if (!old) return old;
            return { ...old, conversation: { ...old.conversation, chatStatus: data.chatStatus } };
          });
        }
      } catch {}
    };

    socket.onclose = () => {
      setWsConnected(false);
      setWsAuthed(false);
      reconnectRef.current = setTimeout(connectWebSocket, 5000);
    };
    socket.onerror = () => socket.close();
  }, [user, conversationId, bookingId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
      const s = socketRef.current;
      if (s?.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify({ type: "unsubscribe_booking_chat", payload: { conversationId } }));
        s.close();
      }
    };
  }, [connectWebSocket]);

  // ─── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  // ─── Typing events helper ─────────────────────────────────────────────────
  const sendTypingEvent = useCallback((isTyping: boolean) => {
    const s = socketRef.current;
    if (s?.readyState !== WebSocket.OPEN || !conversationId) return;
    s.send(JSON.stringify({
      type: isTyping ? "chat_typing_start" : "chat_typing_stop",
      payload: { conversationId }
    }));
  }, [conversationId]);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (val.trim()) {
      sendTypingEvent(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTypingEvent(false), 3000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      sendTypingEvent(false);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || sendMutation.isPending) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTypingEvent(false);
    sendMutation.mutate(inputText);
  };

  // ─── Loading / error states ───────────────────────────────────────────────
  if (openMutation.isPending || (!conversationId && !openMutation.isError)) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="p-4 border-b flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-5 w-32" />
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
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-white">
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-5 border border-gray-100">
          <Lock className="w-7 h-7 text-gray-300" />
        </div>
        <h2 className="text-lg font-bold mb-2 text-gray-800">Chat not available</h2>
        <p className="text-sm text-gray-400 mb-6">Chat opens once the booking is confirmed.</p>
        <button
          onClick={() => setLocation(-1)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="p-4 border-b flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-48" : "w-56"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-white">
        <AlertTriangle className="w-10 h-10 text-red-300 mb-4" />
        <h2 className="text-lg font-bold mb-3 text-gray-800">Unable to load chat</h2>
        <button
          onClick={() => refetch()}
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const { conversation } = chatData;
  const isReadOnly = conversation.chatStatus === "read_only" || conversation.chatStatus === "locked";
  const otherPartyLabel = isProvider ? "Customer" : "Service Provider";

  return (
    <>
      {/* Typing animation keyframes */}
      <style>{`
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col bg-white text-gray-900 overflow-hidden"
        style={{ height: "100dvh" }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3 bg-white sticky top-0 z-10"
          style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
          <button
            onClick={() => setLocation(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-gray-400">{otherPartyLabel.charAt(0)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 truncate">{otherPartyLabel}</h3>
              {isProvider && (
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                  Provider
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusChip status={conversation.chatStatus} />
              <span className="text-[10px] text-gray-300 font-mono">
                #{bookingId?.slice(-6).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Connection indicator */}
          <div className="shrink-0">
            {wsConnected && wsAuthed
              ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              : <WifiOff className="w-3.5 h-3.5 text-gray-200" />
            }
          </div>
        </div>

        {/* ── Read-only banner ──────────────────────────────────────────── */}
        {isReadOnly && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[12px] text-amber-700">
              This conversation is closed — {conversation.closedReason || "booking complete"}. Messages are read-only.
            </p>
          </div>
        )}

        {/* ── Safety notice ─────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] text-gray-400">Keep conversations on-platform for your safety.</span>
        </div>

        {/* ── Provider quick actions bar ───────────────────────────────── */}
        {isProvider && !isReadOnly && (
          <div className="shrink-0 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
              {PROVIDER_QUICK_ACTIONS.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => quickActionMutation.mutate(action.id)}
                    disabled={quickActionMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all active:scale-95 shrink-0"
                    style={{
                      color: action.color,
                      borderColor: action.color + "40",
                      background: action.color + "08",
                    }}
                  >
                    <Icon size={12} />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Message list ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-16 text-gray-300">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.senderUid === user?.uid;
              const isSystem = msg.senderRole === "system";
              const isImage = msg.messageType === "image" && msg.metadata && (msg.metadata as any).imageUrl;

              if (isSystem) {
                return (
                  <div key={msg.messageId} className="flex justify-center my-1">
                    <div className="bg-white border border-gray-100 shadow-sm rounded-full px-4 py-1.5 flex items-center gap-2 text-[11px] text-gray-500"
                      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="font-medium">{msg.content}</span>
                      <span className="text-[9px] text-gray-300">
                        {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.messageId} className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[82%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? "rounded-tr-sm text-white"
                        : "rounded-tl-sm bg-white text-gray-900 border border-gray-100"
                    }`}
                    style={isMe ? {
                      background: "linear-gradient(135deg, #0B57D0, #4E8DF7)",
                      boxShadow: "0 2px 10px rgba(11,87,208,0.2)",
                    } : {
                      boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    }}
                  >
                    {msg.isDeleted ? (
                      <span className="italic text-sm opacity-60">[Message removed]</span>
                    ) : isImage ? (
                      <button
                        onClick={() => setViewingImage((msg.metadata as any).imageUrl)}
                        className="block rounded-lg overflow-hidden"
                      >
                        <img
                          src={(msg.metadata as any).imageUrl}
                          className="max-w-full rounded-lg"
                          style={{ maxHeight: 220, objectFit: "cover" }}
                          alt="Chat image"
                        />
                      </button>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Timestamp + read receipt */}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMe ? "text-white/60 justify-end" : "text-gray-300"}`}>
                      {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                      {isMe && (
                        <span className="ml-0.5">
                          {(msg.readByCustomerAt || msg.readByProviderAt)
                            ? <CheckCheck className="w-3 h-3" />
                            : <Check className="w-3 h-3" />
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flagged notice */}
                  {msg.isFlagged && !msg.isDeleted && (
                    <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-amber-500 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Under review
                    </div>
                  )}

                  {/* Report button — hover */}
                  {!isMe && !msg.isDeleted && (
                    <button
                      onClick={() => setReportingMsg(msg)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5 px-1 text-[10px] text-gray-300 hover:text-red-400 flex items-center gap-1 transition-opacity"
                    >
                      <Flag className="w-3 h-3" /> Report
                    </button>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {isOtherTyping && (
              <div className="flex items-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </div>

        {/* ── Composer ─────────────────────────────────────────────────── */}
        {!isReadOnly && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="max-w-2xl mx-auto">
              {/* AI draft row */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => aiDraftMutation.mutate()}
                  disabled={aiDraftMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  {aiDraftMutation.isPending ? "Drafting…" : "AI draft"}
                </button>
                <span className="text-[10px] text-gray-300">Suggestion only — you control what's sent</span>
              </div>

              {/* Input + send */}
              <div className="flex items-end gap-2">
                {/* Image attach placeholder */}
                <button
                  className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:border-gray-300 transition-colors shrink-0"
                  title="Attach image (coming soon)"
                  disabled
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <div className="flex-1 relative">
                  <textarea
                    value={inputText}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder="Type a message…"
                    rows={1}
                    className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:bg-white transition-colors"
                    style={{ minHeight: 44, maxHeight: 120, lineHeight: "1.5" }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  {inputText.length > 1800 && (
                    <div className="absolute right-3 bottom-2 text-[9px] text-gray-400">
                      {inputText.length}/2000
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sendMutation.isPending}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30"
                  style={{
                    background: inputText.trim() ? "linear-gradient(135deg, #0B57D0, #4E8DF7)" : "#E5E7EB",
                    boxShadow: inputText.trim() ? "0 2px 8px rgba(11,87,208,0.3)" : "none",
                  }}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Read-only composer placeholder ───────────────────────────── */}
        {isReadOnly && (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Lock className="w-4 h-4" />
              Conversation closed — read only
            </div>
          </div>
        )}
      </div>

      {/* ── Full-screen image viewer ──────────────────────────────────────── */}
      {viewingImage && (
        <ImageViewerModal url={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {/* ── Report dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!reportingMsg}
        onOpenChange={open => { if (!open) { setReportingMsg(null); setReportReason(""); setBlockUser(false); } }}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Flag className="w-4 h-4 text-red-400" /> Report Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
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
              <Checkbox
                id="block-user"
                checked={blockUser}
                onCheckedChange={c => setBlockUser(c === true)}
              />
              <Label htmlFor="block-user" className="text-sm font-normal cursor-pointer text-gray-600">
                Block this user from contacting me
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => { setReportingMsg(null); setReportReason(""); setBlockUser(false); }}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!reportReason || reportMutation.isPending}
              onClick={() => {
                if (reportingMsg && reportReason) {
                  reportMutation.mutate({ messageId: reportingMsg.messageId, reason: reportReason, block: blockUser });
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
