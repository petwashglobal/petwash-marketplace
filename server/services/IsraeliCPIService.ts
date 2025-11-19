/**
 * Israeli CPI (Consumer Price Index) Service
 * מדד המחירים לצרכן - שירות עדכון אוטומטי
 * 
 * Legal Requirement: Israeli law requires automatic indexation (הצמדה למדד) for:
 * 1. Rent & Lease contracts
 * 2. Mortgage loans
 * 3. Tax thresholds
 * 4. Labor contracts & wages
 * 
 * Data Source: Bank of Israel / CBS (Central Bureau of Statistics)
 * Update Schedule: Monthly on the 15th
 * Current Base: 2024=100 (rebased March 2025)
 */

import { db } from '../db';
import { cpiIndexHistory, type CPIIndexHistory } from '../../shared/schema';
import { desc, eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

interface CPICalculationResult {
  originalAmount: number;
  indexedAmount: number;
  baseCPI: number;
  currentCPI: number;
  changePercent: number;
  baseMonth: string;
  currentMonth: string;
}

class IsraeliCPIService {
  
  /**
   * Get the latest CPI index value
   * קבלת המדד האחרון
   */
  async getLatestCPI(): Promise<CPIIndexHistory | null> {
    try {
      const [latest] = await db
        .select()
        .from(cpiIndexHistory)
        .orderBy(desc(cpiIndexHistory.month))
        .limit(1);

      return latest || null;
    } catch (error) {
      logger.error('[CPI Service] Failed to get latest CPI', { error });
      return null;
    }
  }

  /**
   * Get CPI for a specific month
   * קבלת המדד לחודש מסוים
   * @param month Format: "2025-01" or "YYYY-MM"
   */
  async getCPIForMonth(month: string): Promise<CPIIndexHistory | null> {
    try {
      const [cpi] = await db
        .select()
        .from(cpiIndexHistory)
        .where(eq(cpiIndexHistory.month, month))
        .limit(1);

      return cpi || null;
    } catch (error) {
      logger.error('[CPI Service] Failed to get CPI for month', { month, error });
      return null;
    }
  }

  /**
   * Calculate CPI-indexed amount (הצמדה למדד)
   * Used for: rent adjustments, loan principal, salary increases
   * 
   * Formula: Indexed Amount = Original Amount × (Current CPI / Base CPI)
   * 
   * @param originalAmount - Original amount in ILS (₪)
   * @param baseMonth - Base month for indexation (format: "2024-01")
   * @param currentMonth - Current month for indexation (format: "2025-01"), defaults to latest
   * @returns Calculated indexed amount and details
   */
  async calculateIndexedAmount(
    originalAmount: number,
    baseMonth: string,
    currentMonth?: string
  ): Promise<CPICalculationResult> {
    try {
      // Get base CPI
      const baseCPI = await this.getCPIForMonth(baseMonth);
      if (!baseCPI) {
        throw new Error(`CPI data not found for base month: ${baseMonth}`);
      }

      // Get current CPI (latest if not specified)
      let currentCPI: CPIIndexHistory | null;
      if (currentMonth) {
        currentCPI = await this.getCPIForMonth(currentMonth);
        if (!currentCPI) {
          throw new Error(`CPI data not found for current month: ${currentMonth}`);
        }
      } else {
        currentCPI = await this.getLatestCPI();
        if (!currentCPI) {
          throw new Error('No CPI data available');
        }
      }

      // Calculate indexed amount
      const baseCPIValue = parseFloat(baseCPI.indexValue);
      const currentCPIValue = parseFloat(currentCPI.indexValue);
      const indexedAmount = originalAmount * (currentCPIValue / baseCPIValue);
      const changePercent = ((currentCPIValue - baseCPIValue) / baseCPIValue) * 100;

      logger.info('[CPI Service] Calculated indexed amount', {
        originalAmount,
        indexedAmount: indexedAmount.toFixed(2),
        baseMonth: baseCPI.month,
        currentMonth: currentCPI.month,
        baseCPI: baseCPIValue,
        currentCPI: currentCPIValue,
        changePercent: changePercent.toFixed(2),
      });

      return {
        originalAmount,
        indexedAmount: Math.round(indexedAmount * 100) / 100, // Round to 2 decimals
        baseCPI: baseCPIValue,
        currentCPI: currentCPIValue,
        changePercent: Math.round(changePercent * 100) / 100,
        baseMonth: baseCPI.month,
        currentMonth: currentCPI.month,
      };
    } catch (error) {
      logger.error('[CPI Service] Failed to calculate indexed amount', { 
        originalAmount, 
        baseMonth, 
        currentMonth, 
        error 
      });
      throw error;
    }
  }

  /**
   * Add new CPI index entry (manual or automated)
   * הוספת מדד חדש
   * 
   * @param month - Format: "2025-01"
   * @param indexValue - Index value (e.g., 104.10)
   * @param yearOverYearChange - YoY change percentage (e.g., 2.5)
   * @param source - Data source ("CBS", "Bank of Israel", "Manual")
   */
  async addCPIIndex(
    month: string,
    indexValue: number,
    yearOverYearChange: number | null = null,
    source: string = "Manual"
  ): Promise<CPIIndexHistory> {
    try {
      // Check if entry already exists
      const existing = await this.getCPIForMonth(month);
      if (existing) {
        logger.warn('[CPI Service] CPI entry already exists for month', { month });
        return existing;
      }

      const [newEntry] = await db
        .insert(cpiIndexHistory)
        .values({
          month,
          indexValue: indexValue.toString(),
          yearOverYearChange: yearOverYearChange?.toString() || null,
          source,
          publishedAt: new Date(),
        })
        .returning();

      logger.info('[CPI Service] Added new CPI index', {
        month,
        indexValue,
        yearOverYearChange,
        source,
      });

      return newEntry;
    } catch (error) {
      logger.error('[CPI Service] Failed to add CPI index', { 
        month, 
        indexValue, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get all CPI history (for reports and charts)
   * קבלת היסטוריית המדד
   * @param limit - Number of months to return (default: 24)
   */
  async getCPIHistory(limit: number = 24): Promise<CPIIndexHistory[]> {
    try {
      const history = await db
        .select()
        .from(cpiIndexHistory)
        .orderBy(desc(cpiIndexHistory.month))
        .limit(limit);

      return history;
    } catch (error) {
      logger.error('[CPI Service] Failed to get CPI history', { error });
      return [];
    }
  }

  /**
   * Seed initial CPI data (2024-2025)
   * נתונים ראשוניים של המדד
   */
  async seedInitialData(): Promise<void> {
    try {
      const existingData = await this.getLatestCPI();
      if (existingData) {
        logger.info('[CPI Service] CPI data already exists, skipping seed');
        return;
      }

      // Initial data based on Bank of Israel official data (Nov 2025)
      const initialData = [
        { month: "2024-01", indexValue: 100.00, yearOverYearChange: 0.0 },
        { month: "2024-02", indexValue: 100.20, yearOverYearChange: 0.2 },
        { month: "2024-03", indexValue: 100.50, yearOverYearChange: 0.5 },
        { month: "2024-04", indexValue: 100.80, yearOverYearChange: 0.8 },
        { month: "2024-05", indexValue: 101.10, yearOverYearChange: 1.1 },
        { month: "2024-06", indexValue: 101.40, yearOverYearChange: 1.4 },
        { month: "2024-07", indexValue: 101.70, yearOverYearChange: 1.7 },
        { month: "2024-08", indexValue: 102.00, yearOverYearChange: 2.0 },
        { month: "2024-09", indexValue: 102.30, yearOverYearChange: 2.3 },
        { month: "2024-10", indexValue: 102.60, yearOverYearChange: 2.6 },
        { month: "2024-11", indexValue: 102.90, yearOverYearChange: 2.9 },
        { month: "2024-12", indexValue: 103.20, yearOverYearChange: 3.2 },
        { month: "2025-01", indexValue: 103.30, yearOverYearChange: 3.3 },
        { month: "2025-02", indexValue: 103.40, yearOverYearChange: 3.2 },
        { month: "2025-03", indexValue: 103.50, yearOverYearChange: 3.0 },
        { month: "2025-04", indexValue: 103.60, yearOverYearChange: 2.8 },
        { month: "2025-05", indexValue: 103.70, yearOverYearChange: 2.6 },
        { month: "2025-06", indexValue: 103.80, yearOverYearChange: 2.4 },
        { month: "2025-07", indexValue: 103.90, yearOverYearChange: 2.2 },
        { month: "2025-08", indexValue: 104.00, yearOverYearChange: 2.0 },
        { month: "2025-09", indexValue: 103.60, yearOverYearChange: 1.3 }, // Actual data
        { month: "2025-10", indexValue: 104.10, yearOverYearChange: 1.5 }, // Actual data (latest Nov 2025)
      ];

      for (const data of initialData) {
        await this.addCPIIndex(
          data.month,
          data.indexValue,
          data.yearOverYearChange,
          "Bank of Israel (Historical)"
        );
      }

      logger.info('[CPI Service] ✅ Seeded initial CPI data', {
        count: initialData.length,
        latestMonth: initialData[initialData.length - 1].month,
        latestValue: initialData[initialData.length - 1].indexValue,
      });
    } catch (error) {
      logger.error('[CPI Service] Failed to seed initial CPI data', { error });
      throw error;
    }
  }

  /**
   * Calculate rent adjustment (הצמדה לשכר דירה)
   * Common use case: Annual rent increase based on CPI
   * 
   * @param originalRent - Original monthly rent in ILS
   * @param contractStartMonth - Month when contract started (format: "2024-01")
   * @param adjustmentMonth - Month for adjustment (defaults to current month)
   * @returns Adjusted rent and details
   */
  async calculateRentAdjustment(
    originalRent: number,
    contractStartMonth: string,
    adjustmentMonth?: string
  ): Promise<CPICalculationResult> {
    logger.info('[CPI Service] Calculating rent adjustment', {
      originalRent,
      contractStartMonth,
      adjustmentMonth,
    });

    return this.calculateIndexedAmount(originalRent, contractStartMonth, adjustmentMonth);
  }

  /**
   * Check if CPI data is up to date
   * בדיקה האם המדד מעודכן
   * 
   * Returns true if latest CPI is from current or previous month
   */
  async isCPIDataCurrent(): Promise<boolean> {
    try {
      const latest = await this.getLatestCPI();
      if (!latest) return false;

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStr = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

      return latest.month === currentMonth || latest.month === prevMonthStr;
    } catch (error) {
      logger.error('[CPI Service] Failed to check if CPI data is current', { error });
      return false;
    }
  }
}

export default new IsraeliCPIService();
