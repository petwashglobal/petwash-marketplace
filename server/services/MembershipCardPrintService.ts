/**
 * MembershipCardPrintService — the PRINT FILE for the physical Platinum
 * Privilege card (CEO design 2026-09-12): CR-80 (85.6 × 54 mm), front + back,
 * as one PDF a card printer takes as-is.
 *
 *   Front: logo, "PLATINUM PRIVILEGE" (tier), chip, grouped card number,
 *          MEMBER NAME, MEMBER ID, VALID THRU.
 *   Back:  QR (https://petwash.co.il/m/<token>), REAL Code-128 barcode + its
 *          value, MEMBER ID, support email, "Membership card only — not a
 *          credit card".
 *
 * Nothing on the card is personal beyond name + member id; the QR/barcode are
 * opaque tokens (schema-membership-cards.ts). White / black / gold only.
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { code128Bars, code128Pattern } from '@shared/lib/code128';

/** CR-80 in PDF points (1 mm = 2.8346 pt). */
export const CR80_WIDTH_PT = 85.6 * 2.8346;   // ≈ 242.6
export const CR80_HEIGHT_PT = 54 * 2.8346;    // ≈ 153.1
export const BLEED_PT = 1 * 2.8346;           // 1 mm bleed each side
const GOLD = '#B8902F';
const BLACK = '#111111';

export interface PrintableCard {
  memberId: string;
  cardNumberDisplay: string;
  ownerName: string;
  tier: string;          // standard | gold | platinum | founder | vip
  validUntil: Date | null;
  qrUrl: string;
  barcodeValue: string;
}

export function tierPrintLabel(tier: string): { top: string; bottom: string } {
  const t = (tier || '').toLowerCase();
  if (t === 'platinum') return { top: 'PLATINUM', bottom: 'PRIVILEGE' };
  if (t === 'gold') return { top: 'GOLD', bottom: 'PRIVILEGE' };
  if (t === 'founder') return { top: 'FOUNDER', bottom: 'PRIVILEGE' };
  if (t === 'vip') return { top: 'BLACK RESERVE', bottom: 'PRIVILEGE' };
  return { top: 'MEMBER', bottom: 'PRIVILEGE' };
}

