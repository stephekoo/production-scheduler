# Algorithm Design Prompts

## Initial Approach

**Prompt:** Design a production schedule reflow algorithm that handles:
- Work order dependencies (DAG)
- Work center conflicts (no overlaps)
- Shift boundaries (pause/resume work)
- Maintenance windows (blocked time)

**Key Decisions:**

1. **Topological Sort for Dependencies**
   - Used Kahn's algorithm (BFS-based) instead of DFS
   - Provides natural ordering by processing nodes with no incoming edges first
   - Detects cycles by checking if all nodes were processed

2. **Priority-based Conflict Resolution**
   - "Earlier original start wins" - work orders keep their relative priority
   - Avoids arbitrary reordering that could surprise users
   - Maintains schedule stability

3. **Greedy Scheduling**
   - Process work orders in priority order
   - Each order gets earliest available slot
   - Simple, predictable, efficient O(n²) worst case

## Trade-offs Considered

**Greedy vs Optimization:**
- Greedy: Fast, predictable, may not minimize total delay
- Optimization (e.g., constraint satisfaction): Better solutions, slower, complex
- Decision: Greedy for MVP, add optimization later

**Push-forward vs Re-layout:**
- Push-forward: Move affected orders later, preserve unaffected
- Re-layout: Completely reschedule from scratch
- Decision: Push-forward preserves user intent

## Algorithm Flow

```
1. Build dependency graph
2. Detect cycles (fail fast)
3. Schedule maintenance orders (fixed)
4. For each work order (by priority):
   a. Find earliest start (after dependencies)
   b. Align to shift hours
   c. Avoid maintenance windows
   d. Resolve work center conflicts
   e. Calculate end date with shift awareness
```
