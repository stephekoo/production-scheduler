/**
 * Scenario 6: Impossible Schedule (Circular Dependency)
 *
 * This scenario demonstrates detection of an impossible schedule
 * due to circular dependencies.
 *
 * Setup:
 * - WO-001 depends on WO-003
 * - WO-002 depends on WO-001
 * - WO-003 depends on WO-002
 *
 * This creates a cycle: WO-001 -> WO-003 -> WO-002 -> WO-001
 *
 * Expected result:
 * - Algorithm detects cycle
 * - Returns explanation of why constraints cannot be satisfied
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
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: ['wo-003'], // Circular!
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
      dependsOnWorkOrderIds: ['wo-001'], // Circular!
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
      dependsOnWorkOrderIds: ['wo-002'], // Circular!
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
