import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize a URL to only allow safe schemes, preventing XSS via javascript:,
 * data:, vbscript:, and other dangerous URI schemes.
 * Allows: absolute paths (/…), http://, https://, blob://
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Allow absolute paths only (no ./ or ../ to prevent path traversal)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  // Allow http and https
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Allow blob URLs (created by URL.createObjectURL)
  if (/^blob:/i.test(trimmed)) return trimmed;
  // Block everything else (javascript:, data:, vbscript:, //, etc.)
  return '';
}

// HubSpot form embedding utility
export function createHubSpotForm(targetId: string, formId?: string) {
  if (typeof window !== 'undefined' && window.hbspt) {
    window.hbspt.forms.create({
      region: "ap1",
      portalId: "46822710", // Your HubSpot Portal ID
      formId: formId || "9026e0ad-d0a2-43ad-9c81-67bb88e4b5b9", // Your HubSpot Form GUID
      target: `#${targetId}`
    });
  } else {
    // Retry after a delay if HubSpot hasn't loaded yet
    setTimeout(() => createHubSpotForm(targetId, formId), 500);
  }
}
