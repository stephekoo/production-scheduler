/**
 * Demo runner.
 */

import { ReflowService } from './reflow/reflow.service.js';
import { ReflowInput } from './reflow/types.js';
import * as scenario0 from './data/scenario-0-basic.js';
import * as scenario1 from './data/scenario-1-delay.js';
import * as scenario2 from './data/scenario-2-shifts.js';
import * as scenario3 from './data/scenario-3-maintenance.js';
import * as scenario4 from './data/scenario-4-multi-constraint.js';
import * as scenario5 from './data/scenario-5-competing-orders.js';
import * as scenario6 from './data/scenario-6-impossible.js';
import * as scenario7 from './data/scenario-7-setup-time.js';

const service = new ReflowService();

function runScenario(name: string, data: ReflowInput) {
  console.log(`=== ${name} ===\n`);

  console.log('Input Work Orders:');
  for (const wo of data.workOrders) {
    const deps = wo.data.dependsOnWorkOrderIds.length > 0
      ? ` [depends on: ${wo.data.dependsOnWorkOrderIds.join(', ')}]`
      : '';
    console.log(`  ${wo.data.workOrderNumber}: ${wo.data.startDate} -> ${wo.data.endDate} (${wo.data.durationMinutes} min)${deps}`);
  }

  const result = service.reflow({
    workOrders: data.workOrders,
    workCenters: data.workCenters,
    manufacturingOrders: data.manufacturingOrders,
  });

  console.log('\nOutput Work Orders:');
  for (const wo of result.updatedWorkOrders) {
    console.log(`  ${wo.data.workOrderNumber}: ${wo.data.startDate} -> ${wo.data.endDate}`);
  }

  console.log('\nChanges:');
  if (result.changes.length === 0) {
    console.log('  No changes');
  } else {
    for (const change of result.changes) {
      console.log(`  ${change.workOrderNumber}: ${change.reason} (delay: ${change.delayMinutes} min)`);
    }
  }

  console.log('\nMetrics:');
  console.log(`  Total delay: ${result.metrics.totalDelayMinutes} min`);
  console.log(`  Average delay: ${result.metrics.averageDelayMinutes} min`);
  console.log(`  Max delay: ${result.metrics.maxDelayMinutes} min`);
  console.log(`  Rescheduled: ${result.metrics.workOrdersRescheduled}, Unchanged: ${result.metrics.workOrdersUnchanged}`);

  console.log('\n' + result.explanation);
  console.log('\n');
}

runScenario('Scenario 0: Basic Reflow Test', scenario0);
runScenario('Scenario 1: Delay Cascade', scenario1);
runScenario('Scenario 2: Shift Spanning', scenario2);
runScenario('Scenario 3: Maintenance Window', scenario3);
runScenario('Scenario 4: Multi-Constraint', scenario4);
runScenario('Scenario 5: Competing Orders', scenario5);
runScenario('Scenario 6: Impossible (Circular)', scenario6);
runScenario('Scenario 7: Setup Time', scenario7);
