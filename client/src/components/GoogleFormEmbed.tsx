import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface GoogleFormEmbedProps {
  formType: string;
  language?: Language;
  className?: string;
  fallback?: React.ReactNode;
}

export function GoogleFormEmbed({ formType, language = 'he', className = '', fallback }: GoogleFormEmbedProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const { data: formConfig, isLoading, isError } = useQuery<{
    id: number;
    formType: string;
    formUrl: string;
    formTitle: string | null;
    formTitleHe: string | null;
    enabled: boolean;
    height: number | null;
  }>({
    queryKey: [`/api/google-forms/config/${formType}`],
    retry: false,
  });

  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  if (isError || !formConfig || !formConfig.enabled) {
    return <>{fallback}</>;
  }

  const embedUrl = formConfig.formUrl.includes('?') 
    ? `${formConfig.formUrl}&embedded=true` 
    : `${formConfig.formUrl}?embedded=true`;

  const title = language === 'he' 
    ? (formConfig.formTitleHe || formConfig.formTitle || '') 
    : (formConfig.formTitle || '');

  const formHeight = formConfig.height || 800;

  return (
    <div className={`google-form-embed ${className}`}>
      {title && (
        <h3 className="luxury-heading-md text-center mb-4">{title}</h3>
      )}
      
      <div className="relative rounded-2xl overflow-hidden luxury-glass-card luxury-shadow-lg">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto mb-3" />
              <p className="luxury-text-small text-gray-500">
                {language === 'he' ? 'טוען טופס...' : 'Loading form...'}
              </p>
            </div>
          </div>
        )}
        
        <iframe
          src={embedUrl}
          width="100%"
          height={formHeight}
          frameBorder="0"
          marginHeight={0}
          marginWidth={0}
          title={title || `Google Form - ${formType}`}
          onLoad={() => setIframeLoaded(true)}
          className="w-full border-0"
          style={{ minHeight: `${formHeight}px` }}
          allow="camera; microphone"
        />
      </div>

      <div className="text-center mt-4">
        <a
          href={formConfig.formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {language === 'he' ? 'פתח בחלון חדש' : 'Open in new window'}
        </a>
      </div>
    </div>
  );
}
