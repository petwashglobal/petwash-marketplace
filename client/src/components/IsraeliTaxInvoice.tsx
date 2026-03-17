import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Share2 } from 'lucide-react';

export interface InvoiceLineItem {
  description: string;
  descriptionHe?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface IsraeliInvoiceData {
  invoiceNumber: string;
  invoiceType?: 'חשבונית מס קבלה' | 'חשבונית מס' | 'קבלה';
  issueDate: string;
  dueDate?: string;
  transactionId?: string;
  bookingId?: string;
  paymentMethod?: string;
  paymentMethodHe?: string;
  // Supplier (PetWash)
  supplierName: string;
  supplierNameHe?: string;
  supplierVatNumber: string;
  supplierAddress: string;
  supplierAddressHe?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  // Customer
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerVatNumber?: string;
  customerAddress?: string;
  // Items
  lineItems: InvoiceLineItem[];
  // Totals
  subtotalBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  // Optional discounts / loyalty
  discountAmount?: number;
  loyaltyPointsEarned?: number;
  notes?: string;
  notesHe?: string;
}

interface Props {
  data: IsraeliInvoiceData;
  language?: 'he' | 'en';
  showActions?: boolean;
}

export function IsraeliTaxInvoice({ data, language = 'he', showActions = true }: Props) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const isHebrew = language === 'he';

