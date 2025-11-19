/**
 * PetWash™ Voucher 2025 - Type Definitions (Shared)
 * Safe to import in both frontend and backend
 * Contains NO server-only code (crypto, express, jose)
 */

export interface PetWashVoucher2025 {
  voucher_id: string;
  public_code: string;
  type: 'egift' | 'multi_wash' | 'loyalty_reward' | 'corporate';
  
  visual: {
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'executive' | 'enterprise';
    card_theme: string;
    animated_highlight: boolean;
    highres_svg_url: string | null;
  };
  
  rules: {
    value_type: 'monetary' | 'washes' | 'hybrid';
    value_original: number;
    value_remaining: number;
    washes_original: number | null;
    washes_remaining: number | null;
    currency: string | null;
    expires_at: string | null;
    transferable: boolean;
  };
  
  owner: {
    user_id: string;
    name: string;
    email: string;
    created_in_app: string;
  };
  
  gift?: {
    is_gift: boolean;
    sender_name: string | null;
    sender_email: string | null;
    recipient_name: string | null;
    recipient_email: string | null;
    personal_message: string | null;
    gift_claimed_at: string | null;
  };
  
  lifecycle: {
    created_at: string;
    activated_at: string | null;
    first_redeemed_at: string | null;
    last_redeemed_at: string | null;
    fully_redeemed_at: string | null;
    archived_at: string | null;
  };
  
  security: {
    signature_jws: string | null;
    hash_sha256: string | null;
    signed_at: string | null;
    requires_pin: boolean;
    pin_hash: string | null;
  };
  
  purchase: {
    order_id: string | null;
    payment_method: string | null;
    payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
    payment_intent_id: string | null;
    original_price: number | null;
    purchase_location: string | null;
  };
  
  metadata: {
    issuer: 'petwash' | 'partner' | 'promotion';
    campaign_id: string | null;
    tags: string[];
    notes: string | null;
  };
}

export interface VoucherUsageRecord {
  usage_id: string;
  voucher_id: string;
  used_at: string;
  used_value: number;
  used_washes: number | null;
  station_id: string | null;
  transaction_id: string | null;
  device_id: string | null;
  verified_by: string | null;
}

export interface VoucherBalance {
  voucher_id: string;
  original_value: number;
  original_washes: number | null;
  calculated_remaining_value: number;
  calculated_remaining_washes: number | null;
  recorded_remaining_value: number;
  recorded_remaining_washes: number | null;
  is_tampered: boolean;
  difference_value: number;
  difference_washes: number | null;
}
