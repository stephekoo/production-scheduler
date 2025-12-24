import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, calculateEndDate } from '../src/utils/date-utils.js';

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
});
