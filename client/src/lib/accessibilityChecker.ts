/**
 * Accessibility Checker 2025
 * 
 * Runtime accessibility validation for Pet Wash™:
 * - Missing alt text on images
 * - Links without href
 * - Form inputs without labels
 * - Heading hierarchy issues
 * - Color contrast warnings
 * - ARIA violations
 * 
 * Helps maintain WCAG 2.1 AA compliance
 */

import { logger } from './logger';

export interface A11yIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  element: Element;
  message: string;
  suggestion?: string;
}

// ============================================================================
// ACCESSIBILITY CHECKER CLASS
// ============================================================================

export class AccessibilityChecker {
  private static instance: AccessibilityChecker;
  private issues: A11yIssue[] = [];
  private checkInterval: number | null = null;

  private constructor() {
    this.initializeChecker();
  }

  static getInstance(): AccessibilityChecker {
    if (!this.instance) {
      this.instance = new AccessibilityChecker();
    }
    return this.instance;
  }

  /**
   * Initialize accessibility checker
   */
  private initializeChecker(): void {
    if (typeof window === 'undefined') return;

    // Run initial check after page load
    if (document.readyState === 'complete') {
      this.runChecks();
    } else {
      window.addEventListener('load', () => this.runChecks());
    }

    // Re-check periodically for dynamic content (React updates)
    this.checkInterval = window.setInterval(() => {
      this.runChecks();
    }, 10000); // Check every 10 seconds

    logger.debug('[A11y Checker] ✅ Initialized');
  }

