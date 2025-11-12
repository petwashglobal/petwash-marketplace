import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, MapPin, Paperclip } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: "text" | "image" | "location";
  imageUrl?: string;
  location?: { lat: number; lng: number };
  createdAt: Date;
  read: boolean;
}

interface Conversation {
  id: string;
  participantIds: string[];
  bookingId: string;
  lastMessage?: string;
  updatedAt: Date;
  unreadCount?: number;
}

interface ChatInterfaceProps {
  conversationId: string;
  currentUserId: string;
  otherParticipantName: string;
  otherParticipantPhoto?: string;
}

export function ChatInterface({
  conversationId,
  currentUserId,
  otherParticipantName,
  otherParticipantPhoto,
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data: messagesData } = useQuery({
    queryKey: [`/api/chat/conversations/${conversationId}/messages`],
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });

  const messages: Message[] = messagesData?.messages || [];

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (data: { text: string; type: string }) => {
      return apiRequest(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${conversationId}/messages`] });
    },
  });

  // Mark as read
  const markAsRead = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/chat/conversations/${conversationId}/read`, {
        method: "POST",
      });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      markAsRead.mutate();
    }
  }, [messages.length]);

  const handleSend = () => {
    if (messageText.trim()) {
      sendMessage.mutate({
        text: messageText.trim(),
        type: "text",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-[600px] shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)]">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        {otherParticipantPhoto ? (
          <img
            src={otherParticipantPhoto}
            alt={otherParticipantName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center text-lg">
            {otherParticipantName[0]}
          </div>
        )}
        <div>
          <h3 className="font-semibold">{otherParticipantName}</h3>
          <p className="text-sm text-gray-500">Active now</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                data-testid={`message-${message.id}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.type === "text" && (
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  )}
                  {message.type === "image" && message.imageUrl && (
                    <div>
                      <img
                        src={message.imageUrl}
                        alt="Shared image"
                        className="max-w-full rounded-lg mb-2"
                      />
                      {message.text && <p className="text-sm">{message.text}</p>}
                    </div>
                  )}
                  {message.type === "location" && message.location && (
                    <div>
                      <MapPin className="h-4 w-4 inline mr-2" />
                      <span className="text-sm">Shared location</span>
                    </div>
                  )}
                  <p
                    className={`text-xs mt-1 ${isOwn ? "text-amber-100" : "text-gray-500"}`}
                  >
                    {format(new Date(message.createdAt), "h:mm a")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-attach-image"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-attach-file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
            data-testid="button-send-message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Conversation List Component
interface ConversationListProps {
  currentUserId: string;
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId?: string;
}

export function ConversationList({
  currentUserId,
  onSelectConversation,
  selectedConversationId,
}: ConversationListProps) {
  const { data, isLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const conversations = data?.conversations || [];

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)]">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Messages</h2>
      </div>
      <div className="divide-y">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedConversationId === conv.id ? "bg-amber-50" : ""
              }`}
              data-testid={`conversation-${conv.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center text-lg font-semibold">
                  ?
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold">Conversation</h3>
                    {conv.updatedAt && (
                      <span className="text-xs text-gray-500">
                        {format(new Date(conv.updatedAt), "MMM d")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{conv.lastMessage || "No messages yet"}</p>
                  {conv.unreadCount && conv.unreadCount > 0 && (
                    <div className="mt-1">
                      <span className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-xs px-2 py-1 rounded-full">
                        {conv.unreadCount} new
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
