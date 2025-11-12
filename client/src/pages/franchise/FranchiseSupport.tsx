import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useFranchiseId } from '@/hooks/useFranchiseId';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { trackFranchiseSupportTicketCreated } from '@/lib/analytics';
import { t } from '@/lib/i18n';

interface ServiceTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: Date;
}

export default function FranchiseSupport() {
  const { language, dir } = useLanguage();
  const { franchiseId } = useFranchiseId();
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'technical',
    priority: 'medium',
  });

  const { data: ticketsData, isLoading } = useQuery<{ tickets: ServiceTicket[] }>({
    queryKey: ['/api/franchise/support/tickets', franchiseId],
    enabled: !!franchiseId,
  });

  const tickets = ticketsData?.tickets || [];

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/franchise/support/tickets?franchiseId=${franchiseId}`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/franchise/support/tickets'] });
      trackFranchiseSupportTicketCreated(franchiseId, response.ticketId, newTicket.category, newTicket.priority);
      setIsCreating(false);
      setNewTicket({ subject: '', description: '', category: 'technical', priority: 'medium' });
    },
  });

  return (
    <div className="min-h-screen bg-white p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('support.title', language)}
            </h1>
            <p className="text-gray-600">
              {t('support.manageTickets', language)}
            </p>
          </div>
          <Button
            onClick={() => setIsCreating(!isCreating)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('support.newTicket', language)}
          </Button>
        </div>

        {isCreating && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('support.newTicket', language)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder={t('support.subject', language)}
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              />
              <Textarea
                placeholder={t('support.description', language)}
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                rows={4}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">{t('support.categoryTechnical', language)}</SelectItem>
                    <SelectItem value="maintenance">{t('support.categoryMaintenance', language)}</SelectItem>
                    <SelectItem value="supplies">{t('support.categorySupplies', language)}</SelectItem>
                    <SelectItem value="other">{t('support.categoryOther', language)}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('support.priorityLow', language)}</SelectItem>
                    <SelectItem value="medium">{t('support.priorityMedium', language)}</SelectItem>
                    <SelectItem value="high">{t('support.priorityHigh', language)}</SelectItem>
                    <SelectItem value="urgent">{t('support.priorityUrgent', language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createTicketMutation.mutate(newTicket)}
                disabled={!newTicket.subject || createTicketMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {t('support.submitTicket', language)}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{ticket.description}</p>
                  </div>
                  <Badge>{ticket.status}</Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
