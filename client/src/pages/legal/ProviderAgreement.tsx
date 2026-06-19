import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderAgreement() {
  return (
    <LegalPage
      titleHe="הסכם נותן שירות"
      titleEn="Provider Agreement"
      subtitleHe="התנאים החלים על נותני שירות המבקשים להציע שירותים דרך PetWash."
      subtitleEn="The terms for providers who wish to offer services through PetWash."
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

      <LegalSection titleHe="6. חובות בטיחות וטיפול" titleEn="6. Safety & care duties">
        <LegalList
          items={[
            ["עליך לפעול בבטיחות, לשמור על שלום חיות המחמד, ולפעול לפי כל דין רלוונטי.", "You must act safely, protect the welfare of pets, and comply with all applicable law."],
            ["בעת גישה לבית הלקוח עליך לשמור על סודיות, פרטיות וכבוד הרכוש.", "When accessing a customer's home you must maintain confidentiality, privacy, and respect for property."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="7. הזמנות וביטולים" titleEn="7. Bookings & cancellations">
        <LegalParagraph
          he="עליך לכבד הזמנות שאישרת, להגיע בזמן, ולנהוג לפי מדיניות הביטול של PetWash. אי-הגעה חוזרת עלולה להביא להשעיה."
          en="You must honour bookings you accept, arrive on time, and follow PetWash's cancellation policy. Repeated no-shows may lead to suspension."
        />
      </LegalSection>

      <LegalSection titleHe="8. כללי תשלום (אינו אוטומטי)" titleEn="8. Payout rules (not automatic)">
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

      <LegalSection titleHe="9. איסור עקיפה" titleEn="9. No circumvention">
        <LegalParagraph
          he="אין להעביר הזמנות או תשלומים אל מחוץ לפלטפורמה, ואין לעקוף את PetWash מול לקוחות שהגיעו דרכה. עקיפה מהווה הפרה יסודית."
          en="You may not move bookings or payments off-platform, and you may not circumvent PetWash with customers introduced through it. Circumvention is a material breach."
        />
      </LegalSection>

      <LegalSection titleHe="10. יושרת ביקורות" titleEn="10. Reviews integrity">
        <LegalParagraph
          he="אין ליצור, לעודד או לרכוש ביקורות כוזבות, ואין להפעיל לחץ על לקוחות לשנות ביקורת."
          en="You may not create, solicit, or buy fake reviews, and you may not pressure customers to change a review."
        />
      </LegalSection>

      <LegalSection titleHe="11. הגבלות שימוש במותג" titleEn="11. Brand-use limits">
        <LegalParagraph
          he='אסור להציג עצמך כ"מבוטח", "מכוסה" או "מאושר" אלא אם מעמד זה מוצג בפועל בלוח הבקרה שלך. אין להשתמש בסימני PetWash ללא היתר בכתב.'
          en='You may not present yourself as "insured", "covered", or "approved" unless your dashboard actually shows that status. You may not use PetWash marks without written permission.'
        />
      </LegalSection>

      <LegalSection titleHe="12. סודיות" titleEn="12. Confidentiality">
        <LegalParagraph
          he="עליך לשמור בסוד כל מידע של לקוחות ושל PetWash שנחשפת אליו, ולהשתמש בו אך ורק לצורך מתן השירות."
          en="You must keep confidential all customer and PetWash information you are exposed to, and use it solely for providing the service."
        />
      </LegalSection>

      <LegalSection titleHe="13. ביטוח ורישיון — באחריותך" titleEn="13. Insurance & licence — your responsibility">
        <LegalParagraph
          he="אחזקת ביטוח, רישיונות והיתרים הנדרשים לפעילותך היא באחריותך הבלעדית. PetWash אינה מספקת לך ביטוח אלא אם נכתב במפורש."
          en="Holding the insurance, licences, and permits required for your activity is your sole responsibility. PetWash does not provide you with insurance unless expressly stated."
        />
      </LegalSection>

      <LegalSection titleHe="14. השעיה וסיום" titleEn="14. Suspension & termination">
        <LegalParagraph
          he="PetWash רשאית להשעות או לסיים את ההתקשרות במקרה של הפרה, חשד להונאה, סיכון בטיחותי, או הוראת דין."
          en="PetWash may suspend or terminate the engagement for breach, suspected fraud, a safety risk, or as required by law."
        />
      </LegalSection>

      <LegalSection titleHe="15. אישור מחדש כל 6 חודשים" titleEn="15. Re-confirmation every 6 months">
        <LegalParagraph
          he="כל 6 חודשים תידרש לאשר מחדש את פרטיך, מעמדך ומסמכיך. אי-אישור עלול להשהות את פעילותך עד להשלמתו."
          en="Every 6 months you will be required to re-confirm your details, status, and documents. Failure to re-confirm may pause your activity until completed."
        />
      </LegalSection>

      <LegalSection titleHe="16. דין וסמכות שיפוט" titleEn="16. Governing law & jurisdiction">
        <LegalParagraph
          he="על הסכם זה חלים דיני מדינת ישראל, וסמכות השיפוט הייחודית נתונה לבתי המשפט המוסמכים בתל אביב-יפו."
          en="This agreement is governed by the laws of the State of Israel, and exclusive jurisdiction is vested in the competent courts of Tel Aviv-Yafo."
        />
      </LegalSection>
    </LegalPage>
  );
}
