import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function CommunityGuidelines() {
  return (
    <LegalPage
      titleHe="הנחיות הקהילה"
      titleEn="Community Guidelines"
      subtitleHe="כיצד אנו מצפים מכולם להתנהג בקהילת PetWash."
      subtitleEn="How we expect everyone to behave in the PetWash community."
    >
      <LegalSection titleHe="1. כבוד הדדי" titleEn="1. Mutual respect">
        <LegalParagraph
          he="התייחס ללקוחות, לנותני שירות ולצוות בכבוד. הטרדה, אלימות מילולית, איומים או אפליה אסורים."
          en="Treat customers, providers, and staff with respect. Harassment, verbal abuse, threats, or discrimination are not allowed."
        />
      </LegalSection>

      <LegalSection titleHe="2. בטיחות חיות מחמד" titleEn="2. Pet safety">
        <LegalParagraph
          he="שלום חיות המחמד הוא בראש סדר העדיפויות. כל התנהגות המסכנת חיה אסורה ותטופל בחומרה."
          en="Pet welfare comes first. Any behaviour that endangers an animal is prohibited and will be treated seriously."
        />
      </LegalSection>

      <LegalSection titleHe="3. יושרה" titleEn="3. Integrity">
        <LegalList
          items={[
            ["אין להונות, להציג מצג שווא או לזייף זהות.", "No fraud, misrepresentation, or false identity."],
            ["אין לעקוף את הפלטפורמה לתשלומים או הזמנות.", "No circumventing the platform for payments or bookings."],
            ["אין לפרסם ביקורות כוזבות או תוכן מטעה.", "No fake reviews or misleading content."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. עמידה בדין" titleEn="4. Compliance with law">
        <LegalParagraph
          he="כל המשתמשים מחויבים לפעול לפי דין מדינת ישראל, לרבות דיני בעלי חיים, פרטיות והגנת הצרכן."
          en="All users must act in accordance with the law of the State of Israel, including animal, privacy, and consumer-protection law."
        />
      </LegalSection>

      <LegalSection titleHe="5. אכיפה" titleEn="5. Enforcement">
        <LegalParagraph
          he="הפרת ההנחיות עלולה להביא לאזהרה, הסרת תוכן, השעיה או סגירת חשבון, בהתאם לחומרה ולדין."
          en="A breach of these guidelines may lead to a warning, content removal, suspension, or account closure, according to severity and law."
        />
      </LegalSection>
    </LegalPage>
  );
}
