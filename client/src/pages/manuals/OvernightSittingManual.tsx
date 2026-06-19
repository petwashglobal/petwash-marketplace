import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function OvernightSittingManual() {
  return (
    <LegalPage
      titleHe="מדריך לינה / שמירת לילה"
      titleEn="Overnight Sitting Manual"
      subtitleHe="סטנדרט טיפול ובטיחות לשמירה הכוללת לינה."
      subtitleEn="Care and safety standard for care that includes an overnight stay."
    >
      <LegalSection titleHe="1. הסדרי הלינה" titleEn="1. Overnight arrangements">
        <LegalList
          items={[
            ["אשר מראש את מיקום הלינה (בית הלקוח או בית נותן השירות).", "Confirm in advance the stay location (customer's or provider's home)."],
            ["ודא סביבה בטוחה לחיה למשך כל הלילה.", "Ensure a safe environment for the pet throughout the night."],
            ["סכם נוכחות רציפה או חלון היעדרות מותר.", "Agree on continuous presence or any permitted absence window."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. שגרת ערב ובוקר" titleEn="2. Evening & morning routine">
        <LegalList
          items={[
            ["האכל, הוצא לצרכים ותן מנוחה לפי השגרה.", "Feed, toilet, and rest the pet per its routine."],
            ["תן תרופות לפי הוראה מפורשת בלבד.", "Give medication only on explicit instruction."],
            ["שמור על שקט וביטחון בשעות הלילה.", "Keep the pet calm and secure overnight."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. בטיחות לילה" titleEn="3. Night safety">
        <LegalParagraph
          he="ודא שערים ודלתות סגורים, הרחק סכנות, והשאר אמצעי קשר זמין למקרה חירום."
          en="Ensure gates and doors are secured, keep hazards away, and keep a means of contact available for an emergency."
        />
      </LegalSection>

      <LegalSection titleHe="4. חירום ודיווח" titleEn="4. Emergency & reporting">
        <LegalParagraph
          he="במצב חירום בלילה, פעל לשלום החיה, צור קשר עם הבעלים, ופנה לוטרינר חירום לפי ההרשאה. דווח מיד דרך הפלטפורמה."
          en="In a night-time emergency, act for the pet's safety, contact the owner, and seek an emergency vet per the authorisation. Report immediately through the platform."
        />
      </LegalSection>

      <LegalSection titleHe="5. אחריות וביטוח" titleEn="5. Responsibility & insurance">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי ואחראי לבטיחות החיה לכל אורך השהות. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor and are responsible for the pet's safety throughout the stay. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
