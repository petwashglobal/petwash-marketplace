import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { t } from '@/lib/i18n';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminInbox() {
  const { language, dir } = useLanguage();
  const { toast } = useToast();
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('admin.inbox.broadcast', language)}
          </h1>
          <p className="text-gray-600">
            {t('admin.inbox.broadcastDesc', language)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.inbox.newMessage', language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={targetType} onValueChange={(v) => setTargetType(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="users">{t('admin.inbox.users', language)}</TabsTrigger>
                <TabsTrigger value="franchises">{t('admin.inbox.franchises', language)}</TabsTrigger>
              </TabsList>
            </Tabs>

            <Input
              placeholder={t('common.title', language)}
              value={messageData.title}
              onChange={(e) => setMessageData({ ...messageData, title: e.target.value })}
            />

            <Textarea
              placeholder={t('admin.inbox.messageBody', language)}
              value={messageData.bodyHtml}
              onChange={(e) => setMessageData({ ...messageData, bodyHtml: e.target.value })}
              rows={6}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select value={messageData.locale} onValueChange={(v) => setMessageData({ ...messageData, locale: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.language', language)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="he">עברית</SelectItem>
                  <SelectItem value="both">{t('common.both', language)}</SelectItem>
                </SelectContent>
              </Select>

              {targetType === 'users' ? (
                <Select value={messageData.segmentType} onValueChange={(v) => setMessageData({ ...messageData, segmentType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.inbox.targetSegment', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.inbox.allUsers', language)}</SelectItem>
                    <SelectItem value="pet_owners">{t('admin.inbox.petOwners', language)}</SelectItem>
                    <SelectItem value="active">{t('admin.inbox.activeUsers', language)}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={messageData.category} onValueChange={(v) => setMessageData({ ...messageData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.category', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ops">{t('admin.inbox.operations', language)}</SelectItem>
                    <SelectItem value="marketing">{t('admin.inbox.marketing', language)}</SelectItem>
                    <SelectItem value="finance">{t('admin.inbox.finance', language)}</SelectItem>
                    <SelectItem value="announcement">{t('admin.inbox.announcements', language)}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              onClick={handleSend}
              disabled={!messageData.title || !messageData.bodyHtml || broadcastMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {t('admin.inbox.sendMessage', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
