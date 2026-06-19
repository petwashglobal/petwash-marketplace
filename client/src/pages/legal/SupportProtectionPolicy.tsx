import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function SupportProtectionPolicy() {
  return (
    <LegalPage
      titleHe="מדיניות הגנה ותמיכה"
      titleEn="Support & Protection Policy"
      subtitleHe="מה PetWash מספקת — ומה אינה מספקת — בעת בעיה."
      subtitleEn="What PetWash provides — and does not provide — when something goes wrong."
    >
      <LegalSection titleHe="1. מה אנו מספקים" titleEn="1. What we provide">
        <LegalList
          items={[
            ["כלי פלטפורמה לניהול הזמנות ותקשורת.", "Platform tools to manage bookings and communication."],
            ["רישומי הזמנות ותיעוד.", "Booking records and documentation."],
            ["תמיכה ותיווך בעת מחלוקת.", "Support and mediation in a dispute."],
            ["מנגנון לדיווח על אירועים.", "A mechanism to report incidents."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. אין מדובר בביטוח או בערובה" titleEn="2. Not insurance or a guarantee">
        <LegalParagraph
          he="הכלים והתמיכה אינם ביטוח ואינם ערובה. PetWash אינה מבטחת ואינה מתחייבת לפצות בגין נזק, אלא אם נכתב במפורש ובכתב עבור הזמנה כשירה במסגרת תוכנית מאושרת."
          en="The tools and support are not insurance and not a guarantee. PetWash is not an insurer and does not undertake to compensate for damage, unless expressly stated in writing for an eligible booking under an approved program."
        />
      </LegalSection>

      <LegalSection titleHe="3. תוכנית מותנית בלבד" titleEn="3. Conditional program only">
        <LegalParagraph
          he="אם וכאשר תוכנית הגנה כתובה תופעל, היא תחול אך ורק לפי תנאי הזכאות הכתובים שלה. ראה את נוהל התביעות. בהיעדר תוכנית כזו, אין כיסוי."
          en="If and when a written protection program is enabled, it applies only under its written eligibility terms. See the Claim Procedure. Absent such a program, there is no cover."
        />
      </LegalSection>

      <LegalSection titleHe="4. אחריות הצדדים" titleEn="4. Responsibility of the parties">
        <LegalParagraph
          he="בעלי חיות המחמד ונותני השירות נושאים באחריותם לפי הדין ולפי ההסכמים. PetWash אינה צד למתן השירות בפועל בין המשתמשים."
          en="Pet owners and providers bear their own responsibility under the law and the agreements. PetWash is not a party to the actual service performed between users."
        />
      </LegalSection>

      <LegalSection titleHe="5. זכויות צרכניות כופות" titleEn="5. Mandatory consumer rights">
        <LegalParagraph
          he="מדיניות זו אינה גורעת מזכויות צרכניות כופות לפי דין מדינת ישראל, החלות בכל מקרה."
          en="This policy does not derogate from mandatory consumer rights under the law of the State of Israel, which apply in any event."
        />
      </LegalSection>
    </LegalPage>
  );
}
