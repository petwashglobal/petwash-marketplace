import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function IncidentReportingManual() {
  return (
    <LegalPage
      titleHe="מדריך דיווח אירועים"
      titleEn="Incident Reporting Manual"
      subtitleHe="כיצד להגיב, לתעד ולדווח על אירוע — שלב אחר שלב."
      subtitleEn="How to respond to, document, and report an incident — step by step."
    >
      <LegalSection titleHe="1. תחילה — בטיחות" titleEn="1. First — safety">
        <LegalParagraph
          he='לפני כל דבר, הבטח את שלום החיה והאנשים. במצב מסכן חיים, פנה מיד לשירותי החירום (משטרה / מד"א / וטרינר חירום).'
          en="Before anything, secure the safety of the pet and people. In a life-threatening situation, immediately contact the emergency services (police / ambulance / emergency vet)."
        />
      </LegalSection>

      <LegalSection titleHe="2. תיעוד" titleEn="2. Document">
        <LegalList
          items={[
            ["רשום מה קרה, מתי והיכן.", "Record what happened, when, and where."],
            ["צלם תמונות של כל פציעה או נזק.", "Take photos of any injury or damage."],
            ["אסוף פרטי עדים אם קיימים.", "Collect witness details if any."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. יידוע הצדדים" titleEn="3. Notify the parties">
        <LegalParagraph
          he="יידע את הבעלים (או את הלקוח) בהקדם האפשרי, בכנות ובאופן ענייני."
          en="Notify the owner (or the customer) as soon as possible, honestly and factually."
        />
      </LegalSection>

      <LegalSection titleHe="4. דיווח ל-PetWash" titleEn="4. Report to PetWash">
        <LegalParagraph
          he="הגש דיווח דרך הפלטפורמה בהקדם — ועדיף בתוך 48 שעות — וצרף את מספר ההזמנה, התיאור והתמונות."
          en="Submit a report through the platform promptly — ideally within 48 hours — attaching the booking number, the description, and the photos."
        />
      </LegalSection>

      <LegalSection titleHe="5. מעקב" titleEn="5. Follow-up">
        <LegalParagraph
          he="שתף פעולה בכל בירור, מסור מידע נכון, ושמור ראיות. PetWash מתעדת, שומרת רשומות ומתווכת — היא אינה מבטחת אלא אם נכתב במפורש."
          en="Cooperate in any investigation, provide accurate information, and preserve evidence. PetWash documents, keeps records, and mediates — it is not an insurer unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
