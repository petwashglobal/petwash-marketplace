import { Router } from 'express';
import { convertCurrency, displayPriceInCurrency, getVirtualBankAccount, calculateInternationalFees } from '../utils/multiCurrency';
const router = Router();
/**
 * POST /api/currency/convert - Convert between currencies
 */
router.post('/convert', (req, res) => {
    const { amount, from, to } = req.body;
    const converted = convertCurrency(amount, from, to);
    res.json({ amount: converted, from, to });
});
/**
 * GET /api/currency/display - Display price in user's currency
 */
router.get('/display', (req, res) => {
    const { amount, currency, showSavings } = req.query;
    const result = displayPriceInCurrency(parseFloat(amount), currency, { showSavings: showSavings === 'true', bankFxMarkup: 3 });
    res.json(result);
});
/**
 * GET /api/currency/virtual-account - Get virtual bank account
 */
router.get('/virtual-account', async (req, res) => {
    try {
        const userId = req.firebaseUser.uid;
        const currency = req.query.currency || 'USD';
        const account = getVirtualBankAccount(userId, currency);
        res.json(account);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get virtual account' });
    }
});
/**
 * POST /api/currency/calculate-fees - Calculate international transfer fees
 */
router.post('/calculate-fees', (req, res) => {
    const { amount, from, to } = req.body;
    const fees = calculateInternationalFees(amount, from, to);
    res.json(fees);
});
export default router;
