import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ClaimProcedure() {
  return (
    <LegalPage
      titleHe="נוהל תביעה (מותנה)"
      titleEn="Claim Procedure (Conditional)"
      subtitleHe="חל אך ורק אם וכאשר תוכנית הגנה כתובה הופעלה."
      subtitleEn="Applies only if and when a written protection program has been enabled."
    >
      <LegalSection titleHe="0. תנאי מקדים — מותנה" titleEn="0. Precondition — conditional">
        <LegalParagraph
          he="נוהל זה מותנה. הוא אינו יוצר כל זכות לפיצוי בהיעדר תוכנית הגנה כתובה ומופעלת. כל עוד לא הופעלה תוכנית כזו עבור הזמנה כשירה, אין כיסוי ואין תביעה. PetWash אינה מבטח."
          en="This procedure is conditional. It creates no right to compensation in the absence of a written, enabled protection program. Until such a program is enabled for an eligible booking, there is no cover and no claim. PetWash is not an insurer."
        />
      </LegalSection>

      <LegalSection titleHe="1. זכאות" titleEn="1. Eligibility">
        <LegalList
          items={[
            ["חל רק על הזמנות ששולמו דרך PetWash.", "Applies only to bookings paid through PetWash."],
            ["חל רק אם התוכנית הכתובה הייתה פעילה עבור אותה הזמנה.", "Applies only if the written program was active for that booking."],
            ["המשתמש עמד בכל תנאי הפלטפורמה והדין.", "The user complied with all platform terms and the law."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. מועד הגשה" titleEn="2. Claim deadline">
        <LegalParagraph
          he="יש להגיש תביעה בתוך פרק הזמן הקבוע בתוכנית הכתובה (למשל בתוך מספר ימים מהאירוע). תביעה שתוגש באיחור עלולה להידחות."
          en="A claim must be submitted within the period set in the written program (e.g. within a number of days of the event). A late claim may be rejected."
        />
      </LegalSection>

      <LegalSection titleHe="3. ראיות נדרשות" titleEn="3. Required evidence">
        <LegalList
          items={[
            ["מספר ההזמנה ופרטי התשלום.", "The booking number and payment details."],
            ["תיאור האירוע, תמונות ומסמכים תומכים.", "A description of the event, photos, and supporting documents."],
            ["אסמכתאות להוצאה או לנזק (למשל קבלות וטרינר).", "Proof of expense or damage (e.g. veterinary receipts)."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. החרגות" titleEn="4. Exclusions">
        <LegalList
          items={[
            ["אירועים מחוץ לפלטפורמה אינם מכוסים.", "Off-platform events are not covered."],
            ["נזק שנגרם בזדון או ברשלנות חמורה של התובע אינו מכוסה.", "Damage caused by the claimant's intentional misconduct or gross negligence is not covered."],
            ["מצבים שהיו קיימים מראש או שלא דווחו אינם מכוסים.", "Pre-existing or undisclosed conditions are not covered."],
            ["הוצאות עקיפות, אובדן רווח ונזק לא ממוני אינם מכוסים, אלא אם נכתב אחרת.", "Indirect costs, loss of profit, and non-pecuniary damage are not covered, unless stated otherwise."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="5. סכום מרבי והשתתפות עצמית" titleEn="5. Maximum amount & deductible">
        <LegalParagraph
          he="הפיצוי, אם יאושר, כפוף לסכום מרבי ולהשתתפות עצמית כפי שנקבעו בתוכנית הכתובה."
          en="Compensation, if approved, is subject to a maximum amount and a deductible as set in the written program."
        />
      </LegalSection>

      <LegalSection titleHe="6. בדיקה והחלטה" titleEn="6. Review & decision">
        <LegalParagraph
          he="PetWash תבחן את התביעה ותחליט לגופה לפי תנאי התוכנית והדין. החלטה אינה גורעת מזכויות כופות לפי דין."
          en="PetWash will review the claim and decide on its merits under the program terms and the law. A decision does not derogate from mandatory rights under the law."
        />
      </LegalSection>
    </LegalPage>
  );
}
