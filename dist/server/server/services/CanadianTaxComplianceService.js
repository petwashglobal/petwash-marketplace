import { db } from '../db';
import { canadianTaxFilings, } from '@shared/schema';
export class CanadianTaxComplianceService {
    async recordGSTHSTFiling(data) {
        const filingData = {
            entityId: data.entityId,
            filingType: 'GST/HST',
            province: 'FEDERAL',
            filingPeriod: data.filingPeriod,
            periodStart: new Date(data.periodStart),
            periodEnd: new Date(data.periodEnd),
            taxAmount: data.netTax.toString(),
            filingDate: new Date(data.filingDate),
            confirmationNumber: data.confirmationNumber,
            filingStatus: 'filed',
        };
        const [filing] = await db
            .insert(canadianTaxFilings)
            .values(filingData)
            .returning();
        return filing;
    }
    async recordProvincialTaxFiling(data) {
        const filingData = {
            entityId: data.entityId,
            filingType: data.filingType,
            province: data.province,
            taxYear: data.taxYear,
            taxAmount: data.taxAmount.toString(),
            filingDate: new Date(data.filingDate),
            confirmationNumber: data.confirmationNumber,
            filingStatus: 'filed',
        };
        const [filing] = await db
            .insert(canadianTaxFilings)
            .values(filingData)
            .returning();
        return filing;
    }
    async getGSTHSTRate(province) {
        const provincialRates = {
            ON: { gst: 0, pst: 0, hst: 13.0 },
            QC: { gst: 5.0, pst: 9.975, hst: 0 },
            BC: { gst: 5.0, pst: 7.0, hst: 0 },
            AB: { gst: 5.0, pst: 0, hst: 0 },
            SK: { gst: 5.0, pst: 6.0, hst: 0 },
            MB: { gst: 5.0, pst: 7.0, hst: 0 },
            NB: { gst: 0, pst: 0, hst: 15.0 },
            NS: { gst: 0, pst: 0, hst: 15.0 },
            PE: { gst: 0, pst: 0, hst: 15.0 },
            NL: { gst: 0, pst: 0, hst: 15.0 },
            YT: { gst: 5.0, pst: 0, hst: 0 },
            NT: { gst: 5.0, pst: 0, hst: 0 },
            NU: { gst: 5.0, pst: 0, hst: 0 },
        };
        const rates = provincialRates[province] || { gst: 5.0, pst: 0, hst: 0 };
        const total = rates.hst > 0 ? rates.hst : rates.gst + rates.pst;
        return {
            gst: rates.gst,
            pst: rates.pst,
            hst: rates.hst,
            total,
        };
    }
    async checkGSTRegistrationRequirement(annualRevenue) {
        const threshold = 30000;
        if (annualRevenue >= threshold) {
            return {
                required: true,
                threshold,
                message: `GST/HST registration required. Annual revenue CAD $${annualRevenue.toLocaleString()} exceeds threshold of CAD $${threshold.toLocaleString()}`,
            };
        }
        return {
            required: false,
            threshold,
            message: `GST/HST registration optional. Annual revenue CAD $${annualRevenue.toLocaleString()} below threshold of CAD $${threshold.toLocaleString()}`,
        };
    }
    async calculatePayrollDeductions(data) {
        const cppRate = 0.0595;
        const cppMaxEarnings = 66600;
        const cppBasicExemption = 3500;
        const eiRate = 0.0163;
        const eiMaxInsurable = 61500;
        const cpp = Math.min((Math.max(data.grossWages - cppBasicExemption, 0)) * cppRate, (cppMaxEarnings - cppBasicExemption) * cppRate);
        const ei = data.isEIEligible
            ? Math.min(data.grossWages * eiRate, eiMaxInsurable * eiRate)
            : 0;
        const federalTax = data.grossWages * 0.15;
        const provincialTax = data.grossWages * 0.05;
        return {
            cpp: Math.round(cpp * 100) / 100,
            ei: Math.round(ei * 100) / 100,
            federalTax: Math.round(federalTax * 100) / 100,
            provincialTax: Math.round(provincialTax * 100) / 100,
            total: Math.round((cpp + ei + federalTax + provincialTax) * 100) / 100,
        };
    }
    async validateBusinessNumber(bn) {
        const bnRegex = /^\d{9}[A-Z]{2}\d{4}$/;
        return bnRegex.test(bn);
    }
    async getUpcomingDeadlines() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const deadlines = [];
        const lastDayOfMonth = (month) => {
            return new Date(currentYear, month + 1, 0).toISOString().split('T')[0];
        };
        deadlines.push({
            type: 'GST/HST',
            dueDate: lastDayOfMonth(currentMonth),
            description: `GST/HST Return - ${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} ${currentYear}`,
        });
        deadlines.push({
            type: 'Payroll',
            dueDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`,
            description: 'Payroll Source Deductions Remittance',
        });
        if (currentMonth === 1) {
            deadlines.push({
                type: 'T4/T4A',
                dueDate: `${currentYear}-02-28`,
                description: `${currentYear - 1} T4/T4A Slips`,
            });
        }
        deadlines.push({
            type: 'T2',
            dueDate: `${currentYear}-06-30`,
            description: `${currentYear - 1} Corporate Income Tax Return (T2)`,
        });
        return deadlines;
    }
}
export const canadianTaxComplianceService = new CanadianTaxComplianceService();
