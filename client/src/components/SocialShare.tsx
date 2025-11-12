// Social sharing buttons with UTM tracking
import { Facebook, Twitter, Linkedin, Link2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
  showLabels?: boolean;
}

export function SocialShare({ 
  url = window.location.href, 
  title = 'Pet Wash™ - Premium Organic Pet Care',
  description = 'Israel\'s leading premium organic pet washing service',
  showLabels = false 
}: SocialShareProps) {
  const { toast } = useToast();
  
  // Add UTM parameters for tracking
  const addUTM = (platform: string) => {
    const urlObj = new URL(url);
    urlObj.searchParams.set('utm_source', platform);
    urlObj.searchParams.set('utm_medium', 'social');
    urlObj.searchParams.set('utm_campaign', 'share');
    return urlObj.toString();
  };
  
  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(addUTM('facebook'))}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(addUTM('twitter'))}&text=${encodeURIComponent(title)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(addUTM('linkedin'))}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(title + ' ' + addUTM('whatsapp'))}`,
  };
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(addUTM('copy'));
      toast({
        title: 'קישור הועתק!',
        description: 'הקישור הועתק ללוח',
      });
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להעתיק את הקישור',
        variant: 'destructive',
      });
    }
  };
  
  const openShare = (shareUrl: string) => {
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };
  
  const ShareButton = ({ 
    icon: Icon, 
    label, 
    onClick, 
    color 
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void; 
    color: string;
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size={showLabels ? "default" : "icon"}
            onClick={onClick}
            className={`${color} border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform`}
            data-testid={`share-${label.toLowerCase()}`}
          >
            <Icon className="h-4 w-4" />
            {showLabels && <span className="mr-2">{label}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>שתף ב{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
  
  return (
    <div className="flex items-center gap-2" data-testid="social-share">
      <ShareButton
        icon={Facebook}
        label="Facebook"
        onClick={() => openShare(shareUrls.facebook)}
        color="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
      />
      <ShareButton
        icon={Twitter}
        label="Twitter"
        onClick={() => openShare(shareUrls.twitter)}
        color="text-sky-500 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950"
      />
      <ShareButton
        icon={Linkedin}
        label="LinkedIn"
        onClick={() => openShare(shareUrls.linkedin)}
        color="text-blue-700 hover:bg-blue-50 dark:text-blue-500 dark:hover:bg-blue-950"
      />
      <ShareButton
        icon={MessageCircle}
        label="WhatsApp"
        onClick={() => openShare(shareUrls.whatsapp)}
        color="text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
      />
      <ShareButton
        icon={Link2}
        label="העתק קישור"
        onClick={copyLink}
        color="text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
      />
    </div>
  );
}
