/**
 * Pet Wash™ Fee Configuration Service (2026 MadPaws-Inspired Model)
 * 
 * Fee Structure:
 * - Provider Service Fee: 15% (deducted from provider earnings)
 *   Applies to: Sitters, Dog Walkers, Drivers, Trainers
 * - Customer Booking Fee: 2% (charged to customer on top of service)
 * - Nayax Processing Fee: 1% (payment gateway processing - Nayax Israel)
 * - Escrow Hold: 72 hours (funds released after service completion)
 * 
 * Fee coverage includes:
 * - ₪10M+ liability insurance policy
 * - Platform usage and technology
 * - Marketing and promotion
 * - Customer support
 * - Payment processing infrastructure
 */

import { logger } from '../lib/logger';

export interface FeeBreakdown {
  baseAmount: number;
  providerServiceFee: number;
  customerBookingFee: number;
  nayaxProcessingFee: number;
  vatAmount: number;
  totalCustomerCharge: number;
  providerNetEarnings: number;
  platformRevenue: number;
}

export interface FeeRates {
  providerServiceFeePercent: number;
  customerBookingFeePercent: number;
  nayaxProcessingFeePercent: number;
  vatPercent: number;
  escrowHoldHours: number;
}

class FeeConfigurationService {
  private readonly PROVIDER_SERVICE_FEE_PERCENT = 15; // 15% for all providers (sitters, walkers, drivers, trainers)
  private readonly CUSTOMER_BOOKING_FEE_PERCENT = 2;
  private readonly NAYAX_PROCESSING_FEE_PERCENT = 1;
  private readonly ISRAELI_VAT_PERCENT = 18;
  private readonly ESCROW_HOLD_HOURS = 72;

  private readonly INSURANCE_COVERAGE_ILS = 10_000_000;

  getFeeRates(): FeeRates {
    return {
      providerServiceFeePercent: this.PROVIDER_SERVICE_FEE_PERCENT,
      customerBookingFeePercent: this.CUSTOMER_BOOKING_FEE_PERCENT,
      nayaxProcessingFeePercent: this.NAYAX_PROCESSING_FEE_PERCENT,
      vatPercent: this.ISRAELI_VAT_PERCENT,
      escrowHoldHours: this.ESCROW_HOLD_HOURS,
    };
  }

  /**
   * Calculate complete fee breakdown for a booking
   * @param serviceAmount - Base service amount set by provider
   * @returns Complete fee breakdown with all charges
   */
  calculateFeeBreakdown(serviceAmount: number): FeeBreakdown {
    const providerServiceFee = (serviceAmount * this.PROVIDER_SERVICE_FEE_PERCENT) / 100;
    const customerBookingFee = (serviceAmount * this.CUSTOMER_BOOKING_FEE_PERCENT) / 100;
    const nayaxProcessingFee = (serviceAmount * this.NAYAX_PROCESSING_FEE_PERCENT) / 100;
    const vatOnFees = ((providerServiceFee + customerBookingFee) * this.ISRAELI_VAT_PERCENT) / 100;
    const totalCustomerCharge = serviceAmount + customerBookingFee + nayaxProcessingFee;
    const providerNetEarnings = serviceAmount - providerServiceFee - nayaxProcessingFee;
    const platformRevenue = providerServiceFee + customerBookingFee;

    const breakdown: FeeBreakdown = {
      baseAmount: serviceAmount,
      providerServiceFee,
      customerBookingFee,
      nayaxProcessingFee,
      vatAmount: vatOnFees,
      totalCustomerCharge,
      providerNetEarnings,
      platformRevenue,
    };

    logger.debug('[FeeConfig] Fee breakdown calculated', breakdown);
    return breakdown;
  }

  /**
   * Calculate what customer pays (service + booking fee + processing)
   */
  calculateCustomerTotal(serviceAmount: number): number {
    const bookingFee = (serviceAmount * this.CUSTOMER_BOOKING_FEE_PERCENT) / 100;
    const processingFee = (serviceAmount * this.NAYAX_PROCESSING_FEE_PERCENT) / 100;
    return serviceAmount + bookingFee + processingFee;
  }

  /**
   * Calculate provider net earnings after all deductions
   */
  calculateProviderEarnings(serviceAmount: number): number {
    const serviceFee = (serviceAmount * this.PROVIDER_SERVICE_FEE_PERCENT) / 100;
    const processingFee = (serviceAmount * this.NAYAX_PROCESSING_FEE_PERCENT) / 100;
    return serviceAmount - serviceFee - processingFee;
  }

  /**
   * Get escrow release date (72 hours from now)
   */
  getEscrowReleaseDate(): Date {
    const releaseDate = new Date();
    releaseDate.setHours(releaseDate.getHours() + this.ESCROW_HOLD_HOURS);
    return releaseDate;
  }

  /**
   * Format fee explanation for customer receipt
   */
  formatCustomerReceipt(serviceAmount: number, serviceName: string): string {
    const breakdown = this.calculateFeeBreakdown(serviceAmount);
    return `
📋 ${serviceName} - Payment Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service Fee:          ₪${breakdown.baseAmount.toFixed(2)}
Booking Fee (2%):     ₪${breakdown.customerBookingFee.toFixed(2)}
Processing Fee:       ₪${breakdown.nayaxProcessingFee.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                ₪${breakdown.totalCustomerCharge.toFixed(2)}

🔒 Payment held in escrow for 72 hours
✅ Covered by ₪10M+ liability insurance
    `.trim();
  }

  /**
   * Format fee explanation for provider dashboard
   */
  formatProviderEarnings(serviceAmount: number, serviceName: string): string {
    const breakdown = this.calculateFeeBreakdown(serviceAmount);
    return `
💰 ${serviceName} - Earnings Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service Amount:       ₪${breakdown.baseAmount.toFixed(2)}
Platform Fee (15%):  -₪${breakdown.providerServiceFee.toFixed(2)}
Processing Fee (1%): -₪${breakdown.nayaxProcessingFee.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Earnings:        ₪${breakdown.providerNetEarnings.toFixed(2)}

⏳ Released after 72-hour escrow period
📋 Platform fee covers: Insurance, marketing, support
    `.trim();
  }

  /**
   * Get fee explanation for provider signup
   */
  getProviderFeeExplanation(): {
    serviceFee: string;
    whatItCovers: string[];
    insuranceCoverage: string;
    escrowPeriod: string;
  } {
    return {
      serviceFee: `${this.PROVIDER_SERVICE_FEE_PERCENT}% of each booking`,
      whatItCovers: [
        '₪10,000,000+ liability insurance policy',
        'Platform usage and booking management',
        'Marketing and promotion to attract clients',
        'Customer support team access',
        'Payment processing and security',
      ],
      insuranceCoverage: `₪${this.INSURANCE_COVERAGE_ILS.toLocaleString()} liability coverage`,
      escrowPeriod: `${this.ESCROW_HOLD_HOURS} hours after service completion`,
    };
  }
}

export const feeConfigService = new FeeConfigurationService();
export default feeConfigService;
