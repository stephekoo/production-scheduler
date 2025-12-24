/**
 * Reflow Service - Main scheduling algorithm.
 */

import { WorkOrder, WorkCenter, ReflowInput, ReflowResult, ReflowChange } from './types.js';
import { calculateEndDate, parseDate } from '../utils/date-utils.js';

export class ReflowService {
  /**
   * Reflow work orders to produce a valid schedule.
   */
  reflow(input: ReflowInput): ReflowResult {
    const { workOrders, workCenters } = input;
    const changes: ReflowChange[] = [];
    const updatedWorkOrders: WorkOrder[] = [];

    for (const wo of workOrders) {
      // Skip maintenance orders - they cannot be rescheduled
      if (wo.data.isMaintenance) {
        updatedWorkOrders.push(this.cloneWorkOrder(wo));
        continue;
      }

      const originalStart = wo.data.startDate;
      const originalEnd = wo.data.endDate;

      // Recalculate end date based on duration
      const newEnd = calculateEndDate(originalStart, wo.data.durationMinutes);

      const updated = this.cloneWorkOrder(wo);
      updated.data.endDate = newEnd;
      updatedWorkOrders.push(updated);

      // Track if there was a change
      if (newEnd !== originalEnd) {
        const delayMinutes = this.calculateDelayMinutes(originalEnd, newEnd);
        changes.push({
          workOrderId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          originalStartDate: originalStart,
          originalEndDate: originalEnd,
          newStartDate: originalStart,
          newEndDate: newEnd,
          delayMinutes,
          reason: 'Recalculated end date based on duration',
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
