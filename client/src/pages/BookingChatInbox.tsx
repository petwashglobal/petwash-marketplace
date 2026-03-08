import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/lib/languageStore";
import { Link } from "wouter";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { BookingConversation } from "@shared/schema";
import { MessageSquare, Lock, Circle } from "lucide-react";

export default function BookingChatInbox() {
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();

  const { data: conversations, isLoading } = useQuery<BookingConversation[]>({
    queryKey: ["/api/booking-chat/inbox"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 flex gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-2xl text-center py-20">
        <div className="mb-4 flex justify-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground opacity-20" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No active chats</h2>
        <p className="text-muted-foreground">
          Your booking conversations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      <div className="space-y-3">
        {conversations.map((conv) => {
          const otherPartyUid = user?.uid === conv.customerId ? conv.providerId : conv.customerId;
          const unreadCount = user?.uid === conv.customerId ? conv.customerUnread : conv.providerUnread;
          const isActive = conv.chatStatus === "active";

          return (
            <Link key={conv.conversationId} href={`/booking-chat/${conv.bookingId}`}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-l-4 border-l-transparent data-[unread=true]:border-l-primary" data-unread={unreadCount > 0}>
                <CardContent className="p-4 flex items-start gap-4">
                  <Avatar className="w-12 h-12 border">
                    <AvatarFallback className="bg-primary/5 text-primary">
                      {otherPartyUid.substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">
                          {user?.uid === conv.customerId ? "Service Provider" : "Customer"}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 py-0 font-mono">
                          {conv.platform.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {conv.lastMessageAt && formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {conv.lastMessagePreview || "No messages yet"}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={isActive ? "success" : "secondary"} className="text-[10px] h-4 py-0 px-1.5 flex items-center gap-1">
                          {isActive ? (
                            <>
                              <Circle className="w-2 h-2 fill-current" />
                              Active
                            </>
                          ) : (
                            <>
                              <Lock className="w-2 h-2" />
                              Closed
                            </>
                          )}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Ref: #{conv.bookingId.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      {unreadCount > 0 && (
                        <div className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
