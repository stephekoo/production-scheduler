/**
 * Scenario 7: Setup Time
 *
 * Work orders with setup time before production starts.
 * Setup time counts as working time within shifts.
 *
 * Setup:
 * - WO-001: 120 min duration + 30 min setup = 150 min total
 *   - Starts Monday 08:00
 *   - Expected end: 10:30
 *
 * - WO-002: 180 min duration + 60 min setup = 240 min total
 *   - Depends on WO-001
 *   - Expected start: 10:30, end: 14:30
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
      endDate: '2025-01-06T10:00:00.000Z', // Wrong - ignores setup time
      durationMinutes: 120,
      setupTimeMinutes: 30,
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
      startDate: '2025-01-06T10:00:00.000Z', // Wrong - WO-001 ends later
      endDate: '2025-01-06T13:00:00.000Z',
      durationMinutes: 180,
      setupTimeMinutes: 60,
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
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  },
];
