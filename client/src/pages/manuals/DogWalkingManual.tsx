import { LegalPage, LegalSection, LegalParagraph, LegalList } from "../legal/LegalPage";

export default function DogWalkingManual() {
  return (
    <LegalPage
      titleHe="מדריך טיולי כלבים"
      titleEn="Dog Walking Manual"
      subtitleHe="סטנדרט טיפול ובטיחות לטיולי כלבים דרך PetWash."
      subtitleEn="Care and safety standard for dog walks through PetWash."
    >
      <LegalSection titleHe="1. לפני הטיול" titleEn="1. Before the walk">
        <LegalList
          items={[
            ["ודא רצועה תקינה, רתמה מתאימה ופרטי זיהוי על הכלב.", "Check a sound leash, a suitable harness, and ID on the dog."],
            ["קרא את הערות הבעלים: מזג, רגישויות, פקודות מוכרות.", "Read the owner's notes: temperament, sensitivities, known commands."],
            ["ודא מים, שקיות לאיסוף צואה וטלפון טעון.", "Have water, waste bags, and a charged phone."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="2. במהלך הטיול" titleEn="2. During the walk">
        <LegalList
          items={[
            ["שמור על הכלב ברצועה בכל אזור ציבורי, לפי הדין.", "Keep the dog leashed in any public area, per the law."],
            ["הימנע מחום קיצוני, מאספלט לוהט ומשעות החום.", "Avoid extreme heat, hot asphalt, and peak-heat hours."],
            ["הרחק מכלבים תוקפניים ומסכנות תנועה.", "Keep away from aggressive dogs and traffic hazards."],
            ["אסוף תמיד את הצואה.", "Always pick up waste."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. בטיחות וחירום" titleEn="3. Safety & emergency">
        <LegalParagraph
          he="אם הכלב נפצע, נמלט או במצוקה — פעל לשלומו, צור קשר עם הבעלים, ובמצב חירום פנה לוטרינר חירום. דווח מיד דרך הפלטפורמה."
          en="If the dog is injured, escapes, or is in distress — act for its safety, contact the owner, and in an emergency call an emergency vet. Report immediately through the platform."
        />
      </LegalSection>

      <LegalSection titleHe="4. סיום ודיווח" titleEn="4. Finish & report">
        <LegalParagraph
          he="החזר את הכלב בבטחה, ודא מים ומזון לפי ההנחיה, ועדכן את הבעלים. תעד כל אירוע חריג."
          en="Return the dog safely, ensure water and food as instructed, and update the owner. Document any unusual event."
        />
      </LegalSection>

      <LegalSection titleHe="5. אחריות וביטוח" titleEn="5. Responsibility & insurance">
        <LegalParagraph
          he="אתה פועל כקבלן עצמאי ואחראי לבטיחות הטיול. PetWash מספקת כלים ותמיכה ואינה מבטחת אלא אם נכתב במפורש."
          en="You act as an independent contractor and are responsible for the walk's safety. PetWash provides tools and support and does not insure unless expressly stated."
        />
      </LegalSection>
    </LegalPage>
  );
}
