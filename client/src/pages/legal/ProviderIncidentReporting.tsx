import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderIncidentReporting() {
  return (
    <LegalPage
      titleHe="דיווח אירועים — נותן שירות"
      titleEn="Provider Incident Reporting"
      subtitleHe="חובתך לדווח מיד על כל אירוע בטיחות, פציעה או נזק."
      subtitleEn="Your duty to report any safety incident, injury, or damage immediately."
    >
      <LegalSection titleHe="1. חובת דיווח מיידי" titleEn="1. Duty to report immediately">
        <LegalParagraph
          he="עליך לדווח ל-PetWash מיד על כל אירוע — פציעת חיה או אדם, נזק לרכוש, התנהגות תוקפנית, כשל ציוד או מצב חירום."
          en="You must report to PetWash immediately any incident — injury to an animal or person, property damage, aggressive behaviour, equipment failure, or an emergency."
        />
      </LegalSection>

      <LegalSection titleHe="2. שלום החיה והאדם תחילה" titleEn="2. Safety of animal and person first">
        <LegalParagraph
          he="לפני הדיווח, פעל להבטחת שלום החיה והאנשים. במצב חירום מסכן חיים, פנה תחילה לשירותי החירום."
          en="Before reporting, act to secure the safety of the animal and people. In a life-threatening emergency, contact the emergency services first."
        />
      </LegalSection>

      <LegalSection titleHe="3. מה לכלול" titleEn="3. What to include">
        <LegalList
          items={[
            ["מספר ההזמנה, מועד ומקום.", "Booking number, time, and place."],
            ["תיאור מדויק של מה שקרה.", "An accurate description of what happened."],
            ["תמונות וראיות אם קיימות.", "Photos and evidence if available."],
            ["פרטי פציעה, נזק או טיפול שניתן.", "Details of any injury, damage, or care given."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. שיתוף פעולה בבירור" titleEn="4. Cooperation in investigation">
        <LegalParagraph
          he="עליך לשתף פעולה באופן מלא בכל בירור של PetWash ולמסור מידע נכון. אי-דיווח או דיווח כוזב מהווים הפרה."
          en="You must cooperate fully in any PetWash investigation and provide accurate information. Failure to report, or a false report, is a breach."
        />
      </LegalSection>
    </LegalPage>
  );
}
