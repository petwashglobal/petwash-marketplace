const GOLD = '#C5A55A';
const GOLD_LIGHT = '#F5EDD8';
const GOLD_RULE = '#DDD0A8';
const DARK = '#111111';
const BODY = '#FFFFFF';
const PARCHMENT = '#FAF8F4';
const TEXT_PRI = '#1A1A1A';
const TEXT_SEC = '#555555';
const TEXT_DIM = '#999999';
const CARD_BG = '#1A1A1A';

const sampleData = {
  invoiceNo: 'GFT-2026-00234',
  txId: 'TX-9F3A2C-8B1D',
  date: '18 במרץ 2026',
  buyerName: 'אבי כהן',
  recipientName: 'נועה לוי',
  giftAmount: 500,
  netAmount: 423.73,
  vatAmount: 76.27,
  voucherId: 'PW-GIFT-2026-7K9M-XL3P',
  paymentBrand: 'Mastercard',
  paymentLast4: '3921',
  personalMessage: 'לכלבלב הכי חמוד בעולם — שיהיה לו פינוק מיוחד! 🐶',
  tier: { name: 'Signature', nameHe: 'סיגנטשר', icon: '❖' },
};

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
    <tr>
      <td style={{ padding: '9px 24px', borderBottom: `1px solid ${GOLD_RULE}` }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 12, color: TEXT_SEC }}>{label}</span>
      </td>
      <td style={{ padding: '9px 24px', textAlign: 'right', borderBottom: `1px solid ${GOLD_RULE}` }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 12, fontWeight: 500, color: TEXT_PRI }}>{value}</span>
      </td>
    </tr>
  );
}

function DetailRow({ label, sublabel, value, stripe = false, bold = false }: {
  label: string; sublabel?: string; value: string | JSX.Element; stripe?: boolean; bold?: boolean;
}) {
  return (
    <tr style={{ background: stripe ? PARCHMENT : BODY }}>
      <td style={{ padding: '10px 0', borderBottom: `1px solid ${GOLD_RULE}`, width: '55%' }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 13, fontWeight: bold ? 600 : 400, color: TEXT_PRI }}>{label}</span>
        {sublabel && <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 10, color: TEXT_DIM, display: 'block', marginTop: 1 }}>{sublabel}</span>}
      </td>
      <td style={{ padding: '10px 0', borderBottom: `1px solid ${GOLD_RULE}`, textAlign: 'right' }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 13, fontWeight: bold ? 600 : 400, color: bold ? TEXT_PRI : TEXT_SEC }}>{value}</span>
      </td>
    </tr>
  );
}

