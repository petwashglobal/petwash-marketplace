import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderIndependentStatus() {
  return (
    <LegalPage
      titleHe="מעמד קבלן עצמאי"
      titleEn="Independent Contractor Status"
      subtitleHe="הבהרה: אין יחסי עובד-מעביד בינך לבין PetWash."
      subtitleEn="Clarification: no employer-employee relationship exists between you and PetWash."
    >
      <LegalSection titleHe="1. עצמאי, לא עובד" titleEn="1. Independent, not an employee">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי. אין בינך לבין PetWash יחסי עובד-מעביד, שותפות או שליחות, ואינך זכאי לזכויות עובד."
          en="You act as an independent contractor. No employer-employee, partnership, or agency relationship exists between you and PetWash, and you are not entitled to employee rights."
        />
      </LegalSection>

      <LegalSection titleHe="2. עצמאות תפעולית" titleEn="2. Operational independence">
        <LegalList
          items={[
            ["אתה קובע אם, מתי ואילו הזמנות לקבל.", "You decide whether, when, and which bookings to accept."],
            ["אתה מספק את הכלים והאמצעים שלך, אלא אם נאמר אחרת.", "You provide your own tools and means, unless stated otherwise."],
            ["אתה רשאי לספק שירותים גם לאחרים.", "You are free to provide services to others as well."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. מסים וביטוח לאומי" titleEn="3. Taxes & National Insurance">
        <LegalParagraph
          he='אתה אחראי לבדך לדיווח ולתשלום מס הכנסה, מע"מ וביטוח לאומי, ולהוצאת חשבוניות כדין.'
          en="You are solely responsible for reporting and paying income tax, VAT, and National Insurance (Bituach Leumi), and for issuing invoices lawfully."
        />
      </LegalSection>

      <LegalSection titleHe="4. ביטוח עצמי" titleEn="4. Your own insurance">
        <LegalParagraph
          he="אחזקת ביטוח מתאים לפעילותך היא באחריותך הבלעדית. PetWash אינה מספקת לך ביטוח אלא אם נכתב במפורש."
          en="Holding suitable insurance for your activity is your sole responsibility. PetWash does not provide you with insurance unless expressly stated."
        />
      </LegalSection>

      <LegalSection titleHe="5. עקביות עם ההסכם" titleEn="5. Consistency with the agreement">
        <LegalParagraph
          he="מעמד זה תואם להסכם נותן השירות. בכל סתירה, ההסכם והדין הכופה גוברים."
          en="This status is consistent with the Provider Agreement. In any conflict, the agreement and mandatory law prevail."
        />
      </LegalSection>
    </LegalPage>
  );
}
