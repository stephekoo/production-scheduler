import { describe, it, expect } from 'vitest';
import { ReflowService } from '../src/reflow/reflow.service.js';
import { WorkOrder, WorkCenter, ManufacturingOrder } from '../src/reflow/types.js';

describe('ReflowService', () => {
  const createWorkOrder = (
    id: string,
    startDate: string,
    endDate: string,
    durationMinutes: number,
    options: { isMaintenance?: boolean; dependsOnWorkOrderIds?: string[]; priority?: number } = {}
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
      priority: options.priority,
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

    it('should push dependent work order when dependency ends later', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z',
          180, // 3 hours = ends at 11:00
          { dependsOnWorkOrderIds: [] }
        ),
        createWorkOrder(
          'wo-002',
          '2025-01-06T10:00:00.000Z', // Starts at 10:00, but wo-001 ends at 11:00
          '2025-01-06T12:00:00.000Z',
          120,
          { dependsOnWorkOrderIds: ['wo-001'] }
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // WO-001 ends at 11:00, so WO-002 must start at 11:00
      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.startDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.endDate).toBe('2025-01-06T13:00:00.000Z');
    });

    it('should cascade delays through dependency chain', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z',
          180, // 3 hours = 1 hour delay
          { dependsOnWorkOrderIds: [] }
        ),
        createWorkOrder(
          'wo-002',
          '2025-01-06T10:00:00.000Z',
          '2025-01-06T12:00:00.000Z',
          120,
          { dependsOnWorkOrderIds: ['wo-001'] }
        ),
        createWorkOrder(
          'wo-003',
          '2025-01-06T12:00:00.000Z',
          '2025-01-06T14:00:00.000Z',
          120,
          { dependsOnWorkOrderIds: ['wo-002'] }
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // All three should be delayed by 1 hour
      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.startDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.endDate).toBe('2025-01-06T13:00:00.000Z');
      expect(result.updatedWorkOrders[2].data.startDate).toBe('2025-01-06T13:00:00.000Z');
      expect(result.updatedWorkOrders[2].data.endDate).toBe('2025-01-06T15:00:00.000Z');
    });

    it('should detect cycles in dependencies', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z',
          120,
          { dependsOnWorkOrderIds: ['wo-002'] }
        ),
        createWorkOrder(
          'wo-002',
          '2025-01-06T10:00:00.000Z',
          '2025-01-06T12:00:00.000Z',
          120,
          { dependsOnWorkOrderIds: ['wo-001'] }
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      expect(result.explanation).toContain('Cycle detected');
    });

    it('should resolve work center conflicts (earlier original start wins)', () => {
      const service = new ReflowService();
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z',
          180 // 3 hours = ends at 11:00
        ),
        createWorkOrder(
          'wo-002',
          '2025-01-06T10:00:00.000Z', // Starts at 10:00 but WO-001 ends at 11:00
          '2025-01-06T12:00:00.000Z',
          120
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // WO-001 ends at 11:00, WO-002 must start at 11:00 due to conflict
      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.startDate).toBe('2025-01-06T11:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.endDate).toBe('2025-01-06T13:00:00.000Z');
      expect(result.changes.some(c => c.reason.includes('work center conflict'))).toBe(true);
    });

    it('should not conflict work orders on different work centers', () => {
      const service = new ReflowService();
      const workOrders = [
        {
          docId: 'wo-001',
          docType: 'workOrder' as const,
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-001',
            startDate: '2025-01-06T08:00:00.000Z',
            endDate: '2025-01-06T11:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-002',
          docType: 'workOrder' as const,
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-002', // Different work center
            startDate: '2025-01-06T09:00:00.000Z',
            endDate: '2025-01-06T11:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001'), createWorkCenter('wc-002')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // No conflict - different work centers
      expect(result.updatedWorkOrders[0].data.startDate).toBe('2025-01-06T08:00:00.000Z');
      expect(result.updatedWorkOrders[1].data.startDate).toBe('2025-01-06T09:00:00.000Z');
      expect(result.changes).toHaveLength(0);
    });

    it('should handle work order scheduled on day with no shifts', () => {
      const service = new ReflowService();
      // Saturday has no shift defined (only Mon-Fri)
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-11T08:00:00.000Z', // Saturday
          '2025-01-11T10:00:00.000Z',
          120
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // Should push to next available shift (Monday)
      expect(result.updatedWorkOrders[0].data.startDate).toBe('2025-01-13T08:00:00.000Z');
      expect(result.changes).toHaveLength(1);
    });

    it('should handle work order starting outside shift hours', () => {
      const service = new ReflowService();
      // Work order starts at 6AM, before shift starts at 8AM
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T06:00:00.000Z',
          '2025-01-06T08:00:00.000Z',
          120
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // Should align to shift start
      expect(result.updatedWorkOrders[0].data.startDate).toBe('2025-01-06T08:00:00.000Z');
      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T10:00:00.000Z');
    });

    it('should skip maintenance window during scheduling', () => {
      const service = new ReflowService();
      const workCenter: WorkCenter = {
        docId: 'wc-001',
        docType: 'workCenter',
        data: {
          name: 'Test Work Center',
          shifts: [
            { dayOfWeek: 1, startHour: 8, endHour: 17 },
            { dayOfWeek: 2, startHour: 8, endHour: 17 },
          ],
          maintenanceWindows: [
            {
              startDate: '2025-01-06T10:00:00.000Z',
              endDate: '2025-01-06T14:00:00.000Z',
            },
          ],
        },
      };

      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T12:00:00.000Z',
          240 // 4 hours
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [workCenter],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // 8:00-10:00 = 2 hours, skip 10:00-14:00 maintenance, 14:00-16:00 = 2 hours
      expect(result.updatedWorkOrders[0].data.endDate).toBe('2025-01-06T16:00:00.000Z');
    });

    it('should schedule higher priority orders first (lower number = higher priority)', () => {
      const service = new ReflowService();
      // Both have same start time, but different priorities
      // WO-001 appears first in list but has lower priority
      const workOrders = [
        createWorkOrder(
          'wo-001',
          '2025-01-06T08:00:00.000Z',
          '2025-01-06T10:00:00.000Z',
          120,
          { priority: 5 } // Low priority
        ),
        createWorkOrder(
          'wo-002',
          '2025-01-06T08:00:00.000Z', // Same start time
          '2025-01-06T10:00:00.000Z',
          120,
          { priority: 1 } // High priority
        ),
      ];

      const result = service.reflow({
        workOrders,
        workCenters: [createWorkCenter('wc-001')],
        manufacturingOrders: [createManufacturingOrder('mo-001')],
      });

      // WO-002 (priority 1) should be scheduled first at 08:00-10:00
      // WO-001 (priority 5) should be pushed to 10:00-12:00 due to conflict
      expect(result.updatedWorkOrders.find(wo => wo.docId === 'wo-002')?.data.startDate).toBe('2025-01-06T08:00:00.000Z');
      expect(result.updatedWorkOrders.find(wo => wo.docId === 'wo-001')?.data.startDate).toBe('2025-01-06T10:00:00.000Z');
    });
  });
});
