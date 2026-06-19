/**
 * PetDocuments — the Pet Passport Document Vault (Phase 1).
 *
 * Owner uploads documents (vaccine card, pedigree, insurance, etc.) to PRIVATE
 * storage. Files are never public; viewing fetches a short-lived signed URL from
 * GET /api/pet-documents/:petId/:docId/view-url and EVERY view is access-logged
 * server-side. Wording is strictly "owner-declared / uploaded by you" — we never
 * claim a document is legally valid or verified.
 *
 * Routed at /pets/:petId/documents. Luxury gold-on-dark, RTL-safe, bilingual.
 */
import { useState, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Lock, Upload, FileText, Eye, Trash2, CalendarClock, ShieldCheck } from 'lucide-react';

interface PetDoc {
  id: string;
  documentType: string;
  title: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  status: 'active' | 'expired';
  ownerDeclared: boolean;
  visibility: string;
  fileMime?: string;
  createdAt?: any;
}

const DOC_TYPES: { value: string; en: string; he: string }[] = [
  { value: 'vaccine_card', en: 'Vaccine card', he: 'כרטיס חיסונים' },
  { value: 'pedigree', en: 'Pedigree', he: 'תעודת ייחוס' },
  { value: 'insurance', en: 'Insurance', he: 'ביטוח' },
  { value: 'microchip_certificate', en: 'Microchip certificate', he: 'תעודת שבב' },
  { value: 'vet_record', en: 'Vet record', he: 'רשומת וטרינר' },
  { value: 'adoption_paper', en: 'Adoption paper', he: 'מסמך אימוץ' },
  { value: 'other', en: 'Other', he: 'אחר' },
];

