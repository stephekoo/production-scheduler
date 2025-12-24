/**
 * Reflow Service - Main scheduling algorithm.
 *
 * Key considerations:
 * - All dates in UTC
 * - durationMinutes = working time, not elapsed time
 * - Dependencies must complete before dependent work can start
 * - Work center conflicts: earlier original start wins
 */

import { WorkOrder, ReflowInput, ReflowResult, ReflowChange } from './types.js';
import { calculateEndDate, parseDate } from '../utils/date-utils.js';
import { DependencyGraph } from './dependency-graph.js';
import { DateTime } from 'luxon';

interface ScheduledSlot {
  workOrderId: string;
  start: DateTime;
  end: DateTime;
}

export class ReflowService {
  private graph = new DependencyGraph();

  /**
   * Reflow work orders to produce a valid schedule.
   */
  reflow(input: ReflowInput): ReflowResult {
    const { workOrders } = input;
    const changes: ReflowChange[] = [];
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

    // Sort by original start date for priority (earlier original start wins)
    const sortedByOriginalStart = [...workOrders]
      .filter(wo => !wo.data.isMaintenance)
      .sort((a, b) => {
        const aStart = parseDate(a.data.startDate);
        const bStart = parseDate(b.data.startDate);
        return aStart.toMillis() - bStart.toMillis();
      });

    // Track scheduled slots per work center
    const workCenterSlots = new Map<string, ScheduledSlot[]>();

    // Map to store updated work orders
    const updatedMap = new Map<string, WorkOrder>();

    // First, schedule maintenance orders (they are fixed)
    for (const wo of workOrders) {
      if (wo.data.isMaintenance) {
        const cloned = this.cloneWorkOrder(wo);
        updatedMap.set(wo.docId, cloned);

        // Add to work center slots
        const slots = workCenterSlots.get(wo.data.workCenterId) ?? [];
        slots.push({
          workOrderId: wo.docId,
          start: parseDate(wo.data.startDate),
          end: parseDate(wo.data.endDate),
        });
        workCenterSlots.set(wo.data.workCenterId, slots);
      }
    }

    // Process in priority order (earlier original start wins)
    for (const wo of sortedByOriginalStart) {
      const originalStart = wo.data.startDate;
      const originalEnd = wo.data.endDate;

      // Calculate earliest start based on dependencies
      let earliestStart = parseDate(originalStart);
      const dependencies = this.graph.getDependencies(wo.docId);

      for (const depId of dependencies) {
        const depWo = updatedMap.get(depId);
        if (depWo) {
          const depEnd = parseDate(depWo.data.endDate);
          if (depEnd > earliestStart) {
            earliestStart = depEnd;
          }
        }
      }

      // Check for work center conflicts
      const workCenterId = wo.data.workCenterId;
      const slots = workCenterSlots.get(workCenterId) ?? [];

      // Find earliest available slot that doesn't conflict
      let proposedStart = earliestStart;
      let proposedEnd = parseDate(calculateEndDate(proposedStart.toISO()!, wo.data.durationMinutes));

      // Keep pushing forward until no conflicts
      let hasConflict = true;
      while (hasConflict) {
        hasConflict = false;
        for (const slot of slots) {
          if (this.overlaps(proposedStart, proposedEnd, slot.start, slot.end)) {
            // Push to after this slot
            proposedStart = slot.end;
            proposedEnd = parseDate(calculateEndDate(proposedStart.toISO()!, wo.data.durationMinutes));
            hasConflict = true;
            break;
          }
        }
      }

      const newStart = proposedStart.toISO()!;
      const newEnd = proposedEnd.toISO()!;

      const updated = this.cloneWorkOrder(wo);
      updated.data.startDate = newStart;
      updated.data.endDate = newEnd;
      updatedMap.set(wo.docId, updated);

      // Add to work center slots
      slots.push({
        workOrderId: wo.docId,
        start: proposedStart,
        end: proposedEnd,
      });
      workCenterSlots.set(workCenterId, slots);

      // Track if there was a change
      if (newStart !== originalStart || newEnd !== originalEnd) {
        const delayMinutes = this.calculateDelayMinutes(originalEnd, newEnd);
        let reason = 'Recalculated end date based on duration';
        if (proposedStart > parseDate(originalStart)) {
          const depPushed = dependencies.some(depId => {
            const depWo = updatedMap.get(depId);
            return depWo && parseDate(depWo.data.endDate) > parseDate(originalStart);
          });
          if (depPushed) {
            reason = 'Pushed forward due to dependency completion';
          } else {
            reason = 'Pushed forward due to work center conflict';
          }
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

    // Build final list maintaining original order
    const updatedWorkOrders = workOrders.map(wo => updatedMap.get(wo.docId)!);

    return {
      updatedWorkOrders,
      changes,
      explanation: this.buildExplanation(changes),
    };
  }

  private overlaps(start1: DateTime, end1: DateTime, start2: DateTime, end2: DateTime): boolean {
    return start1 < end2 && end1 > start2;
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
