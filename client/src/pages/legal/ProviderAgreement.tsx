import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

/**
 * Provider Agreement — the master, bilingual (He/En) provider & host services
 * agreement. This merges the repo's Israel-specific operational clauses (payout
 * gates, 6-month re-confirmation, no-auto-approval, Bituach Leumi, עוסק פטור/מורשה)
 * with the four protective clauses from the May-2026 "Provider & Host Services
 * Agreement" PDF that were missing here:
 *   §6  Background checks & verification (consent)
 *   §14 Insurance disclaimer (strengthened — "not an insurance company")
 *   §15 Limitation of liability (as-is/as-available, no income guarantee, no indirect damages)
 *   §18 Digital signature & consent (electronic-evidence clause)
 *
 * ⚠️ COUNSEL GATE: these four sections are drafted from the CEO's PDF and are
 * NOT yet lawyer-approved. This binds providers — do NOT treat as final until
 * PetWash counsel (עו״ד/רו״ח) signs off, and wire DocuSeal e-sign before relying
 * on §18 as evidence. See docs/legal/contract-inventory-2026-07.md.
 */
export default function ProviderAgreement() {
  return (
    <LegalPage
      titleHe="הסכם נותן שירות ומארח"
      titleEn="Provider & Host Services Agreement"
      subtitleHe="התנאים החלים על נותני שירות ומארחים המבקשים להציע שירותים דרך PetWash."
      subtitleEn="The terms for providers and hosts who wish to offer services through PetWash."
    >
      <LegalSection titleHe="1. כשירות" titleEn="1. Eligibility">
        <LegalList
          items={[
            ["עליך להיות בן 18 לפחות.", "You must be at least 18 years old."],
            ["עליך למסור פרטים משפטיים נכונים ומלאים.", "You must provide accurate and complete legal details."],
            ["עליך להיות רשאי כדין לספק את השירות הרלוונטי.", "You must be legally permitted to provide the relevant service."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. אין אישור אוטומטי" titleEn="2. No automatic approval">
        <LegalParagraph
          he="הגשת בקשה אינה מהווה אישור. האישור ניתן ידנית והוא ספציפי לשירות — אישור לשירות אחד אינו מהווה אישור לשירות אחר."
          en="Submitting an application is not approval. Approval is granted manually and is service-specific — approval for one service is not approval for another."
        />
      </LegalSection>

      <LegalSection titleHe="3. מעמד קבלן עצמאי" titleEn="3. Independent contractor">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי. אתה אחראי לבדך למסים שלך, לביטוח לאומי, להוצאת חשבוניות, ולביטוחים שלך. אין יחסי עובד-מעביד בינך לבין PetWash."
          en="You act as an independent contractor. You are solely responsible for your taxes, National Insurance (Bituach Leumi), issuing invoices, and your own insurance. No employer-employee relationship exists between you and PetWash."
        />
      </LegalSection>

      <LegalSection titleHe="4. הצהרת מס ומעמד עסקי" titleEn="4. Tax & business declaration">
        <LegalList
          items={[
            ["עליך להצהיר על מעמדך: עוסק פטור, עוסק מורשה, חברה בע\"מ, או יחיד.", "You must declare your status: Osek Patur, Osek Murshe, limited company (Chevra Ba'am), or individual."],
            ["המסמכים שתעלה חייבים להיות נכונים ומדויקים; מסירת פרטים כוזבים עלולה להביא להשעיה.", "Documents you upload must be true and accurate; providing false details may lead to suspension."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="5. ציות ובדיקה ידנית" titleEn="5. Compliance & manual review">
        <LegalParagraph
          he="הציות נבדק ידנית. PetWash רשאית לבקש מסמכים נוספים, לדחות, להחזיק או לאשר בקשה לפי שיקול דעתה ובהתאם לדין."
          en="Compliance is reviewed manually. PetWash may request additional documents and may reject, hold, or approve an application at its discretion and in accordance with law."
        />
      </LegalSection>

      <LegalSection titleHe="6. בדיקות ואימות" titleEn="6. Background checks & verification">
        <LegalParagraph
          he="PetWash רשאית לבצע או לבקש הליכי אימות, לרבות בדיקת זהות, מסמכים, המלצות ורקע, בכפוף לדין. בהגשת הבקשה אתה מסכים לביצוע בדיקות אלה, ואישורך תלוי בתוצאותיהן."
          en="PetWash may conduct or request verification procedures, including identity, document, reference and background checks, subject to law. By applying you consent to these checks, and your approval depends on their results."
        />
      </LegalSection>

      <LegalSection titleHe="7. חובות בטיחות וטיפול" titleEn="7. Safety & care duties">
        <LegalList
          items={[
            ["עליך לפעול בבטיחות, לשמור על שלום חיות המחמד, ולפעול לפי כל דין רלוונטי.", "You must act safely, protect the welfare of pets, and comply with all applicable law."],
            ["בעת גישה לבית הלקוח עליך לשמור על סודיות, פרטיות וכבוד הרכוש.", "When accessing a customer's home you must maintain confidentiality, privacy, and respect for property."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="8. הזמנות וביטולים" titleEn="8. Bookings & cancellations">
        <LegalParagraph
          he="עליך לכבד הזמנות שאישרת, להגיע בזמן, ולנהוג לפי מדיניות הביטול של PetWash. אי-הגעה חוזרת עלולה להביא להשעיה."
          en="You must honour bookings you accept, arrive on time, and follow PetWash's cancellation policy. Repeated no-shows may lead to suspension."
        />
      </LegalSection>

      <LegalSection titleHe="9. כללי תשלום (אינו אוטומטי)" titleEn="9. Payout rules (not automatic)">
        <LegalParagraph
          he="תשלום אינו אוטומטי. תשלום ישוחרר רק לאחר שכל התנאים הבאים התקיימו:"
          en="Payout is not automatic. A payout is released only after all of the following are met:"
        />
        <LegalList
          items={[
            ["השירות הושלם בפועל.", "The service was actually completed."],
            ["אין מחלוקת או אירוע פתוח שמחזיק את התשלום.", "There is no dispute or open incident holding the payout."],
            ["חלון הביטול/ההחזר חלף.", "The cancellation/refund window has cleared."],
            ["מעמד המס והעסק אושר.", "Your tax and business status is approved."],
            ["פרטי הבנק אומתו.", "Your bank details are verified."],
            ["החשבונית הושלמה ותקינה.", "The invoice is complete and valid."],
            ["ניתן אישור מנהל.", "Admin approval is given."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="10. איסור עקיפה" titleEn="10. No circumvention">
        <LegalParagraph
          he="אין להעביר הזמנות או תשלומים אל מחוץ לפלטפורמה, ואין לעקוף את PetWash מול לקוחות שהגיעו דרכה. עקיפה מהווה הפרה יסודית."
          en="You may not move bookings or payments off-platform, and you may not circumvent PetWash with customers introduced through it. Circumvention is a material breach."
        />
      </LegalSection>

      <LegalSection titleHe="11. יושרת ביקורות" titleEn="11. Reviews integrity">
        <LegalParagraph
          he="אין ליצור, לעודד או לרכוש ביקורות כוזבות, ואין להפעיל לחץ על לקוחות לשנות ביקורת."
          en="You may not create, solicit, or buy fake reviews, and you may not pressure customers to change a review."
        />
      </LegalSection>

      <LegalSection titleHe="12. הגבלות שימוש במותג" titleEn="12. Brand-use limits">
        <LegalParagraph
          he='אסור להציג עצמך כ"מבוטח", "מכוסה" או "מאושר" אלא אם מעמד זה מוצג בפועל בלוח הבקרה שלך. אין להשתמש בסימני PetWash ללא היתר בכתב.'
          en='You may not present yourself as "insured", "covered", or "approved" unless your dashboard actually shows that status. You may not use PetWash marks without written permission.'
        />
      </LegalSection>

      <LegalSection titleHe="13. סודיות" titleEn="13. Confidentiality">
        <LegalParagraph
          he="עליך לשמור בסוד כל מידע של לקוחות ושל PetWash שנחשפת אליו, ולהשתמש בו אך ורק לצורך מתן השירות."
          en="You must keep confidential all customer and PetWash information you are exposed to, and use it solely for providing the service."
        />
      </LegalSection>

      <LegalSection titleHe="14. הבהרת ביטוח — באחריותך" titleEn="14. Insurance disclaimer — your responsibility">
        <LegalParagraph
          he="PetWash אינה חברת ביטוח, סוכן ביטוח או יועץ ביטוח. כל אזכור של תוכניות הגנה, כיסוי, תמיכה או הטבות אינו מחליף את חובתך לקיים את הביטוחים הנדרשים על פי דין. באחריותך הבלעדית לקיים, ככל שרלוונטי: ביטוח אחריות כלפי צד שלישי, ביטוח רכב, ביטוח מקצועי, ביטוח לטיפול בחיות מחמד וביטוח עסקי. PetWash אינה מספקת לך ביטוח אלא אם נכתב במפורש."
          en="PetWash is not an insurance company, insurance broker, or insurance adviser. Any reference to protection programs, coverage, support, or benefits does not replace your obligation to maintain the insurance required by law. You are solely responsible for maintaining, where relevant: public/third-party liability insurance, vehicle insurance, professional insurance, pet-care insurance, and business insurance. PetWash does not provide you with insurance unless expressly stated in writing."
        />
      </LegalSection>

      <LegalSection titleHe="15. הגבלת אחריות" titleEn="15. Limitation of liability">
        <LegalParagraph
          he="במידה המרבית המותרת בדין: הפלטפורמה מסופקת כפי שהיא וכפי שהיא זמינה. PetWash אינה מתחייבת להיקף הזמנות, להכנסה או לזמינות רציפה של הפלטפורמה. PetWash אינה אחראית למעשים, למחדלים או להתנהגות של משתמשים, בעלי חיות מחמד או נותני שירות אחרים. PetWash אינה אחראית לנזקים עקיפים, תוצאתיים או מיוחדים. אין באמור כדי לשלול זכויות שאינן ניתנות לשלילה על פי דין."
          en="To the maximum extent permitted by law: the platform is provided on an 'as-is' and 'as-available' basis. PetWash does not guarantee booking volume, income, or uninterrupted platform availability. PetWash is not responsible for the acts, omissions, or conduct of users, pet owners, or other providers. PetWash is not liable for indirect, incidental, consequential, or special damages. Nothing here excludes rights that cannot be excluded under applicable law."
        />
      </LegalSection>

      <LegalSection titleHe="16. השעיה וסיום" titleEn="16. Suspension & termination">
        <LegalParagraph
          he="PetWash רשאית להשעות או לסיים את ההתקשרות במקרה של הפרה, חשד להונאה, סיכון בטיחותי, או הוראת דין."
          en="PetWash may suspend or terminate the engagement for breach, suspected fraud, a safety risk, or as required by law."
        />
      </LegalSection>

      <LegalSection titleHe="17. אישור מחדש כל 6 חודשים" titleEn="17. Re-confirmation every 6 months">
        <LegalParagraph
          he="כל 6 חודשים תידרש לאשר מחדש את פרטיך, מעמדך ומסמכיך. אי-אישור עלול להשהות את פעילותך עד להשלמתו."
          en="Every 6 months you will be required to re-confirm your details, status, and documents. Failure to re-confirm may pause your activity until completed."
        />
      </LegalSection>

      <LegalSection titleHe="18. חתימה דיגיטלית והסכמה" titleEn="18. Digital signature & consent">
        <LegalParagraph
          he="בחתימה דיגיטלית על הסכם זה אתה מאשר כי כל המידע שמסרת מדויק, כי הבנת את חובותיך ואת מגבלות הביטוח, וכי PetWash היא פלטפורמה טכנולוגית ואינה מעסיקה אותך. חתימות אלקטרוניות, אישורים דיגיטליים, רישומי כתובת IP, חותמות זמן ורשומות קבלה אלקטרוניות עשויים לשמש כראיה להסכמתך."
          en="By digitally signing this Agreement you confirm that all information you provided is accurate, that you understand your obligations and the insurance limitations, and that PetWash is a technology platform and not your employer. Electronic signatures, digital approvals, IP logs, timestamps, and electronic acceptance records may be used as evidence of your consent."
        />
      </LegalSection>

      <LegalSection titleHe="19. דין וסמכות שיפוט" titleEn="19. Governing law & jurisdiction">
        <LegalParagraph
          he="על הסכם זה חלים דיני מדינת ישראל, וסמכות השיפוט הייחודית נתונה לבתי המשפט המוסמכים בתל אביב-יפו."
          en="This agreement is governed by the laws of the State of Israel, and exclusive jurisdiction is vested in the competent courts of Tel Aviv-Yafo."
        />
      </LegalSection>
    </LegalPage>
  );
}
