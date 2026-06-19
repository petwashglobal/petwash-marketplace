import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderTaxBusinessDeclaration() {
  return (
    <LegalPage
      titleHe="הצהרת מס ומעמד עסקי"
      titleEn="Tax & Business Status Declaration"
      subtitleHe="הצהרה על מעמדך העסקי לצורכי מס וחשבוניות."
      subtitleEn="Declaration of your business status for tax and invoicing purposes."
    >
      <LegalSection titleHe="1. סיווג המעמד" titleEn="1. Status classification">
        <LegalParagraph
          he="עליך להצהיר על מעמדך העסקי לפי אחת מהאפשרויות הבאות:"
          en="You must declare your business status as one of the following:"
        />
        <LegalList
          items={[
            ["עוסק פטור.", "Osek Patur (VAT-exempt dealer)."],
            ["עוסק מורשה.", "Osek Murshe (VAT-registered dealer)."],
            ['חברה בע"מ.', "Limited company (Chevra Ba'am)."],
            ["יחיד (ללא עוסק) — בכפוף לדין ולמגבלות הפלטפורמה.", "Individual (no business registration) — subject to law and platform limits."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. מסמכים תומכים" titleEn="2. Supporting documents">
        <LegalParagraph
          he="עליך להעלות מסמכים תקפים התומכים במעמד שהצהרת (למשל אישור עוסק, תעודת התאגדות), והם חייבים להיות נכונים ומדויקים."
          en="You must upload valid documents supporting the status you declared (e.g. dealer certificate, certificate of incorporation), and they must be true and accurate."
        />
      </LegalSection>

      <LegalSection titleHe='3. חשבוניות ומע"מ' titleEn="3. Invoices & VAT">
        <LegalParagraph
          he='אתה אחראי להוצאת חשבוניות וקבלות כדין בהתאם למעמדך, ולדיווח מע"מ ומס כנדרש. PetWash אינה אחראית לחבות המס שלך.'
          en="You are responsible for issuing invoices and receipts lawfully according to your status, and for reporting VAT and tax as required. PetWash is not responsible for your tax liability."
        />
      </LegalSection>

      <LegalSection titleHe="4. אישור לפני תשלום" titleEn="4. Approval before payout">
        <LegalParagraph
          he="מעמד המס והעסק שלך חייב להיות מאושר לפני שחרור תשלום, כפי שמפורט בכללי התשלום."
          en="Your tax and business status must be approved before any payout is released, as set out in the Payout Rules."
        />
      </LegalSection>

      <LegalSection titleHe="5. הצהרת אמת" titleEn="5. Truth declaration">
        <LegalParagraph
          he="אני מצהיר כי המעמד והמסמכים שמסרתי נכונים. מסירת פרטים כוזבים עלולה להביא להשעיה ולחבות לפי דין."
          en="I declare that the status and documents I provided are true. Providing false details may lead to suspension and liability under the law."
        />
      </LegalSection>
    </LegalPage>
  );
}
