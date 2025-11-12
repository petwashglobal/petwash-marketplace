import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Mail,
  MailOpen,
  Star,
  Trash2,
  Send,
  FileText,
  Shield,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Loader2,
  Archive,
  Reply
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserMessage {
  id: number;
  senderId: string;
  senderName: string;
  senderEmail: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  messageType: string;
  priority: string;
  isRead: boolean;
  readAt: string | null;
  isStarred: boolean;
  isArchived: boolean;
  messageHash: string;
  auditHash: string;
  createdAt: string;
  updatedAt: string;
}

export default function PersonalInbox() {
  const { toast } = useToast();
  const { user: firebaseUser } = useFirebaseAuth();
  const queryClient = useQueryClient();

  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');

  // Compose form state
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  // Fetch inbox messages
  const { data: inboxData, isLoading } = useQuery<{ messages: UserMessage[] }>({
    queryKey: ['/api/messages/inbox'],
    enabled: !!firebaseUser,
  });

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread/count'],
    enabled: !!firebaseUser,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread/count'] });
      toast({
        title: '✅ Message Sent',
        description: 'Your secure message has been delivered with cryptographic audit trail.',
      });
      setIsComposing(false);
      setRecipientEmail('');
      setRecipientName('');
      setSubject('');
      setBody('');
      setPriority('normal');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: error.message,
      });
    },
  });

  // Star/unstar mutation
  const toggleStarMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}/star`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
    },
  });

  // Delete mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread/count'] });
      setSelectedMessage(null);
      toast({
        title: 'Message Deleted',
        description: 'The message has been moved to trash.',
      });
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firebaseUser) {
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to send messages.',
      });
      return;
    }

    // Lookup recipient UID by email
    try {
      const recipientData = await apiRequest(`/api/messages/lookup-user?email=${encodeURIComponent(recipientEmail)}`, {
        method: 'GET',
      });
      
      sendMessageMutation.mutate({
        senderId: firebaseUser.uid,
        senderName: firebaseUser.displayName || firebaseUser.email || 'Unknown',
        senderEmail: firebaseUser.email || '',
        recipientId: recipientData.uid,
        recipientName: recipientData.displayName || recipientName,
        recipientEmail,
        subject,
        body,
        messageType: 'general',
        priority,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Recipient Not Found',
        description: 'Could not find a user with that email address.',
      });
    }
  };

  const filteredMessages = inboxData?.messages?.filter((msg) => {
    if (filter === 'unread') return !msg.isRead && msg.recipientId === firebaseUser?.uid;
    if (filter === 'starred') return msg.isStarred;
    return true;
  }) || [];

  const isMyMessage = (msg: UserMessage) => msg.senderId === firebaseUser?.uid;

  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-5xl md:text-6xl font-light text-black dark:text-white mb-2 tracking-tight">
                Personal Inbox
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Secure Internal Messaging • Cryptographic Audit Trail • GCS Backup
              </p>
            </div>
            <div className="flex items-center gap-4">
              {unreadData && unreadData.count > 0 && (
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {unreadData.count} Unread
                </Badge>
              )}
              <Dialog open={isComposing} onOpenChange={setIsComposing}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 h-12 px-6"
                    data-testid="button-compose-message"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Compose Message
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-light">New Secure Message</DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                      Send encrypted messages with cryptographic audit trail
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendMessage} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm uppercase tracking-wide">Recipient Name</Label>
                        <Input
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="John Doe"
                          className="mt-2 h-12"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-sm uppercase tracking-wide">Recipient Email</Label>
                        <Input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="john@petwash.co.il"
                          className="mt-2 h-12"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm uppercase tracking-wide">Subject</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Message subject..."
                        className="mt-2 h-12"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-sm uppercase tracking-wide">Priority</Label>
                      <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                        <SelectTrigger className="mt-2 h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm uppercase tracking-wide">Message</Label>
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your message..."
                        className="mt-2 min-h-[200px]"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Lock className="w-3 h-3" />
                      Messages are secured with SHA-256 hashing and blockchain-style audit trail
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsComposing(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={sendMessageMutation.isPending}
                        className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                      >
                        {sendMessageMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Secure Message
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Message List */}
            <div className="lg:col-span-1">
              <Card className="border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl">
                <CardHeader className="border-b border-gray-100 dark:border-gray-900">
                  <CardTitle className="text-lg font-light tracking-wide">Messages</CardTitle>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant={filter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('all')}
                      className={filter === 'all' ? 'bg-black dark:bg-white text-white dark:text-black' : ''}
                    >
                      All
                    </Button>
                    <Button
                      variant={filter === 'unread' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('unread')}
                      className={filter === 'unread' ? 'bg-black dark:bg-white text-white dark:text-black' : ''}
                    >
                      Unread
                    </Button>
                    <Button
                      variant={filter === 'starred' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('starred')}
                      className={filter === 'starred' ? 'bg-black dark:bg-white text-white dark:text-black' : ''}
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                  </div>
                </CardHeader>
                <ScrollArea className="h-[600px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="text-center p-12">
                      <Mail className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No messages</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      {filteredMessages.map((msg) => (
                        <button
                          key={msg.id}
                          onClick={() => setSelectedMessage(msg)}
                          className={`w-full text-left p-4 rounded-lg border transition-all ${
                            selectedMessage?.id === msg.id
                              ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-900'
                              : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
                          }`}
                          data-testid={`message-item-${msg.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {!msg.isRead && msg.recipientId === firebaseUser?.uid && (
                                <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                              )}
                              {isMyMessage(msg) ? (
                                <MailOpen className="w-4 h-4 text-gray-400" />
                              ) : (
                                <Mail className="w-4 h-4 text-gray-400" />
                              )}
                              <span className={`text-sm ${msg.isRead || isMyMessage(msg) ? 'font-normal' : 'font-semibold'}`}>
                                {isMyMessage(msg) ? `To: ${msg.recipientName}` : msg.senderName}
                              </span>
                            </div>
                            {msg.isStarred && <Star className="w-4 h-4 fill-black dark:fill-white text-black dark:text-white" />}
                          </div>
                          <p className="text-sm font-medium text-black dark:text-white mb-1 line-clamp-1">
                            {msg.subject}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                            {msg.body}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </span>
                            {msg.priority !== 'normal' && (
                              <Badge variant="outline" className="text-xs">
                                {msg.priority}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </Card>
            </div>

            {/* Message Detail */}
            <div className="lg:col-span-2">
              {selectedMessage ? (
                <Card className="border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl">
                  <CardHeader className="border-b border-gray-100 dark:border-gray-900">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedMessage.priority !== 'normal' && (
                            <Badge variant="outline" className="text-xs">
                              {selectedMessage.priority}
                            </Badge>
                          )}
                          {selectedMessage.messageType !== 'general' && (
                            <Badge variant="outline" className="text-xs">
                              {selectedMessage.messageType}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-2xl font-light mb-2">{selectedMessage.subject}</CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p className="mb-1">
                            <strong>From:</strong> {selectedMessage.senderName} ({selectedMessage.senderEmail})
                          </p>
                          <p className="mb-1">
                            <strong>To:</strong> {selectedMessage.recipientName} ({selectedMessage.recipientEmail})
                          </p>
                          <p>
                            <strong>Sent:</strong> {new Date(selectedMessage.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStarMutation.mutate(selectedMessage.id)}
                        >
                          <Star 
                            className={`w-4 h-4 ${selectedMessage.isStarred ? 'fill-black dark:fill-white' : ''}`}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMessageMutation.mutate(selectedMessage.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="prose dark:prose-invert max-w-none mb-8">
                      <p className="whitespace-pre-wrap text-base leading-relaxed">{selectedMessage.body}</p>
                    </div>

                    {/* Security Information */}
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                      <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                        Security & Audit Information
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="flex items-start gap-2">
                          <Shield className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Message Hash</p>
                            <p className="text-gray-500 dark:text-gray-400 font-mono break-all">
                              {selectedMessage.messageHash?.substring(0, 32)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Lock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Audit Signature</p>
                            <p className="text-gray-500 dark:text-gray-400 font-mono break-all">
                              {selectedMessage.auditHash?.substring(0, 32)}...
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl h-[700px] flex items-center justify-center">
                  <div className="text-center p-12">
                    <Sparkles className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                    <p className="text-xl font-light text-gray-500 dark:text-gray-400 mb-2">
                      Select a message to view
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Your secure messages with cryptographic audit trail
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
