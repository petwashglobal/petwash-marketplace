const GOLD = '#C5A55A';
const GOLD_LIGHT = '#F5EDD8';
const GOLD_RULE = '#DDD0A8';
const DARK = '#111111';
const BODY = '#FFFFFF';
const PARCHMENT = '#FAF8F4';
const TEXT_PRI = '#1A1A1A';
const TEXT_SEC = '#555555';
const TEXT_DIM = '#999999';

const sampleData = {
  invoiceNo: 'INV-2026-00847',
  date: '18 במרץ 2026',
  serviceDate: '20–27 במרץ 2026',
  durationLabel: '7 לילות',
  serviceDescHe: 'שמירה על חיות מחמד',
  serviceDescEn: 'PET SITTING',
  providerName: 'דניאל כהן',
  petName: 'רוקי + בלה',
  petType: 'כלב גולדן + ספניאל',
  customerName: 'מיכל לוי',
  customerEmail: 'michal@example.com',
  paymentBrand: 'Visa',
  paymentLast4: '4821',
  netAmount: 1695,
  vatAmount: 305,
  grossAmount: 2000,
  platformFee: 300,
  providerPayout: 1700,
};

function Row({ label, sublabel, value, stripe = false, bold = false }: {
  label: string; sublabel?: string; value: string; stripe?: boolean; bold?: boolean;
}) {
  return (
    <tr style={{ background: stripe ? PARCHMENT : BODY }}>
      <td style={{ padding: '10px 0', borderBottom: `1px solid ${GOLD_RULE}`, width: '55%' }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 13, fontWeight: bold ? 600 : 400, color: TEXT_PRI }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 10, color: TEXT_DIM, marginRight: 6, display: 'block', marginTop: 1 }}>
            {sublabel}
          </span>
        )}
      </td>
      <td style={{ padding: '10px 0', borderBottom: `1px solid ${GOLD_RULE}`, textAlign: 'right' }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 13, fontWeight: bold ? 600 : 400, color: bold ? TEXT_PRI : TEXT_SEC }}>
          {value}
        </span>
      </td>
    </tr>
  );
}

function AmountRow({ label, value, isTotal = false }: { label: string; value: string; isTotal?: boolean }) {
  if (isTotal) {
    return (
      <tr style={{ background: GOLD_LIGHT }}>
        <td style={{ padding: '14px 24px' }}>
          <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 13, fontWeight: 600, color: TEXT_PRI }}>{label}</span>
        </td>
        <td style={{ padding: '14px 24px', textAlign: 'right' }}>
          <span style={{ fontFamily: 'Georgia, Times New Roman, serif', fontSize: 22, fontWeight: 700, color: GOLD }}>{value}</span>
        </td>
      </tr>
    );
  }
  return (
    <tr style={{ background: BODY, borderBottom: `1px solid ${GOLD_RULE}` }}>
      <td style={{ padding: '9px 24px', borderBottom: `1px solid ${GOLD_RULE}` }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 12, color: TEXT_SEC }}>{label}</span>
      </td>
      <td style={{ padding: '9px 24px', textAlign: 'right', borderBottom: `1px solid ${GOLD_RULE}` }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 12, fontWeight: 500, color: TEXT_PRI }}>{value}</span>
      </td>
    </tr>
  );
}

