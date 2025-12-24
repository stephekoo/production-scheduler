/**
 * Date utility functions using Luxon.
 *
 * Key considerations:
 * - All dates in UTC
 * - Track working minutes, not elapsed time
 * - Maintenance windows = blocked time on work centers
 * - Luxon weekday: 1=Mon...7=Sun; Spec dayOfWeek: 0=Sun...6=Sat
 */

import { DateTime } from 'luxon';

export interface Shift {
  dayOfWeek: number;  // 0=Sunday...6=Saturday
  startHour: number;  // 0-23
  endHour: number;    // 0-23
}

/**
 * Parse ISO date string to Luxon DateTime (UTC).
 */
export function parseDate(isoString: string): DateTime {
  return DateTime.fromISO(isoString, { zone: 'utc' });
}

/**
 * Format DateTime to ISO string.
 */
export function formatDate(date: DateTime): string {
  return date.toISO()!;
}

/**
 * Convert Luxon weekday (1=Mon...7=Sun) to spec dayOfWeek (0=Sun...6=Sat).
 */
export function luxonToSpecDayOfWeek(luxonWeekday: number): number {
  return luxonWeekday % 7;
}

/**
 * Get shift for a specific day of week.
 */
export function getShiftForDay(dayOfWeek: number, shifts: Shift[]): Shift | undefined {
  return shifts.find(s => s.dayOfWeek === dayOfWeek);
}

/**
 * Check if a DateTime is within shift hours.
 */
export function isWithinShift(date: DateTime, shifts: Shift[]): boolean {
  const dayOfWeek = luxonToSpecDayOfWeek(date.weekday);
  const shift = getShiftForDay(dayOfWeek, shifts);

  if (!shift) {
    return false;
  }

  const hour = date.hour;
  return hour >= shift.startHour && hour < shift.endHour;
}

/**
 * Get remaining minutes in current shift.
 */
export function getRemainingShiftMinutes(date: DateTime, shifts: Shift[]): number {
  const dayOfWeek = luxonToSpecDayOfWeek(date.weekday);
  const shift = getShiftForDay(dayOfWeek, shifts);

  if (!shift) {
    return 0;
  }

  const shiftEnd = date.set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 });
  const diff = shiftEnd.diff(date, 'minutes').minutes;
  return Math.max(0, Math.floor(diff));
}

/**
 * Get next shift start time from a given DateTime.
 */
export function getNextShiftStart(date: DateTime, shifts: Shift[]): DateTime {
  let current = date;
  const maxDays = 14; // Prevent infinite loop

  for (let i = 0; i < maxDays; i++) {
    const dayOfWeek = luxonToSpecDayOfWeek(current.weekday);
    const shift = getShiftForDay(dayOfWeek, shifts);

    if (shift) {
      const shiftStart = current.set({ hour: shift.startHour, minute: 0, second: 0, millisecond: 0 });
      const shiftEnd = current.set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 });

      // If current time is before shift start, return shift start
      if (current < shiftStart) {
        return shiftStart;
      }

      // If current time is within shift, return current time
      if (current >= shiftStart && current < shiftEnd) {
        return current;
      }
    }

    // Move to next day at midnight
    current = current.plus({ days: 1 }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  }

  // Fallback: no shift found, return original date
  return date;
}

/**
 * Calculate end date given start and working minutes, respecting shifts.
 */
export function calculateEndDateWithShifts(
  startDate: string,
  workingMinutes: number,
  shifts: Shift[]
): string {
  if (workingMinutes <= 0) {
    return startDate;
  }

  // If no shifts defined, fall back to simple calculation
  if (shifts.length === 0) {
    return calculateEndDate(startDate, workingMinutes);
  }

  let current = parseDate(startDate);
  let remaining = workingMinutes;

  // Move to next available shift time
  current = getNextShiftStart(current, shifts);

  while (remaining > 0) {
    const availableMinutes = getRemainingShiftMinutes(current, shifts);

    if (availableMinutes <= 0) {
      // Move to next shift
      current = current.plus({ minutes: 1 });
      current = getNextShiftStart(current, shifts);
      continue;
    }

    if (remaining <= availableMinutes) {
      current = current.plus({ minutes: remaining });
      remaining = 0;
    } else {
      remaining -= availableMinutes;
      current = current.plus({ minutes: availableMinutes });
      current = getNextShiftStart(current, shifts);
    }
  }

  return formatDate(current);
}

/**
 * Calculate end date given start and working minutes.
 * Simple version without shift logic.
 */
export function calculateEndDate(startDate: string, workingMinutes: number): string {
  const start = parseDate(startDate);
  const end = start.plus({ minutes: workingMinutes });
  return formatDate(end);
}
