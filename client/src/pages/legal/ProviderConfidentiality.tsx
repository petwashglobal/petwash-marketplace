import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderConfidentiality() {
  return (
    <LegalPage
      titleHe="סודיות נותן השירות"
      titleEn="Provider Confidentiality"
      subtitleHe="חובת השמירה על סודיות מידע של לקוחות ושל PetWash."
      subtitleEn="Your duty to keep customer and PetWash information confidential."
    >
      <LegalSection titleHe="1. מידע סודי" titleEn="1. Confidential information">
        <LegalParagraph
          he="כל מידע על לקוחות, חיות מחמד, בתים, תשלומים ועל PetWash שנחשפת אליו במהלך מתן השירות הוא סודי."
          en="All information about customers, pets, homes, payments, and PetWash that you are exposed to while providing the service is confidential."
        />
      </LegalSection>

      <LegalSection titleHe="2. שימוש מותר בלבד" titleEn="2. Permitted use only">
        <LegalParagraph
          he="מותר להשתמש במידע אך ורק לצורך מתן השירות שאושר. אין להעתיק, לשמור, להפיץ או להשתמש בו לכל מטרה אחרת."
          en="You may use the information solely to provide the approved service. You may not copy, retain, distribute, or use it for any other purpose."
        />
      </LegalSection>

      <LegalSection titleHe="3. פרטיות" titleEn="3. Privacy">
        <LegalParagraph
          he='עליך לשמור על פרטיות הלקוח בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, ולא לצלם או לשתף מידע ללא הסכמה.'
          en="You must protect customer privacy under the Protection of Privacy Law, 1981, and may not photograph or share information without consent."
        />
      </LegalSection>

      <LegalSection titleHe="4. המשך תוקף" titleEn="4. Survival">
        <LegalParagraph
          he="חובת הסודיות ממשיכה לחול גם לאחר סיום ההתקשרות עם PetWash."
          en="The confidentiality duty continues to apply even after your engagement with PetWash ends."
        />
      </LegalSection>

      <LegalSection titleHe="5. הפרה" titleEn="5. Breach">
        <LegalParagraph
          he="הפרת סודיות מהווה הפרה יסודית ועלולה להביא להשעיה, סיום ולחבות לפי דין."
          en="A breach of confidentiality is a material breach and may lead to suspension, termination, and liability under the law."
        />
      </LegalSection>
    </LegalPage>
  );
}
