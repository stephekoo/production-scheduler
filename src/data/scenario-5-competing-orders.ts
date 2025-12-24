/**
 * Scenario 5: Competing Orders
 *
 * Multiple work orders competing for the same work center.
 * "Earlier original start wins" priority rule applies.
 *
 * Setup:
 * - WO-001: Original start 08:00, 180 min (3 hours)
 * - WO-002: Original start 09:00, 120 min (2 hours)
 * - WO-003: Original start 10:00, 120 min (2 hours)
 *
 * All on same work center, all overlapping with each other.
 *
 * Expected resolution:
 * - WO-001: 08:00-11:00 (wins, earliest original start)
 * - WO-002: 11:00-13:00 (pushed after WO-001)
 * - WO-003: 13:00-15:00 (pushed after WO-002)
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
      manufacturingOrderId: 'mo-002',
      workCenterId: 'wc-001',
      startDate: '2025-01-06T09:00:00.000Z', // Overlaps with WO-001
      endDate: '2025-01-06T11:00:00.000Z',
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  },
  {
    docId: 'wo-003',
    docType: 'workOrder',
    data: {
      workOrderNumber: 'WO-003',
      manufacturingOrderId: 'mo-003',
      workCenterId: 'wc-001',
      startDate: '2025-01-06T10:00:00.000Z', // Overlaps with WO-001 and WO-002
      endDate: '2025-01-06T12:00:00.000Z',
      durationMinutes: 120,
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
      quantity: 50,
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  },
  {
    docId: 'mo-002',
    docType: 'manufacturingOrder',
    data: {
      manufacturingOrderNumber: 'MO-002',
      itemId: 'item-002',
      quantity: 75,
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  },
  {
    docId: 'mo-003',
    docType: 'manufacturingOrder',
    data: {
      manufacturingOrderNumber: 'MO-003',
      itemId: 'item-003',
      quantity: 60,
      dueDate: '2025-01-10T17:00:00.000Z',
    },
  },
];
