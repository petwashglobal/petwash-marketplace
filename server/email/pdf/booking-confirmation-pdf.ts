import PDFDocument from 'pdfkit';

export interface BookingPdfParams {
  invoiceNumber: string;
  bookingId: string;
  bookingNumber?: string;
  platformName: string;
  serviceType: string;
  providerName: string;
  providerAddress?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  petName?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  baseAmountCents: number;
  vatCents: number;
  loyaltyDiscountCents?: number;
  totalAmountCents: number;
  paymentStatus: string;
  escrowReleaseDate: Date;
  language?: 'he' | 'en';
}

// ── Palette ───────────────────────────────────────────────────────────────────
const GREEN  = '#2D6A4F';
const GREEN_LIGHT = '#40916C';
const DARK   = '#1A1A1A';
const MID    = '#444444';
const MUTED  = '#777777';
const BORDER = '#CCCCCC';
const BG_ROW = '#F8F8F8';
const WHITE  = '#FFFFFF';

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtDateLong(d: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Jerusalem'
  }).format(d);
}
function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jerusalem'
  }).format(d);
}
function fmtILS(cents: number): string {
  const n = (cents / 100).toFixed(2);
  return `\u20AA${n}`;          // ₪ symbol
}

export function generateBookingConfirmationPDF(params: BookingPdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: `PetWash Booking Confirmation ${params.bookingNumber || params.bookingId}`,
        Author: 'PetWash Ltd.',
        Subject: 'Booking Confirmation / Payment Summary',
        Keywords: 'petwash, booking, confirmation, payment, escrow'
      }
    });

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W     = 595.28;   // A4 width pts
    const H     = 841.89;   // A4 height pts
    const M     = 36;       // outer margin
    const INNER = W - M * 2;

    // ── HEADER ────────────────────────────────────────────────────────────────
    // White background
    doc.rect(0, 0, W, H).fill(WHITE);

    let y = M;

    // Brand mark (text-only — no external image)
    doc.font('Helvetica-Bold').fontSize(22).fillColor(DARK)
       .text('PetWash\u2122', 0, y, { width: W, align: 'center' });
    y += 30;

    doc.font('Helvetica-Bold').fontSize(11).fillColor(MID)
       .text('PetWash Ltd.', 0, y, { width: W, align: 'center' });
    y += 15;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('Company#: 517145033', 0, y, { width: W, align: 'center' });
    y += 13;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('www.petwash.co.il', 0, y, { width: W, align: 'center' });
    y += 13;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('support@petwash.co.il', 0, y, { width: W, align: 'center' });
    y += 20;

    // Horizontal rule
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor(BORDER).lineWidth(0.75).stroke();
    y += 14;

    // ── DOCUMENT TITLE ────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK)
       .text('Booking Confirmation / Payment Summary', 0, y, { width: W, align: 'center' });
    y += 13;
    // Sub-title in Hebrew
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d6\u05de\u05e0\u05d4 / \u05e1\u05d9\u05db\u05d5\u05dd \u05ea\u05e9\u05dc\u05d5\u05dd', 0, y, { width: W, align: 'center' });
    y += 16;

    // Meta row: Ref# / Booking# / Issue Date
    const metaY = y;
    const col3w = INNER / 3;

    doc.roundedRect(M, metaY, INNER, 32, 3).strokeColor(BORDER).lineWidth(0.5).stroke();
    // dividers
    doc.moveTo(M + col3w,     metaY).lineTo(M + col3w,     metaY + 32).strokeColor(BORDER).lineWidth(0.4).stroke();
    doc.moveTo(M + col3w * 2, metaY).lineTo(M + col3w * 2, metaY + 32).strokeColor(BORDER).lineWidth(0.4).stroke();

    const metaLabel = (text: string, x: number) =>
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(text, x + 6, metaY + 5, { width: col3w - 12 });
    const metaVal = (text: string, x: number) =>
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK).text(text, x + 6, metaY + 15, { width: col3w - 12 });

    metaLabel('Reference#:', M);
    metaVal(params.invoiceNumber, M);
    metaLabel('Booking#:', M + col3w);
    metaVal(params.bookingNumber || params.bookingId, M + col3w);
    metaLabel('Issue Date:', M + col3w * 2);
    metaVal(fmtDateLong(new Date()), M + col3w * 2);

    y = metaY + 32;

    // Second meta row
    const meta2Y = y;
    doc.roundedRect(M, meta2Y, INNER, 22, 0)
       .strokeColor(BORDER).lineWidth(0.4).stroke().fill(BG_ROW).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MID)
       .text(`Company#: 517145033`, M + 8, meta2Y + 7)
       .text(`\u05de\u05e1\u05e4\u05e8 \u05d4\u05d6\u05de\u05e0\u05d4: ${params.bookingId}`, M + INNER / 2, meta2Y + 7, { width: INNER / 2, align: 'right' });
    y = meta2Y + 22 + 14;

    // ── HELPER: Bordered section with two columns ─────────────────────────────
    function twoColSection(
      title: string,
      leftTitle: string,
      leftRows: [string, string][],
      rightTitle: string,
      rightRows: [string, string][],
      startY: number
    ): number {
      const leftRows_ = leftRows.filter(([, v]) => v);
      const rightRows_ = rightRows.filter(([, v]) => v);
      const rowH = 16;
      const headerH = 20;
      const pad = 8;
      const sectionH = headerH + Math.max(leftRows_.length, rightRows_.length) * rowH + pad * 2;
      const halfW = INNER / 2;

      // outer border
      doc.roundedRect(M, startY, INNER, sectionH, 3)
         .strokeColor(BORDER).lineWidth(0.5).stroke();
      // header band
      doc.rect(M, startY, INNER, headerH).fill('#F0F0F0');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
         .text(title, M + 8, startY + 5, { width: INNER - 16 });
      // column divider
      doc.moveTo(M + halfW, startY + headerH).lineTo(M + halfW, startY + sectionH)
         .strokeColor(BORDER).lineWidth(0.4).stroke();

      // column sub-headers
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MID)
         .text(leftTitle,  M + 8,         startY + headerH + pad - 3, { width: halfW - 16 })
         .text(rightTitle, M + halfW + 8, startY + headerH + pad - 3, { width: halfW - 16 });

      let rowY = startY + headerH + pad + 8;

      for (let i = 0; i < Math.max(leftRows_.length, rightRows_.length); i++) {
        const [lLabel, lVal] = leftRows_[i] || ['', ''];
        const [rLabel, rVal] = rightRows_[i] || ['', ''];

        if (lLabel) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED)
             .text(lLabel + ':', M + 8, rowY, { width: 72 });
          doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK)
             .text(lVal || '\u2014', M + 82, rowY, { width: halfW - 90 });
        }
        if (rLabel) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED)
             .text(rLabel + ':', M + halfW + 8, rowY, { width: 72 });
          doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK)
             .text(rVal || '\u2014', M + halfW + 82, rowY, { width: halfW - 90 });
        }
        rowY += rowH;
      }

      return startY + sectionH + 10;
    }

    // ── CUSTOMER + PROVIDER ────────────────────────────────────────────────────
    y = twoColSection(
      '',
      'Customer Details',
      [
        ['Name',  params.customerName],
        ['Phone', params.customerPhone || ''],
        ['Email', params.customerEmail],
      ],
      'Service Provider Details',
      [
        ['Name',    params.providerName],
        ['Address', params.providerAddress || ''],
        ['Phone',   ''],
      ],
      y
    );

    // ── SERVICE DETAILS ────────────────────────────────────────────────────────
    y = twoColSection(
      'Service Details',
      '',
      [
        ['Service Type', params.serviceType],
        ['Date & Time',  fmtDateTime(params.startDate)],
        ['End Time',     fmtDateTime(params.endDate)],
      ],
      '',
      [
        ['Pet Name',    params.petName || ''],
        ['Location',    params.location || params.providerAddress || ''],
        ['Booking #',   params.bookingNumber || params.bookingId],
      ],
      y
    );

    // ── FINANCIAL BREAKDOWN ────────────────────────────────────────────────────
    const disc = params.loyaltyDiscountCents || 0;
    const finY = y;
    const finRowH = 18;
    const finRows = disc > 0 ? 4 : 3;
    const finH = 20 + finRows * finRowH + 24 + 12;

    doc.roundedRect(M, finY, INNER, finH, 3)
       .strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.rect(M, finY, INNER, 20).fill('#F0F0F0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
       .text('Financial Breakdown', M + 8, finY + 5);

    const finColW = INNER / 2;
    let frY = finY + 20 + 6;

    function finRow2(leftLabel: string, leftVal: string, rightLabel: string, rightVal: string) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MID)
         .text(leftLabel + ':', M + 8, frY, { width: finColW - 16 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK)
         .text(leftVal, M + 120, frY, { width: finColW - 128 });
      doc.font('Helvetica').fontSize(8.5).fillColor(MID)
         .text(rightLabel + ':', M + finColW + 8, frY, { width: finColW / 2 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK)
         .text(rightVal, M + finColW + 100, frY, { width: finColW - 108 });
      // row divider
      frY += finRowH;
      doc.moveTo(M, frY - 2).lineTo(M + INNER, frY - 2).strokeColor('#EEEEEE').lineWidth(0.3).stroke();
    }

    finRow2(
      'Subtotal (excl. VAT)', fmtILS(params.baseAmountCents),
      'VAT (18%)',            fmtILS(params.vatCents)
    );
    if (disc > 0) {
      finRow2(
        'Loyalty Discount', `-${fmtILS(disc)}`,
        'Discounts',        `-${fmtILS(disc)}`
      );
    }

    // Total row
    const totalRowY = frY + 4;
    doc.rect(M, totalRowY, INNER, 26).fill('#F5F5F5');
    doc.moveTo(M, totalRowY).lineTo(M + INNER, totalRowY).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
       .text('Total Due:', M + 8, totalRowY + 7)
       .text(fmtILS(params.totalAmountCents), M + 8, totalRowY + 7, { width: INNER - 16, align: 'right' });
    // "Incl. discount" label if applicable
    if (disc > 0) {
      doc.font('Helvetica').fontSize(7.5).fillColor(GREEN_LIGHT)
         .text(`\u05e9\u05d7\u05de\u05ea: ${fmtILS(disc)}`, M + 8, totalRowY + 17, { width: INNER - 16, align: 'right' });
    }

    y = totalRowY + 26 + 12;

    // ── ESCROW MECHANISM ──────────────────────────────────────────────────────
    const escrowH = 66;
    doc.roundedRect(M, y, INNER, escrowH, 3).fill(GREEN).stroke();
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(WHITE)
       .text('Escrow Mechanism', M + 10, y + 9);
    doc.font('Helvetica').fontSize(8.5).fillColor('rgba(255,255,255,0.92)')
       .text(
         'The payment has been collected in full at the time of booking and is held in escrow by PetWash Ltd. ' +
         'Transfer of funds to the service provider will be made only upon completion of the service and client approval.',
         M + 10, y + 25, { width: INNER - 20, lineGap: 2 }
       );
    doc.font('Helvetica-Bold').fontSize(8).fillColor('rgba(255,255,255,0.75)')
       .text(`Release Date: ${fmtDateTime(params.escrowReleaseDate)}`, M + 10, y + 52);
    y += escrowH + 12;

    // ── NOT-A-TAX-INVOICE NOTICE ──────────────────────────────────────────────
    const noticeH = 38;
    doc.roundedRect(M, y, INNER, noticeH, 3).fill('#FFF8E1').stroke('#F0A500');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#7A5000')
       .text('\u26A0  IMPORTANT NOTICE', M + 10, y + 7);
    doc.font('Helvetica').fontSize(7.5).fillColor('#7A5000')
       .text(
         'This document is a Booking Confirmation and Payment Summary ONLY. It is NOT a tax invoice (חשבונית מס). ' +
         'An official tax invoice will be issued separately through the authorized accounting system.',
         M + 10, y + 18, { width: INNER - 20, lineGap: 1 }
       );
    y += noticeH + 10;

    // ── LEGAL DISCLAIMER ──────────────────────────────────────────────────────
    const legalItems = [
      'PetWash Ltd. operates as a technological intermediary platform that connects clients with independent service providers. PetWash Ltd. is not a party to the service agreement and is not responsible for the actual performance, quality, outcome of the service, or any damages incurred.',
      'Full responsibility for service execution rests solely with the service provider.',
      'The payment amounts shown include an estimated VAT component of 18%. The official tax invoice, issued through the authorized accounting system, is the binding tax document for VAT deduction purposes.',
      'In case of dispute, contact customer service within 24 hours of service completion: support@petwash.co.il',
    ];

    doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Legal Disclaimer:', M, y);
    y += 14;

    for (const item of legalItems) {
      // checkmark bullet
      doc.font('Helvetica').fontSize(9).fillColor(GREEN_LIGHT).text('\u2713', M, y);
      doc.font('Helvetica').fontSize(8).fillColor(MID)
         .text(item, M + 14, y, { width: INNER - 14, lineGap: 1.5 });
      const h = doc.heightOfString(item, { width: INNER - 14 });
      y += Math.max(h + 4, 18);
    }

    y += 8;

    // ── AUDIT TRAIL ───────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MID)
       .text('Audit Trail', M, y);
    y += 12;

    const auditFields: [string, string][] = [
      ['Booking Created',        fmtDateTime(params.startDate)],
      ['Confirmation Issued',    fmtDateTime(new Date())],
      ['Payment Status',         params.paymentStatus],
      ['System ID',              params.bookingId],
    ];

    for (const [k, v] of auditFields) {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(k + ': ', M, y, { continued: true });
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(DARK).text(v);
      y += 12;
    }

    y += 8;

    // ── DIGITAL SIGNATURE LINE ─────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MID)
       .text('Confirmed by:', M, y)
       .text('PetWash Booking System', M + 80, y);
    y += 8;
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
       .text(`Generated: ${new Date().toISOString()}  |  PetWash Ltd. — Booking Confirmation System`, M, y);

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = H - 24;
    doc.moveTo(M, footerY).lineTo(W - M, footerY).strokeColor(BORDER).lineWidth(0.4).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
       .text(
         `\u00A9 ${new Date().getFullYear()} All rights reserved. This document was produced by PetWash Ltd.  |  \u05e4\u05d8 \u05d5\u05d5\u05d0\u05e9 \u05d1\u05e2\u05de \u05d7.\u05e4. 517145033`,
         M, footerY + 6, { width: INNER, align: 'center' }
       );

    doc.end();
  });
}
