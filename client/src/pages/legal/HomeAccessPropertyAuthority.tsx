import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function HomeAccessPropertyAuthority() {
  return (
    <LegalPage
      titleHe="אישור גישה לבית וסמכות על הנכס"
      titleEn="Home Access & Property Authority"
      subtitleHe="הצהרות הלקוח בעת הזמנת שירות הכולל כניסה לבית או לנכס."
      subtitleEn="Customer declarations when booking a service that involves entering a home or property."
    >
      <LegalSection titleHe="1. סמכות על הנכס" titleEn="1. Authority over the property">
        <LegalParagraph
          he="בהזמנת שירות הכולל כניסה לבית או לנכס, אתה מצהיר כי אתה הבעלים, הדייר, או מי שהוסמך כדין לאשר כניסה למקום ואת מתן השירות בו."
          en="By booking a service that involves entering a home or property, you declare that you are the owner, tenant, or a person duly authorised to permit entry and the provision of the service there."
        />
      </LegalSection>

      <LegalSection titleHe="2. היעדר מניעה" titleEn="2. No restriction">
        <LegalParagraph
          he="אתה מצהיר שאין מניעה לפי חוזה שכירות, תקנון בית משותף, ועד בית, או כל הסכם אחר, למתן השירות במקום."
          en="You declare that there is no restriction under a lease, a condominium's bylaws, the building committee (va'ad bayit), or any other agreement that prevents the service from being provided at the location."
        />
      </LegalSection>

      <LegalSection titleHe="3. אבטחת חפצי ערך" titleEn="3. Securing valuables">
        <LegalList
          items={[
            ["עליך לאבטח חפצי ערך, מסמכים ופריטים רגישים לפני מתן השירות.", "You must secure valuables, documents, and sensitive items before the service is provided."],
            ["עליך להבטיח סביבה בטוחה לנותן השירות ולחיית המחמד.", "You must ensure a safe environment for the provider and the pet."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="4. הצהרה כוזבת" titleEn="4. False declaration">
        <LegalParagraph
          he="PetWash אינה אחראית לנזק או לתביעה הנובעים מהצהרה כוזבת או חלקית מצדך בנוגע לסמכותך על הנכס. האחריות לכך מוטלת עליך."
          en="PetWash is not liable for damage or claims arising from a false or incomplete declaration by you regarding your authority over the property. That responsibility rests with you."
        />
      </LegalSection>
    </LegalPage>
  );
}
