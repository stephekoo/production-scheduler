/**
 * Scenario 2: Shift Spanning
 *
 * Work order spans multiple shifts.
 * Work center operates Mon-Fri, 8:00-17:00 (9 hours per day = 540 min).
 *
 * WO-001: Starts Friday 14:00, duration 480 min (8 hours)
 *   - Friday 14:00-17:00 = 180 min
 *   - Saturday/Sunday = no shifts
 *   - Monday 08:00-13:00 = 300 min
 *   - Total: 480 min
 *   - Expected end: Monday 13:00
 *
 * 2025-01-10 is Friday, 2025-01-13 is Monday
 */

import { WorkOrder, WorkCenter, ManufacturingOrder } from '../reflow/types.js';

export const workOrders: WorkOrder[] = [
  {
    docId: 'wo-001',
    docType: 'workOrder',
    data: {
      workOrderNumber: 'WO-001',
      manufacturingOrderId: 'mo-001',
      workCenterId: 'wc-001',
      startDate: '2025-01-10T14:00:00.000Z', // Friday 14:00
      endDate: '2025-01-10T22:00:00.000Z',   // Wrong - assumes continuous work
      durationMinutes: 480, // 8 hours of work
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  },
];

export const workCenters: WorkCenter[] = [
  {
    docId: 'wc-001',
    docType: 'workCenter',
    data: {
      name: 'Assembly Line 1',
      shifts: [
        { dayOfWeek: 1, startHour: 8, endHour: 17 }, // Monday
        { dayOfWeek: 2, startHour: 8, endHour: 17 }, // Tuesday
        { dayOfWeek: 3, startHour: 8, endHour: 17 }, // Wednesday
        { dayOfWeek: 4, startHour: 8, endHour: 17 }, // Thursday
        { dayOfWeek: 5, startHour: 8, endHour: 17 }, // Friday
        // No Saturday (6) or Sunday (0)
      ],
      maintenanceWindows: [],
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
      dueDate: '2025-01-17T17:00:00.000Z',
    },
  },
];
