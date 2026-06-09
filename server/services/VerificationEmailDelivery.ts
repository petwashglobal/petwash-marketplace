import { SUPPORT_EMAIL } from "@shared/support-contact";
import { EmailService } from "../emailService";

export interface VerificationEmailCodeInput {
  to: string;
  code: string;
  purpose: "change_email";
}

export async function sendVerificationEmailCode(input: VerificationEmailCodeInput): Promise<boolean> {
  const subject = "Your PetWash verification code";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h1 style="font-size:22px;margin:0 0 12px">Verify your PetWash email change</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 18px">
        Use this one-time code to confirm your new email address.
      </p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;padding:18px;text-align:center;margin:0 0 18px">
        ${input.code}
      </div>
      <p style="font-size:14px;line-height:1.5;margin:0 0 18px">
        The code expires soon. If you did not request this change, do not share the code and contact
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#111827">${SUPPORT_EMAIL}</a>.
      </p>
      <p style="font-size:12px;color:#6b7280;margin:0">PetWash security</p>
    </div>
  `;

  return EmailService.send({
    to: input.to,
    subject,
    html,
  });
}
