import { useState } from "react";
import { useLocation } from "wouter";
import { MailCheck, RefreshCw } from "lucide-react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he");
  } catch {
    return false;
  }
};

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const he = isHebrew();

  // BUGFIX 2026-06-18: this page was an inescapable dead-end — "Back to Home" just
  // re-ran the gate and bounced the user straight back, with nothing ever reloading
  // the verified state. Add an explicit "I've verified — continue" that reloads the
  // Firebase user + force-refreshes the token so the gate re-checks email_verified.
  const handleContinue = async () => {
    setChecking(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) { setLocation("/signin"); return; }
      await user.reload();
      const idToken = await user.getIdToken(true);
      if (user.emailVerified) {
        // Persist the verification into Postgres BEFORE navigating — otherwise the
        // post-login gate sees users.emailVerified=false and bounces right back
        // here (the old infinite loop). (2026-07-31)
        try {
          await fetch("/api/auth/email/mark-verified", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
            credentials: "include",
          });
        } catch { /* non-blocking — session-cookie path also persists on next login */ }
        setLocation("/");
      } else {
        setError(he
          ? "האימייל עדיין לא אומת. בדוק את תיבת הדואר ולחץ על הקישור."
          : "Email not verified yet. Check your inbox and click the link, then try again.");
      }
    } catch {
      setError(he ? "הבדיקה נכשלה. נסה שוב." : "Could not check verification. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setSending(true);
    setError("");
    setSent(false);
    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        setSent(true);
      } else {
        setError(he ? "לא נמצא משתמש מחובר" : "No signed-in user found");
      }
    } catch (err: any) {
      setError(
        he
          ? "שליחת האימות נכשלה. נסה שוב מאוחר יותר."
          : "Failed to send verification email. Please try again later."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <Card className="max-w-md w-full mx-auto bg-white">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#D4AF37] flex items-center justify-center">
            <MailCheck className="w-8 h-8 text-black" />
          </div>
          <CardTitle className="text-xl">
            {he ? "אמת את כתובת האימייל שלך" : "Verify Your Email"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {he
              ? "שלחנו לך אימייל אימות. אנא בדוק את תיבת הדואר שלך ולחץ על הקישור לאימות."
              : "We've sent you a verification email. Please check your inbox and click the verification link."}
          </p>

          {sent && (
            <p className="text-green-600 text-sm font-medium">
              {he ? "אימייל אימות נשלח בהצלחה!" : "Verification email sent successfully!"}
            </p>
          )}

          {error && (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={handleContinue}
              disabled={checking}
            >
              {checking
                ? (he ? "בודק…" : "Checking…")
                : (he ? "אימתתי — המשך" : "I've verified — Continue")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={sending}
            >
              <RefreshCw className={`w-4 h-4 ${sending ? "animate-spin" : ""}`} />
              {he ? "שלח שוב אימייל אימות" : "Resend Verification Email"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLocation("/")}
            >
              {he ? "חזרה לדף הבית" : "Back to Home"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
