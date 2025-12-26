/**
 * Data structures as defined in the requirement document.
 *
 * Key considerations:
 * - All dates in UTC
 * - durationMinutes = working time, not elapsed time
 * - Maintenance windows = blocked time on work centers
 */

// Shift definition for work centers
export interface Shift {
  dayOfWeek: number;  // 0=Sunday...6=Saturday (Luxon uses 1=Mon...7=Sun, convert with weekday % 7)
  startHour: number;  // 0-23
  endHour: number;    // 0-23
}

// Maintenance window (blocked time on work center)
export interface MaintenanceWindow {
  startDate: string;
  endDate: string;
  reason?: string;
}

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
    setupTimeMinutes?: number;        // Setup time before production (counts as working time)
    priority?: number;                // 1-5, lower = higher priority, default 3
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
    shifts: Shift[];
    maintenanceWindows: MaintenanceWindow[];
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

// Schedule metrics for analysis
export interface ScheduleMetrics {
  totalDelayMinutes: number;          // Sum of all delays
  averageDelayMinutes: number;        // Average delay per rescheduled order
  maxDelayMinutes: number;            // Maximum single order delay
  workOrdersRescheduled: number;      // Count of orders with changed dates
  workOrdersUnchanged: number;        // Count of orders with same dates
  utilizationByWorkCenter: Map<string, number>; // (working min / available shift min)
}

export interface ReflowResult {
  updatedWorkOrders: WorkOrder[];
  changes: ReflowChange[];
  explanation: string;
  metrics: ScheduleMetrics;
}
