/**
 * Data structures as defined in the requirement document.
 */

// Work Order
export interface WorkOrder {
  docId: string;
  docType: 'workOrder';
  data: {
    workOrderNumber: string;
    manufacturingOrderId: string;
    workCenterId: string;
    startDate: string;
    endDate: string;
    durationMinutes: number;
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
