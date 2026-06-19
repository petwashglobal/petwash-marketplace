import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderBrandUse() {
  return (
    <LegalPage
      titleHe="שימוש במותג — נותן שירות"
      titleEn="Provider Brand-Use Rules"
      subtitleHe="הכללים לשימוש בשם, בלוגו ובמעמד של PetWash."
      subtitleEn="The rules for using the PetWash name, logo, and status claims."
    >
      <LegalSection titleHe="1. אין שימוש בלוגו ללא היתר" titleEn="1. No logo use without permission">
        <LegalParagraph
          he="אסור להשתמש בשם, בלוגו או בסימני המסחר של PetWash ללא היתר מפורש ובכתב. הלוגו נושא זכויות קניין רוחני."
          en="You may not use the PetWash name, logo, or trademarks without express written permission. The logo carries intellectual-property rights."
        />
      </LegalSection>

      <LegalSection titleHe="2. אין מצג מעמד כוזב" titleEn="2. No false status claim">
        <LegalParagraph
          he='אסור להציג עצמך כ"מבוטח", "מכוסה" או "מאושר" אלא אם מעמד זה מוצג בפועל בלוח הבקרה שלך. כל מצג חייב לשקף את המעמד האמיתי.'
          en='You may not present yourself as "insured", "covered", or "approved" unless your dashboard actually shows that status. Any claim must reflect your true status.'
        />
      </LegalSection>

      <LegalSection titleHe="3. שימוש מותר" titleEn="3. Permitted use">
        <LegalList
          items={[
            ["ציון עובדתי שאתה מספק שירותים דרך PetWash, ללא טענת חסות או אישור מעבר למה שמוצג.", "Factually stating that you provide services through PetWash, without claiming sponsorship or approval beyond what is shown."],
            ["שימוש בחומרים שמסרה PetWash לפי ההנחיות בלבד.", "Using materials provided by PetWash only as instructed."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. הפרה" titleEn="4. Breach">
        <LegalParagraph
          he="שימוש בלתי מורשה במותג או מצג כוזב מהווים הפרה יסודית ועלולים להביא להשעיה, סיום ולחבות לפי דין."
          en="Unauthorised brand use or a false claim is a material breach and may lead to suspension, termination, and liability under the law."
        />
      </LegalSection>
    </LegalPage>
  );
}
