/**
 * Demo runner.
 */

import { ReflowService } from './reflow/reflow.service.js';
import * as scenario0 from './data/scenario-0-basic.js';
import * as scenario1 from './data/scenario-1-delay.js';

const service = new ReflowService();

function runScenario(name: string, data: typeof scenario0) {
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

  console.log('\n' + result.explanation);
  console.log('\n');
}

runScenario('Scenario 0: Basic Reflow Test', scenario0);
runScenario('Scenario 1: Delay Cascade', scenario1);
