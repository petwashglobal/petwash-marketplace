import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { t } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Send, 
  Paperclip, 
  Users, 
  Search, 
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  Pin,
  PinOff,
  Camera,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MessageContent } from '@/components/messaging/MessageContent';
import { MentionInput } from '@/components/messaging/MentionInput';

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  title?: string;
  createdBy: string;
  createdAt: Date;
  lastMessageAt: Date;
  lastMessagePreview?: string;
  unreadCount: Record<string, number>;
  pinnedMessageId?: string | null;
  pinnedBy?: string | null;
  pinnedAt?: Date | null;
}

interface TeamMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    gcsUrl: string;
    uploadedAt: Date;
  }>;
  createdAt: Date;
  readBy: Array<{ uid: string; readAt: Date }>;
}

export default function TeamInbox() {
  const { language, dir } = useLanguage();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const firebaseUser = auth.currentUser;
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchText, setMessageSearchText] = useState('');
  const [searchPriority, setSearchPriority] = useState<'all' | 'low' | 'normal' | 'high' | 'urgent'>('all');
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [showSavedReplies, setShowSavedReplies] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Saved/canned replies for common responses
  const savedReplies = [
    { id: '1', text: t('teaminbox.quickReply1', language), category: 'status' },
    { id: '2', text: t('teaminbox.quickReply2', language), category: 'status' },
    { id: '3', text: t('teaminbox.quickReply3', language), category: 'maintenance' },
    { id: '4', text: t('teaminbox.quickReply4', language), category: 'maintenance' },
    { id: '5', text: t('teaminbox.quickReply5', language), category: 'escalation' },
    { id: '6', text: t('teaminbox.quickReply6', language), category: 'inventory' },
  ];

  // Fetch conversations
  const { data: conversationsData } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ['/api/messaging/conversations'],
    enabled: !!firebaseUser,
    queryFn: async () => {
      if (!firebaseUser) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/messaging/conversations', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const conversations: Conversation[] = conversationsData?.conversations || [];

  // Fetch messages for selected conversation
  const { data: messagesData } = useQuery<{ messages: TeamMessage[] }>({
    queryKey: ['/api/messaging/conversations', selectedConversationId, 'messages'],
    enabled: !!selectedConversationId && !!firebaseUser,
    queryFn: async () => {
      if (!firebaseUser || !selectedConversationId) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/messaging/conversations/${selectedConversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const allMessages: TeamMessage[] = messagesData?.messages || [];
  
  // Filter messages based on search criteria
  const messages = allMessages.filter(msg => {
    // Text search (content, station ID, workorder ID)
    if (messageSearchText.trim()) {
      const searchLower = messageSearchText.toLowerCase();
      const contentMatch = msg.content.toLowerCase().includes(searchLower);
      const stationMatch = /station:\/\/([A-Za-z0-9-]+)/gi.test(msg.content) && msg.content.toLowerCase().includes(searchLower);
      const workorderMatch = /workorder:\/\/([A-Za-z0-9-]+)/gi.test(msg.content) && msg.content.toLowerCase().includes(searchLower);
      if (!contentMatch && !stationMatch && !workorderMatch) return false;
    }
    
    // Priority filter
    if (searchPriority !== 'all' && msg.priority !== searchPriority) {
      return false;
    }
    
    return true;
  });

  // Stable WebSocket connection (single persistent connection)
  useEffect(() => {
    if (!firebaseUser) return;

    let reconnectTimeout: NodeJS.Timeout;
    let isIntentionalClose = false;

    const connectWebSocket = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const ws = new WebSocket(`${protocol}//${host}/realtime`);

        ws.onopen = () => {
          console.log('[TeamInbox] WebSocket connected');
          // Authenticate for messaging
          ws.send(JSON.stringify({
            type: 'auth_messaging',
            payload: { firebaseToken: token }
          }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'messaging_auth_success') {
            console.log('[TeamInbox] Authenticated for messaging');
            // Subscribe to all current conversations
            const conversationIds = conversationsData?.conversations?.map((c: Conversation) => c.id) || [];
            if (conversationIds.length > 0) {
              ws.send(JSON.stringify({
                type: 'subscribe_conversations',
                payload: { conversationIds }
              }));
            }
          } else if (data.type === 'new_message') {
            // Refresh conversations and messages
            queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
            if (data.conversationId === selectedConversationId) {
              queryClient.invalidateQueries({ 
                queryKey: ['/api/messaging/conversations', selectedConversationId, 'messages'] 
              });
            }
          } else if (data.type === 'conversation_update') {
            queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
          }
        };

        ws.onerror = (error) => {
          console.error('[TeamInbox] WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('[TeamInbox] WebSocket closed');
          if (!isIntentionalClose) {
            console.log('[TeamInbox] Reconnecting in 5s...');
            reconnectTimeout = setTimeout(connectWebSocket, 5000);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[TeamInbox] Failed to connect WebSocket:', error);
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      isIntentionalClose = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [firebaseUser?.uid]); // Only reconnect when user changes

  // Update WebSocket subscriptions when conversations change
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const conversationIds = conversations.map(c => c.id);
    if (conversationIds.length > 0) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_conversations',
        payload: { conversationIds }
      }));
    }
  }, [conversations.map(c => c.id).join(',')]);

  // Mark conversation as read when viewing
  useEffect(() => {
    if (!selectedConversationId || !firebaseUser || messages.length === 0) return;

    const markAsRead = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        await fetch(`/api/messaging/conversations/${selectedConversationId}/read-all`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        // Refresh conversations to update unread counts
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
      } catch (error) {
        console.error('[TeamInbox] Failed to mark as read:', error);
      }
    };

    // Mark as read after a short delay to avoid spamming
    const timeoutId = setTimeout(markAsRead, 1000);
    return () => clearTimeout(timeoutId);
  }, [selectedConversationId, firebaseUser, messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId) throw new Error('No conversation selected');
      
      const formData = new FormData();
      formData.append('content', messageText);
      formData.append('priority', priority);
      
      attachedFiles.forEach(file => {
        formData.append('attachments', file);
      });

      // Use fetch directly for FormData instead of apiRequest
      if (!firebaseUser) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/messaging/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: () => {
      setMessageText('');
      setPriority('normal');
      setAttachedFiles([]);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/messaging/conversations', selectedConversationId, 'messages'] 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
    },
    onError: () => {
      toast({
        title: t('teaminbox.error', language),
        description: t('teaminbox.failedToSend', language),
        variant: 'destructive',
      });
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/messaging/conversations/${selectedConversationId}/pin-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId }),
      });
      if (!response.ok) throw new Error('Failed to pin message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
      toast({
        title: t('teaminbox.success', language),
        description: t('teaminbox.messagePinned', language),
      });
    },
    onError: () => {
      toast({
        title: t('teaminbox.error', language),
        description: t('teaminbox.failedToPin', language),
        variant: 'destructive',
      });
    },
  });

  const unpinMessageMutation = useMutation({
    mutationFn: async () => {
      if (!firebaseUser) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/messaging/conversations/${selectedConversationId}/unpin-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to unpin message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
      toast({
        title: t('teaminbox.success', language),
        description: t('teaminbox.messageUnpinned', language),
      });
    },
    onError: () => {
      toast({
        title: t('teaminbox.error', language),
        description: t('teaminbox.failedToUnpin', language),
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (messageText.trim().length === 0 && attachedFiles.length === 0) return;
    sendMessageMutation.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (mimeType.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const myUnreadCount = selectedConversation?.unreadCount?.[firebaseUser?.uid || ''] || 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col" dir={dir}>
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('teaminbox.title', language)}
        </h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                data-testid="input-conversation-search"
                placeholder={t('teaminbox.searchConversations', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('teaminbox.noConversations', language)}</p>
              </div>
            ) : (
              conversations
                .filter(conv => 
                  searchQuery === '' || 
                  conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  conv.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((conv) => {
                  const unread = conv.unreadCount?.[firebaseUser?.uid || ''] || 0;
                  const isSelected = conv.id === selectedConversationId;

                  return (
                    <div
                      key={conv.id}
                      data-testid={`conversation-item-${conv.id}`}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Avatar className="mt-1">
                            <AvatarFallback className="bg-gray-200">
                              {conv.type === 'group' ? <Users className="w-4 h-4" /> : conv.title?.[0] || 'T'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-sm truncate">
                                {conv.title || `${t('teaminbox.conversation', language)} ${conv.id.substring(0, 8)}`}
                              </p>
                              {unread > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {unread}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {conv.lastMessagePreview || t('teaminbox.noMessages', language)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </ScrollArea>
        </div>

        {/* Messages View */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedConversationId ? (
            <>
              {/* Messages Header */}
              <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-lg">
                      {selectedConversation?.title || t('teaminbox.conversation', language)}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedConversation?.participants.length || 0} {t('teaminbox.participants', language)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSearchFilters(!showSearchFilters)}
                    data-testid="button-toggle-search"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                
                {showSearchFilters && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder={t('teaminbox.searchMessages', language)}
                      value={messageSearchText}
                      onChange={(e) => setMessageSearchText(e.target.value)}
                      data-testid="input-message-search"
                      className="flex-1"
                    />
                    <Select value={searchPriority} onValueChange={(v: any) => setSearchPriority(v)}>
                      <SelectTrigger className="w-32" data-testid="select-search-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('teaminbox.all', language)}</SelectItem>
                        <SelectItem value="low">{t('teaminbox.low', language)}</SelectItem>
                        <SelectItem value="normal">{t('teaminbox.normal', language)}</SelectItem>
                        <SelectItem value="high">{t('teaminbox.high', language)}</SelectItem>
                        <SelectItem value="urgent">{t('teaminbox.urgent', language)}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMessageSearchText('');
                        setSearchPriority('all');
                      }}
                      data-testid="button-clear-search"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Messages List */}
              <ScrollArea className="flex-1 p-6">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-12">
                    <Send className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>{t('teaminbox.noMessagesYet', language)}</p>
                    <p className="text-sm mt-2">{t('teaminbox.startNewConversation', language)}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pinned Message Banner */}
                    {selectedConversation?.pinnedMessageId && (
                      (() => {
                        const pinnedMsg = messages.find(m => m.id === selectedConversation.pinnedMessageId);
                        if (!pinnedMsg) return null;
                        
                        return (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4" data-testid="pinned-message-banner">
                            <div className="flex items-start gap-3">
                              <Pin className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-xs font-semibold text-amber-800">
                                    {t('teaminbox.pinnedMessage', language)}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => unpinMessageMutation.mutate()}
                                    data-testid="button-unpin-message"
                                    className="h-6 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                                  >
                                    <PinOff className="w-3 h-3" />
                                  </Button>
                                </div>
                                <p className="text-xs text-amber-900 font-medium mb-1">{pinnedMsg.senderName}</p>
                                <MessageContent content={pinnedMsg.content} className="text-sm text-amber-900" />
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {messages.map((msg) => {
                      const isMyMessage = msg.senderId === firebaseUser?.uid;
                      
                      return (
                        <div
                          key={msg.id}
                          data-testid={`message-${msg.id}`}
                          className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${isMyMessage ? 'order-2' : 'order-1'}`}>
                            {!isMyMessage && (
                              <p className="text-xs font-semibold text-gray-600 mb-1 px-1">
                                {msg.senderName}
                              </p>
                            )}
                            <Card className={`${
                              isMyMessage 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-white text-gray-900'
                            } ${msg.id === selectedConversation?.pinnedMessageId ? 'ring-2 ring-amber-400' : ''}`}>
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex-1">
                                    {msg.priority !== 'normal' && (
                                      <Badge 
                                        variant={msg.priority === 'urgent' ? 'destructive' : 'secondary'}
                                        className="text-xs mb-2"
                                      >
                                        {msg.priority.toUpperCase()}
                                      </Badge>
                                    )}
                                  </div>
                                  {msg.id === selectedConversation?.pinnedMessageId ? (
                                    <Pin className="w-4 h-4 text-amber-400 flex-shrink-0" data-testid={`pinned-indicator-${msg.id}`} />
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => pinMessageMutation.mutate(msg.id)}
                                      data-testid={`button-pin-${msg.id}`}
                                      className={`h-6 w-6 p-0 flex-shrink-0 ${
                                        isMyMessage 
                                          ? 'text-blue-200 hover:text-white hover:bg-blue-600' 
                                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                      }`}
                                    >
                                      <Pin className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                                <MessageContent content={msg.content} className="text-sm" />
                                
                                {msg.attachments.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {msg.attachments.map((att) => (
                                      <a
                                        key={att.id}
                                        href={att.gcsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid={`attachment-${att.id}`}
                                        className={`flex items-center gap-2 p-2 rounded border ${
                                          isMyMessage 
                                            ? 'bg-blue-600 border-blue-400' 
                                            : 'bg-gray-50 border-gray-200'
                                        } hover:opacity-80 transition-opacity`}
                                      >
                                        {getFileIcon(att.mimeType)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{att.fileName}</p>
                                          <p className="text-xs opacity-70">{formatFileSize(att.fileSize)}</p>
                                        </div>
                                        <Download className="w-4 h-4" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                
                                <p className={`text-xs mt-2 ${isMyMessage ? 'text-blue-100' : 'text-gray-400'}`}>
                                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                            </Card>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Composer */}
              <div className="bg-white border-t p-4">
                {attachedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        data-testid={`attached-file-${index}`}
                        className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2"
                      >
                        {getFileIcon(file.type)}
                        <span className="text-sm truncate max-w-xs">{file.name}</span>
                        <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                        <button
                          onClick={() => removeFile(index)}
                          data-testid={`button-remove-file-${index}`}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger className="w-32" data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('teaminbox.low', language)}</SelectItem>
                      <SelectItem value="normal">{t('teaminbox.normal', language)}</SelectItem>
                      <SelectItem value="high">{t('teaminbox.high', language)}</SelectItem>
                      <SelectItem value="urgent">{t('teaminbox.urgent', language)}</SelectItem>
                    </SelectContent>
                  </Select>

                  <MentionInput
                    value={messageText}
                    onChange={setMessageText}
                    placeholder={t('teaminbox.typeMessage', language)}
                    className="flex-1 min-h-[60px] max-h-[200px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <div className="relative">
                    <Button
                      variant="outline"
                      size="icon"
                      data-testid="button-saved-replies"
                      onClick={() => setShowSavedReplies(!showSavedReplies)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    {showSavedReplies && (
                      <div className="absolute bottom-12 left-0 bg-white border rounded-lg shadow-lg p-2 w-72 z-10" data-testid="saved-replies-menu">
                        <p className="text-xs font-semibold text-gray-600 mb-2 px-2">
                          {t('teaminbox.savedReplies', language)}
                        </p>
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {savedReplies.map((reply) => (
                            <button
                              key={reply.id}
                              onClick={() => {
                                setMessageText(reply.text);
                                setShowSavedReplies(false);
                              }}
                              data-testid={`saved-reply-${reply.id}`}
                              className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 transition-colors"
                            >
                              {reply.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="button-attach-file"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="button-camera-capture"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>

                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || (messageText.trim().length === 0 && attachedFiles.length === 0)}
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {t('teaminbox.send', language)}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">{t('teaminbox.selectConversation', language)}</p>
                <p className="text-sm mt-2">{t('teaminbox.chooseConversation', language)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
