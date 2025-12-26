#!/usr/bin/env npx tsx
/**
 * CLI script to generate large-scale demo data and save to JSON.
 *
 * Usage:
 *   npx tsx src/data/generator/generate.ts [seed] [workOrderCount] [workCenterCount]
 *
 * Examples:
 *   npx tsx src/data/generator/generate.ts           # Default: 1000 orders, 25 centers
 *   npx tsx src/data/generator/generate.ts 42        # Custom seed
 *   npx tsx src/data/generator/generate.ts 42 5000   # 5000 orders
 *   npx tsx src/data/generator/generate.ts 42 1000 50 # 1000 orders, 50 centers
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateScenario } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const seed = args[0] ? parseInt(args[0], 10) : 12345;
const workOrderCount = args[1] ? parseInt(args[1], 10) : 1000;
const workCenterCount = args[2] ? parseInt(args[2], 10) : 25;

console.log('🏭 Large-Scale Scenario Generator');
console.log('==================================');
console.log(`Seed: ${seed}`);
console.log(`Work Orders: ${workOrderCount}`);
console.log(`Work Centers: ${workCenterCount}`);
console.log('');

// Generate scenario
console.log('Generating scenario...');
const startTime = performance.now();

const scenario = generateScenario({
  seed,
  workOrderCount,
  workCenterCount,
});

const generateTime = performance.now() - startTime;
console.log(`Generated in ${generateTime.toFixed(2)}ms`);

// Calculate statistics
const dependencyCount = scenario.workOrders.reduce(
  (sum, wo) => sum + wo.data.dependsOnWorkOrderIds.length,
  0
);
const withSetupTime = scenario.workOrders.filter((wo) => wo.data.setupTimeMinutes).length;
const maintenanceOrders = scenario.workOrders.filter((wo) => wo.data.isMaintenance).length;
const withMaintenanceWindows = scenario.workCenters.filter(
  (wc) => wc.data.maintenanceWindows.length > 0
).length;

console.log('');
console.log('Statistics:');
console.log(`  Work Orders: ${scenario.workOrders.length}`);
console.log(`  Work Centers: ${scenario.workCenters.length}`);
console.log(`  Manufacturing Orders: ${scenario.manufacturingOrders.length}`);
console.log(`  Dependency Edges: ${dependencyCount}`);
console.log(`  With Setup Time: ${withSetupTime} (${((withSetupTime / scenario.workOrders.length) * 100).toFixed(1)}%)`);
console.log(`  Maintenance Orders: ${maintenanceOrders}`);
console.log(`  Work Centers with Maintenance: ${withMaintenanceWindows}`);

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'demo-data.json');
const jsonContent = JSON.stringify(scenario, null, 2);

fs.writeFileSync(outputPath, jsonContent, 'utf-8');

const fileSizeKB = (Buffer.byteLength(jsonContent, 'utf-8') / 1024).toFixed(1);
console.log('');
console.log(`✅ Saved to: ${outputPath}`);
console.log(`   File size: ${fileSizeKB} KB`);
