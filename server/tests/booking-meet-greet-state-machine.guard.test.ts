/**
 * PR-BOOKING-MEET-GREET-STATE-A - route source guard.
 *
 * Meet & Greet endpoints mutate booking_request status, so they must route
 * through the central booking state machine instead of setting
 * meet_greet_* statuses directly from any current status.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const bookingRequestsSrc = fs.readFileSync(path.join(ROOT, 'routes/booking-requests.ts'), 'utf8');

const meetGreetRoute = bookingRequestsSrc.slice(
  bookingRequestsSrc.indexOf("router.post('/:requestId/meet-greet'"),
  bookingRequestsSrc.indexOf("/**\n * POST /api/booking-requests/:requestId/payment", bookingRequestsSrc.indexOf("router.post('/:requestId/meet-greet'")),
);

describe('PR-BOOKING-MEET-GREET-STATE-A - Meet & Greet uses state-machine truth', () => {
  it('imports the central transition helper', () => {
    expect(bookingRequestsSrc).toMatch(/import\s+\{\s*applyTransition[\s\S]*\}\s+from ['"]@shared\/lib\/bookingStateMachine['"]/);
  });

  it('guards scheduling through applyTransition before writing meet_greet_scheduled', () => {
    const scheduleBranch = meetGreetRoute.slice(
      meetGreetRoute.indexOf("if (action === 'schedule')"),
      meetGreetRoute.indexOf("} else if (action === 'complete')"),
    );

    expect(scheduleBranch).toMatch(/applyTransition\(\{[\s\S]*to:\s*'meet_greet_scheduled'[\s\S]*actor/);
    expect(scheduleBranch).toMatch(/transition\.result\.statusCode/);
    expect(scheduleBranch.indexOf('applyTransition')).toBeGreaterThan(-1);
    expect(scheduleBranch.indexOf("status: 'meet_greet_scheduled'")).toBeGreaterThan(scheduleBranch.indexOf('applyTransition'));
  });

  it('guards completion through applyTransition before writing meet_greet_completed', () => {
    const completeBranch = meetGreetRoute.slice(
      meetGreetRoute.indexOf("} else if (action === 'complete')"),
      meetGreetRoute.indexOf('} else {', meetGreetRoute.indexOf("} else if (action === 'complete')")),
    );

    expect(completeBranch).toMatch(/applyTransition\(\{[\s\S]*to:\s*'meet_greet_completed'[\s\S]*actor:\s*'provider'/);
    expect(completeBranch).toMatch(/transition\.result\.statusCode/);
    expect(completeBranch.indexOf('applyTransition')).toBeGreaterThan(-1);
    expect(completeBranch.indexOf("status: 'meet_greet_completed'")).toBeGreaterThan(completeBranch.indexOf('applyTransition'));
  });
});
