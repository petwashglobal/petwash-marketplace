/**
 * ShopService.ts — PetWash™ Online Shop Business Logic
 *
 * Handles: products, catalog, cart, orders, delivery, coupons,
 * dispatch notifications, tax invoice generation.
 *
 * All prices in AGOROT (integer cents). Never store floats.
 * VAT: ISRAEL_VAT_RATE from @shared/israel-compliance-config
 */

import { db } from '../db';
import { logger } from '../lib/logger';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { formatUserAddress } from '@shared/formatAddress';
import { IsraeliInvoiceGenerator } from './IsraeliInvoiceGenerator';
import { getDeliveryOptions, getDeliveryLegalNote } from './shop/DeliveryRouter';
import { customerCancellationRefundCents } from './IsraeliCancellationPolicy';
import { addDeliveryDays } from './shop/israeliDeliveryCalendar';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { twilioSMSService } from './TwilioSMSService';
import { v4 as uuidv4 } from 'uuid';
import { sql, eq, and, like, gte, lte, desc, asc, inArray } from 'drizzle-orm';
import type {
    ShopProduct,
    ShopCart,
    ShopCartItem,
    ShopOrder,
    ShopOrderItem,
    ShopDeliveryAddress,
} from '@shared/shop-schema';

// ─── Delivery configuration ────────────────────────────────────────────────────

const DELIVERY_RATES = {
    // Free delivery over this threshold (agorot)
    FREE_THRESHOLD_CENTS: 15000, // ₪150
    // Standard delivery cost (agorot)
    STANDARD_CENTS: 2990,        // ₪29.90
    // Express delivery (same-day Tel Aviv/Gush Dan)
    EXPRESS_CENTS: 5900,         // ₪59
    // Estimated days for standard
    STANDARD_DAYS: 3,
    EXPRESS_DAYS: 1,
};

const GIFT_WRAP_CENTS = 990; // ₪9.90

// ─── Hidden packaging / handling cost ───────────────────────────────────────
// The branded mailer + treat pouch + seal sticker cost money to source. Per CEO
// direction this is recovered INSIDE the price (one per-order amount folded into
// the goods subtotal), NEVER shown to the customer as a separate "packaging"
// line. It is part of the VAT-inclusive goods price they see and pay. Override
// per real supplier cost via SHOP_PACKAGING_HANDLING_CENTS.
const PACKAGING_HANDLING_CENTS = (() => {
  const v = Number(process.env.SHOP_PACKAGING_HANDLING_CENTS);
  return Number.isFinite(v) && v >= 0 ? v : 600; // ₪6 default per shipment
})();

// Cities with same-day express delivery available
const EXPRESS_CITIES = new Set([
    'תל אביב', 'tel aviv', 'רמת גן', 'גבעתיים', 'בני ברק',
    'פתח תקווה', 'רחובות', 'ראשון לציון', 'חולון', 'בת ים',
    'הרצליה', 'רעננה', 'כפר סבא', 'נתניה',
  ]);

export class ShopService {
    private invoiceGenerator = new IsraeliInvoiceGenerator();
    private smsService = twilioSMSService;

  // ─── Products ──────────────────────────────────────────────────────────────

  async listProducts(query: {
        category?: string;
        brand?: string;
        search?: string;
        minPrice?: number;
        maxPrice?: number;
        inStock?: boolean;
        sortBy: string;
        page: number;
        limit: number;
  }) {
        try {
                const offset = (query.page - 1) * query.limit;

          let conditions: any[] = [
                    sql`is_active = true`,
                  ];

          if (query.category) {
                    conditions.push(sql`category = ${query.category}`);
          }
                if (query.brand) {
                          conditions.push(sql`brand = ${query.brand}`);
                }
                if (query.search) {
                          const term = `%${query.search}%`;
                          conditions.push(sql`(name_he ILIKE ${term} OR name_en ILIKE ${term} OR description_he ILIKE ${term})`);
                }
                if (query.minPrice !== undefined) {
                          conditions.push(sql`price_cents >= ${query.minPrice}`);
                }
                if (query.maxPrice !== undefined) {
                          conditions.push(sql`price_cents <= ${query.maxPrice}`);
                }
                if (query.inStock === true) {
                          conditions.push(sql`stock_quantity > 0`);
                }

          const whereClause = conditions.length > 0
                  ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
                    : sql``;

          const orderClause = {
                    price_asc:  sql`ORDER BY price_cents ASC`,
                    price_desc: sql`ORDER BY price_cents DESC`,
                    newest:     sql`ORDER BY created_at DESC`,
                    popular:    sql`ORDER BY sales_count DESC, created_at DESC`,
                    name_he:    sql`ORDER BY name_he ASC`,
          }[query.sortBy] ?? sql`ORDER BY sales_count DESC`;

          const [products, countResult] = await Promise.all([
                    db.execute(sql`
                              SELECT id, sku, name_he, name_en, description_he, description_en,
                                               category, brand, price_cents, compare_at_cents, weight_grams,
                                                                stock_quantity, images, tags, is_featured, sales_count,
                                                                                 created_at
                                                                                           FROM shop_products
                                                                                                     ${whereClause}
                                                                                                               ${orderClause}
                                                                                                                         LIMIT ${query.limit} OFFSET ${offset}
                                                                                                                                 `),
                    db.execute(sql`SELECT COUNT(*) AS total FROM shop_products ${whereClause}`),
                  ]);

          const total = Number(countResult.rows[0]?.total ?? 0);

          return {
                    products: products.rows,
                    pagination: {
                                page: query.page,
                                limit: query.limit,
                                total,
                                pages: Math.ceil(total / query.limit),
                    },
          };
        } catch (err: any) {
                logger.error('[ShopService] listProducts error', { err: err.message });
                throw err;
        }
  }

