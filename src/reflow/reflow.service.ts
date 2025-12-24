/**
 * Reflow Service - Main scheduling algorithm.
 *
 * Key considerations:
 * - All dates in UTC
 * - durationMinutes = working time, not elapsed time
 * - Dependencies must complete before dependent work can start
 * - Work center conflicts: earlier original start wins
 * - Shifts define when work can be performed
 */

import { WorkOrder, WorkCenter, ReflowInput, ReflowResult, ReflowChange, ScheduleMetrics } from './types.js';
import {
  calculateEndDateWithShiftsAndMaintenance,
  parseDate,
  Shift,
  MaintenanceWindow,
  getNextAvailableTime,
  formatDate,
} from '../utils/date-utils.js';
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
    const { workOrders, workCenters } = input;
    const changes: ReflowChange[] = [];
    const workOrderMap = new Map<string, WorkOrder>();
    const workCenterMap = new Map<string, WorkCenter>();

    // Build work center lookup
    for (const wc of workCenters) {
      workCenterMap.set(wc.docId, wc);
    }

    // Build dependency graph
    this.graph.build(workOrders);

    // Get topological order
    const sortResult = this.graph.topologicalSort();
    if (sortResult.hasCycle) {
      return {
        updatedWorkOrders: workOrders.map(wo => this.cloneWorkOrder(wo)),
        changes: [],
        explanation: `Cycle detected in dependencies: ${sortResult.cycleNodes?.join(' -> ')}`,
        metrics: this.emptyMetrics(),
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

      // Get work center shifts and maintenance windows
      const workCenter = workCenterMap.get(wo.data.workCenterId);
      const shifts: Shift[] = workCenter?.data.shifts ?? [];
      const maintenanceWindows: MaintenanceWindow[] = workCenter?.data.maintenanceWindows ?? [];

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

      // Align to next available time (respecting shifts and maintenance)
      earliestStart = getNextAvailableTime(earliestStart, shifts, maintenanceWindows);

      // Check for work center conflicts
      const workCenterId = wo.data.workCenterId;
      const slots = workCenterSlots.get(workCenterId) ?? [];

      // Calculate total working time (duration + setup time)
      const totalWorkingMinutes = wo.data.durationMinutes + (wo.data.setupTimeMinutes ?? 0);

      // Find earliest available slot that doesn't conflict
      let proposedStart = earliestStart;
      let proposedEnd = parseDate(calculateEndDateWithShiftsAndMaintenance(
        formatDate(proposedStart), totalWorkingMinutes, shifts, maintenanceWindows
      ));

      // Keep pushing forward until no conflicts
      let hasConflict = true;
      while (hasConflict) {
        hasConflict = false;
        for (const slot of slots) {
          if (this.overlaps(proposedStart, proposedEnd, slot.start, slot.end)) {
            // Push to after this slot
            proposedStart = slot.end;
            proposedStart = getNextAvailableTime(proposedStart, shifts, maintenanceWindows);
            proposedEnd = parseDate(calculateEndDateWithShiftsAndMaintenance(
              formatDate(proposedStart), totalWorkingMinutes, shifts, maintenanceWindows
            ));
            hasConflict = true;
            break;
          }
        }
      }

      const newStart = formatDate(proposedStart);
      const newEnd = formatDate(proposedEnd);

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

    // Calculate metrics
    const metrics = this.calculateMetrics(
      workOrders,
      updatedWorkOrders,
      changes,
      workCenters,
      workCenterSlots
    );

    return {
      updatedWorkOrders,
      changes,
      explanation: this.buildExplanation(changes),
      metrics,
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

  private emptyMetrics(): ScheduleMetrics {
    return {
      totalDelayMinutes: 0,
      averageDelayMinutes: 0,
      maxDelayMinutes: 0,
      workOrdersRescheduled: 0,
      workOrdersUnchanged: 0,
      utilizationByWorkCenter: new Map(),
    };
  }

  private calculateMetrics(
    originalWorkOrders: WorkOrder[],
    updatedWorkOrders: WorkOrder[],
    changes: ReflowChange[],
    workCenters: WorkCenter[],
    workCenterSlots: Map<string, ScheduledSlot[]>
  ): ScheduleMetrics {
    // Calculate delay metrics
    const delays = changes.map(c => c.delayMinutes).filter(d => d > 0);
    const totalDelayMinutes = delays.reduce((sum, d) => sum + d, 0);
    const averageDelayMinutes = delays.length > 0 ? totalDelayMinutes / delays.length : 0;
    const maxDelayMinutes = delays.length > 0 ? Math.max(...delays) : 0;

    // Count rescheduled vs unchanged
    const workOrdersRescheduled = changes.length;
    const workOrdersUnchanged = originalWorkOrders.filter(wo => !wo.data.isMaintenance).length - workOrdersRescheduled;

    // Calculate utilization by work center
    const utilizationByWorkCenter = new Map<string, number>();

    for (const wc of workCenters) {
      const slots = workCenterSlots.get(wc.docId) ?? [];
      if (slots.length === 0) {
        utilizationByWorkCenter.set(wc.docId, 0);
        continue;
      }

      // Calculate total working minutes scheduled
      let totalWorkingMinutes = 0;
      for (const slot of slots) {
        const wo = updatedWorkOrders.find(w => w.docId === slot.workOrderId);
        if (wo && !wo.data.isMaintenance) {
          totalWorkingMinutes += wo.data.durationMinutes + (wo.data.setupTimeMinutes ?? 0);
        }
      }

      // Calculate available shift minutes (simplified: assume 1 week)
      const shiftsPerWeek = wc.data.shifts.length;
      const hoursPerShift = wc.data.shifts[0]
        ? wc.data.shifts[0].endHour - wc.data.shifts[0].startHour
        : 0;
      const availableMinutesPerWeek = shiftsPerWeek * hoursPerShift * 60;

      const utilization = availableMinutesPerWeek > 0
        ? totalWorkingMinutes / availableMinutesPerWeek
        : 0;
      utilizationByWorkCenter.set(wc.docId, Math.round(utilization * 100) / 100);
    }

    return {
      totalDelayMinutes,
      averageDelayMinutes: Math.round(averageDelayMinutes),
      maxDelayMinutes,
      workOrdersRescheduled,
      workOrdersUnchanged,
      utilizationByWorkCenter,
    };
  }
}
