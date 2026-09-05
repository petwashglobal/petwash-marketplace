/**
 * AccountFinancials — CEO 2026-08-19 SUMIT Phase 2 Items 9 + 10.
 *
 * The "Account > Documents / Payments" surface. Two sections:
 *   1. Documents / Invoices — fiscal docs SUMIT has on file (חשבוניות/קבלות).
 *   2. Saved Payment Methods — cards stored in SUMIT's PCI vault, with
 *      Add-a-card (hosted redirect) + per-card Remove (confirm dialog).
 *
 * Data source: GET /api/me/sumit/summary (server-derived uid — user A can
 * never see user B's data). The card is never on our server: Add opens a
 * SUMIT hosted portal URL from GET /api/me/sumit/add-card-url; Remove hits
 * DELETE /api/me/sumit/methods/:token.
 *
 * Bilingual HE + EN via useLanguage(). Honest states — loading / empty /
 * error are all real, no fake data.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SumitSummaryResponse = {
  available: boolean;
  savedMethods: any[];
  documents: any[];
};

/**
 * Tolerant normaliser. The server now projects these objects through an
 * allowlist (SumitFinancialsService.projectSavedMethod / projectDocument), so
 * in practice `raw` already arrives in this exact shape — the lowercase
 * fallbacks below make the function idempotent over it. The PascalCase
 * branches are retained so a cached response from before that change still
 * renders.
 */
function normaliseCard(raw: any): { id: string; last4?: string; brand?: string; expiry?: string } {
  const id = String(
    raw?.PaymentMethodID ?? raw?.PaymentMethodId ?? raw?.ID ?? raw?.Id ?? raw?.id ?? '',
  );
  const last4 = raw?.Last4Digits ?? raw?.Last4 ?? raw?.last4 ?? undefined;
  const brand = raw?.CardBrand ?? raw?.Brand ?? raw?.brand ?? undefined;
  const expiry = raw?.Expiration ?? raw?.Expiry ?? raw?.expiration ?? raw?.expiry ?? undefined;
  return { id, last4, brand, expiry };
}

function normaliseDocument(raw: any): {
  id: string;
  number?: string;
  type?: string;
  date?: string;
  amount?: number;
  url?: string;
} {
  const id = String(raw?.DocumentID ?? raw?.ID ?? raw?.DocumentNumber ?? raw?.Number ?? raw?.id ?? '');
  const number = raw?.DocumentNumber ?? raw?.Number ?? raw?.number ?? undefined;
  const type = raw?.DocumentType ?? raw?.Type ?? raw?.type ?? undefined;
  const date = raw?.IssueDate ?? raw?.Date ?? raw?.CreatedAt ?? raw?.date ?? undefined;
  const amount = typeof raw?.TotalAmount === 'number' ? raw.TotalAmount
    : typeof raw?.Amount === 'number' ? raw.Amount
    : typeof raw?.amount === 'number' ? raw.amount
    : undefined;
  const url = raw?.DocumentURL ?? raw?.URL ?? raw?.PdfURL ?? raw?.url ?? undefined;
  return { id, number, type, date, amount, url };
}

