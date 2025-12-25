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
