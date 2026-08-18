import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PetCarePlanner.tsx'), 'utf8');

// Regression pin for audit finding #12 (2026-08-18): the wash-schedule card
// rendered {schedule.status} raw ("pending"/"completed"/"cancelled") next to
// the check/hourglass icon on a customer-facing planner surface.

describe('PetCarePlanner.tsx wash-schedule status label (agent finding #12)', () => {
  it('SCHEDULE_STATUS_LABEL dictionary + helper exist with bilingual entries', () => {
    expect(SRC).toMatch(/SCHEDULE_STATUS_LABEL:\s*Record<string,\s*\[string,\s*string\]>/);
    expect(SRC).toMatch(/pending:\s*\['Pending',\s*'ממתין'\]/);
    expect(SRC).toMatch(/completed:\s*\['Completed',\s*'הושלם'\]/);
    expect(SRC).toMatch(/function scheduleStatusLabel\(status: string, he: boolean\)/);
  });

  it('schedule card renders through the label helper', () => {
    expect(SRC).toMatch(/scheduleStatusLabel\(schedule\.status, isHebrew\)/);
  });

  it('does not reintroduce the raw {schedule.status} render next to the icon', () => {
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/'⏳'\}\s*\{schedule\.status\}/);
  });
});
