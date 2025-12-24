import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, calculateEndDate } from '../src/utils/date-utils.js';
import { ReflowService } from '../src/reflow/reflow.service.js';
import { WorkOrder, WorkCenter, ManufacturingOrder } from '../src/reflow/types.js';

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

describe('ReflowService', () => {
  const createWorkOrder = (
    id: string,
    startDate: string,
    endDate: string,
    durationMinutes: number,
    options: { isMaintenance?: boolean; dependsOnWorkOrderIds?: string[] } = {}
  ): WorkOrder => ({
    docId: id,
    docType: 'workOrder',
    data: {
      workOrderNumber: id.toUpperCase(),
      manufacturingOrderId: 'mo-001',
      workCenterId: 'wc-001',
      startDate,
      endDate,
      durationMinutes,
      isMaintenance: options.isMaintenance ?? false,
      dependsOnWorkOrderIds: options.dependsOnWorkOrderIds ?? [],
    },
  });

  const createWorkCenter = (id: string): WorkCenter => ({
    docId: id,
    docType: 'workCenter',
    data: {
      name: 'Test Work Center',
      shifts: [
        { dayOfWeek: 1, startHour: 8, endHour: 17 },
        { dayOfWeek: 2, startHour: 8, endHour: 17 },
        { dayOfWeek: 3, startHour: 8, endHour: 17 },
        { dayOfWeek: 4, startHour: 8, endHour: 17 },
        { dayOfWeek: 5, startHour: 8, endHour: 17 },
      ],
      maintenanceWindows: [],
    },
  });

  const createManufacturingOrder = (id: string): ManufacturingOrder => ({
    docId: id,
    docType: 'manufacturingOrder',
    data: {
      manufacturingOrderNumber: id.toUpperCase(),
      itemId: 'item-001',
      quantity: 100,
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  });

  describe('reflow', () => {
    it('should recalculate end date based on duration', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z', // Wrong end date
          180 // 3 hours = should end at 11:00
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].delayMinutes).toBe(60);
    });

    it('should not modify work orders with correct end dates', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T11:00:00.000Z', // Correct end date
          180
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.changes).toHaveLength(0);
    });

    it('should skip maintenance orders', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z', // Wrong end date
          180,
          { isMaintenance: true }
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // Maintenance orders should not be modified
      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T10:00:00.000Z');
      expect(result.changes).toHaveLength(0);
    });

    it('should handle empty work orders list', () => {
      const service = new ReflowService();
      const result = service.reflow({
        workOrders: [],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.updatedWorkOrders).toHaveLength(0);
      expect(result.changes).toHaveLength(0);
      expect(result.explanation).toBe('No changes required.');
    });

    it('should track negative delay when end date moves earlier', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T12:00:00.000Z', // End date too late
          120 // 2 hours = should end at 10:00
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T10:00:00.000Z');
      expect(result.changes[0].delayMinutes).toBe(-120);
    });
  });
});
