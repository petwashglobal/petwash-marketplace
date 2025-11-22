/**
 * FILE: src/features/legal/LegalFrontend2025.tsx
 *
 * Pet Wash Ltd - Legal & Compliance Frontend 2025
 * =================================================
 * This file contains:
 *
 * 1. Types that mirror the backend legal models
 * 2. A tiny client for the legal APIs:
 *    - GET  /api/legal/:docKey
 *    - POST /api/consents
 *    - POST /api/privacy/requests
 * 3. React components:
 *    - <LegalIndexPage />        - directory of all legal documents
 *    - <LegalDocumentView />     - generic renderer for a legal document
 *    - <LegalShellLayout />      - simple layout wrapper for legal pages
 *    - <CookieBanner2025 />      - cookie consent banner with Amendment 13 logic
 *    - <PrivacyCenter2025 />     - privacy requests center (access, delete, rectify)
 *    - <MarketingConsentToggle />- reusable marketing consent checkbox
 *
 * 4. Registration helper:
 *    - registerLegalFrontendRoutesLikeThis (examples only, no router dependency)
 *
 * NOTES FOR DEVELOPER:
 *  - This file is intentionally "giant" so Nir can send it as one block.
 *  - You are expected to:
 *      * Split into smaller files later if needed
 *      * Wire routes into Next.js / React Router / your current system
 *      * Replace styling with your 7 star luxury components (shadcn, design system)
 *  - All network calls assume backend from petwash_global_legal_and_compliance_2025.ts
 *
 * LEGAL NOTE:
 *  - Text content is a technical base only.
 *  - Final Hebrew legal wording must be reviewed by a licensed Israeli lawyer
 *    for: terms, privacy, cookies, cancellation, marketing, subcontractors.
 */

import React, { useEffect, useState } from "react";

/* =========================================================
 * 1. TYPES - mirrors backend structures (simplified)
 * =======================================================*/

export type LegalDocumentKey =
  | "terms_of_use"
  | "privacy_policy"
  | "cookies_policy"
  | "cancellation_policy"
  | "payment_security_policy"
  | "marketing_consent_policy"
  | "accessibility_statement";

export interface LegalSection {
  id: string;
  title: string;
  body: string[];
}

export interface LegalDocumentResponse {
  ok: boolean;
  data?: {
    key: string;
    version: string;
    language: "he" | "en";
    title: string;
    updatedAt: string;
    summary?: string;
    sections?: LegalSection[];
    // cookie policy may include categories
    categories?: {
      id: string;
      title: string;
      description: string;
      required: boolean;
    }[];
  };
  error?: string;
}

export type ConsentType = "cookies" | "marketing";

export interface ConsentRecord {
  id: string;
  userId?: string;
  channel: "web" | "mobile_app" | "call_center" | "other";
  type: ConsentType;
  granted: boolean;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string;
  userAgent?: string;
  data?: Record<string, any>;
}

export type PrivacyRequestType = "access" | "delete" | "rectify";

export interface PrivacyRequestRecord {
  id: string;
  userId?: string;
  requestType: PrivacyRequestType;
  status: "received" | "in_review" | "completed" | "rejected";
  createdAt: string;
  updatedAt: string;
  email: string;
  details?: string;
}

/* =========================================================
 * 2. SMALL CLIENT HELPERS FOR LEGAL API
 * =======================================================*/

/**
 * Helper: build base URL for API calls.
 * Adjust if you have a different prefix (for example /v1 or /api/app)
 */
function legalApiBase(path: string): string {
  return path.startsWith("/")
    ? path
    : `/api/${path.replace(/^api\//, "")}`;
}

/**
 * GET /api/legal/:docKey
 */
async function fetchLegalDocument(
  docKey: LegalDocumentKey
): Promise<LegalDocumentResponse> {
  const res = await fetch(legalApiBase(`legal/${docKey}`), {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }

  return res.json();
}

/**
 * POST /api/consents
 * Used for cookies banner and marketing consent.
 */
async function postConsent(input: {
  userId?: string;
  channel: ConsentRecord["channel"];
  type: ConsentType;
  granted: boolean;
  data?: Record<string, any>;
}): Promise<{ ok: boolean; data?: ConsentRecord; error?: string }> {
  const res = await fetch(legalApiBase("consents"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    let error = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) error = j.error;
    } catch {
      // ignore
    }
    return { ok: false, error };
  }

  const json = await res.json();
  return json;
}