  const fmt = (n: number) =>
    new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 }).format(n);

  const handlePrint = () => {
    const el = invoiceRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8"/>
        <title>חשבונית מס ${data.invoiceNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Arial', sans-serif; background: white; color: #111; font-size: 13px; }
          .invoice { max-width: 800px; margin: 0 auto; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 24px; }
          .logo-area h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
          .logo-area p { font-size: 11px; color: #555; }
          .invoice-title { text-align: left; }
          .invoice-title h2 { font-size: 22px; font-weight: 700; }
          .invoice-title .number { font-size: 16px; color: #333; font-family: monospace; }
          .invoice-title .date { font-size: 12px; color: #777; margin-top: 4px; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 8px; }
          .party h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #777; margin-bottom: 8px; letter-spacing: 1px; }
          .party p { font-size: 13px; line-height: 1.6; }
          .party .vat { font-size: 11px; color: #555; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #000; color: white; padding: 10px 12px; font-size: 12px; text-align: right; }
          td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #eee; text-align: right; }
          tr:nth-child(even) td { background: #fafafa; }
          .totals { margin-right: auto; margin-left: 0; width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .totals-row.vat { border-top: 1px dashed #ccc; padding-top: 8px; color: #555; }
          .totals-row.grand { border-top: 2px solid #000; padding-top: 10px; font-size: 18px; font-weight: 900; margin-top: 4px; }
          .totals-row.discount { color: #16a34a; }
          .payment-stamp { margin-top: 24px; padding: 14px; border: 2px solid #000; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
          .stamp { width: 90px; height: 90px; border: 2px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; text-align: center; line-height: 1.3; padding: 8px; color: #000; }
          .legal { margin-top: 20px; font-size: 10px; color: #999; text-align: center; line-height: 1.6; border-top: 1px solid #eee; padding-top: 12px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${el.innerHTML}
      </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `חשבונית מס ${data.invoiceNumber}`,
        text: `חשבונית מס ${data.invoiceNumber} מ-PetWash™ — ₪${data.totalWithVat.toFixed(2)}`,
      });
    }
  };

  const docType = data.invoiceType || 'חשבונית מס קבלה';
  const issueDateFormatted = new Date(data.issueDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-3">
      {showActions && (
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            style={{ background: '#000000' }}
            className="text-white rounded-xl gap-2 text-sm font-semibold"
          >
            <Printer className="w-4 h-4" />
            {isHebrew ? 'הדפס / הורד PDF' : 'Print / Download PDF'}
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="rounded-xl border-gray-200 gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            {isHebrew ? 'שמור כ-PDF' : 'Save as PDF'}
          </Button>
          {'share' in navigator && (
            <Button
              onClick={handleShare}
              variant="outline"
              className="rounded-xl border-gray-200 gap-2 text-sm"
            >
              <Share2 className="w-4 h-4" />
              {isHebrew ? 'שתף' : 'Share'}
            </Button>
          )}
        </div>
      )}

      {/* ── The invoice itself ── */}
      <div
        ref={invoiceRef}
        dir="rtl"
        className="invoice bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden"
        style={{ fontFamily: 'Arial, sans-serif', maxWidth: 800 }}
      >
        {/* Header */}
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #000', padding: '24px 32px 20px', marginBottom: 0, background: '#fff' }}>
          <div className="logo-area">
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: '#000' }}>PetWash™</h1>
            <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>פטוואש בע"מ — פתרונות טיפוח בע"מ לחיות מחמד</p>
            <p style={{ fontSize: 10, color: '#777', marginTop: 2 }}>מע"מ 516788400 | www.petwash.co.il</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#000' }}>{docType}</h2>
            <p style={{ fontFamily: 'monospace', fontSize: 15, color: '#333', marginTop: 4 }}>מס׳ {data.invoiceNumber}</p>
            <p style={{ fontSize: 11, color: '#777', marginTop: 4 }}>תאריך: {issueDateFormatted}</p>
            {data.bookingId && <p style={{ fontSize: 11, color: '#999', marginTop: 2 }}>הזמנה: {data.bookingId}</p>}
          </div>
        </div>

        <div style={{ padding: '20px 32px' }}>
          {/* Supplier + Customer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, padding: 16, background: '#f9f9f9', borderRadius: 10 }}>
            {/* Supplier */}
            <div>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#777', marginBottom: 8, letterSpacing: 1 }}>המוכר / הנותן שירות</h3>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{data.supplierNameHe || data.supplierName}</p>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: '#444', whiteSpace: 'pre-line' }}>{data.supplierAddressHe || data.supplierAddress}</p>
              <p style={{ fontSize: 11, color: '#555', fontFamily: 'monospace', marginTop: 4 }}>ח.פ. / מע"מ: {data.supplierVatNumber}</p>
              {data.supplierPhone && <p style={{ fontSize: 11, color: '#555' }}>📞 {data.supplierPhone}</p>}
              {data.supplierEmail && <p style={{ fontSize: 11, color: '#555' }}>✉ {data.supplierEmail}</p>}
            </div>
            {/* Customer */}
            <div>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#777', marginBottom: 8, letterSpacing: 1 }}>הלקוח / הרוכש</h3>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{data.customerName}</p>
              {data.customerAddress && <p style={{ fontSize: 12, lineHeight: 1.6, color: '#444' }}>{data.customerAddress}</p>}
              {data.customerVatNumber && <p style={{ fontSize: 11, color: '#555', fontFamily: 'monospace', marginTop: 4 }}>מע"מ לקוח: {data.customerVatNumber}</p>}
              {data.customerPhone && <p style={{ fontSize: 11, color: '#555' }}>📞 {data.customerPhone}</p>}
              {data.customerEmail && <p style={{ fontSize: 11, color: '#555' }}>✉ {data.customerEmail}</p>}
            </div>
          </div>

          {/* Line items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ background: '#000', color: '#fff', padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>תיאור</th>
                <th style={{ background: '#000', color: '#fff', padding: '10px 12px', fontSize: 12, textAlign: 'center', width: 60 }}>כמות</th>
                <th style={{ background: '#000', color: '#fff', padding: '10px 12px', fontSize: 12, textAlign: 'left', width: 110 }}>מחיר יחידה</th>
                <th style={{ background: '#000', color: '#fff', padding: '10px 12px', fontSize: 12, textAlign: 'left', width: 110 }}>סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #eee', background: i % 2 === 1 ? '#fafafa' : 'white' }}>
                    {item.descriptionHe || item.description}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid #eee', background: i % 2 === 1 ? '#fafafa' : 'white' }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'left', borderBottom: '1px solid #eee', background: i % 2 === 1 ? '#fafafa' : 'white', fontFamily: 'monospace' }}>
                    {fmt(item.unitPrice)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'left', borderBottom: '1px solid #eee', background: i % 2 === 1 ? '#fafafa' : 'white', fontFamily: 'monospace', fontWeight: 600 }}>
                    {fmt(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals block */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span style={{ color: '#555' }}>סכום לפני מע"מ:</span>
                <span style={{ fontFamily: 'monospace' }}>{fmt(data.subtotalBeforeVat)}</span>
              </div>
              {data.discountAmount && data.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#16a34a' }}>
                  <span>הנחה:</span>
                  <span style={{ fontFamily: 'monospace' }}>−{fmt(data.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderTop: '1px dashed #ccc', marginTop: 4, color: '#555' }}>
                <span>מע"מ ({(data.vatRate * 100).toFixed(0)}%):</span>
                <span style={{ fontFamily: 'monospace' }}>{fmt(data.vatAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 20, fontWeight: 900, borderTop: '3px solid #000', marginTop: 4 }}>
                <span>סה"כ לתשלום:</span>
                <span style={{ fontFamily: 'monospace' }}>{fmt(data.totalWithVat)}</span>
              </div>
            </div>
          </div>

          {/* Payment stamp area */}
          <div style={{ marginTop: 24, padding: 14, border: '2px solid #000', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>אמצעי תשלום:</p>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{data.paymentMethodHe || data.paymentMethod || 'כרטיס אשראי'}</p>
              {data.transactionId && <p style={{ fontSize: 10, color: '#999', fontFamily: 'monospace', marginTop: 2 }}>עסקה: {data.transactionId}</p>}
              <p style={{ fontSize: 11, color: '#333', marginTop: 6, fontWeight: 600 }}>✅ שולם במלואו</p>
            </div>
            <div style={{ width: 90, height: 90, border: '2px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.3, padding: 8 }}>
              PetWash™<br />פטוואש<br />בע"מ
            </div>
          </div>

          {/* Notes */}
          {(data.notesHe || data.notes) && (
            <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', borderRadius: 8, fontSize: 12, color: '#555' }}>
              <span style={{ fontWeight: 700 }}>הערות: </span>
              {data.notesHe || data.notes}
            </div>
          )}

          {/* Loyalty points earned */}
          {data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534' }}>
              🏆 {data.loyaltyPointsEarned} נקודות נצברו בעסקה זו
            </div>
          )}

          {/* Legal footer */}
          <div style={{ marginTop: 20, fontSize: 10, color: '#aaa', textAlign: 'center', lineHeight: 1.7, borderTop: '1px solid #eee', paddingTop: 12 }}>
            <p>מסמך זה הופק אלקטרונית בהתאם לחוק עסקאות אלקטרוניות, תשסא-2001 ותקנות מס ערך מוסף (ניהול פנקסי חשבונות), תשל"ו-1976</p>
            <p>PetWash Ltd. (פטוואש בע"מ) | מע"מ 516788400 | רשום ברשם החברות | www.petwash.co.il</p>
            <p>הקבלה הונפקה ב-{issueDateFormatted} | מס׳ {data.invoiceNumber}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: build invoice data from a booking/transaction object
export function buildInvoiceFromTransaction(tx: any, customerName: string, customerPhone?: string, customerEmail?: string): IsraeliInvoiceData {
  const amount = parseFloat(tx.amount || tx.totalAmount || 0);
  const vatRate = 0.18;
  const subtotal = amount / (1 + vatRate);
  const vatAmount = amount - subtotal;

  return {
    invoiceNumber: tx.invoiceNumber || `PW-${new Date().getFullYear()}-${String(tx.id || Date.now()).slice(-6)}`,
    invoiceType: 'חשבונית מס קבלה',
    issueDate: tx.createdAt || tx.completedAt || new Date().toISOString(),
    transactionId: tx.transactionId || tx.id,
    bookingId: tx.bookingId,
    paymentMethod: tx.paymentMethod,
    paymentMethodHe: tx.paymentMethod === 'credit_card' ? 'כרטיס אשראי'
      : tx.paymentMethod === 'wallet' ? 'ארנק PetWash'
      : tx.paymentMethod === 'cash' ? 'מזומן'
      : tx.paymentMethod || 'כרטיס אשראי',
    supplierName: 'PetWash Ltd.',
    supplierNameHe: 'פטוואש בע"מ',
    supplierVatNumber: '516788400',
    supplierAddress: '1 Rothschild Blvd, Tel Aviv, Israel',
    supplierAddressHe: 'רחוב רוטשילד 1, תל אביב, ישראל',
    supplierPhone: '*2637',
    supplierEmail: 'billing@petwash.co.il',
    customerName,
    customerPhone,
    customerEmail,
    lineItems: tx.lineItems || [{
      description: tx.serviceName || tx.serviceType || 'Pet Care Service',
      descriptionHe: tx.serviceNameHe || tx.serviceType || 'שירות טיפוח לחיית מחמד',
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
    }],
    subtotalBeforeVat: subtotal,
    vatRate,
    vatAmount,
    totalWithVat: amount,
    discountAmount: tx.discountAmount,
    loyaltyPointsEarned: tx.loyaltyPointsEarned,
    notes: tx.notes,
    notesHe: tx.notesHe,
  };
}
