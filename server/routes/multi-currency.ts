import { Router, type Request, type Response } from 'express';
import { 
  convertCurrency,
  displayPriceInCurrency,
  getVirtualBankAccount,
  calculateInternationalFees,
  type SupportedCurrency 
} from '../utils/multiCurrency';
import type { AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

/**
 * POST /api/currency/convert - Convert between currencies
 */
router.post('/convert', (req: Request, res: Response) => {
  const { amount, from, to } = req.body;
  const converted = convertCurrency(amount, from as SupportedCurrency, to as SupportedCurrency);
  res.json({ amount: converted, from, to });
});

/**
 * GET /api/currency/display - Display price in user's currency
 */
router.get('/display', (req: Request, res: Response) => {
  const { amount, currency, showSavings } = req.query;
  const result = displayPriceInCurrency(
    parseFloat(amount as string),
    currency as SupportedCurrency,
    { showSavings: showSavings === 'true', bankFxMarkup: 3 }
  );
  res.json(result);
});

/**
 * GET /api/currency/virtual-account - Get virtual bank account
 */
router.get('/virtual-account', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const currency = (req.query.currency as SupportedCurrency) || 'USD';
    const account = getVirtualBankAccount(userId, currency);
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get virtual account' });
  }
});

/**
 * POST /api/currency/calculate-fees - Calculate international transfer fees
 */
router.post('/calculate-fees', (req: Request, res: Response) => {
  const { amount, from, to } = req.body;
  const fees = calculateInternationalFees(amount, from, to);
  res.json(fees);
});

export default router;
