/**
 * Dependency Graph - DAG with topological sort and cycle detection.
 *
 * Key considerations:
 * - Work orders can depend on other work orders
 * - Dependencies form a DAG (Directed Acyclic Graph)
 * - Cycle detection prevents invalid dependency chains
 */

import { WorkOrder } from './types.js';

export interface DependencyNode {
  workOrderId: string;
  dependsOn: string[];
  dependents: string[];
}

export interface TopologicalSortResult {
  sorted: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();

  /**
   * Build graph from work orders.
   */
  build(workOrders: WorkOrder[]): void {
    this.nodes.clear();

    // Create nodes for all work orders
    for (const wo of workOrders) {
      this.nodes.set(wo.docId, {
        workOrderId: wo.docId,
        dependsOn: [...wo.data.dependsOnWorkOrderIds],
        dependents: [],
      });
    }

    // Build reverse edges (dependents)
    for (const wo of workOrders) {
      for (const depId of wo.data.dependsOnWorkOrderIds) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(wo.docId);
        }
      }
    }
  }

  /**
   * Get dependencies for a work order.
   */
  getDependencies(workOrderId: string): string[] {
    const node = this.nodes.get(workOrderId);
    return node ? node.dependsOn : [];
  }

  /**
   * Get dependents (work orders that depend on this one).
   */
  getDependents(workOrderId: string): string[] {
    const node = this.nodes.get(workOrderId);
    return node ? node.dependents : [];
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Returns sorted order and detects cycles.
   */
  topologicalSort(): TopologicalSortResult {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const sorted: string[] = [];

    // Calculate in-degree for each node
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.dependsOn.filter(dep => this.nodes.has(dep)).length);
    }

    // Find nodes with no dependencies
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    // Process nodes in topological order
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const node = this.nodes.get(current)!;
      for (const dependent of node.dependents) {
        const newDegree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // Check for cycle
    if (sorted.length !== this.nodes.size) {
      const cycleNodes = [...this.nodes.keys()].filter(
        id => !sorted.includes(id)
      );
      return { sorted: [], hasCycle: true, cycleNodes };
    }

    return { sorted, hasCycle: false };
  }

  /**
   * Detect if adding a dependency would create a cycle.
   */
  wouldCreateCycle(fromId: string, toId: string): boolean {
    // Check if there's a path from toId to fromId (would create cycle)
    const visited = new Set<string>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const node = this.nodes.get(current);
      if (node) {
        for (const dep of node.dependsOn) {
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }

    return false;
  }
}
