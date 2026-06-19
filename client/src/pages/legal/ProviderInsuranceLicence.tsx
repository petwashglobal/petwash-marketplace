import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderInsuranceLicence() {
  return (
    <LegalPage
      titleHe="ביטוח ורישיון — נותן שירות"
      titleEn="Provider Insurance & Licence"
      subtitleHe="אחזקת ביטוח, רישיונות והיתרים היא באחריותך הבלעדית."
      subtitleEn="Holding insurance, licences, and permits is your sole responsibility."
    >
      <LegalSection titleHe="1. אחריותך הבלעדית" titleEn="1. Your sole responsibility">
        <LegalParagraph
          he="אתה אחראי לבדך להחזיק את הביטוח, הרישיונות וההיתרים הנדרשים לפעילותך לפי דין מדינת ישראל."
          en="You are solely responsible for holding the insurance, licences, and permits required for your activity under the law of the State of Israel."
        />
      </LegalSection>

      <LegalSection titleHe="2. PetWash אינה מבטחת אותך" titleEn="2. PetWash does not insure you">
        <LegalParagraph
          he="PetWash אינה מספקת לך ביטוח ואינה ערבה לכיסוי ביטוחי, אלא אם נכתב במפורש ובכתב עבור מקרה ספציפי."
          en="PetWash does not provide you with insurance and does not guarantee any insurance cover, unless expressly stated in writing for a specific case."
        />
      </LegalSection>

      <LegalSection titleHe="3. אסור להציג מצג ביטוח כוזב" titleEn="3. No false insurance claim">
        <LegalParagraph
          he='אסור להציג עצמך כ"מבוטח", "מכוסה" או "מאושר" אלא אם מעמד זה מוצג בפועל בלוח הבקרה שלך. ראה את הנחיות שימוש במותג.'
          en='You may not present yourself as "insured", "covered", or "approved" unless your dashboard actually shows that status. See the Brand-Use Rules.'
        />
      </LegalSection>

      <LegalSection titleHe="4. תוקף שוטף" titleEn="4. Ongoing validity">
        <LegalParagraph
          he="עליך לשמור על תוקף הביטוח והרישיונות ולעדכן את PetWash על כל שינוי. תוקף פג עלול להשהות את פעילותך."
          en="You must keep your insurance and licences valid and update PetWash of any change. An expired document may pause your activity."
        />
      </LegalSection>
    </LegalPage>
  );
}
