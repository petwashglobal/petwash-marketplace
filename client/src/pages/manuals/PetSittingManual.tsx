import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function PetSittingManual() {
  return (
    <LegalPage
      titleHe="מדריך פנסיון / שמרטפות לחיות"
      titleEn="Pet Sitting Manual"
      subtitleHe="סטנדרט טיפול ובטיחות לשמירה על חיית מחמד."
      subtitleEn="Care and safety standard for looking after a pet."
    >
      <LegalSection titleHe="1. הכנה" titleEn="1. Preparation">
        <LegalList
          items={[
            ["אסוף הוראות האכלה, תרופות, שגרה ופרטי קשר לחירום.", "Collect feeding, medication, routine, and emergency contact details."],
            ["ודא פרטי וטרינר ומידע רפואי של החיה.", "Confirm the vet details and the pet's medical information."],
            ["הכר רגישויות, פחדים והרגלים.", "Learn sensitivities, fears, and habits."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. טיפול יומיומי" titleEn="2. Daily care">
        <LegalList
          items={[
            ["האכל ותן מים לפי לוח הזמנים שנמסר.", "Feed and provide water per the schedule given."],
            ["שמור על שגרה, פעילות ומנוחה מתאימות.", "Keep an appropriate routine, activity, and rest."],
            ["תן תרופות רק לפי הוראה מפורשת.", "Give medication only on explicit instruction."],
            ["שמור על סביבה נקייה ובטוחה.", "Keep the environment clean and safe."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. בטיחות" titleEn="3. Safety">
        <LegalParagraph
          he="הרחק חומרים מסוכנים, ודא שערים ודלתות סגורים, והשגח על מפגשים עם חיות או אנשים אחרים."
          en="Keep dangerous substances away, ensure gates and doors are secured, and supervise contact with other animals or people."
        />
      </LegalSection>

      <LegalSection titleHe="4. חירום" titleEn="4. Emergency">
        <LegalParagraph
          he="במקרה של מחלה או פציעה, צור קשר עם הבעלים, ובמצב חירום פנה לוטרינר לפי ההרשאה. דווח מיד דרך הפלטפורמה."
          en="In case of illness or injury, contact the owner, and in an emergency seek a vet per the authorisation. Report immediately through the platform."
        />
      </LegalSection>

      <LegalSection titleHe="5. אחריות וביטוח" titleEn="5. Responsibility & insurance">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי ואחראי לבטיחות החיה. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor and are responsible for the pet's safety. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
