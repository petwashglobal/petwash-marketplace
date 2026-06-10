/**
 * PetWash™ Online Shop API — shop.ts
 *
 * Full end-to-end consumer shop for pet products:
 * shampoos, accessories, grooming tools, treats, K9000 wash tokens,
 * branded merchandise, e-gift cards.
 *
 * Routes:
 *   GET    /api/shop/products           — browse catalog (filter, search, paginate)
 *   GET    /api/shop/products/:id       — single product detail
 *   POST   /api/shop/cart               — create / get active cart
 *   POST   /api/shop/cart/items         — add item to cart
 *   PATCH  /api/shop/cart/items/:itemId — update quantity
 *   DELETE /api/shop/cart/items/:itemId — remove item
 *   GET    /api/shop/cart               — get current cart with totals + VAT
 *   POST   /api/shop/checkout           — create order, charge wallet/card, send email
 *   GET    /api/shop/orders             — customer order history
 *   GET    /api/shop/orders/:id         — single order detail
 *   POST   /api/shop/orders/:id/cancel  — cancel order (before dispatch)
 *   GET    /api/shop/delivery/estimate  — delivery time + cost estimate
 *   POST   /api/shop/delivery/address   — validate / save delivery address
 *
 * Admin only:
 *   POST   /api/shop/admin/products            — create product
 *   PATCH  /api/shop/admin/products/:id        — update product
 *   DELETE /api/shop/admin/products/:id        — soft-delete product
 *   GET    /api/shop/admin/orders              — all orders (paged)
 *   PATCH  /api/shop/admin/orders/:id/status   — update dispatch/delivery status
 *
 * Financial flow:
 *   1. Checkout deducts amount from user wallet (or initiates Nayax / credit-card)
 *   2. EscrowService holds funds until dispatch confirmed
 *   3. On delivery: EscrowService.release() → company ledger
 *   4. VAT (18%) auto-calculated and stored on every order line
 *   5. Israeli חשבונית מס generated on completion (IsraeliInvoiceGenerator)
 *   6. Email: shop-order-confirmation-2026 sent to buyer
 *   7. CRM log written via UnifiedMessagingHub
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../customAuth';
import { requireAdmin } from '../adminAuth';
import { logger } from '../lib/logger';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { walletService } from '../services/WalletService';
import { EscrowService } from '../services/EscrowService';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { shopOrderConfirmation } from '../email/templates/shop-order-confirmation-2026';
import { ShopService } from '../services/ShopService';
import { apiLimiter, paymentLimiter, adminLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../services/AuditLedgerService';

const router = Router();
const shopService = new ShopService();

// ─── Feature flag guard ────────────────────────────────────────────────────────
// The shop module references database tables (shop_products, shop_carts,
// shop_cart_items, shop_orders) that DO NOT yet exist in shared/schema*.ts
// or migrations/. Until the schema migration is shipped in a separate
// CEO-approved PR, every route here would 500 with "relation does not exist".
//
// This guard returns 503 when SHOP_ENABLED is not 'true', so the module can
// merge safely without crashing production. Once the schema migration is
// applied and tables exist, set SHOP_ENABLED=true in Cloud Run env to flip
// the shop live. The flag also gives ops a fast kill-switch if needed.
//
// See CTO review on PR #508 for the full list of blockers this PR addresses
// only Blocker 3 (rate limiting); Blockers 1/2/4/5 remain for a follow-up.
const SHOP_ENABLED = process.env.SHOP_ENABLED === 'true';

router.use((req: Request, res: Response, next) => {
    if (!SHOP_ENABLED) {
        return res.status(503).json({
            error: 'Shop module not yet enabled',
            code: 'SHOP_DISABLED',
            message: 'The PetWash shop is launching soon. Schema migration pending.',
        });
    }
    next();
});

// ─── Validation schemas ────────────────────────────────────────────────────────

const AddToCartSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    variantId: z.number().int().positive().optional(),
    // Engraving / personalisation — smart bilingual (HE or EN) for the engraved
    // collar / ID tag: pet name + owner name + owner mobile. petNameLang records
    // which script the customer used so the engraving machine renders RTL/LTR right.
    personalization: z.object({
        petName: z.string().trim().min(1).max(40),
        petNameLang: z.enum(['he', 'en']).optional(),
        ownerName: z.string().trim().max(60).optional(),
        // International mobile (E.164-ish): +<country><number> e.g. +972…, +61…;
        // local Israeli 05X also accepted. Spaces/hyphens allowed for readability.
        ownerMobile: z.string().trim()
            .regex(/^\+?\d[\d\s-]{6,18}$/, 'Invalid mobile number')
            .optional(),
        notes: z.string().trim().max(140).optional(),
        // Back-compat alias from the first cut of the field.
        engravingText: z.string().trim().max(40).optional(),
    }).strict().optional(),
});

const UpdateCartItemSchema = z.object({
    quantity: z.number().int().min(0).max(99), // 0 = remove
});

const CheckoutSchema = z.object({
    cartId: z.string().uuid(),
    paymentMethod: z.enum(['wallet', 'nayax', 'credit_card']),
    deliveryAddressId: z.number().int().positive().optional(),
    deliveryMethod: z.enum(['delivery', 'pickup_station', 'pickup_groomer']).default('delivery'),
    couponCode: z.string().max(32).optional(),
    notes: z.string().max(500).optional(),
    giftWrap: z.boolean().default(false),
    language: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']).default('he'),
});

const DeliveryAddressSchema = z.object({
    fullName: z.string().min(2).max(120),
    phone: z.string().min(9).max(20),
    street: z.string().min(3).max(200),
    city: z.string().min(2).max(80),
    zipCode: z.string().min(4).max(12).optional(),
    notes: z.string().max(300).optional(),
    isDefault: z.boolean().default(false),
});

const ProductQuerySchema = z.object({
    category: z.string().optional(),
    brand: z.string().optional(),
    search: z.string().max(100).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z.coerce.boolean().optional(),
    sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'name_he']).default('popular'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Public catalog ────────────────────────────────────────────────────────────

/**
 * GET /api/shop/products
 * Browse product catalog — public, no auth required
 */
