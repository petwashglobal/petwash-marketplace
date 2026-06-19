import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function PetProfileHealthDataNotice() {
  return (
    <LegalPage
      titleHe="הודעה על פרופיל חיית המחמד ומידע בריאותי"
      titleEn="Pet Profile & Health Data Notice"
      subtitleHe="כיצד אנו אוספים ומשתמשים במידע על חיית המחמד שלך."
      subtitleEn="How we collect and use information about your pet."
    >
      <LegalSection titleHe="1. איזה מידע נאסף" titleEn="1. What information is collected">
        <LegalList
          items={[
            ["פרטי חיית המחמד: שם, גזע, גיל, משקל, תמונה.", "Pet details: name, breed, age, weight, photo."],
            ["מידע בריאותי והתנהגותי: חיסונים, רגישויות, מצבים רפואיים, הערות התנהגות.", "Health and behavioural data: vaccinations, sensitivities, medical conditions, behaviour notes."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. מטרת השימוש" titleEn="2. Purpose of use">
        <LegalParagraph
          he="המידע משמש לאספקת השירות בבטיחות, להתאמת נותן שירות מתאים, ולתזכורות טיפול. המידע על בריאות חיית המחמד אינו מידע רפואי על בני אדם."
          en="The information is used to deliver the service safely, to match a suitable provider, and for care reminders. Pet health data is not human medical data."
        />
      </LegalSection>

      <LegalSection titleHe="3. שיתוף עם נותני שירות" titleEn="3. Sharing with providers">
        <LegalParagraph
          he="מידע רלוונטי לבטיחות חיית המחמד עשוי להיחשף לנותן השירות שאישרת, לצורך מתן השירות בלבד."
          en="Information relevant to the pet's safety may be disclosed to the provider you booked, solely for delivering the service."
        />
      </LegalSection>

      <LegalSection titleHe="4. בסיס משפטי והסכמה" titleEn="4. Legal basis & consent">
        <LegalParagraph
          he='אתה מוסר מידע זה בהסכמתך ולמטרות שפורטו, בכפוף לחוק הגנת הפרטיות, התשמ"א-1981, ולמדיניות הפרטיות שלנו.'
          en="You provide this information with your consent and for the stated purposes, subject to the Protection of Privacy Law, 1981, and our Privacy Policy."
        />
      </LegalSection>

      <LegalSection titleHe="5. זכויותיך" titleEn="5. Your rights">
        <LegalParagraph
          he="באפשרותך לעיין במידע, לתקנו ולמחקו בכפוף לדין ולחובות שמירת רשומות. ראה את מדיניות הפרטיות שלנו לפרטים מלאים."
          en="You may review, correct, and delete this information subject to law and record-keeping duties. See our Privacy Policy for full details."
        />
      </LegalSection>
    </LegalPage>
  );
}
