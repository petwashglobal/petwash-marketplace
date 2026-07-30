import { SUPPORT_EMAIL } from "@shared/support-contact";
import { EmailService } from "../emailService";

export interface VerificationEmailCodeInput {
  to: string;
  code: string;
  purpose: "change_email" | "close_account" | "enable_2fa" | "disable_2fa" | "payout" | "login" | "signup";
  /** Preferred language from the challenge payload ('he' default — Israeli market). */
  language?: string;
}

// Bilingual copy per purpose — Hebrew FIRST (CEO 2026-07-30: the signup code
// email went out English-only in a generic gray template; every customer-facing
// email is Hebrew-led + branded). English follows for non-Hebrew readers.
const COPY: Record<VerificationEmailCodeInput["purpose"], {
  subjectHe: string; subjectEn: string;
  headingHe: string; headingEn: string;
  bodyHe: string; bodyEn: string;
}> = {
  signup: {
    subjectHe: "קוד האימות שלך ל-PetWash™",
    subjectEn: "Your PetWash verification code",
    headingHe: "ברוכים הבאים ל-PetWash™ — אמתו את האימייל",
    headingEn: "Welcome to PetWash — verify your email",
    bodyHe: "הזינו את הקוד החד-פעמי כדי לאמת את כתובת האימייל ולהצטרף למשפחת PetWash.",
    bodyEn: "Use this one-time code to verify your email and join the PetWash family.",
  },
  login: {
    subjectHe: "קוד הכניסה שלך ל-PetWash™",
    subjectEn: "Your PetWash sign-in code",
    headingHe: "קוד הכניסה שלך",
    headingEn: "Your PetWash sign-in code",
    bodyHe: "הזינו את הקוד החד-פעמי כדי להתחבר לחשבון PetWash שלכם.",
    bodyEn: "Use this one-time code to sign in to PetWash.",
  },
  change_email: {
    subjectHe: "אימות שינוי כתובת אימייל — PetWash™",
    subjectEn: "Verify your PetWash email change",
    headingHe: "אימות כתובת אימייל חדשה",
    headingEn: "Verify your PetWash email change",
    bodyHe: "הזינו את הקוד החד-פעמי כדי לאשר את כתובת האימייל החדשה.",
    bodyEn: "Use this one-time code to confirm your new email address.",
  },
  close_account: {
    subjectHe: "אישור בקשת מחיקת חשבון — PetWash™",
    subjectEn: "Confirm your PetWash account deletion request",
    headingHe: "אישור מחיקת חשבון",
    headingEn: "Confirm account deletion",
    bodyHe: "הזינו את הקוד החד-פעמי כדי לאשר את בקשת מחיקת החשבון.",
    bodyEn: "Use this one-time code to confirm your account deletion request.",
  },
  enable_2fa: {
    subjectHe: "אישור הפעלת אימות דו-שלבי — PetWash™",
    subjectEn: "Confirm PetWash two-step verification setup",
    headingHe: "אישור הפעלת אימות דו-שלבי",
    headingEn: "Confirm two-step verification setup",
    bodyHe: "הזינו את הקוד החד-פעמי כדי להמשיך בהגדרת אימות דו-שלבי בחשבונכם.",
    bodyEn: "Use this one-time code to continue setting up two-step verification on your PetWash account.",
  },
  disable_2fa: {
    subjectHe: "אישור הסרת אימות דו-שלבי — PetWash™",
    subjectEn: "Confirm PetWash two-step verification removal",
    headingHe: "אישור הסרת אימות דו-שלבי",
    headingEn: "Confirm two-step verification removal",
    bodyHe: "הזינו את הקוד החד-פעמי כדי לאשר הסרת שיטת אימות דו-שלבי מחשבונכם.",
    bodyEn: "Use this one-time code to confirm removal of a two-step verification method from your PetWash account.",
  },
  payout: {
    subjectHe: "אישור שחרור תשלום — PetWash™",
    subjectEn: "Confirm PetWash payout release",
    headingHe: "אישור שחרור תשלום",
    headingEn: "Confirm payout release",
    bodyHe: "הזינו את הקוד החד-פעמי כדי לאשר פעולת שחרור תשלום רגישה.",
    bodyEn: "Use this one-time code to confirm a sensitive payout release or settlement payment action.",
  },
};

const WARNING_HE = "הקוד תקף לזמן קצר. אם לא ביקשתם את הפעולה — אל תשתפו את הקוד וצרו קשר:";
const WARNING_EN = "The code expires soon. If you did not request this, do not share the code and contact";

// Brand tokens — same family as the receipt/confirmation templates.
const GOLD = "#C6A35B";
const BLACK = "#0F0F0F";

export async function sendVerificationEmailCode(input: VerificationEmailCodeInput): Promise<boolean> {
  const c = COPY[input.purpose];
  const isEnglish = (input.language || "he").toLowerCase().startsWith("en");
  const subject = isEnglish ? c.subjectEn : c.subjectHe;

  const html = `
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E8DEC8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
      <div style="background:${BLACK};padding:20px 28px;text-align:center">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${GOLD}">🐾 PetWash™</span>
      </div>
      <div style="height:3px;background:${GOLD};font-size:0">&nbsp;</div>
      <div style="padding:26px 28px 8px" dir="rtl" lang="he">
        <h1 style="font-size:20px;margin:0 0 10px;color:#111">${c.headingHe}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px">${c.bodyHe}</p>
      </div>
      <div style="font-size:34px;font-weight:700;letter-spacing:10px;background:#F9F7F3;border:1px solid #E8DEC8;border-radius:10px;padding:18px;text-align:center;margin:0 28px 18px;direction:ltr">
        ${input.code}
      </div>
      <div style="padding:0 28px" dir="rtl" lang="he">
        <p style="font-size:13px;line-height:1.6;margin:0 0 16px;color:#555">
          ${WARNING_HE}
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#111827">${SUPPORT_EMAIL}</a>
        </p>
      </div>
      <div style="padding:0 28px 6px;border-top:1px solid #F0EBE0" dir="ltr" lang="en">
        <p style="font-size:13px;margin:14px 0 4px;color:#374151"><strong>${c.headingEn}.</strong> ${c.bodyEn}</p>
        <p style="font-size:12px;line-height:1.6;margin:0 0 14px;color:#6b7280">
          ${WARNING_EN}
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#111827">${SUPPORT_EMAIL}</a>.
        </p>
      </div>
      <div style="background:${BLACK};padding:12px;text-align:center">
        <span style="font-size:11px;color:#888">PetWash™ Security · petwash.co.il</span>
      </div>
    </div>
  `;

  return EmailService.send({
    to: input.to,
    subject,
    html,
  });
}
