// FILE: shared/petwashAvailability.ts
// Pet Wash™ - Contractor Availability Management
// Handles weekly schedules, time-off requests, and job slot conflicts

export interface WeeklySchedule {
  monday: { start: string; end: string }[];
  tuesday: { start: string; end: string }[];
  wednesday: { start: string; end: string }[];
  thursday: { start: string; end: string }[];
  friday: { start: string; end: string }[];
  saturday: { start: string; end: string }[];
  sunday: { start: string; end: string }[];
}

export interface TimeOffRequest {
  id: string;
  startIso: string;
  endIso: string;
  reason: string;
  approved: boolean;
}

export interface ContractorAvailabilityProfile {
  contractorId: string;
  weeklySchedule: WeeklySchedule;
  timeOffRequests: TimeOffRequest[];
  maxConcurrentJobs: number; // e.g., 3 jobs at once
}

export interface ExistingJobSlot {
  jobId: string;
  startIso: string;
  endIso: string;
}

export interface AvailabilityCheckResult {
  ok: boolean;
  reason?: string;
}

function getDayOfWeek(dateIso: string): keyof WeeklySchedule {
  const date = new Date(dateIso);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const days: (keyof WeeklySchedule)[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[day];
}

function isTimeInSlots(
  timeIso: string,
  slots: { start: string; end: string }[]
): boolean {
  const time = new Date(timeIso);
  for (const slot of slots) {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (time >= start && time <= end) {
      return true;
    }
  }
  return false;
}

function hasTimeOffConflict(
  requestedStart: string,
  requestedEnd: string,
  timeOffRequests: TimeOffRequest[]
): boolean {
  const start = new Date(requestedStart);
  const end = new Date(requestedEnd);

  for (const timeOff of timeOffRequests) {
    if (!timeOff.approved) continue;
    
    const offStart = new Date(timeOff.startIso);
    const offEnd = new Date(timeOff.endIso);

    // Check for overlap
    if (start < offEnd && end > offStart) {
      return true;
    }
  }
  return false;
}

function hasJobOverlap(
  requestedStart: string,
  requestedEnd: string,
  existingJobs: ExistingJobSlot[]
): boolean {
  const start = new Date(requestedStart);
  const end = new Date(requestedEnd);

  for (const job of existingJobs) {
    const jobStart = new Date(job.startIso);
    const jobEnd = new Date(job.endIso);

    // Check for overlap
    if (start < jobEnd && end > jobStart) {
      return true;
    }
  }
  return false;
}

export function canTakeJob(
  availability: ContractorAvailabilityProfile,
  requestedTime: { startIso: string; endIso: string },
  existingJobsSameDay: ExistingJobSlot[]
): AvailabilityCheckResult {
  // 1. Check weekly schedule
  const dayOfWeek = getDayOfWeek(requestedTime.startIso);
  const daySlots = availability.weeklySchedule[dayOfWeek];
  
  if (!daySlots || daySlots.length === 0) {
    return {
      ok: false,
      reason: "NOT_AVAILABLE_DAY",
    };
  }

  const isInSchedule = isTimeInSlots(requestedTime.startIso, daySlots);
  if (!isInSchedule) {
    return {
      ok: false,
      reason: "NOT_AVAILABLE_TIME",
    };
  }

  // 2. Check time-off requests
  if (hasTimeOffConflict(requestedTime.startIso, requestedTime.endIso, availability.timeOffRequests)) {
    return {
      ok: false,
      reason: "TIME_OFF_CONFLICT",
    };
  }

  // 3. Check concurrent job limit
  if (existingJobsSameDay.length >= availability.maxConcurrentJobs) {
    return {
      ok: false,
      reason: "MAX_CONCURRENT_JOBS",
    };
  }

  // 4. Check for overlapping jobs
  if (hasJobOverlap(requestedTime.startIso, requestedTime.endIso, existingJobsSameDay)) {
    return {
      ok: false,
      reason: "JOB_OVERLAP",
    };
  }

  return { ok: true };
}
