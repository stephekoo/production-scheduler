/**
 * Reflow Service - Main scheduling algorithm.
 *
 * Key considerations:
 * - All dates in UTC
 * - durationMinutes = working time, not elapsed time
 * - Dependencies must complete before dependent work can start
 * - Work center conflicts: higher priority wins, then earlier original start
 * - Shifts define when work can be performed
 *
 * Implemented from @upgrade: priority field (1-5, lower = higher priority, default 3)
 *
 * @upgrade Add backfilling to fill gaps left by pushed orders
 * @upgrade Add constraint satisfaction solver for optimal scheduling
 * @upgrade Support multi-work-center orders (order spans multiple centers)
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
   * Main reflow algorithm - reschedules work orders to resolve conflicts.
   *
   * Steps:
   * 1. Build dependency graph and detect cycles
   * 2. Sort work orders by priority (lower number = higher priority)
   * 3. Schedule maintenance first (fixed, never moves)
   * 4. For each work order: find earliest valid slot and schedule it
   */
  reflow(input: ReflowInput): ReflowResult {
    const { workOrders, workCenters } = input;

    // Step 1: Build dependency graph and detect cycles
    const cycleError = this.detectCycles(workOrders);
    if (cycleError) return cycleError;

    // Step 2: Sort by priority, then by start date
    const sortedOrders = this.sortByPriority(workOrders);

    // Step 3: Schedule maintenance first (fixed slots)
    const workCenterMap = this.buildWorkCenterMap(workCenters);
    const workCenterSlots = new Map<string, ScheduledSlot[]>();
    const updatedMap = new Map<string, WorkOrder>();
    this.scheduleMaintenanceOrders(workOrders, workCenterSlots, updatedMap);

    // Step 4: Schedule each work order in priority order
    const changes: ReflowChange[] = [];
    for (const wo of sortedOrders) {
      this.scheduleWorkOrder(wo, workCenterMap, workCenterSlots, updatedMap, changes);
    }

    // Build result
    const updatedWorkOrders = workOrders.map(wo => updatedMap.get(wo.docId)!);
    const metrics = this.calculateMetrics(workOrders, updatedWorkOrders, changes, workCenters, workCenterSlots);

    return {
      updatedWorkOrders,
      changes,
      explanation: this.buildExplanation(changes),
      metrics,
    };
  }

  // ============================================================
  // Step 1: Cycle Detection
  // ============================================================

  private detectCycles(workOrders: WorkOrder[]): ReflowResult | null {
    this.graph.build(workOrders);
    const sortResult = this.graph.topologicalSort();

    if (sortResult.hasCycle) {
      return {
        updatedWorkOrders: workOrders.map(wo => this.cloneWorkOrder(wo)),
        changes: [],
        explanation: `Cycle detected in dependencies: ${sortResult.cycleNodes?.join(' -> ')}`,
        metrics: this.emptyMetrics(),
      };
    }
    return null;
  }

  // ============================================================
  // Step 2: Priority Sorting
  // ============================================================

  private sortByPriority(workOrders: WorkOrder[]): WorkOrder[] {
    return [...workOrders]
      .filter(wo => !wo.data.isMaintenance)
      .sort((a, b) => {
        const aPriority = a.data.priority ?? 3;
        const bPriority = b.data.priority ?? 3;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return parseDate(a.data.startDate).toMillis() - parseDate(b.data.startDate).toMillis();
      });
  }

  // ============================================================
  // Step 3: Maintenance Scheduling (Fixed)
  // ============================================================

  private scheduleMaintenanceOrders(
    workOrders: WorkOrder[],
    workCenterSlots: Map<string, ScheduledSlot[]>,
    updatedMap: Map<string, WorkOrder>
  ): void {
    for (const wo of workOrders) {
      if (wo.data.isMaintenance) {
        updatedMap.set(wo.docId, this.cloneWorkOrder(wo));
        this.addSlot(workCenterSlots, wo.data.workCenterId, {
          workOrderId: wo.docId,
          start: parseDate(wo.data.startDate),
          end: parseDate(wo.data.endDate),
        });
      }
    }
  }

  // ============================================================
  // Step 4: Work Order Scheduling
  // ============================================================

  private scheduleWorkOrder(
    wo: WorkOrder,
    workCenterMap: Map<string, WorkCenter>,
    workCenterSlots: Map<string, ScheduledSlot[]>,
    updatedMap: Map<string, WorkOrder>,
    changes: ReflowChange[]
  ): void {
    const workCenter = workCenterMap.get(wo.data.workCenterId);
    const shifts: Shift[] = workCenter?.data.shifts ?? [];
    const maintenanceWindows: MaintenanceWindow[] = workCenter?.data.maintenanceWindows ?? [];

    // Find earliest start from dependencies
    const earliestStart = this.findEarliestStart(wo, updatedMap, shifts, maintenanceWindows);

    // Find available slot (no conflicts)
    const totalMinutes = wo.data.durationMinutes + (wo.data.setupTimeMinutes ?? 0);
    const slots = workCenterSlots.get(wo.data.workCenterId) ?? [];
    const { start, end } = this.findAvailableSlot(earliestStart, totalMinutes, slots, shifts, maintenanceWindows);

    // Update work order
    const updated = this.cloneWorkOrder(wo);
    updated.data.startDate = formatDate(start);
    updated.data.endDate = formatDate(end);
    updatedMap.set(wo.docId, updated);

    // Record slot
    this.addSlot(workCenterSlots, wo.data.workCenterId, { workOrderId: wo.docId, start, end });

    // Track change if any
    this.recordChange(wo, updated, start, updatedMap, changes);
  }

  private findEarliestStart(
    wo: WorkOrder,
    updatedMap: Map<string, WorkOrder>,
    shifts: Shift[],
    maintenanceWindows: MaintenanceWindow[]
  ): DateTime {
    let earliest = parseDate(wo.data.startDate);

    // Wait for all dependencies to complete
    for (const depId of this.graph.getDependencies(wo.docId)) {
      const depWo = updatedMap.get(depId);
      if (depWo) {
        const depEnd = parseDate(depWo.data.endDate);
        if (depEnd > earliest) earliest = depEnd;
      }
    }

    // Align to next available shift time
    return getNextAvailableTime(earliest, shifts, maintenanceWindows);
  }

  private findAvailableSlot(
    start: DateTime,
    totalMinutes: number,
    slots: ScheduledSlot[],
    shifts: Shift[],
    maintenanceWindows: MaintenanceWindow[]
  ): { start: DateTime; end: DateTime } {
    let proposedStart = start;
    let proposedEnd = parseDate(calculateEndDateWithShiftsAndMaintenance(
      formatDate(proposedStart), totalMinutes, shifts, maintenanceWindows
    ));

    // Push forward until no conflicts
    let hasConflict = true;
    while (hasConflict) {
      hasConflict = false;
      for (const slot of slots) {
        if (this.overlaps(proposedStart, proposedEnd, slot.start, slot.end)) {
          proposedStart = getNextAvailableTime(slot.end, shifts, maintenanceWindows);
          proposedEnd = parseDate(calculateEndDateWithShiftsAndMaintenance(
            formatDate(proposedStart), totalMinutes, shifts, maintenanceWindows
          ));
          hasConflict = true;
          break;
        }
      }
    }

    return { start: proposedStart, end: proposedEnd };
  }

  private recordChange(
    original: WorkOrder,
    updated: WorkOrder,
    newStart: DateTime,
    updatedMap: Map<string, WorkOrder>,
    changes: ReflowChange[]
  ): void {
    if (original.data.startDate === updated.data.startDate &&
        original.data.endDate === updated.data.endDate) {
      return;
    }

    const delayMinutes = this.calculateDelayMinutes(original.data.endDate, updated.data.endDate);
    let reason = 'Recalculated end date based on duration';

    if (newStart > parseDate(original.data.startDate)) {
      const pushedByDependency = this.graph.getDependencies(original.docId).some(depId => {
        const depWo = updatedMap.get(depId);
        return depWo && parseDate(depWo.data.endDate) > parseDate(original.data.startDate);
      });
      reason = pushedByDependency
        ? 'Pushed forward due to dependency completion'
        : 'Pushed forward due to work center conflict';
    }

    changes.push({
      workOrderId: original.docId,
      workOrderNumber: original.data.workOrderNumber,
      originalStartDate: original.data.startDate,
      originalEndDate: original.data.endDate,
      newStartDate: updated.data.startDate,
      newEndDate: updated.data.endDate,
      delayMinutes,
      reason,
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private buildWorkCenterMap(workCenters: WorkCenter[]): Map<string, WorkCenter> {
    const map = new Map<string, WorkCenter>();
    for (const wc of workCenters) map.set(wc.docId, wc);
    return map;
  }

  private addSlot(slots: Map<string, ScheduledSlot[]>, workCenterId: string, slot: ScheduledSlot): void {
    const existing = slots.get(workCenterId) ?? [];
    existing.push(slot);
    slots.set(workCenterId, existing);
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
