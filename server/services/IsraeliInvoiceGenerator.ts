import PDFDocument from "pdfkit";
import { db } from "../db";
import {
  providerCommissions,
  contractorProfiles,
  providerTaxCompliance,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Israeli Tax Invoice Generator
 * Generates VAT-compliant invoices in Hebrew and English
 * Complies with Israeli Tax Authority regulations
 */
export class IsraeliInvoiceGenerator {
  /**
   * Generate Hebrew/English invoice PDF for a commission
   */
  static async generateInvoice(
    commissionId: string,
    language: "he" | "en" = "he"
  ): Promise<Buffer> {
    try {
      // Fetch commission data
      const [commission] = await db
        .select()
        .from(providerCommissions)
        .where(eq(providerCommissions.commissionId, commissionId))
        .limit(1);

      if (!commission) {
        throw new Error(`Commission ${commissionId} not found`);
      }

      // Fetch contractor profile
      const [contractor] = await db
        .select()
        .from(contractorProfiles)
        .where(eq(contractorProfiles.id, commission.providerId))
        .limit(1);

      // Fetch tax profile
      const [taxProfile] = await db
        .select()
        .from(providerTaxCompliance)
        .where(eq(providerTaxCompliance.providerId, commission.providerId))
        .limit(1);

      // Create PDF document
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: language === "he" ? "חשבונית מס" : "Tax Invoice",
          Author: "Pet Wash Ltd",
          Subject: `Invoice ${commission.invoiceNumber || commissionId}`,
        },
      });

      // Collect PDF data into buffer
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));

      return new Promise((resolve, reject) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });

        doc.on("error", (error) => {
          reject(error);
        });

        // Generate invoice content
        if (language === "he") {
          this.generateHebrewInvoice(doc, commission, contractor, taxProfile);
        } else {
          this.generateEnglishInvoice(doc, commission, contractor, taxProfile);
        }

        doc.end();
      });
    } catch (error) {
      logger.error("[Israeli Invoice] Generation failed", {
        commissionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate Hebrew invoice (RTL)
   */
  private static generateHebrewInvoice(
    doc: PDFKit.PDFDocument,
    commission: any,
    contractor: any,
    taxProfile: any
  ) {
    // Header - Company Info
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("חשבונית מס - Pet Wash Ltd", { align: "right" });

    doc
      .fontSize(10)
      .font("Helvetica")
      .moveDown(0.5)
      .text("ח.פ: 516788400", { align: "right" })
      .text("ישראל", { align: "right" })
      .text("טלפון: 03-1234567", { align: "right" })
      .text("דוא\"ל: invoices@petwash.co.il", { align: "right" });

    doc.moveDown(2);

    // Invoice Details
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`מספר חשבונית: ${commission.invoiceNumber || commission.commissionId}`, {
        align: "right",
      })
      .font("Helvetica")
      .text(`תאריך: ${new Date().toLocaleDateString("he-IL")}`, {
        align: "right",
      });

    doc.moveDown(1);

    // Contractor Details
    doc.font("Helvetica-Bold").text("לכבוד:", { align: "right" });
    doc
      .font("Helvetica")
      .text(contractor?.legalName || "ספק", { align: "right" })
      .text(`ח.פ/ע.מ: ${taxProfile?.taxId || "לא זמין"}`, { align: "right" });

    if (taxProfile?.vatNumber) {
      doc.text(`מספר עוסק מורשה: ${taxProfile.vatNumber}`, { align: "right" });
    }

    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("סה\"כ כולל מע\"מ", 400, tableTop, { width: 100, align: "right" })
      .text("מע\"מ 18%", 300, tableTop, { width: 80, align: "right" })
      .text("סכום לפני מע\"מ", 200, tableTop, { width: 80, align: "right" })
      .text("תיאור", 50, tableTop, { width: 140, align: "right" });

    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();

    // Table Row
    const rowTop = doc.y + 10;
    const customerPaid = parseFloat(commission.customerPaidAmount);
    const vatAmount = parseFloat(commission.vatAmount);
    const netAmount = customerPaid - vatAmount;

    doc
      .font("Helvetica")
      .text(`₪${customerPaid.toFixed(2)}`, 400, rowTop, {
        width: 100,
        align: "right",
      })
      .text(`₪${vatAmount.toFixed(2)}`, 300, rowTop, {
        width: 80,
        align: "right",
      })
      .text(`₪${netAmount.toFixed(2)}`, 200, rowTop, {
        width: 80,
        align: "right",
      })
      .text("עמלת תיווך - שירותי PetWash", 50, rowTop, {
        width: 140,
        align: "right",
      });

    doc.moveDown(3);

    // Totals
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .text(`סה\"כ לפני מע\"מ: ₪${netAmount.toFixed(2)}`, {
        align: "right",
      })
      .text(`מע\"מ 18%: ₪${vatAmount.toFixed(2)}`, { align: "right" })
      .fontSize(14)
      .text(`סה\"כ לתשלום: ₪${customerPaid.toFixed(2)}`, { align: "right" });

    // Footer
    doc
      .moveDown(3)
      .fontSize(8)
      .font("Helvetica")
      .text("חשבונית זו הונפקה בהתאם לתקנות מס ערך מוסף, התשל\"ו-1976", {
        align: "center",
      })
      .text("עסקה זו מבוצעת באמצעות מודל תיווך (Marketplace)", {
        align: "center",
      });
  }

  /**
   * Generate English invoice (LTR)
   */
  private static generateEnglishInvoice(
    doc: PDFKit.PDFDocument,
    commission: any,
    contractor: any,
    taxProfile: any
  ) {
    // Header - Company Info
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("TAX INVOICE - Pet Wash Ltd", { align: "left" });

    doc
      .fontSize(10)
      .font("Helvetica")
      .moveDown(0.5)
      .text("Company No: 516788400", { align: "left" })
      .text("Israel", { align: "left" })
      .text("Phone: +972-3-1234567", { align: "left" })
      .text("Email: invoices@petwash.co.il", { align: "left" });

    doc.moveDown(2);

    // Invoice Details
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`Invoice Number: ${commission.invoiceNumber || commission.commissionId}`, {
        align: "left",
      })
      .font("Helvetica")
      .text(`Date: ${new Date().toLocaleDateString("en-US")}`, {
        align: "left",
      });

    doc.moveDown(1);

    // Contractor Details
    doc.font("Helvetica-Bold").text("Bill To:", { align: "left" });
    doc
      .font("Helvetica")
      .text(contractor?.legalName || "Service Provider", { align: "left" })
      .text(`Tax ID: ${taxProfile?.taxId || "Not Available"}`, {
        align: "left",
      });

    if (taxProfile?.vatNumber) {
      doc.text(`VAT Number: ${taxProfile.vatNumber}`, { align: "left" });
    }

    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Description", 50, tableTop, { width: 200 })
      .text("Net Amount", 260, tableTop, { width: 80, align: "right" })
      .text("VAT 18%", 350, tableTop, { width: 80, align: "right" })
      .text("Total", 440, tableTop, { width: 100, align: "right" });

    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();

    // Table Row
    const rowTop = doc.y + 10;
    const customerPaid = parseFloat(commission.customerPaidAmount);
    const vatAmount = parseFloat(commission.vatAmount);
    const netAmount = customerPaid - vatAmount;

    doc
      .font("Helvetica")
      .text("Brokerage Commission - PetWash Services", 50, rowTop, {
        width: 200,
      })
      .text(`₪${netAmount.toFixed(2)}`, 260, rowTop, {
        width: 80,
        align: "right",
      })
      .text(`₪${vatAmount.toFixed(2)}`, 350, rowTop, {
        width: 80,
        align: "right",
      })
      .text(`₪${customerPaid.toFixed(2)}`, 440, rowTop, {
        width: 100,
        align: "right",
      });

    doc.moveDown(3);

    // Totals
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .text(`Subtotal: ₪${netAmount.toFixed(2)}`, { align: "right" })
      .text(`VAT 18%: ₪${vatAmount.toFixed(2)}`, { align: "right" })
      .fontSize(14)
      .text(`Total Amount: ₪${customerPaid.toFixed(2)}`, { align: "right" });

    // Footer
    doc
      .moveDown(3)
      .fontSize(8)
      .font("Helvetica")
      .text(
        "This invoice was issued in accordance with Value Added Tax Regulations, 1976",
        { align: "center" }
      )
      .text("This transaction is conducted through a marketplace brokerage model", {
        align: "center",
      });
  }

  /**
   * Generate invoice filename
   */
  static generateFilename(
    commissionId: string,
    language: "he" | "en" = "he"
  ): string {
    const date = new Date().toISOString().split("T")[0];
    return `invoice_${commissionId}_${language}_${date}.pdf`;
  }
}
