/**
 * Nayax K9000 terminal registry (2026-07-11).
 *
 * The "stations and terminals mapping" — one entry per physical Nayax bay, so every
 * SUMIT tax document the bridge issues is tagged to the right STATION + BAY (not just
 * a machine number). Confirmed from Nayax MoMa (2026-07-11): two live Kfar Saba bays.
 * Add the next two bays here when they open — the bridge fleet reads the machine ids.
 */
export interface NayaxTerminal {
  machineId: string;      // Nayax MachineID (the id lastSales returns)
  deviceId: string;       // Nayax device/terminal serial shown next to it in MoMa
  stationId: string;      // our station key
  stationNameHe: string;  // station name for the invoice line
  bay: 'RIGHT' | 'LEFT';
  bayNameHe: 'ימין' | 'שמאל';
}

export const NAYAX_TERMINALS: Record<string, NayaxTerminal> = {
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