export default function AccountFinancials() {
  const { language } = useLanguage();
  const he = language === 'he';
  const dir: 'rtl' | 'ltr' = he ? 'rtl' : 'ltr';
  const { toast } = useToast();
  const qc = useQueryClient();

  const [pendingRemove, setPendingRemove] = useState<{ id: string; last4?: string } | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  const { data, isLoading, isError } = useQuery<SumitSummaryResponse>({
    queryKey: ['/api/me/sumit/summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/me/sumit/summary');
      if (!res.ok) throw new Error('summary fetch failed');
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const removeMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await apiRequest('DELETE', `/api/me/sumit/methods/${encodeURIComponent(paymentMethodId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `remove failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: he ? 'הכרטיס הוסר' : 'Card removed',
        description: he ? 'הכרטיס הוסר מ־SUMIT.' : 'The card was removed from SUMIT.',
      });
      qc.invalidateQueries({ queryKey: ['/api/me/sumit/summary'] });
      setPendingRemove(null);
    },
    onError: (err: any) => {
      toast({
        title: he ? 'ההסרה נכשלה' : 'Remove failed',
        description: err?.message || (he ? 'נסו שוב מאוחר יותר.' : 'Please try again later.'),
        variant: 'destructive',
      });
      setPendingRemove(null);
    },
  });

  async function handleAddCard() {
    setAddingCard(true);
    try {
      const res = await apiRequest('GET', '/api/me/sumit/add-card-url');
      const body = await res.json().catch(() => ({}));
      if (body?.available && body?.url) {
        window.open(body.url, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: he ? 'לא ניתן להוסיף כרטיס כרגע' : 'Cannot add a card right now',
          description: he
            ? 'חשבון SUMIT שלכם עדיין לא מסונכרן. נסו שוב מאוחר יותר.'
            : 'Your SUMIT account is not yet synced. Please try again later.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: he ? 'שגיאה' : 'Error',
        description: err?.message || (he ? 'נסו שוב.' : 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setAddingCard(false);
    }
  }

  const t = {
    title: he ? 'תשלומים ומסמכים' : 'Payments & Documents',
    subtitle: he
      ? 'החשבוניות ואמצעי התשלום השמורים ב־SUMIT.'
      : 'Your invoices and saved payment methods stored in SUMIT.',
    docsTitle: he ? 'מסמכים / חשבוניות' : 'Documents / Invoices',
    methodsTitle: he ? 'אמצעי תשלום שמורים' : 'Saved Payment Methods',
    addCard: he ? 'הוסיפו כרטיס' : 'Add a card',
    remove: he ? 'הסר' : 'Remove',
    emptyDocs: he ? 'אין מסמכים להצגה עדיין.' : 'No documents to show yet.',
    emptyMethods: he ? 'אין כרטיסים שמורים.' : 'No saved cards on file.',
    loading: he ? 'טוען…' : 'Loading…',
    error: he
      ? 'לא הצלחנו לטעון את המידע כרגע. נסו לרענן.'
      : 'We could not load this right now. Try refreshing.',
    notSynced: he
      ? 'חשבון SUMIT שלכם עדיין לא מסונכרן. חשבוניות ואמצעי תשלום יופיעו כאן ברגע שהסנכרון יתבצע.'
      : 'Your SUMIT account is not yet synced. Invoices and saved cards will appear here once sync runs.',
    view: he ? 'צפייה' : 'View',
    confirmRemoveTitle: he ? 'להסיר את הכרטיס?' : 'Remove this card?',
    confirmRemoveBody: he
      ? 'הכרטיס יוסר מ־SUMIT ולא ניתן יהיה לחייב אותו יותר. פעולה זו הפיכה על ידי הוספה מחדש.'
      : 'The card will be removed from SUMIT and can no longer be charged. You can add it again later.',
    cancel: he ? 'ביטול' : 'Cancel',
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-8" dir={dir} data-testid="page-account-financials">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a]">{t.title}</h1>
          <p className="text-sm text-[#666] font-light mt-1">{t.subtitle}</p>
        </header>

        {isError && (
          <Card className="mb-4 border-red-200 bg-red-50" data-testid="financials-error">
            <CardContent className="p-4 text-sm text-red-800">{t.error}</CardContent>
          </Card>
        )}

        {!isLoading && !isError && data && !data.available && (
          <Card className="mb-4" data-testid="financials-not-synced">
            <CardContent className="p-4 text-sm text-[#666]">{t.notSynced}</CardContent>
          </Card>
        )}

        {/* Documents / Invoices */}
        <Card className="mb-6" data-testid="financials-documents-card">
          <CardHeader>
            <CardTitle className="text-lg">{t.docsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (data?.documents?.length ?? 0) === 0 ? (
              <div className="text-sm text-[#666] py-2" data-testid="documents-empty">
                {t.emptyDocs}
              </div>
            ) : (
              <ul className="divide-y divide-[#eee]" data-testid="documents-list">
                {(data?.documents ?? []).map((raw, idx) => {
                  const d = normaliseDocument(raw);
                  return (
                    <li
                      key={d.id || `doc-${idx}`}
                      className="flex items-center justify-between py-2 gap-3"
                      data-testid={`document-row-${idx}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#1a1a1a] truncate">
                          {d.number || (he ? 'מסמך' : 'Document')} {d.type ? <Badge variant="outline" className="ms-2">{d.type}</Badge> : null}
                        </div>
                        <div className="text-xs text-[#666] font-light mt-0.5">
                          {d.date || ''}
                          {d.amount != null ? <span className="ms-2">₪{Number(d.amount).toFixed(2)}</span> : null}
                        </div>
                      </div>
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#0a58ff] hover:underline"
                          data-testid={`document-view-${idx}`}
                        >
                          {t.view}
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Saved Payment Methods (Item 10) */}
        <Card data-testid="financials-methods-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t.methodsTitle}</CardTitle>
            <Button
              onClick={handleAddCard}
              disabled={addingCard}
              size="sm"
              data-testid="button-add-card"
            >
              {addingCard ? t.loading : t.addCard}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (data?.savedMethods?.length ?? 0) === 0 ? (
              <div className="text-sm text-[#666] py-2" data-testid="methods-empty">
                {t.emptyMethods}
              </div>
            ) : (
              <ul className="divide-y divide-[#eee]" data-testid="methods-list">
                {(data?.savedMethods ?? []).map((raw, idx) => {
                  const c = normaliseCard(raw);
                  return (
                    <li
                      key={c.id || `method-${idx}`}
                      className="flex items-center justify-between py-2 gap-3"
                      data-testid={`method-row-${idx}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#1a1a1a]">
                          {c.brand || (he ? 'כרטיס' : 'Card')}
                          {c.last4 ? <span className="ms-2">•••• {c.last4}</span> : null}
                        </div>
                        {c.expiry ? (
                          <div className="text-xs text-[#666] font-light mt-0.5">{c.expiry}</div>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingRemove({ id: c.id, last4: c.last4 })}
                        disabled={!c.id || removeMutation.isPending}
                        data-testid={`button-remove-method-${idx}`}
                      >
                        {t.remove}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Confirm dialog on Remove (Item 10 requirement) */}
        <AlertDialog
          open={pendingRemove != null}
          onOpenChange={(open) => !open && setPendingRemove(null)}
        >
          <AlertDialogContent dir={dir} data-testid="confirm-remove-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{t.confirmRemoveTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.confirmRemoveBody}
                {pendingRemove?.last4 ? (
                  <span className="block mt-2 font-medium">•••• {pendingRemove.last4}</span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-remove">{t.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => pendingRemove && removeMutation.mutate(pendingRemove.id)}
                data-testid="button-confirm-remove"
              >
                {t.remove}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
