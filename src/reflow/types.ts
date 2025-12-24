/**
 * Data structures as defined in the requirement document.
 *
 * Key considerations:
 * - All dates in UTC
 * - durationMinutes = working time, not elapsed time
 * - Maintenance windows = blocked time on work centers
 */

// Work Order
export interface WorkOrder {
  docId: string;
  docType: 'workOrder';
  data: {
    workOrderNumber: string;
    manufacturingOrderId: string;
    workCenterId: string;
    startDate: string;                // UTC
    endDate: string;                  // UTC
    durationMinutes: number;          // Working time required (not elapsed)
    isMaintenance: boolean;
    dependsOnWorkOrderIds: string[];
  };
}

// Work Center
export interface WorkCenter {
  docId: string;
  docType: 'workCenter';
  data: {
    name: string;
    shifts: Array<{
      dayOfWeek: number;    // 0-6, Sunday = 0
      startHour: number;    // 0-23
      endHour: number;      // 0-23
    }>;
    maintenanceWindows: Array<{
      startDate: string;
      endDate: string;
      reason?: string;
    }>;
  };
}

// Manufacturing Order
export interface ManufacturingOrder {
  docId: string;
  docType: 'manufacturingOrder';
  data: {
    manufacturingOrderNumber: string;
    itemId: string;
    quantity: number;
    dueDate: string;
  };
}

// Reflow Input/Output
export interface ReflowInput {
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  manufacturingOrders: ManufacturingOrder[];
}

export interface ReflowChange {
  workOrderId: string;
  workOrderNumber: string;
  originalStartDate: string;
  originalEndDate: string;
  newStartDate: string;
  newEndDate: string;
  delayMinutes: number;
  reason: string;
}

export interface ReflowResult {
  updatedWorkOrders: WorkOrder[];
  changes: ReflowChange[];
  explanation: string;
}
