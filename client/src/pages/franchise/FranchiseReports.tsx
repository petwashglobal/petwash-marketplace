import { useState } from 'react';
import { useLanguage } from '@/lib/languageStore';
import { useFranchiseId } from '@/hooks/useFranchiseId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Sparkles, RefreshCw } from 'lucide-react';
import { trackFranchiseReportDownloaded } from '@/lib/analytics';
import { t } from '@/lib/i18n';
import { apiRequest } from '@/lib/queryClient';

export default function FranchiseReports() {
  const { language, dir } = useLanguage();
  const { franchiseId } = useFranchiseId();
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const generateAiReport = async () => {
    if (!franchiseId) return;
    setGeneratingReport(true);
    try {
      const res = await apiRequest('POST', `/api/franchise/${franchiseId}/ai-narrative-report`, {});
      const data = await res.json();
      setAiReport(data.report || null);
    } catch {
      setAiReport('Unable to generate report at this time. Please try again later.');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Admin-audit CRIT #5 fix (2026-08-25): both Monthly and Daily buttons used
  // to pass `period=monthly` hard-coded to the server, so the Daily card
  // downloaded a MONTHLY spreadsheet. Now we infer period from the date string
  // shape (YYYY-MM = monthly, YYYY-MM-DD = daily) and use Israel-local time
  // for the date to avoid the UTC-truncation off-by-one during 02:00-03:00
  // (audit CRIT #19).
  const handleDownload = (type: 'excel' | 'pdf', period: string) => {
    if (!franchiseId) return;
    // Israel-local YYYY-MM-DD / YYYY-MM slice (was ISO/UTC → yesterday between
    // 02:00–03:00 Israel time).
    const scope = period.length === 10 ? 'daily' : 'monthly';
    trackFranchiseReportDownloaded(franchiseId, type, period);
    window.open(
      `/api/franchise/reports/export/${type}?franchiseId=${franchiseId}&period=${scope}&date=${period}`,
      '_blank',
    );
  };

  const israelLocalDate = (): string => {
    // Format today's date in Israel time — YYYY-MM-DD
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value ?? '';
    const m = parts.find(p => p.type === 'month')?.value ?? '';
    const d = parts.find(p => p.type === 'day')?.value ?? '';
    return `${y}-${m}-${d}`;
  };
  const israelLocalMonth = (): string => israelLocalDate().slice(0, 7);

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-3">
            {t('reports.title', language)}
          </h1>
          <p className="luxury-text-body">
            {t('reports.description', language)}
          </p>
        </div>

        {/* Gemini AI Narrative Report (T011) */}
        <div className="luxury-glass-card shadow-lg luxury-animate-fade-in mb-6 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="luxury-heading-md">AI Intelligence Report</h3>
              <p className="text-sm text-gray-500">Gemini-powered business narrative for your territory</p>
            </div>
          </div>
          {aiReport ? (
            <div className="bg-white/70 rounded-xl p-4 text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap border border-[#D4AF37]">
              {aiReport}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic mb-3">Click below to generate your personalized AI business narrative report.</p>
          )}
          <button onClick={generateAiReport} disabled={generatingReport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}>
            {generatingReport
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
              : <><Sparkles className="h-4 w-4" /> {aiReport ? 'Regenerate Report' : 'Generate AI Report'}</>
            }
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-1">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">{t('reports.monthlyReport', language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => handleDownload('excel', israelLocalMonth())}
                className="w-full luxury-btn-primary flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('reports.downloadExcel', language)}
              </button>
              <button
                onClick={() => handleDownload('pdf', israelLocalMonth())}
                className="w-full luxury-btn-secondary flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {t('reports.downloadPDF', language)}
              </button>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-2">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">{t('reports.dailyReport', language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => handleDownload('excel', israelLocalDate())}
                className="w-full luxury-btn-primary flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('reports.downloadExcel', language)}
              </button>
              <button
                onClick={() => handleDownload('pdf', israelLocalDate())}
                className="w-full luxury-btn-secondary flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {t('reports.downloadPDF', language)}
              </button>
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  );
}
