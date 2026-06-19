import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderPayoutRules() {
  return (
    <LegalPage
      titleHe="כללי תשלום לנותן שירות"
      titleEn="Provider Payout Rules"
      subtitleHe="תשלום אינו אוטומטי — הוא משוחרר רק לאחר שכל התנאים התקיימו."
      subtitleEn="Payout is not automatic — it is released only after all conditions are met."
    >
      <LegalSection titleHe="1. תשלום אינו אוטומטי" titleEn="1. Payout is not automatic">
        <LegalParagraph
          he="תשלום אינו משוחרר באופן אוטומטי עם ביצוע ההזמנה. הוא משוחרר רק לאחר שכל התנאים הבאים התקיימו:"
          en="A payout is not released automatically when a booking is made. It is released only after all of the following conditions are met:"
        />
        <LegalList
          items={[
            ["השירות הושלם בפועל.", "The service was actually completed."],
            ["אין מחלוקת או אירוע פתוח שמחזיק את התשלום.", "There is no dispute or open incident holding the payout."],
            ["חלון הביטול/ההחזר חלף.", "The cancellation/refund window has cleared."],
            ["מעמד המס והעסק שלך אושר.", "Your tax and business status is approved."],
            ["פרטי הבנק שלך אומתו.", "Your bank details are verified."],
            ["החשבונית הושלמה ותקינה.", "The invoice is complete and valid."],
            ["ניתן אישור מנהל.", "Admin approval is given."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. החזקת תשלום" titleEn="2. Holding a payout">
        <LegalParagraph
          he="PetWash רשאית להחזיק תשלום אם קיימת מחלוקת, חשד להונאה, אירוע בטיחות פתוח, או חוסר במסמך נדרש, עד לבירור."
          en="PetWash may hold a payout if there is a dispute, suspected fraud, an open safety incident, or a missing required document, until it is resolved."
        />
      </LegalSection>

      <LegalSection titleHe="3. קיזוז והחזרים" titleEn="3. Set-off & refunds">
        <LegalParagraph
          he="אם בוצע החזר ללקוח או חויבת בעמלה או בחיוב חוזר, PetWash רשאית לקזז סכומים אלה מתשלומים עתידיים, בכפוף לדין."
          en="If a refund was made to a customer, or a fee or chargeback applies, PetWash may set off those amounts against future payouts, subject to law."
        />
      </LegalSection>

      <LegalSection titleHe="4. עקביות עם ההסכם" titleEn="4. Consistency with the agreement">
        <LegalParagraph
          he="כללים אלה תואמים את סעיף התשלום בהסכם נותן השירות. בכל סתירה, ההסכם והדין הכופה גוברים."
          en="These rules are consistent with the payout clause of the Provider Agreement. In any conflict, the agreement and mandatory law prevail."
        />
      </LegalSection>
    </LegalPage>
  );
}
