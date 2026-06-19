import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function SupportIncidentReporting() {
  return (
    <LegalPage
      titleHe="תמיכה ודיווח אירועים (לקוחות)"
      titleEn="Support & Incident Reporting (Customers)"
      subtitleHe="כיצד לקבל תמיכה ולדווח על אירוע."
      subtitleEn="How to get support and report an incident."
    >
      <LegalSection titleHe="1. ערוצי תמיכה" titleEn="1. Support channels">
        <LegalParagraph
          he="ניתן לפנות לתמיכה דרך הפלטפורמה. אנו שואפים להגיב בזמן סביר; אירועי בטיחות יקבלו עדיפות."
          en="You can contact support through the platform. We aim to respond within a reasonable time; safety incidents are prioritised."
        />
      </LegalSection>

      <LegalSection titleHe="2. דיווח מהיר על אירוע" titleEn="2. Prompt incident reporting">
        <LegalParagraph
          he="יש לדווח על פציעה, נזק, התנהגות בלתי הולמת או כשל בעמדה בהקדם האפשרי, ועדיף בתוך 48 שעות, כדי שנוכל לתעד ולטפל."
          en="Report any injury, damage, misconduct, or station failure as soon as possible, ideally within 48 hours, so we can document and address it."
        />
      </LegalSection>

      <LegalSection titleHe="3. מה לכלול בדיווח" titleEn="3. What to include">
        <LegalList
          items={[
            ["מספר ההזמנה והמועד.", "The booking number and date."],
            ["תיאור מה קרה ותמונות אם יש.", "A description of what happened and photos if available."],
            ["פרטי כל פציעה או נזק.", "Details of any injury or damage."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. מה אנו עושים" titleEn="4. What we do">
        <LegalParagraph
          he="PetWash מתעדת את האירוע, שומרת רשומות, ומתווכת לפי הצורך. PetWash מספקת כלים ותמיכה — היא אינה מבטחת ואינה ערבה לתוצאה אלא אם נכתב במפורש עבור הזמנה כשירה."
          en="PetWash documents the incident, keeps records, and mediates as needed. PetWash provides tools and support — it is not an insurer and does not guarantee an outcome unless expressly written for an eligible booking."
        />
      </LegalSection>

      <LegalSection titleHe="5. מקרי חירום" titleEn="5. Emergencies">
        <LegalParagraph
          he='במקרה חירום מסכן חיים, פנה תחילה לשירותי החירום (משטרה / מד"א / וטרינר חירום), ולאחר מכן דווח לנו.'
          en="In a life-threatening emergency, first contact the emergency services (police / ambulance / emergency vet), then report to us."
        />
      </LegalSection>
    </LegalPage>
  );
}
