/**
 * Scenario 4: Multi-Constraint (Dependencies + Maintenance + Shifts)
 *
 * Complex scenario combining multiple constraints:
 * - WO-001 depends on nothing, starts Monday 08:00, 180 min
 * - WO-002 depends on WO-001, scheduled to start Monday 10:00, 240 min
 * - Maintenance blocks Monday 12:00-14:00
 * - Shifts: Mon-Fri 08:00-17:00
 *
 * Expected flow:
 * - WO-001: 08:00-11:00 (180 min) ✓
 * - WO-002: starts after WO-001 ends (11:00)
 *   - 11:00-12:00 = 60 min
 *   - 12:00-14:00 = maintenance blocked
 *   - 14:00-17:00 = 180 min (total 240 min)
 *   - Expected end: 17:00
 *
 * 2025-01-06 is Monday
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
      startDate: '2025-01-06T08:00:00.000Z',
      endDate: '2025-01-06T10:00:00.000Z', // Wrong - should be 11:00
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
      startDate: '2025-01-06T10:00:00.000Z', // Wrong - should start after WO-001
      endDate: '2025-01-06T14:00:00.000Z',   // Wrong - needs to skip maintenance
      durationMinutes: 240,
      isMaintenance: false,
      dependsOnWorkOrderIds: ['wo-001'],
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
        { dayOfWeek: 1, startHour: 8, endHour: 17 },
        { dayOfWeek: 2, startHour: 8, endHour: 17 },
        { dayOfWeek: 3, startHour: 8, endHour: 17 },
        { dayOfWeek: 4, startHour: 8, endHour: 17 },
        { dayOfWeek: 5, startHour: 8, endHour: 17 },
      ],
      maintenanceWindows: [
        {
          startDate: '2025-01-06T12:00:00.000Z',
          endDate: '2025-01-06T14:00:00.000Z',
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
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  },
];
