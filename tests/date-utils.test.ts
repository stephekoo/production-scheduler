import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  calculateEndDate,
  calculateEndDateWithShifts,
  isWithinShift,
  getNextShiftStart,
  luxonToSpecDayOfWeek,
  Shift,
} from '../src/utils/date-utils.js';

describe('date-utils', () => {
  describe('parseDate', () => {
    it('should parse ISO date string to DateTime in UTC', () => {
      const date = parseDate('2025-01-06T08:00:00.000Z');
      expect(date.year).toBe(2025);
      expect(date.month).toBe(1);
      expect(date.day).toBe(6);
      expect(date.hour).toBe(8);
      expect(date.minute).toBe(0);
      expect(date.zoneName).toBe('UTC');
    });
  });

  describe('formatDate', () => {
    it('should format DateTime to ISO string', () => {
      const date = parseDate('2025-01-06T08:00:00.000Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2025-01-06T08:00:00.000Z');
    });
  });

  describe('calculateEndDate', () => {
    it('should add working minutes to start date', () => {
      const start = '2025-01-06T08:00:00.000Z';
      const end = calculateEndDate(start, 180); // 3 hours
      expect(end).toBe('2025-01-06T11:00:00.000Z');
    });

    it('should handle zero duration', () => {
      const start = '2025-01-06T08:00:00.000Z';
      const end = calculateEndDate(start, 0);
      expect(end).toBe('2025-01-06T08:00:00.000Z');
    });

    it('should handle duration spanning midnight', () => {
      const start = '2025-01-06T23:00:00.000Z';
      const end = calculateEndDate(start, 120); // 2 hours
      expect(end).toBe('2025-01-07T01:00:00.000Z');
    });
  });

  describe('luxonToSpecDayOfWeek', () => {
    it('should convert Luxon weekday to spec dayOfWeek', () => {
      // Luxon: 1=Mon...7=Sun
      // Spec: 0=Sun...6=Sat
      expect(luxonToSpecDayOfWeek(1)).toBe(1); // Mon
      expect(luxonToSpecDayOfWeek(5)).toBe(5); // Fri
      expect(luxonToSpecDayOfWeek(6)).toBe(6); // Sat
      expect(luxonToSpecDayOfWeek(7)).toBe(0); // Sun
    });
  });

  describe('isWithinShift', () => {
    const weekdayShifts: Shift[] = [
      { dayOfWeek: 1, startHour: 8, endHour: 17 }, // Mon
      { dayOfWeek: 2, startHour: 8, endHour: 17 }, // Tue
      { dayOfWeek: 3, startHour: 8, endHour: 17 }, // Wed
      { dayOfWeek: 4, startHour: 8, endHour: 17 }, // Thu
      { dayOfWeek: 5, startHour: 8, endHour: 17 }, // Fri
    ];

    it('should return true when within shift hours', () => {
      const date = parseDate('2025-01-06T10:00:00.000Z'); // Monday 10:00
      expect(isWithinShift(date, weekdayShifts)).toBe(true);
    });

    it('should return false before shift start', () => {
      const date = parseDate('2025-01-06T07:00:00.000Z'); // Monday 07:00
      expect(isWithinShift(date, weekdayShifts)).toBe(false);
    });

    it('should return false after shift end', () => {
      const date = parseDate('2025-01-06T18:00:00.000Z'); // Monday 18:00
      expect(isWithinShift(date, weekdayShifts)).toBe(false);
    });

    it('should return false on weekend', () => {
      const date = parseDate('2025-01-11T10:00:00.000Z'); // Saturday 10:00
      expect(isWithinShift(date, weekdayShifts)).toBe(false);
    });
  });

  describe('getNextShiftStart', () => {
    const weekdayShifts: Shift[] = [
      { dayOfWeek: 1, startHour: 8, endHour: 17 }, // Mon
      { dayOfWeek: 2, startHour: 8, endHour: 17 }, // Tue
      { dayOfWeek: 5, startHour: 8, endHour: 17 }, // Fri
    ];

    it('should return shift start if before shift', () => {
      const date = parseDate('2025-01-06T06:00:00.000Z'); // Monday 06:00
      const next = getNextShiftStart(date, weekdayShifts);
      expect(next.hour).toBe(8);
      expect(next.day).toBe(6);
    });

    it('should return current time if within shift', () => {
      const date = parseDate('2025-01-06T10:30:00.000Z'); // Monday 10:30
      const next = getNextShiftStart(date, weekdayShifts);
      expect(next.hour).toBe(10);
      expect(next.minute).toBe(30);
    });

    it('should skip to next day with shift after shift ends', () => {
      const date = parseDate('2025-01-06T18:00:00.000Z'); // Monday 18:00
      const next = getNextShiftStart(date, weekdayShifts);
      expect(next.day).toBe(7); // Tuesday
      expect(next.hour).toBe(8);
    });
  });

  describe('calculateEndDateWithShifts', () => {
    const weekdayShifts: Shift[] = [
      { dayOfWeek: 1, startHour: 8, endHour: 17 }, // Mon
      { dayOfWeek: 2, startHour: 8, endHour: 17 }, // Tue
      { dayOfWeek: 3, startHour: 8, endHour: 17 }, // Wed
      { dayOfWeek: 4, startHour: 8, endHour: 17 }, // Thu
      { dayOfWeek: 5, startHour: 8, endHour: 17 }, // Fri
    ];

    it('should calculate end within same shift', () => {
      const start = '2025-01-06T08:00:00.000Z'; // Monday 08:00
      const end = calculateEndDateWithShifts(start, 180, weekdayShifts); // 3 hours
      expect(end).toBe('2025-01-06T11:00:00.000Z');
    });

    it('should span to next day when work exceeds shift', () => {
      const start = '2025-01-06T14:00:00.000Z'; // Monday 14:00
      const end = calculateEndDateWithShifts(start, 480, weekdayShifts); // 8 hours
      // Monday 14:00-17:00 = 180 min, Tuesday 08:00-13:00 = 300 min
      expect(end).toBe('2025-01-07T13:00:00.000Z');
    });

    it('should skip weekend', () => {
      const start = '2025-01-10T14:00:00.000Z'; // Friday 14:00
      const end = calculateEndDateWithShifts(start, 480, weekdayShifts); // 8 hours
      // Friday 14:00-17:00 = 180 min, skip weekend, Monday 08:00-13:00 = 300 min
      expect(end).toBe('2025-01-13T13:00:00.000Z');
    });

    it('should handle zero duration', () => {
      const start = '2025-01-06T10:00:00.000Z';
      const end = calculateEndDateWithShifts(start, 0, weekdayShifts);
      expect(end).toBe('2025-01-06T10:00:00.000Z');
    });

    it('should fall back to simple calculation with no shifts', () => {
      const start = '2025-01-06T10:00:00.000Z';
      const end = calculateEndDateWithShifts(start, 180, []);
      expect(end).toBe('2025-01-06T13:00:00.000Z');
    });
  });
});
