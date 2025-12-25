# Bonus Features Prompts

## Setup Time

**Prompt:** Add setup time that counts as working time before production starts.

**Solution:**
```typescript
// In WorkOrder type
setupTimeMinutes?: number;

// In scheduling
const totalWorkingMinutes = wo.data.durationMinutes + (wo.data.setupTimeMinutes ?? 0);
```

Setup time is treated as additional working time at the start of the work order.
Uses same shift/maintenance rules as production time.

## Schedule Metrics

**Prompt:** Calculate optimization metrics for the schedule.

**Implemented Metrics:**
```typescript
interface ScheduleMetrics {
  totalDelayMinutes: number;      // Sum of all delays
  averageDelayMinutes: number;    // Average delay per rescheduled order
  maxDelayMinutes: number;        // Maximum single order delay
  workOrdersRescheduled: number;  // Count of changed orders
  workOrdersUnchanged: number;    // Count of unchanged orders
  utilizationByWorkCenter: Map<string, number>; // working min / available min
}
```

**Delay Calculation:**
```typescript
delayMinutes = newEndDate - originalEndDate  // in minutes
```

**Utilization Calculation:**
```typescript
utilization = totalWorkingMinutes / availableShiftMinutes
```

## DAG with Cycle Detection

**Prompt:** Implement dependency graph with topological sort and cycle detection.

**Kahn's Algorithm (BFS-based):**
```typescript
function topologicalSort() {
  const inDegree = new Map();
  const queue = []; // nodes with no incoming edges

  // Initialize in-degrees
  for (const node of graph) {
    if (inDegree.get(node) === 0) queue.push(node);
  }

  const sorted = [];
  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);

    for (const dependent of getDependents(node)) {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) queue.push(dependent);
    }
  }

  // Cycle detected if not all nodes processed
  if (sorted.length !== graph.size) {
    return { hasCycle: true, cycleNodes: findCycleNodes() };
  }

  return { hasCycle: false, order: sorted };
}
```

## Console Table Output

**Prompt:** Format demo output with console.table for readability.

```typescript
function buildWorkOrderTable(workOrders) {
  const rows = workOrders.map(wo => ({
    'Work Order': wo.data.workOrderNumber,
    'Start': formatDateTime(wo.data.startDate),
    'End': formatDateTime(wo.data.endDate),
    'Duration': `${wo.data.durationMinutes} min`,
    'Dependencies': wo.data.dependsOnWorkOrderIds.join(', ') || '-',
  }));
  console.table(rows);
}
```
