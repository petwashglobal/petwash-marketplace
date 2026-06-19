import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function GroomingManual() {
  return (
    <LegalPage
      titleHe="מדריך טיפוח (גרומינג)"
      titleEn="Grooming Manual"
      subtitleHe="סטנדרט טיפול ובטיחות לשירותי טיפוח."
      subtitleEn="Care and safety standard for grooming services."
    >
      <LegalSection titleHe="1. הערכה לפני טיפוח" titleEn="1. Pre-groom assessment">
        <LegalList
          items={[
            ["בדוק את העור, הפרווה, האוזניים והציפורניים.", "Check the skin, coat, ears, and nails."],
            ["ברר רגישויות, אלרגיות ומצבים רפואיים.", "Ask about sensitivities, allergies, and medical conditions."],
            ["העריך את מזג החיה והתאמתה לטיפוח.", "Assess the pet's temperament and fitness for grooming."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. במהלך הטיפוח" titleEn="2. During grooming">
        <LegalList
          items={[
            ["השתמש בציוד נקי ובטוח ובמוצרים מתאימים בלבד.", "Use clean, safe equipment and only suitable products."],
            ["שמור על מים בטמפרטורה נוחה והימנע מכוויות.", "Keep water at a comfortable temperature and avoid burns."],
            ["אל תשאיר חיה ללא השגחה על שולחן או באמבט.", "Never leave a pet unattended on a table or in a bath."],
            ["עצור אם החיה במצוקה או תוקפנית.", "Stop if the pet is distressed or aggressive."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. היגיינה ובטיחות" titleEn="3. Hygiene & safety">
        <LegalParagraph
          he="חטא ציוד בין חיות, מנע הדבקה, והשתמש בכלים חדים בזהירות. הימנע ממוצרים שאינם מתאימים לחיה."
          en="Disinfect equipment between pets, prevent cross-contamination, and use sharp tools with care. Avoid products unsuitable for the pet."
        />
      </LegalSection>

      <LegalSection titleHe="4. חירום ודיווח" titleEn="4. Emergency & reporting">
        <LegalParagraph
          he="אם נגרמה פציעה או תגובה (חתך, כוויה, אלרגיה), עצור, טפל ראשונית, צור קשר עם הבעלים, ופנה לוטרינר בחירום. דווח מיד דרך הפלטפורמה."
          en="If an injury or reaction occurs (cut, burn, allergy), stop, give first aid, contact the owner, and seek a vet in an emergency. Report immediately through the platform."
        />
      </LegalSection>

      <LegalSection titleHe="5. אחריות וביטוח" titleEn="5. Responsibility & insurance">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי ואחראי לבטיחות הטיפוח. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor and are responsible for grooming safety. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
