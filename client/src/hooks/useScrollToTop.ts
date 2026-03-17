import { useEffect } from 'react';
import { useLocation } from 'wouter';

if (window.history.scrollRestoration) {
  window.history.scrollRestoration = 'manual';
}

export const useScrollToTop = () => {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' } as any);
  }, [location]);
};