import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function TrainingManual() {
  return (
    <LegalPage
      titleHe="מדריך אילוף"
      titleEn="Training Manual"
      subtitleHe="סטנדרט טיפול ובטיחות לשירותי אילוף."
      subtitleEn="Care and safety standard for training services."
    >
      <LegalSection titleHe="1. שיטות הוגנות בלבד" titleEn="1. Humane methods only">
        <LegalParagraph
          he='יש להשתמש בשיטות אילוף הוגנות ומבוססות חיזוק חיובי. אסור כל שימוש בכוח, כאב או אמצעי אכזרי, לפי חוק צער בעלי חיים, התשנ"ד-1994.'
          en="Use only humane, positive-reinforcement-based training methods. Any use of force, pain, or cruel devices is prohibited, under the Animal Welfare Law, 1994."
        />
      </LegalSection>

      <LegalSection titleHe="2. הערכה והתאמה" titleEn="2. Assessment & suitability">
        <LegalList
          items={[
            ["העריך את גיל החיה, מזגה ויכולתה.", "Assess the pet's age, temperament, and ability."],
            ["התאם את היעדים ליכולת הריאלית של החיה.", "Match goals to the pet's realistic ability."],
            ["תאם ציפיות עם הבעלים מראש.", "Align expectations with the owner in advance."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. בטיחות במהלך מפגש" titleEn="3. Safety during a session">
        <LegalList
          items={[
            ["שמור על סביבה בטוחה ונקייה ממסיחים מסוכנים.", "Keep a safe environment free of dangerous distractions."],
            ["עצור אם החיה במצוקה, בלחץ או מותשת.", "Stop if the pet is distressed, stressed, or exhausted."],
            ["שמור על רצועה ושליטה באזורים ציבוריים.", "Maintain a leash and control in public areas."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. חירום ודיווח" titleEn="4. Emergency & reporting">
        <LegalParagraph
          he="במקרה של פציעה או אירוע התנהגותי, פעל לשלום החיה והאנשים, צור קשר עם הבעלים, ודווח מיד דרך הפלטפורמה."
          en="In case of injury or a behavioural incident, act for the safety of the pet and people, contact the owner, and report immediately through the platform."
        />
      </LegalSection>

      <LegalSection titleHe="5. אחריות וביטוח" titleEn="5. Responsibility & insurance">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי. אילוף אינו ערובה לתוצאה התנהגותית. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor. Training is not a guarantee of any behavioural outcome. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
