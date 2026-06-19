import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function BookingRules() {
  return (
    <LegalPage
      titleHe="כללי הזמנה"
      titleEn="Booking Rules"
      subtitleHe="כיצד נוצרת הזמנה ומה התנאים החלים עליה."
      subtitleEn="How a booking is made and the terms that apply to it."
    >
      <LegalSection titleHe="1. יצירת הזמנה" titleEn="1. Making a booking">
        <LegalParagraph
          he="הזמנה נכרתת כאשר בחרת שירות, אישרת את הפרטים והמחיר, והתשלום או ההרשאה אושרו. המחיר מוצג ונקבע על-ידי PetWash, לא על-ידי הלקוח."
          en="A booking is formed when you select a service, confirm the details and price, and payment or authorisation is approved. The price is displayed and set by PetWash, not by the customer."
        />
      </LegalSection>

      <LegalSection titleHe="2. דיוק הפרטים" titleEn="2. Accuracy of details">
        <LegalParagraph
          he="עליך למסור פרטי הזמנה נכונים — מועד, מיקום, חיית מחמד ודרישות מיוחדות. פרטים שגויים עלולים לגרום לביטול ללא החזר."
          en="You must provide accurate booking details — time, location, pet, and special requirements. Inaccurate details may cause a cancellation without refund."
        />
      </LegalSection>

      <LegalSection titleHe="3. זמינות ואישור נותן שירות" titleEn="3. Availability & provider acceptance">
        <LegalParagraph
          he="הזמנה לשירות נותן שירות עשויה להיות כפופה לאישורו של נותן השירות ולזמינותו. אם לא תאושר, לא תחויב או שתקבל החזר."
          en="A provider service booking may be subject to the provider's acceptance and availability. If it is not accepted, you will not be charged, or you will be refunded."
        />
      </LegalSection>

      <LegalSection titleHe="4. ביטולים" titleEn="4. Cancellations">
        <LegalParagraph
          he="ביטול הזמנה כפוף למדיניות הביטול וההחזר: זכות ביטול של 14 ימים בעסקת מכר מרחוק, ביטול לפחות 7 ימי עבודה לפני המועד, ודמי ביטול של 5% או 100 ₪ — לפי הנמוך."
          en="Cancelling a booking is subject to the Cancellation & Refund Policy: a 14-day distance-sale cancellation right, cancellation at least 7 working days before the date, and a cancellation fee of 5% or ₪100, whichever is lower."
        />
      </LegalSection>

      <LegalSection titleHe="5. שינויים ותיאום מחדש" titleEn="5. Changes & rescheduling">
        <LegalParagraph
          he="ניתן לבקש שינוי או תיאום מחדש בכפוף לזמינות. שינוי ברגע האחרון עלול להיחשב כביטול."
          en="You may request a change or reschedule subject to availability. A last-minute change may be treated as a cancellation."
        />
      </LegalSection>

      <LegalSection titleHe="6. תקשורת בתוך הפלטפורמה" titleEn="6. In-platform communication">
        <LegalParagraph
          he="התקשורת והתשלום מתבצעים דרך הפלטפורמה. אין להעביר הזמנה או תשלום אל מחוץ ל-PetWash."
          en="Communication and payment take place through the platform. You may not move a booking or payment off PetWash."
        />
      </LegalSection>
    </LegalPage>
  );
}
