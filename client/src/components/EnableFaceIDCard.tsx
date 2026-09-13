import { useState } from 'react';
import { PasskeyCreateFlow } from '@/components/PasskeyCreateFlow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Fingerprint, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { t } from '@/lib/i18n';

interface EnableFaceIDCardProps {
  userEmail: string;
  onEnabled?: () => void;
  language?: 'en' | 'he';
}

export default function EnableFaceIDCard({ 
  userEmail, 
  onEnabled,
  language = 'en' 
}: EnableFaceIDCardProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  // Consent screen first, then the Face ID sheet (PasskeyCreateFlow, 2026-09-14).
  const [flowOpen, setFlowOpen] = useState(false);
  const handleEnableFaceID = () => setFlowOpen(true);
  const handleCreated = () => {
    setDone(true);
    toast({
      title: t('faceID.successTitle', language),
      description: t('faceID.successDescription', language),
    });
    onEnabled?.();
  };

  return (
    // FACE-ID-CONTRAST-FIX (2026-08-23): was
    //   bg-gradient-to-br from-black/40 to-black/20 border-gold/30
    // which relies on the parent page being dark to render as a
    // dark card. When this card is mounted on a light-background
    // route (e.g. post-signup on the marketing shell), 20-40%
    // black on white collapses to LIGHT GREY, the gold text and
    // black-on-gold button lose all contrast, and the whole card
    // reads as "disabled". Fixed to an opaque near-black background
    // with a strong gold border, guaranteed high-contrast text/button
    // regardless of the parent's page color.
    <>
    <PasskeyCreateFlow open={flowOpen} onOpenChange={setFlowOpen} language={language} onCreated={handleCreated} />
    <Card
      className="border-2 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#0B0B0B',
        borderColor: 'rgba(217, 184, 76, 0.55)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(217, 184, 76, 0.1)',
      }}
    >
      <CardHeader className="text-center pt-6 pb-2">
        <div className="flex justify-center mb-3">
          <div
            className="p-3 rounded-full"
            style={{ backgroundColor: 'rgba(217, 184, 76, 0.18)' }}
          >
            <Fingerprint className="h-8 w-8" style={{ color: '#D9B84C' }} />
          </div>
        </div>
        <CardTitle className="text-xl" style={{ color: '#D9B84C' }}>
          {t('faceID.title', language)}
        </CardTitle>
        <CardDescription style={{ color: '#E5E7EB' }}>
          {t('faceID.description', language)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-6">
        <Button
          onClick={handleEnableFaceID}
          disabled={busy || done}
          className="w-full font-semibold h-12 rounded-full transition-all"
          style={{
            backgroundColor: done ? '#16A34A' : '#D9B84C',
            color: '#000000',
            border: 'none',
          }}
          data-testid="button-enable-face-id"
        >
          {done ? (
            <>
              <Check className="mr-2 h-5 w-5" />
              {t('faceID.enabled', language)}
            </>
          ) : busy ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('faceID.enabling', language)}
            </>
          ) : (
            <>
              <Fingerprint className="mr-2 h-5 w-5" />
              {t('faceID.enableButton', language)}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
