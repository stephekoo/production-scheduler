/**
 * Large-Scale Scenario Generator
 *
 * Generates complete scenarios with work orders, work centers, and manufacturing orders.
 * Uses seeded random for reproducible generation.
 */

import { DateTime } from 'luxon';
import { SeededRandom } from './random.js';
import { generateWorkCenters } from './work-center-generator.js';
import { generateManufacturingOrders } from './manufacturing-order-generator.js';
import { generateWorkOrders } from './work-order-generator.js';
import { WorkOrder, WorkCenter, ManufacturingOrder } from '../../src/reflow/types.js';

export interface ScenarioConfig {
  seed: number;
  workOrderCount: number;
  workCenterCount: number;
  baseDate: DateTime;
}

export interface GeneratedScenario {
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  manufacturingOrders: ManufacturingOrder[];
  metadata: {
    seed: number;
    generatedAt: string;
    workOrderCount: number;
    workCenterCount: number;
    manufacturingOrderCount: number;
  };
}

const DEFAULT_CONFIG: Partial<ScenarioConfig> = {
  seed: 12345,
  workOrderCount: 1000,
  workCenterCount: 25,
  baseDate: DateTime.fromISO('2025-01-06T08:00:00.000Z', { zone: 'utc' }),
};

/**
 * Generate a complete scenario with the specified configuration.
 */
export function generateScenario(config?: Partial<ScenarioConfig>): GeneratedScenario {
  const cfg: ScenarioConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  } as ScenarioConfig;

  const rng = new SeededRandom(cfg.seed);

  // Generate work centers first
  const workCenters = generateWorkCenters(rng, {
    count: cfg.workCenterCount,
    baseDate: cfg.baseDate,
    maintenanceProbability: 0.2,
  });

  // Generate manufacturing orders (roughly 1 per 2-3 work orders)
  const manufacturingOrderCount = Math.ceil(cfg.workOrderCount / 2.5);
  const manufacturingOrders = generateManufacturingOrders(rng, {
    count: manufacturingOrderCount,
    baseDate: cfg.baseDate,
  });

  // Generate work orders
  const workOrders = generateWorkOrders(rng, {
    count: cfg.workOrderCount,
    baseDate: cfg.baseDate,
    workCenters,
    manufacturingOrders,
    noDependencyProbability: 0.3,
    singleDependencyProbability: 0.5,
    minDurationMinutes: 30,
    maxDurationMinutes: 480,
    setupTimeProbability: 0.3,
    minSetupTimeMinutes: 15,
    maxSetupTimeMinutes: 60,
    maintenanceProbability: 0.02,
  });

  return {
    workOrders,
    workCenters,
    manufacturingOrders,
    metadata: {
      seed: cfg.seed,
      generatedAt: new Date().toISOString(),
      workOrderCount: workOrders.length,
      workCenterCount: workCenters.length,
      manufacturingOrderCount: manufacturingOrders.length,
    },
  };
}

// Re-export for convenience
export { SeededRandom } from './random.js';
