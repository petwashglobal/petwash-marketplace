import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { db } from './db';
import { washHistory, users, washPackages } from '@shared/schema';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportPeriod {
  startDate: Date;
  endDate: Date;
  type: 'daily' | 'monthly' | 'yearly';
}

export interface RevenueData {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  packageBreakdown: {
    packageName: string;
    count: number;
    revenue: number;
  }[];
  discountStats: {
    totalDiscounts: number;
    discountPercentage: number;
  };
  paymentMethods: {
    creditCard: number;
    nayax: number;
  };
}

export class RevenueReportService {
  private static REPORTS_DIR = path.join(process.cwd(), 'reports');

  /**
   * Generate revenue data for a given period
   */
  static async generateRevenueData(period: ReportPeriod): Promise<RevenueData> {
    const { startDate, endDate } = period;

    // Fetch all transactions in the period
    const transactions = await db
      .select({
        id: washHistory.id,
        packageId: washHistory.packageId,
        packageName: washPackages.name,
        finalPrice: washHistory.finalPrice,
        discountApplied: washHistory.discountApplied,
        paymentMethod: washHistory.paymentMethod,
        createdAt: washHistory.createdAt
      })
      .from(washHistory)
      .leftJoin(washPackages, eq(washHistory.packageId, washPackages.id))
      .where(
        and(
          gte(washHistory.createdAt, startDate),
          lte(washHistory.createdAt, endDate)
        )
      )
      .orderBy(desc(washHistory.createdAt));

    // Calculate totals
    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.finalPrice), 0);
    const totalTransactions = transactions.length;
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Package breakdown
    const packageMap = new Map<string, { count: number; revenue: number }>();
    transactions.forEach(t => {
      const name = t.packageName || 'Unknown';
      const current = packageMap.get(name) || { count: 0, revenue: 0 };
      packageMap.set(name, {
        count: current.count + 1,
        revenue: current.revenue + Number(t.finalPrice)
      });
    });

    const packageBreakdown = Array.from(packageMap.entries()).map(([packageName, data]) => ({
      packageName,
      count: data.count,
      revenue: data.revenue
    }));

    // Discount stats
    const totalDiscounts = transactions.reduce((sum, t) => sum + Number(t.discountApplied || 0), 0);
    const discountPercentage = totalRevenue > 0 ? (totalDiscounts / (totalRevenue + totalDiscounts)) * 100 : 0;

    // Payment method breakdown
    const creditCard = transactions.filter(t => t.paymentMethod === 'credit_card').length;
    const nayax = transactions.filter(t => t.paymentMethod === 'nayax').length;

    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue,
      packageBreakdown,
      discountStats: {
        totalDiscounts,
        discountPercentage
      },
      paymentMethods: {
        creditCard,
        nayax
      }
    };
  }

  /**
   * Generate Excel (XLSX) report
   */
  static async generateExcelReport(period: ReportPeriod, data: RevenueData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.addRows([
      { metric: 'Period', value: `${period.startDate.toLocaleDateString('he-IL')} - ${period.endDate.toLocaleDateString('he-IL')}` },
      { metric: 'Total Revenue (₪)', value: data.totalRevenue.toFixed(2) },
      { metric: 'Total Transactions', value: data.totalTransactions },
      { metric: 'Average Transaction (₪)', value: data.averageTransactionValue.toFixed(2) },
      { metric: 'Total Discounts (₪)', value: data.discountStats.totalDiscounts.toFixed(2) },
      { metric: 'Discount %', value: data.discountStats.discountPercentage.toFixed(2) + '%' },
      { metric: 'Credit Card Payments', value: data.paymentMethods.creditCard },
      { metric: 'Nayax Payments', value: data.paymentMethods.nayax }
    ]);

    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007AFF' }
    };

    // Package breakdown sheet
    const packageSheet = workbook.addWorksheet('Package Breakdown');
    packageSheet.columns = [
      { header: 'Package Name', key: 'packageName', width: 30 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Revenue (₪)', key: 'revenue', width: 20 }
    ];

    data.packageBreakdown.forEach(pkg => {
      packageSheet.addRow({
        packageName: pkg.packageName,
        count: pkg.count,
        revenue: pkg.revenue.toFixed(2)
      });
    });

    packageSheet.getRow(1).font = { bold: true };
    packageSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007AFF' }
    };

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Generate PDF report
   */
  static async generatePDFReport(period: ReportPeriod, data: RevenueData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Pet Wash™ - Revenue Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${period.startDate.toLocaleDateString('he-IL')} - ${period.endDate.toLocaleDateString('he-IL')}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).text('Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Revenue: ₪${data.totalRevenue.toFixed(2)}`);
      doc.text(`Total Transactions: ${data.totalTransactions}`);
      doc.text(`Average Transaction: ₪${data.averageTransactionValue.toFixed(2)}`);
      doc.text(`Total Discounts: ₪${data.discountStats.totalDiscounts.toFixed(2)} (${data.discountStats.discountPercentage.toFixed(2)}%)`);
      doc.moveDown();
      doc.text(`Payment Methods:`);
      doc.text(`  Credit Card: ${data.paymentMethods.creditCard}`);
      doc.text(`  Nayax: ${data.paymentMethods.nayax}`);
      doc.moveDown(2);

      // Package Breakdown
      doc.fontSize(16).text('Package Breakdown', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      data.packageBreakdown.forEach(pkg => {
        doc.text(`${pkg.packageName}: ${pkg.count} washes, ₪${pkg.revenue.toFixed(2)}`);
      });

      doc.end();
    });
  }

  /**
   * Generate CSV report
   */
  static async generateCSVReport(period: ReportPeriod, data: RevenueData): Promise<string> {
    const rows = [
      ['Metric', 'Value'],
      ['Period', `${period.startDate.toISOString().split('T')[0]} - ${period.endDate.toISOString().split('T')[0]}`],
      ['Total Revenue (ILS)', data.totalRevenue.toFixed(2)],
      ['Total Transactions', data.totalTransactions.toString()],
      ['Average Transaction (ILS)', data.averageTransactionValue.toFixed(2)],
      ['Total Discounts (ILS)', data.discountStats.totalDiscounts.toFixed(2)],
      ['Discount Percentage', data.discountStats.discountPercentage.toFixed(2) + '%'],
      ['Credit Card Payments', data.paymentMethods.creditCard.toString()],
      ['Nayax Payments', data.paymentMethods.nayax.toString()],
      [''],
      ['Package Breakdown', '', ''],
      ['Package Name', 'Count', 'Revenue (ILS)'],
      ...data.packageBreakdown.map(pkg => [pkg.packageName, pkg.count.toString(), pkg.revenue.toFixed(2)])
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Save reports to disk
   */
  static async saveReports(
    period: ReportPeriod,
    excelBuffer: Buffer,
    pdfBuffer: Buffer,
    csvContent: string
  ): Promise<{ excelPath: string; pdfPath: string; csvPath: string }> {
    const year = period.startDate.getFullYear();
    const month = String(period.startDate.getMonth() + 1).padStart(2, '0');
    const date = period.startDate.toISOString().split('T')[0];
    
    const dirPath = path.join(this.REPORTS_DIR, String(year), month);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filename = `revenue_${period.type}_${date}`;
    const excelPath = path.join(dirPath, `${filename}.xlsx`);
    const pdfPath = path.join(dirPath, `${filename}.pdf`);
    const csvPath = path.join(dirPath, `${filename}.csv`);

    fs.writeFileSync(excelPath, excelBuffer);
    fs.writeFileSync(pdfPath, pdfBuffer);
    fs.writeFileSync(csvPath, csvContent);

    return { excelPath, pdfPath, csvPath };
  }

  /**
   * Get period for report type
   */
  static getReportPeriod(type: 'daily' | 'monthly' | 'yearly', referenceDate?: Date): ReportPeriod {
    const date = referenceDate || new Date();
    let startDate: Date;
    let endDate: Date;

    if (type === 'daily') {
      startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    } else if (type === 'monthly') {
      startDate = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    } else { // yearly
      startDate = new Date(date.getFullYear(), 0, 1, 0, 0, 0);
      endDate = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
    }

    return { startDate, endDate, type };
  }
}
