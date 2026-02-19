import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { t } from '@/lib/i18n';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Inbox, 
  Send, 
  Archive, 
  Trash2, 
  Mail, 
  Clock, 
  AlertCircle,
  Search,
  Filter,
  X,
  Paperclip,
  MoreVertical,
  Star,
  Reply,
  Check,
  CheckCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: number;
  sender: string;
  senderAvatar?: string;
  subject: string;
  preview: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  isImportant: boolean;
  priority: 'normal' | 'high' | 'urgent';
  attachments?: { name: string; size: string }[];
  category: string;
}

const mockMessages: Message[] = [
  {
    id: 1,
    sender: 'System Admin',
    senderAvatar: '',
    subject: 'Monthly Performance Report Ready',
    preview: 'The monthly performance report for November has been generated and is ready for review...',
    body: 'The monthly performance report for November has been generated and is ready for review. Key highlights include a 23% increase in customer engagement and 18% revenue growth.',
    timestamp: '10 minutes ago',
    isRead: false,
    isImportant: true,
    priority: 'urgent',
    attachments: [
      { name: 'november-report.pdf', size: '2.4 MB' },
      { name: 'analytics-summary.xlsx', size: '1.1 MB' }
    ],
    category: 'Reports'
  },
  {
    id: 2,
    sender: 'Franchise Operations',
    subject: 'New Franchise Application - Tel Aviv',
    preview: 'A new franchise application has been submitted for the Tel Aviv region...',
    body: 'A new franchise application has been submitted for the Tel Aviv region. The applicant has completed all required documentation and passed initial screening.',
    timestamp: '2 hours ago',
    isRead: false,
    isImportant: true,
    priority: 'high',
    category: 'Applications'
  },
  {
    id: 3,
    sender: 'Customer Support',
    subject: 'Weekly Support Ticket Summary',
    preview: 'This week we processed 234 support tickets with an average response time of 2.3 hours...',
    body: 'This week we processed 234 support tickets with an average response time of 2.3 hours. Customer satisfaction rating: 4.8/5.0.',
    timestamp: '5 hours ago',
    isRead: true,
    isImportant: false,
    priority: 'normal',
    category: 'Support'
  },
  {
    id: 4,
    sender: 'Marketing Team',
    subject: 'Q4 Campaign Results',
    preview: 'The Q4 marketing campaign exceeded expectations with a 31% conversion rate...',
    body: 'The Q4 marketing campaign exceeded expectations with a 31% conversion rate and 45,000 new customer acquisitions.',
    timestamp: 'Yesterday',
    isRead: true,
    isImportant: false,
    priority: 'normal',
    category: 'Marketing'
  },
  {
    id: 5,
    sender: 'Finance Department',
    subject: 'Budget Approval Required',
    preview: 'The proposed Q1 2026 budget requires your approval before we can proceed...',
    body: 'The proposed Q1 2026 budget requires your approval before we can proceed with procurement and hiring plans.',
    timestamp: '2 days ago',
    isRead: false,
    isImportant: true,
    priority: 'high',
    category: 'Finance'
  }
];

