import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { code128Bars, code128Pattern } from '@shared/lib/code128';
import { PetWashLogo } from '@/components/brand/PetWashLogo';

/**
 * The BACK of the membership card (CEO design 2026-09-12): QR
 * (https://petwash.co.il/m/<token>), a REAL Code-128 barcode + its value,
 * MEMBER ID, support email, "Membership card only — not a credit card", and
 * the one action a member needs on the back: report the card lost, which
 * rotates the QR + barcode and freezes the old ones.
 *
 * Until now the server generated qrUrl + barcodeValue and the client ignored
 * both; the only "barcode" in the codebase was fake. White / black / gold.
 */
export function Code128Svg({ value, height = 44, className, testid }: { value: string; height?: number; className?: string; testid?: string }) {
  let bars: { x: number; width: number }[] = [];
  let modules = 0;
  try { bars = code128Bars(value); modules = code128Pattern(value).length; } catch { return null; }
  const quiet = 10; // quiet zone in modules each side
  const w = modules + quiet * 2;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={`barcode ${value}`} data-testid={testid} shapeRendering="crispEdges">
      <rect x={0} y={0} width={w} height={height} fill="#FFFFFF" />
      {bars.map((b, i) => <rect key={i} x={quiet + b.x} y={0} width={b.width} height={height} fill="#111111" />)}
    </svg>
  );
}

export function MemberCardBack({ memberId, qrUrl, barcodeValue, language, status }: { memberId: string; qrUrl: string; barcodeValue: string; language: string; status?: string }) {
  const he = language === 'he';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const lost = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/membership/card/report-lost', {})).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/membership/card'] });
      setConfirm(false);
      toast({ title: he ? 'הכרטיס דווח כאבוד' : 'Card reported lost', description: he ? 'הקוד הישן בוטל. הקוד החדש כבר על המסך; כרטיס פיזי חדש יונפק.' : 'The old codes are void. Your new code is on screen; a new physical card will be issued.' });
    },
    onError: () => toast({ variant: 'destructive', title: he ? 'הדיווח נכשל' : 'Report failed' }),
  });
  const isLost = status === 'lost' || status === 'frozen';

  return (
    <div className="relative rounded-[22px] overflow-hidden mb-4" style={{ background: '#FFFFFF', border: '1px solid rgba(212,175,55,0.55)' }} dir={he ? 'rtl' : 'ltr'} data-testid="member-card-back">
      <div className="p-5 flex items-start gap-4">
        <div className="shrink-0 bg-white rounded-xl p-1.5 border border-gray-100">
          <QRCodeSVG value={qrUrl} size={92} level="M" includeMargin={false} data-testid="member-card-back-qr" />
        </div>
        <div className="flex-1 min-w-0">
          <PetWashLogo size={16} />
          <p className="text-[8px] tracking-[0.28em] uppercase mt-2" style={{ color: '#8A6A1B' }}>{he ? 'סריקה לזיהוי' : 'Scan to identify'}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{he ? 'עובד עם האפליקציה, הארנק בטלפון וקורא העמדה.' : 'Works with the app, your phone wallet and the station reader.'}</p>
          <p className="text-[8px] tracking-[0.28em] uppercase mt-2" style={{ color: '#8A6A1B' }}>{he ? 'מספר חבר' : 'Member ID'}</p>
          <p dir="ltr" className="text-xs font-semibold" style={{ color: '#111111', letterSpacing: '0.08em' }} data-testid="member-card-back-id">{memberId}</p>
        </div>
      </div>
      <div className="px-5 pb-4">
        <Code128Svg value={barcodeValue} height={40} className="w-full h-10" testid="member-card-back-barcode" />
        <p dir="ltr" className="text-[10px] font-mono text-gray-700 mt-1" style={{ textAlign: 'center', letterSpacing: '0.12em' }} data-testid="member-card-back-barcode-value">{barcodeValue}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[8px] tracking-[0.18em] uppercase" style={{ color: '#8A6A1B' }}>{he ? 'כרטיס חבר בלבד — לא כרטיס אשראי' : 'Membership card only — not a credit card'}</p>
          <span className="text-[9px] text-gray-500" dir="ltr">support@petwash.co.il</span>
        </div>
        <div className="mt-3">
          {isLost ? (
            <p className="text-[11px] text-red-700" data-testid="member-card-back-lost">{he ? 'הכרטיס הפיזי מבוטל. הקוד שעל המסך הוא התקף.' : 'The physical card is void. The on-screen code is the valid one.'}</p>
          ) : !confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="text-[11px] underline underline-offset-4 text-gray-600" data-testid="member-card-report-lost">
              {he ? 'איבדתי את הכרטיס — לבטל את הקודים' : 'I lost my card — void the codes'}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => lost.mutate()} disabled={lost.isPending} className="text-[11px] rounded-full bg-black text-white px-3 py-1.5" data-testid="member-card-report-lost-confirm">
                {lost.isPending ? (he ? 'מבטל…' : 'Voiding…') : (he ? 'כן, לבטל ולהנפיק חדש' : 'Yes, void and reissue')}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-[11px] text-gray-500">{he ? 'ביטול' : 'Cancel'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemberCardBack;
