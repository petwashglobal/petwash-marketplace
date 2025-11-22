// FILE: src/routes/legalRoutesIntegration.tsx
//
// Pet Wash Ltd - Legal Frontend Integration Helper 2025
//
// This file shows your developer exactly how to wire the giant
// LegalFrontend2025.tsx file into:
// 1) Next.js App Router
// 2) React Router (SPA - Vite / CRA)
//
// They can copy only the section that matches your stack.
//
// Required existing file:
//   src/features/legal/LegalFrontend2025.tsx
//
// Exposed components from that file:
//   - LegalIndexPage
//   - LegalDocumentView
//   - CookieBanner2025
//   - PrivacyCenter2025
//   - MarketingConsentToggle
//
// Important:
// - No marketing hype here, clean and neutral only.
// - All legal texts must be approved by a lawyer.
// - This file is technical wiring only.

// ----------------------------------------------------------
// 1. Imports from your legal frontend module
// ----------------------------------------------------------

import React from "react";

// Adjust path if your folder structure is slightly different
import {
  LegalIndexPage,
  LegalDocumentView,
  CookieBanner2025,
  PrivacyCenter2025,
  MarketingConsentToggle,
} from "@/features/legal/LegalFrontend2025";

// ----------------------------------------------------------
// 2. NEXT.JS APP ROUTER (app directory)
// ----------------------------------------------------------
//
// Use this section if your project uses Next.js with the app router.
// Folder structure example:
//
// app/
//   layout.tsx
//   page.tsx
//   legal/
//     page.tsx                - index for /legal
//     terms/
//       page.tsx              - /legal/terms
//     privacy/
//       page.tsx              - /legal/privacy
//     cookies/
//       page.tsx              - /legal/cookies
//     cancellation/
//       page.tsx              - /legal/cancellation
//     payments-security/
//       page.tsx              - /legal/payments-security
//     marketing-consent/
//       page.tsx              - /legal/marketing-consent
//     accessibility/
//       page.tsx              - /legal/accessibility
//
// You do not put this file directly in app/, but you can copy each snippet
// into the relevant app page files.

// Example: app/legal/page.tsx
export const NextLegalIndexPage = () => {
  // locale could come from i18n, cookies, headers, etc.
  const locale: "he" | "en" = "he";
  return <LegalIndexPage locale={locale} />;
};

// Example: app/legal/terms/page.tsx
export const NextLegalTermsPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="terms_of_use"
      locale={locale}
      pageTitle={locale === "he" ? "תנאי שימוש" : "Terms of Use"}
    />
  );
};

// Example: app/legal/privacy/page.tsx
export const NextLegalPrivacyPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="privacy_policy"
      locale={locale}
      pageTitle={locale === "he" ? "מדיניות פרטיות" : "Privacy Policy"}
    />
  );
};

// Example: app/legal/cookies/page.tsx
export const NextLegalCookiesPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="cookie_policy"
      locale={locale}
      pageTitle={locale === "he" ? "מדיניות עוגיות" : "Cookie Policy"}
    />
  );
};

// Example: app/legal/cancellation/page.tsx
export const NextLegalCancellationPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="cancellation_policy"
      locale={locale}
      pageTitle={
        locale === "he"
          ? "מדיניות ביטול והחזרים"
          : "Cancellation and Refund Policy"
      }
    />
  );
};

// Example: app/legal/payments-security/page.tsx
export const NextLegalPaymentsSecurityPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="payments_security"
      locale={locale}
      pageTitle={
        locale === "he" ? "אבטחת תשלומים" : "Payment Security Information"
      }
    />
  );
};

// Example: app/legal/marketing-consent/page.tsx
export const NextLegalMarketingConsentPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="marketing_consent"
      locale={locale}
      pageTitle={
        locale === "he" ? "הסכמה לשיווק ודיוור" : "Marketing Consent"
      }
    />
  );
};

// Example: app/legal/accessibility/page.tsx
export const NextLegalAccessibilityPage = () => {
  const locale: "he" | "en" = "he";
  return (
    <LegalDocumentView
      docKey="accessibility_statement"
      locale={locale}
      pageTitle={
        locale === "he"
          ? "הצהרת נגישות"
          : "Accessibility Statement"
      }
    />
  );
};

// Example: using CookieBanner2025 in app/layout.tsx
//
// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   const locale: "he" | "en" = "he";
//   return (
//     <html lang={locale === "he" ? "he" : "en"} dir={locale === "he" ? "rtl" : "ltr"}>
//       <body>
//         {children}
//         <CookieBanner2025 locale={locale} />
//       </body>
//     </html>
//   );
// }

// Example: using PrivacyCenter2025 as its own page
// app/legal/privacy-center/page.tsx
export const NextPrivacyCenterPage = () => {
  const locale: "he" | "en" = "he";
  return <PrivacyCenter2025 locale={locale} />;
};

