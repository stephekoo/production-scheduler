/**
 * Scenario 0: Basic reflow test.
 * Simple test to verify endDate recalculation works.
 */

import { WorkOrder, WorkCenter, ManufacturingOrder } from '../reflow/types.js';

// Work Center: Extrusion Line 1, Mon-Fri 8AM-5PM
export const workCenters: WorkCenter[] = [
  {
    docId: 'wc-001',
    docType: 'workCenter',
    data: {
      name: 'Extrusion Line 1',
      shifts: [
        { dayOfWeek: 1, startHour: 8, endHour: 17 }, // Monday
        { dayOfWeek: 2, startHour: 8, endHour: 17 }, // Tuesday
        { dayOfWeek: 3, startHour: 8, endHour: 17 }, // Wednesday
        { dayOfWeek: 4, startHour: 8, endHour: 17 }, // Thursday
        { dayOfWeek: 5, startHour: 8, endHour: 17 }, // Friday
      ],
      maintenanceWindows: [],
    },
  },
];

// Work Orders: Two simple orders, may conflict on same work center
export const workOrders: WorkOrder[] = [
  {
    docId: 'wo-001',
    docType: 'workOrder',
    data: {
      workOrderNumber: 'WO-001',
      manufacturingOrderId: 'mo-001',
      workCenterId: 'wc-001',
      startDate: '2025-01-06T08:00:00.000Z', // Monday 8AM
      endDate: '2025-01-06T10:00:00.000Z',   // Wrong: should be 11AM (180 min)
      durationMinutes: 180,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  },
  {
    docId: 'wo-002',
    docType: 'workOrder',
    data: {
      workOrderNumber: 'WO-002',
      manufacturingOrderId: 'mo-001',
      workCenterId: 'wc-001',
      startDate: '2025-01-06T10:00:00.000Z', // Monday 10AM - will conflict!
      endDate: '2025-01-06T12:00:00.000Z',
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  },
];

export const manufacturingOrders: ManufacturingOrder[] = [
  {
    docId: 'mo-001',
    docType: 'manufacturingOrder',
    data: {
      manufacturingOrderNumber: 'MO-001',
      itemId: 'item-001',
      quantity: 100,
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  },
];
