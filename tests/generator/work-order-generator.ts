/**
 * Work Order Generator
 *
 * Generates work orders with valid DAG dependencies.
 * Dependencies only reference earlier work orders (by index) to ensure no cycles.
 */

import { WorkOrder, WorkCenter, ManufacturingOrder } from '../../src/reflow/types.js';
import { SeededRandom } from './random.js';
import { DateTime } from 'luxon';

export interface WorkOrderGeneratorConfig {
  count: number;
  baseDate: DateTime;
  workCenters: WorkCenter[];
  manufacturingOrders: ManufacturingOrder[];
  // Dependency configuration
  noDependencyProbability: number; // ~0.3 = 30% have no dependencies
  singleDependencyProbability: number; // ~0.5 = 50% have 1 dependency
  // Remaining have 2-3 dependencies
  // Duration configuration
  minDurationMinutes: number;
  maxDurationMinutes: number;
  // Setup time configuration
  setupTimeProbability: number; // ~0.3 = 30% have setup time
  minSetupTimeMinutes: number;
  maxSetupTimeMinutes: number;
  // Maintenance order probability
  maintenanceProbability: number; // ~0.02 = 2% are maintenance orders
}

const DEFAULT_CONFIG: Partial<WorkOrderGeneratorConfig> = {
  noDependencyProbability: 0.3,
  singleDependencyProbability: 0.5,
  minDurationMinutes: 30,
  maxDurationMinutes: 480,
  setupTimeProbability: 0.3,
  minSetupTimeMinutes: 15,
  maxSetupTimeMinutes: 60,
  maintenanceProbability: 0.02,
};

/**
 * Generate work orders with valid dependency graph.
 */
export function generateWorkOrders(
  rng: SeededRandom,
  config: WorkOrderGeneratorConfig
): WorkOrder[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const workOrders: WorkOrder[] = [];

  // Track work orders by their assigned work center for scheduling
  const workCenterSchedules = new Map<string, DateTime>();

  // Initialize work center schedules to base date
  for (const wc of cfg.workCenters) {
    workCenterSchedules.set(wc.docId, cfg.baseDate);
  }

  for (let i = 0; i < cfg.count; i++) {
    const docId = `wo-${String(i + 1).padStart(4, '0')}`;
    const workOrderNumber = `WO-${String(i + 1).padStart(4, '0')}`;

    // Assign to random work center
    const workCenter = rng.pick(cfg.workCenters);
    const workCenterId = workCenter.docId;

    // Assign to random manufacturing order
    const manufacturingOrder = rng.pick(cfg.manufacturingOrders);
    const manufacturingOrderId = manufacturingOrder.docId;

    // Generate duration
    const durationMinutes = rng.nextInt(cfg.minDurationMinutes!, cfg.maxDurationMinutes!);

    // Generate setup time (optional)
    const setupTimeMinutes = rng.nextBool(cfg.setupTimeProbability!)
      ? rng.nextInt(cfg.minSetupTimeMinutes!, cfg.maxSetupTimeMinutes!)
      : undefined;

    // Generate priority (1-5, lower = higher priority)
    const priority = rng.nextInt(1, 5);

    // Is this a maintenance order?
    const isMaintenance = rng.nextBool(cfg.maintenanceProbability!);

    // Generate dependencies (only from earlier work orders)
    const dependsOnWorkOrderIds = generateDependencies(rng, workOrders, cfg);

    // Calculate start date based on dependencies and work center schedule
    const startDate = calculateStartDate(
      rng,
      workOrders,
      dependsOnWorkOrderIds,
      workCenterSchedules.get(workCenterId)!,
      cfg.baseDate
    );

    // Estimate end date (simple: start + duration, actual scheduling handles shifts)
    const endDate = startDate.plus({ minutes: durationMinutes + (setupTimeMinutes ?? 0) });

    // Update work center schedule
    workCenterSchedules.set(workCenterId, endDate);

    workOrders.push({
      docId,
      docType: 'workOrder',
      data: {
        workOrderNumber,
        manufacturingOrderId,
        workCenterId,
        startDate: startDate.toISO()!,
        endDate: endDate.toISO()!,
        durationMinutes,
        setupTimeMinutes,
        priority,
        isMaintenance,
        dependsOnWorkOrderIds,
      },
    });
  }

  // Introduce some conflicts by overlapping start times
  introduceConflicts(rng, workOrders, 0.3); // 30% of orders get shifted to create overlaps

  return workOrders;
}

