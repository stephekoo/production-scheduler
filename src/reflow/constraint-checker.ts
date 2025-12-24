/**
 * Constraint Checker - Validates schedule for constraint violations.
 *
 * Validates:
 * - Dependencies: work order starts after all dependencies complete
 * - Work center conflicts: no overlapping work orders on same work center
 * - Shifts: work orders only scheduled during shift hours
 * - Maintenance windows: no work scheduled during maintenance
 */

import { WorkOrder, WorkCenter, ReflowInput } from './types.js';
import { parseDate, isWithinShift, Shift, MaintenanceWindow, isInMaintenanceWindow } from '../utils/date-utils.js';
import { DateTime } from 'luxon';

export interface ConstraintViolation {
  workOrderId: string;
  workOrderNumber: string;
  type: 'dependency' | 'work_center_conflict' | 'shift' | 'maintenance';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: ConstraintViolation[];
}

export class ConstraintChecker {
  /**
   * Validate a schedule for all constraint violations.
   */
  validate(input: ReflowInput): ValidationResult {
    const violations: ConstraintViolation[] = [];

    violations.push(...this.checkDependencies(input.workOrders));
    violations.push(...this.checkWorkCenterConflicts(input.workOrders));
    violations.push(...this.checkShifts(input.workOrders, input.workCenters));
    violations.push(...this.checkMaintenanceWindows(input.workOrders, input.workCenters));

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Check that all work orders start after their dependencies complete.
   */
  private checkDependencies(workOrders: WorkOrder[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const workOrderMap = new Map<string, WorkOrder>();

    for (const wo of workOrders) {
      workOrderMap.set(wo.docId, wo);
    }

    for (const wo of workOrders) {
      if (wo.data.isMaintenance) continue;

      const woStart = parseDate(wo.data.startDate);

      for (const depId of wo.data.dependsOnWorkOrderIds) {
        const dep = workOrderMap.get(depId);
        if (dep) {
          const depEnd = parseDate(dep.data.endDate);
          if (woStart < depEnd) {
            violations.push({
              workOrderId: wo.docId,
              workOrderNumber: wo.data.workOrderNumber,
              type: 'dependency',
              message: `Starts before dependency ${dep.data.workOrderNumber} completes`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check that no work orders overlap on the same work center.
   */
  private checkWorkCenterConflicts(workOrders: WorkOrder[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const workCenterOrders = new Map<string, WorkOrder[]>();

    // Group by work center
    for (const wo of workOrders) {
      const orders = workCenterOrders.get(wo.data.workCenterId) ?? [];
      orders.push(wo);
      workCenterOrders.set(wo.data.workCenterId, orders);
    }

    // Check for overlaps within each work center
    for (const [, orders] of workCenterOrders) {
      for (let i = 0; i < orders.length; i++) {
        for (let j = i + 1; j < orders.length; j++) {
          const wo1 = orders[i];
          const wo2 = orders[j];

          const start1 = parseDate(wo1.data.startDate);
          const end1 = parseDate(wo1.data.endDate);
          const start2 = parseDate(wo2.data.startDate);
          const end2 = parseDate(wo2.data.endDate);

          if (this.overlaps(start1, end1, start2, end2)) {
            violations.push({
              workOrderId: wo2.docId,
              workOrderNumber: wo2.data.workOrderNumber,
              type: 'work_center_conflict',
              message: `Overlaps with ${wo1.data.workOrderNumber} on same work center`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check that work orders are scheduled within shift hours.
   */
  private checkShifts(workOrders: WorkOrder[], workCenters: WorkCenter[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const workCenterMap = new Map<string, WorkCenter>();

    for (const wc of workCenters) {
      workCenterMap.set(wc.docId, wc);
    }

    for (const wo of workOrders) {
      if (wo.data.isMaintenance) continue;

      const workCenter = workCenterMap.get(wo.data.workCenterId);
      if (!workCenter || workCenter.data.shifts.length === 0) continue;

      const shifts: Shift[] = workCenter.data.shifts;
      const start = parseDate(wo.data.startDate);
      const end = parseDate(wo.data.endDate);

      // Check if start is within shift
      if (!isWithinShift(start, shifts)) {
        violations.push({
          workOrderId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          type: 'shift',
          message: `Starts outside shift hours`,
        });
      }

      // Check if end is within shift (or at shift boundary)
      if (!this.isWithinOrAtShiftEnd(end, shifts)) {
        violations.push({
          workOrderId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          type: 'shift',
          message: `Ends outside shift hours`,
        });
      }
    }

    return violations;
  }

  private overlaps(start1: DateTime, end1: DateTime, start2: DateTime, end2: DateTime): boolean {
    return start1 < end2 && end1 > start2;
  }

  private isWithinOrAtShiftEnd(date: DateTime, shifts: Shift[]): boolean {
    // Allow being within shift or exactly at shift end
    if (isWithinShift(date, shifts)) return true;

    // Check if at exact shift end time
    const dayOfWeek = date.weekday % 7;
    const shift = shifts.find(s => s.dayOfWeek === dayOfWeek);
    if (shift && date.hour === shift.endHour && date.minute === 0) {
      return true;
    }

    return false;
  }

  /**
   * Check that no work orders overlap with maintenance windows.
   */
  private checkMaintenanceWindows(workOrders: WorkOrder[], workCenters: WorkCenter[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const workCenterMap = new Map<string, WorkCenter>();

    for (const wc of workCenters) {
      workCenterMap.set(wc.docId, wc);
    }

    for (const wo of workOrders) {
      if (wo.data.isMaintenance) continue;

      const workCenter = workCenterMap.get(wo.data.workCenterId);
      if (!workCenter || !workCenter.data.maintenanceWindows?.length) continue;

      const windows: MaintenanceWindow[] = workCenter.data.maintenanceWindows;
      const woStart = parseDate(wo.data.startDate);
      const woEnd = parseDate(wo.data.endDate);

      for (const window of windows) {
        const maintStart = parseDate(window.startDate);
        const maintEnd = parseDate(window.endDate);

        // Check if work order overlaps with maintenance window
        if (this.overlaps(woStart, woEnd, maintStart, maintEnd)) {
          violations.push({
            workOrderId: wo.docId,
            workOrderNumber: wo.data.workOrderNumber,
            type: 'maintenance',
            message: `Overlaps with maintenance window (${window.startDate} - ${window.endDate})`,
          });
        }
      }
    }

    return violations;
  }
}
