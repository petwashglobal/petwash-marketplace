import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/lib/languageStore";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Card, 
  CardContent, 
  CardHeader 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Send, 
  Lock, 
  AlertTriangle, 
  CheckCheck, 
  Check, 
  ArrowLeft,
  ShieldCheck,
  Info,
  Flag,
  MessageSquare,
  Wifi,
  WifiOff
} from "lucide-react";
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

export default function BookingChat() {
  const [, params] = useRoute("/booking-chat/:bookingId");
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { dir } = useLanguage();
  const { toast } = useToast();
  const bookingId = params?.bookingId;

  const [inputText, setInputText] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [wsMessagingAuthed, setWsMessagingAuthed] = useState(false);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [reportingMessage, setReportingMessage] = useState<BookingMessage | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [blockUser, setBlockUser] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1: Open (or get) the conversation
  const openMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/open`);
      return res.json() as Promise<{ conversationId: string }>;
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
    },
    onError: (err: any) => {
      toast({
        title: "Cannot open chat",
        description: err.message || "Chat is not available for this booking yet.",
        variant: "destructive",
      });
    },
  });

  // Step 2: Load conversation + messages
  const { data: chatData, isLoading, error, refetch } = useQuery<{
    conversation: BookingConversation;
    messages: BookingMessage[];
  }>({
    queryKey: [`/api/booking-chat/${bookingId}`],
    enabled: !!conversationId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/send`, {
        content,
        messageType: "text",
      });
      return res.json();
    },
    onSuccess: () => {
      setInputText("");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.userMessage || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/booking-chat/${bookingId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-chat/inbox"] });
      queryClient.invalidateQueries({ queryKey: [`/api/booking-chat/${bookingId}`] });
    }
  });

  const reportMutation = useMutation({
    mutationFn: async ({ messageId, reason, block }: { messageId: string; reason: string; block: boolean }) => {
      await apiRequest("POST", `/api/booking-chat/${bookingId}/report`, {
        messageId,
        reason,
        blockUser: block
      });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you. Our team will review this message." });
      setReportingMessage(null);
      setReportReason("");
      setBlockUser(false);
    },
    onError: () => {
      toast({ title: "Failed to submit report", variant: "destructive" });
    }
  });

  // Open the conversation on mount
  useEffect(() => {
    if (bookingId && user) {
      openMutation.mutate();
    }
  }, [bookingId, user?.uid]);

  // Populate messages from initial fetch
  useEffect(() => {
    if (chatData?.messages) {
      setMessages(chatData.messages);
      markAsReadMutation.mutate();
    }
  }, [chatData?.messages]);

  // WebSocket: connect once conversationId is known
  const connectWebSocket = useCallback(() => {
    if (!user || !conversationId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/realtime`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = async () => {
      setWsConnected(true);
      // Authenticate for messaging using Firebase token
      try {
        const token = await user.getIdToken();
        socket.send(JSON.stringify({ type: "auth_messaging", payload: { firebaseToken: token } }));
      } catch {
        // Token fetch failed — chat still works via polling
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "messaging_auth_success") {
          setWsMessagingAuthed(true);
          // Subscribe to this booking's conversation
          socket.send(JSON.stringify({ 
            type: "subscribe_booking_chat",
            payload: { conversationId }
          }));
        }

        if (data.type === "booking_chat_message" && data.conversationId === conversationId) {
          setMessages((prev) => {
            // Deduplicate by messageId
            const exists = prev.some(m => m.messageId === data.message.messageId);
            return exists ? prev : [...prev, data.message];
          });
          markAsReadMutation.mutate();
        }

        if (data.type === "booking_chat_status" && data.conversationId === conversationId) {
          queryClient.setQueryData(["/api/booking-chat", bookingId], (old: any) => {
            if (!old) return old;
            return { ...old, conversation: { ...old.conversation, chatStatus: data.chatStatus } };
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
      setWsMessagingAuthed(false);
      // Auto-reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [user, conversationId, bookingId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: "unsubscribe_booking_chat",
          payload: { conversationId }
        }));
        socket.close();
      }
    };
  }, [connectWebSocket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(inputText);
  };

  // Opening state
  if (openMutation.isPending || (!conversationId && !openMutation.isError)) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="p-4 border-b flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p className="text-sm">Opening conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (openMutation.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center bg-white">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Chat not available</h2>
        <p className="text-muted-foreground text-sm mb-4">Chat is available once a booking is confirmed.</p>
        <Button variant="outline" onClick={() => setLocation(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="p-4 border-b flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <ScrollArea className="flex-1 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex mb-4 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <Skeleton className="h-12 w-48 rounded-lg" />
            </div>
          ))}
        </ScrollArea>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center bg-white">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Unable to load chat</h2>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const { conversation } = chatData;
  const isReadOnly = conversation.chatStatus === "read_only" || conversation.chatStatus === "locked";
  const otherPartyUid = user?.uid === conversation.customerId ? conversation.providerId : conversation.customerId;
  const otherPartyLabel = user?.uid === conversation.customerId ? "Service Provider" : "Customer";

  return (
    <div className="flex flex-col h-screen bg-white text-foreground overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3 bg-white sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => setLocation(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10 border-2 border-gray-100">
          <AvatarFallback className="bg-gray-50 text-gray-700 font-semibold">
            {otherPartyLabel.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{otherPartyLabel}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-mono">
              #{bookingId?.slice(-6).toUpperCase()}
            </Badge>
            {conversation.chatStatus === "active" ? (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400 uppercase text-[10px]">
                <Lock className="w-3 h-3" />
                {conversation.chatStatus}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {wsConnected && wsMessagingAuthed ? (
            <Wifi className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-gray-300" />
          )}
        </div>
      </div>

      {/* Read-only Banner */}
      {isReadOnly && (
        <div className="bg-white border-b border-gray-100 p-2.5 flex items-center gap-2 text-xs text-amber-700">
          <Info className="w-4 h-4 flex-shrink-0" />
          <p>This conversation is closed. Booking is {conversation.closedReason || 'complete'}. Messages are read-only.</p>
        </div>
      )}

      {/* Security notice */}
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 text-[11px] text-gray-500">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span>For your safety, keep conversations on-platform. Sharing contact info is not allowed.</span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderUid === user?.uid;
            const isSystem = msg.senderRole === "system";

            if (isSystem) {
              return (
                <div key={msg.messageId} className="flex justify-center my-2">
                  <div className="bg-white border shadow-sm rounded-full px-4 py-1.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    {msg.content}
                    <span className="text-[9px] opacity-60">
                      • {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.messageId}
                className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-white text-gray-900 border rounded-tl-none"
                  }`}
                >
                  {msg.isDeleted ? (
                    <span className="italic opacity-70 text-sm">[Message removed]</span>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                  <div
                    className={`flex items-center gap-1 mt-1.5 text-[10px] ${
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                    {isMe && (
                      <span className="ml-1">
                        {(msg.readByCustomerAt || msg.readByProviderAt) ? (
                          <CheckCheck className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {msg.isFlagged && !msg.isDeleted && (
                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-amber-600 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Under review
                  </div>
                )}
                {!isMe && !msg.isDeleted && (
                  <button
                    onClick={() => setReportingMessage(msg)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-1 px-1 text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-opacity"
                    aria-label="Report message"
                  >
                    <Flag className="w-3 h-3" />
                    Report
                  </button>
                )}
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Composer */}
      {!isReadOnly && (
        <div className="p-3 border-t bg-white">
          <div className="max-w-4xl mx-auto flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="min-h-[44px] max-h-32 py-3 px-4 rounded-2xl resize-none bg-gray-50 border border-gray-200 focus-visible:ring-1 focus-visible:ring-primary"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              {inputText.length > 1800 && (
                <div className="absolute right-3 bottom-1.5 text-[9px] text-muted-foreground">
                  {inputText.length}/2000
                </div>
              )}
            </div>
            <Button
              size="icon"
              className="rounded-full w-11 h-11 shrink-0 shadow-sm"
              disabled={!inputText.trim() || sendMutation.isPending}
              onClick={handleSend}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Report Message Dialog */}
      <Dialog
        open={!!reportingMessage}
        onOpenChange={(open) => {
          if (!open) { setReportingMessage(null); setReportReason(""); setBlockUser(false); }
        }}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-destructive" />
              Report Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
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
                onCheckedChange={(checked) => setBlockUser(checked === true)}
              />
              <Label htmlFor="block-user" className="text-sm font-normal cursor-pointer">
                Also block this user from contacting me
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setReportingMessage(null); setReportReason(""); setBlockUser(false); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reportReason || reportMutation.isPending}
              onClick={() => {
                if (reportingMessage && reportReason) {
                  reportMutation.mutate({ messageId: reportingMessage.messageId, reason: reportReason, block: blockUser });
                }
              }}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