/**
 * POST /api/privacy/requests
 * Used by Privacy Center (access/delete/rectify).
 */
async function postPrivacyRequest(input: {
  userId?: string;
  requestType: PrivacyRequestType;
  email: string;
  details?: string;
}): Promise<{ ok: boolean; data?: { requestId: string; status: string; createdAt: string }; error?: string }> {
  const res = await fetch(legalApiBase("privacy/requests"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    let error = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) error = j.error;
    } catch {
      // ignore
    }
    return { ok: false, error };
  }

  const json = await res.json();
  return json;
}

/* =========================================================
 * 3. CONSISTENT STYLING HELPERS (basic only)
 *    Developer should replace with 7 star components.
 * =======================================================*/

const basePageClass =
  "min-h-screen bg-white text-slate-900 flex flex-col items-center px-4 py-8";
const baseCardClass =
  "w-full max-w-4xl border border-slate-200 rounded-2xl shadow-sm bg-white/80 backdrop-blur-sm p-6 md:p-8";
const headingClass =
  "text-2xl md:text-3xl font-semibold tracking-tight mb-4 text-slate-900";
const sectionHeadingClass =
  "text-lg md:text-xl font-semibold mb-2 mt-6 text-slate-900";
const paragraphClass = "text-sm md:text-base leading-relaxed text-slate-700";

/* =========================================================
 * 4. LEGAL LAYOUT WRAPPER
 * =======================================================*/

export const LegalShellLayout: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  return (
    <div className={basePageClass}>
      <div className="w-full max-w-5xl mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
      </div>
      <div className={baseCardClass}>{children}</div>
    </div>
  );
};

/* =========================================================
 * 5. LEGAL INDEX PAGE - /legal
 * =======================================================*/

/**
 * Config array for the legal directory.
 * Update labels and paths if your router uses other slugs.
 */
const LEGAL_LINKS: {
  key: LegalDocumentKey;
  labelHe: string;
  path: string;
  shortDescription: string;
}[] = [
  {
    key: "terms_of_use",
    labelHe: "תנאי שימוש",
    path: "/legal/terms",
    shortDescription: "הסכם השימוש בפלטפורמות Pet Wash™.",
  },
  {
    key: "privacy_policy",
    labelHe: "מדיניות פרטיות",
    path: "/legal/privacy",
    shortDescription:
      "הסבר מלא על איסוף, שימוש ושמירת מידע אישי, כולל התאמה לתיקון 13.",
  },
  {
    key: "cookies_policy",
    labelHe: "מדיניות עוגיות",
    path: "/legal/cookies",
    shortDescription: "איך ומתי נעשה שימוש בקובצי עוגיות וטכנולוגיות מעקב.",
  },
  {
    key: "cancellation_policy",
    labelHe: "מדיניות ביטולים והחזרים",
    path: "/legal/cancellation",
    shortDescription: "הסבר תנאי ביטול והחזר עבור שירותי Pet Wash™.",
  },
  {
    key: "payment_security_policy",
    labelHe: "מדיניות אבטחת תשלומים",
    path: "/legal/payments-security",
    shortDescription:
      "כיצד מאובטחים התשלומים באמצעות ספקי סליקה מורשים.",
  },
  {
    key: "marketing_consent_policy",
    labelHe: "מדיניות שיווק ודיוור",
    path: "/legal/marketing-consent",
    shortDescription:
      "הסכמות לדיוור שיווקי לפי חוק התקשורת (חוק הספאם).",
  },
  {
    key: "accessibility_statement",
    labelHe: "הצהרת נגישות",
    path: "/legal/accessibility",
    shortDescription:
      "מחויבות Pet Wash™ להנגשת השירותים הדיגיטליים והפיזיים.",
  },
];

