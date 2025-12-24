/**
 * Date utility functions using Luxon.
 *
 * Key considerations:
 * - All dates in UTC
 * - Track working minutes, not elapsed time
 * - Maintenance windows = blocked time on work centers
 */

import { DateTime } from 'luxon';

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
 * Calculate end date given start and working minutes.
 *
 * @param startDate - ISO date string (UTC)
 * @param workingMinutes - Working time required (not elapsed time)
 * @returns ISO date string for end time
 *
 * Note: This simplified version assumes continuous work.
 * Will be extended to handle shifts and maintenance windows.
 */
export function calculateEndDate(startDate: string, workingMinutes: number): string {
  const start = parseDate(startDate);
  const end = start.plus({ minutes: workingMinutes });
  return formatDate(end);
}
