import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function HomeVisitManual() {
  return (
    <LegalPage
      titleHe="מדריך ביקור בית"
      titleEn="Home Visit Manual"
      subtitleHe="סטנדרט טיפול ובטיחות לביקור קצר בבית הלקוח."
      subtitleEn="Care and safety standard for a short visit to the customer's home."
    >
      <LegalSection titleHe="1. כניסה לבית" titleEn="1. Entering the home">
        <LegalList
          items={[
            ["היכנס רק לפי ההרשאה והכללים שמסר הלקוח.", "Enter only per the customer's authorisation and rules."],
            ["כבד את הפרטיות, הרכוש והגישה לאזורים מותרים בלבד.", "Respect privacy, property, and access permitted areas only."],
            ["נעל בחזרה כפי שהתבקשת בעת היציאה.", "Lock up as instructed when leaving."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. משימות הביקור" titleEn="2. Visit tasks">
        <LegalList
          items={[
            ["האכל, החלף מים ונקה לפי ההנחיות.", "Feed, refresh water, and clean per the instructions."],
            ["בדוק את שלום החיה ומצב רוחה.", "Check the pet's wellbeing and mood."],
            ["תן פעילות קצרה אם התבקשת.", "Provide short activity if requested."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. בטיחות ופרטיות" titleEn="3. Safety & privacy">
        <LegalParagraph
          he="אין לצלם את הבית או לשתף מידע ללא הסכמה. שמור על סודיות לפי הנחיות הסודיות לנותני שירות."
          en="Do not photograph the home or share information without consent. Maintain confidentiality per the Provider Confidentiality rules."
        />
      </LegalSection>

      <LegalSection titleHe="4. חירום ודיווח" titleEn="4. Emergency & reporting">
        <LegalParagraph
          he="במצב חירום פעל לשלום החיה, צור קשר עם הבעלים, ופנה לוטרינר לפי ההרשאה. דווח מיד דרך הפלטפורמה."
          en="In an emergency, act for the pet's safety, contact the owner, and seek a vet per the authorisation. Report immediately through the platform."
        />
      </LegalSection>

      <LegalSection titleHe="5. אחריות וביטוח" titleEn="5. Responsibility & insurance">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
