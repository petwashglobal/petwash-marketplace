import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function StationUseTerms() {
  return (
    <LegalPage
      titleHe="תנאי שימוש בעמדה"
      titleEn="Station Use Terms"
      subtitleHe="כללי בטיחות ושימוש בעמדות השטיפה של PetWash."
      subtitleEn="Safety and usage rules for PetWash wash stations."
    >
      <LegalSection titleHe="1. השגחה" titleEn="1. Supervision">
        <LegalParagraph
          he="עליך להשגיח על חיית המחמד בכל עת במהלך השימוש בעמדה ולא להשאירה ללא השגחה."
          en="You must supervise your pet at all times while using the station and never leave it unattended."
        />
      </LegalSection>

      <LegalSection titleHe="2. כשירות חיית המחמד" titleEn="2. Pet fitness">
        <LegalParagraph
          he="אין להשתמש בעמדה אם חיית המחמד אינה בטוחה לשטיפה — לרבות אם היא חולה, פצועה או תוקפנית."
          en="Do not use the station if your pet is not safe to wash — including if it is sick, injured, or aggressive."
        />
      </LegalSection>

      <LegalSection titleHe="3. שימוש נכון" titleEn="3. Correct use">
        <LegalList
          items={[
            ["יש לפעול לפי ההוראות המוצגות בעמדה ולהשתמש בציוד למטרתו בלבד.", "Follow the instructions displayed on the station and use the equipment only for its intended purpose."],
            ["אין להשתמש בחומרים שאינם מסופקים או מאושרים על-ידי PetWash.", "Do not use substances not supplied or approved by PetWash."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. דיווח מהיר" titleEn="4. Prompt reporting">
        <LegalParagraph
          he="יש לדווח במהירות על כל תקלה, פגם בטיחותי או פציעה, באמצעי הדיווח המוצג בעמדה או בפלטפורמה."
          en="Report any fault, safety defect, or injury promptly, through the reporting channel shown on the station or the platform."
        />
      </LegalSection>

      <LegalSection titleHe="5. הודעה: אין ביטוח אוטומטי" titleEn="5. No-insurance notice">
        <LegalParagraph
          he="השימוש בעמדה הוא באחריותך. PetWash מספקת כלים, רישומי שימוש, תמיכה ודיווח על אירועים; ביטוח או החזר אינם כלולים אוטומטית אלא אם נאמר זאת במפורש ובכתב עבור הזמנה כשירה."
          en="Use of the station is at your responsibility. PetWash provides tools, usage records, support, and incident reporting; insurance or reimbursement is not automatically included unless expressly stated in writing for an eligible booking."
        />
      </LegalSection>
    </LegalPage>
  );
}
