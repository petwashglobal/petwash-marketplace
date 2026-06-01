import { useEffect, useRef, useState } from 'react';

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {}
) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsRevealed(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    // Safety net: iOS Safari can miss the initial IntersectionObserver
    // callback, which leaves content stuck at opacity-0 forever — faded
    // hero text and washed-out grey cards on the live homepage. Content
    // must NEVER stay hidden waiting on a JS observer. Reveal after a short
    // grace period regardless; the observer still drives the nicer scroll
    // timing whenever it fires normally.
    const fallback = window.setTimeout(() => setIsRevealed(true), 600);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isRevealed };
}

export function useMultipleScrollReveal(count: number, options: UseScrollRevealOptions = {}) {
  const refs = useRef<(HTMLDivElement | null)[]>(Array(count).fill(null));
  const [revealedStates, setRevealedStates] = useState<boolean[]>(Array(count).fill(false));
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', triggerOnce = true } = options;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealedStates(Array(count).fill(true));
      return;
    }

    const observers: IntersectionObserver[] = [];

    refs.current.forEach((element, index) => {
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setRevealedStates(prev => {
              const newState = [...prev];
              newState[index] = true;
              return newState;
            });
            if (triggerOnce) {
              observer.unobserve(element);
            }
          }
        },
        { threshold, rootMargin }
      );

      observer.observe(element);
      observers.push(observer);
    });

    // Same safety net as useScrollReveal: never leave items stuck at
    // opacity-0 if iOS Safari's observers miss their initial callback.
    const fallback = window.setTimeout(() => setRevealedStates(Array(count).fill(true)), 600);

    return () => {
      observers.forEach(o => o.disconnect());
      window.clearTimeout(fallback);
    };
  }, [count, threshold, rootMargin, triggerOnce]);

  const setRef = (index: number) => (el: HTMLDivElement | null) => {
    refs.current[index] = el;
  };

  return { setRef, revealedStates };
}