router.get('/products', async (req: Request, res: Response) => {
    try {
          const query = ProductQuerySchema.parse(req.query);
          const result = await shopService.listProducts(query);
          res.json(result);
    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid query', details: err.errors });
          logger.error('[Shop] listProducts error', { err: err.message });
          res.status(500).json({ error: 'Failed to fetch products' });
    }
});

/**
 * GET /api/shop/products/:id
 * Product detail — public
 */
router.get('/products/:id', async (req: Request, res: Response) => {
    try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });
          const product = await shopService.getProduct(id);
          if (!product) return res.status(404).json({ error: 'Product not found' });
          res.json(product);
    } catch (err: any) {
    logger.error('[Shop] getProduct error', { err: err.message });
          res.status(500).json({ error: 'Failed to fetch product' });
    }
});

/**
 * GET /api/shop/delivery/estimate
 * Delivery time + cost estimate for a city/zipCode
 */
router.get('/delivery/estimate', async (req: Request, res: Response) => {
    try {
          const city = (req.query.city as string) || '';
          const zipCode = (req.query.zipCode as string) || '';
          const totalGrams = parseInt((req.query.totalGrams as string) || '0');
          const subtotalCents = parseInt((req.query.subtotalCents as string) || '0');
          const wantsFast = req.query.wantsFast === 'true';
          const estimate = shopService.estimateDelivery({ city, zipCode, totalGrams, subtotalCents, wantsFast });
          res.json(estimate);
    } catch (err: any) {
    res.status(400).json({ error: err.message });
    }
});

// ─── Cart (requires auth) ──────────────────────────────────────────────────────

/**
 * GET /api/shop/cart
 * Get or create active cart for the current user
 */
router.get('/cart', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const cart = await shopService.getOrCreateCart(uid);
          res.json(cart);
    } catch (err: any) {
    logger.error('[Shop] getCart error', { err: err.message });
          res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

/**
 * POST /api/shop/cart/items
 * Add product to cart (creates cart if not exists)
 */
router.post('/cart/items', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const body = AddToCartSchema.parse(req.body);
          const cart = await shopService.addToCart(uid, body.productId, body.quantity, body.variantId, body.personalization ?? null);
          res.status(201).json(cart);
    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
          logger.error('[Shop] addToCart error', { err: err.message });
          res.status(400).json({ error: err.message || 'Failed to add item' });
    }
});

