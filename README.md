# Production Schedule Reflow System

A TypeScript-based production scheduling system that handles work order scheduling with constraint satisfaction.

## Features

- **Dependency Management**: Topological sorting with cycle detection
- **Work Center Conflicts**: Priority-based scheduling (earlier original start wins)
- **Shift Boundaries**: Respects work center operating hours
- **Maintenance Windows**: Avoids blocked time periods
- **Setup Time**: Accounts for pre-production setup time
- **Schedule Metrics**: Calculates delays, utilization, and rescheduling counts

## Installation

```bash
npm install
```

## Usage

### Run Demo

```bash
npm start
```

Runs 8 scenarios demonstrating different scheduling constraints.

### Run Tests

```bash
npm test
```

45 tests covering:
- Dependency graph operations
- Constraint validation
- Date utilities with shift handling
- Reflow service scenarios

## Architecture

```
src/
  reflow/
    types.ts           # Core data structures
    reflow.service.ts  # Main scheduling algorithm
    dependency-graph.ts # DAG with topological sort
    constraint-checker.ts # Constraint validation
  utils/
    date-utils.ts      # Shift-aware date calculations
  data/
    scenario-*.ts      # Test scenarios
  index.ts             # Demo runner
```

## Algorithm

1. Build dependency graph from work orders
2. Detect cycles using Kahn's algorithm (BFS topological sort)
3. Schedule maintenance orders first (fixed)
4. Process work orders by original start priority
5. For each work order:
   - Calculate earliest start from dependencies
   - Align to next available shift time
   - Resolve work center conflicts
   - Calculate end date accounting for shifts and maintenance

## Constraints

| Constraint | Priority | Behavior |
|------------|----------|----------|
| Dependencies | 1 | Must wait for predecessors |
| Work Center | 2 | Earlier original start wins |
| Shifts | 3 | Work only during operating hours |
| Maintenance | 4 | Skip blocked time windows |

## Test Scenarios

| Scenario | Description |
|----------|-------------|
| 0 | Basic reflow (no changes needed) |
| 1 | Delay cascade through dependencies |
| 2 | Shift spanning across days |
| 3 | Maintenance window avoidance |
| 4 | Multi-constraint (deps + maintenance + shifts) |
| 5 | Competing orders (resource conflicts) |
| 6 | Impossible schedule (circular dependency) |
| 7 | Setup time handling |

## Data Model

### WorkOrder
- `durationMinutes`: Working time required
- `setupTimeMinutes`: Setup time before production
- `dependsOnWorkOrderIds`: Predecessor work orders
- `isMaintenance`: Fixed time block flag

### WorkCenter
- `shifts`: Operating hours by day of week
- `maintenanceWindows`: Blocked time periods

### Metrics
- `totalDelayMinutes`: Sum of all delays
- `averageDelayMinutes`: Average delay per order
- `maxDelayMinutes`: Maximum single delay
- `utilizationByWorkCenter`: Working time / available time

## Trade-offs

### Greedy vs Optimization
- **Chosen:** Greedy algorithm (earliest available slot)
- **Trade-off:** May not minimize total delay, but predictable and fast
- **Rationale:** Simpler to understand, debug, and maintain; O(n²) worst case

### Push-forward vs Re-layout
- **Chosen:** Push-forward (move affected orders later)
- **Trade-off:** May leave gaps in schedule
- **Rationale:** Preserves user intent and schedule stability

### Priority: Earlier Original Start Wins
- **Chosen:** Original start date determines priority
- **Trade-off:** May delay orders with later original starts even if they could fit earlier
- **Rationale:** Predictable behavior, maintains relative ordering

## Known Limitations

1. **No backfilling**: Gaps left by pushed orders are not filled by later orders
2. **Single work center per order**: Orders cannot span multiple work centers
3. **No partial shifts**: Cannot handle mid-day shift breaks (e.g., lunch)
4. **UTC only**: All dates assumed to be UTC, no timezone handling
5. **No optimization**: Does not minimize total delay or maximize utilization
6. **Memory**: Stores all slots in memory; may not scale to millions of orders

## AI Prompts

See `prompts/` directory for AI collaboration documentation:
- `algorithm-design.md` - Core algorithm decisions
- `shift-calculation.md` - Shift boundary handling
- `maintenance-windows.md` - Maintenance window logic
- `bonus-features.md` - Setup time, metrics, DAG
