/**
 * Manufacturing Order Generator
 *
 * Generates manufacturing orders with realistic items and due dates.
 */

import { ManufacturingOrder } from '../../src/reflow/types.js';
import { SeededRandom } from './random.js';
import { DateTime } from 'luxon';

const ITEM_PREFIXES = [
  'Pipe',
  'Tube',
  'Fitting',
  'Valve',
  'Connector',
  'Elbow',
  'Tee',
  'Reducer',
  'Coupling',
  'Flange',
];

const ITEM_SIZES = ['25mm', '50mm', '75mm', '100mm', '150mm', '200mm'];
const ITEM_MATERIALS = ['PVC', 'HDPE', 'PP', 'ABS', 'Steel'];

export interface ManufacturingOrderGeneratorConfig {
  count: number;
  baseDate: DateTime;
}

/**
 * Generate manufacturing orders.
 */
export function generateManufacturingOrders(
  rng: SeededRandom,
  config: ManufacturingOrderGeneratorConfig
): ManufacturingOrder[] {
  const orders: ManufacturingOrder[] = [];

  for (let i = 0; i < config.count; i++) {
    // Generate item description
    const prefix = rng.pick(ITEM_PREFIXES);
    const size = rng.pick(ITEM_SIZES);
    const material = rng.pick(ITEM_MATERIALS);
    const itemId = `${material}-${prefix}-${size}`.toLowerCase().replace(/\s+/g, '-');

    // Due date: 1-4 weeks from base date
    const dueDayOffset = rng.nextInt(7, 28);
    const dueDate = config.baseDate.plus({ days: dueDayOffset }).set({
      hour: 17,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    // Quantity: 10-500 units
    const quantity = rng.nextInt(1, 50) * 10;

    orders.push({
      docId: `mo-${String(i + 1).padStart(4, '0')}`,
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: `MO-${String(i + 1).padStart(4, '0')}`,
        itemId,
        quantity,
        dueDate: dueDate.toISO()!,
      },
    });
  }

  return orders;
}