/**
 * PATCH /api/shop/cart/items/:itemId
 * Update item quantity (0 = remove)
 */
router.patch('/cart/items/:itemId', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const itemId = parseInt(req.params.itemId);
          if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
          const { quantity } = UpdateCartItemSchema.parse(req.body);
          const cart = await shopService.updateCartItem(uid, itemId, quantity);
          res.json(cart);
    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
          res.status(400).json({ error: err.message || 'Failed to update item' });
    }
});

/**
 * DELETE /api/shop/cart/items/:itemId
 * Remove item from cart
 */
router.delete('/cart/items/:itemId', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const itemId = parseInt(req.params.itemId);
          if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
          const cart = await shopService.updateCartItem(uid, itemId, 0);
          res.json(cart);
    } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to remove item' });
    }
});

// ─── Checkout ──────────────────────────────────────────────────────────────────

/**
 * POST /api/shop/checkout
 * Place order: validate cart → apply coupon → charge payment → create order →
 * send confirmation email → write CRM log → return order summary
 */
router.post('/checkout', paymentLimiter, requireAuth, async (req: Request, res: Response) => {
    // Browse-only soft opening (CEO 2026-06-11): the catalog is public but no
    // money moves until SHOP_CHECKOUT_ENABLED=true. Hard server-side block —
    // the UI shows "purchases opening soon", this guard enforces it.
    if (process.env.SHOP_CHECKOUT_ENABLED !== 'true') {
        return res.status(503).json({
            error: 'Purchases are opening soon',
            code: 'CHECKOUT_NOT_OPEN',
        });
    }
    const uid = (req as any).user.uid;
    try {
          const body = CheckoutSchema.parse(req.body);

      // 1. Validate and lock cart
      const cart = await shopService.validateCartForCheckout(uid, body.cartId);
          if (!cart) return res.status(400).json({ error: 'Cart not found or already checked out' });
          if (cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

      // 2. Apply coupon discount if provided
      let discountAmountCents = 0;
          if (body.couponCode) {
                  const coupon = await shopService.applyCoupon(body.couponCode, cart.subtotalCents, uid);
                  discountAmountCents = coupon.discountCents;
          }

      // 3. Calculate delivery cost
      const deliveryCost = await shopService.calculateDelivery(body.deliveryMethod, body.deliveryAddressId, cart);

      // 4. Compute final amounts
      const subtotalCents = cart.subtotalCents - discountAmountCents;
          const deliveryCents = deliveryCost.cents;
          const grossCents = subtotalCents + deliveryCents + (body.giftWrap ? 990 : 0); // ₪9.90 gift wrap
      const vatCents = Math.round(grossCents * ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE));
          const netCents = grossCents - vatCents;
          const totalCents = grossCents;

      // 5. Process payment
      let paymentRef: string;
          if (body.paymentMethod === 'wallet') {
                  const result = await walletService.deductFromWallet(uid, totalCents, 'shop_purchase', {
                            cartId: body.cartId,
                            itemCount: cart.items.length,
                  });
                  paymentRef = result.transactionId;
          } else {
                  // Nayax / credit card: create pending order and return payment URL
            const pendingOrder = await shopService.createPendingOrder(uid, cart, {
                      discountAmountCents,
                      deliveryCents,
                      giftWrap: body.giftWrap,
                      deliveryMethod: body.deliveryMethod,
                      deliveryAddressId: body.deliveryAddressId,
                      notes: body.notes,
                      language: body.language,
            });
                  return res.status(202).json({
                            status: 'payment_required',
                            orderId: pendingOrder.id,
                            paymentUrl: pendingOrder.paymentUrl,
                            totalCents,
                  });
          }

      // 6. Create confirmed order
      const order = await shopService.createOrder(uid, cart, {
              paymentRef,
              paymentMethod: body.paymentMethod,
              discountAmountCents,
              deliveryCents,
              giftWrap: body.giftWrap,
              deliveryMethod: body.deliveryMethod,
              deliveryAddressId: body.deliveryAddressId,
              notes: body.notes,
              language: body.language,
              netCents,
              vatCents,
              totalCents,
      });

      // 7. Hold in escrow until dispatch
      await EscrowService.hold(uid, totalCents, 'shop_order', order.id);

      // 8. Send luxury confirmation email
      try {
              const user = await shopService.getUserProfile(uid);
              const html = shopOrderConfirmation({
                        orderId: order.orderNumber,
                        customerName: user.displayName || user.email,
                        customerEmail: user.email,
                        items: order.items,
                        subtotalCents: cart.subtotalCents,
                        discountCents: discountAmountCents,
                        deliveryCents,
                        giftWrapCents: body.giftWrap ? 990 : 0,
                        netCents,
                        vatCents,
                        totalCents,
                        paymentMethod: body.paymentMethod,
                        deliveryMethod: body.deliveryMethod,
                        estimatedDelivery: deliveryCost.estimatedDate,
                        deliveryAddress: order.deliveryAddress,
                        couponCode: body.couponCode,
                        language: body.language,
                        orderDate: new Date().toISOString(),
              });
              await sendLuxuryEmail({
                        to: user.email,
                        subject: body.language === 'he'
                          ? `אישור הזמנה #${order.orderNumber} — Pet Wash™ Shop`
                                    : `Order Confirmation #${order.orderNumber} — Pet Wash™ Shop`,
                        html,
              });
      } catch (emailErr: any) {
      logger.warn('[Shop] Confirmation email failed (non-fatal)', { orderId: order.id, err: emailErr.message });
      }

      // 9. Audit log
      await auditLog('shop.order.created', uid, { orderId: order.id, totalCents, itemCount: cart.items.length });

      res.status(201).json({
              status: 'confirmed',
              orderId: order.id,
              orderNumber: order.orderNumber,
              totalCents,
              vatCents,
              netCents,
              estimatedDelivery: deliveryCost.estimatedDate,
              paymentRef,
      });

    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
          logger.error('[Shop] checkout error', { uid, err: err.message, stack: err.stack });
          res.status(500).json({ error: 'Checkout failed. Please try again.' });
    }
});

