import PDFDocument from 'pdfkit';

export interface BookingPdfParams {
  invoiceNumber: string;
  bookingId: string;
  bookingNumber?: string;
  platformName: string;
  serviceType: string;
  providerName: string;
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

const CORAL   = '#E8524A';
const GREEN   = '#00B140';
const TEAL    = '#00C9A7';
const DARK    = '#1a1a1a';
const MID     = '#444444';
const LIGHT   = '#888888';
const RULE    = '#E5E5E5';

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Jerusalem'
  }).format(d);
}
function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem'
  }).format(d);
}
function fmtILS(cents: number): string {
  return `ILS ${(cents / 100).toFixed(2)}`;
}

export function generateBookingConfirmationPDF(params: BookingPdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28;
    const MARGIN = 48;
    const COL = W - MARGIN * 2;

    // ── HEADER BAND ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 88).fill(CORAL);

    // brand name
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
       .text('PET WASH™', MARGIN, 24, { characterSpacing: 4 });

    // doc type
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
       .text('TAX INVOICE & BOOKING CONFIRMATION', MARGIN, 50, { characterSpacing: 2 });

    // invoice number top-right
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
       .text(params.invoiceNumber, W - MARGIN - 130, 28, { width: 130, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.7)')
       .text(fmtDate(new Date()), W - MARGIN - 130, 46, { width: 130, align: 'right' });

    // ── GREEN ACCENT STRIPE ──────────────────────────────────────────────────
    doc.rect(0, 88, W, 4).fill(GREEN);

    let y = 112;

    // ── STATUS BADGE ────────────────────────────────────────────────────────
    doc.roundedRect(MARGIN, y, 160, 26, 13).fill(GREEN);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
       .text('✓  BOOKING CONFIRMED', MARGIN + 10, y + 8, { width: 140, align: 'center', characterSpacing: 1 });

    doc.font('Helvetica').fontSize(8).fillColor(LIGHT)
       .text(`Issued: ${fmtDate(new Date())} at ${fmtTime(new Date())}`, MARGIN + 170, y + 9);

    y += 46;

    // ── TWO-COLUMN LAYOUT: CUSTOMER + SERVICE PROVIDER ───────────────────────
    const halfW = (COL - 16) / 2;

    function sectionHeader(title: string, yPos: number) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(CORAL)
         .text(title.toUpperCase(), MARGIN, yPos, { characterSpacing: 2 });
      doc.moveTo(MARGIN, yPos + 13).lineTo(MARGIN + COL, yPos + 13).strokeColor(RULE).lineWidth(0.5).stroke();
    }

    function rowPair(label: string, value: string, xStart: number, yPos: number, colWidth: number): number {
      doc.font('Helvetica').fontSize(8).fillColor(LIGHT).text(label, xStart, yPos, { width: colWidth });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
         .text(value || '—', xStart, yPos + 11, { width: colWidth });
      return yPos + 26;
    }

    // Customer
    sectionHeader('Customer Information', y);
    y += 18;
    const colR = MARGIN + halfW + 16;
    let yL = y;
    let yR = y;

    yL = rowPair('Full Name', params.customerName, MARGIN, yL, halfW);
    yL = rowPair('Email Address', params.customerEmail, MARGIN, yL, halfW);
    if (params.customerPhone)
      yL = rowPair('Phone', params.customerPhone, MARGIN, yL, halfW);
    if (params.petName)
      yL = rowPair('Pet Name', params.petName, MARGIN, yL, halfW);

    // Provider
    yR = rowPair('Service Provider', params.providerName, colR, yR, halfW);
    yR = rowPair('Platform', params.platformName, colR, yR, halfW);
    yR = rowPair('Service Type', params.serviceType, colR, yR, halfW);
    if (params.location)
      yR = rowPair('Location', params.location, colR, yR, halfW);

    y = Math.max(yL, yR) + 14;

    // ── BOOKING DETAILS ──────────────────────────────────────────────────────
    sectionHeader('Booking Details', y);
    y += 18;

    const col3 = COL / 3;
    function col3pair(label: string, value: string, colIdx: number, yPos: number): void {
      const xPos = MARGIN + colIdx * col3;
      doc.font('Helvetica').fontSize(8).fillColor(LIGHT).text(label, xPos, yPos, { width: col3 - 8 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(value || '—', xPos, yPos + 11, { width: col3 - 8 });
    }

    col3pair('Booking ID', params.bookingId, 0, y);
    col3pair('Invoice No.', params.invoiceNumber, 1, y);
    col3pair('Payment Status', params.paymentStatus, 2, y);
    y += 30;

    col3pair('Service Date', fmtDate(params.startDate), 0, y);
    col3pair('Start Time', fmtTime(params.startDate), 1, y);
    col3pair('End Time', fmtTime(params.endDate), 2, y);
    y += 38;

    // ── FINANCIAL SUMMARY ────────────────────────────────────────────────────
    sectionHeader('Financial Summary', y);
    y += 18;

    // Table header
    doc.rect(MARGIN, y, COL, 22).fill('#F7F7F7');
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MID)
       .text('Description', MARGIN + 10, y + 7)
       .text('Amount (ILS)', W - MARGIN - 100, y + 7, { width: 100, align: 'right' });
    y += 22;

    function finRow(label: string, value: string, accent?: string) {
      doc.moveTo(MARGIN, y).lineTo(MARGIN + COL, y).strokeColor(RULE).lineWidth(0.3).stroke();
      doc.font('Helvetica').fontSize(9).fillColor(DARK).text(label, MARGIN + 10, y + 7);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(accent || DARK)
         .text(value, W - MARGIN - 100, y + 7, { width: 100, align: 'right' });
      y += 22;
    }

    const net = params.baseAmountCents;
    const vat = params.vatCents;
    const disc = params.loyaltyDiscountCents || 0;
    const total = params.totalAmountCents;

    finRow('Service Fee (excl. VAT)', fmtILS(net));
    finRow('VAT 18% — Israeli VAT Reg. 517145033', fmtILS(vat), CORAL);
    if (disc > 0) finRow('Loyalty Discount', `-${fmtILS(disc)}`, TEAL);

    // Total row
    doc.rect(MARGIN, y, COL, 30).fill(DARK);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
       .text('TOTAL CHARGED', MARGIN + 10, y + 9)
       .text(fmtILS(total), W - MARGIN - 110, y + 9, { width: 110, align: 'right' });
    y += 44;

    // ── ESCROW & PAYMENT STATUS ──────────────────────────────────────────────
    doc.rect(MARGIN, y, COL, 66).fill('#F0FDF6');
    doc.rect(MARGIN, y, 4, 66).fill(GREEN);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN)
       .text('ESCROW & PAYMENT STATUS', MARGIN + 14, y + 10, { characterSpacing: 1.5 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
       .text('Payment Received — Held in Secure Escrow', MARGIN + 14, y + 24);
    doc.font('Helvetica').fontSize(8.5).fillColor(MID)
       .text(`Escrow Release: ${fmtDate(params.escrowReleaseDate)} at ${fmtTime(params.escrowReleaseDate)}`, MARGIN + 14, y + 38)
       .text('Funds are released automatically upon verified service completion.', MARGIN + 14, y + 50);
    y += 80;

    // ── AUDIT TRAIL ──────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, COL, 50).fill('#FFF8F8');
    doc.rect(MARGIN, y, 4, 50).fill(CORAL);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(CORAL)
       .text('AUDIT TRAIL', MARGIN + 14, y + 10, { characterSpacing: 1.5 });
    const auditY = y + 24;
    doc.font('Helvetica').fontSize(8.5).fillColor(MID)
       .text(`Booking ID: ${params.bookingId}`, MARGIN + 14, auditY)
       .text(`Invoice No: ${params.invoiceNumber}`, MARGIN + 14, auditY + 12)
       .text(`Confirmed: ${new Date().toISOString()}  |  Platform: ${params.platformName}`, MARGIN + 14 + 200, auditY);
    y += 64;

    // ── FOOTER ───────────────────────────────────────────────────────────────
    doc.rect(0, 760, W, 81).fill(DARK);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
       .text('Pet Wash™ Ltd.  |  Petwash.co.il', MARGIN, 772);
    doc.font('Helvetica').fontSize(7.5).fillColor('rgba(255,255,255,0.65)')
       .text('Company No. (ח.פ.): 517145033  |  פט וואש בע"מ  |  VAT Reg.: 517145033', MARGIN, 786)
       .text('Support@PetWash.co.il  |  petwash.co.il/support  |  This is an official tax document.', MARGIN, 799)
       .text(`© ${new Date().getFullYear()} Pet Wash™ Ltd. All rights reserved.  Digitally issued — no signature required.`, MARGIN, 812);

    // footer right — teal stripe
    doc.rect(W - 8, 760, 8, 81).fill(TEAL);

    doc.end();
  });
}
