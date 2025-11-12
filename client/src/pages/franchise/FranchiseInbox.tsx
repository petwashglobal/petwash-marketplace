import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useFranchiseId } from '@/hooks/useFranchiseId';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle } from 'lucide-react';
import { trackFranchiseMessageAcknowledged } from '@/lib/analytics';
import { t } from '@/lib/i18n';

interface FranchiseMessage {
  id: string;
  title: string;
  bodyHtml: string;
  category: 'ops' | 'marketing' | 'finance' | 'announcement';
  createdAt: Date;
  readAt: Date | null;
  requiresAck: boolean;
  ackAt: Date | null;
}

export default function FranchiseInbox() {
  const { user } = useFirebaseAuth();
  const { language, dir } = useLanguage();
  const { franchiseId } = useFranchiseId();
  const [selectedMessage, setSelectedMessage] = useState<FranchiseMessage | null>(null);
  const [category, setCategory] = useState<string>('all');

  const { data: messagesData, isLoading } = useQuery<{ messages: FranchiseMessage[] }>({
    queryKey: ['/api/franchise/inbox', franchiseId, category],
    enabled: !!franchiseId,
  });

  const messages = messagesData?.messages || [];

  const acknowledgeMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest(`/api/franchise/inbox/${messageId}/acknowledge?franchiseId=${franchiseId}`, {
        method: 'PATCH',
      });
    },
    onSuccess: (_, messageId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/franchise/inbox'] });
      const message = messages.find(m => m.id === messageId);
      if (message && user) {
        trackFranchiseMessageAcknowledged(franchiseId, messageId, message.category);
      }
    },
  });

  const getCategoryLabel = (cat: string) => {
    const keyMap: Record<string, string> = {
      ops: 'inbox.tabOperations',
      marketing: 'inbox.tabMarketing',
      finance: 'inbox.tabFinance',
      announcement: 'inbox.tabAnnouncements',
    };
    return t(keyMap[cat] || 'inbox.tabAll', language);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            {t('inbox.loading', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('inbox.title', language)}
          </h1>
          <p className="text-gray-600">
            {t('inbox.description', language)}
          </p>
        </div>

        <Tabs value={category} onValueChange={setCategory} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              {t('inbox.tabAll', language)}
            </TabsTrigger>
            <TabsTrigger value="ops">
              {t('inbox.tabOperations', language)}
            </TabsTrigger>
            <TabsTrigger value="marketing">
              {t('inbox.tabMarketing', language)}
            </TabsTrigger>
            <TabsTrigger value="finance">
              {t('inbox.tabFinance', language)}
            </TabsTrigger>
            <TabsTrigger value="announcement">
              {t('inbox.tabAnnouncements', language)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={category} className="mt-0">
            <div className="grid grid-cols-1 gap-4">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <Card key={message.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{message.title}</CardTitle>
                            <Badge variant="outline">{getCategoryLabel(message.category)}</Badge>
                            {message.requiresAck && !message.ackAt && (
                              <Badge variant="destructive">{t('inbox.requiresAck', language)}</Badge>
                            )}
                          </div>
                          <div 
                            className="text-sm text-gray-600 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                          />
                        </div>
                        {message.requiresAck && !message.ackAt && (
                          <Button
                            size="sm"
                            onClick={() => acknowledgeMutation.mutate(message.id)}
                            disabled={acknowledgeMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {t('inbox.acknowledge', language)}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <p className="text-center text-gray-500">
                      {t('inbox.noMessages', language)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
