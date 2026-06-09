import { SUPPORT_EMAIL } from "@shared/support-contact";
import { EmailService } from "../emailService";

export interface VerificationEmailCodeInput {
  to: string;
  code: string;
  purpose: "change_email" | "close_account" | "enable_2fa" | "disable_2fa" | "payout";
}

export async function sendVerificationEmailCode(input: VerificationEmailCodeInput): Promise<boolean> {
  const isCloseAccount = input.purpose === "close_account";
  const isEnable2fa = input.purpose === "enable_2fa";
  const isDisable2fa = input.purpose === "disable_2fa";
  const isPayout = input.purpose === "payout";
  const subject = isCloseAccount
    ? "Confirm your PetWash account deletion request"
    : isEnable2fa
      ? "Confirm PetWash two-step verification setup"
      : isDisable2fa
        ? "Confirm PetWash two-step verification removal"
        : isPayout
          ? "Confirm PetWash payout release"
    : "Your PetWash verification code";
  const heading = isCloseAccount
    ? "Confirm account deletion"
    : isEnable2fa
      ? "Confirm two-step verification setup"
      : isDisable2fa
        ? "Confirm two-step verification removal"
        : isPayout
          ? "Confirm payout release"
    : "Verify your PetWash email change";
  const body = isCloseAccount
    ? "Use this one-time code to confirm your account deletion request."
    : isEnable2fa
      ? "Use this one-time code to continue setting up two-step verification on your PetWash account."
      : isDisable2fa
        ? "Use this one-time code to confirm removal of a two-step verification method from your PetWash account."
        : isPayout
          ? "Use this one-time code to confirm a sensitive payout release or settlement payment action."
    : "Use this one-time code to confirm your new email address.";
  const warning = isCloseAccount
    ? "If you did not request account deletion, do not share the code and contact"
    : isEnable2fa || isDisable2fa || isPayout
      ? "If you did not request this security change, do not share the code and contact"
    : "If you did not request this change, do not share the code and contact";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h1 style="font-size:22px;margin:0 0 12px">${heading}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 18px">
        ${body}
      </p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;padding:18px;text-align:center;margin:0 0 18px">
        ${input.code}
      </div>
      <p style="font-size:14px;line-height:1.5;margin:0 0 18px">
        The code expires soon. ${warning}
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
