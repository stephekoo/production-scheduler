import { describe, it, expect } from 'vitest';
import { ConstraintChecker } from '../src/reflow/constraint-checker.js';
import { WorkOrder, WorkCenter, ManufacturingOrder } from '../src/reflow/types.js';

describe('ConstraintChecker', () => {
  const createWorkOrder = (
    id: string,
    startDate: string,
    endDate: string,
    options: { workCenterId?: string; dependsOnWorkOrderIds?: string[] } = {}
  ): WorkOrder => ({
    docId: id,
    docType: 'workOrder',
    data: {
      workOrderNumber: id.toUpperCase(),
      manufacturingOrderId: 'mo-001',
      workCenterId: options.workCenterId ?? 'wc-001',
      startDate,
      endDate,
      durationMinutes: 120,
      isMaintenance: false,
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

  describe('validate', () => {
    it('should return valid for correct schedule', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T08:00:00.000Z', '2025-01-06T10:00:00.000Z'),
          createWorkOrder('wo-002', '2025-01-06T10:00:00.000Z', '2025-01-06T12:00:00.000Z', {
            dependsOnWorkOrderIds: ['wo-001'],
          }),
        ],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect dependency violation', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T08:00:00.000Z', '2025-01-06T11:00:00.000Z'),
          createWorkOrder('wo-002', '2025-01-06T10:00:00.000Z', '2025-01-06T12:00:00.000Z', {
            dependsOnWorkOrderIds: ['wo-001'],
          }),
        ],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.type === 'dependency')).toBe(true);
    });

    it('should detect work center conflict', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T08:00:00.000Z', '2025-01-06T11:00:00.000Z'),
          createWorkOrder('wo-002', '2025-01-06T10:00:00.000Z', '2025-01-06T12:00:00.000Z'),
        ],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.type === 'work_center_conflict')).toBe(true);
    });

    it('should not detect conflict on different work centers', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T08:00:00.000Z', '2025-01-06T11:00:00.000Z', {
            workCenterId: 'wc-001',
          }),
          createWorkOrder('wo-002', '2025-01-06T10:00:00.000Z', '2025-01-06T12:00:00.000Z', {
            workCenterId: 'wc-002',
          }),
        ],
        workCenters: [createWorkCenter('wc-001'), createWorkCenter('wc-002')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(true);
    });

    it('should detect shift violation for start outside shift', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T06:00:00.000Z', '2025-01-06T08:00:00.000Z'),
        ],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.type === 'shift')).toBe(true);
    });

    it('should detect shift violation for end outside shift', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T16:00:00.000Z', '2025-01-06T19:00:00.000Z'),
        ],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.type === 'shift')).toBe(true);
    });

    it('should allow work ending exactly at shift end', () => {
      const checker = new ConstraintChecker();
      const result = checker.validate({
        workOrders: [
          createWorkOrder('wo-001', '2025-01-06T15:00:00.000Z', '2025-01-06T17:00:00.000Z'),
        ],
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [],
      });

      expect(result.valid).toBe(true);
    });
  });
});
