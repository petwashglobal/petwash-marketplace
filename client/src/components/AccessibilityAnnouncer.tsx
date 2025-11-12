import { useEffect, useRef } from 'react';

interface AccessibilityAnnouncerProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearAfter?: number;
}

export function AccessibilityAnnouncer({ 
  message, 
  priority = 'polite', 
  clearAfter = 3000 
}: AccessibilityAnnouncerProps) {
  const announceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && announceRef.current) {
      announceRef.current.textContent = message;
      
      if (clearAfter > 0) {
        const timer = setTimeout(() => {
          if (announceRef.current) {
            announceRef.current.textContent = '';
          }
        }, clearAfter);
        
        return () => clearTimeout(timer);
      }
    }
  }, [message, clearAfter]);

  return (
    <div
      ref={announceRef}
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      role="status"
    />
  );
}

// Hook for accessibility announcements
export function useAccessibilityAnnouncer() {
  const announceRef = useRef<HTMLDivElement | null>(null);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceRef.current) {
      announceRef.current = document.createElement('div');
      announceRef.current.setAttribute('aria-live', priority);
      announceRef.current.setAttribute('aria-atomic', 'true');
      announceRef.current.setAttribute('role', 'status');
      announceRef.current.className = 'sr-only';
      document.body.appendChild(announceRef.current);
    }

    announceRef.current.textContent = message;
    
    setTimeout(() => {
      if (announceRef.current) {
        announceRef.current.textContent = '';
      }
    }, 3000);
  };

  return { announce };
}