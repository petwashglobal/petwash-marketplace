import { useEffect } from 'react';

export function useKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC key - close modals, menus
      if (event.key === 'Escape') {
        // Find and close any open modal or menu
        const closeButtons = document.querySelectorAll('[aria-label*="close"], [aria-label*="סגור"]');
        const openMenus = document.querySelectorAll('[aria-expanded="true"]');
        
        if (closeButtons.length > 0) {
          (closeButtons[0] as HTMLElement).click();
        } else if (openMenus.length > 0) {
          (openMenus[0] as HTMLElement).click();
        }
      }
      
      // Tab navigation enhancement
      if (event.key === 'Tab') {
        // Add visual focus indicator
        document.body.classList.add('keyboard-navigation-active');
      }
      
      // Enter/Space for buttons and links
      if (event.key === 'Enter' || event.key === ' ') {
        const activeElement = document.activeElement as HTMLElement;
        
        if (activeElement && (
          activeElement.tagName === 'BUTTON' ||
          activeElement.role === 'button' ||
          activeElement.tagName === 'A'
        )) {
          event.preventDefault();
          activeElement.click();
        }
      }
      
      // Arrow key navigation for menus and lists
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const activeElement = document.activeElement as HTMLElement;
        const parent = activeElement?.closest('[role="menu"], [role="listbox"], [role="tablist"]');
        
        if (parent) {
          event.preventDefault();
          const focusableElements = parent.querySelectorAll('[tabindex="0"], button, a, input, select, textarea');
          const currentIndex = Array.from(focusableElements).indexOf(activeElement);
          
          let nextIndex = currentIndex;
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            nextIndex = (currentIndex + 1) % focusableElements.length;
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            nextIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
          }
          
          (focusableElements[nextIndex] as HTMLElement).focus();
        }
      }
    };
    
    const handleMouseDown = () => {
      document.body.classList.remove('keyboard-navigation-active');
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
}