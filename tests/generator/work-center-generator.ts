/**
 * Work Center Generator
 *
 * Generates work centers with realistic shift schedules and maintenance windows.
 */

import { WorkCenter } from '../../src/reflow/types.js';
import { SeededRandom } from './random.js';
import { DateTime } from 'luxon';

const WORK_CENTER_PREFIXES = [
  'Assembly Line',
  'CNC Machine',
  'Extrusion Line',
  'Welding Station',
  'Packaging Unit',
  'Quality Control',
  'Paint Booth',
  'Molding Press',
  'Cutting Station',
  'Finishing Line',
];

export interface WorkCenterGeneratorConfig {
  count: number;
  baseDate: DateTime;
  maintenanceProbability: number; // 0-1, probability of having maintenance windows
}

/**
 * Generate work centers with shifts and optional maintenance windows.
 */
export function generateWorkCenters(
  rng: SeededRandom,
  config: WorkCenterGeneratorConfig
): WorkCenter[] {
  const workCenters: WorkCenter[] = [];

  for (let i = 0; i < config.count; i++) {
    const prefix = rng.pick(WORK_CENTER_PREFIXES);
    const number = Math.floor(i / WORK_CENTER_PREFIXES.length) + 1;
    const suffix = i % WORK_CENTER_PREFIXES.length + 1;
    const name = `${prefix} ${number > 1 ? `${number}-` : ''}${suffix}`;

    // Generate shifts (Mon-Fri, with slight variations)
    const shifts = generateShifts(rng);

    // Optionally add maintenance windows
    const maintenanceWindows = rng.nextBool(config.maintenanceProbability)
      ? generateMaintenanceWindows(rng, config.baseDate)
      : [];

    workCenters.push({
      docId: `wc-${String(i + 1).padStart(3, '0')}`,
      docType: 'workCenter',
      data: {
        name,
        shifts,
        maintenanceWindows,
      },
    });
  }

  return workCenters;
}

/**
 * Generate shift schedule (Mon-Fri with some variation).
 */
function generateShifts(rng: SeededRandom) {
  const shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }> = [];

  // Base shift hours (with slight random variation)
  const baseStart = rng.nextInt(6, 9); // 6am-9am start
  const baseEnd = rng.nextInt(16, 19); // 4pm-7pm end

  // Monday through Friday (dayOfWeek: 1-5)
  for (let day = 1; day <= 5; day++) {
    // Some work centers might not work all days
    if (rng.nextBool(0.95)) {
      // 95% chance of working this day
      shifts.push({
        dayOfWeek: day,
        startHour: baseStart,
        endHour: baseEnd,
      });
    }
  }

  // Some work centers work weekends (20% chance)
  if (rng.nextBool(0.2)) {
    // Saturday
    shifts.push({
      dayOfWeek: 6,
      startHour: baseStart,
      endHour: baseStart + 4, // Shorter Saturday shift
    });
  }

  return shifts;
}

/**
 * Generate maintenance windows within the scheduling period.
 */
function generateMaintenanceWindows(rng: SeededRandom, baseDate: DateTime) {
  const windows: Array<{ startDate: string; endDate: string; reason: string }> = [];
  const reasons = [
    'Scheduled maintenance',
    'Equipment calibration',
    'Safety inspection',
    'Deep cleaning',
    'Software update',
  ];

  // Generate 1-3 maintenance windows across 2 weeks
  const windowCount = rng.nextInt(1, 3);

  for (let i = 0; i < windowCount; i++) {
    // Random day within 2-week period
    const dayOffset = rng.nextInt(0, 13);
    const startHour = rng.nextInt(10, 14); // Mid-day maintenance
    const durationHours = rng.nextInt(2, 4);

    const start = baseDate.plus({ days: dayOffset }).set({
      hour: startHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const end = start.plus({ hours: durationHours });

    windows.push({
      startDate: start.toISO()!,
      endDate: end.toISO()!,
      reason: rng.pick(reasons),
    });
  }

  return windows;
}
