/**
 * Universal Viewport Height Fix
 * 
 * Fixes viewport height issues on mobile devices (iOS/Android)
 * where 100vh doesn't account for browser chrome.
 * 
 * Updates CSS custom property --app-vh dynamically on:
 * - Window resize
 * - Orientation change
 * - Visual viewport changes (keyboard open/close)
 * 
 * Use in CSS as: height: calc(100 * var(--app-vh))
 */

let isInitialized = false;

export function initViewportFix() {
  // Prevent double initialization
  if (isInitialized) return;
  isInitialized = true;

  function updateViewportHeight() {
    // Calculate actual viewport height
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  }

  // Initial calculation
  updateViewportHeight();

  // Update on window resize
  window.addEventListener('resize', updateViewportHeight);

  // Update on orientation change
  window.addEventListener('orientationchange', () => {
    // Small delay to let browser settle after orientation change
    setTimeout(updateViewportHeight, 100);
  });

  // Update on visual viewport changes (mobile keyboard)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
  }

  // Cleanup function for SPA navigation
  return () => {
    window.removeEventListener('resize', updateViewportHeight);
    window.removeEventListener('orientationchange', updateViewportHeight);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', updateViewportHeight);
      window.visualViewport.removeEventListener('scroll', updateViewportHeight);
    }
    isInitialized = false;
  };
}

/**
 * React hook for viewport fix
 */
export function useViewportFix() {
  if (typeof window === 'undefined') return;
  
  // Initialize on mount
  const cleanup = initViewportFix();
  
  // Return cleanup for useEffect
  return cleanup;
}