// ─── Order history ─────────────────────────────────────────────────────────────

/**
 * GET /api/shop/orders
 * Customer order history (paginated)
 */
router.get('/orders', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const page = parseInt((req.query.page as string) || '1');
          const limit = Math.min(parseInt((req.query.limit as string) || '20'), 50);
          const orders = await shopService.getOrderHistory(uid, page, limit);
          res.json(orders);
    } catch (err: any) {
    logger.error('[Shop] getOrderHistory error', { err: err.message });
          res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * GET /api/shop/orders/:id
 * Single order detail
 */
router.get('/orders/:id', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const orderId = parseInt(req.params.id);
          if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });
          const order = await shopService.getOrder(orderId, uid);
          if (!order) return res.status(404).json({ error: 'Order not found' });
          res.json(order);
    } catch (err: any) {
    logger.error('[Shop] getOrder error', { err: err.message });
          res.status(500).json({ error: 'Failed to fetch order' });
    }
});

/**
 * POST /api/shop/orders/:id/cancel
 * Cancel order — allowed only if status is pending/confirmed (before dispatch)
 */
router.post('/orders/:id/cancel', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    const uid = (req as any).user.uid;
    try {
          const orderId = parseInt(req.params.id);
          if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });
          const result = await shopService.cancelOrder(orderId, uid);
          if (!result.success) return res.status(400).json({ error: result.reason });

      // Release escrow and refund wallet
      await EscrowService.cancel(uid, 'shop_order', orderId);
          await walletService.creditWallet(uid, result.refundCents, 'shop_refund', { orderId });
          await auditLog('shop.order.cancelled', uid, { orderId, refundCents: result.refundCents });

      res.json({ status: 'cancelled', refundCents: result.refundCents });
    } catch (err: any) {
    logger.error('[Shop] cancelOrder error', { uid, err: err.message });
          res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// ─── Delivery address ──────────────────────────────────────────────────────────

/**
 * POST /api/shop/delivery/address
 * Validate and save a delivery address for the current user
 */
router.post('/delivery/address', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const body = DeliveryAddressSchema.parse(req.body);
          const address = await shopService.saveDeliveryAddress(uid, body);
          res.status(201).json(address);
    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
          res.status(500).json({ error: 'Failed to save address' });
    }
});

