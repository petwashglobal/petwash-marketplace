import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function ProviderSupportManual() {
  return (
    <LegalPage
      titleHe="מדריך תמיכה לנותן שירות"
      titleEn="Provider Support Manual"
      subtitleHe="כיצד לקבל עזרה, לפתור בעיות ולעבוד נכון בפלטפורמה."
      subtitleEn="How to get help, resolve issues, and work well on the platform."
    >
      <LegalSection titleHe="1. ערוצי תמיכה" titleEn="1. Support channels">
        <LegalParagraph
          he="פנה לתמיכה דרך הפלטפורמה לשאלות על הזמנות, תשלומים, מסמכים או תקלות. אירועי בטיחות מקבלים עדיפות."
          en="Contact support through the platform for questions about bookings, payouts, documents, or faults. Safety incidents are prioritised."
        />
      </LegalSection>

      <LegalSection titleHe="2. בעיות נפוצות" titleEn="2. Common issues">
        <LegalList
          items={[
            ["תשלום שלא שוחרר — בדוק את כללי התשלום (השלמת שירות, מסמכים, אימות בנק, אישור מנהל).", "Payout not released — check the Payout Rules (service completed, documents, bank verification, admin approval)."],
            ["מסמך נדחה — ודא שהוא תקף, קריא ונכון, והעלה מחדש.", "Document rejected — make sure it is valid, legible, and accurate, and re-upload."],
            ["מחלוקת עם לקוח — פתח פנייה ומסור ראיות.", "Dispute with a customer — open a ticket and provide evidence."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. עבודה נכונה בפלטפורמה" titleEn="3. Working well on the platform">
        <LegalList
          items={[
            ["שמור על תקשורת ותשלום בתוך הפלטפורמה (איסור עקיפה).", "Keep communication and payment in-platform (no circumvention)."],
            ["עדכן פרטים ומסמכים ואשר מחדש כל 6 חודשים.", "Update details and documents and re-confirm every 6 months."],
            ["כבד הזמנות, הגע בזמן, ודווח על אירועים מיד.", "Honour bookings, arrive on time, and report incidents immediately."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. הסלמה" titleEn="4. Escalation">
        <LegalParagraph
          he="אם בעיה אינה נפתרת, בקש הסלמה דרך פניית התמיכה. אנו שואפים להגיב בזמן סביר."
          en="If an issue is unresolved, request escalation through the support ticket. We aim to respond within a reasonable time."
        />
      </LegalSection>

      <LegalSection titleHe="5. מעמד ואחריות" titleEn="5. Status & responsibility">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
