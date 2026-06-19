import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderTruthDeclaration() {
  return (
    <LegalPage
      titleHe="הצהרת אמת של נותן השירות"
      titleEn="Provider Truth Declaration"
      subtitleHe="הצהרתך כי כל הפרטים שמסרת נכונים ומלאים."
      subtitleEn="Your declaration that all details you provided are true and complete."
    >
      <LegalSection titleHe="1. ההצהרה" titleEn="1. The declaration">
        <LegalParagraph
          he="אני מצהיר כי כל הפרטים, המסמכים וההצהרות שמסרתי ל-PetWash נכונים, מדויקים ומלאים נכון למועד מסירתם."
          en="I declare that all details, documents, and statements I have provided to PetWash are true, accurate, and complete as of the date they were provided."
        />
      </LegalSection>

      <LegalSection titleHe="2. חובת עדכון" titleEn="2. Duty to update">
        <LegalParagraph
          he="אני מתחייב לעדכן את PetWash ללא דיחוי אם פרט כלשהו משתנה — לרבות מעמד משפטי, רישיון, ביטוח או יכולת לספק את השירות."
          en="I undertake to update PetWash without delay if any detail changes — including legal status, licence, insurance, or ability to provide the service."
        />
      </LegalSection>

      <LegalSection titleHe="3. כשירות לספק שירות" titleEn="3. Fitness to provide service">
        <LegalList
          items={[
            ["אני בן 18 לפחות.", "I am at least 18 years old."],
            ["אני רשאי כדין לספק את השירות הרלוונטי.", "I am legally permitted to provide the relevant service."],
            ["אין מניעה משפטית, בריאותית או בטיחותית הידועה לי.", "There is no legal, health, or safety impediment known to me."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. תוצאות מסירת פרטים כוזבים" titleEn="4. Consequences of false details">
        <LegalParagraph
          he="מסירת פרטים כוזבים או חלקיים עלולה להביא להשעיה מיידית, סיום ההתקשרות, עיכוב תשלומים ולחבות משפטית לפי דין."
          en="Providing false or partial details may lead to immediate suspension, termination of the engagement, withholding of payouts, and legal liability under the law."
        />
      </LegalSection>
    </LegalPage>
  );
}
