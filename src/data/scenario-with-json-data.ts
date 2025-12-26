/**
 * Scenario 8: Large-Scale JSON Data
 *
 * Loads pre-generated demo data from JSON file.
 * Contains 1000 work orders across 25 work centers with realistic:
 * - Dependency chains (DAG structure)
 * - Shift schedules
 * - Maintenance windows
 * - Setup times
 * - Overlapping conflicts requiring reflow
 *
 * Generate with: npm run generate:scenario
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WorkOrder, WorkCenter, ManufacturingOrder } from '../reflow/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DemoData {
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

// Load JSON data
const jsonPath = path.join(__dirname, '../../tests/demo-data.json');

let data: DemoData;

try {
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  data = JSON.parse(jsonContent) as DemoData;
} catch {
  // Fallback if file doesn't exist yet
  console.warn(`Warning: ${jsonPath} not found. Run 'npm run generate:scenario' to create it.`);
  data = {
    workOrders: [],
    workCenters: [],
    manufacturingOrders: [],
    metadata: {
      seed: 0,
      generatedAt: '',
      workOrderCount: 0,
      workCenterCount: 0,
      manufacturingOrderCount: 0,
    },
  };
}

export const workOrders: WorkOrder[] = data.workOrders;
export const workCenters: WorkCenter[] = data.workCenters;
export const manufacturingOrders: ManufacturingOrder[] = data.manufacturingOrders;
export const metadata = data.metadata;
