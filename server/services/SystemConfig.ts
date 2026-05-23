/**
 * SYSTEM CONFIG SERVICE
 * PETWASH SYSTEM INTELLIGENCE SPEC — Admin Control System
 *
 * Singleton in-memory config store for runtime toggles.
 * Admins can adjust these via the admin panel without a code deploy.
 *
 * On server restart values reset to defaults — this is intentional.
 * These toggles govern live operational behaviour (e.g. whether CAPTCHA
 * is strictly enforced) and should default to safe values.
 */

import { logger } from '../lib/logger';

export interface SystemConfigMap {
  'captcha.strict_mode': boolean;
  'sms.required_for_registration': boolean;
  'step_up.enabled': boolean;
  'step_up.threshold_seconds': number;
  'matching.default_radius_km': number;
  'matching.boost_new_providers': boolean;
  // Supplier-invoice screening (First Safe PR). OFF = the new routes are
  // closed, no screening runs, legacy accounting flows untouched. Money is
  // never moved by this feature; payment execution stays separate.
  'ff.supplier_invoice_control.enabled': boolean;
  // PR-S4: separately-gated SUMIT (sumit.co.il) send. When this flag is OFF
  // the new POST /api/supplier-invoices/:id/send-to-sumit route returns 404
  // even if the parent supplier-invoice flag is ON. Defense in depth — must
  // flip BOTH flags to actually send a document. Default OFF.
  'ff.supplier_invoice_control.sumit_send.enabled': boolean;
  /**
   * SUMIT activation mode. Mission-4 strategy-pattern dispatcher chooses
   * the integration method:
   *   'off'        — every send returns sent:false reason:"mode is off" (default)
   *   'email'      — forward to ACCOUNTANT_EMAIL with the original file attached
   *   'api'        — direct sumit.co.il REST call via SumitClient (needs API spec)
   *   'csv_export' — write a CSV row + PDF copy to firebase storage for manual upload
   * Independent of the two ff. flags above; activation requires BOTH the flags
   * AND mode != 'off'. Default 'off' means production behaviour is unchanged.
   */
  'sumit.mode': 'off' | 'email' | 'api' | 'csv_export';
  'recovery.signup_reminder_enabled': boolean;
  'recovery.booking_followup_enabled': boolean;
}

const DEFAULTS: SystemConfigMap = {
  'captcha.strict_mode': false,
  'sms.required_for_registration': false,
  'step_up.enabled': false,
  'step_up.threshold_seconds': 7200,
  'matching.default_radius_km': 15,
  'matching.boost_new_providers': true,
  'ff.supplier_invoice_control.enabled': false,
  'ff.supplier_invoice_control.sumit_send.enabled': false,
  'sumit.mode': 'off',
  'recovery.signup_reminder_enabled': true,
  'recovery.booking_followup_enabled': true,
};

export type ConfigKey = keyof SystemConfigMap;

class SystemConfigService {
  private store: SystemConfigMap = { ...DEFAULTS };
  private lastUpdated = new Date();
  private auditLog: Array<{ key: string; from: unknown; to: unknown; by: string; at: Date }> = [];

  get<K extends ConfigKey>(key: K): SystemConfigMap[K] {
    return this.store[key];
  }

  set<K extends ConfigKey>(key: K, value: SystemConfigMap[K], updatedBy: string): void {
    const prev = this.store[key];
    this.store[key] = value;
    this.lastUpdated = new Date();
    this.auditLog.push({ key, from: prev, to: value, by: updatedBy, at: new Date() });

    logger.info('[SystemConfig] Config updated', {
      key,
      from: prev,
      to: value,
      by: updatedBy,
    });
  }

  patch(changes: Partial<SystemConfigMap>, updatedBy: string): void {
    for (const [rawKey, value] of Object.entries(changes)) {
      const key = rawKey as ConfigKey;
      if (key in this.store) {
        this.set(key, value as any, updatedBy);
      } else {
        logger.warn('[SystemConfig] Unknown config key ignored', { key });
      }
    }
  }

  all(): SystemConfigMap {
    return { ...this.store };
  }

  meta() {
    return {
      lastUpdated: this.lastUpdated,
      auditLog: this.auditLog.slice(-20),
      defaults: DEFAULTS,
    };
  }

  reset(updatedBy: string): void {
    logger.warn('[SystemConfig] Full reset to defaults', { by: updatedBy });
    for (const key of Object.keys(DEFAULTS) as ConfigKey[]) {
      this.set(key, DEFAULTS[key], updatedBy);
    }
  }
}

export const systemConfig = new SystemConfigService();
