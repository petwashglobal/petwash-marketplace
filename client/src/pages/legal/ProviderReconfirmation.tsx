import { LegalPage, LegalSection, LegalParagraph, LegalList } from "./LegalPage";

export default function ProviderReconfirmation() {
  return (
    <LegalPage
      titleHe="אישור מחדש — כל 6 חודשים"
      titleEn="Re-confirmation — Every 6 Months"
      subtitleHe="עליך לאשר מחדש את פרטיך, מעמדך ומסמכיך מדי חצי שנה."
      subtitleEn="You must re-confirm your details, status, and documents every six months."
    >
      <LegalSection titleHe="1. מחזור של 6 חודשים" titleEn="1. Six-month cycle">
        <LegalParagraph
          he="כל 6 חודשים תידרש לאשר מחדש כי הפרטים שמסרת עדיין נכונים ומעודכנים."
          en="Every 6 months you will be required to re-confirm that the details you provided are still true and up to date."
        />
      </LegalSection>

      <LegalSection titleHe="2. מה נדרש לאשר" titleEn="2. What you re-confirm">
        <LegalList
          items={[
            ["פרטי קשר ומעמד אישי.", "Contact details and personal status."],
            ["מעמד מס ועסק (עוסק פטור / מורשה / חברה / יחיד).", "Tax and business status (Osek Patur / Murshe / company / individual)."],
            ["תוקף רישיונות, היתרים וביטוח.", "Validity of licences, permits, and insurance."],
            ["נכונות המסמכים שהועלו.", "Accuracy of uploaded documents."],
          ]}
        />
      </LegalSection>

      <LegalSection titleHe="3. תוצאות אי-אישור" titleEn="3. Consequences of not re-confirming">
        <LegalParagraph
          he="אי-אישור מחדש במועד עלול להשהות את פעילותך בפלטפורמה ולעכב תשלומים עד להשלמת האישור."
          en="Failing to re-confirm on time may pause your activity on the platform and hold payouts until re-confirmation is completed."
        />
      </LegalSection>

      <LegalSection titleHe="4. עקביות עם ההסכם" titleEn="4. Consistency with the agreement">
        <LegalParagraph
          he="דרישה זו תואמת את הסכם נותן השירות. אישור מחדש אינו מבטל את חובת העדכון השוטף בכל שינוי."
          en="This requirement is consistent with the Provider Agreement. Re-confirmation does not replace your ongoing duty to update on any change."
        />
      </LegalSection>
    </LegalPage>
  );
}
