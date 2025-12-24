/**
 * Scenario 1: Delay Cascade
 *
 * WO-001 is delayed, causing WO-002 and WO-003 to cascade.
 * WO-002 depends on WO-001
 * WO-003 depends on WO-002
 *
 * Original schedule:
 *   WO-001: 08:00-10:00 (120 min)
 *   WO-002: 10:00-12:00 (120 min) - depends on WO-001
 *   WO-003: 12:00-14:00 (120 min) - depends on WO-002
 *
 * WO-001 is now delayed to 180 min duration:
 *   WO-001: 08:00-11:00 (180 min) - 1 hour delay
 *   WO-002: 11:00-13:00 (120 min) - pushed 1 hour
 *   WO-003: 13:00-15:00 (120 min) - pushed 1 hour
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
      endDate: '2025-01-06T10:00:00.000Z',
      durationMinutes: 180, // Changed from 120 to 180 - causes delay
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
      startDate: '2025-01-06T10:00:00.000Z',
      endDate: '2025-01-06T12:00:00.000Z',
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: ['wo-001'],
    },
  },
  {
    docId: 'wo-003',
    docType: 'workOrder',
    data: {
      workOrderNumber: 'WO-003',
      manufacturingOrderId: 'mo-001',
      workCenterId: 'wc-001',
      startDate: '2025-01-06T12:00:00.000Z',
      endDate: '2025-01-06T14:00:00.000Z',
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: ['wo-002'],
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
