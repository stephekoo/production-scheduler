/**
 * Demo runner with console table output.
 */

import { ReflowService } from './reflow/reflow.service.js';
import { ReflowInput, WorkOrder, ReflowChange } from './reflow/types.js';
import * as scenario0 from './data/scenario-0-basic.js';
import * as scenario1 from './data/scenario-1-delay.js';
import * as scenario2 from './data/scenario-2-shifts.js';
import * as scenario3 from './data/scenario-3-maintenance.js';
import * as scenario4 from './data/scenario-4-multi-constraint.js';
import * as scenario5 from './data/scenario-5-competing-orders.js';
import * as scenario6 from './data/scenario-6-impossible.js';
import * as scenario7 from './data/scenario-7-setup-time.js';
import * as scenario8 from './data/scenario-with-json-data.js';

const service = new ReflowService();

function formatDateTime(iso: string): string {
  return iso.replace('T', ' ').replace('.000Z', '');
}

function buildWorkOrderTable(workOrders: WorkOrder[], title: string) {
  console.log(`\n${title}:`);
  const rows = workOrders.map(wo => ({
    'Work Order': wo.data.workOrderNumber,
    'Start': formatDateTime(wo.data.startDate),
    'End': formatDateTime(wo.data.endDate),
    'Duration': `${wo.data.durationMinutes} min`,
    'Setup': wo.data.setupTimeMinutes ? `${wo.data.setupTimeMinutes} min` : '-',
    'Dependencies': wo.data.dependsOnWorkOrderIds.join(', ') || '-',
  }));
  console.table(rows);
}

function buildChangesTable(changes: ReflowChange[]) {
  if (changes.length === 0) {
    console.log('\nChanges: None');
    return;
  }
  console.log('\nChanges:');
  const rows = changes.map(c => ({
    'Work Order': c.workOrderNumber,
    'Original Start': formatDateTime(c.originalStartDate),
    'New Start': formatDateTime(c.newStartDate),
    'Delay': `${c.delayMinutes} min`,
    'Reason': c.reason,
  }));
  console.table(rows);
}

function runScenario(name: string, data: ReflowInput) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('='.repeat(60));

  buildWorkOrderTable(data.workOrders, 'Input Work Orders');

  const result = service.reflow({
    workOrders: data.workOrders,
    workCenters: data.workCenters,
    manufacturingOrders: data.manufacturingOrders,
  });

  buildWorkOrderTable(result.updatedWorkOrders, 'Output Work Orders');
  buildChangesTable(result.changes);

  console.log('\nMetrics:');
  console.table({
    'Total Delay': `${result.metrics.totalDelayMinutes} min`,
    'Average Delay': `${result.metrics.averageDelayMinutes} min`,
    'Max Delay': `${result.metrics.maxDelayMinutes} min`,
    'Rescheduled': result.metrics.workOrdersRescheduled,
    'Unchanged': result.metrics.workOrdersUnchanged,
  });

  console.log(`\n${result.explanation}`);
}

runScenario('Scenario 0: Basic Reflow Test', scenario0);
runScenario('Scenario 1: Delay Cascade', scenario1);
runScenario('Scenario 2: Shift Spanning', scenario2);
runScenario('Scenario 3: Maintenance Window', scenario3);
runScenario('Scenario 4: Multi-Constraint', scenario4);
runScenario('Scenario 5: Competing Orders', scenario5);
runScenario('Scenario 6: Impossible (Circular)', scenario6);
runScenario('Scenario 7: Setup Time', scenario7);

// Large-scale scenario (special handling - no full table output)
if (scenario8.workOrders.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  Scenario 8: Large-Scale JSON Data');
  console.log('='.repeat(60));
  console.log(`\nInput: ${scenario8.workOrders.length} work orders, ${scenario8.workCenters.length} work centers`);
  if (scenario8.metadata?.seed) {
    console.log(`Seed: ${scenario8.metadata.seed}, Generated: ${scenario8.metadata.generatedAt}`);
  }

  const startTime = performance.now();
  const result = service.reflow({
    workOrders: scenario8.workOrders,
    workCenters: scenario8.workCenters,
    manufacturingOrders: scenario8.manufacturingOrders,
  });
  const elapsed = performance.now() - startTime;

  console.log(`\nReflow completed in ${elapsed.toFixed(2)}ms`);
  console.log('\nMetrics:');
  console.table({
    'Total Delay': `${result.metrics.totalDelayMinutes} min`,
    'Average Delay': `${result.metrics.averageDelayMinutes.toFixed(1)} min`,
    'Max Delay': `${result.metrics.maxDelayMinutes} min`,
    'Rescheduled': result.metrics.workOrdersRescheduled,
    'Unchanged': result.metrics.workOrdersUnchanged,
  });
  console.log(`\n${result.explanation}`);
} else {
  console.log('\nScenario 8: Skipped (no data). Run `npm run generate:scenario` first.');
}
