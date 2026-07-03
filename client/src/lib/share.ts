/**
 * share — one reusable "share to any channel" primitive.
 *
 * Before this, `navigator.share` was reimplemented ad-hoc on several pages
 * (BookingConfirmation, EGift, PaymentSuccess) and the referral page had no
 * native share at all — only hand-built WhatsApp/Email/SMS buttons. This gives
 * one call that opens the OS share sheet (which already covers WhatsApp,
 * Messages, Mail, AirDrop, "More", etc. — every installed app), and falls back
 * to clipboard copy where the Web Share API isn't available (older desktop).
 *
 * Web Share API works inside the Capacitor iOS/Android WebView, so no
 * @capacitor/share dependency is needed.
 */

export interface ShareContent {
  /** Sheet title (mostly used by mail/some targets). */
  title?: string;
  /** The message body. Include the URL here too for targets that ignore `url`. */
  text?: string;
  /** The link being shared. */
  url?: string;
}

export type ShareOutcome =
  | 'shared'      // native sheet completed
  | 'copied'      // no native sheet → link copied to clipboard
  | 'cancelled'   // user dismissed the native sheet (not an error)
  | 'unavailable'; // neither share nor clipboard worked

/** True when the OS-native share sheet is available (mobile / Capacitor WebView). */
export function canNativeShare(content: ShareContent = {}): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    // If the platform exposes canShare, respect it (e.g. files not supported).
    if (typeof (navigator as Navigator).canShare === 'function') {
      return (navigator as Navigator).canShare(content as ShareData);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the native share sheet with the given content; if unavailable, copy the
 * URL (or text) to the clipboard. Never throws — always resolves to an outcome
 * so the caller can show the right toast. A user-cancelled sheet resolves to
 * 'cancelled', not an error.
 */
export async function shareOrCopy(content: ShareContent): Promise<ShareOutcome> {
  const { title, text, url } = content;

  if (canNativeShare(content)) {
    try {
      await navigator.share({ title, text, url } as ShareData);
      return 'shared';
    } catch (err) {
      // AbortError = user tapped "cancel" on the sheet. Treat as a no-op, do NOT
      // fall through to clipboard (they didn't want to share).
      if (err && (err as DOMException).name === 'AbortError') return 'cancelled';
      // Any other failure → fall back to clipboard below.
    }
  }

  const toCopy = url || text || '';
  if (toCopy && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(toCopy);
      return 'copied';
    } catch {
      /* fall through */
    }
  }
  return 'unavailable';
}
