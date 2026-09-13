import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, MinusCircle } from "lucide-react";
import { useSEO, pageSEO } from '@/lib/seo';
import { useLanguage } from "@/lib/languageStore";

/**
 * /status — public system status.
 *
 * HONESTY RULE (2026-09-13 menu dead-end audit): this page used to hard-code
 * "Operational" for every service — including the payment gateway on a day the
 * till was closed — plus a hard-coded "No incidents in the last 30 days". None
 * of it was measured. It now shows ONLY what the public, unauthenticated
 * GET /api/health endpoint actually measures (server/index.ts):
 *   - API reachable + response time (measured by this browser)
 *   - database read check (checks.db.ok / checks.db.ms)
 *   - database write readiness (checks.dbWrite.dbWritable)
 * Everything else is labelled "not monitored here". No incident history is
 * claimed because none is recorded anywhere this page can read.
 */

type HealthPayload = {
  status?: string;
  timestamp?: string;
  checks?: {
    db?: { ok?: boolean; ms?: number };
    dbWrite?: { dbWritable?: boolean | null; dbWriteLatencyMs?: number | null };
  };
};

type Probe =
  | { state: 'loading' }
  | { state: 'down'; checkedAt: Date }
  | { state: 'up'; checkedAt: Date; ms: number; body: HealthPayload | null };

type RowState = 'ok' | 'fail' | 'unknown' | 'not_monitored';

export default function SystemStatus() {
  useSEO(pageSEO.status);
  const { language } = useLanguage();
  const isHe = language === 'he';
  const t = (he: string, en: string) => (isHe ? he : en);
  const [probe, setProbe] = useState<Probe>({ state: 'loading' });

  const check = useCallback(async () => {
    setProbe({ state: 'loading' });
    const started = performance.now();
    try {
      const res = await fetch('/api/health', { credentials: 'omit', cache: 'no-store' });
      const ms = Math.round(performance.now() - started);
      if (!res.ok) {
        setProbe({ state: 'down', checkedAt: new Date() });
        return;
      }
      let body: HealthPayload | null = null;
      try {
        body = (await res.json()) as HealthPayload;
      } catch {
        body = null;
      }
      setProbe({ state: 'up', checkedAt: new Date(), ms, body });
    } catch {
      setProbe({ state: 'down', checkedAt: new Date() });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const apiState: RowState = probe.state === 'loading' ? 'unknown' : probe.state === 'up' ? 'ok' : 'fail';
  const body = probe.state === 'up' ? probe.body : null;
  const dbOk = body?.checks?.db?.ok;
  const dbWritable = body?.checks?.dbWrite?.dbWritable;
  const dbState: RowState = typeof dbOk === 'boolean' ? (dbOk ? 'ok' : 'fail') : 'unknown';
  const dbWriteState: RowState = typeof dbWritable === 'boolean' ? (dbWritable ? 'ok' : 'fail') : 'unknown';

  const rows: Array<{ key: string; label: string; state: RowState; detail?: string }> = [
    {
      key: 'api',
      label: t('שרת האתר (API)', 'Website server (API)'),
      state: apiState,
      detail: probe.state === 'up' ? t(`זמן תגובה ${probe.ms} מ״ש`, `Response time ${probe.ms} ms`) : undefined,
    },
    {
      key: 'db',
      label: t('מסד נתונים — קריאה', 'Database — read'),
      state: dbState,
      detail: typeof body?.checks?.db?.ms === 'number' ? t(`${body.checks.db.ms} מ״ש`, `${body.checks.db.ms} ms`) : undefined,
    },
    {
      key: 'dbWrite',
      label: t('מסד נתונים — כתיבה', 'Database — write'),
      state: dbWriteState,
    },
    {
      key: 'other',
      label: t('תחנות שטיפה, הזמנות ותשלומים', 'Wash stations, bookings and payments'),
      state: 'not_monitored',
    },
  ];

  const measured = rows.filter((r) => r.state !== 'not_monitored');
  const anyFail = measured.some((r) => r.state === 'fail');
  const allOk = measured.every((r) => r.state === 'ok');

  const badge = (state: RowState) => {
    switch (state) {
      case 'ok':
        return (
          <Badge className="luxury-badge bg-green-600">
            <CheckCircle2 className="w-3 h-3 me-1" />
            {t('תקין', 'Up')}
          </Badge>
        );
      case 'fail':
        return (
          <Badge className="luxury-badge bg-red-600">
            <AlertCircle className="w-3 h-3 me-1" />
            {t('תקלה', 'Down')}
          </Badge>
        );
      case 'unknown':
        return (
          <Badge className="luxury-badge bg-gray-500">
            {probe.state === 'loading' ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <MinusCircle className="w-3 h-3 me-1" />}
            {probe.state === 'loading' ? t('בודק…', 'Checking…') : t('לא ידוע', 'Unknown')}
          </Badge>
        );
      default:
        return (
          <Badge className="luxury-badge bg-gray-400">
            <MinusCircle className="w-3 h-3 me-1" />
            {t('לא מנוטר בעמוד זה', 'Not monitored here')}
          </Badge>
        );
    }
  };

  const summary =
    probe.state === 'loading'
      ? t('בודקים את מצב המערכת…', 'Checking system status…')
      : anyFail
        ? t('זוהתה תקלה באחת הבדיקות', 'A problem was detected in one of the checks')
        : allOk
          ? t('כל הבדיקות הנמדדות תקינות', 'All measured checks are up')
          : t('חלק מהבדיקות לא החזירו תוצאה', 'Some checks returned no result');

  const checkedAt = probe.state === 'loading' ? null : probe.checkedAt;

  return (
    <div className="min-h-screen luxury-bg-mesh" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10" style={{ textAlign: 'center' }}>
          <h1 className="text-4xl font-bold mb-4 luxury-text-gradient">
            {t('מצב המערכת', 'System Status')}
          </h1>
          <p className="text-lg text-gray-600">
            {t(
              'בדיקה חיה של שרת ⁦PetWash™⁩ ומסד הנתונים, מהדפדפן שלכם, ברגע זה.',
              'A live check of the ⁦PetWash™⁩ server and database, from your browser, right now.'
            )}
          </p>
        </div>

        <Card className="luxury-glass-card luxury-shadow-lg p-6 mb-8" data-testid="status-summary">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className={`font-semibold ${anyFail ? 'text-red-800' : 'text-gray-900'}`}>{summary}</h3>
              {checkedAt && (
                <p className="text-sm text-gray-600">
                  {t('נבדק לאחרונה:', 'Last checked:')}{' '}
                  {checkedAt.toLocaleString(isHe ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem' })}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => void check()}
              disabled={probe.state === 'loading'}
              data-testid="button-status-recheck"
            >
              <RefreshCw className="w-4 h-4 me-2" />
              {t('בדיקה חוזרת', 'Check again')}
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.key} className="luxury-glass-minimal p-4" data-testid={`status-row-${row.key}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{row.label}</span>
                  {row.detail && <p className="text-sm text-gray-600">{row.detail}</p>}
                </div>
                {badge(row.state)}
              </div>
            </Card>
          ))}
        </div>

        <p className="text-sm text-gray-600 mt-8" style={{ textAlign: 'center' }}>
          {t(
            'עמוד זה מציג רק מה שנמדד בפועל. לדיווח על תקלה בתחנה או בתשלום — צרו קשר עם התמיכה.',
            'This page shows only what is actually measured. To report a problem at a station or with a payment, contact support.'
          )}
        </p>
      </div>
    </div>
  );
}
