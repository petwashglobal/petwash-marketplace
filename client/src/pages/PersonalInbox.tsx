import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Shield,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Loader2,
  Archive,
  Reply,
  Inbox,
  ChevronRight,
  Search,
  Filter,
  Bell,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/lib/languageStore';
import { cn } from '@/lib/utils';

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
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  const { data: inboxData, isLoading } = useQuery<{ messages: UserMessage[] }>({
    queryKey: ['/api/messages/inbox'],
    enabled: !!firebaseUser,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread/count'],
    enabled: !!firebaseUser,
  });

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
        title: isHebrew ? 'ההודעה נשלחה בהצלחה' : 'Message Sent',
        description: isHebrew ? 'ההודעה המאובטחת נמסרה עם חתימה קריפטוגרפית' : 'Your secure message has been delivered with cryptographic audit trail.',
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
        title: isHebrew ? 'השליחה נכשלה' : 'Send Failed',
        description: error.message,
      });
    },
  });

  const toggleStarMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}/star`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread/count'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread/count'] });
      setSelectedMessage(null);
      toast({
        title: isHebrew ? 'ההודעה נמחקה' : 'Message Deleted',
        description: isHebrew ? 'ההודעה הועברה לפח' : 'The message has been moved to trash.',
      });
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: isHebrew ? 'נדרש אימות' : 'Authentication Required' });
      return;
    }
    try {
      const recipientData = await apiRequest(`/api/messages/lookup-user?email=${encodeURIComponent(recipientEmail)}`, { method: 'GET' });
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
      toast({ variant: 'destructive', title: isHebrew ? 'הנמען לא נמצא' : 'Recipient Not Found', description: isHebrew ? 'לא נמצא משתמש עם כתובת אימייל זו' : 'Could not find a user with that email address.' });
    }
  };

  const handleSelectMessage = (msg: UserMessage) => {
    setSelectedMessage(msg);
    if (!msg.isRead && msg.recipientId === firebaseUser?.uid) {
      markReadMutation.mutate(msg.id);
    }
  };

  const filteredMessages = (inboxData?.messages || []).filter((msg) => {
    if (filter === 'unread') return !msg.isRead && msg.recipientId === firebaseUser?.uid;
    if (filter === 'starred') return msg.isStarred;
    return true;
  }).filter((msg) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return msg.subject?.toLowerCase().includes(q) || msg.senderName?.toLowerCase().includes(q) || msg.body?.toLowerCase().includes(q);
  });

  const isMyMessage = (msg: UserMessage) => msg.senderId === firebaseUser?.uid;
  const unreadCount = unreadData?.count || 0;

  const priorityConfig: Record<string, { bg: string; text: string; label: { en: string; he: string } }> = {
    normal: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: { en: 'Normal', he: 'רגיל' } },
    high: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: { en: 'High', he: 'גבוה' } },
    urgent: { bg: 'bg-red-500/15', text: 'text-red-400', label: { en: 'Urgent', he: 'דחוף' } },
  };

  if (!firebaseUser) {
    return (
      <Layout>
        <div className="luxury-dark-mesh min-h-screen flex items-center justify-center px-4">
          <div className="text-center luxury-dark-card p-10 rounded-2xl max-w-md w-full">
            <Lock className="w-14 h-14 mx-auto mb-6 text-[#C9A96E]" />
            <h2 className="luxury-dark-heading-lg text-2xl mb-3">{isHebrew ? 'נדרשת כניסה' : 'Sign In Required'}</h2>
            <p className="luxury-dark-text-body">{isHebrew ? 'התחבר כדי לגשת לתיבת הדואר הפרטית שלך' : 'Sign in to access your private inbox'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="luxury-dark-mesh min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 luxury-animate-fade-in">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[rgba(201,169,110,0.3)] to-[rgba(201,169,110,0.1)] flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[#C9A96E]" />
                </div>
                <div>
                  <h1 className="luxury-dark-heading-xl text-2xl sm:text-3xl">
                    {isHebrew ? 'תיבת דואר פרטית' : 'Private Inbox'}
                  </h1>
                  <p className="luxury-dark-text-small text-xs flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    {isHebrew ? 'מוצפן ומאובטח | יומן ביקורת SHA-256' : 'Encrypted & Secure | SHA-256 Audit Trail'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <div className="luxury-dark-badge-gold flex items-center gap-1.5 px-3 py-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">{unreadCount} {isHebrew ? 'חדשות' : 'New'}</span>
                </div>
              )}
              <Dialog open={isComposing} onOpenChange={setIsComposing}>
                <DialogTrigger asChild>
                  <Button className="luxury-dark-btn-gold px-5 py-3 flex items-center gap-2" data-testid="button-compose-message">
                    <Plus className="w-4 h-4" />
                    {isHebrew ? 'הודעה חדשה' : 'Compose'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl !bg-[#12121a] !border-[rgba(232,230,240,0.1)] rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="luxury-dark-heading-lg text-xl flex items-center gap-2">
                      <Send className="w-5 h-5 text-[#C9A96E]" />
                      {isHebrew ? 'הודעה מאובטחת חדשה' : 'New Secure Message'}
                    </DialogTitle>
                    <DialogDescription className="luxury-dark-text-body">
                      {isHebrew ? 'הודעות מוצפנות עם חתימה קריפטוגרפית' : 'Messages encrypted with cryptographic audit trail'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendMessage} className="space-y-4 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                          {isHebrew ? 'שם הנמען' : 'Recipient Name'}
                        </label>
                        <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder={isHebrew ? 'שם מלא' : 'Full Name'} className="h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)]" required />
                      </div>
                      <div>
                        <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                          {isHebrew ? 'אימייל' : 'Email'}
                        </label>
                        <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="name@petwash.co.il" className="h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)]" required />
                      </div>
                    </div>
                    <div>
                      <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                        {isHebrew ? 'נושא' : 'Subject'}
                      </label>
                      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={isHebrew ? 'נושא ההודעה...' : 'Message subject...'} className="h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)]" required />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                          {isHebrew ? 'עדיפות' : 'Priority'}
                        </label>
                        <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                          <SelectTrigger className="h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a2e] border-[rgba(232,230,240,0.1)]">
                            <SelectItem value="normal">{isHebrew ? 'רגיל' : 'Normal'}</SelectItem>
                            <SelectItem value="high">{isHebrew ? 'גבוה' : 'High'}</SelectItem>
                            <SelectItem value="urgent">{isHebrew ? 'דחוף' : 'Urgent'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                        {isHebrew ? 'תוכן ההודעה' : 'Message'}
                      </label>
                      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={isHebrew ? 'כתוב את ההודעה שלך...' : 'Write your message...'} className="min-h-[160px] bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)]" required />
                    </div>
                    <div className="flex items-center gap-2 luxury-dark-text-small text-xs">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isHebrew ? 'מאובטח בהצפנת SHA-256 ויומן ביקורת' : 'Secured with SHA-256 hashing and audit trail'}</span>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button type="button" className="luxury-dark-btn-ghost px-5 py-3 border border-[rgba(232,230,240,0.1)]" onClick={() => setIsComposing(false)}>
                        {isHebrew ? 'ביטול' : 'Cancel'}
                      </Button>
                      <Button type="submit" disabled={sendMessageMutation.isPending} className="luxury-dark-btn-gold px-5 py-3 flex items-center gap-2">
                        {sendMessageMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {isHebrew ? 'שולח...' : 'Sending...'}</>
                        ) : (
                          <><Send className="w-4 h-4" /> {isHebrew ? 'שלח הודעה מאובטחת' : 'Send Secure Message'}</>
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="luxury-animate-fade-in luxury-delay-1 mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(149,144,168,0.5)]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isHebrew ? 'חפש הודעות...' : 'Search messages...'}
                  className="pl-10 h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)] rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'unread', 'starred'] as const).map((f) => (
                  <Button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                      filter === f
                        ? 'bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F]'
                        : 'luxury-dark-surface text-[rgba(232,230,240,0.6)] hover:text-white'
                    )}
                  >
                    {f === 'all' ? (isHebrew ? 'הכל' : 'All') :
                     f === 'unread' ? (isHebrew ? 'לא נקראו' : 'Unread') :
                     <Star className="w-4 h-4" />}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 luxury-animate-fade-in luxury-delay-2">

            <div className="lg:col-span-2">
              <div className="luxury-dark-card rounded-2xl overflow-hidden">
                <div className="h-0.5 bg-gradient-to-r from-transparent via-[#C9A96E]/30 to-transparent" />
                <ScrollArea className="h-[calc(100vh-320px)] sm:h-[700px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-16">
                      <Loader2 className="w-8 h-8 animate-spin text-[#C9A96E]" />
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="text-center p-16">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[rgba(201,169,110,0.2)] to-[rgba(201,169,110,0.05)] flex items-center justify-center">
                        <Inbox className="w-8 h-8 text-[rgba(149,144,168,0.4)]" />
                      </div>
                      <p className="luxury-dark-heading-sm text-base mb-2">
                        {isHebrew ? 'אין הודעות' : 'No Messages'}
                      </p>
                      <p className="luxury-dark-text-body text-sm">
                        {isHebrew ? 'תיבת הדואר שלך ריקה' : 'Your inbox is empty'}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-1">
                      {filteredMessages.map((msg) => {
                        const isSelected = selectedMessage?.id === msg.id;
                        const isUnread = !msg.isRead && msg.recipientId === firebaseUser?.uid;
                        const pc = priorityConfig[msg.priority] || priorityConfig.normal;

                        return (
                          <Button
                            key={msg.id}
                            onClick={() => handleSelectMessage(msg)}
                            className={cn(
                              'w-full text-left p-4 rounded-xl transition-all',
                              isSelected
                                ? 'bg-gradient-to-r from-[rgba(201,169,110,0.15)] to-[rgba(201,169,110,0.05)] border border-[#C9A96E]/30'
                                : 'hover:bg-[rgba(232,230,240,0.03)] border border-transparent',
                              isUnread && 'border-l-2 border-l-[#C9A96E]'
                            )}
                            data-testid={`message-item-${msg.id}`}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                {isUnread && <div className="w-2 h-2 rounded-full bg-[#C9A96E] flex-shrink-0" />}
                                <span className={cn('text-sm truncate', isUnread ? 'text-white font-semibold' : 'text-[rgba(232,230,240,0.7)]')}>
                                  {isMyMessage(msg) ? `${isHebrew ? 'אל' : 'To'}: ${msg.recipientName}` : msg.senderName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {msg.priority !== 'normal' && (
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded', pc.bg, pc.text)}>
                                    {isHebrew ? pc.label.he : pc.label.en}
                                  </span>
                                )}
                                {msg.isStarred && <Star className="w-3.5 h-3.5 fill-[#C9A96E] text-[#C9A96E]" />}
                              </div>
                            </div>
                            <p className={cn('text-sm mb-1 line-clamp-1', isUnread ? 'text-white font-medium' : 'text-[rgba(232,230,240,0.6)]')}>
                              {msg.subject}
                            </p>
                            <p className="text-xs text-[rgba(149,144,168,0.5)] line-clamp-1 mb-2">
                              {msg.body}
                            </p>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-[rgba(149,144,168,0.4)]" />
                              <span className="text-[11px] text-[rgba(149,144,168,0.4)]">
                                {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                              </span>
                              {isMyMessage(msg) && (
                                <span className="text-[10px] text-[rgba(149,144,168,0.3)] flex items-center gap-1">
                                  <MailOpen className="w-3 h-3" /> {isHebrew ? 'נשלח' : 'Sent'}
                                </span>
                              )}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="lg:col-span-3">
              {selectedMessage ? (
                <div className="luxury-dark-card rounded-2xl overflow-hidden">
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-[#C9A96E]/30 to-transparent" />

                  <div className="p-6 border-b border-[rgba(232,230,240,0.06)]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          {selectedMessage.priority !== 'normal' && (() => {
                            const pc = priorityConfig[selectedMessage.priority] || priorityConfig.normal;
                            return (
                              <span className={cn('text-xs px-2 py-1 rounded-lg', pc.bg, pc.text)}>
                                {isHebrew ? pc.label.he : pc.label.en}
                              </span>
                            );
                          })()}
                          {selectedMessage.messageType !== 'general' && (
                            <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400">
                              {selectedMessage.messageType}
                            </span>
                          )}
                        </div>
                        <h2 className="luxury-dark-heading-lg text-xl mb-3">{selectedMessage.subject}</h2>
                        <div className="space-y-1.5 luxury-dark-text-body text-sm">
                          <p><span className="text-[rgba(149,144,168,0.6)]">{isHebrew ? 'מ:' : 'From:'}</span> <span className="text-white">{selectedMessage.senderName}</span> <span className="text-[rgba(149,144,168,0.4)]">({selectedMessage.senderEmail})</span></p>
                          <p><span className="text-[rgba(149,144,168,0.6)]">{isHebrew ? 'אל:' : 'To:'}</span> <span className="text-white">{selectedMessage.recipientName}</span> <span className="text-[rgba(149,144,168,0.4)]">({selectedMessage.recipientEmail})</span></p>
                          <p><span className="text-[rgba(149,144,168,0.6)]">{isHebrew ? 'נשלח:' : 'Sent:'}</span> <span className="text-[rgba(232,230,240,0.7)]">{new Date(selectedMessage.createdAt).toLocaleString(isHebrew ? 'he-IL' : 'en-US')}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => toggleStarMutation.mutate(selectedMessage.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[rgba(232,230,240,0.05)] transition-colors"
                        >
                          <Star className={cn('w-4 h-4', selectedMessage.isStarred ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-[rgba(149,144,168,0.5)]')} />
                        </Button>
                        <Button
                          onClick={() => deleteMessageMutation.mutate(selectedMessage.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-red-500/10 transition-colors text-[rgba(149,144,168,0.5)] hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="prose-sm max-w-none mb-8">
                      <p className="whitespace-pre-wrap text-[rgba(232,230,240,0.8)] text-base leading-relaxed">{selectedMessage.body}</p>
                    </div>

                    <div className="luxury-dark-surface rounded-xl p-5 space-y-3">
                      <p className="luxury-dark-text-small text-[10px] uppercase tracking-widest text-[#C9A96E] mb-3 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        {isHebrew ? 'מידע אבטחה וביקורת' : 'Security & Audit Information'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-2">
                          <Shield className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-white">{isHebrew ? 'חתימת הודעה' : 'Message Hash'}</p>
                            <p className="text-[11px] text-[rgba(149,144,168,0.5)] font-mono break-all">{selectedMessage.messageHash?.substring(0, 32)}...</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Lock className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-white">{isHebrew ? 'חתימת ביקורת' : 'Audit Signature'}</p>
                            <p className="text-[11px] text-[rgba(149,144,168,0.5)] font-mono break-all">{selectedMessage.auditHash?.substring(0, 32)}...</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="luxury-dark-card rounded-2xl h-[calc(100vh-320px)] sm:h-[700px] flex items-center justify-center">
                  <div className="text-center p-12">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[rgba(201,169,110,0.15)] to-[rgba(201,169,110,0.05)] flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-[rgba(149,144,168,0.3)]" />
                    </div>
                    <h3 className="luxury-dark-heading-sm text-lg mb-2">
                      {isHebrew ? 'בחר הודעה לצפייה' : 'Select a Message'}
                    </h3>
                    <p className="luxury-dark-text-body text-sm max-w-xs mx-auto">
                      {isHebrew ? 'הודעות מאובטחות עם חתימה קריפטוגרפית ויומן ביקורת' : 'Your secure messages with cryptographic audit trail'}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="mt-6 luxury-dark-surface rounded-xl p-4 flex items-center justify-center gap-6 luxury-animate-fade-in luxury-delay-3">
            <div className="flex items-center gap-2 text-xs text-[rgba(149,144,168,0.5)]">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isHebrew ? 'חוק הפרטיות הישראלי 2025' : 'Israeli Privacy Law 2025'}</span>
            </div>
            <div className="w-px h-4 bg-[rgba(232,230,240,0.1)]" />
            <div className="flex items-center gap-2 text-xs text-[rgba(149,144,168,0.5)]">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>{isHebrew ? 'הצפנה מקצה לקצה' : 'End-to-End Encryption'}</span>
            </div>
            <div className="w-px h-4 bg-[rgba(232,230,240,0.1)]" />
            <div className="flex items-center gap-2 text-xs text-[rgba(149,144,168,0.5)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A96E]" />
              <span>SHA-256</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}