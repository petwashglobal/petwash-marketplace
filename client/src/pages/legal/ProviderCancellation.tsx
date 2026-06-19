import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderCancellation() {
  return (
    <LegalPage
      titleHe="ביטולים — נותן שירות"
      titleEn="Provider Cancellation"
      subtitleHe="הכללים החלים כאשר נותן שירות מבטל הזמנה."
      subtitleEn="The rules that apply when a provider cancels a booking."
    >
      <LegalSection titleHe="1. כבד את ההזמנות שאישרת" titleEn="1. Honour bookings you accept">
        <LegalParagraph
          he="לאחר שאישרת הזמנה, עליך לכבדה ולהגיע בזמן. ביטול עלול לפגוע בלקוח ובאמון בפלטפורמה."
          en="Once you accept a booking, you must honour it and arrive on time. Cancelling can harm the customer and trust in the platform."
        />
      </LegalSection>

      <LegalSection titleHe="2. ביטול בהתראה מוקדמת" titleEn="2. Cancellation with notice">
        <LegalParagraph
          he="אם עליך לבטל, עשה זאת מוקדם ככל האפשר דרך הפלטפורמה כדי לאפשר תיאום חלופי ללקוח."
          en="If you must cancel, do so as early as possible through the platform to allow the customer to re-book."
        />
      </LegalSection>

      <LegalSection titleHe="3. ביטול מטעמי בטיחות" titleEn="3. Cancellation for safety">
        <LegalParagraph
          he="מותר ואף נדרש לבטל אם קיים סיכון בטיחותי — למשל חיה תוקפנית, מצב בריאותי, או תנאים מסוכנים. יש לדווח על הסיבה."
          en="You may and should cancel if there is a safety risk — e.g. an aggressive animal, a health condition, or dangerous conditions. Report the reason."
        />
      </LegalSection>

      <LegalSection titleHe="4. השלכות אי-הגעה" titleEn="4. Consequences of no-show">
        <LegalList
          items={[
            ["ביטולים חוזרים או אי-הגעה עלולים להביא להשעיה.", "Repeated cancellations or no-shows may lead to suspension."],
            ["הלקוח עשוי להיות זכאי להחזר מלא ללא דמי ביטול.", "The customer may be entitled to a full refund with no cancellation fee."],
            ["תשלום לא ישוחרר עבור שירות שלא בוצע.", "No payout is released for a service that was not performed."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="5. עקביות עם מדיניות הלקוח" titleEn="5. Consistency with customer policy">
        <LegalParagraph
          he="כללים אלה תואמים את מדיניות הביטול וההחזר ואת הסכם נותן השירות."
          en="These rules are consistent with the Cancellation & Refund Policy and the Provider Agreement."
        />
      </LegalSection>
    </LegalPage>
  );
}
