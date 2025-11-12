import { useEffect } from 'react';

/**
 * Live Chat Widget - Tawk.to Integration
 * 
 * Industry Standard Features:
 * - 24/7 customer support
 * - Multi-language (Hebrew, English, Arabic, etc.)
 * - Mobile responsive
 * - Agent mobile apps
 * - Free forever plan
 * 
 * Setup Instructions:
 * 1. Create account at https://www.tawk.to
 * 2. Get your Property ID and Widget ID
 * 3. Add to environment: VITE_TAWK_PROPERTY_ID and VITE_TAWK_WIDGET_ID
 * 4. Widget will auto-appear on all pages
 */

export function LiveChatWidget() {
  useEffect(() => {
    // Only load in browser (not SSR)
    if (typeof window === 'undefined') return;

    // Get Tawk.to credentials from environment
    const propertyId = import.meta.env.VITE_TAWK_PROPERTY_ID;
    const widgetId = import.meta.env.VITE_TAWK_WIDGET_ID;

    // If credentials not configured, don't load widget
    if (!propertyId || !widgetId) {
      console.info('[Live Chat] Tawk.to credentials not configured - chat widget disabled');
      return;
    }

    // Prevent duplicate script injection
    if ((window as any).Tawk_API) {
      console.info('[Live Chat] Tawk.to already loaded');
      return;
    }

    // Inject Tawk.to script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');

    // Configure Tawk.to before loading
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();

    // Customize widget based on current language
    const currentLang = localStorage.getItem('language') || 'en';
    const langMap: Record<string, string> = {
      en: 'en',
      he: 'he',
      ar: 'ar',
      ru: 'ru',
      fr: 'fr',
      es: 'es',
    };

    // Set widget language
    (window as any).Tawk_API.onLoad = function() {
      const tawkLang = langMap[currentLang] || 'en';
      (window as any).Tawk_API.setAttributes({
        language: tawkLang
      }, function(error: any) {
        if (error) {
          console.error('[Live Chat] Failed to set language:', error);
        }
      });

      console.info('[Live Chat] ✅ Tawk.to widget loaded successfully');
    };

    // Error handling
    script.onerror = () => {
      console.error('[Live Chat] Failed to load Tawk.to widget');
    };

    // Append script to document
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);

    // Cleanup on unmount
    return () => {
      // Tawk.to handles its own cleanup
      if ((window as any).Tawk_API?.hideWidget) {
        (window as any).Tawk_API.hideWidget();
      }
    };
  }, []);

  // This component doesn't render anything visible
  // Tawk.to injects its own floating chat button
  return null;
}
