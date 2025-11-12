import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