export const LegalIndexPage: React.FC = () => {
  return (
    <LegalShellLayout title="מסמכים משפטיים ותאימות 2025">
      <p className={paragraphClass + " mb-6"}>
        כאן תמצאו את כל המסמכים המשפטיים והמסמכים בתחום הגנת הפרטיות והתאימות של
        Pet Wash™ בעמ. מומלץ לקרוא בעיון לפני שימוש בשירותים.
      </p>
      <div className="space-y-4">
        {LEGAL_LINKS.map((link) => (
          <a
            key={link.key}
            href={link.path}
            className="block rounded-xl border border-slate-200 hover:border-slate-400 transition-shadow hover:shadow-md p-4"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">
                  {link.labelHe}
                </div>
                <div className="text-xs md:text-sm text-slate-600 mt-1">
                  {link.shortDescription}
                </div>
              </div>
              <div className="text-xs md:text-sm text-slate-500">
                לחץ לקריאה
              </div>
            </div>
          </a>
        ))}
      </div>
    </LegalShellLayout>
  );
};

/* =========================================================
 * 6. GENERIC DOCUMENT VIEW - used for each /legal/* page
 * =======================================================*/

interface LegalDocumentViewProps {
  docKey: LegalDocumentKey;
  pageTitle: string;
}

/**
 * This component:
 *  - Calls GET /api/legal/:docKey
 *  - Shows loading, error, or the legal sections
 *  - Used by: Terms, Privacy, Cookies, Cancellation etc
 */
