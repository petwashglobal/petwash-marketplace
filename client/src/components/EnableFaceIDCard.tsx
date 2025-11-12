import { useState } from 'react';
import { registerPasskey } from '@/auth/passkey';
import { auth } from '@/lib/firebase';
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

  const handleEnableFaceID = async () => {
    setBusy(true);
    
    try {
      // Get fresh Firebase ID token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const idToken = await user.getIdToken(/* forceRefresh */ true);
      
      // Register passkey with Firebase ID token
      const result = await registerPasskey(idToken, userEmail);
      
      if (result.success) {
        setDone(true);
        
        toast({
          title: t('faceID.successTitle', language),
          description: t('faceID.successDescription', language),
        });
        
        if (onEnabled) {
          onEnabled();
        }
      } else {
        toast({
          variant: 'destructive',
          title: t('faceID.error', language),
          description: result.error || t('faceID.failedToEnable', language),
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('faceID.error', language),
        description: t('faceID.failedToEnable', language),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-black/40 to-black/20 border-gold/30 backdrop-blur-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-full bg-gold/20">
            <Fingerprint className="h-8 w-8 text-gold" />
          </div>
        </div>
        <CardTitle className="text-gold text-xl">
          {t('faceID.title', language)}
        </CardTitle>
        <CardDescription className="text-gray-300">
          {t('faceID.description', language)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleEnableFaceID}
          disabled={busy || done}
          className="w-full bg-gold hover:bg-gold/90 text-black font-semibold h-12 rounded-full transition-all"
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
  );
}
