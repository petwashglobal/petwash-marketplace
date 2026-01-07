/**
 * Fee Configuration API Routes
 * Exposes platform fee structure for frontend display
 */

import { Router } from 'express';
import { feeConfigService } from '../services/FeeConfigurationService';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/fees/rates
 * Get current platform fee rates
 */
router.get('/rates', (req, res) => {
  try {
    const rates = feeConfigService.getFeeRates();
    res.json({
      success: true,
      rates,
      description: {
        providerServiceFee: 'Deducted from provider earnings after each completed booking',
        customerBookingFee: 'Added to customer total at checkout',
        nayaxProcessingFee: 'Payment gateway processing fee (Nayax Israel)',
        vatPercent: 'Israeli VAT applied to platform fees',
        escrowHoldHours: 'Funds held in escrow until service completion confirmed',
      },
    });
  } catch (error) {
    logger.error('[Fees API] Error getting rates', { error });
    res.status(500).json({ success: false, error: 'Failed to get fee rates' });
  }
});

/**
 * POST /api/fees/calculate
 * Calculate fee breakdown for a given service amount
 */
router.post('/calculate', (req, res) => {
  try {
    const { serviceAmount } = req.body;

    if (!serviceAmount || typeof serviceAmount !== 'number' || serviceAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid serviceAmount. Must be a positive number.',
      });
    }

    const breakdown = feeConfigService.calculateFeeBreakdown(serviceAmount);

    res.json({
      success: true,
      breakdown,
      formatted: {
        customerReceipt: feeConfigService.formatCustomerReceipt(serviceAmount, 'Pet Care Service'),
        providerEarnings: feeConfigService.formatProviderEarnings(serviceAmount, 'Pet Care Service'),
      },
    });
  } catch (error) {
    logger.error('[Fees API] Error calculating fees', { error });
    res.status(500).json({ success: false, error: 'Failed to calculate fees' });
  }
});

/**
 * GET /api/fees/provider-explanation
 * Get fee explanation for provider signup pages
 */
router.get('/provider-explanation', (req, res) => {
  try {
    const explanation = feeConfigService.getProviderFeeExplanation();
    res.json({
      success: true,
      explanation,
    });
  } catch (error) {
    logger.error('[Fees API] Error getting provider explanation', { error });
    res.status(500).json({ success: false, error: 'Failed to get explanation' });
  }
});

export default router;