export default function PetDocuments() {
  const { petId } = useParams<{ petId: string }>();
  const { language } = useLanguage();
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState('vaccine_card');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery<{ documents: PetDoc[] }>({
    queryKey: [`/api/pet-documents/${petId}`],
    enabled: !!petId,
  });
  const docs = data?.documents || [];

  const upload = useMutation({
    mutationFn: async () => {
      if (!pendingFile) throw new Error('no_file');
      const fd = new FormData();
      fd.append('file', pendingFile);
      fd.append('documentType', docType);
      fd.append('title', title || DOC_TYPES.find((d) => d.value === docType)?.[he ? 'he' : 'en'] || 'Document');
      if (issueDate) fd.append('issueDate', issueDate);
      if (expiryDate) fd.append('expiryDate', expiryDate);
      const res = await apiRequest(`/api/pet-documents/${petId}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload_failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pet-documents/${petId}`] });
      setTitle(''); setIssueDate(''); setExpiryDate(''); setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
      toast({ title: tr('Uploaded', 'הועלה'), description: tr('Stored privately.', 'נשמר באופן פרטי.') });
    },
    onError: () => toast({ title: tr('Upload failed', 'ההעלאה נכשלה'), variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (docId: string) => {
      const res = await apiRequest(`/api/pet-documents/${petId}/${docId}`, 'DELETE');
      if (!res.ok) throw new Error('delete_failed');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/pet-documents/${petId}`] }),
    onError: () => toast({ title: tr('Could not delete', 'מחיקה נכשלה'), variant: 'destructive' }),
  });

  const view = async (docId: string) => {
    try {
      const res = await apiRequest(`/api/pet-documents/${petId}/${docId}/view-url`, 'GET');
      if (!res.ok) throw new Error('view_failed');
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ title: tr('Could not open', 'פתיחה נכשלה'), variant: 'destructive' });
    }
  };

  const typeLabel = (t: string) => DOC_TYPES.find((d) => d.value === t)?.[he ? 'he' : 'en'] || t;
  const fmtDate = (d?: string | null) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString(he ? 'he-IL' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-8 px-4" dir={he ? 'rtl' : 'ltr'}>
        <div className="max-w-md mx-auto">
          <button onClick={() => navigate('/my-account')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 text-sm">
            <ArrowLeft className={`w-4 h-4 ${he ? 'scale-x-[-1]' : ''}`} />
            {tr('Back', 'חזרה')}
          </button>

          {/* Upload card */}
          <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-500 shadow-2xl mb-5">
            <div className="rounded-3xl bg-gradient-to-b from-neutral-900 to-black px-6 py-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-300/80">
                <Lock className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{tr('Document vault · private', 'כספת מסמכים · פרטי')}</span>
              </div>
              <h1 className="text-xl font-semibold text-white">{tr('Pet documents', 'מסמכי החיה')}</h1>
              <p className="text-[11px] text-gray-400 leading-relaxed -mt-1">
                {tr(
                  'Documents you upload are stored privately and shown only to you. These are owner-declared — uploading a file does not make it legally verified.',
                  'מסמכים שתעלה/י נשמרים באופן פרטי ומוצגים רק לך. אלו מסמכים בהצהרת בעלים — העלאת קובץ אינה הופכת אותו למאומת משפטית.',
                )}
              </p>

              <div>
                <label className="block text-xs uppercase tracking-wider text-amber-300/70 mb-1.5">{tr('Type', 'סוג')}</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-xl bg-white/[0.04] border border-amber-300/15 px-3 py-2.5 text-sm text-white focus:border-amber-300/50 focus:outline-none"
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value} className="bg-neutral-900">{he ? d.he : d.en}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-amber-300/70 mb-1.5">{tr('Title', 'כותרת')}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" placeholder={tr('e.g. Rabies 2026', 'למשל: כלבת 2026')}
                  className="w-full rounded-xl bg-white/[0.04] border border-amber-300/15 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-amber-300/50 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-amber-300/70 mb-1.5">{tr('Issue date', 'תאריך הנפקה')}</label>
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-amber-300/15 px-3 py-2.5 text-sm text-white focus:border-amber-300/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-amber-300/70 mb-1.5">{tr('Expiry date', 'תאריך תפוגה')}</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-xl bg-white/[0.04] border border-amber-300/15 px-3 py-2.5 text-sm text-white focus:border-amber-300/50 focus:outline-none" />
                </div>
              </div>

              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-gray-400 file:me-3 file:rounded-lg file:border-0 file:bg-amber-300/15 file:px-3 file:py-2 file:text-amber-200" />

              <button
                onClick={() => upload.mutate()}
                disabled={upload.isPending || !pendingFile}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-neutral-950 font-semibold py-3 disabled:opacity-50"
              >
                {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {tr('Upload to vault', 'העלאה לכספת')}
              </button>
            </div>
          </div>

          {/* Document list */}
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : docs.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">{tr('No documents yet.', 'אין מסמכים עדיין.')}</p>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <div key={d.id} className="rounded-2xl bg-white/[0.04] border border-amber-300/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-amber-300/70 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate" dir="auto">{d.title}</p>
                        <p className="text-[11px] text-gray-400">{typeLabel(d.documentType)}</p>
                        {d.expiryDate && (
                          <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${d.status === 'expired' ? 'text-red-400' : 'text-amber-300/60'}`}>
                            <CalendarClock className="w-3 h-3" />
                            {d.status === 'expired' ? tr('Expired', 'פג תוקף') : tr('Expires', 'תוקף')} {fmtDate(d.expiryDate)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => view(d.id)} title={tr('View', 'צפייה')}
                        className="w-8 h-8 rounded-full bg-white/5 border border-amber-300/20 flex items-center justify-center text-amber-200 hover:bg-white/10">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove.mutate(d.id)} disabled={remove.isPending} title={tr('Delete', 'מחיקה')}
                        className="w-8 h-8 rounded-full bg-white/5 border border-red-400/20 flex items-center justify-center text-red-300 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500">
                    <ShieldCheck className="w-3 h-3" />
                    {tr('Owner-declared · private · access is logged', 'בהצהרת בעלים · פרטי · הצפייה מתועדת')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
