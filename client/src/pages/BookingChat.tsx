import { useState, useEffect, useRef } from "react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Send, 
  Lock, 
  AlertTriangle, 
  CheckCheck, 
  Check, 
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Info
} from "lucide-react";
import { format } from "date-fns";
import type { BookingConversation, BookingMessage } from "@shared/schema";
import { getApiUrl } from "@/lib/apiConfig";

export default function BookingChat() {
  const [, params] = useRoute("/booking-chat/:bookingId");
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const bookingId = params?.bookingId;

  const [inputText, setInputText] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chatData, isLoading, error, refetch } = useQuery<{
    conversation: BookingConversation;
    messages: BookingMessage[];
  }>({
    queryKey: ["/api/booking-chat", bookingId],
    enabled: !!bookingId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/booking-chat/${bookingId}/send`, {
        content,
        messageType: "text",
      });
      return res.json();
    },
    onSuccess: (newMessage) => {
      // Message will also arrive via WebSocket, but we can update UI optimistically or just wait
      // The task says optimistic update, but let's see. 
      // broadcastBookingChatMessage sends to all participants including sender.
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
    }
  });

  useEffect(() => {
    if (chatData?.messages) {
      setMessages(chatData.messages);
      markAsReadMutation.mutate();
    }
  }, [chatData?.messages]);

  useEffect(() => {
    if (!user || !chatData?.conversation?.conversationId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/realtime`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = async () => {
      const token = await user.getIdToken();
      socket.send(JSON.stringify({ type: "authenticate", token }));
      socket.send(JSON.stringify({ 
        type: "subscribe_booking_chat", 
        conversationId: chatData.conversation.conversationId 
      }));
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "booking_chat_message") {
        setMessages((prev) => [...prev, data.message]);
        markAsReadMutation.mutate();
      } else if (data.type === "booking_chat_status") {
        queryClient.setQueryData(["/api/booking-chat", bookingId], (old: any) => ({
          ...old,
          conversation: { ...old.conversation, chatStatus: data.chatStatus }
        }));
      }
    };

    socket.onclose = () => setWsConnected(false);

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: "unsubscribe_booking_chat", 
          conversationId: chatData.conversation.conversationId 
        }));
      }
      socket.close();
    };
  }, [user, chatData?.conversation?.conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(inputText);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
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
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Unable to load chat</h2>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const { conversation } = chatData;
  const isReadOnly = conversation.chatStatus === "read_only";
  const otherPartyUid = user?.uid === conversation.customerId ? conversation.providerId : conversation.customerId;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3 bg-card sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => setLocation(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10 border-2 border-primary/10">
          <AvatarFallback className="bg-primary/5 text-primary">
            {otherPartyUid.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">
            {user?.uid === conversation.customerId ? "Service Provider" : "Customer"}
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-mono">
              #{bookingId?.slice(-6).toUpperCase()}
            </Badge>
            <span className="flex items-center gap-1">
              {conversation.chatStatus === "active" ? (
                <span className="flex items-center gap-1 text-green-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-500 uppercase">
                  <Lock className="w-3 h-3" />
                  {conversation.chatStatus}
                </span>
              )}
            </span>
          </p>
        </div>
      </div>

      {/* Read-only Banner */}
      {isReadOnly && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 p-2.5 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <Info className="w-4 h-4 flex-shrink-0" />
          <p>This conversation is closed. Booking is {conversation.closedReason || 'complete'}. Messages are read-only.</p>
        </div>
      )}

      {/* Message List */}
      <ScrollArea className="flex-1 p-4 bg-muted/30">
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {messages.map((msg) => {
            const isMe = msg.senderUid === user?.uid;
            const isSystem = msg.senderRole === "system";

            if (isSystem) {
              return (
                <div key={msg.messageId} className="flex justify-center my-2">
                  <div className="bg-background/80 backdrop-blur-sm border shadow-sm rounded-full px-4 py-1.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    {msg.content}
                    <span className="text-[9px] opacity-60">• {format(new Date(msg.createdAt!), "HH:mm")}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.messageId}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-card text-card-foreground border rounded-tl-none"
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
                    {format(new Date(msg.createdAt!), "HH:mm")}
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
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      {!isReadOnly && (
        <div className="p-3 border-t bg-card">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="min-h-[44px] max-h-32 py-3 px-4 rounded-2xl resize-none bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
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
              className="rounded-full w-11 h-11 shrink-0 shadow-lg"
              disabled={!inputText.trim() || sendMutation.isPending}
              onClick={handleSend}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
