/**
 * Nayax terminal registry — the stations/terminals mapping (2026-07-11).
 * Each bay's SUMIT invoice must be tagged to its station + bay, not a bare machine id.
 */
import { describe, it, expect } from 'vitest';
import { terminalForMachine, terminalLabel, NAYAX_TERMINALS } from '../services/nayaxTerminals';
import { buildReceiptInput, selectDocumentableSales } from '../services/nayaxSumitBridge';

describe('nayaxTerminals registry (2026-07-11)', () => {
  it('maps the two confirmed Kfar Saba bays to station + bay + device', () => {
    const right = terminalForMachine('182443');
    const left = terminalForMachine(182462);
    expect(right).toMatchObject({ stationNameHe: 'כפר סבא פארק ולד', bay: 'RIGHT', bayNameHe: 'ימין', deviceId: '369617593' });
    expect(left).toMatchObject({ stationNameHe: 'כפר סבא פארק ולד', bay: 'LEFT', bayNameHe: 'שמאל', deviceId: '188843334' });
    expect(terminalLabel(right!)).toBe('כפר סבא פארק ולד — ימין');
  });

  it('returns undefined for an unknown machine (never throws)', () => {
    expect(terminalForMachine('999999')).toBeUndefined();
    expect(terminalForMachine(null)).toBeUndefined();
  });

  it('the bridge tags each invoice with the station + bay from the registry', () => {
    const rows = [{
      TransactionID: 501, MachineID: 182443, CurrencyCode: 'ILS',
      AuthorizationValue: 55, SettlementValue: 55, PaymentMethod: 'Credit Card',
      SettlementDateTimeGMT: '2026-07-10T10:00:00',
    }];
    const input = buildReceiptInput(selectDocumentableSales(rows)[0]);
    expect(input.description).toContain('כפר סבא פארק ולד — ימין');
    expect(input.context.stationId).toBe('KFAR_SABA_PARK_WALD');
    expect(input.context.bay).toBe('RIGHT');
    expect(input.context.deviceId).toBe('369617593');
  });

  // 2026-09-06 — this pin previously asserted ['182443','182462'] under the comment
  // "add the next two when they open". They had already opened: the 2026 Nayax export
  // shows 182374/182403 settling money since July (172 washes, ₪7,031 across Jul–Sep).
  // The pin was therefore locking in a registry that could not label a third of station
  // revenue — terminalForMachine() returned undefined and the admin finance surface
  // rendered stationNameHe: null for every one of those rows.
  it('registers all four live Kfar Saba bays', () => {
    expect(Object.keys(NAYAX_TERMINALS).sort()).toEqual(['182374', '182403', '182443', '182462']);
  });

  it('resolves the Green Park 80 bays that were taking money while unregistered', () => {
    const left = terminalForMachine('182374');
    const right = terminalForMachine('182403');
    expect(left).toMatchObject({
      stationId: 'KFAR_SABA_PARK_80_GREEN', stationNameHe: 'פארק 80 כפר סבא הירוקה',
      bay: 'LEFT', bayNameHe: 'שמאל',
    });
    expect(right).toMatchObject({
      stationId: 'KFAR_SABA_PARK_80_GREEN', stationNameHe: 'פארק 80 כפר סבא הירוקה',
      bay: 'RIGHT', bayNameHe: 'ימין',
    });
    expect(terminalLabel(left!)).toBe('פארק 80 כפר סבא הירוקה — שמאל');
  });

  // The Green Park device serials are genuinely unknown (not yet read from MoMa).
  // null is the honest value; a fabricated serial would flow onto the SUMIT bridge
  // context as though it were real hardware.
  it('carries null — never an invented serial — for a device id not yet looked up', () => {
    expect(terminalForMachine('182374')!.deviceId).toBeNull();
    expect(terminalForMachine('182403')!.deviceId).toBeNull();
    expect(terminalForMachine('182443')!.deviceId).toBe('369617593');
  });

  it('the bridge tags a Green Park sale with its station + bay', () => {
    const rows = [{
      TransactionID: 502, MachineID: 182403, CurrencyCode: 'ILS',
      AuthorizationValue: 48, SettlementValue: 48, PaymentMethod: 'Credit Card',
      SettlementDateTimeGMT: '2026-08-10T10:00:00',
    }];
    const input = buildReceiptInput(selectDocumentableSales(rows)[0]);
    expect(input.description).toContain('פארק 80 כפר סבא הירוקה — ימין');
    expect(input.context.stationId).toBe('KFAR_SABA_PARK_80_GREEN');
    expect(input.context.bay).toBe('RIGHT');
    expect(input.context.deviceId).toBeNull();
  });
});
