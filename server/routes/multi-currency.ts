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
  // DISABLED (#41 audit): getVirtualBankAccount returns HARDCODED, INVENTED account
  // numbers + SWIFT/BIC codes presented as real "Pet Wash Ltd" accounts. Serving them
  // could lead a customer to wire real money into non-existent accounts (lost funds,
  // legal exposure). No real virtual-account provider is wired, so this returns 503
  // until one is. Do NOT re-enable until backed by a real, provisioned account.
  return res.status(503).json({
    error: 'Virtual bank accounts are not available.',
    code: 'VIRTUAL_ACCOUNTS_DISABLED',
  });
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
