import type { Language } from "@/lib/i18n";

export const PRIVILEGE_MEMBERSHIP_CONFIG = {
  enrollmentLabel: {
    en: "Complimentary",
    he: "ללא עלות",
    ar: "مجاني",
    ru: "Бесплатно",
    fr: "Offert",
    es: "Sin costo",
  } as Record<Language, string>,
} as const;

export function getPrivilegeEnrollmentLabel(language: Language): string {
  return PRIVILEGE_MEMBERSHIP_CONFIG.enrollmentLabel[language] ?? PRIVILEGE_MEMBERSHIP_CONFIG.enrollmentLabel.en;
}
