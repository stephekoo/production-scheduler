/**
 * Scenario 3: Maintenance Window
 *
 * Work center has scheduled maintenance that blocks work.
 * Work order must be rescheduled around maintenance window.
 *
 * Maintenance: Tuesday 10:00-14:00 (240 min blocked)
 *
 * WO-001: Starts Tuesday 08:00, duration 480 min (8 hours)
 *   - Tuesday 08:00-10:00 = 120 min (before maintenance)
 *   - Tuesday 10:00-14:00 = maintenance blocked
 *   - Tuesday 14:00-17:00 = 180 min
 *   - Wednesday 08:00-11:00 = 180 min
 *   - Total: 480 min
 *   - Expected end: Wednesday 11:00
 *
 * 2025-01-07 is Tuesday, 2025-01-08 is Wednesday
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
      startDate: '2025-01-07T08:00:00.000Z', // Tuesday 08:00
      endDate: '2025-01-07T16:00:00.000Z',   // Wrong - ignores maintenance
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
      ],
      maintenanceWindows: [
        {
          startDate: '2025-01-07T10:00:00.000Z', // Tuesday 10:00
          endDate: '2025-01-07T14:00:00.000Z',   // Tuesday 14:00
          reason: 'Scheduled maintenance',
        },
      ],
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
