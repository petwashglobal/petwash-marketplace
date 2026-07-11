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

  it('only the two live bays are registered (add the next two when they open)', () => {
    expect(Object.keys(NAYAX_TERMINALS).sort()).toEqual(['182443', '182462']);
  });
});
