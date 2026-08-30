/**
 * TransactionPassportService — CEO PROGRAM 12 (Transaction Passport).
 *
 * Read-only aggregator. Given a correlation key (jobRef /
 * transactionId / bookingId / orderId / giftId / refundId), returns
 * a structured trace of every party, event and document tied to
 * that entity — used by admin search and by the customer-facing
 * "transaction passport" view.
 *
 * This first slice ships the SHAPE + a pluggable Passport source
 * so the endpoint can be wired later against real DB adapters. The
 * shape itself is what surfaces / clients / admin dashboards code
 * against; adapters land per-domain in follow-up refills.
 */

export type PassportKey =
  | { kind: 'jobRef'; value: string }
  | { kind: 'transactionId'; value: string }
  | { kind: 'correlationId'; value: string }
  | { kind: 'booking'; value: string }
  | { kind: 'shop_order'; value: string }
  | { kind: 'gift'; value: string }
  | { kind: 'refund'; value: string }
  | { kind: 'wallet_topup'; value: string };

export interface PassportActor {
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'SYSTEM';
  uid?: string;
  displayCode?: string;                     // stable slug the UI translates
}

export interface PassportMoneyLeg {
  code: string;                             // stable slug
  amountCents: number;
  currency: 'ILS';
  labelCode: string;
  timelineAt: string;                       // ISO
}

export interface PassportEvent {
  code: string;                             // stable event slug
  actor?: PassportActor;
  at: string;                               // ISO
}

export interface PassportDocumentRef {
  documentId: string;
  kind: string;                             // stable slug (RECEIPT, INVOICE, ...)
  externalUrl?: string;
}

export interface PassportRecord {
  headEntityRef: { kind: string; id: string };
  actors: PassportActor[];
  events: PassportEvent[];
  money: {
    legs: PassportMoneyLeg[];
    totalCents: number;
  };
  documents: PassportDocumentRef[];
  /** Free-form correlation ids the caller found while assembling the passport. */
  correlationIds: string[];
}

export type PassportOutcome =
  | { code: 'OK'; passport: PassportRecord }
  | { code: 'NOT_FOUND' };

export interface PassportSource {
  loadByKey(key: PassportKey): Promise<PassportOutcome> | PassportOutcome;
}

/** In-memory source — dev / tests. */
export class InMemoryPassportSource implements PassportSource {
  private byKey = new Map<string, PassportRecord>();

  private mapKey(k: PassportKey): string { return `${k.kind}:${k.value}`; }

  put(k: PassportKey, rec: PassportRecord): void { this.byKey.set(this.mapKey(k), rec); }

  loadByKey(key: PassportKey): PassportOutcome {
    const rec = this.byKey.get(this.mapKey(key));
    return rec ? { code: 'OK', passport: rec } : { code: 'NOT_FOUND' };
  }

  clear(): void { this.byKey.clear(); }
}

let defaultSource: PassportSource = new InMemoryPassportSource();
export function getDefaultPassportSource(): PassportSource { return defaultSource; }
export function setDefaultPassportSource(s: PassportSource): void { defaultSource = s; }

export async function loadPassport(key: PassportKey, source: PassportSource = getDefaultPassportSource()): Promise<PassportOutcome> {
  try {
    return await source.loadByKey(key);
  } catch {
    return { code: 'NOT_FOUND' };
  }
}
