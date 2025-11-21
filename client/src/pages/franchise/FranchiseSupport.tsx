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
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 luxury-animate-fade-in">
          <div>
            <h1 className="luxury-heading-xl mb-3">
              {t('support.title', language)}
            </h1>
            <p className="luxury-text-body">
              {t('support.manageTickets', language)}
            </p>
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="luxury-btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('support.newTicket', language)}
          </button>
        </div>

        {isCreating && (
          <div className="luxury-glass-card shadow-lg mb-6 luxury-animate-scale-in">
            <CardHeader>
              <CardTitle className="luxury-heading-md">{t('support.newTicket', language)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder={t('support.subject', language)}
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                className="luxury-glass-minimal"
              />
              <Textarea
                placeholder={t('support.description', language)}
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                rows={4}
                className="luxury-glass-minimal"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                  <SelectTrigger className="luxury-glass-minimal">
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
                  <SelectTrigger className="luxury-glass-minimal">
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
              <button
                onClick={() => createTicketMutation.mutate(newTicket)}
                disabled={!newTicket.subject || createTicketMutation.isPending}
                className="w-full luxury-btn-primary"
              >
                {t('support.submitTicket', language)}
              </button>
            </CardContent>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className={`luxury-glass-card shadow-lg transition-all duration-300 hover:scale-102 hover:shadow-xl luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="luxury-heading-md mb-2">{ticket.subject}</CardTitle>
                    <p className="luxury-text-body">{ticket.description}</p>
                  </div>
                  <Badge className="luxury-badge">{ticket.status}</Badge>
                </div>
              </CardHeader>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
