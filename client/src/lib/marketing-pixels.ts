// Marketing pixels and tracking initialization
// Google Tag Manager, Facebook Pixel, TikTok Pixel, Microsoft Clarity

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
    ttq: {
      track: (event: string, data?: any) => void;
      page: () => void;
      identify: (data: any) => void;
      load: (pixelId: string) => void;
    };
    clarity: (...args: any[]) => void;
    _hsq: any[];
  }
}

/**
 * Initialize Google Tag Manager
 * Centralized tag management for all marketing pixels
 */
export function initGoogleTagManager(containerId: string = 'GTM-XXXXXXX') {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  
  // GTM data layer
  window.dataLayer = window.dataLayer || [];
  
  // GTM script
  const script = document.createElement('script');
  script.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${containerId}');
  `;
  document.head.appendChild(script);
  
  // GTM noscript iframe
  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);
  
  console.log('[Marketing] Google Tag Manager initialized');
}

/**
 * Initialize Facebook Pixel
 * Track conversions for Facebook/Instagram ads
 */
export function initFacebookPixel(pixelId: string = '123456789') {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  
  window.fbq = window.fbq || function() {
    (window.fbq.q = window.fbq.q || []).push(arguments);
  };
  
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
  
  console.log('[Marketing] Facebook Pixel initialized');
}

/**
 * Initialize TikTok Pixel
 * Track conversions for TikTok ads
 */
export function initTikTokPixel(pixelId: string = 'XXXXXXXXX') {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  
  const script = document.createElement('script');
  script.innerHTML = `
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
      ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],
      ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
      for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
      ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},
      ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
      var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
      var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      ttq.load('${pixelId}');
      ttq.page();
    }(window, document, 'ttq');
  `;
  document.head.appendChild(script);
  
  console.log('[Marketing] TikTok Pixel initialized');
}

/**
 * Initialize Microsoft Clarity
 * Session recordings and heatmaps for UX optimization
 */
export function initMicrosoftClarity(projectId: string = 'XXXXXXXXX') {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.innerHTML = `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${projectId}");
  `;
  document.head.appendChild(script);
  
  console.log('[Marketing] Microsoft Clarity initialized');
}

/**
 * Track custom events across all pixels
 */
export function trackEvent(eventName: string, data?: any) {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  
  // Google Analytics (via dataLayer)
  if (window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...data,
    });
  }
  
  // Facebook Pixel
  if (window.fbq) {
    window.fbq('trackCustom', eventName, data);
  }
  
  // TikTok Pixel
  if (window.ttq) {
    window.ttq.track(eventName, data);
  }
  
  console.log('[Marketing] Event tracked:', eventName, data);
}

/**
 * Track standard e-commerce events
 */
export const trackPurchase = (transactionId: string, value: number, currency: string = 'ILS', items?: any[]) => {
  // Facebook Pixel
  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value,
      currency,
      content_ids: items?.map(i => i.id),
      content_type: 'product',
    });
  }
  
  // TikTok Pixel
  if (window.ttq) {
    window.ttq.track('CompletePayment', {
      value,
      currency,
      content_id: transactionId,
      content_type: 'product',
    });
  }
  
  // Google Analytics
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'purchase',
      transaction_id: transactionId,
      value,
      currency,
      items,
    });
  }
};

export const trackAddToCart = (itemName: string, value: number, currency: string = 'ILS') => {
  if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_name: itemName,
      value,
      currency,
    });
  }
  
  if (window.ttq) {
    window.ttq.track('AddToCart', {
      content_name: itemName,
      value,
      currency,
    });
  }
  
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'add_to_cart',
      value,
      currency,
      items: [{ item_name: itemName, price: value }],
    });
  }
};

export const trackLead = (email?: string) => {
  if (window.fbq) {
    window.fbq('track', 'Lead');
  }
  
  if (window.ttq) {
    window.ttq.track('SubmitForm');
  }
  
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'generate_lead',
      email,
    });
  }
};

export const trackSignUp = (method: string = 'email') => {
  if (window.fbq) {
    window.fbq('track', 'CompleteRegistration', {
      content_name: 'Pet Wash Account',
      status: 'completed',
    });
  }
  
  if (window.ttq) {
    window.ttq.track('CompleteRegistration', {
      content_name: 'Pet Wash Account',
    });
  }
  
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'sign_up',
      method,
    });
  }
};

/**
 * Initialize all marketing pixels (consent-aware)
 */
export function initAllMarketingPixels(consented: boolean = false) {
  if (!consented) {
    console.log('[Marketing] User has not consented to tracking. Pixels not loaded.');
    return;
  }
  
  // Note: Replace with your actual IDs
  // initGoogleTagManager('GTM-XXXXXXX');
  // initFacebookPixel('YOUR_PIXEL_ID');
  // initTikTokPixel('YOUR_PIXEL_ID');
  // initMicrosoftClarity('YOUR_PROJECT_ID');
  
  console.log('[Marketing] All pixels initialized (when IDs are configured)');
}
