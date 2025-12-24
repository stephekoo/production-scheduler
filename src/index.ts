/**
 * Demo runner.
 */

import { ReflowService } from './reflow/reflow.service.js';
import { workOrders, workCenters, manufacturingOrders } from './data/scenario-0-basic.js';

const service = new ReflowService();

console.log('=== Scenario 0: Basic Reflow Test ===\n');

console.log('Input Work Orders:');
for (const wo of workOrders) {
  console.log(`  ${wo.data.workOrderNumber}: ${wo.data.startDate} -> ${wo.data.endDate} (${wo.data.durationMinutes} min)`);
}

const result = service.reflow({ workOrders, workCenters, manufacturingOrders });

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

// Note: WO-001 and WO-002 overlap (10AM-11AM conflict)
// Work center conflicts not handled yet
console.log('\n⚠️  Note: Work center conflict exists but not handled yet');