/**
 * GET /api/shop/delivery/addresses
 * List saved delivery addresses for current user
 */
router.get('/delivery/addresses', apiLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
          const uid = (req as any).user.uid;
          const addresses = await shopService.getDeliveryAddresses(uid);
          res.json(addresses);
    } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

// ─── Admin routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/shop/admin/products
 * Create new product in catalog
 */
router.post('/admin/products', adminLimiter, requireAdmin, async (req: Request, res: Response) => {
    try {
          const product = await shopService.createProduct(req.body);
          res.status(201).json(product);
    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
          res.status(500).json({ error: 'Failed to create product' });
    }
});

/**
 * PATCH /api/shop/admin/products/:id
 * Update product details / stock / price
 */
router.patch('/admin/products/:id', adminLimiter, requireAdmin, async (req: Request, res: Response) => {
    try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });
          const product = await shopService.updateProduct(id, req.body);
          res.json(product);
    } catch (err: any) {
    res.status(500).json({ error: 'Failed to update product' });
    }
});

/**
 * DELETE /api/shop/admin/products/:id
 * Soft-delete product (sets isActive = false)
 */
router.delete('/admin/products/:id', adminLimiter, requireAdmin, async (req: Request, res: Response) => {
    try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });
          await shopService.deactivateProduct(id);
          res.json({ success: true });
    } catch (err: any) {
    res.status(500).json({ error: 'Failed to deactivate product' });
    }
});

/**
 * GET /api/shop/admin/orders
 * All orders — admin view (paginated, filterable by status)
 */
router.get('/admin/orders', adminLimiter, requireAdmin, async (req: Request, res: Response) => {
    try {
          const page = parseInt((req.query.page as string) || '1');
          const limit = Math.min(parseInt((req.query.limit as string) || '50'), 100);
          const status = (req.query.status as string) || undefined;
          const result = await shopService.adminListOrders({ page, limit, status });
          res.json(result);
    } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * PATCH /api/shop/admin/orders/:id/status
 * Update order status: confirmed → dispatched → delivered
 * On dispatched: triggers dispatch notification email + SMS
 * On delivered: releases escrow to company ledger
 */
router.patch('/admin/orders/:id/status', adminLimiter, requireAdmin, async (req: Request, res: Response) => {
    const adminUid = (req as any).user.uid;
    try {
          const orderId = parseInt(req.params.id);
          if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

      const newStatus = z.enum(['confirmed', 'dispatched', 'delivered', 'cancelled', 'refunded'])
            .parse(req.body.status);
          const trackingNumber = req.body.trackingNumber as string | undefined;
          const trackingUrl = req.body.trackingUrl as string | undefined;

      const order = await shopService.updateOrderStatus(orderId, newStatus, { trackingNumber, trackingUrl });

      if (newStatus === 'delivered') {
              // Release escrow to company wallet
            await EscrowService.release(order.userId, 'shop_order', orderId);
              // Generate חשבונית מס
            await shopService.generateTaxInvoice(orderId);
      }

      if (newStatus === 'dispatched' && trackingNumber) {
              // Send dispatch notification (email + SMS) — non-fatal
            await shopService.sendDispatchNotification(order).catch((e: any) =>
                      logger.warn('[Shop] dispatch notification failed', { orderId, err: e.message })
                                                                          );
      }

      await auditLog('shop.order.status_changed', adminUid, { orderId, newStatus, trackingNumber });

      res.json({ success: true, status: newStatus, order });
    } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid status value' });
          logger.error('[Shop] updateOrderStatus error', { err: err.message });
          res.status(500).json({ error: 'Failed to update order status' });
    }
});

export default router;