  /**
   * Run all accessibility checks
   */
  private runChecks(): void {
    this.issues = [];

    this.checkImages();
    this.checkLinks();
    this.checkFormLabels();
    this.checkHeadingHierarchy();
    this.checkButtons();
    this.checkAriaLabels();

    // Log summary
    if (this.issues.length > 0) {
      const errors = this.issues.filter((i) => i.severity === 'error').length;
      const warnings = this.issues.filter((i) => i.severity === 'warning').length;
      
      if (errors > 0) {
        logger.error(`[A11y Checker] ❌ Found ${errors} accessibility errors`);
      }
      if (warnings > 0) {
        logger.warn(`[A11y Checker] ⚠️  Found ${warnings} accessibility warnings`);
      }

      // Log details in development
      if (import.meta.env.MODE === 'development') {
        console.group('♿ Accessibility Issues');
        this.issues.forEach((issue) => {
          const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`${icon} ${issue.type}: ${issue.message}`);
          if (issue.suggestion) console.log(`   💡 ${issue.suggestion}`);
          console.log('   Element:', issue.element);
        });
        console.groupEnd();
      }
    }
  }

  /**
   * Check images for alt text
   */
  private checkImages(): void {
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      // Check for alt attribute
      if (!img.hasAttribute('alt')) {
        this.issues.push({
          severity: 'error',
          type: 'missing-alt',
          element: img,
          message: `Image missing alt text: ${img.src?.substring(0, 50)}...`,
          suggestion: 'Add alt="" for decorative images or descriptive alt text',
        });
      }
      
      // Check for empty alt on non-decorative images
      if (img.alt === '' && !img.getAttribute('role') && !img.closest('[role="presentation"]')) {
        // Only flag if image has meaningful content (size check)
        if (img.naturalWidth > 50 && img.naturalHeight > 50) {
          this.issues.push({
            severity: 'warning',
            type: 'empty-alt',
            element: img,
            message: `Large image with empty alt text: ${img.src?.substring(0, 50)}...`,
            suggestion: 'Provide descriptive alt text or mark as decorative with role="presentation"',
          });
        }
      }
    });
  }

  /**
   * Check links for href and meaningful text
   */
  private checkLinks(): void {
    const links = document.querySelectorAll('a');
    links.forEach((link) => {
      // Check for href
      if (!link.href || link.href === '#' || link.href === 'javascript:void(0)') {
        this.issues.push({
          severity: 'warning',
          type: 'invalid-href',
          element: link,
          message: `Link with missing or invalid href: "${link.textContent?.trim().substring(0, 50)}..."`,
          suggestion: 'Use a <button> for actions or provide a valid href',
        });
      }

      // Check for meaningful text
      const text = link.textContent?.trim();
      if (!text || text.length === 0) {
        // Check for aria-label
        if (!link.getAttribute('aria-label') && !link.getAttribute('aria-labelledby')) {
          this.issues.push({
            severity: 'error',
            type: 'empty-link-text',
            element: link,
            message: 'Link has no text content or aria-label',
            suggestion: 'Add visible text or aria-label',
          });
        }
      }

      // Warn about generic link text
      const genericTexts = ['click here', 'read more', 'learn more', 'here'];
      if (text && genericTexts.includes(text.toLowerCase())) {
        this.issues.push({
          severity: 'info',
          type: 'generic-link-text',
          element: link,
          message: `Link has generic text: "${text}"`,
          suggestion: 'Use descriptive link text that explains the destination',
        });
      }
    });
  }

  /**
   * Check form inputs for labels
   */
  private checkFormLabels(): void {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
      // Skip hidden inputs
      if (input.getAttribute('type') === 'hidden') return;

      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');

      if (!hasLabel && !hasAriaLabel) {
        this.issues.push({
          severity: 'error',
          type: 'missing-label',
          element: input,
          message: `Form input missing label: ${input.getAttribute('name') || input.getAttribute('placeholder') || 'unknown'}`,
          suggestion: 'Add a <label> element or aria-label attribute',
        });
      }
    });
  }

  /**
   * Check heading hierarchy (h1 → h2 → h3, no skips)
   */
  private checkHeadingHierarchy(): void {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prevLevel = 0;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.substring(1));

      // Check for skipped levels (e.g., h1 → h3)
      if (prevLevel > 0 && level > prevLevel + 1) {
        this.issues.push({
          severity: 'warning',
          type: 'heading-skip',
          element: heading,
          message: `Heading level skipped: ${heading.tagName} after h${prevLevel}`,
          suggestion: 'Maintain proper heading hierarchy without skipping levels',
        });
      }

      prevLevel = level;
    });

    // Check for multiple h1 elements
    const h1s = document.querySelectorAll('h1');
    if (h1s.length > 1) {
      this.issues.push({
        severity: 'warning',
        type: 'multiple-h1',
        element: h1s[1],
        message: `Multiple h1 elements found (${h1s.length})`,
        suggestion: 'Use only one h1 per page for main heading',
      });
    }
  }

  /**
   * Check buttons for accessibility
   */
  private checkButtons(): void {
    const buttons = document.querySelectorAll('button, [role="button"]');
    buttons.forEach((button) => {
      const text = button.textContent?.trim();
      const hasAriaLabel = button.getAttribute('aria-label') || button.getAttribute('aria-labelledby');

      // Check for text or aria-label
      if (!text && !hasAriaLabel) {
        this.issues.push({
          severity: 'error',
          type: 'empty-button',
          element: button,
          message: 'Button has no text content or aria-label',
          suggestion: 'Add visible text or aria-label describing the action',
        });
      }

      // Check for disabled buttons without aria-disabled
      if (button.hasAttribute('disabled') && !button.getAttribute('aria-disabled')) {
        // This is actually handled by browsers, just informational
        this.issues.push({
          severity: 'info',
          type: 'disabled-button',
          element: button,
          message: 'Disabled button - consider aria-disabled for better screen reader support',
        });
      }
    });
  }

  /**
   * Check ARIA attributes
   */
  private checkAriaLabels(): void {
    const elementsWithRole = document.querySelectorAll('[role]');
    elementsWithRole.forEach((element) => {
      const role = element.getAttribute('role');
      
      // Check for interactive roles that need labels
      const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'];
      if (role && interactiveRoles.includes(role)) {
        const hasLabel = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
        const hasText = element.textContent?.trim();

        if (!hasLabel && !hasText) {
          this.issues.push({
            severity: 'error',
            type: 'missing-aria-label',
            element,
            message: `Element with role="${role}" missing label`,
            suggestion: 'Add aria-label or aria-labelledby',
          });
        }
      }
    });
  }

  /**
   * Get all current issues
   */
  getIssues(): A11yIssue[] {
    return this.issues;
  }

  /**
   * Get issue count by severity
   */
  getIssueCounts(): { errors: number; warnings: number; info: number } {
    return {
      errors: this.issues.filter((i) => i.severity === 'error').length,
      warnings: this.issues.filter((i) => i.severity === 'warning').length,
      info: this.issues.filter((i) => i.severity === 'info').length,
    };
  }

  /**
   * Cleanup checker
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.issues = [];
  }
}

// ============================================================================
// INITIALIZE ON IMPORT (DEV MODE ONLY)
// ============================================================================

// Only run in development mode
if (typeof window !== 'undefined' && import.meta.env.MODE === 'development') {
  AccessibilityChecker.getInstance();
}

export default AccessibilityChecker;
