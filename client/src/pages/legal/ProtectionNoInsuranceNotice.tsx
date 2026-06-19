import { LegalPage, LegalSection, LegalParagraph } from "./LegalPage";

export default function ProtectionNoInsuranceNotice() {
  return (
    <LegalPage
      titleHe="הודעה: הגנה — אין ביטוח אוטומטי"
      titleEn="Protection — No-Insurance Notice"
      subtitleHe="הבהרה ביחס לכלי ההגנה שמספקת PetWash."
      subtitleEn="A clarification regarding the protection tools PetWash provides."
    >
      <LegalSection titleHe="מה PetWash מספקת" titleEn="What PetWash provides">
        <LegalParagraph
          he="PetWash מספקת כלים בפלטפורמה, רישומי הזמנות, תמיכה ודיווח על אירועים."
          en="PetWash provides platform tools, booking records, support, and incident reporting."
        />
      </LegalSection>

      <LegalSection titleHe="מה אינו כלול" titleEn="What is not included">
        <LegalParagraph
          he="ביטוח או החזר אינם כלולים באופן אוטומטי, אלא אם נאמר זאת במפורש ובכתב עבור הזמנה כשירה."
          en="Insurance or reimbursement is not automatically included unless expressly stated in writing for an eligible booking."
        />
      </LegalSection>

      <LegalSection titleHe="המשמעות עבורך" titleEn="What this means for you">
        <LegalParagraph
          he="אין להסתמך על קיומו של כיסוי ביטוחי כלשהו מצד PetWash אלא אם הוא מוצג במפורש בקשר להזמנה ספציפית. אחזקת ביטוח מתאים — לחיית המחמד, לבית, לרכוש או לאחריות — היא באחריותך."
          en="You should not rely on any PetWash insurance coverage unless it is expressly shown in connection with a specific booking. Holding appropriate insurance — for your pet, home, property, or liability — is your responsibility."
        />
      </LegalSection>
    </LegalPage>
  );
}