  async getProduct(id: number): Promise<ShopProduct | null> {
        const result = await db.execute(sql`
              SELECT p.*,
                           json_agg(v.*) FILTER (WHERE v.id IS NOT NULL) AS variants
                                 FROM shop_products p
                                       LEFT JOIN shop_product_variants v ON v.product_id = p.id AND v.is_active = true
                                             WHERE p.id = ${id} AND p.is_active = true
                                                   GROUP BY p.id
                                                       `);
        return (result.rows[0] as ShopProduct) ?? null;
  }

  async createProduct(data: any): Promise<ShopProduct> {
        const sku = data.sku || `PW-${Date.now()}`;
        const result = await db.execute(sql`
              INSERT INTO shop_products (
                      sku, name_he, name_en, description_he, description_en,
                              category, brand, price_cents, compare_at_cents, weight_grams,
                                      stock_quantity, images, tags, is_featured, is_active, created_at
                                            ) VALUES (
                                                    ${sku}, ${data.nameHe}, ${data.nameEn},
                                                            ${data.descriptionHe ?? ''}, ${data.descriptionEn ?? ''},
                                                                    ${data.category}, ${data.brand ?? null},
                                                                            ${data.priceCents}, ${data.compareAtCents ?? null},
                                                                                    ${data.weightGrams ?? 0}, ${data.stockQuantity ?? 0},
                                                                                            ${JSON.stringify(data.images ?? [])},
                                                                                                    ${JSON.stringify(data.tags ?? [])},
                                                                                                            ${data.isFeatured ?? false}, true, NOW()
                                                                                                                  )
                                                                                                                        RETURNING *
                                                                                                                            `);
        return result.rows[0] as ShopProduct;
  }

