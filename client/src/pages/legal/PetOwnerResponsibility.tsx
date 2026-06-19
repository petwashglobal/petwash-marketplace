import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function PetOwnerResponsibility() {
  return (
    <LegalPage
      titleHe="אחריות בעל חיית המחמד"
      titleEn="Pet Owner Responsibility"
      subtitleHe="חובותיך כבעל חיית המחמד בעת שימוש בשירותי PetWash."
      subtitleEn="Your duties as a pet owner when using PetWash services."
    >
      <LegalSection titleHe="1. בעלות וכשירות" titleEn="1. Ownership & capacity">
        <LegalList
          items={[
            ["עליך להיות בן 18 לפחות ולהיות הבעלים החוקי של חיית המחמד או מורשה לטפל בה.", "You must be at least 18 years old and be the lawful owner of the pet, or authorised to care for it."],
            ["אתה נושא באחריות מלאה למעשי חיית המחמד שלך, לרבות התנהגות, נשיכה או נזק.", "You bear full responsibility for your pet's actions, including behaviour, biting, or damage."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. בריאות וכשירות לשירות" titleEn="2. Health & fitness for service">
        <LegalList
          items={[
            ["אין להזמין שירות אם חיית המחמד חולה, פצועה, מדבקת, בהיריון מתקדם או תוקפנית, מבלי ליידע מראש.", "Do not book a service if the pet is sick, injured, contagious, in late pregnancy, or aggressive, without informing in advance."],
            ["עליך לעדכן חיסונים ולמסור מידע רפואי רלוונטי לנותן השירות.", "You must keep vaccinations up to date and disclose relevant medical information to the provider."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. מידע נכון" titleEn="3. Accurate information">
        <LegalParagraph
          he="עליך למסור מידע נכון ומלא על חיית המחמד — גיל, גזע, רגישויות, מצב רפואי והתנהגותי. מידע שגוי עלול לסכן את החיה ואת נותן השירות."
          en="You must provide accurate and complete information about the pet — age, breed, sensitivities, medical and behavioural condition. Inaccurate information may endanger the pet and the provider."
        />
      </LegalSection>

      <LegalSection titleHe="4. ציות לדיני בעלי חיים" titleEn="4. Compliance with animal law">
        <LegalParagraph
          he='עליך לפעול לפי כל דין החל בישראל בנוגע להחזקת בעלי חיים, רישוי, רצועה ומניעת התעללות, לרבות חוק צער בעלי חיים, התשנ"ד-1994.'
          en="You must comply with all Israeli law on keeping animals, licensing, leashing, and prevention of cruelty, including the Animal Welfare Law, 1994."
        />
      </LegalSection>

      <LegalSection titleHe="5. שיפוי" titleEn="5. Indemnity">
        <LegalParagraph
          he="אתה מתחייב לשפות את PetWash ואת נותן השירות בגין נזק שנגרם על-ידי חיית המחמד שלך או עקב מידע כוזב שמסרת, בכפוף לדין."
          en="You agree to indemnify PetWash and the provider for damage caused by your pet or due to false information you provided, subject to law."
        />
      </LegalSection>

      <LegalSection titleHe="6. הודעה: אין ביטוח אוטומטי" titleEn="6. No-insurance notice">
        <LegalParagraph
          he="PetWash מספקת כלים, רישומים, תמיכה ודיווח על אירועים; ביטוח או החזר אינם כלולים אוטומטית אלא אם נאמר זאת במפורש ובכתב עבור הזמנה כשירה."
          en="PetWash provides tools, records, support, and incident reporting; insurance or reimbursement is not automatically included unless expressly stated in writing for an eligible booking."
        />
      </LegalSection>
    </LegalPage>
  );
}
