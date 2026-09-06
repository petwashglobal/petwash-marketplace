/**
 * Nayax K9000 terminal registry (2026-07-11, extended 2026-09-06).
 *
 * The "stations and terminals mapping" — one entry per physical Nayax bay, so every
 * SUMIT tax document the bridge issues is tagged to the right STATION + BAY (not just
 * a machine number).
 *
 * 2026-09-06 — the Green Park 80 bays (182374 / 182403) were added. They were NOT
 * hypothetical "next two bays": the 2026 Nayax export shows they have been taking
 * money since July. Across Jul–Sep they settled 172 washes / ₪7,031, and because
 * they were absent here `terminalForMachine()` returned undefined for every one of
 * them — so roughly a third of station revenue reached the admin finance surface
 * with `stationNameHe: null, bay: null`. Verified against the reconciled Nayax ↔
 * fiscal-ledger ↔ SUMIT join before adding.
 *
 * `deviceId` is the Nayax device serial shown beside the machine in MoMa. It is
 * KNOWN for the two Wald bays and UNKNOWN for the two Green Park bays — so those
 * carry null rather than a fabricated serial. Look them up in MoMa and fill them
 * in; nothing depends on the value except an informational field on the SUMIT
 * bridge context.
 */
export interface NayaxTerminal {
  machineId: string;      // Nayax MachineID (the id lastSales returns)
  /** Nayax device/terminal serial shown next to it in MoMa. null = not yet looked up. */
  deviceId: string | null;
  stationId: string;      // our station key
  stationNameHe: string;  // station name for the invoice line
  bay: 'RIGHT' | 'LEFT';
  bayNameHe: 'ימין' | 'שמאל';
}

export const NAYAX_TERMINALS: Record<string, NayaxTerminal> = {
  '182374': {
    machineId: '182374', deviceId: null,
    stationId: 'KFAR_SABA_PARK_80_GREEN', stationNameHe: 'פארק 80 כפר סבא הירוקה',
    bay: 'LEFT', bayNameHe: 'שמאל',
  },
  '182403': {
    machineId: '182403', deviceId: null,
    stationId: 'KFAR_SABA_PARK_80_GREEN', stationNameHe: 'פארק 80 כפר סבא הירוקה',
    bay: 'RIGHT', bayNameHe: 'ימין',
  },
  '182443': {
    machineId: '182443', deviceId: '369617593',
    stationId: 'KFAR_SABA_PARK_WALD', stationNameHe: 'כפר סבא פארק ולד',
    bay: 'RIGHT', bayNameHe: 'ימין',
  },
  '182462': {
    machineId: '182462', deviceId: '188843334',
    stationId: 'KFAR_SABA_PARK_WALD', stationNameHe: 'כפר סבא פארק ולד',
    bay: 'LEFT', bayNameHe: 'שמאל',
  },
};

/** Look up a terminal by Nayax machine id (undefined for an unknown machine). */
export function terminalForMachine(machineId: string | number | null | undefined): NayaxTerminal | undefined {
  if (machineId === null || machineId === undefined) return undefined;
  return NAYAX_TERMINALS[String(machineId)];
}

/** A human label for the invoice line, e.g. "כפר סבא פארק ולד — ימין". */
export function terminalLabel(t: NayaxTerminal): string {
  return `${t.stationNameHe} — ${t.bayNameHe}`;
}
