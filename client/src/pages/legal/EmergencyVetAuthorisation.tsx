import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function EmergencyVetAuthorisation() {
  return (
    <LegalPage
      titleHe="הרשאה לטיפול וטרינרי בחירום"
      titleEn="Emergency Vet Authorisation"
      subtitleHe="כיצד מטופל מצב חירום רפואי של חיית המחמד במהלך שירות."
      subtitleEn="How a pet's medical emergency is handled during a service."
    >
      <LegalSection titleHe="1. הרשאתך" titleEn="1. Your authorisation">
        <LegalParagraph
          he="בעת ההזמנה אתה רשאי להרשות לנותן השירות לפנות לטיפול וטרינרי דחוף אם חיית המחמד נמצאת במצוקה ולא ניתן ליצור עמך קשר במהירות."
          en="At booking you may authorise the provider to seek urgent veterinary care if the pet is in distress and you cannot be reached promptly."
        />
      </LegalSection>

      <LegalSection titleHe="2. ניסיון יצירת קשר" titleEn="2. Attempt to contact you">
        <LegalParagraph
          he="נותן השירות ינסה ליצור עמך קשר ראשון. בהיעדר מענה ובמצב חירום אמיתי, רשאי נותן השירות לפעול לטובת שלום החיה."
          en="The provider will first try to contact you. If there is no answer and a genuine emergency exists, the provider may act in the pet's welfare interest."
        />
      </LegalSection>

      <LegalSection titleHe="3. עלויות" titleEn="3. Costs">
        <LegalParagraph
          he="עלות הטיפול הווטרינרי חלה עליך, בעל חיית המחמד, אלא אם נקבע אחרת בדין. PetWash אינה נושאת בעלויות וטרינריות ואינה מספקת ביטוח וטרינרי."
          en="The cost of veterinary care is borne by you, the pet owner, unless the law provides otherwise. PetWash does not bear veterinary costs and does not provide veterinary insurance."
        />
      </LegalSection>

      <LegalSection titleHe="4. הגבלת אחריות" titleEn="4. Limitation">
        <LegalParagraph
          he="נותן השירות ו-PetWash אינם וטרינרים. ההרשאה מאפשרת פנייה לטיפול בלבד ואינה ערובה לתוצאה רפואית."
          en="The provider and PetWash are not veterinarians. This authorisation enables seeking care only and is not a guarantee of any medical outcome."
        />
      </LegalSection>

      <LegalSection titleHe="5. דיווח" titleEn="5. Reporting">
        <LegalParagraph
          he="כל אירוע חירום יתועד וידווח לך בהקדם דרך הפלטפורמה."
          en="Any emergency event will be documented and reported to you promptly through the platform."
        />
      </LegalSection>
    </LegalPage>
  );
}