export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({
  docKey,
  pageTitle,
}) => {
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    document?: LegalDocumentResponse["data"];
  }>({
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    fetchLegalDocument(docKey)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setState({
            loading: false,
            error: res.error || "מסמך לא נמצא",
          });
        } else {
          setState({
            loading: false,
            document: res.data,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: "שגיאת רשת, נסו שוב מאוחר יותר",
        });
        console.error("fetchLegalDocument error", err);
      });

    return () => {
      cancelled = true;
    };
  }, [docKey]);

  return (
    <LegalShellLayout title={pageTitle}>
      {state.loading && (
        <div className="text-sm text-slate-600">טוען מסמך משפטי...</div>
      )}

      {!state.loading && state.error && (
        <div className="text-sm text-red-600">{state.error}</div>
      )}

      {!state.loading && state.document && (
        <article dir={state.document.language === "he" ? "rtl" : "ltr"}>
          <header className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {state.document.title}
            </h2>
            <div className="text-xs text-slate-500">
              גרסה {state.document.version} · עודכן ב{" "}
              {new Date(state.document.updatedAt).toLocaleDateString("he-IL")}
            </div>
            {state.document.summary && (
              <p className={paragraphClass + " mt-3"}>
                {state.document.summary}
              </p>
            )}
          </header>

          {state.document.sections && state.document.sections.length > 0 && (
            <div>
              {state.document.sections.map((section) => (
                <section key={section.id}>
                  <h3 className={sectionHeadingClass}>{section.title}</h3>
                  {section.body.map((line, idx) => (
                    <p key={idx} className={paragraphClass + " mb-2"}>
                      {line}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          )}

          {/* For cookies policy we may want to show categories table */}
          {docKey === "cookies_policy" &&
            state.document.categories &&
            state.document.categories.length > 0 && (
              <section className="mt-6">
                <h3 className={sectionHeadingClass}>קטגוריות עוגיות</h3>
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2 border-b border-slate-200">
                          קטגוריה
                        </th>
                        <th className="p-2 border-b border-slate-200">
                          תיאור
                        </th>
                        <th className="p-2 border-b border-slate-200">
                          חובה
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.document.categories.map((cat) => (
                        <tr key={cat.id}>
                          <td className="p-2 border-b border-slate-100 font-medium">
                            {cat.title}
                          </td>
                          <td className="p-2 border-b border-slate-100 text-slate-700">
                            {cat.description}
                          </td>
                          <td className="p-2 border-b border-slate-100 text-slate-700">
                            {cat.required ? "כן" : "לא"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
        </article>
      )}
    </LegalShellLayout>
  );
};

/* =========================================================
 * 7. COOKIE BANNER 2025
 * =======================================================*/

type CookieCategoryId = "necessary" | "functional" | "analytics" | "marketing";

interface CookiePolicyCategory {
  id: CookieCategoryId | string;
  title: string;
  description: string;
  required: boolean;
}

interface CookieBannerState {
  loading: boolean;
  policyCategories: CookiePolicyCategory[];
  error?: string;
}

const COOKIE_STORAGE_KEY = "petwash_cookie_consent_v1";

/**
 * CookieBanner2025
 *
 * - Fetches cookie policy from /api/legal/cookies_policy
 * - Shows a modern banner at the bottom of the screen
 * - Stores user choices in localStorage
 * - Sends consent record to POST /api/consents
 *
 * Dev notes:
 *  - Place this high in your app tree:
 *      <AppShell>
 *        <CookieBanner2025 currentUserId={...} />
 *        <Routes />
 *      </AppShell>
 */
export const CookieBanner2025: React.FC<{ currentUserId?: string }> = ({
  currentUserId,
}) => {
  const [state, setState] = useState<CookieBannerState>({
    loading: true,
    policyCategories: [],
  });
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // On mount: check if we already have stored consent
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_STORAGE_KEY);
      if (stored) {
        // Already accepted or configured
        setVisible(false);
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
    } catch {
      // if storage fails, we still show banner
    }

    let cancelled = false;
    fetchLegalDocument("cookies_policy")
      .then((res) => {
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setState({
            loading: false,
            policyCategories: [],
            error: res.error || "Cookie policy not available",
          });
          setVisible(true);
          return;
        }

        const categories: CookiePolicyCategory[] = res.data.categories ?? [];
        const initialSelected: Record<string, boolean> = {};
        categories.forEach((cat) => {
          if (cat.required) {
            initialSelected[cat.id] = true;
          } else {
            initialSelected[cat.id] = false;
          }
        });

        setState({
          loading: false,
          policyCategories: categories,
        });
        setSelected(initialSelected);
        setVisible(true);
      })
      .catch((err) => {
        console.error("CookieBanner fetch error", err);
        if (cancelled) return;
        setState({
          loading: false,
          policyCategories: [],
          error: "לא ניתן לטעון מדיניות עוגיות",
        });
        setVisible(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) {
    return null;
  }

  const handleToggle = (id: string) => {
    const category = state.policyCategories.find((c) => c.id === id);
    if (!category) return;
    if (category.required) {
      // required cannot be unchecked
      return;
    }
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const persistAndClose = async (mode: "accept_all" | "reject_non_essential" | "custom") => {
    try {
      const categories = state.policyCategories;
      const finalSelection: Record<string, boolean> = {};

      if (mode === "accept_all") {
        categories.forEach((cat) => {
          finalSelection[cat.id] = true;
        });
      } else if (mode === "reject_non_essential") {
        categories.forEach((cat) => {
          finalSelection[cat.id] = cat.required;
        });
      } else {
        // custom
        categories.forEach((cat) => {
          if (cat.required) {
            finalSelection[cat.id] = true;
          } else {
            finalSelection[cat.id] = !!selected[cat.id];
          }
        });
      }

      // store locally
      const payloadForStorage = {
        version: "2025.01",
        decidedAt: new Date().toISOString(),
        categories: finalSelection,
      };
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(payloadForStorage));

      // send consent to backend
      await postConsent({
        userId: currentUserId,
        channel: "web",
        type: "cookies",
        granted: true,
        data: {
          categories: finalSelection,
        },
      });
    } catch (err) {
      console.error("CookieBanner persistAndClose error", err);
    } finally {
      setVisible(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-2 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md p-4 md:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 mb-1">
                Pet Wash™ - עוגיות וטכנולוגיות מעקב
              </div>
              <p className="text-xs md:text-sm text-slate-700">
                אנו משתמשים בעוגיות לצורך תפעול תקין, אבטחה, אנליטיקה ושיווק,
                בהתאם לתיקון 13 לחוק הגנת הפרטיות. אפשר לבחור אילו קטגוריות לאשר.
              </p>
              {state.error && (
                <p className="text-xs text-red-600 mt-1">{state.error}</p>
              )}
            </div>
            <div className="flex flex-row md:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => persistAndClose("reject_non_essential")}
                className="px-3 py-1.5 text-xs md:text-sm border border-slate-400 rounded-full bg-white text-slate-800 hover:bg-slate-50 transition"
              >
                רק מה שחובה
              </button>
              <button
                type="button"
                onClick={() => persistAndClose("accept_all")}
                className="px-3 py-1.5 text-xs md:text-sm rounded-full bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                מאשר הכל
              </button>
            </div>
          </div>

          {/* Categories toggles */}
          {!state.loading && state.policyCategories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              {state.policyCategories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selected[cat.id] || cat.required}
                    disabled={cat.required}
                    onChange={() => handleToggle(cat.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-900">
                      {cat.title}{" "}
                      {cat.required && (
                        <span className="text-[10px] text-slate-500">
                          (חובה)
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-700">
                      {cat.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => persistAndClose("custom")}
              className="px-3 py-1.5 text-xs md:text-sm rounded-full border border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              שמירה והמשך
            </button>
            <a
              href="/legal/cookies"
              className="px-3 py-1.5 text-xs md:text-sm text-slate-600 hover:text-slate-900"
            >
              למד עוד
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
 * 8. PRIVACY CENTER 2025
 * =======================================================*/

interface PrivacyCenterProps {
  currentUserId?: string;
  defaultEmail?: string;
}

/**
 * PrivacyCenter2025
 *
 * - Simple form that allows:
 *   * Access request
 *   * Delete request
 *   * Rectify request
 * - Sends POST /api/privacy/requests
 * - Use on page: /privacy-center or embedded in account settings
 */
export const PrivacyCenter2025: React.FC<PrivacyCenterProps> = ({
  currentUserId,
  defaultEmail,
}) => {
  const [email, setEmail] = useState(defaultEmail || "");
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerMessage({ type: null, text: "" });

    if (!email.trim()) {
      setServerMessage({
        type: "error",
        text: "אנא הזינו כתובת דוא\"ל.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await postPrivacyRequest({
        userId: currentUserId,
        requestType,
        email,
        details,
      });

      if (!res.ok) {
        setServerMessage({
          type: "error",
          text: res.error || "שגיאה בשליחת הבקשה.",
        });
      } else {
        setServerMessage({
          type: "success",
          text: "הבקשה התקבלה. צוות הפרטיות שלנו יחזור אליך בהתאם להוראות החוק.",
        });
        setDetails("");
      }
    } catch (err) {
      console.error("PrivacyCenter submit error", err);
      setServerMessage({
        type: "error",
        text: "שגיאת רשת. נסו שוב מאוחר יותר.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalShellLayout title="מרכז פרטיות - Pet Wash™ 2025">
      <p className={paragraphClass + " mb-4"}>
        בהתאם לחוק הגנת הפרטיות ותיקון 13, ניתן לפנות אלינו בבקשה לעיון במידע,
        תיקון או מחיקה. מלאו את הטופס, ואנו נטפל בבקשה בהתאם לדין.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 max-w-xl"
        aria-label="טופס בקשת פרטיות"
      >
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-900">
            סוג הבקשה
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as PrivacyRequestType)}
          >
            <option value="access">בקשת עיון במידע</option>
            <option value="delete">בקשת מחיקת מידע</option>
            <option value="rectify">בקשת תיקון מידע</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-900">
            כתובת דוא"ל
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
            placeholder="you@example.com"
          />
          <p className="text-xs text-slate-500 mt-1">
            נשתמש בכתובת זו בכדי לאמת את זהותך ולהשיב לבקשה.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-900">
            פרטי הבקשה (אופציונלי)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
            placeholder="ציינו מספר הזמנה, תאריכים או פרטים שיעזרו לנו לזהות את המידע."
          />
        </div>

        {serverMessage.type && (
          <div
            className={
              "text-sm mt-1 " +
              (serverMessage.type === "success"
                ? "text-emerald-600"
                : "text-red-600")
            }
          >
            {serverMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-full bg-slate-900 text-white text-sm px-4 py-2 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "שולח בקשה..." : "שליחת בקשה"}
        </button>
      </form>
    </LegalShellLayout>
  );
};

/* =========================================================
 * 9. MARKETING CONSENT TOGGLE - reusable component
 * =======================================================*/

interface MarketingConsentToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Small reusable checkbox you can drop into registration and booking forms.
 * For example in sign up form:
 *
 *   const [marketingConsent, setMarketingConsent] = useState(false);
 *   <MarketingConsentToggle
 *      checked={marketingConsent}
 *      onChange={setMarketingConsent}
 *   />
 *
 * On submit:
 *   if (marketingConsent) {
 *     await postConsent({
 *       userId: currentUser.id,
 *       channel: "web",
 *       type: "marketing",
 *       granted: true,
 *       data: { source: "signup_form" },
 *     });
 *   }
 */
export const MarketingConsentToggle: React.FC<MarketingConsentToggleProps> = ({
  checked,
  onChange,
}) => {
  return (
    <label className="mt-3 flex items-start gap-2 text-xs md:text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
      />
      <span>
        אני מאשר/ת קבלת דיוור שיווקי והטבות מ־Pet Wash™ בדואר אלקטרוני או SMS,
        בהתאם למדיניות השיווק ולחוק התקשורת. ניתן להסיר הרשמה בכל עת.
      </span>
    </label>
  );
};

/* =========================================================
 * 10. ROUTING INTEGRATION HINTS
 * =======================================================*/

/**
 * The file is router agnostic.
 * Here are examples of how to wire into different systems.
 *
 * 1) React Router 6 example:
 *
 * import { BrowserRouter, Routes, Route } from "react-router-dom";
 * import {
 *   LegalIndexPage,
 *   LegalDocumentView,
 *   PrivacyCenter2025,
 *   CookieBanner2025,
 * } from "./LegalFrontend2025";
 *
 * function App() {
 *   return (
 *     <BrowserRouter>
 *       <CookieBanner2025 currentUserId={currentUser?.id} />
 *       <Routes>
 *         <Route path="/legal" element={<LegalIndexPage />} />
 *         <Route
 *           path="/legal/terms"
 *           element={
 *             <LegalDocumentView
 *               docKey="terms_of_use"
 *               pageTitle="תנאי שימוש"
 *             />
 *           }
 *         />
 *         <Route
 *           path="/legal/privacy"
 *           element={
 *             <LegalDocumentView
 *               docKey="privacy_policy"
 *               pageTitle="מדיניות פרטיות"
 *             />
 *           }
 *         />
 *         <Route
 *           path="/legal/cookies"
 *           element={
 *             <LegalDocumentView
 *               docKey="cookies_policy"
 *               pageTitle="מדיניות עוגיות"
 *             />
 *           }
 *         />
 *         <Route
 *           path="/legal/cancellation"
 *           element={
 *             <LegalDocumentView
 *               docKey="cancellation_policy"
 *               pageTitle="מדיניות ביטולים והחזרים"
 *             />
 *           }
 *         />
 *         <Route
 *           path="/legal/payments-security"
 *           element={
 *             <LegalDocumentView
 *               docKey="payment_security_policy"
 *               pageTitle="מדיניות אבטחת תשלומים"
 *             />
 *           }
 *         />
 *         <Route
 *           path="/legal/marketing-consent"
 *           element={
 *             <LegalDocumentView
 *               docKey="marketing_consent_policy"
 *               pageTitle="מדיניות שיווק ודיוור"
 *             />
 *           }
 *         />
 *         <Route
 *           path="/legal/accessibility"
 *           element={
 *             <LegalDocumentView
 *               docKey="accessibility_statement"
 *               pageTitle="הצהרת נגישות"
 *             />
 *           }
 *         />
 *
 *         <Route
 *           path="/privacy-center"
 *           element={
 *             <PrivacyCenter2025
 *               currentUserId={currentUser?.id}
 *               defaultEmail={currentUser?.email}
 *             />
 *           }
 *         />
 *       </Routes>
 *     </BrowserRouter>
 *   );
 * }
 *
 * 2) Next.js (App Router) example:
 *
 * - Create files:
 *   app/legal/page.tsx               -> <LegalIndexPage />
 *   app/legal/terms/page.tsx        -> <LegalDocumentView docKey="terms_of_use" ... />
 *   app/legal/privacy/page.tsx      -> ...
 *   app/privacy-center/page.tsx     -> <PrivacyCenter2025 />
 * - Add <CookieBanner2025 /> in your root layout.tsx so it is global.
 *
 * 3) Your custom router:
 * - Map each path to the matching component as shown above.
 *
 * This keeps everything central and your developer only needs to wire once.
 */

/* =========================================================
 * 11. EXPORT EVERYTHING
 * =======================================================*/

export default {
  LegalIndexPage,
  LegalDocumentView,
  LegalShellLayout,
  CookieBanner2025,
  PrivacyCenter2025,
  MarketingConsentToggle,
};