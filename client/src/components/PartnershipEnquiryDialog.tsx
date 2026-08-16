import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

// Shared lightweight partnership-enquiry form. Posts to /api/contact (public,
// rate-limited) with a caller-provided subject prefix so leads land in the
// support inbox tagged by source (Municipal, Landlord, etc.). Kept minimal
// on purpose — this is a public landing-page CTA, not the full franchise
// intake flow at /partners/franchise. Municipal.tsx + Locations.tsx used
// to render decorative buttons with no click handler; the leads went
// nowhere. This component is what closes that gap.
export type PartnershipEnquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectPrefix: string;
  language: string;
  orgFieldLabel?: { en: string; he: string };
  title?: { en: string; he: string };
  description?: { en: string; he: string };
};

export function PartnershipEnquiryDialog({
  open,
  onOpenChange,
  subjectPrefix,
  language,
  orgFieldLabel,
  title,
  description,
}: PartnershipEnquiryDialogProps) {
  const isHe = language === "he";
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  function reset() {
    setName("");
    setOrg("");
    setEmail("");
    setPhone("");
    setMessage("");
    setSubmitted(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!name || !email || !message) {
      toast({
        title: isHe ? "שדות חובה חסרים" : "Missing required fields",
        description: isHe
          ? "אנא מלאו שם, אימייל והודעה"
          : "Please fill in name, email, and message",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const orgLine = org ? `\n\n[${orgFieldLabel?.en ?? "Organisation"}]: ${org}` : "";
      const res = await apiRequest("/api/contact", "POST", {
        name,
        email,
        phone: phone || undefined,
        subject: `${subjectPrefix} — ${name}`,
        message: `${message}${orgLine}`,
        language,
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
      toast({
        title: isHe ? "נשלח בהצלחה" : "Sent successfully",
        description: isHe
          ? "תודה! צוות השותפויות שלנו יחזור אליכם."
          : "Thanks! Our partnerships team will get back to you.",
      });
    } catch {
      toast({
        title: isHe ? "שגיאה" : "Error",
        description: isHe
          ? "לא הצלחנו לשלוח. נסו שוב או פנו אלינו במייל."
          : "Could not submit. Please try again or email us.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const t = {
    title: title
      ? isHe
        ? title.he
        : title.en
      : isHe
        ? "פנייה לשותפות"
        : "Partnership enquiry",
    desc: description
      ? isHe
        ? description.he
        : description.en
      : isHe
        ? "השאירו פרטים ונחזור אליכם בהקדם."
        : "Leave your details and we'll get back to you shortly.",
    name: isHe ? "שם מלא" : "Full name",
    org: orgFieldLabel
      ? isHe
        ? orgFieldLabel.he
        : orgFieldLabel.en
      : isHe
        ? "ארגון"
        : "Organisation",
    email: isHe ? "אימייל" : "Email",
    phone: isHe ? "טלפון" : "Phone",
    message: isHe ? "הודעה" : "Message",
    send: isHe ? "שלח" : "Send",
    sending: isHe ? "שולח…" : "Sending…",
    thanks: isHe ? "תודה!" : "Thank you!",
    thanksBody: isHe
      ? "קיבלנו את הפנייה. נציג יחזור אליכם בקרוב."
      : "We received your enquiry. A team member will be in touch soon.",
    close: isHe ? "סגור" : "Close",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-lg" dir={isHe ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{submitted ? t.thanks : t.title}</DialogTitle>
          <DialogDescription>{submitted ? t.thanksBody : t.desc}</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="flex flex-col items-center py-6" data-testid="partnership-enquiry-success">
            <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
            <Button onClick={() => onOpenChange(false)} data-testid="button-partnership-close">
              {t.close}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" data-testid="partnership-enquiry-form">
            <div>
              <Label htmlFor="pe-name">{t.name}</Label>
              <Input
                id="pe-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                data-testid="input-partnership-name"
              />
            </div>
            <div>
              <Label htmlFor="pe-org">{t.org}</Label>
              <Input
                id="pe-org"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                maxLength={200}
                data-testid="input-partnership-org"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pe-email">{t.email}</Label>
                <Input
                  id="pe-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  data-testid="input-partnership-email"
                />
              </div>
              <div>
                <Label htmlFor="pe-phone">{t.phone}</Label>
                <Input
                  id="pe-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={32}
                  data-testid="input-partnership-phone"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pe-message">{t.message}</Label>
              <Textarea
                id="pe-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={5000}
                rows={4}
                data-testid="input-partnership-message"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting} data-testid="button-partnership-submit">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    {t.sending}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 me-2" />
                    {t.send}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
