/**
 * Comprehensive User Interaction Tracking System
 * Tracks all button clicks, form inputs, navigation, and user actions
 * Privacy-aware: skips passwords, credit cards, and sensitive data
 */

import { nanoid } from 'nanoid';

interface InteractionEvent {
  sessionId: string;
  timestamp: string;
  eventType: 'click' | 'input' | 'focus' | 'blur' | 'change' | 'navigation' | 'scroll';
  elementType: string;
  elementId?: string;
  elementTestId?: string;
  elementText?: string;
  elementName?: string;
  inputValue?: string;
  url: string;
  userAgent: string;
  screenResolution: string;
  language: string;
}

class InteractionTracker {
  private sessionId: string;
  private eventQueue: InteractionEvent[] = [];
  private batchSize = 20; // Send to server every 20 events
  private batchInterval = 10000; // Or every 10 seconds
  private isEnabled = true;
  private batchTimer?: number;

  // Privacy-sensitive input types to skip value tracking
  private sensitiveInputTypes = [
    'password',
    'credit-card-number',
    'cc-number',
    'cardnumber',
    'card-number',
    'cvv',
    'cvc',
    'security-code',
    'ssn',
    'social-security',
  ];

  constructor() {
    // Generate unique session ID
    this.sessionId = this.getOrCreateSessionId();
    
    // Initialize tracking
    this.initializeTracking();
    
    // Start batch timer
    this.startBatchTimer();
    
    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  private getOrCreateSessionId(): string {
    const existingSessionId = sessionStorage.getItem('petwash_session_id');
    if (existingSessionId) {
      return existingSessionId;
    }
    
    const newSessionId = nanoid();
    sessionStorage.setItem('petwash_session_id', newSessionId);
    return newSessionId;
  }

  private initializeTracking(): void {
    if (!this.isEnabled) return;

    // Track all clicks
    document.addEventListener('click', this.handleClick.bind(this), true);
    
    // Track all input changes
    document.addEventListener('input', this.handleInput.bind(this), true);
    
    // Track focus events
    document.addEventListener('focus', this.handleFocus.bind(this), true);
    
    // Track blur events
    document.addEventListener('blur', this.handleBlur.bind(this), true);
    
    // Track form changes
    document.addEventListener('change', this.handleChange.bind(this), true);
    
    // Track scroll events (throttled)
    let scrollTimeout: number | undefined;
    document.addEventListener('scroll', () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        this.trackEvent('scroll', {
          elementType: 'document',
          elementText: `Scrolled to Y: ${window.scrollY}px`,
        });
      }, 1000);
    }, true);
    
    // Track navigation
    this.trackNavigation();
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    
    this.trackEvent('click', {
      elementType: target.tagName.toLowerCase(),
      elementId: target.id,
      elementTestId: target.getAttribute('data-testid') || undefined,
      elementText: this.getElementText(target),
      elementName: target.getAttribute('name') || undefined,
    });
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    
    // Skip if sensitive input
    if (this.isSensitiveInput(target)) {
      this.trackEvent('input', {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id,
        elementTestId: target.getAttribute('data-testid') || undefined,
        elementName: target.name || undefined,
        inputValue: '[REDACTED - SENSITIVE]',
      });
      return;
    }
    
    this.trackEvent('input', {
      elementType: target.tagName.toLowerCase(),
      elementId: target.id,
      elementTestId: target.getAttribute('data-testid') || undefined,
      elementName: target.name || undefined,
      inputValue: target.value,
    });
  }

  private handleFocus(event: Event): void {
    const target = event.target as HTMLElement;
    
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      this.trackEvent('focus', {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id,
        elementTestId: target.getAttribute('data-testid') || undefined,
        elementName: target.getAttribute('name') || undefined,
      });
    }
  }

  private handleBlur(event: Event): void {
    const target = event.target as HTMLElement;
    
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      this.trackEvent('blur', {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id,
        elementTestId: target.getAttribute('data-testid') || undefined,
        elementName: target.getAttribute('name') || undefined,
      });
    }
  }

  private handleChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    
    // Skip if sensitive input
    if (this.isSensitiveInput(target)) {
      this.trackEvent('change', {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id,
        elementTestId: target.getAttribute('data-testid') || undefined,
        elementName: target.name || undefined,
        inputValue: '[REDACTED - SENSITIVE]',
      });
      return;
    }
    
    this.trackEvent('change', {
      elementType: target.tagName.toLowerCase(),
      elementId: target.id,
      elementTestId: target.getAttribute('data-testid') || undefined,
      elementName: target.name || undefined,
      inputValue: 'value' in target ? String(target.value) : undefined,
    });
  }

  private trackNavigation(): void {
    // Track initial page load
    this.trackEvent('navigation', {
      elementType: 'page',
      elementText: 'Page loaded',
    });
    
    // Track route changes (for SPAs)
    let lastPath = window.location.pathname;
    setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        this.trackEvent('navigation', {
          elementType: 'page',
          elementText: `Navigated to ${lastPath}`,
        });
      }
    }, 500);
  }

  private isSensitiveInput(element: HTMLElement): boolean {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      return false;
    }
    
    const type = element.type?.toLowerCase() || '';
    const name = element.name?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    const autocomplete = element.autocomplete?.toLowerCase() || '';
    
    // Check if input type is password
    if (type === 'password') return true;
    
    // Check for sensitive keywords in name, id, or autocomplete
    const combinedText = `${type} ${name} ${id} ${autocomplete}`;
    return this.sensitiveInputTypes.some(keyword => combinedText.includes(keyword));
  }

  private getElementText(element: HTMLElement): string | undefined {
    // For buttons, links, and labels
    if (element.tagName === 'BUTTON' || element.tagName === 'A' || element.tagName === 'LABEL') {
      return element.textContent?.trim().substring(0, 100) || undefined;
    }
    
    // For inputs with aria-label or placeholder
    if (element instanceof HTMLInputElement) {
      return element.getAttribute('aria-label') || element.placeholder || undefined;
    }
    
    return undefined;
  }

  private trackEvent(eventType: InteractionEvent['eventType'], data: Partial<InteractionEvent>): void {
    if (!this.isEnabled) return;

    const event: InteractionEvent = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      eventType,
      elementType: data.elementType || 'unknown',
      elementId: data.elementId,
      elementTestId: data.elementTestId,
      elementText: data.elementText,
      elementName: data.elementName,
      inputValue: data.inputValue,
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
    };

    this.eventQueue.push(event);

    // Send batch if queue is full
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  private startBatchTimer(): void {
    this.batchTimer = window.setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.batchInterval);
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ events: eventsToSend })], {
          type: 'application/json',
        });
        navigator.sendBeacon('/api/track/interactions', blob);
      } else {
        // Fallback to fetch
        await fetch('/api/track/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ events: eventsToSend }),
        });
      }
    } catch (error) {
      console.error('[Interaction Tracker] Failed to send events:', error);
      // Put events back in queue for retry
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    this.disable();
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flush();
  }
}

// Singleton instance
let trackerInstance: InteractionTracker | null = null;

export function initializeInteractionTracking(): void {
  if (trackerInstance) {
    console.warn('[Interaction Tracker] Already initialized');
    return;
  }
  
  trackerInstance = new InteractionTracker();
  console.log('[Interaction Tracker] Initialized successfully');
}

export function getTracker(): InteractionTracker | null {
  return trackerInstance;
}

export function disableTracking(): void {
  if (trackerInstance) {
    trackerInstance.disable();
  }
}

export function enableTracking(): void {
  if (trackerInstance) {
    trackerInstance.enable();
  }
}
