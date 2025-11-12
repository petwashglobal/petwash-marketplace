import { useEffect } from 'react';
import { useLocation } from 'wouter';

export const useScrollToTop = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Always scroll to top when location changes
    window.scrollTo(0, 0);
  }, [location]);
};