export function GiftCardInvoice() {
  return (
    <div style={{ background: '#F0EBE0', minHeight: '100vh', padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 580, background: BODY, boxShadow: '0 4px 40px rgba(0,0,0,0.12)', borderRadius: 2, overflow: 'hidden', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>

        {/* Gold top line */}
        <div style={{ height: 4, background: GOLD }} />

        {/* Dark header */}
        <div style={{ background: DARK, padding: '24px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: GOLD, textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
              אישור רכישה — מתנה
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase' }}>
              GIFT PURCHASE CONFIRMATION
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

        {/* HERO — Gift sent headline */}
        <div style={{ padding: '28px 36px 0', background: BODY, textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
            🎁 כרטיס מתנה · E-GIFT CARD
          </div>
          <div style={{ fontFamily: 'Georgia, Times New Roman, serif', fontSize: 54, fontWeight: 700, color: TEXT_PRI, letterSpacing: -2, lineHeight: 1.05 }}>
            ₪{sampleData.giftAmount.toLocaleString('he-IL')}
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: TEXT_DIM }}>מסופק מיידית · Instant digital delivery</span>
          </div>
        </div>

        {/* Gift Sent banner */}
        <div style={{ margin: '20px 36px 0', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>
              נשלח בהצלחה ל{sampleData.recipientName}
            </div>
            <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
              אימייל + WhatsApp · Instant Delivery
            </div>
          </div>
          <div style={{ marginRight: 'auto' }}>
            <span style={{ border: `1px solid ${GOLD}`, borderRadius: 2, padding: '3px 12px', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: GOLD }}>
              {sampleData.tier.icon} {sampleData.tier.nameHe}
            </span>
          </div>
        </div>

        {/* Gold rule */}
        <div style={{ height: 2, background: GOLD, margin: '20px 36px 0' }} />

        {/* Personal message — visually highlighted */}
        <div style={{ margin: '0 0', padding: '18px 36px', background: PARCHMENT, borderTop: `2px solid ${GOLD_RULE}`, borderBottom: `2px solid ${GOLD_RULE}` }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: GOLD, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
            📝 הודעה אישית · PERSONAL MESSAGE
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ width: 3, background: GOLD, borderRadius: 2, marginLeft: 14, flexShrink: 0 }} />
            <p style={{ margin: 0, fontFamily: 'Georgia, Times New Roman, serif', fontSize: 15, color: TEXT_PRI, fontStyle: 'italic', lineHeight: 1.7, paddingRight: 14 }}>
              "{sampleData.personalMessage}"
            </p>
          </div>
        </div>

        {/* Transaction details */}
        <div style={{ padding: '14px 36px 8px', background: PARCHMENT }}>
          <span style={{ fontSize: 9, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', fontWeight: 700 }}>
            פרטי עסקה — TRANSACTION DETAILS
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td colSpan={2} style={{ padding: '0 36px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <DetailRow label="מס׳ חשבונית" sublabel="Invoice No." value={sampleData.invoiceNo} bold />
                  <DetailRow label="תאריך" sublabel="Date" value={sampleData.date} stripe />
                  <DetailRow label="קונה" sublabel="Buyer" value={sampleData.buyerName} />
                  <DetailRow label="מקבל המתנה" sublabel="Recipient" value={<strong>{sampleData.recipientName}</strong>} stripe bold />
                  <DetailRow label="אמצעי תשלום" sublabel="Payment" value={`${sampleData.paymentBrand} ****${sampleData.paymentLast4}`} />
                </tbody>
              </table>
            </td></tr>
          </tbody>
        </table>

        {/* Spacer */}
        <div style={{ height: 8 }} />

        {/* Price breakdown */}
        <div style={{ padding: '14px 36px 8px', background: PARCHMENT, borderTop: `2px solid ${GOLD_RULE}` }}>
          <span style={{ fontSize: 9, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', fontWeight: 700 }}>
            פירוט מחיר — PRICE BREAKDOWN
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <AmountRow label='מחיר לפני מע"מ · Net ex. VAT' value={`₪${sampleData.netAmount.toFixed(2)}`} />
            <AmountRow label='מע"מ 18% · VAT 18%' value={`₪${sampleData.vatAmount.toFixed(2)}`} />
            <AmountRow label='סה"כ שולם · TOTAL PAID' value={`₪${sampleData.giftAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`} isTotal />
          </tbody>
        </table>

        {/* Spacer */}
        <div style={{ height: 8 }} />

        {/* Voucher card — dark luxury */}
        <div style={{ padding: '0 36px 28px', background: BODY }}>
          <div style={{ background: CARD_BG, borderRadius: 8, padding: '22px 26px', borderRight: `4px solid ${GOLD}` }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: GOLD, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
              🐾 PetWash™ E-Gift
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: GOLD }}>
              ₪{sampleData.giftAmount.toLocaleString('he-IL')}
            </div>
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#666', letterSpacing: 2, marginTop: 10 }}>
              {sampleData.voucherId}
            </div>
            <div style={{ fontSize: 9, color: '#555', marginTop: 6 }}>
              תקף לכל השירותים ב-PetWash™ · Valid for all PetWash™ services
            </div>
          </div>
        </div>

        {/* VAT note */}
        <div style={{ padding: '12px 36px', background: PARCHMENT, borderTop: `2px solid ${GOLD_RULE}` }}>
          <p style={{ margin: 0, fontSize: 9, color: TEXT_DIM, lineHeight: 1.7, textAlign: 'right' }}>
            מסמך זה כולל חשבונית מס קבלה בהתאם לחוק מע"מ. מע"מ 18% כלול במחיר.
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
