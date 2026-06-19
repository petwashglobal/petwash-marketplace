import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderDocumentUpload() {
  return (
    <LegalPage
      titleHe="העלאת מסמכים — נותן שירות"
      titleEn="Provider Document Upload"
      subtitleHe="אילו מסמכים נדרשים וכיצד אנו מטפלים בהם."
      subtitleEn="Which documents are required and how we handle them."
    >
      <LegalSection titleHe="1. מסמכים נדרשים" titleEn="1. Required documents">
        <LegalList
          items={[
            ["מסמך זיהוי תקף.", "A valid identity document."],
            ["אישור מעמד עסקי (עוסק פטור / עוסק מורשה / חברה בע\"מ).", "Proof of business status (Osek Patur / Osek Murshe / limited company)."],
            ["רישיונות או היתרים הנדרשים לשירות, אם קיימים.", "Licences or permits required for the service, if any."],
            ["פרטי בנק לאימות תשלומים.", "Bank details for payout verification."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. נכונות ועדכניות" titleEn="2. Accuracy & currency">
        <LegalParagraph
          he="כל מסמך חייב להיות נכון, קריא ובתוקף. עליך להחליף מסמך שפג תוקפו ולעדכן שינויים."
          en="Every document must be true, legible, and valid. You must replace an expired document and update any changes."
        />
      </LegalSection>

      <LegalSection titleHe="3. שמירה ואבטחה" titleEn="3. Storage & security">
        <LegalParagraph
          he="המסמכים נשמרים באופן מאובטח ומשמשים לאימות ולציות בלבד, בהתאם לחוק הגנת הפרטיות ולמדיניות הפרטיות שלנו."
          en="Documents are stored securely and used only for verification and compliance, in accordance with the Protection of Privacy Law and our Privacy Policy."
        />
      </LegalSection>

      <LegalSection titleHe="4. בדיקה ידנית" titleEn="4. Manual review">
        <LegalParagraph
          he="המסמכים נבדקים ידנית. PetWash רשאית לבקש מסמכים נוספים, ולעכב אישור או תשלום עד להשלמתם."
          en="Documents are reviewed manually. PetWash may request additional documents and may hold approval or payout until they are complete."
        />
      </LegalSection>

      <LegalSection titleHe="5. שמירת רשומות" titleEn="5. Record retention">
        <LegalParagraph
          he="מסמכים עשויים להישמר לתקופה הנדרשת בדין (בדרך כלל עד 7 שנים) לצורכי מס, חשבונאות וציות."
          en="Documents may be retained for the period required by law (typically up to 7 years) for tax, accounting, and compliance purposes."
        />
      </LegalSection>
    </LegalPage>
  );
}
