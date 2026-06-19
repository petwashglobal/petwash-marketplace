import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function WalletEGiftTerms() {
  return (
    <LegalPage
      titleHe="תנאי ארנק ו-eGift"
      titleEn="Wallet & eGift Terms"
      subtitleHe="התנאים החלים על יתרת הארנק ועל כרטיסי המתנה האלקטרוניים."
      subtitleEn="The terms governing your wallet balance and electronic gift cards."
    >
      <LegalSection titleHe="1. אינו כסף מזומן" titleEn="1. Not cash">
        <LegalParagraph
          he="יתרת הארנק ו-eGift הן ערך שמור לשימוש בפלטפורמת PetWash. הן אינן כסף מזומן ואינן ניתנות לפדיון, להמרה או למשיכה במזומן."
          en="Wallet and eGift balances are stored value for use on the PetWash platform. They are not cash and are not redeemable, convertible, or withdrawable as cash."
        />
      </LegalSection>

      <LegalSection titleHe="2. מימוש ב-PetWash בלבד" titleEn="2. PetWash-only redemption">
        <LegalParagraph
          he="ניתן לממש יתרה לשירותים ולמוצרים של PetWash בלבד, בכפוף לזמינות ולתנאי השירות הרלוונטי."
          en="Balances may be redeemed for PetWash services and products only, subject to availability and the terms of the relevant service."
        />
      </LegalSection>

      <LegalSection titleHe="3. חשבון ואימות" titleEn="3. Account & verification">
        <LegalParagraph
          he="PetWash רשאית לדרוש הרשמה לחשבון ואימות זהות כתנאי לטעינה, למימוש או לשמירה של יתרה, לרבות לצורך עמידה בדין."
          en="PetWash may require account registration and identity verification as a condition for topping up, redeeming, or holding a balance, including for legal compliance."
        />
      </LegalSection>

      <LegalSection titleHe="4. הונאה ו-Chargeback" titleEn="4. Fraud & chargeback">
        <LegalParagraph
          he="במקרה של חשד להונאה, חיוב חוזר (chargeback) או שימוש לרעה, PetWash רשאית לחסום מימוש, להקפיא יתרה ולבטל ערך שנוצר שלא כדין."
          en="In case of suspected fraud, chargeback, or misuse, PetWash may block redemption, freeze a balance, and reverse value created unlawfully."
        />
      </LegalSection>

      <LegalSection titleHe="5. נעילה לחשבון" titleEn="5. Lock to account">
        <LegalList
          items={[
            ["יתרה עשויה להינעל לחשבון מזוהה כדי למנוע ניצול לרעה.", "A balance may be locked to an identified account to prevent abuse."],
            ["eGift עשוי להינעל לנמען בעת ההפעלה.", "An eGift may be locked to the recipient upon activation."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="6. שירותי תשלום" titleEn="6. Payment services">
        <LegalParagraph
          he='טעינה ומימוש כפופים לחוק שירותי תשלום, התשע"ט-2019, ולדין החל, ומתבצעים בשקלים חדשים (₪).'
          en="Top-up and redemption are subject to the Payment Services Law, 2019, and applicable law, and are conducted in New Israeli Shekels (₪)."
        />
      </LegalSection>
    </LegalPage>
  );
}
