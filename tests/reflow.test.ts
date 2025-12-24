import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, calculateEndDate } from '../src/utils/date-utils.js';
import { ReflowService } from '../src/reflow/reflow.service.js';
import { DependencyGraph } from '../src/reflow/dependency-graph.js';
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
  });
});

describe('DependencyGraph', () => {
  const createWorkOrder = (
    id: string,
    dependsOn: string[] = []
  ): WorkOrder => ({
    docId: id,
    docType: 'workOrder',
    data: {
      workOrderNumber: id.toUpperCase(),
      manufacturingOrderId: 'mo-001',
      workCenterId: 'wc-001',
      startDate: '2025-01-06T08:00:00.000Z',
      endDate: '2025-01-06T10:00:00.000Z',
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: dependsOn,
    },
  });

  it('should build graph from work orders', () => {
    const graph = new DependencyGraph();
    graph.build([
      createWorkOrder('wo-001', []),
      createWorkOrder('wo-002', ['wo-001']),
      createWorkOrder('wo-003', ['wo-002']),
    ]);

    expect(graph.getDependencies('wo-001')).toEqual([]);
    expect(graph.getDependencies('wo-002')).toEqual(['wo-001']);
    expect(graph.getDependencies('wo-003')).toEqual(['wo-002']);
  });

  it('should track dependents', () => {
    const graph = new DependencyGraph();
    graph.build([
      createWorkOrder('wo-001', []),
      createWorkOrder('wo-002', ['wo-001']),
      createWorkOrder('wo-003', ['wo-001']),
    ]);

    expect(graph.getDependents('wo-001')).toEqual(['wo-002', 'wo-003']);
    expect(graph.getDependents('wo-002')).toEqual([]);
  });

  it('should perform topological sort', () => {
    const graph = new DependencyGraph();
    graph.build([
      createWorkOrder('wo-003', ['wo-002']),
      createWorkOrder('wo-001', []),
      createWorkOrder('wo-002', ['wo-001']),
    ]);

    const result = graph.topologicalSort();
    expect(result.hasCycle).toBe(false);
    expect(result.sorted).toEqual(['wo-001', 'wo-002', 'wo-003']);
  });

  it('should detect cycles', () => {
    const graph = new DependencyGraph();
    graph.build([
      createWorkOrder('wo-001', ['wo-003']),
      createWorkOrder('wo-002', ['wo-001']),
      createWorkOrder('wo-003', ['wo-002']),
    ]);

    const result = graph.topologicalSort();
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes).toContain('wo-001');
    expect(result.cycleNodes).toContain('wo-002');
    expect(result.cycleNodes).toContain('wo-003');
  });

  it('should detect if adding dependency would create cycle', () => {
    const graph = new DependencyGraph();
    graph.build([
      createWorkOrder('wo-001', []),
      createWorkOrder('wo-002', ['wo-001']),
      createWorkOrder('wo-003', ['wo-002']),
    ]);

    // Adding wo-001 -> wo-003 would create cycle
    expect(graph.wouldCreateCycle('wo-001', 'wo-003')).toBe(true);
    expect(graph.wouldCreateCycle('wo-003', 'wo-001')).toBe(false);
  });
});
