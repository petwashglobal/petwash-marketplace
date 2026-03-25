import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Card, 
  CardContent, 
  CardHeader 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  AlertTriangle, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck,
  Info
} from "lucide-react";
import { format } from "date-fns";
import type { BookingConversation, BookingMessage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function AdminBookingChat() {
  const [, params] = useRoute("/admin/booking-chat/:bookingId");
  const [, setLocation] = useLocation();
  const { claims, loading: authLoading } = useFirebaseAuth();
  const { toast } = useToast();
  const bookingId = params?.bookingId;

  const { data: chatData, isLoading, error } = useQuery<{
    conversation: BookingConversation;
    messages: BookingMessage[];
  }>({
    queryKey: ["/api/booking-chat/admin", bookingId],
    enabled: !!bookingId && claims?.role === 'admin',
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ messageId, action }: { messageId: string, action: 'delete' | 'clear_flag' }) => {
      await apiRequest("POST", `/api/booking-chat/admin/messages/${messageId}/moderate`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-chat/admin", bookingId] });
      toast({ title: "Success", description: "Message moderated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to moderate message", variant: "destructive" });
    }
  });

  if (authLoading || isLoading) {
    return <div className="p-8 text-center"><Skeleton className="h-20 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (claims?.role !== 'admin') {
    setLocation("/signin");
    return null;
  }

  if (error || !chatData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Unable to load conversation</h2>
        <Button onClick={() => setLocation("/admin")}>Back to Dashboard</Button>
      </div>
    );
  }

  const { conversation, messages } = chatData;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* Header */}
      <div className="p-4 border-b bg-card shadow-sm z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Booking Chat Moderation</h2>
                <Badge variant="outline" className="font-mono">#{bookingId}</Badge>
              </div>
              <p className="text-xs text-muted-foreground flex gap-3 mt-1">
                <span>Platform: <b className="text-foreground">{conversation.platform}</b></span>
                <span>Customer: <code className="bg-muted px-1 rounded">{conversation.customerId}</code></span>
                <span>Provider: <code className="bg-muted px-1 rounded">{conversation.providerId}</code></span>
              </p>
            </div>
          </div>
          <Badge variant={conversation.chatStatus === 'active' ? 'success' : 'secondary'} className="uppercase">
            {conversation.chatStatus}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-4 pb-12">
          {messages.map((msg) => {
            const isSystem = msg.senderRole === "system";
            const isModerated = msg.isDeleted || msg.moderatedBy;

            if (isSystem) {
              return (
                <div key={msg.messageId} className="flex justify-center">
                  <Badge variant="secondary" className="font-normal px-4 py-1 text-[11px] gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {msg.systemEventType?.toUpperCase()}: {msg.content}
                    <span className="opacity-50">• {format(new Date(msg.createdAt!), "MMM d, HH:mm")}</span>
                  </Badge>
                </div>
              );
            }

            return (
              <div 
                key={msg.messageId} 
                className={`group relative flex flex-col ${msg.senderRole === 'customer' ? 'items-start' : 'items-end'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {msg.senderRole}
                  </span>
                  <span className="text-[10px] text-muted-foreground opacity-60">
                    {format(new Date(msg.createdAt!), "HH:mm")}
                  </span>
                </div>

                <div className={`
                  max-w-[80%] rounded-lg px-4 py-2 border shadow-sm relative transition-all
                  ${msg.isFlagged ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' : 'bg-card'}
                  ${msg.isDeleted ? 'opacity-60 border-dashed' : ''}
                `}>
                  {msg.isDeleted ? (
                    <p className="italic text-sm text-muted-foreground flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />
                      [Message removed by admin]
                    </p>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {msg.isFlagged && !msg.isDeleted && (
                    <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between text-[10px] text-amber-700 font-medium">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Flagged: {msg.flaggedReason}
                      </span>
                    </div>
                  )}
                  
                  {/* Moderation Panel */}
                  <div className="absolute top-2 -right-12 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!msg.isDeleted && (
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        className="h-8 w-8" 
                        title="Delete Message"
                        onClick={() => moderateMutation.mutate({ messageId: msg.messageId, action: 'delete' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {msg.isFlagged && (
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 bg-green-100 hover:bg-green-200 text-green-700" 
                        title="Clear Flag"
                        onClick={() => moderateMutation.mutate({ messageId: msg.messageId, action: 'clear_flag' })}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Legend Footer */}
      <div className="p-3 bg-muted border-t text-[10px] text-muted-foreground flex justify-center gap-6">
        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-amber-100 border border-amber-300" /> Flagged Content</span>
        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-card border border-dashed" /> Deleted Message</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> System Event</span>
      </div>
    </div>
  );
}