export default function AdminInbox() {
  const { language, dir } = useLanguage();
  const { toast } = useToast();
  
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(mockMessages[0]);
  const [selectedMessages, setSelectedMessages] = useState<number[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'important' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [targetType, setTargetType] = useState<'users' | 'franchises'>('users');
  const [messageData, setMessageData] = useState({
    title: '',
    bodyHtml: '',
    type: 'system',
    locale: 'en',
    segmentType: 'all',
    category: 'announcement',
  });

  const broadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = targetType === 'users' 
        ? '/api/admin/broadcast/users'
        : '/api/admin/broadcast/franchises';
      
      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (response: any) => {
      toast({
        title: t('admin.inbox.messageSent', language),
        description: `${response.messagesSent} ${t('admin.inbox.messagesSent', language)}`,
      });
      setMessageData({
        title: '',
        bodyHtml: '',
        type: 'system',
        locale: 'en',
        segmentType: 'all',
        category: 'announcement',
      });
      setShowCompose(false);
    },
    onError: () => {
      toast({
        title: t('common.error', language),
        description: t('admin.inbox.sendFailed', language),
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (targetType === 'users') {
      broadcastMutation.mutate({
        ...messageData,
        ctaText: null,
        ctaUrl: null,
        priority: 0,
      });
    } else {
      broadcastMutation.mutate({
        title: messageData.title,
        bodyHtml: messageData.bodyHtml,
        category: messageData.category,
        requiresAck: false,
        attachments: [],
      });
    }
  };

  const toggleMessageSelection = (id: number) => {
    setSelectedMessages(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (action: 'read' | 'archive' | 'delete') => {
    toast({
      title: 'Bulk Action',
      description: `${action} ${selectedMessages.length} messages`,
    });
    setSelectedMessages([]);
  };

  const stats = [
    { label: 'Total Messages', value: '156', icon: Mail },
    { label: 'Unread', value: '12', icon: Inbox },
    { label: 'Urgent', value: '3', icon: AlertCircle },
    { label: 'Today', value: '8', icon: Clock },
  ];

  const filteredMessages = mockMessages.filter(msg => {
    if (filterStatus === 'unread' && msg.isRead) return false;
    if (filterStatus === 'important' && !msg.isImportant) return false;
    if (searchQuery && !msg.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return 'luxury-badge';
    }
  };

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8 luxury-animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Inbox className="w-8 h-8 text-purple-600" />
            <h1 className="luxury-heading-lg luxury-text-gradient">
              Admin Inbox
            </h1>
          </div>
          <p className="luxury-text-body">
            Manage all administrative communications and broadcast messages
          </p>
        </div>

        {/* Stats Grid */}
        <div className="luxury-grid-4 mb-8">
          {stats.map((stat, index) => (
            <div 
              key={stat.label}
              className={`luxury-glass-card luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-${index + 1}`}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="w-5 h-5 text-purple-600" />
                <span className="luxury-text-small">{stat.label}</span>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="luxury-glass-panel luxury-shadow-md p-4 mb-6 luxury-animate-fade-in luxury-delay-3">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="luxury-glass-minimal pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {['all', 'unread', 'important', 'archived'].map((filter) => (
                <Button
                  key={filter}
                  onClick={() => setFilterStatus(filter as any)}
                  className={`luxury-badge ${filterStatus === filter ? 'luxury-badge-gold' : ''}`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>

            <Button
              onClick={() => setShowCompose(true)}
              className="luxury-btn-primary"
            >
              <Send className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedMessages.length > 0 && (
          <div className="luxury-glass-card p-4 mb-6 luxury-animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="luxury-badge-gold">
                {selectedMessages.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleBulkAction('read')}
                  className="luxury-btn-secondary flex items-center gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark Read
                </Button>
                <Button
                  onClick={() => handleBulkAction('archive')}
                  className="luxury-btn-secondary flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </Button>
                <Button
                  onClick={() => handleBulkAction('delete')}
                  className="luxury-btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Message List Sidebar */}
          <div className="lg:col-span-4">
            <div className="luxury-glass-panel luxury-shadow-lg p-4 max-h-[800px] overflow-y-auto luxury-animate-slide-up luxury-delay-4">
              <div className="space-y-2">
                {filteredMessages.map((message, index) => (
                  <div
                    key={message.id}
                    onClick={() => setSelectedMessage(message)}
                    className={`luxury-glass-minimal luxury-hover-lift p-4 cursor-pointer transition-all luxury-animate-fade-in luxury-delay-${Math.min(index + 5, 10)}`}
                    style={{ 
                      borderLeft: selectedMessage?.id === message.id ? '3px solid #667eea' : 'none',
                      background: selectedMessage?.id === message.id ? 'rgba(102, 126, 234, 0.05)' : undefined
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedMessages.includes(message.id)}
                        onCheckedChange={() => toggleMessageSelection(message.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!message.isRead && (
                            <div className="w-2 h-2 rounded-full bg-purple-600" />
                          )}
                          <span className={`luxury-heading-sm truncate ${!message.isRead ? 'font-bold' : ''}`}>
                            {message.sender}
                          </span>
                        </div>
                        
                        <p className={`luxury-text-body truncate mb-1 ${!message.isRead ? 'font-semibold' : ''}`}>
                          {message.subject}
                        </p>
                        
                        <p className="luxury-text-small truncate text-gray-500 mb-2">
                          {message.preview}
                        </p>
                        
                        <div className="flex items-center gap-2">
                          <span className="luxury-text-small">{message.timestamp}</span>
                          {message.priority !== 'normal' && (
                            <span className={`luxury-badge text-xs ${getPriorityBadge(message.priority)}`}>
                              {message.priority}
                            </span>
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <Paperclip className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Message Detail Main */}
          <div className="lg:col-span-8">
            {selectedMessage ? (
              <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-scale-in luxury-delay-6">
                {/* Message Header */}
                <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={selectedMessage.senderAvatar} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                        {selectedMessage.sender.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <h2 className="luxury-heading-md mb-1">{selectedMessage.subject}</h2>
                      <div className="flex items-center gap-3">
                        <span className="luxury-text-body font-medium">{selectedMessage.sender}</span>
                        <span className="luxury-text-small">{selectedMessage.timestamp}</span>
                        {selectedMessage.priority !== 'normal' && (
                          <span className={`luxury-badge text-xs ${getPriorityBadge(selectedMessage.priority)}`}>
                            {selectedMessage.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {selectedMessage.isImportant ? (
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <Star className="w-5 h-5 text-gray-400" />
                    )}
                    <Button>
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </Button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="mb-6">
                  <div className="luxury-text-body whitespace-pre-wrap">
                    {selectedMessage.body}
                  </div>
                </div>

                {/* Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mb-6">
                    <h3 className="luxury-heading-sm mb-3">Attachments</h3>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="luxury-glass-minimal p-3 flex items-center gap-3 luxury-hover-lift"
                        >
                          <Paperclip className="w-5 h-5 text-purple-600" />
                          <div className="flex-1">
                            <p className="luxury-text-body font-medium">{attachment.name}</p>
                            <p className="luxury-text-small">{attachment.size}</p>
                          </div>
                          <Button variant="outline" size="sm">Download</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-6 border-t border-gray-200">
                  <Button className="luxury-btn-primary flex items-center gap-2">
                    <Reply className="w-4 h-4" />
                    Reply
                  </Button>
                  <Button className="luxury-btn-secondary flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Archive
                  </Button>
                  <Button className="luxury-btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50 ml-auto">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="luxury-glass-card luxury-shadow-xl p-12 text-center">
                <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="luxury-text-body text-gray-500">Select a message to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Compose Message Modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="luxury-glass-card luxury-shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto luxury-animate-scale-in">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="luxury-heading-md">Compose Message</h2>
                  <Button
                    onClick={() => setShowCompose(false)}
                    className="luxury-btn-ghost p-2"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Target Type Tabs */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setTargetType('users')}
                      className={`luxury-badge ${targetType === 'users' ? 'luxury-badge-gold' : ''}`}
                    >
                      Users
                    </Button>
                    <Button
                      onClick={() => setTargetType('franchises')}
                      className={`luxury-badge ${targetType === 'franchises' ? 'luxury-badge-gold' : ''}`}
                    >
                      Franchises
                    </Button>
                  </div>

                  {/* Subject Field */}
                  <div>
                    <label className="luxury-heading-sm mb-2 block">Subject</label>
                    <Input
                      placeholder="Message subject..."
                      value={messageData.title}
                      onChange={(e) => setMessageData({ ...messageData, title: e.target.value })}
                      className="luxury-glass-minimal"
                    />
                  </div>

                  {/* Message Body */}
                  <div>
                    <label className="luxury-heading-sm mb-2 block">Message</label>
                    <Textarea
                      placeholder="Write your message..."
                      value={messageData.bodyHtml}
                      onChange={(e) => setMessageData({ ...messageData, bodyHtml: e.target.value })}
                      rows={8}
                      className="luxury-glass-minimal"
                    />
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="luxury-heading-sm mb-2 block">Language</label>
                      <Select value={messageData.locale} onValueChange={(v) => setMessageData({ ...messageData, locale: v })}>
                        <SelectTrigger className="luxury-glass-minimal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="he">עברית</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {targetType === 'users' ? (
                      <div>
                        <label className="luxury-heading-sm mb-2 block">Target Segment</label>
                        <Select value={messageData.segmentType} onValueChange={(v) => setMessageData({ ...messageData, segmentType: v })}>
                          <SelectTrigger className="luxury-glass-minimal">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            <SelectItem value="pet_owners">Pet Owners</SelectItem>
                            <SelectItem value="active">Active Users</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <label className="luxury-heading-sm mb-2 block">Category</label>
                        <Select value={messageData.category} onValueChange={(v) => setMessageData({ ...messageData, category: v })}>
                          <SelectTrigger className="luxury-glass-minimal">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ops">Operations</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="announcement">Announcements</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleSend}
                      disabled={!messageData.title || !messageData.bodyHtml || broadcastMutation.isPending}
                      className="luxury-btn-primary luxury-shadow-xl flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {broadcastMutation.isPending ? 'Sending...' : 'Send Message'}
                    </Button>
                    <Button className="luxury-btn-secondary flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attach
                    </Button>
                    <Button
                      onClick={() => setShowCompose(false)}
                      className="luxury-btn-ghost ml-auto"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
