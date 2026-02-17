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
import sanitizeHtml from 'sanitize-html';

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
    queryKey: ['/api/franchise/inbox'],
    enabled: !!franchiseId,
  });

  const allMessages = messagesData?.messages || [];
  const messages = category === 'all' ? allMessages : allMessages.filter(m => m.category === category);

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
      <div className="min-h-screen luxury-bg-mesh p-4 md:p-6 flex items-center justify-center">
        <div className="text-center luxury-animate-fade-in">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="luxury-text-body">
            {t('inbox.loading', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-3">
            {t('inbox.title', language)}
          </h1>
          <p className="luxury-text-body">
            {t('inbox.description', language)}
          </p>
        </div>

        <Tabs value={category} onValueChange={setCategory} className="w-full">
          <div className="luxury-glass-card shadow-lg mb-6 p-2 luxury-animate-fade-in luxury-delay-1">
            <TabsList className="bg-transparent w-full">
              <TabsTrigger value="all" className="data-[state=active]:luxury-text-gradient">
                {t('inbox.tabAll', language)}
              </TabsTrigger>
              <TabsTrigger value="ops" className="data-[state=active]:luxury-text-gradient">
                {t('inbox.tabOperations', language)}
              </TabsTrigger>
              <TabsTrigger value="marketing" className="data-[state=active]:luxury-text-gradient">
                {t('inbox.tabMarketing', language)}
              </TabsTrigger>
              <TabsTrigger value="finance" className="data-[state=active]:luxury-text-gradient">
                {t('inbox.tabFinance', language)}
              </TabsTrigger>
              <TabsTrigger value="announcement" className="data-[state=active]:luxury-text-gradient">
                {t('inbox.tabAnnouncements', language)}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={category} className="mt-0">
            <div className="grid grid-cols-1 gap-4">
              {messages.length > 0 ? (
                messages.map((message, index) => (
                  <div key={message.id} className={`luxury-glass-card shadow-lg transition-all duration-300 hover:scale-102 hover:shadow-xl luxury-animate-fade-in luxury-delay-${Math.min(index + 2, 10)}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <CardTitle className="luxury-heading-md">{message.title}</CardTitle>
                            <Badge variant="outline" className="luxury-badge">{getCategoryLabel(message.category)}</Badge>
                            {message.requiresAck && !message.ackAt && (
                              <Badge variant="destructive">{t('inbox.requiresAck', language)}</Badge>
                            )}
                          </div>
                          <div 
                            className="luxury-text-body line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.bodyHtml, {
                              allowedTags: ['p', 'br', 'strong', 'em', 'u', 'span'],
                              allowedAttributes: {}
                            }) }}
                          />
                        </div>
                        {message.requiresAck && !message.ackAt && (
                          <button
                            onClick={() => acknowledgeMutation.mutate(message.id)}
                            disabled={acknowledgeMutation.isPending}
                            className="luxury-btn-primary flex items-center gap-2 whitespace-nowrap"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {t('inbox.acknowledge', language)}
                          </button>
                        )}
                      </div>
                    </CardHeader>
                  </div>
                ))
              ) : (
                <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-2">
                  <CardContent className="py-12">
                    <p className="text-center luxury-text-body">
                      {t('inbox.noMessages', language)}
                    </p>
                  </CardContent>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
