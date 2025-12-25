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

```mermaid
graph TB
    subgraph Input
        WO[Work Orders]
        WC[Work Centers]
        MO[Manufacturing Orders]
    end

    subgraph ReflowService
        DG[Dependency Graph]
        CC[Constraint Checker]
        DU[Date Utils]
    end

    subgraph Output
        UWO[Updated Work Orders]
        CH[Changes]
        ME[Metrics]
    end

    WO --> DG
    WO --> CC
    WC --> CC
    WC --> DU
    DG --> UWO
    CC --> UWO
    DU --> UWO
    UWO --> CH
    UWO --> ME
```

## Algorithm

```mermaid
flowchart TD
    A[Start] --> B[Build Dependency Graph]
    B --> C{Cycle Detected?}
    C -->|Yes| D[Return Error]
    C -->|No| E[Schedule Maintenance Orders]
    E --> F[Sort by Original Start]
    F --> G[Process Next Work Order]
    G --> H[Find Earliest Start from Dependencies]
    H --> I[Align to Shift Hours]
    I --> J[Skip Maintenance Windows]
    J --> K{Work Center Conflict?}
    K -->|Yes| L[Push to After Conflict]
    L --> I
    K -->|No| M[Calculate End Date]
    M --> N{More Orders?}
    N -->|Yes| G
    N -->|No| O[Return Updated Schedule]
```

**Steps:**
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

### Dependency Example

```mermaid
graph LR
    WO1[WO-001<br/>8:00-10:00] --> WO2[WO-002<br/>10:00-12:00]
    WO1 --> WO3[WO-003<br/>10:00-11:00]
    WO2 --> WO4[WO-004<br/>12:00-14:00]
    WO3 --> WO4
```

WO-004 cannot start until both WO-002 and WO-003 complete.

### Shift Spanning Example

```
Work Order: 120 min duration
Shift: Mon-Fri 8:00-17:00

Monday 16:00 ──────────────────────────────────────────► Tuesday 09:00
    │                                                        │
    ├── Work 60 min (16:00-17:00) ──┐                       │
    │                               │                       │
    │   ┌───────────────────────────┘                       │
    │   │ Pause overnight (shift ends)                      │
    │   └───────────────────────────┐                       │
    │                               │                       │
    │                               └── Resume 08:00 ───────┤
    │                                   Work 60 min         │
    └───────────────────────────────────────────────────────┘
```

### Maintenance Window Example

```
Work Order: 240 min (4 hours)
Maintenance: 10:00-14:00

08:00     10:00          14:00     16:00
  │         │              │         │
  ├─ Work ──┤              ├─ Work ──┤
  │ 120 min │  Maintenance │ 120 min │
  │         │   (blocked)  │         │
  ▼         ▼              ▼         ▼
┌───────────┬──────────────┬─────────┐
│  Working  │   Skipped    │ Working │
│  2 hours  │   4 hours    │ 2 hours │
└───────────┴──────────────┴─────────┘
```

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