/**
 * Generate valid dependencies (only from earlier work orders).
 */
function generateDependencies(
  rng: SeededRandom,
  existingOrders: WorkOrder[],
  cfg: WorkOrderGeneratorConfig
): string[] {
  if (existingOrders.length === 0) {
    return [];
  }

  // Determine number of dependencies
  const roll = rng.next();
  let depCount: number;

  if (roll < cfg.noDependencyProbability!) {
    depCount = 0;
  } else if (roll < cfg.noDependencyProbability! + cfg.singleDependencyProbability!) {
    depCount = 1;
  } else {
    depCount = rng.nextInt(2, 3);
  }

  if (depCount === 0) {
    return [];
  }

  // Sample from existing orders (ensures DAG - no cycles possible)
  const maxCandidates = Math.min(existingOrders.length, 20); // Limit search to recent orders
  const startIndex = Math.max(0, existingOrders.length - maxCandidates);
  const candidates = existingOrders.slice(startIndex);

  const selected = rng.sample(candidates, Math.min(depCount, candidates.length));
  return selected.map((wo) => wo.docId);
}

/**
 * Calculate start date based on dependencies and work center availability.
 */
function calculateStartDate(
  rng: SeededRandom,
  existingOrders: WorkOrder[],
  dependencies: string[],
  workCenterNextAvailable: DateTime,
  baseDate: DateTime
): DateTime {
  let earliestStart = baseDate;

  // Must start after all dependencies complete
  for (const depId of dependencies) {
    const dep = existingOrders.find((wo) => wo.docId === depId);
    if (dep) {
      const depEnd = DateTime.fromISO(dep.data.endDate, { zone: 'utc' });
      if (depEnd > earliestStart) {
        earliestStart = depEnd;
      }
    }
  }

  // Add some random gap (0-4 hours) for scheduling flexibility
  const gapMinutes = rng.nextInt(0, 240);
  earliestStart = earliestStart.plus({ minutes: gapMinutes });

  // Align to work hours (8am-5pm range)
  if (earliestStart.hour < 8) {
    earliestStart = earliestStart.set({ hour: 8, minute: 0 });
  } else if (earliestStart.hour >= 17) {
    earliestStart = earliestStart.plus({ days: 1 }).set({ hour: 8, minute: 0 });
  }

  return earliestStart;
}

/**
 * Introduce conflicts by shifting some work orders to overlap.
 * This creates realistic scenarios that need reflow resolution.
 */
function introduceConflicts(
  rng: SeededRandom,
  workOrders: WorkOrder[],
  conflictProbability: number
): void {
  // Group by work center
  const byWorkCenter = new Map<string, WorkOrder[]>();
  for (const wo of workOrders) {
    const list = byWorkCenter.get(wo.data.workCenterId) ?? [];
    list.push(wo);
    byWorkCenter.set(wo.data.workCenterId, list);
  }

  // For each work center, randomly shift some orders to create overlaps
  for (const [, orders] of byWorkCenter) {
    for (let i = 1; i < orders.length; i++) {
      if (rng.nextBool(conflictProbability)) {
        const prevOrder = orders[i - 1];
        const currOrder = orders[i];

        // Shift current order to overlap with previous
        const prevStart = DateTime.fromISO(prevOrder.data.startDate, { zone: 'utc' });
        const overlapMinutes = rng.nextInt(30, 120);

        const newStart = prevStart.plus({ minutes: overlapMinutes });
        const duration = currOrder.data.durationMinutes + (currOrder.data.setupTimeMinutes ?? 0);
        const newEnd = newStart.plus({ minutes: duration });

        currOrder.data.startDate = newStart.toISO()!;
        currOrder.data.endDate = newEnd.toISO()!;
      }
    }
  }
}
