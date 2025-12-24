import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../src/reflow/dependency-graph.js';
import { WorkOrder } from '../src/reflow/types.js';

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
