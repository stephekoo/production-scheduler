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
import { Shift, MaintenanceWindow } from '../reflow/types.js';

// Re-export for convenience
export type { Shift, MaintenanceWindow };

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

/**
 * Check if a DateTime falls within any maintenance window.
 */
export function isInMaintenanceWindow(date: DateTime, windows: MaintenanceWindow[]): boolean {
  for (const window of windows) {
    const start = parseDate(window.startDate);
    const end = parseDate(window.endDate);
    if (date >= start && date < end) {
      return true;
    }
  }
  return false;
}

/**
 * Get the end of any maintenance window that the date falls within.
 */
export function getMaintenanceWindowEnd(date: DateTime, windows: MaintenanceWindow[]): DateTime | null {
  for (const window of windows) {
    const start = parseDate(window.startDate);
    const end = parseDate(window.endDate);
    if (date >= start && date < end) {
      return end;
    }
  }
  return null;
}

/**
 * Get next available work time, respecting both shifts and maintenance windows.
 */
export function getNextAvailableTime(
  date: DateTime,
  shifts: Shift[],
  maintenanceWindows: MaintenanceWindow[]
): DateTime {
  let current = date;
  const maxIterations = 1000; // Prevent infinite loop

  for (let i = 0; i < maxIterations; i++) {
    // First, align to shift if shifts are defined
    if (shifts.length > 0) {
      current = getNextShiftStart(current, shifts);
    }

    // Check if in maintenance window
    const maintenanceEnd = getMaintenanceWindowEnd(current, maintenanceWindows);
    if (maintenanceEnd) {
      current = maintenanceEnd;
      continue;
    }

    // Not in maintenance, we're good
    return current;
  }

  return date;
}

/**
 * Get available working minutes from current time until shift end or maintenance.
 */
export function getAvailableMinutes(
  date: DateTime,
  shifts: Shift[],
  maintenanceWindows: MaintenanceWindow[]
): number {
  // Get remaining shift minutes
  let available = shifts.length > 0 ? getRemainingShiftMinutes(date, shifts) : Infinity;

  // Check for upcoming maintenance window
  for (const window of maintenanceWindows) {
    const start = parseDate(window.startDate);
    if (start > date) {
      const minutesUntilMaintenance = Math.floor(start.diff(date, 'minutes').minutes);
      available = Math.min(available, minutesUntilMaintenance);
    }
  }

  return available === Infinity ? 1440 : available; // Default to 24 hours if no constraints
}

/**
 * Calculate end date respecting shifts and maintenance windows.
 */
export function calculateEndDateWithShiftsAndMaintenance(
  startDate: string,
  workingMinutes: number,
  shifts: Shift[],
  maintenanceWindows: MaintenanceWindow[]
): string {
  if (workingMinutes <= 0) {
    return startDate;
  }

  // If no constraints, fall back to simple calculation
  if (shifts.length === 0 && maintenanceWindows.length === 0) {
    return calculateEndDate(startDate, workingMinutes);
  }

  let current = parseDate(startDate);
  let remaining = workingMinutes;

  // Move to next available time
  current = getNextAvailableTime(current, shifts, maintenanceWindows);

  const maxIterations = 10000;
  for (let i = 0; i < maxIterations && remaining > 0; i++) {
    const availableMinutes = getAvailableMinutes(current, shifts, maintenanceWindows);

    if (availableMinutes <= 0) {
      current = current.plus({ minutes: 1 });
      current = getNextAvailableTime(current, shifts, maintenanceWindows);
      continue;
    }

    if (remaining <= availableMinutes) {
      current = current.plus({ minutes: remaining });
      remaining = 0;
    } else {
      remaining -= availableMinutes;
      current = current.plus({ minutes: availableMinutes });
      current = getNextAvailableTime(current, shifts, maintenanceWindows);
    }
  }

  return formatDate(current);
}