// Example: using MarketingConsentToggle inside profile page
// app/account/profile/page.tsx
export const NextProfileMarketingConsentExample = () => {
  const locale: "he" | "en" = "he";

  return (
    <div className="p-4">
      {/* other profile fields here */}
      <MarketingConsentToggle
        locale={locale}
        initialValue={false}
        onChange={(value) => {
          console.log("Marketing consent changed to", value);
        }}
      />
    </div>
  );
};

// ----------------------------------------------------------
// 3. REACT ROUTER INTEGRATION (Vite / CRA)
// ----------------------------------------------------------
//
// Use this section if your project uses React Router in a SPA.
//
// Example structure:
// src/
//   App.tsx
//   routes/
//     legalRoutesIntegration.tsx (this file)
//   features/
//     legal/
//       LegalFrontend2025.tsx
//
// In App.tsx, you can import LegalRoutes and mount them into your Router.

// This assumes React Router v6. If version differs, adjust as needed.

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

export const LegalRoutesReactRouter: React.FC = () => {
  const locale: "he" | "en" = "he";

  return (
    <Routes>
      {/* /legal index */}
      <Route path="/legal" element={<LegalIndexPage locale={locale} />} />

      {/* each specific document */}
      <Route
        path="/legal/terms"
        element={
          <LegalDocumentView
            docKey="terms_of_use"
            locale={locale}
            pageTitle={locale === "he" ? "תנאי שימוש" : "Terms of Use"}
          />
        }
      />
      <Route
        path="/legal/privacy"
        element={
          <LegalDocumentView
            docKey="privacy_policy"
            locale={locale}
            pageTitle={locale === "he" ? "מדיניות פרטיות" : "Privacy Policy"}
          />
        }
      />
      <Route
        path="/legal/cookies"
        element={
          <LegalDocumentView
            docKey="cookie_policy"
            locale={locale}
            pageTitle={locale === "he" ? "מדיניות עוגיות" : "Cookie Policy"}
          />
        }
      />
      <Route
        path="/legal/cancellation"
        element={
          <LegalDocumentView
            docKey="cancellation_policy"
            locale={locale}
            pageTitle={
              locale === "he"
                ? "מדיניות ביטול והחזרים"
                : "Cancellation and Refund Policy"
            }
          />
        }
      />
      <Route
        path="/legal/payments-security"
        element={
          <LegalDocumentView
            docKey="payments_security"
            locale={locale}
            pageTitle={
              locale === "he"
                ? "אבטחת תשלומים"
                : "Payment Security Information"
            }
          />
        }
      />
      <Route
        path="/legal/marketing-consent"
        element={
          <LegalDocumentView
            docKey="marketing_consent"
            locale={locale}
            pageTitle={
              locale === "he"
                ? "הסכמה לשיווק ודיוור"
                : "Marketing Consent"
            }
          />
        }
      />
      <Route
        path="/legal/accessibility"
        element={
          <LegalDocumentView
            docKey="accessibility_statement"
            locale={locale}
            pageTitle={
              locale === "he"
                ? "הצהרת נגישות"
                : "Accessibility Statement"
            }
          />
        }
      />

      {/* Optional redirect for unknown /legal paths */}
      <Route path="/legal/*" element={<Navigate to="/legal" replace />} />
    </Routes>
  );
};

// Example App.tsx integration:
//
// import React from "react";
// import { BrowserRouter, Routes, Route } from "react-router-dom";
// import { LegalRoutesReactRouter } from "./routes/legalRoutesIntegration";
// import { CookieBanner2025 } from "@/features/legal/LegalFrontend2025";
//
// export const App: React.FC = () => {
//   const locale: "he" | "en" = "he";
//
//   return (
//     <BrowserRouter>
//       {/* your main layout can be here */}
//       <Routes>
//         {/* other routes */}
//         <Route path="/*" element={<MainAppShell />} />
//       </Routes>
//
//       {/* legal routes */}
//       <LegalRoutesReactRouter />
//
//       {/* global cookie banner */}
//       <CookieBanner2025 locale={locale} />
//     </BrowserRouter>
//   );
// };
//
// const MainAppShell: React.FC = () => {
//   return (
//     <div>
//       {/* header, content, footer etc */}
//       <h1>Pet Wash Main App</h1>
//     </div>
//   );
// };

// ----------------------------------------------------------
// 4. Named exports
// ----------------------------------------------------------
//
// This allows your developer to import whichever variant is relevant.
// For example:
//   import { LegalRoutesReactRouter } from "@/routes/legalRoutesIntegration";
// or in Next.js specific files they use the Next* components above.

export const LegalRouterIntegration = {
  // Next.js examples
  NextLegalIndexPage,
  NextLegalTermsPage,
  NextLegalPrivacyPage,
  NextLegalCookiesPage,
  NextLegalCancellationPage,
  NextLegalPaymentsSecurityPage,
  NextLegalMarketingConsentPage,
  NextLegalAccessibilityPage,
  NextPrivacyCenterPage,
  NextProfileMarketingConsentExample,

  // React Router bundle
  LegalRoutesReactRouter,
};