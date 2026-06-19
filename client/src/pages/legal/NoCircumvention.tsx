import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function NoCircumvention() {
  return (
    <LegalPage
      titleHe="איסור עקיפת הפלטפורמה"
      titleEn="No Circumvention"
      subtitleHe="אין להעביר הזמנות, לקוחות או תשלומים אל מחוץ ל-PetWash."
      subtitleEn="You may not move bookings, customers, or payments off PetWash."
    >
      <LegalSection titleHe="1. הכלל" titleEn="1. The rule">
        <LegalParagraph
          he="אסור לעקוף את PetWash מול לקוחות או נותני שירות שהגיעו דרך הפלטפורמה — לרבות העברת הזמנות או תשלומים אל מחוץ למערכת."
          en="You may not circumvent PetWash with customers or providers introduced through the platform — including moving bookings or payments outside the system."
        />
      </LegalSection>

      <LegalSection titleHe="2. דוגמאות לעקיפה" titleEn="2. Examples of circumvention">
        <LegalList
          items={[
            ["בקשה מלקוח לשלם ישירות במזומן או בהעברה פרטית.", "Asking a customer to pay directly in cash or by private transfer."],
            ["מסירת פרטי קשר אישיים כדי לעקוף את ההזמנה בפלטפורמה.", "Sharing personal contact details to bypass the in-platform booking."],
            ["העברת לקוח שהגיע דרך PetWash לשירות חיצוני.", "Diverting a PetWash-introduced customer to an off-platform service."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. הפרה יסודית" titleEn="3. Material breach">
        <LegalParagraph
          he="עקיפה מהווה הפרה יסודית של ההסכם ועלולה להביא להשעיה מיידית, סיום ההתקשרות, החזקת תשלומים ותביעת פיצויים בהתאם לדין."
          en="Circumvention is a material breach of the agreement and may lead to immediate suspension, termination, withholding of payouts, and a claim for damages in accordance with law."
        />
      </LegalSection>

      <LegalSection titleHe="4. דיווח" titleEn="4. Reporting">
        <LegalParagraph
          he="אם הוצע לך לעקוף את הפלטפורמה, דווח על כך ל-PetWash דרך ערוצי התמיכה."
          en="If you are offered an off-platform arrangement, report it to PetWash through the support channels."
        />
      </LegalSection>
    </LegalPage>
  );
}
