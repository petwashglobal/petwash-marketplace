/**
 * ESCROW STATEMENT — Internal document for provider and operations.
 *
 * Document type:  escrow_statement
 * Issued by:      Platform (PetWash Ltd.)
 * Recipients:     Service provider + ops team
 * Legal status:   NOT a tax document. NOT a receipt. NOT an invoice.
 * Purpose:        Shows the money flow — what was captured, what is held,
 *                 platform fee, and what the provider will receive on release.
 *
 * CRITICAL: This document must never be called a receipt, invoice, or קבלה.
 */

import PDFDocument from 'pdfkit';

export interface EscrowStatementParams {
  statementId: string;
  bookingId: string;
  bookingNumber?: string;
  issuedAt?: Date;

  customerName: string;
  providerName: string;
  serviceType: string;
  serviceDate: Date;
  platformName: string;

  /** Total amount captured from customer (ILS cents) */
  totalCapturedCents: number;
  /** Platform service fee before VAT (ILS cents) */
  platformFeeCents: number;
  /** VAT on platform fee only — 18% (ILS cents) */
  platformFeeVatCents: number;
  /** Amount held in escrow that will be released to provider */
  escrowAmountForProviderCents: number;

  paymentCapturedAt: Date;
  escrowReleaseDate: Date;
  /** Text description of release conditions */
  releaseConditions?: string;
  paymentStatus: string;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const GREEN       = '#2D6A4F';
const GREEN_LIGHT = '#40916C';
const DARK        = '#1A1A1A';
const MID         = '#444444';
const MUTED       = '#777777';
const BORDER      = '#CCCCCC';
const BG_ROW      = '#F8F8F8';
const WHITE       = '#FFFFFF';
const AMBER_BG    = '#FFF8E1';
const AMBER_BORDER = '#F0A500';
const AMBER_TEXT  = '#7A5000';

function fmtDate(d: Date): string {
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
  return `\u20AA${(cents / 100).toFixed(2)}`;
}

export function generateEscrowStatementPDF(params: EscrowStatementParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const issuedAt = params.issuedAt ?? new Date();

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: `PetWash Escrow Statement ${params.statementId}`,
        Author: 'PetWash Ltd.',
        Subject: 'Escrow / Settlement Statement — Internal',
        Keywords: 'petwash, escrow, settlement, statement, internal'
      }
    });

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W     = 595.28;
    const H     = 841.89;
    const M     = 36;
    const INNER = W - M * 2;

    // Background
    doc.rect(0, 0, W, H).fill(WHITE);

    let y = M;

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(20).fillColor(DARK)
       .text('PetWash\u2122', 0, y, { width: W, align: 'center' });
    y += 26;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('PetWash Ltd.  |  ח.פ. 517145033  |  www.petwash.co.il', 0, y, { width: W, align: 'center' });
    y += 20;

    doc.moveTo(M, y).lineTo(W - M, y).strokeColor(BORDER).lineWidth(0.75).stroke();
    y += 14;

    // ── TITLE ─────────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK)
       .text('Escrow / Settlement Statement', 0, y, { width: W, align: 'center' });
    y += 13;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('\u05d3\u05d5\u05d7 \u05e0\u05d0\u05de\u05e0\u05d5\u05ea  |  \u05dc\u05e9\u05d9\u05de\u05d5\u05e9 \u05e4\u05e0\u05d9\u05de\u05d9 \u05d1\u05dc\u05d1\u05d3', 0, y, { width: W, align: 'center' });
    y += 16;

    // ── NOT A TAX DOCUMENT notice ─────────────────────────────────────────────
    doc.roundedRect(M, y, INNER, 34, 3).fill(AMBER_BG).strokeColor(AMBER_BORDER).lineWidth(0.8).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER_TEXT)
       .text('\u26A0  INTERNAL DOCUMENT — NOT A TAX DOCUMENT, RECEIPT, OR INVOICE', M + 10, y + 7);
    doc.font('Helvetica').fontSize(7.5).fillColor(AMBER_TEXT)
       .text(
         'This statement explains the money flow only. It is not a legal tax document. ' +
         'Receipts and tax invoices must be issued through the authorized accounting system.',
         M + 10, y + 18, { width: INNER - 20 }
       );
    y += 44;

    // ── META ROW ──────────────────────────────────────────────────────────────
    const col3w = INNER / 3;
    doc.roundedRect(M, y, INNER, 32, 3).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveTo(M + col3w,     y).lineTo(M + col3w,     y + 32).strokeColor(BORDER).lineWidth(0.4).stroke();
    doc.moveTo(M + col3w * 2, y).lineTo(M + col3w * 2, y + 32).strokeColor(BORDER).lineWidth(0.4).stroke();

    const ml = (txt: string, x: number) =>
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(txt, x + 6, y + 5, { width: col3w - 12 });
    const mv = (txt: string, x: number) =>
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK).text(txt, x + 6, y + 15, { width: col3w - 12 });

    ml('Statement ID:', M);               mv(params.statementId, M);
    ml('Booking#:', M + col3w);           mv(params.bookingNumber || params.bookingId, M + col3w);
    ml('Issued:', M + col3w * 2);         mv(fmtDate(issuedAt), M + col3w * 2);
    y += 32 + 12;

    // ── BOOKING DETAILS ────────────────────────────────────────────────────────
    doc.rect(M, y, INNER, 20).fill('#F0F0F0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Booking Details', M + 8, y + 5);
    doc.roundedRect(M, y, INNER, 80, 3).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 20 + 6;

    const halfW = INNER / 2;
    const detailPairs: [string, string, string, string][] = [
      ['Customer',       params.customerName,  'Service Provider', params.providerName],
      ['Service Type',   params.serviceType,   'Platform',         params.platformName],
      ['Service Date',   fmtDate(params.serviceDate), 'Payment Captured', fmtDateTime(params.paymentCapturedAt)],
    ];

    for (const [lk, lv, rk, rv] of detailPairs) {
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(lk + ':', M + 8, y, { width: 88 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK).text(lv, M + 98, y, { width: halfW - 106 });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(rk + ':', M + halfW + 8, y, { width: 88 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK).text(rv, M + halfW + 98, y, { width: halfW - 106 });
      y += 16;
    }
    y += 10;

    // ── MONEY FLOW TABLE ──────────────────────────────────────────────────────
    const tableTop = y;
    const tableH = 220;

    doc.roundedRect(M, tableTop, INNER, tableH, 3).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.rect(M, tableTop, INNER, 22).fill('#1A1A1A');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
       .text('Money Flow — Escrow Breakdown', M + 10, tableTop + 7)
       .text('Amount (ILS)', M, tableTop + 7, { width: INNER - 10, align: 'right' });

    let tY = tableTop + 22;

    function flowRow(label: string, note: string, amount: string, amountColor = DARK, bg = WHITE) {
      doc.rect(M, tY, INNER, 32).fill(bg);
      doc.moveTo(M, tY).lineTo(M + INNER, tY).strokeColor('#EEEEEE').lineWidth(0.3).stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(label, M + 10, tY + 5, { width: INNER - 130 });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(note, M + 10, tY + 17, { width: INNER - 130 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(amountColor)
         .text(amount, M + 10, tY + 8, { width: INNER - 20, align: 'right' });
      tY += 32;
    }

    flowRow(
      '(1) Total Captured from Customer',
      'Full amount paid by customer at time of booking',
      fmtILS(params.totalCapturedCents),
      DARK, BG_ROW
    );
    flowRow(
      '(2) Platform Service Fee',
      'PetWash Ltd. intermediary fee — excl. VAT',
      `\u2212 ${fmtILS(params.platformFeeCents)}`,
      '#B00000'
    );
    flowRow(
      '(3) VAT on Platform Fee (18%)',
      'VAT payable on PetWash platform fee only — not on provider portion',
      `\u2212 ${fmtILS(params.platformFeeVatCents)}`,
      '#B00000', BG_ROW
    );

    // Divider before escrow amount
    doc.moveTo(M + 20, tY + 2).lineTo(M + INNER - 20, tY + 2).strokeColor(BORDER).lineWidth(1).stroke();
    tY += 8;

    // Escrow amount row — highlighted green
    doc.rect(M, tY, INNER, 36).fill('#F0FDF6');
    doc.moveTo(M, tY).lineTo(M + INNER, tY).strokeColor(GREEN_LIGHT).lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN)
       .text('(4) Amount Held in Escrow for Provider', M + 10, tY + 6)
       .text(fmtILS(params.escrowAmountForProviderCents), M + 10, tY + 6, { width: INNER - 20, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor(GREEN_LIGHT)
       .text('Awaiting service completion — not yet provider revenue', M + 10, tY + 21);
    tY += 36;

    y = tableTop + tableH + 14;

    // ── ESCROW STATUS ─────────────────────────────────────────────────────────
    const escrowH = 72;
    doc.roundedRect(M, y, INNER, escrowH, 3).fill(GREEN).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE)
       .text('Escrow Status & Release Conditions', M + 10, y + 9);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('rgba(255,255,255,0.85)')
       .text('Payment Status: ', M + 10, y + 27, { continued: true });
    doc.font('Helvetica').fontSize(8.5).fillColor(WHITE)
       .text(params.paymentStatus);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('rgba(255,255,255,0.85)')
       .text('Scheduled Release: ', M + 10, y + 42, { continued: true });
    doc.font('Helvetica').fontSize(8.5).fillColor(WHITE)
       .text(fmtDateTime(params.escrowReleaseDate));
    doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.7)')
       .text(
         params.releaseConditions ||
         'Funds are released to the provider automatically upon verified service completion and customer approval.',
         M + 10, y + 57, { width: INNER - 20 }
       );
    y += escrowH + 14;

    // ── LEGAL NOTES ───────────────────────────────────────────────────────────
    const legalNotes = [
      'This statement explains the escrow money flow only. Escrow ≠ revenue. Money held in escrow has not been earned by the provider until the service is completed and funds are released.',
      'The platform fee (item 2) and VAT on platform fee (item 3) represent PetWash Ltd.\'s revenue portion. Tax documents for these amounts are issued separately through the authorized accounting system.',
      'The provider must issue a tax invoice (חשבונית מס) for their portion of the transaction through their own authorized accounting system upon completion of service.',
      'This document must be retained by the platform for a minimum of 7 years in accordance with Israeli law.',
    ];

    doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Important Notes:', M, y);
    y += 13;

    for (const note of legalNotes) {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('\u2022', M, y);
      doc.font('Helvetica').fontSize(7.5).fillColor(MID).text(note, M + 10, y, { width: INNER - 10, lineGap: 1.5 });
      const h = doc.heightOfString(note, { width: INNER - 10, lineGap: 1.5 });
      y += Math.max(h + 5, 16);
    }

    y += 6;

    // ── AUDIT LINE ────────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 7;
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
       .text(`Statement ID: ${params.statementId}  |  Booking: ${params.bookingId}  |  Generated: ${issuedAt.toISOString()}  |  PetWash Escrow Management System`, M, y, { width: INNER });

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = H - 24;
    doc.moveTo(M, footerY).lineTo(W - M, footerY).strokeColor(BORDER).lineWidth(0.4).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
       .text(
         `\u00A9 ${new Date().getFullYear()} PetWash Ltd.  |  \u05e4\u05d8 \u05d5\u05d5\u05d0\u05e9 \u05d1\u05e2\u05de \u05d7.\u05e4. 517145033  |  Internal Escrow Statement — Not a Tax Document`,
         M, footerY + 6, { width: INNER, align: 'center' }
       );

    doc.end();
  });
}