export function BookingInvoice() {
  return (
    <div style={{ background: '#F0EBE0', minHeight: '100vh', padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 580, background: BODY, boxShadow: '0 4px 40px rgba(0,0,0,0.12)', borderRadius: 2, overflow: 'hidden', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>

        {/* Gold top line */}
        <div style={{ height: 4, background: GOLD }} />

        {/* Dark header */}
        <div style={{ background: DARK, padding: '24px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: GOLD, textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
              חשבונית מס קבלה
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase' }}>
              TAX INVOICE · RECEIPT
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: GOLD, letterSpacing: -0.5 }}>
              🐾 PetWash™
            </div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#444', textTransform: 'uppercase', marginTop: 2 }}>
              PRESTIGE PLATFORM
            </div>
          </div>
        </div>

        {/* Confirmed badge */}
        <div style={{ background: BODY, padding: '20px 36px 0' }}>
          <span style={{ background: '#A07830', borderRadius: 3, padding: '6px 16px', fontSize: 10, fontWeight: 700, color: BODY, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            ✓ אושר ושולם · CONFIRMED &amp; PAID
          </span>
        </div>

        {/* HERO — headline + amount */}
        <div style={{ padding: '24px 36px 20px', background: BODY }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
            🏠 {sampleData.serviceDescHe} · {sampleData.serviceDescEn}
          </div>
          <div style={{ fontFamily: 'Georgia, Times New Roman, serif', fontSize: 54, fontWeight: 700, color: TEXT_PRI, letterSpacing: -2, lineHeight: 1.05 }}>
            ₪{sampleData.grossAmount.toLocaleString('he-IL')}
          </div>
          <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 6 }}>
            {sampleData.serviceDescHe} · {sampleData.durationLabel}
          </div>
        </div>

        {/* Gold rule */}
        <div style={{ height: 2, background: GOLD, margin: '0 36px' }} />

        {/* Section label */}
        <div style={{ padding: '14px 36px 8px', background: PARCHMENT, borderTop: `2px solid ${GOLD_RULE}` }}>
          <span style={{ fontSize: 9, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', fontWeight: 700 }}>
            פרטי עסקה — TRANSACTION DETAILS
          </span>
        </div>

        {/* Transaction detail rows */}
        <table style={{ width: '100%', borderCollapse: 'collapse', padding: '0 36px' }}>
          <tbody>
            <tr><td colSpan={2} style={{ padding: '0 36px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row label="מס׳ חשבונית" sublabel="Invoice No." value={sampleData.invoiceNo} bold />
                  <Row label="תאריך הנפקה" sublabel="Issued" value={sampleData.date} stripe />
                  <Row label="תאריך שירות" sublabel="Service Date" value={sampleData.serviceDate} />
                  <Row label="נותן שירות" sublabel="Provider" value={sampleData.providerName} stripe bold />
                  <Row label="חיית מחמד" sublabel="Pets" value={`${sampleData.petName} — ${sampleData.petType}`} />
                  <Row label="לקוח" sublabel="Customer" value={sampleData.customerName} stripe />
                  <Row label="אמצעי תשלום" sublabel="Payment" value={`${sampleData.paymentBrand} ****${sampleData.paymentLast4}`} />
                </tbody>
              </table>
            </td></tr>
          </tbody>
        </table>

        {/* Spacer */}
        <div style={{ height: 8, background: BODY }} />

        {/* Financial breakdown */}
        <div style={{ padding: '14px 36px 8px', background: PARCHMENT, borderTop: `2px solid ${GOLD_RULE}` }}>
          <span style={{ fontSize: 9, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', fontWeight: 700 }}>
            פירוט מחיר — PRICE BREAKDOWN
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <AmountRow label='מחיר לפני מע"מ · Net ex. VAT' value={`₪${sampleData.netAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`} />
            <AmountRow label='מע"מ 18% · VAT 18%' value={`₪${sampleData.vatAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`} />
            <AmountRow label='סה"כ שולם · TOTAL PAID' value={`₪${sampleData.grossAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`} isTotal />
          </tbody>
        </table>

        {/* Spacer */}
        <div style={{ height: 8, background: BODY }} />

        {/* Provider payout card */}
        <div style={{ padding: '0 36px 28px', background: BODY }}>
          <div style={{ background: '#1A1A1A', borderRadius: 8, padding: '20px 24px', borderRight: `4px solid ${GOLD}` }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: GOLD, textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
              תשלום לנותן שירות · PROVIDER PAYOUT
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 11, color: '#888', padding: '4px 0' }}>עמלת פלטפורם 15%</td>
                  <td style={{ textAlign: 'right', fontSize: 11, color: '#888', padding: '4px 0' }}>
                    −₪{sampleData.platformFee.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', padding: '8px 0 0', borderTop: '1px solid #333', paddingTop: 10 }}>
                    תשלום לספק
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: GOLD, borderTop: '1px solid #333', paddingTop: 10 }}>
                    ₪{sampleData.providerPayout.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* VAT note */}
        <div style={{ padding: '12px 36px', background: PARCHMENT, borderTop: `2px solid ${GOLD_RULE}` }}>
          <p style={{ margin: 0, fontSize: 9, color: TEXT_DIM, lineHeight: 1.7, textAlign: 'right' }}>
            מסמך זה מהווה חשבונית מס קבלה בהתאם לחוק מע"מ. מע"מ 18% כלול במחיר.
            פט ווש בע"מ, עוסק מורשה 516788400.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 36px', background: BODY, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: TEXT_DIM, textTransform: 'uppercase', marginBottom: 4 }}>פרטי עוסק</div>
            <div style={{ fontSize: 10, color: TEXT_SEC, lineHeight: 1.8 }}>
              פט ווש בע"מ / Pet Wash Ltd<br />
              עוסק מורשה 516788400<br />
              תל אביב, ישראל
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: TEXT_DIM, textTransform: 'uppercase', marginBottom: 4 }}>יצירת קשר</div>
            <div style={{ fontSize: 10, color: TEXT_SEC, lineHeight: 1.8 }}>
              support@petwash.co.il<br />
              03-000-0000<br />
              <span style={{ color: GOLD }}>petwash.co.il</span>
            </div>
          </div>
        </div>

        {/* Gold bottom line */}
        <div style={{ height: 4, background: GOLD }} />

      </div>
    </div>
  );
}
