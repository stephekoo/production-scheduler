/**
 * Reflow Service - Main scheduling algorithm.
 *
 * Key considerations:
 * - All dates in UTC
 * - durationMinutes = working time, not elapsed time
 * - Dependencies must complete before dependent work can start
 */

import { WorkOrder, ReflowInput, ReflowResult, ReflowChange } from './types.js';
import { calculateEndDate, parseDate } from '../utils/date-utils.js';
import { DependencyGraph } from './dependency-graph.js';

export class ReflowService {
  private graph = new DependencyGraph();

  /**
   * Reflow work orders to produce a valid schedule.
   */
  reflow(input: ReflowInput): ReflowResult {
    const { workOrders } = input;
    const changes: ReflowChange[] = [];
    const updatedWorkOrders: WorkOrder[] = [];
    const workOrderMap = new Map<string, WorkOrder>();

    // Build dependency graph
    this.graph.build(workOrders);

    // Get topological order
    const sortResult = this.graph.topologicalSort();
    if (sortResult.hasCycle) {
      return {
        updatedWorkOrders: workOrders.map(wo => this.cloneWorkOrder(wo)),
        changes: [],
        explanation: `Cycle detected in dependencies: ${sortResult.cycleNodes?.join(' -> ')}`,
      };
    }

    // Create lookup map
    for (const wo of workOrders) {
      workOrderMap.set(wo.docId, wo);
    }

    // Map to store updated work orders for dependency lookups
    const updatedMap = new Map<string, WorkOrder>();

    // Process in topological order
    for (const woId of sortResult.sorted) {
      const wo = workOrderMap.get(woId)!;

      // Skip maintenance orders - they cannot be rescheduled
      if (wo.data.isMaintenance) {
        const cloned = this.cloneWorkOrder(wo);
        updatedWorkOrders.push(cloned);
        updatedMap.set(woId, cloned);
        continue;
      }

      const originalStart = wo.data.startDate;
      const originalEnd = wo.data.endDate;

      // Calculate earliest start based on dependencies
      let earliestStart = parseDate(originalStart);
      const dependencies = this.graph.getDependencies(woId);

      for (const depId of dependencies) {
        const depWo = updatedMap.get(depId);
        if (depWo) {
          const depEnd = parseDate(depWo.data.endDate);
          if (depEnd > earliestStart) {
            earliestStart = depEnd;
          }
        }
      }

      const newStart = earliestStart.toISO()!;
      const newEnd = calculateEndDate(newStart, wo.data.durationMinutes);

      const updated = this.cloneWorkOrder(wo);
      updated.data.startDate = newStart;
      updated.data.endDate = newEnd;
      updatedWorkOrders.push(updated);
      updatedMap.set(woId, updated);

      // Track if there was a change
      if (newStart !== originalStart || newEnd !== originalEnd) {
        const delayMinutes = this.calculateDelayMinutes(originalEnd, newEnd);
        let reason = 'Recalculated end date based on duration';
        if (newStart !== originalStart) {
          reason = 'Pushed forward due to dependency completion';
        }
        changes.push({
          workOrderId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          originalStartDate: originalStart,
          originalEndDate: originalEnd,
          newStartDate: newStart,
          newEndDate: newEnd,
          delayMinutes,
          reason,
        });
      }
    }

    return {
      updatedWorkOrders,
      changes,
      explanation: this.buildExplanation(changes),
    };
  }

  private cloneWorkOrder(wo: WorkOrder): WorkOrder {
    return {
      docId: wo.docId,
      docType: wo.docType,
      data: { ...wo.data },
    };
  }

  private calculateDelayMinutes(originalEnd: string, newEnd: string): number {
    const original = parseDate(originalEnd);
    const updated = parseDate(newEnd);
    return Math.round(updated.diff(original, 'minutes').minutes);
  }

  private buildExplanation(changes: ReflowChange[]): string {
    if (changes.length === 0) {
      return 'No changes required.';
    }
    return `Rescheduled ${changes.length} work order(s).`;
  }
}