export function validThruLabel(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

function logoPath(): string | null {
  const candidates = [
    resolve(process.cwd(), 'client/public/brand/petwash-logo-official.png'),
    resolve(process.cwd(), 'dist/public/brand/petwash-logo-official.png'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Build the two-page CR-80 PDF. Returns the bytes. */
export async function buildMembershipCardPdf(card: PrintableCard): Promise<Buffer> {
  const W = CR80_WIDTH_PT + BLEED_PT * 2;
  const H = CR80_HEIGHT_PT + BLEED_PT * 2;
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: `PetWash membership card ${card.memberId}`, Author: 'Pet Wash Ltd' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));

  const logo = logoPath();
  const tier = tierPrintLabel(card.tier);

  // ── FRONT ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, W, H).fill('#FFFFFF');
  doc.rect(BLEED_PT + 0.5, BLEED_PT + 0.5, CR80_WIDTH_PT - 1, CR80_HEIGHT_PT - 1).lineWidth(0.6).stroke(GOLD);
  if (logo) { try { doc.image(logo, BLEED_PT + 12, BLEED_PT + 10, { height: 22 }); } catch { /* logo optional */ } }
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9).text(tier.top, BLEED_PT + CR80_WIDTH_PT - 100, BLEED_PT + 12, { width: 88, align: 'right', characterSpacing: 1.5 });
  doc.fillColor(GOLD).font('Helvetica').fontSize(5.5).text(tier.bottom, BLEED_PT + CR80_WIDTH_PT - 100, BLEED_PT + 23, { width: 88, align: 'right', characterSpacing: 2 });
  // chip
  doc.roundedRect(BLEED_PT + 14, BLEED_PT + 44, 26, 19, 3).lineWidth(0.6).fillAndStroke('#E8D9A8', GOLD);
  doc.moveTo(BLEED_PT + 14, BLEED_PT + 53.5).lineTo(BLEED_PT + 40, BLEED_PT + 53.5).stroke(GOLD);
  doc.moveTo(BLEED_PT + 27, BLEED_PT + 44).lineTo(BLEED_PT + 27, BLEED_PT + 63).stroke(GOLD);
  // card number
  doc.fillColor(BLACK).font('Courier-Bold').fontSize(12).text(card.cardNumberDisplay, BLEED_PT + 14, BLEED_PT + 74, { characterSpacing: 1.2 });
  // member name / id / valid thru
  doc.fillColor(GOLD).font('Helvetica').fontSize(4.5).text('MEMBER', BLEED_PT + 14, BLEED_PT + 104, { characterSpacing: 1.5 });
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9).text(card.ownerName.toUpperCase(), BLEED_PT + 14, BLEED_PT + 111, { width: 140 });
  doc.fillColor(GOLD).font('Helvetica').fontSize(4.5).text('MEMBER ID', BLEED_PT + 14, BLEED_PT + 125, { characterSpacing: 1.5 });
  doc.fillColor(BLACK).font('Helvetica').fontSize(7).text(card.memberId, BLEED_PT + 14, BLEED_PT + 132);
  doc.fillColor(GOLD).font('Helvetica').fontSize(4.5).text('VALID THRU', BLEED_PT + CR80_WIDTH_PT - 70, BLEED_PT + 104, { width: 58, align: 'right', characterSpacing: 1.5 });
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9).text(validThruLabel(card.validUntil), BLEED_PT + CR80_WIDTH_PT - 70, BLEED_PT + 111, { width: 58, align: 'right' });

  // ── BACK ─────────────────────────────────────────────────────────────────
  doc.addPage({ size: [W, H], margin: 0 });
  doc.rect(0, 0, W, H).fill('#FFFFFF');
  doc.rect(BLEED_PT + 0.5, BLEED_PT + 0.5, CR80_WIDTH_PT - 1, CR80_HEIGHT_PT - 1).lineWidth(0.6).stroke(GOLD);
  if (logo) { try { doc.image(logo, BLEED_PT + 12, BLEED_PT + 8, { height: 14 }); } catch { /* optional */ } }
  const qrPng = await QRCode.toBuffer(card.qrUrl, { errorCorrectionLevel: 'M', margin: 0, width: 300 });
  doc.image(qrPng, BLEED_PT + 12, BLEED_PT + 28, { width: 62, height: 62 });
  // Code-128
  const bars = code128Bars(card.barcodeValue);
  const modules = code128Pattern(card.barcodeValue).length;
  const bcX = BLEED_PT + 12, bcY = BLEED_PT + 96, bcW = 118, bcH = 22;
  const moduleW = bcW / modules;
  doc.fillColor(BLACK);
  bars.forEach((b) => doc.rect(bcX + b.x * moduleW, bcY, b.width * moduleW, bcH).fill(BLACK));
  doc.fillColor(BLACK).font('Courier').fontSize(5.5).text(card.barcodeValue, bcX, bcY + bcH + 2, { width: bcW, align: 'center', characterSpacing: 0.8 });
  // right column
  const rx = BLEED_PT + 96;
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(6).text('SCAN TO IDENTIFY', rx, BLEED_PT + 30, { characterSpacing: 1.2 });
  doc.fillColor(BLACK).font('Helvetica').fontSize(5).text('Works with the PetWash app, mobile wallet and the station reader.', rx, BLEED_PT + 39, { width: CR80_WIDTH_PT - 110 });
  doc.fillColor(GOLD).font('Helvetica').fontSize(4.5).text('MEMBER ID', rx, BLEED_PT + 58, { characterSpacing: 1.5 });
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(8).text(card.memberId, rx, BLEED_PT + 65);
  doc.fillColor(BLACK).font('Helvetica').fontSize(5.5).text('support@petwash.co.il', rx, BLEED_PT + 80);
  doc.fillColor(GOLD).font('Helvetica').fontSize(4.2).text('MEMBERSHIP CARD ONLY — NOT A CREDIT CARD', BLEED_PT + 12, BLEED_PT + CR80_HEIGHT_PT - 12, { width: CR80_WIDTH_PT - 24, align: 'center', characterSpacing: 1 });

  doc.end();
  return done;
}

/** One CSV row per card for a print bureau. Pure. */
export function printBatchCsvRow(card: PrintableCard): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [card.memberId, card.cardNumberDisplay, card.ownerName, tierPrintLabel(card.tier).top, validThruLabel(card.validUntil), card.barcodeValue, card.qrUrl].map(esc).join(',');
}
export const PRINT_BATCH_CSV_HEADER = 'member_id,card_number,member_name,tier,valid_thru,barcode_value,qr_url';