  async updateProduct(id: number, data: any): Promise<ShopProduct> {
        const sets: string[] = [];
        const values: any[] = [];

      const allowed = [
              'name_he', 'name_en', 'description_he', 'description_en',
              'price_cents', 'compare_at_cents', 'stock_quantity',
              'images', 'tags', 'is_featured', 'category', 'brand', 'weight_grams',
            ];

      for (const key of allowed) {
              const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
              if (data[camel] !== undefined) {
                        sets.push(`${key} = $${values.length + 2}`);
                        values.push(data[camel]);
              }
      }

      if (sets.length === 0) throw new Error('No updatable fields provided');

      const result = await db.execute(
              sql.raw(`UPDATE shop_products SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values])
            );
        return result.rows[0] as ShopProduct;
  }

  async deactivateProduct(id: number): Promise<void> {
        await db.execute(sql`UPDATE shop_products SET is_active = false, updated_at = NOW() WHERE id = ${id}`);
  }

  // ─── Cart ──────────────────────────────────────────────────────────────────

  async getOrCreateCart(uid: string): Promise<ShopCart & { items: ShopCartItem[]; subtotalCents: number; vatCents: number; totalCents: number }> {
        let cart = await this._getActiveCart(uid);
        if (!cart) {
                const result = await db.execute(sql`
                        INSERT INTO shop_carts (id, user_id, status, created_at, updated_at)
                                VALUES (${uuidv4()}, ${uid}, 'active', NOW(), NOW())
                                        RETURNING *
                                              `);
                cart = result.rows[0] as ShopCart;
        }
        return this._enrichCart(cart);
  }

  private async _getActiveCart(uid: string): Promise<ShopCart | null> {
        const result = await db.execute(sql`
              SELECT * FROM shop_carts WHERE user_id = ${uid} AND status = 'active'
                    ORDER BY created_at DESC LIMIT 1
                        `);
        return (result.rows[0] as ShopCart) ?? null;
  }

  private async _enrichCart(cart: ShopCart) {
        const items = await db.execute(sql`
              SELECT ci.*, p.name_he, p.name_en, p.price_cents, p.images, p.stock_quantity,
                           p.weight_grams, v.name_he AS variant_name_he, v.name_en AS variant_name_en,
                                        v.price_delta_cents
                                              FROM shop_cart_items ci
                                                    JOIN shop_products p ON p.id = ci.product_id
                                                          LEFT JOIN shop_product_variants v ON v.id = ci.variant_id
                                                                WHERE ci.cart_id = ${cart.id}
                                                                      ORDER BY ci.created_at ASC
                                                                          `);

      const enrichedItems = items.rows.map((item: any) => ({
              ...item,
              effectivePriceCents: item.price_cents + (item.price_delta_cents ?? 0),
              lineTotalCents: (item.price_cents + (item.price_delta_cents ?? 0)) * item.quantity,
      }));

      const goodsCents = enrichedItems.reduce((sum, i) => sum + i.lineTotalCents, 0);
        // Fold the hidden per-order packaging cost into the goods price (only when
        // the cart has items). Customer sees ONE goods price that already includes
        // it — no separate packaging line. VAT is computed on the inclusive amount.
        const subtotalCents = goodsCents > 0 ? goodsCents + PACKAGING_HANDLING_CENTS : 0;
        const vatCents = Math.round(subtotalCents * ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE));
        const netCents = subtotalCents - vatCents;

      return {
              ...(cart as any),
              items: enrichedItems,
              subtotalCents,
              netCents,
              vatCents,
              totalCents: subtotalCents,
      };
  }

  async addToCart(uid: string, productId: number, quantity: number, variantId?: number, personalization?: Record<string, unknown> | null) {
        const product = await this.getProduct(productId);
        if (!product) throw new Error('Product not found');
        if (product.stockQuantity !== null && product.stockQuantity < quantity) {
                throw new Error(`Only ${product.stockQuantity} units in stock`);
        }

      const cart = await this.getOrCreateCart(uid);
      const personalizationJson = personalization ? JSON.stringify(personalization) : null;

      // Personalised (engraved) lines are unique per custom text — never merge quantities.
      const existing = personalizationJson ? { rows: [] as any[] } : await db.execute(sql`
            SELECT * FROM shop_cart_items
                  WHERE cart_id = ${cart.id} AND product_id = ${productId}
                          AND (variant_id = ${variantId ?? null} OR (variant_id IS NULL AND ${variantId ?? null} IS NULL))
                              `);

      if (existing.rows.length > 0) {
              const newQty = (existing.rows[0] as any).quantity + quantity;
              await db.execute(sql`
                      UPDATE shop_cart_items SET quantity = ${newQty}, updated_at = NOW()
                              WHERE id = ${(existing.rows[0] as any).id}
                                    `);
      } else {
              await db.execute(sql`
                      INSERT INTO shop_cart_items (cart_id, product_id, variant_id, quantity, personalization, created_at, updated_at)
                              VALUES (${cart.id}, ${productId}, ${variantId ?? null}, ${quantity}, ${personalizationJson}, NOW(), NOW())
                                    `);
      }

      await db.execute(sql`UPDATE shop_carts SET updated_at = NOW() WHERE id = ${cart.id}`);
        return this._enrichCart(cart as ShopCart);
  }

  async updateCartItem(uid: string, itemId: number, quantity: number) {
        // Verify ownership
      const result = await db.execute(sql`
            SELECT ci.*, c.user_id FROM shop_cart_items ci
                  JOIN shop_carts c ON c.id = ci.cart_id
                        WHERE ci.id = ${itemId}
                            `);
        const item = result.rows[0] as any;
        if (!item) throw new Error('Cart item not found');
        if (item.user_id !== uid) throw new Error('Not your cart item');

      if (quantity === 0) {
              await db.execute(sql`DELETE FROM shop_cart_items WHERE id = ${itemId}`);
      } else {
              await db.execute(sql`UPDATE shop_cart_items SET quantity = ${quantity}, updated_at = NOW() WHERE id = ${itemId}`);
      }

      const cart = await this._getActiveCart(uid);
        if (!cart) throw new Error('Cart not found');
        return this._enrichCart(cart);
  }

  async validateCartForCheckout(uid: string, cartId: string) {
        const result = await db.execute(sql`
              SELECT * FROM shop_carts WHERE id = ${cartId} AND user_id = ${uid} AND status = 'active'
                  `);
        if (!result.rows.length) return null;
        const cart = result.rows[0] as ShopCart;
        return this._enrichCart(cart);
  }

  // ─── Coupons ───────────────────────────────────────────────────────────────
  // applyCoupon REMOVED 2026-07-04: it queried columns that do not exist in
  // the real coupons table (expires_at / min_order_cents / uses_count /
  // scope — prod has valid_until / min_spend_cents / total_redemptions /
  // scope_type), so ANY coupon code at checkout crashed with a Postgres
  // undefined-column error. It also bypassed the canonical CouponService
  // ledger. Per the K9000-only discount doctrine (docs/compliance/
  // 2026-05-27-discount-scope-k9000-only.md) shop items are FULL retail
  // price — the checkout route now rejects coupon codes explicitly.

  // ─── Delivery ─────────────────────────────────────────────────────────────

  estimateDelivery(params: { city: string; zipCode: string; totalGrams: number; subtotalCents?: number; wantsFast?: boolean; signatureRequired?: boolean }) {
        const cityNorm = (params.city || '').trim().toLowerCase();
        const hasExpress = EXPRESS_CITIES.has(cityNorm) || EXPRESS_CITIES.has(params.city.trim());

      const today = new Date();
        const addDays = (d: Date, n: number) => {
                const r = new Date(d);
                r.setDate(r.getDate() + n);
                return r.toISOString().split('T')[0];
        };

      // Carrier-aware options (Israel Post default / Wolt opt-in) via DeliveryRouter.
      const options = getDeliveryOptions({
              city: params.city,
              postcode: params.zipCode || null,
              totalGrams: params.totalGrams,
              subtotalCents: params.subtotalCents ?? 0,
              wantsFast: params.wantsFast,
              signatureRequired: params.signatureRequired,
      });

      return {
              // Carrier options are the source of truth going forward.
              options,
              legalNote: getDeliveryLegalNote(),
              // Legacy shape kept for backward compatibility with existing callers.
              standard: {
                        cents: DELIVERY_RATES.STANDARD_CENTS,
                        estimatedDate: addDays(today, DELIVERY_RATES.STANDARD_DAYS),
                        label_he: `משלוח סטנדרטי — ${DELIVERY_RATES.STANDARD_DAYS} ימי עסקים`,
                        label_en: `Standard delivery — ${DELIVERY_RATES.STANDARD_DAYS} business days`,
              },
              express: hasExpress ? {
                        cents: DELIVERY_RATES.EXPRESS_CENTS,
                        estimatedDate: addDays(today, DELIVERY_RATES.EXPRESS_DAYS),
                        label_he: 'משלוח אקספרס — יום העסקים הבא',
                        label_en: 'Express delivery — next business day',
              } : null,
              freeThresholdCents: DELIVERY_RATES.FREE_THRESHOLD_CENTS,
      };
  }

  async calculateDelivery(
        method: string,
        addressId: number | undefined,
        cart: { subtotalCents: number; items?: Array<{ weight_grams?: number | string; quantity?: number | string }> }
      ): Promise<{ cents: number; estimatedDate: string }> {
        if (method === 'pickup_station' || method === 'pickup_groomer') {
                return { cents: 0, estimatedDate: new Date().toISOString().split('T')[0] };
        }

      // The charge must reflect HOW HEAVY the order is and HOW FAR it travels — not
      // a flat rate. We price via the SAME vetted DeliveryRouter the estimate uses
      // (weight tiers ₪19.90–₪69.90 + a periphery surcharge for remote areas + the
      // central-zone free-shipping threshold), so the amount charged matches the
      // amount quoted. Previously this returned a flat ₪29.90/free — undercharging
      // heavy/periphery orders (PetWash ate the difference) and overcharging light
      // central ones. See server/services/shop/DeliveryRouter.ts.
      const address = addressId != null ? await this._getAddress(addressId) : null;
      const totalGrams = (cart.items ?? []).reduce(
              (g, i) => g + (Number(i.weight_grams) || 0) * (Number(i.quantity) || 1),
              0,
      );

      const options = getDeliveryOptions({
              city: (address as any)?.city ?? '',
              postcode: (address as any)?.zip_code ?? null,
              totalGrams,
              subtotalCents: cart.subtotalCents,
      });
      // Checkout offers the standard (Israel Post) nationwide service; pick it.
      const chosen = options.find((o) => o.serviceCode === 'standard') ?? options[0];
      const extraDays = chosen?.zone === 'periphery' ? 2 : 0;

      return {
              cents: chosen?.cents ?? DELIVERY_RATES.STANDARD_CENTS,
              estimatedDate: this._addBusinessDays(DELIVERY_RATES.STANDARD_DAYS + extraDays),
      };
  }

  private _addBusinessDays(n: number): string {
        // Holiday + weekend aware (Israeli calendar): skips Fri/Sat AND public holidays.
        return addDeliveryDays(n);
  }

  // ─── Orders ───────────────────────────────────────────────────────────────
  // createPendingOrder REMOVED 2026-07-05 (audit #10 closed): it created the
  // shop_orders row BEFORE any money was captured and attached a stub
  // paymentUrl to a route that does not exist for shop. The card path is now
  // capture-then-create: checkout records a `purchases` shadow row + SUMIT
  // redirect; PurchaseActivationService case 'SHOP_ORDER' builds the order
  // (via createOrder below) only after the signed webhook confirms payment.

  async createOrder(uid: string, cart: any, opts: any): Promise<ShopOrder & { items: ShopOrderItem[]; deliveryAddress: any }> {
        const orderNumber = this._generateOrderNumber();

      // Atomic checkout (audit #1/#3/#10): re-check + decrement stock, create the
      // order + line items, mark the cart, and bump coupon use — all in ONE
      // transaction. The guarded decrement (`stock_quantity >= qty`) is serialised
      // by the DB, so two concurrent buyers can't oversell. If ANY line is short,
      // the whole transaction aborts → no order row, no partial stock change, and
      // the caller (route) compensates the already-captured payment.
      const order = await (db as any).transaction(async (tx: any) => {
            for (const item of cart.items) {
                    const qty = Number(item.quantity) || 0;
                    const dec: any = await tx.execute(sql`
                          UPDATE shop_products
                                SET stock_quantity = stock_quantity - ${qty},
                                            sales_count    = COALESCE(sales_count, 0) + ${qty}
                                                WHERE id = ${item.product_id} AND stock_quantity >= ${qty}
                                                      RETURNING id
                                                          `);
                    if (!((dec?.rows ?? dec ?? []).length)) {
                            const label = item.name_he || item.name_en || `#${item.product_id}`;
                            throw new Error(`OUT_OF_STOCK: ${label}`);
                    }
            }

            const result: any = await tx.execute(sql`
                  INSERT INTO shop_orders (
                          order_number, user_id, cart_id, status,
                                  payment_ref, payment_method,
                                          subtotal_cents, discount_cents, delivery_cents,
                                                  gift_wrap_cents, net_cents, vat_cents, total_cents,
                                                          delivery_method, delivery_address_id,
                                                                  coupon_code, notes, language, created_at, updated_at
                                                                        ) VALUES (
                                                                                ${orderNumber}, ${uid}, ${cart.id}, 'confirmed',
                                                                                        ${opts.paymentRef}, ${opts.paymentMethod},
                                                                                                ${cart.subtotalCents}, ${opts.discountAmountCents}, ${opts.deliveryCents},
                                                                                                        ${opts.giftWrap ? GIFT_WRAP_CENTS : 0},
                                                                                                                ${opts.netCents}, ${opts.vatCents}, ${opts.totalCents},
                                                                                                                        ${opts.deliveryMethod}, ${opts.deliveryAddressId ?? null},
                                                                                                                                ${opts.couponCode ?? null}, ${opts.notes ?? null},
                                                                                                                                        ${opts.language ?? 'he'}, NOW(), NOW()
                                                                                                                                              )
                                                                                                                                                    RETURNING *
                                                                                                                                                        `);
            const ord = result.rows[0] as any;

            // Line items with per-line VAT (same transaction).
            await this._insertOrderItems(ord.id, cart.items, tx);

            // Close the cart so it can't be checked out twice.
            await tx.execute(sql`UPDATE shop_carts SET status = 'checked_out', updated_at = NOW() WHERE id = ${cart.id}`);

            // Coupon use (inside the tx so it can't be double-counted on retry).
            if (opts.couponCode) {
                    await tx.execute(sql`UPDATE coupons SET uses_count = uses_count + 1 WHERE code = ${opts.couponCode.toUpperCase()}`);
            }

            return ord;
      });

      const items = await this._getOrderItems(order.id);
        const deliveryAddress = opts.deliveryAddressId
          ? await this._getAddress(opts.deliveryAddressId)
                : null;

      return { ...order, items, deliveryAddress };
  }

  private async _insertOrderItems(orderId: number, items: any[], exec: any = db) {
        for (const item of items) {
                const effectiveCents = item.effectivePriceCents ?? item.price_cents;
                const lineCents = effectiveCents * item.quantity;
                const lineVatCents = Math.round(lineCents * ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE));
                await exec.execute(sql`
                        INSERT INTO shop_order_items (
                                  order_id, product_id, variant_id, quantity,
                                            unit_price_cents, line_total_cents, vat_cents,
                                                      name_he, name_en, sku, created_at
                                                              ) VALUES (
                                                                        ${orderId}, ${item.product_id}, ${item.variant_id ?? null},
                                                                                  ${item.quantity}, ${effectiveCents}, ${lineCents}, ${lineVatCents},
                                                                                            ${item.name_he}, ${item.name_en ?? null}, ${item.sku ?? null}, NOW()
                                                                                                    )
                                                                                                          `);
        }
  }

  private async _getOrderItems(orderId: number): Promise<ShopOrderItem[]> {
        const result = await db.execute(sql`SELECT * FROM shop_order_items WHERE order_id = ${orderId} ORDER BY id`);
        return result.rows as ShopOrderItem[];
  }

  async getOrderHistory(uid: string, page: number, limit: number) {
        const offset = (page - 1) * limit;
        const [orders, countResult] = await Promise.all([
                db.execute(sql`
                        SELECT o.*, COUNT(oi.id) AS item_count
                                FROM shop_orders o
                                        LEFT JOIN shop_order_items oi ON oi.order_id = o.id
                                                WHERE o.user_id = ${uid}
                                                        GROUP BY o.id
                                                                ORDER BY o.created_at DESC
                                                                        LIMIT ${limit} OFFSET ${offset}
                                                                              `),
                db.execute(sql`SELECT COUNT(*) AS total FROM shop_orders WHERE user_id = ${uid}`),
              ]);

      return {
              orders: orders.rows,
              pagination: {
                        page,
                        limit,
                        total: Number(countResult.rows[0]?.total ?? 0),
              },
      };
  }

  async getOrder(orderId: number, uid: string): Promise<any | null> {
        const result = await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${orderId} AND user_id = ${uid}`);
        if (!result.rows.length) return null;
        const order = result.rows[0] as any;
        const items = await this._getOrderItems(orderId);
        const deliveryAddress = order.delivery_address_id ? await this._getAddress(order.delivery_address_id) : null;
        return { ...order, items, deliveryAddress };
  }

  async cancelOrder(orderId: number, uid: string): Promise<{ success: boolean; reason?: string; refundCents: number; cancellationFeeCents: number }> {
        const result = await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${orderId} AND user_id = ${uid}`);
        if (!result.rows.length) return { success: false, reason: 'Order not found', refundCents: 0, cancellationFeeCents: 0 };

      const order = result.rows[0] as any;
        if (!['pending', 'confirmed', 'payment_required'].includes(order.status)) {
                return { success: false, reason: `Cannot cancel order in status: ${order.status}`, refundCents: 0, cancellationFeeCents: 0 };
        }

      await db.execute(sql`
            UPDATE shop_orders SET status = 'cancelled', updated_at = NOW(), cancelled_at = NOW() WHERE id = ${orderId}
                `);

      // Restore stock (audit #12). NOTE: shop_order_items rows expose product_id
      // (snake_case) — the prior code read item.productId (undefined) so stock was
      // silently never restored on cancellation.
      const items = await this._getOrderItems(orderId);
        for (const item of items) {
                const pid = (item as any).product_id;
                const qty = (item as any).quantity;
                if (!pid) continue;
                await db.execute(sql`
                        UPDATE shop_products SET stock_quantity = stock_quantity + ${qty} WHERE id = ${pid}
                              `).catch(() => {});
        }

      // Refund the customer the legally-correct amount — NOT a flat 100%. Money
      // was only collected once the order is 'confirmed' (wallet-paid); an unpaid
      // 'pending'/'payment_required' order refunds nothing. A confirmed order
      // refunds the total MINUS the statutory cancellation fee (min 5% / ₪100).
      const totalCents = Number(order.total_cents) || 0;
      const wasPaid = order.status === 'confirmed';
      const { refundCents, feeCents } = wasPaid
        ? customerCancellationRefundCents({ amountCents: totalCents, reason: 'customer' })
        : { refundCents: 0, feeCents: 0 };

      return { success: true, refundCents, cancellationFeeCents: feeCents };
  }

  async adminListOrders(params: { page: number; limit: number; status?: string }) {
        const offset = (params.page - 1) * params.limit;
        const statusFilter = params.status ? sql`WHERE o.status = ${params.status}` : sql``;

      const [orders, countResult] = await Promise.all([
              db.execute(sql`
                      SELECT o.*, u.email AS customer_email,
                                     u.display_name AS customer_name,
                                                    COUNT(oi.id) AS item_count
                                                            FROM shop_orders o
                                                                    JOIN users u ON u.id = o.user_id
                                                                            LEFT JOIN shop_order_items oi ON oi.order_id = o.id
                                                                                    ${statusFilter}
                                                                                            GROUP BY o.id, u.email, u.display_name
                                                                                                    ORDER BY o.created_at DESC
                                                                                                            LIMIT ${params.limit} OFFSET ${offset}
                                                                                                                  `),
              db.execute(sql`SELECT COUNT(*) AS total FROM shop_orders ${statusFilter}`),
            ]);

      return {
              orders: orders.rows,
              pagination: {
                        page: params.page,
                        limit: params.limit,
                        total: Number(countResult.rows[0]?.total ?? 0),
              },
      };
  }

  async updateOrderStatus(orderId: number, newStatus: string, opts: { trackingNumber?: string; trackingUrl?: string }): Promise<any> {
        await db.execute(sql`
              UPDATE shop_orders
                    SET status = ${newStatus},
                              tracking_number = ${opts.trackingNumber ?? null},
                                        tracking_url = ${opts.trackingUrl ?? null},
                                                  ${newStatus === 'dispatched' ? sql`dispatched_at = NOW(),` : sql``}
                                                            ${newStatus === 'delivered' ? sql`delivered_at = NOW(),` : sql``}
                                                                      updated_at = NOW()
                                                                            WHERE id = ${orderId}
                                                                                `);

      const result = await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${orderId}`);
        return result.rows[0];
  }

  // ─── Delivery addresses ────────────────────────────────────────────────────

  async saveDeliveryAddress(uid: string, data: any): Promise<ShopDeliveryAddress> {
        if (data.isDefault) {
                await db.execute(sql`UPDATE shop_delivery_addresses SET is_default = false WHERE user_id = ${uid}`);
        }

      const result = await db.execute(sql`
            INSERT INTO shop_delivery_addresses (
                    user_id, full_name, phone, street, city, zip_code, notes, is_default, created_at
                          ) VALUES (
                                  ${uid}, ${data.fullName}, ${data.phone}, ${data.street}, ${data.city},
                                          ${data.zipCode ?? null}, ${data.notes ?? null}, ${data.isDefault ?? false}, NOW()
                                                )
                                                      RETURNING *
                                                          `);
        return result.rows[0] as ShopDeliveryAddress;
  }

  async getDeliveryAddresses(uid: string): Promise<ShopDeliveryAddress[]> {
        const result = await db.execute(sql`
              SELECT * FROM shop_delivery_addresses WHERE user_id = ${uid} ORDER BY is_default DESC, created_at DESC
                  `);
        return result.rows as ShopDeliveryAddress[];
  }

  private async _getAddress(id: number): Promise<ShopDeliveryAddress | null> {
        const result = await db.execute(sql`SELECT * FROM shop_delivery_addresses WHERE id = ${id}`);
        return (result.rows[0] as ShopDeliveryAddress) ?? null;
  }

  // ─── Notifications & Invoicing ────────────────────────────────────────────

  async getUserProfile(uid: string): Promise<{ displayName?: string; email: string; phone?: string }> {
        const result = await db.execute(sql`
              SELECT email, display_name, phone FROM users WHERE id = ${uid}
                  `);
        const u = result.rows[0] as any;
        return { displayName: u?.display_name, email: u?.email, phone: u?.phone };
  }

  async sendDispatchNotification(order: any): Promise<void> {
        const user = await this.getUserProfile(order.user_id ?? order.userId);

      // Email notification
      try {
              await sendLuxuryEmail({
                        to: user.email,
                        subject: `הזמנה #${order.order_number} יצאה לדרך! 📦`,
                        html: `
                                  <div dir="rtl" style="font-family:Arial;background:#fff;padding:32px;max-width:600px">
                                              <h2 style="color:#C9A96E">PetWash™ — ההזמנה שלך בדרך!</h2>
                                                          <p>שלום ${user.displayName || 'לקוח יקר'},</p>
                                                                      <p>הזמנה מספר <strong>#${order.order_number}</strong> יצאה לדרך.</p>
                                                                                  ${order.tracking_number ? `<p>מספר מעקב: <strong>${order.tracking_number}</strong></p>` : ''}
                                                                                              ${order.tracking_url ? `<p><a href="${order.tracking_url}" style="color:#C9A96E">מעקב אחר המשלוח</a></p>` : ''}
                                                                                                          <p>PetWash™ | noreply@petwash.co.il</p>
                                                                                                                    </div>
                                                                                                                            `,
              });
      } catch (e: any) {
              logger.warn('[ShopService] dispatch email failed', { orderId: order.id, err: e.message });
      }

      // SMS notification
      if (user.phone) {
              try {
                        await this.smsService.sendSMS(
                                    user.phone,
                                    `PetWash™: הזמנה #${order.order_number} יצאה לדרך! ${order.tracking_number ? `מעקב: ${order.tracking_url}` : ''}`
                                  );
              } catch (e: any) {
                        logger.warn('[ShopService] dispatch SMS failed', { orderId: order.id, err: e.message });
              }
      }
  }

  async generateTaxInvoice(orderId: number): Promise<void> {
        try {
                const result = await db.execute(sql`
                        SELECT o.*, u.email, u.display_name, u.address
                                FROM shop_orders o
                                        JOIN users u ON u.id = o.user_id
                                                WHERE o.id = ${orderId}
                                                      `);
                const order = result.rows[0] as any;
                if (!order) throw new Error(`Order ${orderId} not found`);

          const items = await this._getOrderItems(orderId);
          const itemNamesHe = items.map((i: any) => `${i.name_he} ×${i.quantity}`).join(', ');
          const totalCents = Number(order.total_cents) || 0;
          const netCents = Number(order.net_cents) || 0;

          // Canonical SUMIT-backed fiscal receipt — the SAME engine wash/sitter/walk
          // use (routes to SUMIT when SUMIT_ENABLED + creds are set; legal חשבונית מס-קבלה
          // with allocation number). Replaces the broken IsraeliInvoiceGenerator call
          // (that was a static provider-commission method with a different signature —
          // it silently failed, so paid shop orders got NO receipt). Direct PetWash sale
          // → no provider, no marketplace commission.
          // Delivery address → receipt (display only). Pickup orders have no
          // delivery_address_id, so the line is simply omitted for them.
          let shopServiceAddress: string | undefined;
          if (order.delivery_address_id) {
            const da = await this._getAddress(order.delivery_address_id);
            if (da) {
              shopServiceAddress = formatUserAddress(
                { street: (da as any).street, city: (da as any).city, postalCode: (da as any).zip_code },
                { lang: 'he' },
              ) || undefined;
            }
          }

          const { IsraeliDigitalReceiptService } = await import('./IsraeliDigitalReceiptService');
          await IsraeliDigitalReceiptService.generateReceipt({
            platform: 'shop',
            paymentClass: 'SHOP_ITEM',
            bookingId: `shop:${order.order_number ?? orderId}`,
            customerEmail: order.email || '',
            customerName: order.display_name || '',
            serviceAddress: shopServiceAddress,
            serviceDescription: `⁦PetWash™⁩ Shop order ${order.order_number ?? orderId}`,
            serviceDescriptionHe: itemNamesHe || `הזמנת חנות ⁦PetWash™⁩ ${order.order_number ?? orderId}`,
            subtotalAmount: netCents / 100,
            platformFeeAmount: 0,
            totalAmount: totalCents / 100,
            // Real tender from the order row — the wallet path was previously
            // stamped "Credit Card (SUMIT)" on the fiscal receipt, which is
            // false on a legal document.
            paymentMethod: order.payment_method === 'wallet' ? 'PetWash Wallet' : 'Credit Card (SUMIT)',
          });

          logger.info('[ShopService] Tax invoice generated via SUMIT', { orderId, orderNumber: order.order_number });

          // CEO transaction visibility (2026-07-26): notify the founder of the
          // shop purchase. Fire-and-forget — never affects order completion.
          try {
            const { EmailService } = await import('../emailService');
            void EmailService.sendAdminTransactionAlert({
              event: 'purchase',
              reference: order.order_number ?? String(orderId),
              service: 'Shop order',
              customer: order.email || order.display_name || undefined,
              amountIls: totalCents / 100,
              details: { Payment: order.payment_method === 'wallet' ? 'Wallet' : 'Card' },
            });
          } catch { /* alert is best-effort */ }
        } catch (err: any) {
                logger.error('[ShopService] generateTaxInvoice failed', { orderId, err: err.message });
                // Non-fatal — invoice can be regenerated from admin
        }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _generateOrderNumber(): string {
        const now = new Date();
        const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rand = Math.floor(Math.random() * 90000) + 10000;
        return `PW-${yyyymm}-${rand}`;
  }
}
