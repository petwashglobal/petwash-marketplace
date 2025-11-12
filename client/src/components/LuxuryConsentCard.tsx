import React from "react";

/**
 * Premium consent card for admin login
 * Displays luxury branded message with Google OAuth scope details
 * Following Google's best practices for consent UI
 */
export function LuxuryConsentCard() {
  return (
    <section
      aria-labelledby="petwash-consent-title"
      className="mx-auto mb-6 w-full max-w-xl rounded-2xl border border-white/10 bg-[radial-gradient(1200px_600px_at_0%_0%,rgba(255,255,255,0.10),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <img
          src="/brand/petwash-logo-official.png"
          alt="Pet Wash™"
          width={48}
          height={48}
          className="rounded-lg ring-1 ring-white/15"
        />
        <div>
          <h2
            id="petwash-consent-title"
            className="text-lg font-semibold tracking-wide text-white"
          >
            Pet Wash™ would like to access your Google account
          </h2>
          <p className="text-sm text-white/70">
            We'll use your email and profile to verify your identity and keep your
            admin session secure. No advertising use. Ever.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-black/30 p-4 ring-1 ring-white/10">
        <p className="text-xs text-white/70">
          Requested info: <span className="text-white">name, email, profile image</span> (scopes:{" "}
          <code className="text-white/90">openid email profile</code>).
        </p>
        <p className="mt-2 text-xs text-white/60">
          By continuing, you agree to our{" "}
          <a
            href="/terms"
            className="underline decoration-white/40 underline-offset-4 hover:text-white"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            className="underline decoration-white/40 underline-offset-4 hover:text-white"
          >
            Privacy Policy
          </a>
          . Brand verified: <span className="text-white/80">petwash.co.il</span>
        </p>
      </div>

      <div className="pointer-events-none mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <ul className="mt-4 grid list-disc grid-cols-1 gap-2 pl-5 text-xs text-white/70 sm:grid-cols-2">
        <li>Google-verified domain &amp; app name</li>
        <li>Biometric / Passkey compatible</li>
        <li>Encrypted sessions &amp; App Check</li>
        <li>One-tap re-authentication</li>
      </ul>
    </section>
  );
}
